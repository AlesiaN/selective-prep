# Selective Prep

An offline-capable practice test app (PWA) for the NSW Selective High School Placement Test.
Plain HTML/CSS/JS. There's no build step and nothing to install.

## Deploy to GitHub Pages

1. Create a new repository on GitHub, e.g. `selective-prep`. It can be private if your plan supports Pages for private repos; otherwise make it public.
2. Upload the contents of this folder to the repository root (drag and drop in the GitHub web UI works), or:
   ```bash
   git init && git add . && git commit -m "Selective Prep PWA"
   git branch -M main
   git remote add origin https://github.com/<your-user>/selective-prep.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, then pick `main` and `/ (root)`, and save.
4. After a minute the app is live at `https://<your-user>.github.io/selective-prep/`.
5. On the phone or tablet, open that link:
   - **iPhone/iPad (Safari):** Share → Add to Home Screen
   - **Android (Chrome):** menu → Install app / Add to Home screen

All paths are relative, so the app works in any repo name or subfolder.

## Add a new test

1. Put the new file in `tests/`, e.g. `tests/selective-maths-test-03.json` or `tests/selective-reading-test-02.json`.
2. Add an entry to the right section's `tests` list in `tests/index.json`:
   ```json
   { "id": "test3", "label": "Test 3", "file": "selective-maths-test-03.json", "title": "Mathematical Reasoning – Practice Test 3", "note": "Short description shown under the chooser", "questions": 35, "minutes": 40 }
   ```
   (For reading tests, add `"answers": true` so the chooser says "38 answers".)
3. Commit and push. It appears in the Maths / Reading → Test 1 / Test 2 / … chooser the next time the app is opened online.

## Update the app itself

If you change `app.js`, `styles.css` or `index.html`, bump `VERSION` in `sw.js` (e.g. `v1` → `v2`) so installed copies pick up the change.

## Test file format

```json
{
  "id": "shs-mr-01",
  "title": "…",
  "timeLimitMinutes": 40,
  "topics": { "FRA": "Fractions, sharing and proportion", "...": "..." },
  "questions": [
    {
      "n": 1,
      "topic": "TIM",
      "difficulty": 1,
      "skill": "24-hour time → 12-hour time",
      "stem": "Question text (\\n for new lines)",
      "svg": "<svg …>optional diagram, use stroke/fill='currentColor'</svg>",
      "options": { "A": "…", "B": "…", "C": "…", "D": "…", "E": "…" },
      "answer": "D",
      "explanation": "How to solve it",
      "distractors": { "B": "the mistake that leads to B", "...": "..." }
    }
  ]
}
```

## Reading test format

Reading tests add a `passages` list, and each question points to its passage with `"passage": "p1"`. Passage kinds:
- `prose`: `paragraphs` (numbered if `numbered: true`)
- `poem`: `stanzas` (arrays of lines; every 5th line is numbered)
- `cloze`: `text` with gaps written `{1}` … `{8}`; each gap's question has `"gap": n`
- `gapped`: `paragraphs` with gaps written `[[1]]` … `[[6]]`, plus a `bank` of sentences A–G; each gap's question has `"gap": n`
- `extracts`: `extracts` {A–D: {title, text}}, shown as tabs

Questions may carry `skillGroup`, and the results then add a "By skill" breakdown. `groupLabel` renames the "By topic" heading (e.g. "By part").

## Behaviour

- 40-minute countdown based on the clock time, so it keeps running if the screen locks. It submits automatically at 0:00.
- Progress on the current test is saved on the device until it's submitted, so an accidental reload loses nothing. Results are **not** stored: leaving the results screen clears them.
- The results screen shows the score, time used, topics weakest first, a difficulty breakdown, and a review of each question with the likely mistake behind a wrong answer. **Share summary** copies or shares a text summary for a parent.
- Keyboard shortcuts on desktop: A–E or 1–5 to answer, ← → to move between questions.
