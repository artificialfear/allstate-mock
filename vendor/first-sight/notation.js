/* THE NOTATION ENGINE (shared; it began as Music Highway's). Draws a melody as printed music (real note values, beams,
   rests, ties, dots, accidentals, bar lines, time and key signatures) with engraving-style spacing, and gives a smooth
   time -> x map so a scrolling staff can follow the music exactly. Used by Music Highway's scrolling staff and trouble
   spot (music-highway/game.js), the Song Board (music-highway/songs.html) and First Sight's etudes (first-sight/).
   Needs shared/ui.js (noteY, keySigSVG, keySigWidth). Music Highway's spacing numbers are in its settings.js (STAFF
   SPACING, window.MH_RULES); without them the defaults below apply.

     Arcade.MHNotation.engrave({clef ('treble' | 'bass' | null = a one-line percussion staff), sig, per (beats in a
       measure), timeSig, measures, events: [{t (beats from the first measure), beats, rest?, n (written note),
       label (the letter name / R or L), id?, slur? (its slur group), slurFirst?, slurLast?}], header: 'time' | 'full' | 'none', showTime, x0, width (justify a row
       to this width), captions, final (a double bar at the end)})
       FIRST SIGHT'S EXTRAS (all optional; a caller that sets none draws byte-for-byte as before):
         groupBeats            beam eighths and sixteenths by this many beats (1 = by the beat in 4/4 too)
         event.trip            an eighth-note TRIPLET member (any id shared by its three notes; beats = 1/3): drawn as
                               eighths, beamed only with its own triplet, a "3" on the beam's side
         event.art             ['stac' | 'ten' | 'acc']: staccato dot, tenuto line, accent, on the head's side away
                               from the stem (the first piece of a tied note)
         event.dyn             a dynamic ('p', 'mf', …) under the staff at the note; event.hair 'cresc' | 'dim' starts a
                               hairpin there, ending at the next event with hairEnd (or the row's end)
         event.tieIn / tieOut  a tie coming in from the row before / going on to the next row (half ties at the edges)
         a rest's label        shown as a caption too (captions: true), like a note's
       -> {svg, vb: {top, h, w}, xAt(beats) (the smooth time -> x map), points: [{t, x}], bars: [x], shortest, layout() (tests)}
       2/2 draws ¢; 6/8 and 3/8 beam by the dotted quarter (3/8: the whole measure), may use dotted rests, and tie a note
       across the middle of a 6/8 bar instead of writing it over the dotted-quarter beat
     Arcade.MHNotation.pinSVG({clef, sig, top, h}) -> the clef + key signature alone, the same height (the fixed part
       on the left of the scrolling staff)

   HOW A MEASURE IS LAID OUT: each note is split into the values it can be written as (whole, dotted half, half, dotted
   quarter, quarter, dotted eighth, eighth, sixteenth), tied across bar lines and awkward beats; rests the same (not
   dotted, except in 6/8 and 3/8), a whole measure of rest = a whole rest. Eighths and sixteenths are beamed in groups (4/4
   and 2/2: a half measure; 2/4 and 3/4: a beat; 6/8 and 3/8: three eighths); stems go up below the middle line, down on or above it (a
   beamed group follows its majority). Space after a note = base × (1 + grow × log2(its length ÷ the song's shortest)),
   never under noteMin; an accidental and a dot add their own room; every bar line gets a fixed pad on both sides. The
   time -> x map runs through every note and rest (their onsets) with a monotone curve, so the playhead reaches each
   notehead exactly on time and never goes backwards. */
window.Arcade = window.Arcade || {};
(function (A) {
  'use strict';
  const MUSIC_FONT = `font-family='"GN Music","Noto Music",serif'`;
  const TEXT_FONT = `font-family='"GN Text",system-ui,sans-serif'`;
  const NUM_FONT = `font-family='Georgia,"Times New Roman",serif'`;
  const MID = 88, EPS = 1e-6;
  const q = v => Math.round(v * 96) / 96;                 // beats on a 1/96 grid (no float drift)
  const f1 = v => +v.toFixed(1);
  const S = () => Object.assign({barPadL: 26, barPadR: 20, noteBase: 36, noteMin: 34, noteGrow: .6, accRoom: 22, dotRoom: 10},
    (window.MH_RULES || {}).staff || {});

  /* an eighth-note triplet member: drawn as an eighth, a third of a beat long */
  const TRIP = {b: q(1 / 3), head: 'fill', flags: 1, dot: 0, trip: true};
  /* the note values a piece can be written as */
  const VALUES = [
    {b: 4, head: 'whole', flags: 0, dot: 0},
    {b: 3, head: 'half', flags: 0, dot: 1},
    {b: 2, head: 'half', flags: 0, dot: 0},
    {b: 1.5, head: 'fill', flags: 0, dot: 1},
    {b: 1, head: 'fill', flags: 0, dot: 0},
    {b: .75, head: 'fill', flags: 1, dot: 1},
    {b: .5, head: 'fill', flags: 1, dot: 0},
    {b: .375, head: 'fill', flags: 2, dot: 1},
    {b: .25, head: 'fill', flags: 2, dot: 0},
    {b: .125, head: 'fill', flags: 3, dot: 0},
  ];
  /** may value v start at position p (beats into the measure)? Long values start on a beat, quarters on an eighth… */
  function fits(v, p, rest, per, compound) {
    const on = g => Math.abs(p / g - Math.round(p / g)) < EPS;
    if (v.b === 4) return p < EPS && per >= 4;
    if (rest && v.dot && !compound) return false;          // rests are not dotted (except in 6/8 and 3/8)
    if (compound) {                                        // 6/8, 3/8: nothing crosses a dotted-quarter beat (the middle of a
      const inBeat = q(p - Math.floor(p / 1.5 + EPS) * 1.5); // 6/8 bar): a longer note is tied across it, like the book; a value
      if (inBeat > EPS ? inBeat + v.b > 1.5 + EPS : Math.abs(v.b / 1.5 - Math.round(v.b / 1.5)) > EPS && v.b > 1.5) return false;   // from a beat = whole beats or less
      if (rest && v.b >= 1.5) return inBeat < EPS && v.b <= 1.5 + EPS;   // a dotted quarter rest on a beat (whole measures: the whole rest)
      if (rest) return v.b >= 1 ? on(.5) && inBeat + v.b <= 1.5 + EPS : v.b >= .5 ? on(.25) : true;
    }
    if (v.b >= 2) return rest ? on(2) || (per % 2 === 1 && on(1)) : on(1);
    if (v.b >= 1) return rest ? on(1) : on(.5);
    if (v.b >= .5) return on(.25);
    return true;
  }
  /** a stretch of `len` beats starting at p, cut into writable values (at most `room`: the rest of the measure) */
  function split(p, len, room, rest, per, compound) {
    const out = [];
    while (len > EPS && room > EPS) {
      const lim = Math.min(len, room);
      const v = VALUES.find(x => x.b <= lim + EPS && fits(x, p, rest, per, compound)) || VALUES.find(x => x.b <= lim + EPS) || VALUES[VALUES.length - 1];
      out.push({p, v});
      p = q(p + v.b); len = q(len - v.b); room = q(room - v.b);
    }
    return {pieces: out, left: Math.max(0, len)};
  }

  const ORDER = {b: ['B', 'E', 'A', 'D', 'G', 'C', 'F'], '#': ['F', 'C', 'G', 'D', 'A', 'E', 'B']};
  const sigAcc = (sig, letter) => sig && sig.count && ORDER[sig.type].slice(0, sig.count).includes(letter) ? (sig.type === 'b' ? -1 : 1) : 0;

  /** an ellipse as a closed polygon path (rotated by deg), for hollow noteheads drawn with even-odd filling */
  function ell(cx, cy, rx, ry, deg, n = 24) {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a);
      d += (i ? 'L' : 'M') + f1(cx + x * c - y * s) + ' ' + f1(cy + x * s + y * c);
    }
    return d + 'Z';
  }

  /* ================= ENGRAVE ================= */
  function engrave(o) {
    const st = S(), per = o.per, M = o.measures, clef = o.clef || null, pitched = !!clef;
    // 6/8 and 3/8 (`compound`): beams by the dotted quarter (3/8: the whole measure's three eighths together), dotted
    // rests, nothing across the middle of a 6/8 bar (tied instead); 2/2 beams by the half (like 4/4) and shows ¢
    const ts = o.timeSig || [per, 4], compound = ts[1] === 8 && ts[0] % 3 === 0;
    const groupLen = o.groupBeats ? o.groupBeats * (compound ? 1.5 : 1) : compound ? 1.5 : per === 4 ? 2 : 1;
    const events = o.events.slice().sort((a, b) => a.t - b.t);

    /* 1. pieces, measure by measure (notes tied across bar lines and awkward beats) */
    const meas = Array.from({length: M}, () => []);
    events.forEach(e => {
      if (e.trip) {                                        // a triplet eighth: one piece, never split
        const m = Math.floor(q(e.t) / per + EPS);
        if (m >= 0 && m < M) meas[m].push({ev: e, rest: !!e.rest, p: q(q(e.t) - m * per), v: TRIP, m});
        return;
      }
      let t = q(e.t), len = q(e.beats), prev = null;
      while (len > EPS) {
        const m = Math.floor(t / per + EPS);
        if (m < 0 || m >= M) break;
        const p = q(t - m * per), room = q(per - p);
        if (e.rest && p < EPS && len >= per - EPS) {       // a whole measure of rest: a whole rest in the middle
          meas[m].push({ev: e, rest: true, full: true, p: 0, m, v: {b: per, head: 'rest', flags: 0, dot: 0}});
          t = q(t + per); len = q(len - per); continue;
        }
        const s = split(p, len, room, !!e.rest, per, compound);
        s.pieces.forEach(pc => {
          const piece = {ev: e, rest: !!e.rest, p: pc.p, v: pc.v, m};
          if (prev) { prev.tieNext = piece; piece.tieFrom = prev; }
          if (!e.rest) prev = piece;
          meas[m].push(piece);
        });
        t = q(t + (len - s.left)); len = s.left;
      }
    });
    const all = [].concat(...meas);

    /* 2. heights, stems and accidentals (an accidental lasts to the bar line; a tie carries it, but not into the next
       measure's other notes) */
    meas.forEach(list => {
      const state = {};
      list.forEach(pc => {
        if (pc.rest) return;
        pc.y = pitched ? A.noteY(clef, pc.ev.n) : MID;
        pc.up = !pitched || pc.y > MID;
        if (!pitched) return;
        const n = pc.ev.n, key = n.letter + n.oct, cur = key in state ? state[key] : sigAcc(o.sig, n.letter);
        if (!pc.tieFrom && n.acc !== cur) pc.acc = n.acc;
        if (!pc.tieFrom || pc.tieFrom.m === pc.m) state[key] = n.acc;
      });
    });

    /* 3. beams: eighths and sixteenths in the same beat group, with no rest between them */
    const beams = [];
    meas.forEach(list => {
      let run = [];
      const flush = () => {
        if (run.length > 1) {
          const ups = run.filter(pc => pc.y > MID).length, downs = run.length - ups;
          let up = !pitched || ups > downs;
          if (pitched && ups === downs) { const far = run.reduce((a, b) => Math.abs(b.y - MID) > Math.abs(a.y - MID) ? b : a); up = far.y > MID; }
          const B = {notes: run, up};
          run.forEach(pc => { pc.beam = B; pc.up = up; });
          beams.push(B);
        }
        run = [];
      };
      list.forEach(pc => {
        const g = Math.floor(pc.p / groupLen + EPS), gEnd = Math.floor((pc.p + pc.v.b) / groupLen - EPS);
        if (pc.rest || !pc.v.flags || g !== gEnd) { flush(); return; }
        if (run.length && (run[0].g !== g || (run[0].ev.trip || null) !== (pc.ev.trip || null))) flush();
        pc.g = g; run.push(pc);
      });
      flush();
    });

    /* 4. spacing */
    const shortest = Math.min(...all.filter(pc => !pc.full).map(pc => pc.v.b), per);
    const space = b => Math.max(st.noteMin, st.noteBase * (1 + st.noteGrow * Math.log2(b / shortest)));
    const pitchedHead = pitched ? 50 + A.keySigWidth(o.sig) : 36;
    let x = o.x0 || 0, timeX = null;
    if (o.header === 'full') x = pitchedHead;
    if (o.header === 'full' ? o.showTime !== false : o.header === 'time') { timeX = x + 18; x += 38; }
    const start = x, bars = [start];
    let barX = start;
    meas.forEach(list => {
      let last = null;
      list.forEach(pc => {
        if (pc.full) return;
        const lead = pc.acc != null ? st.accRoom : 0;
        pc.x = last ? last.x + space(last.v.b) + (last.v.dot ? st.dotRoom : 0) + lead : barX + st.barPadL + 9 + lead;
        last = pc;
      });
      let end;
      if (list.length === 1 && list[0].full) { const w = Math.max(st.barPadL + st.barPadR + 20, space(per)); list[0].x = barX + w / 2; end = barX + w; }
      else if (!last) end = barX + space(per);
      else {
        const dot = last.v.dot ? st.dotRoom : 0, hw = last.v.head === 'whole' ? 12 : 9;
        end = last.x + Math.max(space(last.v.b) * .8 + dot, hw + dot + st.barPadR);
      }
      bars.push(end); barX = end;
    });
    // justify a row (the Song Board): stretch the spacing, never the glyphs
    if (o.width && barX - start > 0) {
      const f = (o.width - 10 - start) / (barX - start);
      if (f > 1) {
        all.forEach(pc => { if (pc.x != null) pc.x = start + (pc.x - start) * f; });
        for (let i = 0; i < bars.length; i++) bars[i] = start + (bars[i] - start) * f;
        barX = bars[bars.length - 1];
      }
    }
    const W = Math.max(o.width || 0, barX + (o.final ? 14 : 10));

    /* 5. the time -> x map (every piece's onset; the end of the last measure) */
    const pts = [];
    all.forEach(pc => { const t = q(pc.m * per + pc.p); if (!pts.length || t > pts[pts.length - 1].t + EPS) pts.push({t, x: pc.x}); });
    pts.push({t: M * per, x: barX});
    const xAt = monotone(pts);

    /* 6. drawing (extents tracked for the viewBox) */
    let minY = 30, maxY = 146;
    const ext = (...ys) => ys.forEach(y => { if (y < minY) minY = y; if (y > maxY) maxY = y; });
    const groups = new Map(), grp = e => { if (!groups.has(e)) groups.set(e, {a: '', cap: ''}); return groups.get(e); };
    let rests = '', beamSVG = '', lines = '';
    const lineFrom = o.header === 'full' ? 8 : 0;
    if (pitched) for (let i = 0; i < 5; i++) lines += `<line x1="${lineFrom}" y1="${56 + i * 16}" x2="${f1(W - 4)}" y2="${56 + i * 16}" stroke="currentColor" stroke-width="1.6"/>`;
    else lines += `<line x1="${lineFrom}" y1="${MID}" x2="${f1(W - 4)}" y2="${MID}" stroke="currentColor" stroke-width="1.6"/>`;
    let head = '';
    if (o.header === 'full') head += clefSVG(clef, o.sig);
    if (timeX != null) head += timeSVG(ts, timeX, pitched);
    // bar lines (a double bar at the end)
    const by0 = pitched ? 56 : 72, by1 = pitched ? 120 : 104;
    bars.slice(1).forEach((bx, i) => {
      const lastBar = i === bars.length - 2;
      if (lastBar && o.final) lines += `<line x1="${f1(bx - 5)}" y1="${by0}" x2="${f1(bx - 5)}" y2="${by1}" stroke="currentColor" stroke-width="1.6"/><rect x="${f1(bx - 1)}" y="${by0}" width="5" height="${by1 - by0}" fill="currentColor"/>`;
      else lines += `<line class="mh-bar" x1="${f1(bx)}" y1="${by0}" x2="${f1(bx)}" y2="${by1}" stroke="currentColor" stroke-width="1.6"/>`;
    });

    // beams first: every beamed note's stem ends on its beam
    beams.forEach(B => {
      const run = B.notes, up = B.up, d = up ? -1 : 1, sx = pc => pc.x + (up ? 8.3 : -8.3);
      const extra = (Math.max(...run.map(pc => pc.v.flags)) - 1) * 6;
      const want = run.map(pc => pc.y + d * (50 + extra));
      const a = run[0], z = run[run.length - 1];
      let slope = (want[want.length - 1] - want[0]) / ((sx(z) - sx(a)) || 1);
      slope = Math.max(-.2, Math.min(.2, slope * .6));
      let y0 = want[0];
      const at = xx => y0 + slope * (xx - sx(a));
      // every stem at least 40 + the extra beams long, and a beam never short of the middle line
      let shift = 0;
      run.forEach(pc => {
        const need = up ? Math.min(pc.y - 40 - extra, MID) : Math.max(pc.y + 40 + extra, MID), ly = at(sx(pc));
        shift = up ? Math.min(shift, need - ly) : Math.max(shift, need - ly);
      });
      y0 += shift;
      B.at = at;
      const bar = (x1, x2, off) => {
        const ya = at(x1) - d * off, yb = at(x2) - d * off, th = 7 * -d;
        ext(ya, yb, ya + th, yb + th);
        return `<path d="M${f1(x1)} ${f1(ya)}L${f1(x2)} ${f1(yb)}L${f1(x2)} ${f1(yb + th)}L${f1(x1)} ${f1(ya + th)}Z" fill="currentColor"/>`;
      };
      beamSVG += bar(sx(a) - (up ? 1 : 1), sx(z) + 1, 0);
      // a triplet: its "3" centered on the beam's outer side
      if (a.ev.trip && run.every(pc => pc.ev.trip === a.ev.trip)) {
        const mx = (sx(a) + sx(z)) / 2, ty = at(mx) + (up ? -10 : 24);
        ext(ty - 16, ty + 2);
        beamSVG += `<text class="tuplet" x="${f1(mx)}" y="${f1(ty)}" text-anchor="middle" ${NUM_FONT} font-style="italic" font-weight="700" font-size="20" fill="currentColor">3</text>`;
      }
      // second (and third) beams: between neighbors that both have them, else a short stub
      for (let lv = 2; lv <= 3; lv++) {
        run.forEach((pc, i) => {
          if (pc.v.flags < lv) return;
          const nx = run[i + 1], pv = run[i - 1];
          if (nx && nx.v.flags >= lv) beamSVG += bar(sx(pc) - 1, sx(nx) + 1, (lv - 1) * 11);
          else if (!(pv && pv.v.flags >= lv)) beamSVG += nx ? bar(sx(pc) - 1, sx(pc) + 12, (lv - 1) * 11) : bar(sx(pc) - 12, sx(pc) + 1, (lv - 1) * 11);
        });
      }
    });

    const restCaps = [], arts = [];
    all.forEach(pc => {
      if (pc.rest) {
        rests += restSVG(pc);
        if (o.captions && pc.ev.label && pc.x != null && !restCaps.some(c => c.ev === pc.ev)) restCaps.push({ev: pc.ev, x: pc.x, label: pc.ev.label});
        return;
      }
      const g = grp(pc.ev), xx = pc.x, y = pc.y, v = pc.v, whole = v.head === 'whole';
      let s = '';
      if (!pc.tieFrom) s += `<ellipse class="halo" cx="${f1(xx)}" cy="${f1(y)}" rx="17" ry="13" fill="none" opacity="0"/>`;
      // ledger lines
      if (pitched) {
        const lw = whole ? 17 : 15;
        for (let ly = 136; ly <= y + EPS; ly += 16) s += `<line x1="${f1(xx - lw)}" y1="${ly}" x2="${f1(xx + lw)}" y2="${ly}" stroke="currentColor" stroke-width="1.6"/>`;
        for (let ly = 40; ly >= y - EPS; ly -= 16) s += `<line x1="${f1(xx - lw)}" y1="${ly}" x2="${f1(xx + lw)}" y2="${ly}" stroke="currentColor" stroke-width="1.6"/>`;
      }
      if (pc.acc != null) s += `<text class="head" x="${f1(xx - (pc.acc === 0 ? 27 : 31) - (whole ? 3 : 0))}" y="${f1(y + 6)}" ${MUSIC_FONT} font-size="54" fill="currentColor">${pc.acc < 0 ? '♭' : pc.acc > 0 ? '♯' : '♮'}</text>`;
      // the head
      if (v.head === 'fill') s += `<ellipse class="head" cx="${f1(xx)}" cy="${f1(y)}" rx="9" ry="6.6" transform="rotate(-20 ${f1(xx)} ${f1(y)})" fill="currentColor"/>`;
      else if (v.head === 'half') s += `<path class="head" fill-rule="evenodd" fill="currentColor" d="${ell(xx, y, 9.6, 6.9, -20)}${ell(xx, y, 7, 3.7, -32)}"/>`;
      else s += `<path class="head" fill-rule="evenodd" fill="currentColor" d="${ell(xx, y, 11.4, 7.2, 0)}${ell(xx, y, 5.4, 4, 58)}"/>`;
      // the dot: in the space (a note on a line puts it in the space above)
      if (v.dot) { const onLine = Math.abs(((y - 56) % 16 + 16) % 16) < EPS; s += `<circle class="head" cx="${f1(xx + (whole ? 19 : 16))}" cy="${f1(onLine ? y - 7 : y)}" r="2.8" fill="currentColor"/>`; }
      // the stem (+ its flags when not beamed)
      if (!whole) {
        const up = pc.up, sxx = xx + (up ? 8.3 : -8.3), d = up ? -1 : 1;
        let end;
        if (pc.beam) end = pc.beam.at(sxx);
        else {
          end = y + d * (52 + Math.max(0, v.flags - 1) * 8);
          end = up ? Math.min(end, MID) : Math.max(end, MID);
          if (!pitched) end = y - 52;
        }
        ext(end); pc.stemEnd = end;
        s += `<line class="stem" x1="${f1(sxx)}" y1="${f1(y + d * 2)}" x2="${f1(sxx)}" y2="${f1(end)}" stroke="currentColor" stroke-width="2.2"/>`;
        if (!pc.beam) for (let k = 0; k < v.flags; k++) {
          const yy = end - d * k * 9;
          s += up ? `<path class="head" fill="currentColor" d="M${f1(sxx)} ${f1(yy)}C${f1(sxx + 1)} ${f1(yy + 10)} ${f1(sxx + 15)} ${f1(yy + 13)} ${f1(sxx + 11)} ${f1(yy + 31)}C${f1(sxx + 12)} ${f1(yy + 20)} ${f1(sxx + 6)} ${f1(yy + 16)} ${f1(sxx)} ${f1(yy + 13)}Z"/>`
            : `<path class="head" fill="currentColor" d="M${f1(sxx)} ${f1(yy)}C${f1(sxx + 1)} ${f1(yy - 10)} ${f1(sxx + 15)} ${f1(yy - 13)} ${f1(sxx + 11)} ${f1(yy - 31)}C${f1(sxx + 12)} ${f1(yy - 20)} ${f1(sxx + 6)} ${f1(yy - 16)} ${f1(sxx)} ${f1(yy - 13)}Z"/>`;
        }
      } else ext(y - 10, y + 10);
      // ties (a tie that leaves this drawing, or comes into it, is drawn half-way)
      const side = (pc.tieFrom ? pc.tieFrom : pc).up ? 1 : -1;
      if (pc.tieNext) s += tieSVG(xx + 8, pc.tieNext.x != null ? pc.tieNext.x - 8 : xx + 34, y, side);
      if (pc.tieFrom && pc.tieFrom.x == null) s += tieSVG(Math.max(start - 4, xx - 34), xx - 8, y, side);
      if (pc.ev.tieIn && !pc.tieFrom) s += tieSVG(Math.max(start - 4, xx - 34), xx - 8, y, side);
      if (pc.ev.tieOut && !pc.tieNext) s += tieSVG(xx + 8, Math.min(W - 6, xx + 34), y, side);
      if (pc.ev.art && pc.ev.art.length && !pc.tieFrom) arts.push(pc);
      ext(y - 12, y + 12);
      g.a += s;
      if (!pc.tieFrom) { g.x = xx; if (o.captions && pc.ev.label) g.cap = {x: xx, label: pc.ev.label}; }
    });

    /* SLURS: one arc from the group's first notehead to its last, OPPOSITE THE STEMS (all stems up = under the heads,
       otherwise over them, clearing every head and up-stem in between); a slur that starts or ends outside this drawing
       (a row break) runs to the edge */
    let slurSVG = '';
    const bySlur = new Map();
    all.forEach(pc => { if (!pc.rest && pc.ev.slur != null && pc.x != null) { if (!bySlur.has(pc.ev.slur)) bySlur.set(pc.ev.slur, []); bySlur.get(pc.ev.slur).push(pc); } });
    bySlur.forEach(list => {
      list.sort((a, b) => a.x - b.x);
      const a = list[0], z = list[list.length - 1];
      const openL = !a.ev.slurFirst || a.tieFrom, openR = !z.ev.slurLast || z.tieNext;
      if (a === z && !openL && !openR) return;
      const below = list.every(pc => pc.up), side = below ? 1 : -1;
      const endY = pc => below ? pc.y + 11 : pc.up && pc.stemEnd != null ? pc.stemEnd - 6 : pc.y - 11;
      const endX = pc => !below && pc.up && pc.stemEnd != null ? pc.x + 8.3 : pc.x + (pc === a ? 2 : -2);
      const x1 = openL ? Math.max(start - 6, a.x - 30) : endX(a), x2 = openR ? Math.min(W - 6, z.x + 30) : endX(z);
      const y1 = endY(a), y2 = endY(z);
      const far = below ? Math.max(...list.map(pc => pc.up ? pc.y + 8 : (pc.stemEnd != null ? pc.stemEnd : pc.y + 8))) + 7
        : Math.min(...list.map(pc => pc.up && pc.stemEnd != null ? pc.stemEnd - 5 : pc.y - 8)) - 7;
      const mid = (y1 + y2) / 2, apex = below ? Math.max(far, mid + 9) : Math.min(far, mid - 9);
      const yc = (apex - .25 * mid) / .75, dx = (x2 - x1) * .25, yi = yc - side * 5;
      ext(apex, yc);
      slurSVG += `<path class="slur" fill="currentColor" d="M${f1(x1)} ${f1(y1)}C${f1(x1 + dx)} ${f1(yc)} ${f1(x2 - dx)} ${f1(yc)} ${f1(x2)} ${f1(y2)}C${f1(x2 - dx)} ${f1(yi)} ${f1(x1 + dx)} ${f1(yi)} ${f1(x1)} ${f1(y1)}Z"/>`;
    });

    /* ARTICULATIONS: on the head's side away from the stem (a whole note: as if its stem were up), staccato and tenuto
       nearest the head, the accent outside them */
    let artSVG = '';
    arts.forEach(pc => {
      const below = !pitched || pc.up || pc.v.head === 'whole' && pc.y > MID, d = below ? 1 : -1;
      let yy = pc.y + d * 15;
      if (pitched && yy > 56 && yy < 120 && Math.abs(((yy - 56) % 16 + 16) % 16) < 3) yy += d * 4;   // off a staff line
      const xx = pc.x;
      ['stac', 'ten', 'acc'].filter(k => pc.ev.art.includes(k)).forEach(k => {
        if (k === 'stac') artSVG += `<circle class="art art-stac" cx="${f1(xx)}" cy="${f1(yy)}" r="3.2" fill="currentColor"/>`;
        else if (k === 'ten') artSVG += `<rect class="art art-ten" x="${f1(xx - 9)}" y="${f1(yy - 1.4)}" width="18" height="2.8" fill="currentColor"/>`;
        else artSVG += `<path class="art art-acc" d="M${f1(xx - 10)} ${f1(yy - 6)}L${f1(xx + 10)} ${f1(yy)}L${f1(xx - 10)} ${f1(yy + 6)}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="miter"/>`;
        ext(yy - 7, yy + 7);
        yy += d * (k === 'acc' ? 16 : 11);
      });
    });
    /* DYNAMICS and HAIRPINS: one row under the staff (below the lowest note or mark) */
    let dynSVG = '';
    const dynEvs = all.filter(pc => !pc.tieFrom && pc.x != null && (pc.ev.dyn || pc.ev.hair || pc.ev.hairEnd)).filter((pc, i, a) => a.findIndex(x => x.ev === pc.ev) === i);
    if (dynEvs.length) {
      const dy = Math.max(146, maxY + 8) + 22;
      const DYN_FONT = `font-family='Georgia,"Times New Roman",serif' font-style="italic" font-weight="700"`;
      dynEvs.forEach((pc, i) => {
        if (pc.ev.dyn) dynSVG += `<text class="dyn" x="${f1(pc.x - 4)}" y="${f1(dy + 8)}" text-anchor="middle" ${DYN_FONT} font-size="26" fill="currentColor">${pc.ev.dyn}</text>`;
        if (!pc.ev.hair) return;
        const end = dynEvs.slice(i + 1).find(x => x.ev.hairEnd);
        const x1 = pc.x + (pc.ev.dyn ? 18 : -2), x2 = end ? end.x - (end.ev.dyn ? 22 : 6) : W - 12;
        if (x2 - x1 < 16) return;
        const open = 8, cy = dy;
        dynSVG += pc.ev.hair === 'cresc'
          ? `<path class="hairpin cresc" d="M${f1(x2)} ${f1(cy - open)}L${f1(x1)} ${f1(cy)}L${f1(x2)} ${f1(cy + open)}" fill="none" stroke="currentColor" stroke-width="2"/>`
          : `<path class="hairpin dim" d="M${f1(x1)} ${f1(cy - open)}L${f1(x2)} ${f1(cy)}L${f1(x1)} ${f1(cy + open)}" fill="none" stroke="currentColor" stroke-width="2"/>`;
      });
      ext(dy - 22, dy + 14);
    }

    const top = Math.floor(Math.min(28, minY - 8)), bot0 = Math.ceil(Math.max(o.minBottom || 146, maxY + 8));
    const bot = bot0 + (o.captions ? 30 : 0), capY = bot - 10;
    let notesSVG = '';
    groups.forEach((g, e) => {
      notesSVG += `<g${e.id ? ` id="${e.id}"` : ''} data-x="${f1(g.x)}">${g.a}${g.cap ? `<text class="ncap" x="${f1(g.cap.x)}" y="${capY}" text-anchor="middle" ${TEXT_FONT} font-weight="700" font-size="15" fill="currentColor" fill-opacity=".72">${g.cap.label}</text>` : ''}</g>`;
    });
    restCaps.forEach(c => { notesSVG += `<text class="ncap ncap-rest" x="${f1(c.x)}" y="${capY}" text-anchor="middle" ${TEXT_FONT} font-weight="700" font-size="15" fill="currentColor" fill-opacity=".72">${c.label}</text>`; });
    const svg = `<svg class="staff mh-staffsvg" viewBox="0 ${top} ${f1(W)} ${bot - top}" style="color:var(--ink)" role="img" aria-label="${o.label || 'The song on the staff'}">` +
      lines + head + rests + beamSVG + notesSVG + slurSVG + artSVG + dynSVG + `</svg>`;
    return {svg, vb: {top, h: bot - top, w: W}, xAt, points: pts, bars, shortest, pieces: all.length,
      // tests: every piece as written ({t (beats), b (its value), rest, dot, tie (into the next piece)}) and the beamed groups
      layout: () => ({pieces: all.map(pc => ({t: q(pc.m * per + pc.p), b: pc.v.b, rest: !!pc.rest, full: !!pc.full, dot: !!pc.v.dot, tie: !!pc.tieNext})),
        beams: beams.map(B => B.notes.map(pc => q(pc.m * per + pc.p)))})};
  }

  /* the clef + key signature at the start of a row */
  function clefSVG(clef, sig) {
    if (!clef) return `<rect x="14" y="74" width="5" height="28" fill="currentColor"/><rect x="23" y="74" width="5" height="28" fill="currentColor"/>`;
    return (clef === 'treble' ? `<text x="14" y="119" ${MUSIC_FONT} font-size="64" fill="currentColor">𝄞</text>` : `<text x="16" y="111" ${MUSIC_FONT} font-size="62" fill="currentColor">𝄢</text>`) +
      A.keySigSVG(clef, sig).replace(/fill="[^"]*"/g, 'fill="currentColor"');
  }
  function timeSVG(ts, x, pitched) {
    if (ts[0] === 2 && ts[1] === 2) {                      // CUT TIME: a C with a vertical line through it (drawn, no font glyph)
      const cx = x + 2, r = 14;
      return `<g class="cut-time"><path d="M${f1(cx + r * .8)} ${f1(MID - r * .62)}A${r} ${r} 0 1 0 ${f1(cx + r * .8)} ${f1(MID + r * .62)}" fill="none" stroke="currentColor" stroke-width="5.2" stroke-linecap="round"/>` +
        `<line x1="${f1(cx)}" y1="${MID - 26}" x2="${f1(cx)}" y2="${MID + 26}" stroke="currentColor" stroke-width="3"/></g>`;
    }
    const t = (y, v) => `<text x="${f1(x)}" y="${y}" text-anchor="middle" ${NUM_FONT} font-weight="900" font-size="41" fill="currentColor">${v}</text>`;
    return pitched ? t(86, ts[0]) + t(118, ts[1]) : t(84, ts[0]) + t(118, ts[1]);
  }
  function tieSVG(x1, x2, y, side) {
    if (x2 - x1 < 6) x2 = x1 + 6;
    const ys = y + side * 8, yc = y + side * 19, mx = (x1 + x2) / 2;
    return `<path class="tie" fill="currentColor" d="M${f1(x1)} ${f1(ys)}Q${f1(mx)} ${f1(yc)} ${f1(x2)} ${f1(ys)}Q${f1(mx)} ${f1(yc - side * 3.4)} ${f1(x1)} ${f1(ys)}Z"/>`;
  }
  /* rests, centered on the middle of the staff */
  function restSVG(pc) {
    const x = pc.x, v = pc.v;
    let s = '';
    if (pc.full || v.b >= 4) s = `<rect x="${f1(x - 10)}" y="72" width="20" height="8" fill="currentColor"/>`;
    else if (v.b >= 2) s = `<rect x="${f1(x - 10)}" y="80" width="20" height="8" fill="currentColor"/>`;
    else if (v.b >= 1) s = `<path d="M${f1(x - 3)} 67L${f1(x + 5)} 78L${f1(x - 3)} 89L${f1(x + 5)} 100C${f1(x - 4)} 95 ${f1(x - 7)} 104 ${f1(x + 1)} 110" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" stroke-linejoin="round"/>`;
    else {
      const n = v.b >= .5 ? 1 : v.b >= .25 ? 2 : 3, bot = 104 + (n - 1) * 8;
      s = `<path d="M${f1(x + 6)} 76L${f1(x - 3)} ${bot}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`;
      for (let k = 0; k < n; k++) {
        const cy = 80 + k * 12, ex = x + 6 - 9 * ((cy - 4 - 76) / (bot - 76));
        s += `<circle cx="${f1(x - 4 - k * 2.4)}" cy="${cy}" r="3.6" fill="currentColor"/><path d="M${f1(x - 4 - k * 2.4)} ${cy + 3}Q${f1(x + 1 - k * 2)} ${cy + 5} ${f1(ex)} ${cy - 3}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`;
      }
    }
    if (v.dot) s += `<circle cx="${f1(x + 14)}" cy="80" r="2.8" fill="currentColor"/>`;
    return `<g class="rest">${s}</g>`;
  }

  /** the fixed clef + key signature on the left of the scrolling staff (same top and height as the strip) */
  function pinSVG({clef, sig, top, h}) {
    const w = clef ? 50 + A.keySigWidth(sig) + 6 : 40;
    const lines = clef ? [0, 1, 2, 3, 4].map(i => `<line x1="0" y1="${56 + i * 16}" x2="${w}" y2="${56 + i * 16}" stroke="currentColor" stroke-width="1.6"/>`).join('')
      : `<line x1="0" y1="${MID}" x2="${w}" y2="${MID}" stroke="currentColor" stroke-width="1.6"/>`;
    return {w, svg: `<svg viewBox="0 ${top} ${w} ${h}" style="color:var(--ink)" aria-hidden="true">${lines}${clefSVG(clef, sig)}</svg>`};
  }

  /** a smooth, never-backwards curve through the points (Fritsch–Carlson monotone cubic); straight lines outside them */
  function monotone(pts) {
    const n = pts.length, T = pts.map(p => p.t), X = pts.map(p => p.x);
    if (n < 2) return () => X[0] || 0;
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d[i] = (X[i + 1] - X[i]) / (T[i + 1] - T[i]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return t => {
      if (t <= T[0]) return X[0] + (t - T[0]) * d[0];
      if (t >= T[n - 1]) return X[n - 1] + (t - T[n - 1]) * d[n - 2];
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (T[mid] <= t) lo = mid; else hi = mid; }
      const h = T[hi] - T[lo], s = (t - T[lo]) / h, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * X[lo] + (s3 - 2 * s2 + s) * h * m[lo] + (-2 * s3 + 3 * s2) * X[hi] + (s3 - s2) * h * m[hi];
    };
  }

  A.Notation = A.MHNotation = {engrave, pinSVG, split, VALUES, monotone};
})(window.Arcade);
