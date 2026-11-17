/* Selective Prep – a small offline-capable practice test runner.
   No build step. Tests live in tests/*.json and are listed in tests/index.json. */
(() => {
  'use strict';

  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const PROGRESS_KEY = 'selective-prep:in-progress'; // only the test being sat; cleared on submit
  const app = document.getElementById('app');
  const modal = document.getElementById('modal');

  const state = {
    tests: [],        // from tests/index.json
    test: null,       // loaded test JSON
    file: null,
    answers: {},      // { [n]: 'A'..'E' }
    flags: {},        // { [n]: true }
    current: 0,       // index into test.questions
    startedAt: 0,
    endAt: 0,
    submittedAt: 0,
    timeUp: false,
    filter: 'wrong',
    timerId: null,
    sections: [],
    sectionIdx: 0,   // Maths / Reading
    picks: {},       // chosen test per section
    passageUI: { id: null, open: true, scroll: 0, tab: 'A' },
  };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtClock = (ms) => {
    const t = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  };
  const fmtDuration = (ms) => {
    const t = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(t / 60), s = t % 60;
    return m ? `${m} min ${s} s` : `${s} s`;
  };
  const store = {
    save() {
      if (!state.test) return;
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify({
          file: state.file, answers: state.answers, flags: state.flags,
          current: state.current, startedAt: state.startedAt, endAt: state.endAt,
          prompt: state.writing ? state.writing.prompt.id : undefined,
          text: state.writing ? state.writing.text : undefined,
          plan: state.writing ? state.writing.plan : undefined,
        }));
      } catch (e) { /* storage may be unavailable (private mode) – the test still works */ }
    },
    load() {
      try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'); } catch (e) { return null; }
    },
    clear() { try { localStorage.removeItem(PROGRESS_KEY); } catch (e) { /* ignore */ } },
  };
  async function getJSON(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
    return res.json();
  }
  function topicName(code) { return (state.test && state.test.topics && state.test.topics[code]) || code; }

  function openModal(html) {
    modal.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    modal.hidden = false;
    const first = modal.querySelector('button');
    if (first) first.focus();
  }
  function closeModal() { modal.hidden = true; modal.innerHTML = ''; }
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // ---------- home ----------
  async function renderHome() {
    stopTimer();
    state.test = null;
    window.scrollTo(0, 0);
    app.innerHTML = `<h1>Selective Prep</h1><p class="muted">Loading tests…</p>`;
    try {
      const idx = await getJSON('tests/index.json');
      // index.json: { sections: [{ id, label, rules: [...], tests: [...] }] }  (older files: { tests: [...] })
      state.sections = idx.sections || [{ id: 'maths', label: 'Maths', tests: idx.tests || [] }];
      state.tests = state.sections.flatMap((s) => s.tests);
      try {
        const si = Number(localStorage.getItem('selective-prep:section'));
        if (si >= 0 && si < state.sections.length) state.sectionIdx = si;
        const pk = JSON.parse(localStorage.getItem('selective-prep:picks') || '{}');
        state.picks = pk && typeof pk === 'object' ? pk : {};
      } catch (e) { /* ignore */ }
    } catch (e) {
      app.innerHTML = `<h1>Selective Prep</h1><div class="card"><p>Couldn't load the test list. Check your connection and try again.</p><button class="btn primary" id="retry">Try again</button></div>`;
      document.getElementById('retry').onclick = renderHome;
      return;
    }
    const persist = () => {
      try {
        localStorage.setItem('selective-prep:section', String(state.sectionIdx));
        localStorage.setItem('selective-prep:picks', JSON.stringify(state.picks));
      } catch (e) { /* ignore */ }
    };
    const saved = store.load();
    const savedMeta = saved && state.tests.find((t) => t.file === saved.file && (t.prompt || null) === (saved.prompt || null));
    const savedSection = savedMeta && state.sections.find((sec) => sec.tests.includes(savedMeta));
    const resume = savedMeta ? `
      <div class="card">
        <h2 style="margin-top:0">Test in progress</h2>
        <p>${esc(savedSection ? savedSection.label + ' ' : '')}${esc(savedMeta.label || savedMeta.title)}: ${saved.prompt ? (saved.text || '').trim().split(/\s+/).filter(Boolean).length + ' words written' : Object.keys(saved.answers || {}).length + ' answered'}, ${saved.endAt > Date.now() ? fmtClock(saved.endAt - Date.now()) + ' left' : 'time is up'}.</p>
        <div class="row wrap">
          <button class="btn primary" id="resume">Continue</button>
          <button class="btn danger" id="discard">Discard</button>
        </div>
      </div>` : '';

    app.innerHTML = `
      <h1>Selective Prep</h1>
      <p class="muted">Practice for the NSW Selective High School Placement Test.</p>
      ${resume}
      <div class="seg section-seg" role="radiogroup" aria-label="Choose a section">
        ${state.sections.map((sec, i) => `<button class="seg-btn" role="radio" data-section="${i}" aria-checked="${i === state.sectionIdx}">${esc(sec.label)}</button>`).join('')}
      </div>
      <div class="card" id="rules"></div>
      <h2>Choose a test</h2>
      <div class="card">
        <div class="seg" role="radiogroup" aria-label="Choose a test" id="test-seg"></div>
        <div id="pick-info"></div>
        <button class="btn primary block" id="start">Start</button>
      </div>
      <p class="offline-note">Works offline once opened. Add it to your home screen to use it like an app.</p>`;

    const current = () => {
      const sec = state.sections[state.sectionIdx];
      const i = Math.min(state.picks[sec.id] || 0, sec.tests.length - 1);
      return { sec, i, t: sec.tests[i] };
    };
    const showSection = () => {
      const { sec, i, t } = current();
      app.querySelectorAll('[data-section]').forEach((x) => x.setAttribute('aria-checked', String(Number(x.dataset.section) === state.sectionIdx)));
      const rules = sec.rules || ['35 questions in 40 minutes, like the real test.', 'No calculator. Have paper and a pencil ready.'];
      document.getElementById('rules').innerHTML = `<h2 style="margin-top:0">How it works</h2><ul class="rules">
        ${rules.map((r) => `<li>${esc(r)}</li>`).join('')}
        ${sec.id === 'writing' ? '' : `<li>There's no penalty for wrong answers, so answer every question.</li>
        <li>Use <b>Flag</b> to mark questions you want to come back to.</li>
        <li>At the end you'll see your score, your strong and weak areas, and an explanation for every question.</li>`}</ul>`;
      document.getElementById('test-seg').innerHTML = sec.tests.map((tt, k) =>
        `<button class="seg-btn" role="radio" data-pick="${k}" aria-checked="${k === i}">${esc(tt.label || 'Test ' + (k + 1))}</button>`).join('');
      document.getElementById('pick-info').innerHTML = t ? `<h3 style="margin:14px 0 2px">${esc(t.title)}</h3><p class="muted small" style="margin-top:0">${t.prompt ? esc(t.form || 'Writing') + ' · 1 task' : esc(t.questions) + ' ' + (t.answers ? 'answers' : 'questions')} · ${esc(t.minutes)} minutes${t.note ? ' · ' + esc(t.note) : ''}</p>` : '<p class="muted">No tests yet.</p>';
      const start = document.getElementById('start');
      start.textContent = t ? (t.prompt ? `Start writing: ${t.label}` : `Start ${sec.label} ${t.label || 'test'}`) : 'Start';
      start.disabled = !t;
      app.querySelectorAll('[data-pick]').forEach((b) => {
        b.onclick = () => { state.picks[sec.id] = Number(b.dataset.pick); persist(); showSection(); };
      });
    };
    app.querySelectorAll('[data-section]').forEach((b) => {
      b.onclick = () => { state.sectionIdx = Number(b.dataset.section); persist(); showSection(); };
    });
    showSection();
    document.getElementById('start').onclick = () => {
      const { t } = current();
      if (!t) return;
      if (store.load()) {
        openModal(`<h2 style="margin-top:0">Start a new test?</h2><p>This will discard the test in progress.</p>
          <div class="row"><button class="btn" id="m-cancel">Cancel</button><button class="btn primary" id="m-ok">Start</button></div>`);
        document.getElementById('m-cancel').onclick = closeModal;
        document.getElementById('m-ok').onclick = () => { closeModal(); store.clear(); startTest(t.file, null, t.prompt); };
      } else {
        startTest(t.file, null, t.prompt);
      }
    };
    if (savedMeta) {
      document.getElementById('resume').onclick = () => startTest(saved.file, saved, saved.prompt);
      document.getElementById('discard').onclick = () => { store.clear(); renderHome(); };
    }
  }

  // ---------- test ----------
  async function startTest(file, saved, promptId) {
    app.innerHTML = `<p class="muted">Loading…</p>`;
    let test;
    try { test = await getJSON('tests/' + file); } catch (e) {
      app.innerHTML = `<div class="card"><p>Couldn't load this test.</p><button class="btn" id="home">Back</button></div>`;
      document.getElementById('home').onclick = renderHome;
      return;
    }
    state.test = test;
    state.file = file;
    state.submittedAt = 0;
    state.writing = null;
    if (test.kind === 'writing') {
      const prompt = test.prompts.find((p) => p.id === promptId) || test.prompts[0];
      state.writing = { prompt, text: (saved && saved.text) || '', plan: (saved && saved.plan) || '' };
      state.answers = {}; state.flags = {}; state.current = 0;
      state.startedAt = saved ? saved.startedAt : Date.now();
      state.endAt = saved ? saved.endAt : state.startedAt + (test.timeLimitMinutes || 30) * 60 * 1000;
      store.save();
      if (Date.now() >= state.endAt) { finishWriting(true); return; }
      renderWriting();
      startTimer();
      return;
    }
    state.timeUp = false;
    state.filter = 'wrong';
    if (saved) {
      state.answers = saved.answers || {};
      state.flags = saved.flags || {};
      state.current = Math.min(saved.current || 0, test.questions.length - 1);
      state.startedAt = saved.startedAt;
      state.endAt = saved.endAt;
    } else {
      state.answers = {};
      state.flags = {};
      state.current = 0;
      state.startedAt = Date.now();
      state.endAt = state.startedAt + (test.timeLimitMinutes || 40) * 60 * 1000;
    }
    store.save();
    if (Date.now() >= state.endAt) { submit(true); return; }
    renderQuestion();
    startTimer();
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(tick, 1000);
    tick();
  }
  function stopTimer() { if (state.timerId) clearInterval(state.timerId); state.timerId = null; }
  function tick() {
    const left = state.endAt - Date.now();
    const el = document.getElementById('timer');
    if (el) {
      el.textContent = fmtClock(left);
      el.classList.toggle('low', left <= 5 * 60 * 1000);
    }
    if (left <= 0) { if (state.writing) finishWriting(true); else submit(true); }
  }


  // ---------- reading passages ----------
  function passageById(id) { return (state.test.passages || []).find((p) => p.id === id); }
  function gapQuestions(p) { return state.test.questions.filter((x) => x.passage === p.id && x.gap != null); }
  function renderPassageBody(p, current, answers, reveal) {
    const gq = gapQuestions(p);
    const gapHTML = (num, kind) => {
      const qq = gq.find((x) => x.gap === num);
      const a = qq && answers[qq.n];
      const isCur = current && current.gap === num && current.passage === p.id;
      let label;
      if (kind === 'cloze') label = a ? esc(qq.options[a]) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
      else label = a ? a : '&nbsp;&nbsp;';
      const cls = ['gap', isCur ? 'current' : '', reveal && qq ? (a === qq.answer ? 'ok' : 'bad') : ''].join(' ');
      const fix = reveal && qq && a !== qq.answer ? ` <span class="gap-fix">${kind === 'cloze' ? esc(qq.options[qq.answer]) : qq.answer}</span>` : '';
      return `<span class="${cls}" data-gapq="${qq ? qq.n : ''}"><span class="gap-num">${num}</span> ${label}</span>${fix}`;
    };
    if (p.kind === 'prose') {
      return p.paragraphs.map((t, i) => `<p>${p.numbered ? `<span class="pnum">${i + 1}</span>` : ''}${esc(t)}</p>`).join('');
    }
    if (p.kind === 'poem') {
      let n = 0;
      return `<div class="poem">${p.stanzas.map((st) => `<div class="stanza">${st.map((l) => { n++; return `<div class="pline"><span class="lnum">${n % 5 === 0 || n === 1 ? n : ''}</span><span>${esc(l)}</span></div>`; }).join('')}</div>`).join('')}</div>`;
    }
    if (p.kind === 'cloze') {
      return esc(p.text).split('\n\n').map((para) => `<p>${para.replace(/\{(\d+)\}/g, (_, d) => gapHTML(Number(d), 'cloze'))}</p>`).join('');
    }
    if (p.kind === 'gapped') {
      const used = {};
      gq.forEach((x) => { if (answers[x.n]) (used[answers[x.n]] = used[answers[x.n]] || []).push(x.gap); });
      const body = p.paragraphs.map((t) => `<p>${esc(t).replace(/\[\[(\d+)\]\]/g, (_, d) => gapHTML(Number(d), 'gapped'))}</p>`).join('');
      const bankHTML = Object.entries(p.bank).map(([k, v]) => `<li><b>${k}</b> ${esc(v)}${used[k] ? ` <span class="used">in gap ${used[k].join(', ')}</span>` : ''}</li>`).join('');
      return `${body}<h4 class="bank-title">Sentences</h4><ul class="bank">${bankHTML}</ul>`;
    }
    if (p.kind === 'extracts') {
      const tab = p.extracts[state.passageUI.tab] ? state.passageUI.tab : 'A';
      const tabs = Object.keys(p.extracts).map((k) => `<button class="tab" data-tab="${k}" aria-pressed="${k === tab}">${k}</button>`).join('');
      const e = p.extracts[tab];
      return `<div class="tabs" role="group" aria-label="Extracts">${tabs}</div><h4 class="ext-title">Extract ${tab}: ${esc(e.title)}</h4><p>${esc(e.text)}</p>`;
    }
    return '';
  }
  function passagePanel(p, q) {
    if (state.passageUI.id !== p.id) state.passageUI = { id: p.id, open: true, scroll: 0, tab: 'A' };
    return `<div class="card passage">
      <button class="passage-head" id="passage-toggle" aria-expanded="${state.passageUI.open}">
        <span><b>${esc(p.title)}</b></span><span class="muted small">${state.passageUI.open ? 'Hide text' : 'Show text'}</span>
      </button>
      ${state.passageUI.open ? `<p class="muted small passage-intro">${esc(p.intro || '')}</p><div class="passage-body" id="passage-body">${renderPassageBody(p, q, state.answers, false)}</div>${p.credit ? `<p class="credit">${esc(p.credit)}</p>` : ''}` : ''}
    </div>`;
  }
  function wirePassage(p) {
    const body = document.getElementById('passage-body');
    if (body) {
      body.scrollTop = state.passageUI.scroll;
      body.addEventListener('scroll', () => { state.passageUI.scroll = body.scrollTop; }, { passive: true });
      body.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { state.passageUI.tab = b.dataset.tab; state.passageUI.scroll = 0; renderQuestion(); }; });
      body.querySelectorAll('[data-gapq]').forEach((g) => {
        const n = Number(g.dataset.gapq);
        if (n) g.onclick = () => go(state.test.questions.findIndex((x) => x.n === n), true);
      });
      const cur = body.querySelector('.gap.current');
      if (cur && state.passageUI.autoscroll) { cur.scrollIntoView({ block: 'center' }); state.passageUI.scroll = body.scrollTop; }
      state.passageUI.autoscroll = false;
    }
    document.getElementById('passage-toggle').onclick = () => { state.passageUI.open = !state.passageUI.open; renderQuestion(); };
  }

  function renderQuestion() {
    const qs = state.test.questions;
    const q = qs[state.current];
    const answered = Object.keys(state.answers).length;
    const chosen = state.answers[q.n];
    const isLast = state.current === qs.length - 1;
    const p = q.passage ? passageById(q.passage) : null;
    const inline = !!q.inlineOptions || !!(p && p.kind === 'extracts');
    const usedIn = {};
    if (p && p.kind === 'gapped') gapQuestions(p).forEach((x) => { if (x.n !== q.n && state.answers[x.n]) usedIn[state.answers[x.n]] = x.gap; });

    app.innerHTML = `
      <div class="topbar">
        <div class="row between">
          <span class="qnum">Q${q.n} <span class="muted">/ ${qs.length}</span></span>
          <span class="timer" id="timer" aria-label="Time left">${fmtClock(state.endAt - Date.now())}</span>
          <button class="btn" id="open-nav" style="min-height:40px;padding:0 14px">Questions</button>
        </div>
        <div class="progress" aria-hidden="true"><span style="width:${(answered / qs.length) * 100}%"></span></div>
      </div>
      ${p ? passagePanel(p, q) : ''}
      <div class="card">
        <div class="stem">${esc(q.stem)}</div>
        ${q.svg ? `<div class="figure">${q.svg}</div>` : ''}
        <div class="opts ${inline ? 'opts-inline' : ''}" role="group" aria-label="Answer options">
          ${Object.keys(q.options).map((L) => `
            <button class="opt" data-opt="${L}" aria-pressed="${chosen === L}">
              <span class="letter">${L}</span><span>${inline ? '' : esc(q.options[L])}${usedIn[L] ? ` <span class="used">used in gap ${usedIn[L]}</span>` : ''}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="row between">
        <button class="btn flag-btn" id="flag" aria-pressed="${!!state.flags[q.n]}">${state.flags[q.n] ? 'Flagged' : 'Flag for review'}</button>
        ${chosen ? `<button class="btn" id="clear">Clear answer</button>` : ''}
      </div>
      <div class="bottombar"><div class="inner">
        <button class="btn" id="prev" ${state.current === 0 ? 'disabled' : ''}>Back</button>
        ${isLast ? `<button class="btn primary" id="finish">Finish</button>` : `<button class="btn primary" id="next">Next</button>`}
      </div></div>`;

    app.querySelectorAll('[data-opt]').forEach((b) => { b.onclick = () => choose(b.dataset.opt); });
    document.getElementById('flag').onclick = toggleFlag;
    const clear = document.getElementById('clear');
    if (clear) clear.onclick = () => { delete state.answers[q.n]; store.save(); renderQuestion(); };
    document.getElementById('prev').onclick = () => go(state.current - 1);
    const next = document.getElementById('next');
    if (next) next.onclick = () => go(state.current + 1);
    const finish = document.getElementById('finish');
    if (finish) finish.onclick = confirmFinish;
    document.getElementById('open-nav').onclick = openNavigator;
    if (p) wirePassage(p);
    tick();
  }

  function choose(L) {
    const q = state.test.questions[state.current];
    state.answers[q.n] = L;
    store.save();
    renderQuestion();
  }
  function toggleFlag() {
    const q = state.test.questions[state.current];
    if (state.flags[q.n]) delete state.flags[q.n]; else state.flags[q.n] = true;
    store.save();
    renderQuestion();
  }
  function go(i, fromPassage) {
    const n = state.test.questions.length;
    if (i < 0 || i >= n) return;
    const prev = state.test.questions[state.current];
    state.current = i;
    const q = state.test.questions[i];
    if (q.gap != null && !fromPassage) state.passageUI.autoscroll = true;
    store.save();
    renderQuestion();
    if (!(prev && q.passage && prev.passage === q.passage)) window.scrollTo(0, 0);
  }

  function openNavigator() {
    const qs = state.test.questions;
    const answered = Object.keys(state.answers).length;
    openModal(`
      <div class="row between"><h2 style="margin:0">All questions</h2><button class="btn" id="m-close" style="min-height:40px">Close</button></div>
      <p class="muted small">${answered} of ${qs.length} answered · ${Object.keys(state.flags).length} flagged</p>
      <div class="nav-grid">
        ${qs.map((q, i) => `<button class="nav-dot ${state.answers[q.n] ? 'answered' : ''} ${state.flags[q.n] ? 'flagged' : ''} ${i === state.current ? 'current' : ''}" data-go="${i}" aria-label="Question ${q.n}${state.answers[q.n] ? ', answered' : ''}${state.flags[q.n] ? ', flagged' : ''}">${q.n}</button>`).join('')}
      </div>
      <div class="legend"><span><i class="a"></i>Answered</span><span><i></i>Not answered</span><span><i class="f"></i>Flagged</span></div>
      <div class="row wrap" style="margin-top:16px">
        <button class="btn primary" id="m-finish">Finish test</button>
        <button class="btn danger" id="m-quit">Quit</button>
      </div>`);
    document.getElementById('m-close').onclick = closeModal;
    modal.querySelectorAll('[data-go]').forEach((b) => { b.onclick = () => { closeModal(); go(Number(b.dataset.go)); }; });
    document.getElementById('m-finish').onclick = () => { closeModal(); confirmFinish(); };
    document.getElementById('m-quit').onclick = () => {
      openModal(`<h2 style="margin-top:0">Quit this test?</h2><p>Your answers will be lost.</p>
        <div class="row"><button class="btn" id="m-cancel">Keep going</button><button class="btn danger" id="m-ok">Quit</button></div>`);
      document.getElementById('m-cancel').onclick = closeModal;
      document.getElementById('m-ok').onclick = () => { closeModal(); store.clear(); renderHome(); };
    };
  }

  function confirmFinish() {
    const qs = state.test.questions;
    const blank = qs.filter((q) => !state.answers[q.n]).map((q) => q.n);
    const flagged = qs.filter((q) => state.flags[q.n]).map((q) => q.n);
    openModal(`
      <h2 style="margin-top:0">Finish the test?</h2>
      <p>You have ${fmtClock(state.endAt - Date.now())} left.</p>
      ${blank.length ? `<p><b>${blank.length} not answered:</b> ${blank.join(', ')}. There's no penalty for guessing.</p>` : '<p>All questions answered.</p>'}
      ${flagged.length ? `<p><b>Flagged:</b> ${flagged.join(', ')}</p>` : ''}
      <div class="row"><button class="btn" id="m-cancel">Go back</button><button class="btn primary" id="m-ok">Submit</button></div>`);
    document.getElementById('m-cancel').onclick = closeModal;
    document.getElementById('m-ok').onclick = () => { closeModal(); submit(false); };
  }

  function submit(timeUp) {
    if (state.submittedAt) return;
    stopTimer();
    state.submittedAt = Math.min(Date.now(), state.endAt);
    state.timeUp = timeUp;
    store.clear(); // attempts are not kept
    renderResults();
    if (timeUp) {
      openModal(`<h2 style="margin-top:0">Time's up</h2><p>Your answers have been submitted.</p><button class="btn primary" id="m-ok">See results</button>`);
      document.getElementById('m-ok').onclick = closeModal;
    }
  }


  // ---------- writing ----------
  const wordCount = (t) => (t || '').trim().split(/\s+/).filter(Boolean).length;
  function promptHTML(p) {
    return `<span class="form-badge">${esc(p.form)}</span>
      <h2 class="prompt-title">${esc(p.title)}</h2>
      ${p.context ? `<p>${esc(p.context)}</p>` : ''}
      <p><b>${esc(p.task)}</b></p>
      ${p.start ? `<p class="start-line">${esc(p.start)}</p>` : ''}
      ${p.could && p.could.length ? `<p class="muted small" style="margin-bottom:2px">In your writing you could:</p><ul class="could">${p.could.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}`;
  }
  function renderWriting() {
    const w = state.writing;
    window.scrollTo(0, 0);
    app.innerHTML = `
      <div class="topbar">
        <div class="row between">
          <span class="qnum">Writing</span>
          <span class="timer" id="timer" aria-label="Time left">${fmtClock(state.endAt - Date.now())}</span>
          <button class="btn" id="w-quit" style="min-height:40px;padding:0 14px">Quit</button>
        </div>
      </div>
      <details class="card prompt-card" open><summary class="muted small">Task (tap to hide)</summary>${promptHTML(w.prompt)}</details>
      <details class="card plan-card" ${w.plan ? 'open' : ''}><summary><b>Plan</b> <span class="muted small">(optional, not marked)</span></summary>
        <textarea id="w-plan" class="plan-box" rows="5" spellcheck="false" placeholder="Quick notes: who is the audience? your title, 3–4 main points or story events, a strong ending">${esc(w.plan)}</textarea>
      </details>
      <div class="card editor-card">
        <textarea id="w-text" class="editor" spellcheck="false" autocorrect="off" autocomplete="off" autocapitalize="sentences"
          placeholder="Start with a title on the first line, then write your response.">${esc(w.text)}</textarea>
        <div class="row between small muted" style="margin-top:6px"><span id="w-count">${wordCount(w.text)} words</span><span>Spell-check is off, like the real test</span></div>
      </div>
      <div class="bottombar"><div class="inner">
        <button class="btn primary" id="w-finish">Finish writing</button>
      </div></div>`;
    const text = document.getElementById('w-text');
    const plan = document.getElementById('w-plan');
    const count = document.getElementById('w-count');
    text.addEventListener('input', () => { w.text = text.value; count.textContent = `${wordCount(w.text)} words`; store.save(); });
    plan.addEventListener('input', () => { w.plan = plan.value; store.save(); });
    document.getElementById('w-finish').onclick = () => finishWriting(false);
    document.getElementById('w-quit').onclick = () => {
      openModal(`<h2 style="margin-top:0">Quit writing?</h2><p>Your writing will be deleted.</p>
        <div class="row"><button class="btn" id="m-cancel">Keep writing</button><button class="btn danger" id="m-ok">Quit</button></div>`);
      document.getElementById('m-cancel').onclick = closeModal;
      document.getElementById('m-ok').onclick = () => { closeModal(); store.clear(); renderHome(); };
    };
    tick();
  }
  function finishWriting(timeUp) {
    if (state.submittedAt) return;
    const done = () => {
      stopTimer();
      state.submittedAt = Math.min(Date.now(), state.endAt);
      state.timeUp = timeUp;
      store.clear();
      renderWritingResult();
      if (timeUp) {
        openModal(`<h2 style="margin-top:0">Time's up</h2><p>Pens down! Your writing has been saved for feedback.</p><button class="btn primary" id="m-ok">OK</button>`);
        document.getElementById('m-ok').onclick = closeModal;
      }
    };
    if (timeUp) { done(); return; }
    openModal(`<h2 style="margin-top:0">Finish writing?</h2><p>You have ${fmtClock(state.endAt - Date.now())} left. Use spare time to re-read and fix spelling and punctuation.</p>
      <div class="row"><button class="btn" id="m-cancel">Keep writing</button><button class="btn primary" id="m-ok">Finish</button></div>`);
    document.getElementById('m-cancel').onclick = closeModal;
    document.getElementById('m-ok').onclick = () => { closeModal(); done(); };
  }
  function feedbackMessage() {
    const w = state.writing, p = w.prompt;
    const used = state.submittedAt - state.startedAt;
    return [
      state.test.markingGuide,
      '',
      '---',
      'THE TASK',
      `Form: ${p.form}`,
      `Title: ${p.title}`,
      p.context, p.task, p.start ? `Start with: "${p.start}"` : '',
      p.could && p.could.length ? 'In your writing you could: ' + p.could.join('; ') + '.' : '',
      '',
      '---',
      `STUDENT'S RESPONSE (${wordCount(w.text)} words, written in ${fmtDuration(used)}${state.timeUp ? ', stopped when the 30 minutes ran out' : ''})`,
      '',
      w.text.trim() || '(nothing written)',
      w.plan.trim() ? `\n---\nHER PLANNING NOTES (not marked, for context only)\n${w.plan.trim()}` : '',
    ].filter((x) => x !== '').join('\n');
  }
  function renderWritingResult() {
    const w = state.writing, p = w.prompt;
    const used = state.submittedAt - state.startedAt;
    const words = wordCount(w.text);
    const lines = w.text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const paras = Math.max(0, lines.length - (lines[0] && lines[0].split(/\s+/).length <= 8 ? 1 : 0));
    const hasTitle = lines.length > 1 && lines[0].split(/\s+/).length <= 8 && !/[.!?]$/.test(lines[0]);
    window.scrollTo(0, 0);
    app.innerHTML = `
      <h1>Writing done</h1>
      <p class="muted">${esc(p.form)}: ${esc(p.title)}</p>
      <div class="stats">
        <div class="card"><b>${words}</b><span class="muted small">words</span></div>
        <div class="card"><b>${fmtDuration(used)}</b><span class="muted small">time used${state.timeUp ? ' (time up)' : ''}</span></div>
        <div class="card"><b>${paras}</b><span class="muted small">paragraphs</span></div>
      </div>
      <h2>Quick self-check</h2>
      <div class="card">
        <ul class="checks">
          <li class="${hasTitle ? 'ok' : 'warn'}">${hasTitle ? 'Has a title' : 'No title found: markers reward a title that sums up the piece'}</li>
          <li class="${paras >= 4 ? 'ok' : 'warn'}">${paras >= 4 ? `${paras} paragraphs` : `Only ${paras} paragraph${paras === 1 ? '' : 's'}: aim for at least 4 (press Enter between paragraphs)`}</li>
          <li class="${words >= 250 ? 'ok' : 'warn'}">${words >= 250 ? `${words} words: a good length for 30 minutes` : `${words} words: aim for about 300–400 in 30 minutes`}</li>
          <li class="info">Did it stay on the task and use the form asked for (${esc(p.form.toLowerCase())})? Writing that misses the task is marked lower.</li>
        </ul>
      </div>
      <h2>Get feedback from Claude</h2>
      <div class="card">
        <ol class="steps">
          <li>Tap <b>Copy for feedback</b>. It copies the marking guide, the task and the writing in one message.</li>
          <li>Open Claude (in your <i>Selective Writing</i> project if you set one up) and paste it into a new chat.</li>
          <li>Claude replies with an estimated mark out of 25 (as one examiner would give), strengths, the three most important fixes and a rewritten paragraph.</li>
        </ol>
        <div class="row wrap">
          <button class="btn primary" id="w-copy">Copy for feedback</button>
          <button class="btn" id="w-share">Share…</button>
          <button class="btn" id="w-download">Save as file</button>
        </div>
        <p class="muted small" style="margin-bottom:0"><a href="https://claude.ai/new" target="_blank" rel="noopener">Open Claude in a new tab</a></p>
      </div>
      <h2>Her writing</h2>
      <div class="card"><div class="essay">${esc(w.text) || '<span class="muted">Nothing written.</span>'}</div></div>
      <div class="row wrap" style="margin-top:20px"><button class="btn" id="home">Back to tests</button></div>
      <p class="muted small">This writing isn't saved anywhere else. Copy or save it before leaving this screen.</p>`;
    document.getElementById('w-copy').onclick = async () => {
      const msg = feedbackMessage();
      try {
        await navigator.clipboard.writeText(msg);
        openModal(`<h2 style="margin-top:0">Copied</h2><p>Now open Claude, paste it into a new chat, and send.</p><div class="row"><a class="btn primary" href="https://claude.ai/new" target="_blank" rel="noopener" id="m-open">Open Claude</a><button class="btn" id="m-ok">Close</button></div>`);
      } catch (e) {
        openModal(`<h2 style="margin-top:0">Copy this</h2><p class="small muted">Select all the text below and copy it.</p><textarea style="width:100%;height:240px" readonly>${esc(msg)}</textarea><button class="btn primary" id="m-ok" style="margin-top:10px">Close</button>`);
      }
      document.getElementById('m-ok').onclick = closeModal;
    };
    document.getElementById('w-share').onclick = async () => {
      const msg = feedbackMessage();
      try { if (navigator.share) { await navigator.share({ title: 'Selective writing for feedback', text: msg }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      document.getElementById('w-copy').click();
    };
    document.getElementById('w-download').onclick = () => {
      const blob = new Blob([feedbackMessage()], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `writing-${p.id}-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    document.getElementById('home').onclick = () => {
      openModal(`<h2 style="margin-top:0">Leave this screen?</h2><p>The writing isn't saved. Make sure you've copied or saved it.</p>
        <div class="row"><button class="btn" id="m-cancel">Stay</button><button class="btn primary" id="m-ok">Leave</button></div>`);
      document.getElementById('m-cancel').onclick = closeModal;
      document.getElementById('m-ok').onclick = () => { closeModal(); renderHome(); };
    };
  }

  // ---------- results ----------
  function grade() {
    const qs = state.test.questions;
    const rows = qs.map((q) => {
      const a = state.answers[q.n];
      return { q, a, status: !a ? 'blank' : a === q.answer ? 'right' : 'wrong' };
    });
    const byTopic = {};
    rows.forEach((r) => {
      const t = (byTopic[r.q.topic] = byTopic[r.q.topic] || { code: r.q.topic, right: 0, total: 0 });
      t.total++; if (r.status === 'right') t.right++;
    });
    const band = (d) => (d <= 2 ? 'Easier (1–2)' : d === 3 ? 'Medium (3)' : 'Harder (4–5)');
    const byBand = {};
    rows.forEach((r) => {
      const k = band(r.q.difficulty || 3);
      const b = (byBand[k] = byBand[k] || { name: k, right: 0, total: 0 });
      b.total++; if (r.status === 'right') b.right++;
    });
    return {
      rows,
      right: rows.filter((r) => r.status === 'right').length,
      wrong: rows.filter((r) => r.status === 'wrong').length,
      blank: rows.filter((r) => r.status === 'blank').length,
      topics: Object.values(byTopic).sort((x, y) => x.right / x.total - y.right / y.total || y.total - x.total),
      bands: ['Easier (1–2)', 'Medium (3)', 'Harder (4–5)'].map((k) => byBand[k]).filter(Boolean),
      skills: (() => {
        const m = {};
        rows.forEach((r) => { if (!r.q.skillGroup) return; const k = (m[r.q.skillGroup] = m[r.q.skillGroup] || { name: r.q.skillGroup, right: 0, total: 0 }); k.total++; if (r.status === 'right') k.right++; });
        return Object.values(m).sort((x, y) => x.right / x.total - y.right / y.total);
      })(),
    };
  }

  function barColor(p) { return p >= 0.8 ? 'var(--good)' : p >= 0.5 ? 'var(--flag)' : 'var(--bad)'; }

  function renderResults() {
    window.scrollTo(0, 0);
    const g = grade();
    const total = g.rows.length;
    const pct = Math.round((g.right / total) * 100);
    const used = state.submittedAt - state.startedAt;
    const msg = pct >= 85 ? 'Excellent work!' : pct >= 70 ? 'Strong result. Look at the topics in red and orange.' : pct >= 50 ? 'Good effort. The review below shows exactly where marks were lost.' : 'Keep going. Work through the explanations below, one topic at a time.';
    const flaggedCount = g.rows.filter((r) => state.flags[r.q.n]).length;

    app.innerHTML = `
      <h1>Results</h1>
      <p class="muted">${esc(state.test.title)}</p>
      <div class="card">
        <div class="row between wrap">
          <div><div class="score">${g.right}/${total}</div><div class="muted">${pct}% correct</div></div>
          <p style="max-width:330px">${msg}</p>
        </div>
      </div>
      <div class="stats">
        <div class="card"><b>${fmtDuration(used)}</b><span class="muted small">time used${state.timeUp ? ' (time up)' : ''}</span></div>
        <div class="card"><b>${g.wrong}</b><span class="muted small">wrong</span></div>
        <div class="card"><b>${g.blank}</b><span class="muted small">not answered</span></div>
      </div>

      <h2>${esc(state.test.groupLabel || 'By topic')} <span class="muted small">(weakest first)</span></h2>
      <div class="card">
        ${g.topics.map((t) => {
          const p = t.right / t.total;
          return `<div class="topic-row"><span>${esc(topicName(t.code))}</span>
            <span class="bar" aria-hidden="true"><span style="width:${p * 100}%;background:${barColor(p)}"></span></span>
            <span class="pct">${t.right}/${t.total}</span></div>`;
        }).join('')}
      </div>

      ${g.skills.length ? `<h2>By skill <span class="muted small">(weakest first)</span></h2>
      <div class="card">${g.skills.map((b) => { const p = b.right / b.total; return `<div class="topic-row"><span>${esc(b.name)}</span>
            <span class="bar" aria-hidden="true"><span style="width:${p * 100}%;background:${barColor(p)}"></span></span>
            <span class="pct">${b.right}/${b.total}</span></div>`; }).join('')}</div>` : ''}

      <h2>By difficulty</h2>
      <div class="card">
        ${g.bands.map((b) => {
          const p = b.right / b.total;
          return `<div class="topic-row"><span>${b.name}</span>
            <span class="bar" aria-hidden="true"><span style="width:${p * 100}%;background:${barColor(p)}"></span></span>
            <span class="pct">${b.right}/${b.total}</span></div>`;
        }).join('')}
      </div>

      <h2>Review answers</h2>
      <div class="filter" role="group" aria-label="Filter questions">
        ${[['wrong', `Wrong (${g.wrong})`], ['blank', `Not answered (${g.blank})`], ['flagged', `Flagged (${flaggedCount})`], ['all', `All (${total})`]]
          .map(([k, label]) => `<button class="chip" data-filter="${k}" aria-pressed="${state.filter === k}">${label}</button>`).join('')}
      </div>
      <div id="review-list"></div>

      <div class="row wrap" style="margin-top:20px">
        <button class="btn" id="share">Share summary</button>
        <button class="btn primary" id="home">Back to tests</button>
      </div>
      <p class="muted small">Results aren't saved. Going back to the tests clears them.</p>`;

    app.querySelectorAll('[data-filter]').forEach((b) => {
      b.onclick = () => {
        state.filter = b.dataset.filter;
        app.querySelectorAll('[data-filter]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        renderReviewList(g);
      };
    });
    document.getElementById('share').onclick = () => shareSummary(g, pct, used);
    document.getElementById('home').onclick = () => {
      openModal(`<h2 style="margin-top:0">Leave results?</h2><p>Results aren't saved, so they'll be cleared.</p>
        <div class="row"><button class="btn" id="m-cancel">Stay</button><button class="btn primary" id="m-ok">Leave</button></div>`);
      document.getElementById('m-cancel').onclick = closeModal;
      document.getElementById('m-ok').onclick = () => { closeModal(); renderHome(); };
    };
    renderReviewList(g);
  }

  function renderReviewList(g) {
    const list = document.getElementById('review-list');
    const rows = g.rows.filter((r) =>
      state.filter === 'all' ? true : state.filter === 'flagged' ? !!state.flags[r.q.n] : r.status === state.filter);
    if (!rows.length) {
      list.innerHTML = `<div class="card"><p class="muted">Nothing here.</p></div>`;
      return;
    }
    list.innerHTML = rows.map(({ q, a, status }) => {
      const label = status === 'right' ? 'Correct' : status === 'wrong' ? 'Wrong' : 'Not answered';
      const mistake = status === 'wrong' && q.distractors && q.distractors[a];
      return `
        <div class="card review ${status}" data-n="${q.n}">
          <div class="row between wrap">
            <b>Question ${q.n}</b>
            <span><span class="tag ${status}">${label}</span>${state.flags[q.n] ? ' <span class="tag blank">Flagged</span>' : ''}</span>
          </div>
          <p class="muted small" style="margin-top:2px">${esc(topicName(q.topic))}${q.skill ? ' · ' + esc(q.skill) : ''}</p>
          ${q.passage ? reviewPassage(q) : ''}
          <div class="stem">${esc(q.stem)}</div>
          ${q.svg ? `<div class="figure">${q.svg}</div>` : ''}
          ${status === 'wrong' ? `<p class="ans-line yours">Your answer: <b>${a}</b> ${esc(optText(q, a))}</p>` : ''}
          <p class="ans-line correct">Correct answer: <b>${q.answer}</b> ${esc(optText(q, q.answer))}</p>
          ${mistake ? `<div class="why mistake"><b>Likely mistake:</b> ${esc(mistake)}</div>` : ''}
          <div class="why"><b>How to solve it:</b> ${esc(q.explanation)}</div>
        </div>`;
    }).join('');
  }

  function optText(q, L) {
    const p = q.passage && passageById(q.passage);
    if (p && p.kind === 'extracts') return '(' + p.extracts[L].title + ')';
    if (q.inlineOptions) return '(see the picture)';
    return q.options[L];
  }
  function reviewPassage(q) {
    const p = passageById(q.passage);
    if (!p) return '';
    return `<details class="review-passage"><summary>${esc(p.title)}: show the text</summary><div class="passage-body in-review">${renderPassageBody(p, q, state.answers, true)}</div></details>`;
  }
  document.addEventListener('click', (e) => {
    // extract tabs inside review details
    const b = e.target.closest('.in-review [data-tab]');
    if (!b) return;
    state.passageUI.tab = b.dataset.tab;
    const det = b.closest('details');
    const q = state.test.questions.find((x) => x.n === Number(det.closest('.review').dataset.n));
    det.querySelector('.passage-body').innerHTML = renderPassageBody(passageById(q.passage), q, state.answers, true);
  });

  async function shareSummary(g, pct, used) {
    const lines = [
      `${state.test.title}`,
      `Score: ${g.right}/${g.rows.length} (${pct}%) in ${fmtDuration(used)}${state.timeUp ? ' (time up)' : ''}`,
      `Not answered: ${g.blank}`,
      '',
      'By topic (weakest first):',
      ...g.topics.map((t) => `- ${topicName(t.code)}: ${t.right}/${t.total}`),
      '',
      `Wrong: ${g.rows.filter((r) => r.status === 'wrong').map((r) => `Q${r.q.n} (chose ${r.a}, answer ${r.q.answer})`).join(', ') || 'none'}`,
    ];
    const text = lines.join('\n');
    try {
      if (navigator.share) { await navigator.share({ title: 'Selective Prep results', text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    try {
      await navigator.clipboard.writeText(text);
      openModal(`<h2 style="margin-top:0">Copied</h2><p>The summary is on your clipboard. Paste it into a message or note.</p><button class="btn primary" id="m-ok">OK</button>`);
    } catch (e) {
      openModal(`<h2 style="margin-top:0">Summary</h2><textarea style="width:100%;height:220px" readonly>${esc(text)}</textarea><button class="btn primary" id="m-ok" style="margin-top:10px">Close</button>`);
    }
    document.getElementById('m-ok').onclick = closeModal;
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', (e) => {
    if (!state.test || state.writing || state.submittedAt || !modal.hidden) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toUpperCase();
    const idx = LETTERS.indexOf(k) >= 0 ? LETTERS.indexOf(k) : ['1', '2', '3', '4', '5', '6', '7'].indexOf(k);
    const q = state.test.questions[state.current];
    if (idx >= 0 && q.options[LETTERS[idx]] !== undefined) { choose(LETTERS[idx]); e.preventDefault(); }
    else if (e.key === 'ArrowRight') go(state.current + 1);
    else if (e.key === 'ArrowLeft') go(state.current - 1);
  });

  // ---------- offline ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
  }

  renderHome();
})();
