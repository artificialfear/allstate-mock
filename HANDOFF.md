# HANDOFF — All-State Mock Audition

Live: https://artificialfear.github.io/allstate-mock/
Owner: Mat Graham. Shared with band directors and private teachers.

## What it is
A single-page tool for running mock GMEA All-State Band auditions. The teacher picks grade band → instrument → round (First Round/District or Final Round/State), fills out an interactive copy of the real judge sheet, then prints it, shares a read-only link, or tracks the student over time.

## Files
- `src/data.js` — every form as data: levels, instruments, MS octave map, factors, cut lines, form builders (`buildForm(level, round, inst, variant)`), and printed-form anomaly notices.
- `src/hs_district.js` — HS (9–10, 11–12) district wind scale tables (labels, per-scale max, factor, cut). **Generated from the GMEA PDF text** (see "Updating for a new year").
- `src/feedback.js` — category → student-facing name, practice tips, quick-tap judge comments, calibration guide.
- `src/app.js` — UI, scoring, results analysis, share links, print, history, timer, and metronome.
- `src/styles.css`, `src/index.template.html` — template with `<!--INLINE:path-->` markers.
- `vendor/qrcode.js` — qrcode-generator 1.4.4 (MIT), bundled locally (no CDN).
- `build.py` — inlines everything into **`index.html` (the deployed file, committed)**.
- `tests/smoke.py` — Playwright suite: all 96 form combos (max totals, perfect run through the UI), exact hand-scored arithmetic, results, share round-trip, print, self-assess compare, percussion widgets, history/chart/export/import, dark mode, and phone overflow. `python3 build.py && python3 tests/smoke.py [--shots DIR]`.

## Data sources (2025–26)
- GMEA district (first round) and state (final round) audition forms: the two PDFs Mat supplied.
- GMEA MS scale sheets 2025–26 (zip). MS octave counts were read from the notation. Each instrument's octaves reproduce its printed adjustment factor (raw max × factor = 30):
  - flute, alto/bari sax, bass and BBb contra clarinet: 2-1-2-1
  - Eb contra clarinet: 1-2-1-2
  - bassoon: 2-2-2-1
  - clarinet: 2-2-2-2
  - oboe: 1-1-1-1
  - horn and tenor sax: 1-2-1-1
  - trumpet, trombone, baritone, and tuba: 2-1-1-1
- Time limits:
  - MS wind scales: 1:00, per the scale sheets.
  - Mallet scales: 1:15 (MS), 2:15 (Concert), 3:30 (Symphonic).
- Tempos: QN = 120 (MS), 132 (Concert), 144 (Symphonic), per the percussion district form text.

## Decisions
- **Printed-form errors are reproduced, with a visible notice:**
  - 9–10 Tenor Sax prints factor 0.9375, but its maxes sum to 34, so a perfect scale run scores 31.875 instead of 30.
  - 11–12 Bass Trombone prints factor 0.5770, but its maxes sum to 50, so a perfect run scores 28.85.
  - Mock scores match what the real sheet would compute. Notices live in `FORM_NOTICES`.
- **MS forms list concert keys only.** The tool adds written keys in parentheses, like the HS forms do. MS Contra Clarinet has Eb vs BBb scale-sheet variants, and MS Baritone has BC vs TC; you pick these on the round screen (they only affect the First Round).
- **State percussion form has totals only.** The tool scores it through a "practice breakdown" built from district categories, summing to the official totals: snare 60/40, xylophone 60/40, timpani 50/30/20. A notice explains this.
- **HS state forms labeled Vibraphone / Drum Set / Piano** share the Percussion layout, so they use the one percussion form.
- **Score scales:**
  - District rubric: 0–5 by 0.5.
  - State forms: integer printed scales; fractional marks are allowed ("approximate spot"), so the tool uses 0.5 steps.
  - Wind scales: per-octave ✓/✗ cells (integer points, per the form instructions).
- **Wind scale boxes default to 0** (Mat's request, v1.0.2). One tap = ✓, tap again = 0. Once any box in a scale section is tapped, the whole section counts as scored; only an untouched scale section is flagged as blank. Unmarked boxes show under "Scale spots to fix".
- **Other unscored items (rubric categories, mallet chips) count as 0** like the real sheet. The results page names them; "Go to first blank" jumps to the first one. Mallet sections keep "Mark blanks ✗".
- **Self vs. teacher compare** uses only the categories both people scored.
- **Storage:**
  - Everything is device-local (localStorage). The draft autosaves.
  - A mock goes into history when its results are first opened; after that, edits re-save automatically.
  - Export/import is JSON, merged by id with newest `updated` winning. A backup nag appears after 21 days.
- **Share links:** the mock is deflate-compressed and base64url-encoded into `#view=` (typically 400–900 chars).
  - Read-only.
  - "First name only" is on by default.
  - A QR code is shown when the URL is under 2300 chars.
  - Nothing is uploaded.

## Look and branding (v1.1.0)
- Raven Band *style* (navy #1f2a44, gold #c9a227, Oswald 600), the same palette as Agenda Board and the Raven Band Hub. No raven logo and no "Raven Band" in the name, because colleagues at other schools use this (Mat's choice); the footer credits Mat / Raven Band.
- Oswald is served from `assets/oswald-latin-600-normal.woff2` (copied from agenda-board, OFL license alongside). It is **not** inlined, so `assets/` must deploy with `index.html`. Only weight 600 exists, so headings use font-weight 600 (no faux bold).
- Dark mode swaps `--brand` to gold, so primary buttons, chips, and totals turn gold on navy.
- `inner_text` in Playwright returns CSS-uppercased text. Compare headings case-insensitively in tests.

## Sight reading (v1.2.0): First Sight inside the mock
- The engine is **Band Arcade's First Sight, copied unchanged** into `vendor/first-sight/`: generator `etudes.js`, engraver `notation.js` + `ui.js` staff helpers, `instruments.js` / `scales.js` / `counting.js`, wind voices `winds.js`, click/snare kit `backing.js`, and the Noto Music subset `music.woff2` (OFL).
  - `vendor/first-sight/SOURCE.md` records the Band Arcade commit (2f382e1 on first copy).
  - **Never edit those files here.** Fix them in stemband/band-arcade, then run `python3 tools/sync_first_sight.py <band-arcade checkout>`, rebuild, and test.
  - `src/fs-shim.js` supplies `Arcade.Sfx.output()` (one AudioContext, created on the first tap).
- `src/sight.js` is the glue (loaded before app.js):
  - `fsMember`: our instrument → a First Sight member.
    - Baritone: the clef follows the MS variant or a Clef picker (`m.sightBari`).
    - Contra clarinet: E♭ is written as baritone sax, B♭ as bass clarinet. Hear It plays an octave lower.
    - Percussion: snare sections → snare; mallets/xylophone → bells; timpani → none (a message says so).
  - The panel, the stand (`FSS` state; study / count-in / click / Hear It / tempo, ported from first-sight/game.js), the results block, print pages, and share (`sr`, `sb` in the packed mock).
- Saved on the mock as `m.sight = {sectionId: code}`. A code (e.g. `5E6-K7QX`) is the same music everywhere, including Band Arcade's First Sight.
- Defaults (`FS_DEFAULTS`, overridable per device in prefs `fs`):
  - Level 5, any key, 6 bars, 30 s study.
  - The click is OFF in a mock; Practice mode turns it on.
  - Hear It asks before playing until a play-through finishes. In a real audition nobody plays it for you.
- HS sheets show the etude labeled "middle-school district-level". First Sight has no HS levels. If Mat wants real HS sight reading, that work belongs in Band Arcade's `etudes.js` LEVELS (more keys, faster tempos), then a sync.
- Phones engrave 2 bars a row, or 1 when 2 would shrink the notes below 75%. Laptops and iPads use First Sight's 4 bars a row (3 for 6 bars).

## Updating for a new year
1. Run `python3 tools/gen_hs_district.py "<new first-round PDF>"` to regenerate `src/hs_district.js`. It prints a math check and flags any printed factor that does not give 30.
2. Re-read the MS scale sheets and update `MS_DISTRICT` octaves, factors, and cuts. Run the smoke test; it asserts every scale section sums to 30 except the keys in `KNOWN`. Update `FORM_NOTICES` and `KNOWN` if GMEA fixes or changes anything.
3. Update "2025–26" strings in `index.template.html` and in `openHelp()`/print footer in `app.js`.

## Open items / ideas
- Optional: an audio-record button during the mock, so the student can hear their own playing next to the sheet.
- Optional: per-student goal date (audition day) countdown in history.
