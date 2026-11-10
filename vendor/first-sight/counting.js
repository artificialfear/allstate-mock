/* THE COUNTING (Mr. Graham's counting system), shared by any game that shows rhythms: Rhythm Dojo today.
   Plain data in, plain data out (no DOM): shared/rhythm-staff.js draws it under a one-line staff.

   RHYTHMS AS TEXT (what levels.js and the Counting Board write):
     values   w (whole) · h (half) · q (quarter) · e (eighth) · s (sixteenth), then . for a dot (q. = dotted quarter)
     rests    the same + r: qr, hr, er, sr, wr, h.r (a dotted half rest)
     ties     _ after a note ties it to the next note: h_ | q  (within a measure or across a bar line)
     triplets [e e e] = three eighths in the time of two (also [q e], [e er e], [e q])
     bars     | between measures (checked: every measure must add up to the time signature)
     example  '4/4' + 'q. e q qr | h h'
   RUDIMENT NOTATION (all optional: a rhythm without it parses exactly as before). One token, in this order:
       {graces} value dots rest roll accent HAND tie          e.g. {L}e>R · {RR}eL · s/R · ezL · s>R · hR_
     HAND     R or L at the end of a note (uppercase: never a value)        accent  > (s>R)
     graces   {L} = one grace note (a flam), {RR} = two (a drag): each letter a grace's hand, in playing order. They take
              NO time: no ticks, no counting syllable, not in the bar's total
     roll     / = a double stroke (two equal strokes, same hand, half the value each: s/R = R R as two 32nds);
              // and /// are parsed and drawn, but have NO stroke meaning yet (strokes() treats them like /)
     buzz     z = a buzz (multiple bounce) stroke: one hand, not countable
     errors   {X} (not R/L), a lone {L}, z with /, more than ///, and graces / a hand / an accent / a roll / a buzz on a rest
   Times: '4/4', '3/4', '2/4', '6/8'. Everything is counted in TICKS: a quarter = 12 (an eighth 6, a sixteenth 3, a
   triplet eighth 4), so 6/8's eighth-note beat = 6 ticks.

   THE SYLLABLES
     quarters   1 2 3 4               eighths    1 & 2 & 3 & 4 &
     sixteenths 1 e & a 2 e & a …     triplets   1 la le 2 la le …
     3/4 and 2/4: the same with fewer beats.
     6/8: the EIGHTH gets the beat, counted 1 2 3 4 5 6; sixteenths in 6/8 are 1 & 2 & 3 & 4 & 5 & 6 &.

   THE RULE: every note's STARTING syllable full size, then SMALL raised syllables (like exponents) for every grid point it
   is held through, strictly between its start and its end; only the small ones are underlined (one line under the
   group). The grid for a note's small syllables = the COARSEST grid (quarter → eighth → sixteenth; the triplet grid for
   triplet rhythms) on which both its start and its end fall. A TIE chain is ONE note (it keeps counting across the bar
   line in the next measure's syllables). A REST is counted the same way, the whole group in parentheses: (2), (3⁴), (&).

     Arcade.Counting.parse(text, time)  -> {time, meter, notes, measures, total, errors}
         notes: [{i, t, d, rest, tie, dots, val, trip, measure, hand, accent, graces, roll, buzz}] (t/d in ticks; trip =
         the triplet group's number; hand 'R' | 'L' | null, graces ['L'] / ['R','R'] / [], roll 0–3 slashes)
     Arcade.Counting.strokes(parsed, {rolls}) -> [{n, s, t, hand, accent, grace, buzz}] every stroke in playing order:
         graces s = -2, -1 (t = their note's t), the note s = 0, a / roll's second stroke s = 1 at t + d/2 (may be a
         fraction of a tick: s/R's second stroke is at 1.5); rests and tied-into notes are not struck; the same for
         rolls 'slash' and 'written'. No milliseconds, no audio.
     Arcade.Counting.groups(parsed)     -> [{g, notes: [i…], t, end, rest, big, bigT, small: [{text, t}], grid}]
     Arcade.Counting.syllable(t, meter) -> '1' | '&' | 'e' | 'a' | 'la' | 'le'
     Arcade.Counting.text(groups)       -> '1^(& 2) & (3^(4))'  (plain text: ^( ) = the small, underlined syllables)
     Arcade.Counting.meter(time)        -> {num, den, beat, per, grids, tpq}
     Arcade.Counting.TPQ = 12 (kept: the drawn SVG's data-t and three games' timing read ticks as 12 a quarter; written-out
     32nds are drawn by rhythm-staff.js alone, at half-tick positions) */
window.Arcade = window.Arcade || {};
(function (A) {
  'use strict';
  const TPQ = 12;
  const VAL = {w: 48, h: 24, q: 12, e: 6, s: 3};

  function meter(time) {
    const [num, den] = String(time || '4/4').split('/').map(Number);
    const compound = den === 8;
    const beat = compound ? 6 : 12;                         // 6/8: the eighth note gets the beat
    return {time: `${num}/${den}`, num, den, beat, per: num * (den === 8 ? 6 : 12), compound,
      grids: compound ? [6, 3] : [12, 6, 4, 3], tpq: TPQ};
  }

  /* one token: 'q', 'q.', 'qr', 'h.r', 'e_', 'q._'; RUDIMENT NOTATION adds {graces} before and roll, accent, HAND after:
     '{L}e>R', '{RR}eL', 's/R', 'ezL', 'sR_' (the order: {graces} value dots rest roll accent HAND tie) */
  const TOK = /^(?:\{([^}]*)\})?([whqes])(\.{0,2})(r?)([/z]*)(>?)([RL]?)(_?)$/;
  function parse(text, time) {
    const M = meter(time), notes = [], errors = [];
    let t = 0, trip = 0, inTrip = false, measure = 0, barAt = 0;
    const src = String(text).replace(/\[/g, ' [ ').replace(/\]/g, ' ] ').replace(/\|/g, ' | ').trim().split(/\s+/).filter(Boolean);
    const bar = () => {
      if (t - barAt !== M.per) errors.push(`Measure ${measure + 1} has ${(t - barAt) / TPQ} quarter notes' worth, not ${M.per / TPQ}.`);
      measure++; barAt = t;
    };
    for (const tok of src) {
      if (tok === '[') { inTrip = true; trip++; continue; }
      if (tok === ']') { inTrip = false; continue; }
      if (tok === '|') { bar(); continue; }
      const m = TOK.exec(tok);
      if (!m) {
        errors.push(/^\{[^}]*\}$/.test(tok) ? `"${tok}": a grace note goes right before its note, with no space: {L}eR.` : `I can't read "${tok}".`);
        continue;
      }
      let d = VAL[m[2]], add = d / 2;
      for (let k = 0; k < m[3].length; k++) { d += add; add /= 2; }
      if (inTrip) d = d * 2 / 3;
      if (d !== Math.round(d)) { errors.push(`"${tok}" doesn't fit the tick grid.`); d = Math.round(d); }
      const rest = !!m[4], mk = m[5];
      let graces = m[1] == null ? [] : m[1].split(''), roll = (mk.match(/\//g) || []).length, buzz = /z/.test(mk), accent = !!m[6], hand = m[7] || null;
      if (m[1] != null && (!graces.length || graces.some(g => g !== 'R' && g !== 'L'))) { errors.push(`"${tok}": grace notes are R or L, like {L}eR or {RR}eL.`); graces = []; }
      if (buzz && roll) { errors.push(`"${tok}": a note is a buzz (z) or a roll (/), not both.`); roll = 0; }
      if ((mk.match(/z/g) || []).length > 1) errors.push(`"${tok}": one z is a buzz.`);
      if (roll > 3) { errors.push(`"${tok}": a roll has at most three slashes (///).`); roll = 3; }
      if (rest) {
        if (graces.length) errors.push(`"${tok}": a rest can't have grace notes.`);
        if (hand) errors.push(`"${tok}": a rest has no hand (R or L).`);
        if (accent) errors.push(`"${tok}": a rest can't be accented.`);
        if (roll || buzz) errors.push(`"${tok}": a rest can't be a roll (/) or a buzz (z).`);
        graces = []; hand = null; accent = false; roll = 0; buzz = false;
      }
      notes.push({i: notes.length, t, d, rest, tie: !!m[8] && !rest, dots: m[3].length, val: m[2], trip: inTrip ? trip : 0, measure,
        hand, accent, graces, roll, buzz});
      t += d;
    }
    if (t > barAt) bar();
    // a tie must lead to a note
    notes.forEach((n, k) => { if (n.tie && (!notes[k + 1] || notes[k + 1].rest)) { n.tie = false; errors.push(`Note ${k + 1} is tied to nothing.`); } });
    return {time: M.time, meter: M, notes, measures: measure, total: t, errors};
  }

  const NAMES4 = {0: null, 6: '&', 3: 'e', 9: 'a', 4: 'la', 8: 'le'};
  const NAMES8 = {0: null, 3: '&'};
  function syllable(t, M) {
    const r = ((t % M.per) + M.per) % M.per, beat = Math.floor(r / M.beat) + 1, w = r % M.beat;
    const n = (M.compound ? NAMES8 : NAMES4)[w];
    return n === undefined ? '·' : n === null ? String(beat) : n;
  }
  /* the coarsest grid both ends fall on */
  function gridFor(t, end, M) {
    for (const g of M.grids) if (t % g === 0 && end % g === 0) return g;
    return M.grids[M.grids.length - 1];
  }

  function groups(p) {
    const M = p.meter, out = [];
    for (let k = 0; k < p.notes.length; k++) {
      const first = p.notes[k], ids = [k];
      let end = first.t + first.d;
      while (!first.rest && p.notes[ids[ids.length - 1]].tie && p.notes[ids[ids.length - 1] + 1]) {
        const nx = p.notes[ids[ids.length - 1] + 1]; ids.push(nx.i); end = nx.t + nx.d;
      }
      const grid = gridFor(first.t, end, M), small = [];
      for (let x = first.t + grid; x < end; x += grid) small.push({text: syllable(x, M), t: x});
      out.push({g: out.length, notes: ids, t: first.t, end, rest: first.rest, big: syllable(first.t, M), bigT: first.t, small, grid});
      k = ids[ids.length - 1];
    }
    return out;
  }

  const one = g => g.big + (g.small.length ? `^(${g.small.map(s => s.text).join(' ')})` : '');
  const text = gs => gs.map(g => g.rest ? `(${one(g)})` : one(g)).join(' ');

  /* every STROKE in playing order (a rudiment's sticking, for the rudiment player): graces first (s = -2, -1: the
     grace's place before its note, t = the note's t), then the note (s = 0); a roll's slash = a double stroke: s = 0 at t
     and s = 1 at t + d/2, same hand (// and /// the same, for now); a buzz (z) = one stroke, buzz: true. Rests and the
     tied-into notes of a tie chain are not struck. `rolls` ('slash' | 'written') changes only the drawing: the same
     strokes either way. */
  function strokes(p, o = {}) {
    const out = [];
    p.notes.forEach((n, k) => {
      if (n.rest || (k && p.notes[k - 1].tie)) return;
      const g = n.graces || [];
      g.forEach((h, j) => out.push({n: n.i, s: j - g.length, t: n.t, hand: h, accent: false, grace: true, buzz: false}));
      out.push({n: n.i, s: 0, t: n.t, hand: n.hand || null, accent: !!n.accent, grace: false, buzz: !!n.buzz});
      if (n.roll && !n.buzz) out.push({n: n.i, s: 1, t: n.t + n.d / 2, hand: n.hand || null, accent: false, grace: false, buzz: false});
    });
    return out;
  }

  A.Counting = {TPQ, VAL, meter, parse, groups, syllable, gridFor, text, strokes,
    /** a rhythm's notes to attack: every non-rest group = one attack {t, end, g} */
    attacks: gs => gs.filter(g => !g.rest).map(g => ({t: g.t, end: g.end, g: g.g}))};
})(window.Arcade);
