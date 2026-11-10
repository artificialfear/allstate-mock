/* FIRST SIGHT: THE ETUDE GENERATOR (Arcade.FSEtudes). Makes an original 6- or 8-bar sight-reading etude from a CODE, so
   the same code is the same music on every device and for every instrument (a class can read one together).
   Plain data in, plain data out: no DOM, no audio. Full doc: docs/games/first-sight.md.

   HOW AN ETUDE IS MADE (all in CONCERT pitch, as scale degrees, so every instrument gets the same music):
     1. THE METER from the level (LEVELS.meters, weighted).
     2. THE RHYTHM, bar by bar, from the level's CELLS (one or more beats each, weighted; a newer cell weighs more). The
        form is a PERIOD: the first bar's rhythm comes back at the second phrase's start; the middle bar ends the first
        phrase on a long note (a half cadence); the last bar ends on a long tonic. Ties across bar lines from level 3.
     3. THE MELODY: mostly steps, with the level's leaps (a leap is followed by a step back), inside the level's SPAN of
        degrees, heading for each phrase's goal (the 5th or 2nd at the half cadence, the tonic at the end).
        CHROMATIC notes from level 4: a raised degree as a passing tone or a lower neighbor, only where the step is a
        whole step (so it never needs a double sharp or double flat in any written key).
     4. THE MARKINGS: dynamics (p mf f, mp from level 5), hairpins into a new dynamic, slurs, staccato, tenuto, accents.
     5. FOR AN INSTRUMENT (realize): the degrees become WRITTEN notes in the member's written key (shared/scales.js:
        START's tonic), shifted an octave as a whole if that fits the member's GMEA range better, any note still out of
        range folded in by octaves. The snare gets the rhythm, accents and dynamics on a one-line staff.

     FSEtudes.LEVELS                      the six levels (numbers to tune are here)
     FSEtudes.KEYS                        ['F', 'Bb', 'Eb', 'Ab'] (shared/scales.js ids)
     FSEtudes.code({level, key, bars, seed})   → '5E8-K7QX'      FSEtudes.parseCode(text) → {level, key, bars, seed} | null
     FSEtudes.newSeed(rand)               4 letters from SEED_ABC
     FSEtudes.make({level, key, bars, seed}) → the etude: {code, level, key, bars, meter, tempo, tempoWord, beatTicks,
                                            barTicks, events: [{i, t, d (ticks), rest, deg, alt, trip, tieNext, tiedFrom,
                                            art, slur, dyn, hair, hairEnd, bar}], text (shared/counting.js rhythm text),
                                            labels (the counting's starting syllable per event)}
     FSEtudes.realize(etude, member)      → {clef, sig, notes: [{n {letter, acc, oct}, midi (written), sounding} | null]}
                                            (one per event; null for rests and for the snare) */
window.Arcade = window.Arcade || {};
(function (A) {
  'use strict';

  /* ================= THE LEVELS (Mr. Graham tunes these) =================
     meters  {meter: weight}            tempo   the marking (beats per minute; 6/8: the dotted quarter)
     span    [lowest, highest] scale degree from the tonic (0 = tonic, 7 = the octave above, -3 = the 5th below)
     steps   {interval in degrees: weight}: 0 = a repeated note, 1 = a step, 2 = a skip (a 3rd), 3 = a 4th …
     cells   {cell: weight}: the rhythms this level may use (see CELLS)
     ties    the chance of a tie across each bar line (at most 2 an etude)
     slur / stac / ten / acc   the chance a group of notes is slurred / staccato, a note tenuto / accented
     chrom   chromatic notes in an etude (at most)          trips  eighth-note triplets in an etude (at most)
     dyn     how many dynamics: 1 (the start), 2 (+ the second phrase), 3 (+ one more and hairpins) */
  const LEVELS = [
    {n: 1, name: 'Building Blocks', blurb: 'Whole, half and quarter notes and quarter rests in 4/4. Mostly steps.',
      meters: {'4/4': 1}, tempo: 72, span: [0, 4], steps: {0: .15, 1: .62, 2: .23},
      cells: {q: 5, h: 3, qr: 1.2, w: .7}, ties: 0, slur: 0, stac: 0, ten: 0, acc: 0, chrom: 0, trips: 0, dyn: 1},
    {n: 2, name: 'Eighth Notes', blurb: 'Adds eighth-note pairs, dotted halves and half rests. 3/4 time, skips, p and f.',
      meters: {'4/4': 2, '3/4': 1}, tempo: 76, span: [-1, 6], steps: {0: .12, 1: .52, 2: .28, 3: .05, 4: .03},
      cells: {q: 4, h: 2.4, qr: 1, w: .4, 'e e': 4.5, 'h.': 1.2, hr: .6}, ties: 0, slur: 0, stac: 0, ten: 0, acc: 0, chrom: 0, trips: 0, dyn: 2},
    {n: 3, name: 'Dots & Ties', blurb: 'Adds dotted quarter–eighth, ties and eighth rests. 2/4 time, slurs, staccato, mf and hairpins.',
      meters: {'4/4': 2, '3/4': 1, '2/4': 1}, tempo: 80, span: [-2, 7], steps: {0: .1, 1: .47, 2: .27, 3: .09, 4: .07},
      cells: {q: 3.5, h: 2, qr: .9, w: .3, 'e e': 4, 'h.': 1, hr: .4, 'q. e': 3.5, 'er e': 1.6}, ties: .3, slur: .35, stac: .18, ten: 0, acc: 0, chrom: 0, trips: 0, dyn: 3},
    {n: 4, name: 'Off the Beat', blurb: 'Adds syncopation, off-beat eighths and chromatic notes. Accents, tenuto, leaps up to a 5th.',
      meters: {'4/4': 2, '3/4': 1, '2/4': 1}, tempo: 84, span: [-3, 7], steps: {0: .08, 1: .44, 2: .25, 3: .11, 4: .09, 5: .03},
      cells: {q: 3, h: 1.6, qr: .8, w: .2, 'e e': 3.5, 'h.': .8, hr: .3, 'q. e': 3, 'er e': 2, 'e q e': 2.6}, ties: .3, slur: .38, stac: .2, ten: .12, acc: .1, chrom: 2, trips: 0, dyn: 3},
    {n: 5, name: 'District Ready', blurb: 'Adds sixteenths, dotted eighth–sixteenth and triplets, at 92 beats a minute: the district audition level.',
      meters: {'4/4': 3, '3/4': 1, '2/4': 1}, tempo: 92, span: [-2, 8], steps: {0: .08, 1: .42, 2: .24, 3: .11, 4: .09, 5: .04, 7: .02},
      cells: {q: 2.6, h: 1.3, qr: .7, 'e e': 3, 'h.': .6, hr: .2, 'q. e': 2.2, 'er e': 1.6, 'e q e': 1.8,
        's s s s': 1.5, 'e s s': 1.9, 's s e': 1.9, 'e. s': 2.3, '[e e e]': 1.4}, ties: .25, slur: .4, stac: .2, ten: .14, acc: .12, chrom: 3, trips: 2, dyn: 3},
    {n: 6, name: 'Six-Eight', blurb: '6/8 time: dotted quarters, quarter–eighth, three eighths, rests and sixteenths, with every marking.',
      meters: {'6/8': 1}, tempo: 60, span: [-2, 8], steps: {0: .08, 1: .44, 2: .25, 3: .1, 4: .09, 5: .03, 7: .01},
      cells: {'q.': 3, 'q e': 4, 'e e e': 4, 'h.': .8, 'q.r': .9, 'e q': 1.6, 'er e e': 1.1, 'e. s e': 1.6, 's s e e': 1.2},
      ties: .25, slur: .38, stac: .2, ten: .12, acc: .12, chrom: 2, trips: 0, dyn: 3},
  ];
  const LIMITS = {sixteenthCellsPerBar: 2, restCellsPerBar: 1, maxTies: 2, repeatRun: 3};

  /* THE CELLS: one or more beats of rhythm, in shared/counting.js's text (a quarter = 12 ticks; triplet eighths = 4) */
  const KEYS = ['F', 'Bb', 'Eb', 'Ab'];
  const KEY_CODE = {F: 'F', Bb: 'B', Eb: 'E', Ab: 'A'}, CODE_KEY = {F: 'F', B: 'Bb', E: 'Eb', A: 'Ab'};
  const KEY_NAME = {F: 'F', Bb: 'B♭', Eb: 'E♭', Ab: 'A♭'};
  const METERS = {
    '4/4': {per: 4, ts: [4, 4], beat: 12, bar: 48, compound: false},
    '3/4': {per: 3, ts: [3, 4], beat: 12, bar: 36, compound: false},
    '2/4': {per: 2, ts: [2, 4], beat: 12, bar: 24, compound: false},
    '6/8': {per: 3, ts: [6, 8], beat: 18, bar: 36, compound: true},
  };
  const VAL = {w: 48, h: 24, q: 12, e: 6, s: 3};
  /** a cell's text → its notes [{d (ticks), rest, trip, tok}] */
  function cellNotes(cell) {
    const out = [];
    const trip = /^\[(.*)\]$/.exec(cell);
    const toks = (trip ? trip[1] : cell).split(/\s+/);
    toks.forEach(tok => {
      const m = /^([whqes])(\.?)(r?)$/.exec(tok);
      let d = VAL[m[1]] * (m[2] ? 1.5 : 1);
      if (trip) d = d * 2 / 3;
      out.push({d, rest: !!m[3], trip: !!trip, tok});
    });
    return out;
  }
  const cellLen = cell => cellNotes(cell).reduce((a, n) => a + n.d, 0);
  const has16 = cell => /\bs\b|e\./.test(cell);
  /** may this cell start `pos` ticks into a bar of this meter? */
  function fitsAt(cell, pos, M) {
    const len = cellLen(cell);
    if (pos + len > M.bar) return false;
    if (M.compound) return cell === 'h.' ? pos === 0 : pos % 18 === 0;
    if (cell === 'w') return pos === 0 && M.bar === 48;
    if (cell === 'h.') return pos === 0;
    if (cell === 'h' || cell === 'hr') return M.bar === 48 ? pos % 24 === 0 : M.bar === 24 ? pos === 0 : cell === 'h' ? pos % 12 === 0 : pos === 0;
    if (cell === 'q. e' || cell === 'e q e') return M.bar === 48 ? pos % 24 === 0 : pos % 12 === 0;
    return pos % 12 === 0;
  }

  /* CADENCES: the last bar (a long tonic) and the half cadence (the first phrase's end), by meter; `from` = the level
     they start at */
  const CADENCE = {
    end: {'4/4': [['w'], ['h', 'h'], ['q', 'q', 'h'], ['e e', 'q', 'h', 2], ['q. e', 'h', 3]],
          '3/4': [['h.'], ['q', 'h'], ['e e', 'h', 2]],
          '2/4': [['h'], ['q', 'q'], ['e e', 'q', 2]],
          '6/8': [['h.'], ['q e', 'q.'], ['e e e', 'q.']]},
    half: {'4/4': [['q', 'q', 'h'], ['h', 'h'], ['e e', 'q', 'h', 2], ['e e', 'e e', 'h', 2], ['q. e', 'h', 3], ['e q e', 'h', 4], ['e. s', 'q', 'h', 5]],
           '3/4': [['q', 'h'], ['h.'], ['e e', 'h', 2], ['q. e', 'q', 3]],
           '2/4': [['h'], ['q', 'q'], ['e e', 'q', 2], ['e. s', 'q', 5]],
           '6/8': [['q e', 'q.'], ['h.'], ['e e e', 'q.'], ['e. s e', 'q.']]},
  };

  /* ================= RANDOM (seeded: the code decides everything) ================= */
  const SEED_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function rng(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    let a = h >>> 0;
    const r = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 4; i++) r();
    return r;
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];
  function weighted(r, obj) {
    const ents = Object.entries(obj).filter(([, w]) => w > 0);
    const tot = ents.reduce((a, [, w]) => a + w, 0);
    let x = r() * tot;
    for (const [k, w] of ents) { x -= w; if (x <= 0) return k; }
    return ents[ents.length - 1][0];
  }
  const newSeed = (rand = Math.random) => Array.from({length: 4}, () => SEED_ABC[Math.floor(rand() * 32)]).join('');

  /* ================= THE CODE ================= */
  const code = ({level, key, bars, seed}) => `${level}${KEY_CODE[key]}${bars}-${seed}`;
  function parseCode(text) {
    const m = /^\s*([1-6])\s*([FBEA])\s*([68])\s*-?\s*([A-Z2-9]{4})\s*$/i.exec(String(text || ''));
    if (!m) return null;
    const seed = m[4].toUpperCase();
    if ([...seed].some(c => !SEED_ABC.includes(c))) return null;
    return {level: +m[1], key: CODE_KEY[m[2].toUpperCase()], bars: +m[3], seed};
  }

  /* ================= 2. THE RHYTHM ================= */
  function fillBar(r, L, M, state, first) {
    const cells = [];
    let pos = 0, n16 = 0, nRest = 0;
    while (pos < M.bar) {
      const opts = {};
      Object.entries(L.cells).forEach(([c, w]) => {
        if (!fitsAt(c, pos, M)) return;
        if (has16(c) && n16 >= LIMITS.sixteenthCellsPerBar) return;
        if (c.startsWith('[') && state.trips >= L.trips) return;
        const rest = cellNotes(c)[0].rest;
        if (rest && (nRest >= LIMITS.restCellsPerBar || (first && pos === 0) || (cells.length && cellNotes(cells[cells.length - 1]).slice(-1)[0].rest))) return;
        opts[c] = w;
      });
      if (!Object.keys(opts).length) opts[M.compound ? 'q.' : 'q'] = 1;
      const c = weighted(r, opts);
      cells.push(c); pos += cellLen(c);
      if (has16(c)) n16++;
      if (c.startsWith('[')) state.trips++;
      if (cellNotes(c)[0].rest) nRest++;
    }
    return cells;
  }
  function cadenceBar(r, L, meter, kind) {
    const list = CADENCE[kind][meter].filter(c => typeof c[c.length - 1] !== 'number' || c[c.length - 1] <= L.n)
      .map(c => typeof c[c.length - 1] === 'number' ? c.slice(0, -1) : c);
    return pick(r, list).slice();
  }

  /* ================= 3. THE MELODY ================= */
  const WHOLE_BELOW = d => [0, 1, 3, 4, 5].includes(((d % 7) + 7) % 7);   // degree d → d+1 is a whole step
  function melody(r, L, notes, phrases, span) {
    const [lo, hi] = span;
    let chromLeft = L.chrom, prevIv = 0, run = 1;
    const forced = [];
    let cur = pick(r, [0, 0, 2, 4].filter(d => d >= lo && d <= hi));
    notes.forEach((nt, k) => {
      if (k === 0) { nt.deg = cur; nt.alt = 0; return; }
      if (nt.tiedFrom) { nt.deg = notes[k - 1].deg; nt.alt = notes[k - 1].alt; return; }
      const ph = phrases.find(p => k >= p.from && k <= p.to);
      const left = ph.to - k;
      let deg, alt = 0;
      if (forced.length) { ({deg, alt} = forced.shift()); }
      else if (left === 0) deg = ph.goal;
      else if (left === 1 && !notes[ph.to].tiedFrom) {
        const g = ph.goal, c = [g - 1, g + 1].filter(d => d >= lo && d <= hi);
        deg = c.length === 2 ? (Math.abs(c[0] - cur) <= Math.abs(c[1] - cur) ? c[0] : c[1]) : c[0] != null ? c[0] : g;
        if (deg === cur && r() < .5) deg = g;
      } else {
        // a chromatic gesture (two notes ahead, both short and in this bar, nothing tied)
        const a = notes[k], b = notes[k + 1];
        if (chromLeft > 0 && left >= 3 && b && !b.tiedFrom && !a.tieNext && !b.tieNext && a.bar === b.bar && a.d <= 12 && b.d <= 12 &&
            notes[k - 1].alt === 0 && r() < .35) {
          const up = WHOLE_BELOW(cur) && cur + 1 <= hi, nb = WHOLE_BELOW(cur - 1) && cur - 1 >= lo - 1;
          if (up && (!nb || r() < .55)) { deg = cur; alt = 1; forced.push({deg: cur + 1, alt: 0}); chromLeft--; }   // passing, up
          else if (nb) { deg = cur - 1; alt = 1; forced.push({deg: cur, alt: 0}); chromLeft--; }                        // lower neighbor
        }
        if (deg == null) {
          let tries = 0;
          do {
            const size = +weighted(r, L.steps);
            let dir;
            if (Math.abs(prevIv) >= 3) dir = -Math.sign(prevIv);                                   // a leap: step back
            else {
              const toward = Math.sign(ph.goal - cur) || (r() < .5 ? 1 : -1);
              const pull = .5 + .35 * (1 - left / Math.max(1, ph.to - ph.from));
              dir = r() < pull ? toward : -toward;
            }
            deg = cur + dir * (Math.abs(prevIv) >= 3 ? 1 : size);
            if (deg < lo || deg > hi) deg = cur - dir * (Math.abs(prevIv) >= 3 ? 1 : size);
            const tritone = Math.abs(deg - cur) === 3 && [3, 6].includes(((deg % 7) + 7) % 7) && [3, 6].includes(((cur % 7) + 7) % 7);
            const tooMany = deg === cur && run >= LIMITS.repeatRun - 1;
            if (deg >= lo && deg <= hi && !tritone && !tooMany) break;
            deg = null;
          } while (++tries < 12);
          if (deg == null) deg = Math.max(lo, Math.min(hi, cur + (cur < (lo + hi) / 2 ? 1 : -1)));
        }
      }
      run = deg === cur && alt === 0 ? run + 1 : 1;
      prevIv = deg - cur;
      nt.deg = deg; nt.alt = alt;
      cur = deg;
    });
  }

  /* ================= THE ETUDE ================= */
  function make({level, key, bars, seed}) {
    const L = LEVELS[Math.max(1, Math.min(6, level)) - 1];
    if (!KEYS.includes(key)) key = 'Bb';
    bars = bars === 6 ? 6 : 8;
    const r = rng(`${L.n}|${key}|${bars}|${seed}`);
    const meter = weighted(r, L.meters), M = METERS[meter];
    const mid = bars / 2;                                   // the first phrase's last bar (1-based: 4 of 8, 3 of 6)

    /* rhythm, bar by bar */
    const state = {trips: 0};
    const barCells = [];
    for (let b = 0; b < bars; b++) {
      let cells;
      if (b === bars - 1) cells = cadenceBar(r, L, meter, 'end');
      else if (b === mid - 1) cells = cadenceBar(r, L, meter, 'half');
      else if (b === mid && L.n >= 2) cells = barCells[0].slice();                         // the answer: bar 1's rhythm again
      else if (bars === 8 && b === 2 && r() < .35) cells = barCells[0].slice();
      else cells = fillBar(r, L, M, state, b === 0);
      barCells.push(cells);
    }
    // the first note of the second phrase is never a rest (bar 1's rhythm never starts with one)
    /* the events */
    const events = [];
    let t = 0;
    barCells.forEach((cells, b) => {
      let trip = 0;
      cells.forEach((c, ci) => {
        const tripId = c.startsWith('[') ? `${b}.${ci}` : null;
        cellNotes(c).forEach(n => { events.push({i: events.length, t, d: n.d, rest: n.rest, trip: tripId, bar: b, cell: ci, tok: n.tok, art: []}); t += n.d; trip++; });
      });
    });
    // ties across bar lines (into a plain note of an eighth or longer)
    let ties = 0;
    if (L.ties) for (let b = 0; b < bars - 1 && ties < LIMITS.maxTies; b++) {
      const lastI = events.findIndex(e => e.bar === b + 1) - 1, a = events[lastI], z = events[lastI + 1];
      if (!a || !z || a.rest || z.rest || a.trip || z.trip || a.d < 6 || z.d < 6 || z.d > 24 || a.tiedFrom) continue;
      if (b + 1 === mid - 1 || b + 1 === mid || b + 1 === bars - 1) continue;             // never into or out of a cadence's bar
      if (r() < L.ties) { a.tieNext = true; z.tiedFrom = true; ties++; }
    }
    const notes = events.filter(e => !e.rest);
    // phrases (note indexes): the first ends on the half cadence's last note, the second on the last note
    const lastOf = bar => { let k = -1; notes.forEach((n, i) => { if (n.bar <= bar) k = i; }); return k; };
    const p1 = lastOf(mid - 1);
    const span = L.span.slice();
    const goal1 = r() < .7 ? 4 : 1, goal2 = span[1] >= 7 && r() < .3 ? 7 : 0;
    melody(r, L, notes, [{from: 0, to: p1, goal: goal1}, {from: p1 + 1, to: notes.length - 1, goal: goal2}], span);

    /* 4. the markings */
    marks(r, L, events, bars, mid);

    /* the counting: one rhythm text, read by shared/counting.js; its groups (a tie chain = one) give each attack and rest
       its starting syllable */
    const text = barCells.map((cells, b) => {
      let s = cells.join(' ');
      const lastI = events.findIndex(e => e.bar === b + 1) - 1;
      if (lastI >= 0 && events[lastI].tieNext) s += '_';
      return s;
    }).join(' | ');
    let labels = null;
    if (A.Counting) {
      try {
        const P = A.Counting.parse(text, meter);
        if (!P.errors || !P.errors.length) {
          const gs = A.Counting.groups(P), heads = events.filter(e => !e.tiedFrom);
          if (gs.length === heads.length) { labels = new Array(events.length).fill(null); heads.forEach((e, k) => { labels[e.i] = gs[k].rest ? `(${gs[k].big})` : gs[k].big; }); }
        }
      } catch (e) { labels = null; }
    }
    const tempoWord = L.tempo < 66 && meter !== '6/8' ? 'Andante' : L.tempo <= 76 ? 'Andante' : 'Moderato';
    return {code: code({level: L.n, key, bars, seed}), level: L.n, levelName: L.name, key, keyName: KEY_NAME[key], bars, seed, meter,
      per: M.per, ts: M.ts, compound: M.compound, beatTicks: M.beat, barTicks: M.bar, tempo: L.tempo, tempoWord,
      events, text, labels, totalTicks: t};
  }

  /* 4. MARKINGS: dynamics, hairpins, slurs, staccato, tenuto, accents */
  function marks(r, L, events, bars, mid) {
    const firstNoteOf = bar => events.find(e => e.bar === bar && !e.rest && !e.tiedFrom);
    const LADDER = L.n >= 5 ? ['p', 'mp', 'mf', 'f'] : ['p', 'mf', 'f'];
    const rank = d => ['p', 'mp', 'mf', 'f'].indexOf(d);
    const starts = [0];
    if (L.dyn >= 2) starts.push(mid);
    if (L.dyn >= 3 && bars === 8) starts.push(pick(r, [2, 6]));
    if (L.dyn >= 3 && bars === 6) starts.push(pick(r, [2, 5]));
    const uniq = [...new Set(starts)].sort((a, b) => a - b);
    let prev = null;
    uniq.forEach(b => {
      const e = firstNoteOf(b); if (!e) return;
      let d;
      if (prev == null) d = L.n === 1 ? pick(r, ['mf', 'f']) : pick(r, ['p', 'mf', 'f', 'mf']);
      else { const opts = LADDER.filter(x => x !== prev && Math.abs(rank(x) - rank(prev)) >= 1); d = pick(r, opts); }
      if (L.n < 3 && d === 'mf' && prev != null) d = prev === 'p' ? 'f' : 'p';
      e.dyn = d; prev = d;
    });
    // hairpins into each later dynamic (level 3 up): from a note in the bar before
    if (L.dyn >= 3) {
      const dynEvs = events.filter(e => e.dyn);
      dynEvs.slice(1).forEach((e, k) => {
        const before = dynEvs[k];
        const from = events.filter(x => x.bar === e.bar - 1 && !x.rest && !x.tiedFrom);
        if (!from.length || r() < .35) return;
        const s = from[Math.min(from.length - 1, Math.floor(r() * Math.min(2, from.length)))];
        if (s.dyn) return;
        s.hair = rank(e.dyn) > rank(before.dyn) ? 'cresc' : 'dim';
        e.hairEnd = true;
      });
      // a closing diminuendo or crescendo into the last note, sometimes
      const last = events.filter(e => !e.rest && !e.tiedFrom).slice(-1)[0], pen = events.filter(e => e.bar === bars - 2 && !e.rest && !e.tiedFrom)[0];
      if (last && pen && !pen.hair && !pen.dyn && !last.hairEnd && r() < .4) {
        const now = events.filter(e => e.dyn && e.t <= pen.t).map(e => e.dyn).pop() || 'mf', i = LADDER.indexOf(now);
        let to = last.dyn;
        if (!to) to = r() < .5 ? LADDER[i - 1] : LADDER[i + 1];
        if (to && to !== now) { pen.hair = rank(to) > rank(now) ? 'cresc' : 'dim'; last.hairEnd = true; last.dyn = to; }
      }
    }
    // slurs and staccato over a cell's notes (or two cells' eighths); never across a bar line or a rest
    let slurId = 0;
    const byCell = {};
    events.forEach(e => { (byCell[e.bar + '.' + e.cell] || (byCell[e.bar + '.' + e.cell] = [])).push(e); });
    const cellKeys = Object.keys(byCell);
    cellKeys.forEach((k, ci) => {
      const g = byCell[k];
      if (g.some(e => e.rest) || g[0].slur != null) return;
      if (g.length >= 2 && L.slur && r() < L.slur) {
        let run = g.slice();
        const nx = byCell[cellKeys[ci + 1]];
        if (nx && nx[0].bar === g[0].bar && nx.length >= 2 && !nx.some(e => e.rest) && r() < .3) run = run.concat(nx);
        if (run.some(e => e.tieNext && run.indexOf(e) === run.length - 1)) return;
        const id = ++slurId;
        run.forEach((e, i) => { e.slur = id; e.slurFirst = i === 0; e.slurLast = i === run.length - 1; });
        return;
      }
      if (L.stac && g.every(e => e.d <= 12 && !e.tieNext) && r() < L.stac) g.forEach(e => { if (!e.tiedFrom) e.art.push('stac'); });
    });
    events.forEach(e => {
      if (e.rest || e.tiedFrom || e.art.includes('stac')) return;
      const down = (e.t % (L.n === 6 ? 18 : 12)) === 0;
      if (L.acc && down && e.d >= 12 && e.slur == null && r() < L.acc) e.art.push('acc');
      else if (L.ten && e.d >= 12 && (e.slur == null || e.slurLast) && r() < L.ten) e.art.push('ten');
    });
  }

  /* ================= 5. FOR AN INSTRUMENT ================= */
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  function realize(et, member) {
    if (!member || member.pitched === false || !A.Scales) return {clef: null, sig: null, notes: et.events.map(() => null), unpitched: true};
    const sc = A.Scales.build(member, et.key), up = sc.up;
    const at = (deg, alt, shift) => {
      const r7 = ((deg % 7) + 7) % 7, k = Math.floor(deg / 7), b = up[r7];
      const oct = b.oct + k + shift;
      return {n: {letter: b.letter, acc: b.acc + alt, oct}, midi: b.midi + 12 * (k + shift) + alt};
    };
    const pitched = et.events.filter(e => !e.rest);
    const out = m => m < member.lowMidi || m > member.highMidi;
    const outOf = shift => pitched.filter(e => out(at(e.deg, e.alt, shift).midi)).length;
    // the octave: the fewest notes outside the range, then the one sitting closest to the middle of the member's GMEA
    // range (the tuba's F etudes read around the staff, not under it; the flute stays up where it sings)
    const MIDDLE = (member.lowMidi + member.highMidi) / 2;
    const center = shift => { const ms = pitched.map(e => at(e.deg, e.alt, shift).midi).sort((a, b) => a - b); return Math.abs(ms[ms.length >> 1] - MIDDLE); };
    const score = sh => outOf(sh) * 100 + center(sh) + (sh ? 2 : 0);                     // near ties go to the GMEA scale's octave
    const shift = [0, 1, -1].reduce((best, sh) => score(sh) < score(best) ? sh : best, 0);
    // a bar that still leaves the range moves an octave as a whole when that fits (a leap at a bar line reads like a
    // real part's octave change); otherwise only the notes outside move
    const barShift = {};
    for (let b = 0; b < et.bars; b++) {
      const evs = pitched.filter(e => e.bar === b);
      if (!evs.some(e => out(at(e.deg, e.alt, shift).midi))) { barShift[b] = shift; continue; }
      const ok = [1, -1].map(d => shift + d).find(s => evs.every(e => !out(at(e.deg, e.alt, s).midi)));
      barShift[b] = ok != null ? ok : shift;
    }
    const notes = et.events.map((e, i) => {
      if (e.rest) return null;
      // a tie keeps its pitch: the second note follows the first (its bar may have moved)
      const sh = e.tiedFrom ? barShift[et.events[i - 1].bar] : barShift[e.bar];
      let x = at(e.deg, e.alt, sh), guard = 0;
      while (x.midi < member.lowMidi && guard++ < 4) x = {n: Object.assign({}, x.n, {oct: x.n.oct + 1}), midi: x.midi + 12};
      while (x.midi > member.highMidi && guard++ < 8) x = {n: Object.assign({}, x.n, {oct: x.n.oct - 1}), midi: x.midi - 12};
      return {n: x.n, midi: x.midi, sounding: x.midi - member.sounds};
    });
    return {clef: member.clef, sig: sc.sig, notes, scale: sc, shift, unpitched: false};
  }

  A.FSEtudes = {LEVELS, LIMITS, KEYS, KEY_CODE, KEY_NAME, METERS, CADENCE, SEED_ABC, MAJOR,
    make, realize, code, parseCode, newSeed, cellNotes, cellLen, fitsAt, rng};
})(window.Arcade);
