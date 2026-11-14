/* Selective Prep – a small offline-capable practice test runner.
   No build step. Tests live in tests/*.json and are listed in tests/index.json. */
(() => {
  'use strict';

  const LETTERS = ['A', 'B', 'C', 'D', 'E'];
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
      state.tests = idx.tests || [];
    } catch (e) {
      app.innerHTML = `<h1>Selective Prep</h1><div class="card"><p>Couldn't load the test list. Check your connection and try again.</p><button class="btn primary" id="retry">Try again</button></div>`;
      document.getElementById('retry').onclick = renderHome;
      return;
    }
    const saved = store.load();
    const savedMeta = saved && state.tests.find((t) => t.file === saved.file);
    const resume = savedMeta ? `
      <div class="card">
        <h2 style="margin-top:0">Test in progress</h2>
        <p>${esc(savedMeta.title)}: ${Object.keys(saved.answers || {}).length} answered, ${saved.endAt > Date.now() ? fmtClock(saved.endAt - Date.now()) + ' left' : 'time is up'}.</p>
        <div class="row wrap">
          <button class="btn primary" id="resume">Continue</button>
          <button class="btn danger" id="discard">Discard</button>
        </div>
      </div>` : '';

    app.innerHTML = `
      <h1>Selective Prep</h1>
      <p class="muted">Practice for the NSW Selective High School Placement Test.</p>
      ${resume}
      <div class="card">
        <h2 style="margin-top:0">How it works</h2>
        <ul class="rules">
          <li>35 questions in 40 minutes, like the real test.</li>
          <li>No calculator. Have paper and a pencil ready.</li>
          <li>There's no penalty for wrong answers, so answer every question.</li>
          <li>Use <b>Flag</b> to mark questions you want to come back to.</li>
          <li>At the end you'll see your score, your strong and weak topics, and an explanation for every question.</li>
        </ul>
      </div>
      <h2>Tests</h2>
      ${state.tests.map((t, i) => `
        <div class="card test-item">
          <h3>${esc(t.title)}</h3>
          <p class="muted small">${t.questions} questions · ${t.minutes} minutes</p>
          <button class="btn primary block" data-start="${i}">Start test</button>
        </div>`).join('')}
      <p class="offline-note">Works offline once opened. Add it to your home screen to use it like an app.</p>`;

    app.querySelectorAll('[data-start]').forEach((b) => {
      b.onclick = () => {
        const t = state.tests[Number(b.dataset.start)];
        if (store.load()) {
          openModal(`<h2 style="margin-top:0">Start a new test?</h2><p>This will discard the test in progress.</p>
            <div class="row"><button class="btn" id="m-cancel">Cancel</button><button class="btn primary" id="m-ok">Start</button></div>`);
          document.getElementById('m-cancel').onclick = closeModal;
          document.getElementById('m-ok').onclick = () => { closeModal(); store.clear(); startTest(t.file); };
        } else {
          startTest(t.file);
        }
      };
    });
    if (savedMeta) {
      document.getElementById('resume').onclick = () => startTest(saved.file, saved);
      document.getElementById('discard').onclick = () => { store.clear(); renderHome(); };
    }
  }

  // ---------- test ----------
  async function startTest(file, saved) {
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
    if (left <= 0) submit(true);
  }

  function renderQuestion() {
    const qs = state.test.questions;
    const q = qs[state.current];
    const answered = Object.keys(state.answers).length;
    const chosen = state.answers[q.n];
    const isLast = state.current === qs.length - 1;

    app.innerHTML = `
      <div class="topbar">
        <div class="row between">
          <span class="qnum">Q${q.n} <span class="muted">/ ${qs.length}</span></span>
          <span class="timer" id="timer" aria-label="Time left">${fmtClock(state.endAt - Date.now())}</span>
          <button class="btn" id="open-nav" style="min-height:40px;padding:0 14px">Questions</button>
        </div>
        <div class="progress" aria-hidden="true"><span style="width:${(answered / qs.length) * 100}%"></span></div>
      </div>
      <div class="card">
        <div class="stem">${esc(q.stem)}</div>
        ${q.svg ? `<div class="figure">${q.svg}</div>` : ''}
        <div class="opts" role="group" aria-label="Answer options">
          ${LETTERS.filter((L) => q.options[L] !== undefined).map((L) => `
            <button class="opt" data-opt="${L}" aria-pressed="${chosen === L}">
              <span class="letter">${L}</span><span>${esc(q.options[L])}</span>
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
  function go(i) {
    const n = state.test.questions.length;
    if (i < 0 || i >= n) return;
    state.current = i;
    store.save();
    renderQuestion();
    window.scrollTo(0, 0);
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

      <h2>By topic <span class="muted small">(weakest first)</span></h2>
      <div class="card">
        ${g.topics.map((t) => {
          const p = t.right / t.total;
          return `<div class="topic-row"><span>${esc(topicName(t.code))}</span>
            <span class="bar" aria-hidden="true"><span style="width:${p * 100}%;background:${barColor(p)}"></span></span>
            <span class="pct">${t.right}/${t.total}</span></div>`;
        }).join('')}
      </div>

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
        <div class="card review ${status}">
          <div class="row between wrap">
            <b>Question ${q.n}</b>
            <span><span class="tag ${status}">${label}</span>${state.flags[q.n] ? ' <span class="tag blank">Flagged</span>' : ''}</span>
          </div>
          <p class="muted small" style="margin-top:2px">${esc(topicName(q.topic))}${q.skill ? ' · ' + esc(q.skill) : ''}</p>
          <div class="stem">${esc(q.stem)}</div>
          ${q.svg ? `<div class="figure">${q.svg}</div>` : ''}
          ${status === 'wrong' ? `<p class="ans-line yours">Your answer: <b>${a}</b> ${esc(q.options[a])}</p>` : ''}
          <p class="ans-line correct">Correct answer: <b>${q.answer}</b> ${esc(q.options[q.answer])}</p>
          ${mistake ? `<div class="why mistake"><b>Likely mistake:</b> ${esc(mistake)}</div>` : ''}
          <div class="why"><b>How to solve it:</b> ${esc(q.explanation)}</div>
        </div>`;
    }).join('');
  }

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
    if (!state.test || state.submittedAt || !modal.hidden) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toUpperCase();
    const idx = LETTERS.indexOf(k) >= 0 ? LETTERS.indexOf(k) : ['1', '2', '3', '4', '5'].indexOf(k);
    if (idx >= 0) { choose(LETTERS[idx]); e.preventDefault(); }
    else if (e.key === 'ArrowRight') go(state.current + 1);
    else if (e.key === 'ArrowLeft') go(state.current - 1);
  });

  // ---------- offline ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
  }

  renderHome();
})();
