/* Band Arcade — drawing helpers: staff notation, the ghost mascot, stars, top bar. */
window.Arcade = window.Arcade || {};
(function (A) {
  "use strict";
  const {noteLabel, stepOf} = A.music;
  const INK = '#18203a';
  const MUSIC_FONT = `font-family='"GN Music","Noto Music",serif'`;

  A.$ = id => document.getElementById(id);
  /** lock the page's own scrolling while an overlay that scrolls by itself is open (Button Masher's chart…), and put
      it back exactly (same scroll position) when it closes. Works on iPad Safari too (body pinned with position: fixed). */
  let locked = null;
  A.lockScroll = function (on) {
    const b = document.body;
    if (on && !locked) {
      locked = {y: scrollY, style: b.getAttribute('style')};
      Object.assign(b.style, {position: 'fixed', top: -locked.y + 'px', left: '0', right: '0', overflow: 'hidden'});
    } else if (!on && locked) {
      const l = locked; locked = null;
      if (l.style == null) b.removeAttribute('style'); else b.setAttribute('style', l.style);
      scrollTo(0, l.y);
    }
  };

  /* ---------- staff ----------
     Lines at y = 56..120 (16px per space). One diatonic step = 8px.
     items: [{n, x, id?, color?, caption?}]   (n.natural: draw a natural sign, for a note the key signature would change)
     opts:  {label, fit: notes[] to size the drawing for (default: items), width, keySig: {type: '#'|'b', count},
             sigStyle: 'big' (the Note Checker: the key signature further from the clef, larger ♯/♭),
             box: [top, height] (the drawing's own vertical window instead of the one fit gives; Keys to the City),
             extra: SVG drawn last (Scale Trainer: beams, bar lines, the time signature),
             capY: the captions' baseline (default: the bottom of the drawing)}
     With a key signature, start the notes keySigWidth(sig, sigStyle) further right so nothing collides. */
  const STAFF_BOTTOM = 120, MID_LINE = 88;
  function noteY(clef, n) {
    const base = clef === 'treble' ? 30 /* E4 */ : 18 /* G2 */;
    return STAFF_BOTTOM - (stepOf(n) - base) * 8;
  }
  A.noteY = noteY;
  /* one note (ledger lines, accidental, head, stem, optional caption at capY) at it.x.
     staffSVG uses it; games that move notes on their own layer can use it too.
     Optional (Scale Trainer's rhythm picture): it.whole = an open head with no stem; it.stemUp = force the stem's
     side (default: up below the middle line); it.stemTo = where the stem ends (y), so stems meet a beam. */
  A.noteGlyph = function (clef, it, capY) {
    const x = it.x, y = noteY(clef, it.n), col = it.color || INK;
    let g = '';
    for (let ly = 136; ly <= y; ly += 16) g += `<line x1="${x - 15}" y1="${ly}" x2="${x + 15}" y2="${ly}" stroke="${INK}" stroke-width="1.6"/>`;
    for (let ly = 40; ly >= y; ly -= 16)  g += `<line x1="${x - 15}" y1="${ly}" x2="${x + 15}" y2="${ly}" stroke="${INK}" stroke-width="1.6"/>`;
    if (it.n.acc) g += `<text class="head" x="${x - 31}" y="${y + 6}" ${MUSIC_FONT} font-size="54" fill="${col}">${it.n.acc < 0 ? '♭' : '♯'}</text>`;
    else if (it.n.natural) g += `<text class="head" x="${x - 27}" y="${y + 6}" ${MUSIC_FONT} font-size="54" fill="${col}">♮</text>`;
    if (it.whole) g += `<ellipse class="head whole" cx="${x}" cy="${y}" rx="10.5" ry="7" transform="rotate(-20 ${x} ${y})" fill="none" stroke="${col}" stroke-width="3.2"/>`;
    else g += `<ellipse class="head" cx="${x}" cy="${y}" rx="9" ry="6.6" transform="rotate(-20 ${x} ${y})" fill="${col}"/>`;
    const up = it.stemUp != null ? it.stemUp : y > MID_LINE;
    if (!it.whole) g += up
      ? `<line class="stem" x1="${x + 8.3}" y1="${y - 2}" x2="${x + 8.3}" y2="${it.stemTo != null ? it.stemTo : y - 52}" stroke="${col}" stroke-width="2"/>`
      : `<line class="stem" x1="${x - 8.3}" y1="${y + 2}" x2="${x - 8.3}" y2="${it.stemTo != null ? it.stemTo : y + 52}" stroke="${col}" stroke-width="2"/>`;
    if (it.caption && capY) g += `<text class="ncap" x="${x}" y="${capY}" text-anchor="middle" font-family='"GN Text",system-ui,sans-serif' font-weight="700" font-size="15" fill="#4b5570">${it.caption}</text>`;
    return g;
  };
  /* ---------- key signatures: the standard positions (sharps F C G D A E B, flats B E A D G C F) ---------- */
  const SIG_STEPS = {
    treble: {'#': ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'], b: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4']},
    bass:   {'#': ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'], b: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2']},
  };
  const SIG_X = {treble: 54, bass: 60}, SIG_GAP = 12;
  // sizes of a key signature: normal (every game) and 'big' (the Note Checker: more room after the clef, larger signs)
  const SIG_STYLES = {normal: {dx: 0, size: 48, gap: SIG_GAP, dy: 5, after: 14}, big: {dx: 14, size: 62, gap: 17, dy: 6.5, after: 26}};
  const sigStyle = st => SIG_STYLES[st] || SIG_STYLES.normal;
  /** extra room a key signature takes after the clef (add it to the first note's x) */
  A.keySigWidth = (sig, style) => { const S = sigStyle(style); return sig && sig.count ? S.dx + S.after + sig.count * S.gap : 0; };
  function keySigSVG(clef, sig, style) {
    if (!sig || !sig.count) return '';
    const S = sigStyle(style);
    return SIG_STEPS[clef][sig.type].slice(0, sig.count).map((nm, i) =>
      `<text class="ksig" x="${SIG_X[clef] + S.dx + i * S.gap}" y="${noteY(clef, A.music.parseNote(nm)) + S.dy}" ${MUSIC_FONT} font-size="${S.size}" fill="${INK}">${sig.type === 'b' ? '♭' : '♯'}</text>`).join('');
  }
  A.keySigSVG = keySigSVG;

  /* opts.captions: leave room for captions even when no item has one yet (for notes drawn on another layer) */
  A.staffSVG = function (clef, items, opts = {}) {
    const W = opts.width || 400;
    const ys = (opts.fit || items.map(i => i.n)).map(n => noteY(clef, n));
    const hasCap = opts.captions || items.some(i => i.caption);
    const top = opts.box ? opts.box[0] : Math.min(30, Math.min(...ys.map(y => y > MID_LINE ? y - 60 : y - 14)));
    const bot = opts.box ? opts.box[0] + opts.box[1] : Math.max(146, Math.max(...ys.map(y => y > MID_LINE ? y + 14 : y + 60))) + (hasCap ? 34 : 6);
    const capY = opts.capY || bot - 10;
    let s = `<svg class="staff" viewBox="0 ${top} ${W} ${bot - top}" role="img" aria-label="${opts.label || 'Music staff'}">`;
    for (let i = 0; i < 5; i++) {
      const y = 56 + i * 16;
      s += `<line x1="8" y1="${y}" x2="${W - 8}" y2="${y}" stroke="${INK}" stroke-width="1.6"/>`;
    }
    s += clef === 'treble'
      ? `<text x="14" y="119" ${MUSIC_FONT} font-size="64" fill="${INK}">𝄞</text>`
      : `<text x="16" y="111" ${MUSIC_FONT} font-size="62" fill="${INK}">𝄢</text>`;
    s += keySigSVG(clef, opts.keySig, opts.sigStyle);
    items.forEach(it => { s += `<g${it.id ? ` id="${it.id}"` : ''}>${A.noteGlyph(clef, it, capY)}</g>`; });
    return s + (opts.extra || '') + `</svg>`;
  };
  /* ---------- music symbols for vocabulary games (Ancient Ninja Scrolls) ----------
     Each is drawn on a short staff so it looks the way it does in a part. */
  const SYMBOLS = {
    'treble-clef':    {name: 'Treble clef', svg: `<text x="46" y="119" ${MUSIC_FONT} font-size="64" fill="${INK}">𝄞</text>`},
    'bass-clef':      {name: 'Bass clef', svg: `<text x="46" y="111" ${MUSIC_FONT} font-size="62" fill="${INK}">𝄢</text>`},
    'fermata':        {name: 'Fermata', svg: note(80, true) + `<path d="M52 42A18 18 0 0 1 88 42H84.6A14.6 13 0 0 0 55.4 42Z" fill="${INK}"/><circle cx="70" cy="37" r="3.4" fill="${INK}"/>`},
    'accent':         {name: 'Accent', svg: note(80, true) + `<path d="M56 32L84 40L56 48" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linejoin="miter"/>`},
    'repeat':         {name: 'Repeat sign', svg:
      `<rect x="14" y="56" width="6" height="64" fill="${INK}"/><line x1="25" y1="56" x2="25" y2="120" stroke="${INK}" stroke-width="1.8"/>` +
      `<circle cx="33" cy="80" r="3.6" fill="${INK}"/><circle cx="33" cy="96" r="3.6" fill="${INK}"/>` +
      `<circle cx="107" cy="80" r="3.6" fill="${INK}"/><circle cx="107" cy="96" r="3.6" fill="${INK}"/>` +
      `<line x1="115" y1="56" x2="115" y2="120" stroke="${INK}" stroke-width="1.8"/><rect x="120" y="56" width="6" height="64" fill="${INK}"/>`},
    'measure-repeat': {name: 'Measure repeat sign', svg:
      `<line x1="12" y1="56" x2="12" y2="120" stroke="${INK}" stroke-width="1.8"/><line x1="128" y1="56" x2="128" y2="120" stroke="${INK}" stroke-width="1.8"/>` +
      `<path d="M56 106L78 70H86L64 106Z" fill="${INK}"/><circle cx="60" cy="78" r="4" fill="${INK}"/><circle cx="82" cy="98" r="4" fill="${INK}"/>`},
  };
  function note(y, stemDown) {         // a quarter note at x = 70 for symbols that sit on a note
    return `<ellipse cx="70" cy="${y}" rx="9" ry="6.6" transform="rotate(-20 70 ${y})" fill="${INK}"/>` +
      (stemDown ? `<line x1="61.7" y1="${y + 2}" x2="61.7" y2="${y + 52}" stroke="${INK}" stroke-width="2"/>` : '');
  }
  A.SYMBOL_IDS = Object.keys(SYMBOLS);
  A.symbolName = id => (SYMBOLS[id] || {}).name || id;
  /** one symbol on a short staff (viewBox 140 × 130), for answer buttons and prompts */
  A.symbolSVG = function (id, label) {
    const sym = SYMBOLS[id]; if (!sym) return '';
    let s = `<svg class="symbol" viewBox="0 20 140 130" role="img" aria-label="${label || sym.name}">`;
    for (let i = 0; i < 5; i++) s += `<line x1="6" y1="${56 + i * 16}" x2="134" y2="${56 + i * 16}" stroke="${INK}" stroke-width="1.6"/>`;
    return s + sym.svg + `</svg>`;
  };

  /** five notes spread across a staff, labeled (used by hub cards and the Note Checker) */
  A.fiveNoteStaff = function (inst, colorFor) {
    const xs = [120, 175, 230, 285, 340];
    return A.staffSVG(inst.clef, inst.notes.map((n, i) => ({
      n, x: xs[i], id: 'five' + i, caption: noteLabel(n), color: colorFor ? colorFor(i) : undefined
    })), {label: 'Your five notes: ' + inst.notes.map(noteLabel).join(', ')});
  };
  A.colorNote = function (gid, col) {
    const g = document.getElementById(gid); if (!g) return;
    g.querySelectorAll('.head').forEach(e => e.setAttribute('fill', col));
    g.querySelectorAll('.stem').forEach(e => e.setAttribute('stroke', col));
  };

  /* ---------- ghost mascot ---------- */
  A.ghostSVG = function (text = '', cls = 'bob') {
    const ey = text ? 32 : 40, er = text ? 4 : 6;
    return `<svg class="ghost ${cls}" viewBox="0 0 80 100" aria-hidden="true">` +
      `<path class="g-body" d="M4 44C4 22 20 4 40 4S76 22 76 44V88Q70 98 64 88T52 88T40 88T28 88T16 88T4 88Z"/>` +
      `<circle class="g-eye" cx="29" cy="${ey}" r="${er}"/><circle class="g-eye" cx="51" cy="${ey}" r="${er}"/>` +
      (text ? `<text x="40" y="74" text-anchor="middle" class="g-text">${text}</text>` : '') + `</svg>`;
  };

  /** faint letter names just after the clef, for reading practice (Note Ninja's White/Yellow belts, Dojo Duel):
      the lines in one column, the spaces in the next (treble lines E G B D F, spaces F A C E; bass lines G B D F A,
      spaces A C E G). Returns an SVG <g> to put inside a staffSVG; x = the lines' column, alpha = how faint. */
  A.staffGuides = function (clef, x, alpha) {
    const names = clef === 'treble' ? ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'] : ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'];
    return `<g class="guides" opacity="${alpha}">` + names.map((nm, i) => {
      const n = A.music.parseNote(nm), onLine = i % 2 === 0;
      return `<text x="${x + (onLine ? 0 : 14)}" y="${A.noteY(clef, n) + 4.5}" text-anchor="middle" font-family='"GN Text",system-ui,sans-serif' font-weight="700" font-size="12.5" fill="#4b5570">${n.letter}</text>`;
    }).join('') + `</g>`;
  };

  /* THE SENSEI (Band Ninja world: Ancient Ninja Scrolls, Dojo Duel): an original, kind old teacher (topknot, round
     glasses, long beard, indigo robe). mood: 'calm' | 'happy' | 'hmm' | 'present' (holding a scroll); belt = a --belt-* token.
     Styles: .ss-* in theme.css. */
  /* the Sensei (Ancient Ninja Scrolls, Dojo Duel, Note Ninja). Moods: 'calm' | 'happy' | 'hmm' | 'present' (a scroll),
     and Note Ninja's two SWORD POSES (a wooden practice sword, a bokken, light wood): 'ready' (held calmly, point up
     to his right = your left) and 'strike' (mid-swing toward your left, a pale swoosh behind it). Parts: .ss-sword. */
  A.senseiSVG = function (mood = 'calm', belt = 'belt-black') {
    const happy = mood === 'happy' || mood === 'present';
    const eyes = happy
      ? '<path class="ss-line" d="M47 53q4-4 8 0M65 53q4-4 8 0"/>'
      : '<circle class="ss-ink" cx="51" cy="53" r="2.2"/><circle class="ss-ink" cx="69" cy="53" r="2.2"/>';
    const brows = mood === 'hmm'
      ? '<path class="ss-brow" d="M56 44q-8-6-18 1M64 42q8-4 18 3"/>'
      : '<path class="ss-brow" d="M56 45q-8-4-18 5M64 45q8-4 18 5"/>';
    const mouth = mood === 'strike' ? '<ellipse class="ss-mouth" cx="60" cy="71" rx="4" ry="3.2"/>'
      : mood === 'hmm' ? '<path class="ss-line" d="M55 72h10"/>'
      : happy ? '<path class="ss-mouth" d="M53 70q7 7 14 0z"/>' : '<path class="ss-line" d="M54 71q6 4 12 0"/>';
    const hands = mood === 'ready'
      ? '<g class="ss-sword"><path class="ss-arm" d="M34 102q6 12 22 6M86 102q-8 12-24 8"/>' +
        '<path class="ss-grip" d="M64 114L54 99"/><path class="ss-bokken" d="M56 102L20 46"/>' +
        '<ellipse class="ss-skin" cx="57" cy="104" rx="6" ry="5"/><ellipse class="ss-skin" cx="62" cy="110" rx="6" ry="5"/></g>'
      : mood === 'strike'
      ? '<g class="ss-sword"><path class="ss-swoosh" d="M26 36q-26 34-10 74"/>' +
        '<path class="ss-arm" d="M36 100q-6 4-14 2M84 100q-24 12-54 6"/>' +
        '<path class="ss-grip" d="M32 106L18 101"/><path class="ss-bokken" d="M20 102L-12 90"/>' +
        '<ellipse class="ss-skin" cx="24" cy="102" rx="6" ry="5"/><ellipse class="ss-skin" cx="31" cy="106" rx="6" ry="5"/></g>'
      : mood === 'present'
      ? '<rect class="ss-scroll" x="34" y="102" width="52" height="12" rx="3"/><circle class="ss-rod" cx="34" cy="108" r="6"/><circle class="ss-rod" cx="86" cy="108" r="6"/>' +
        '<ellipse class="ss-skin" cx="38" cy="112" rx="7" ry="5"/><ellipse class="ss-skin" cx="82" cy="112" rx="7" ry="5"/>'
      : '<path class="ss-sleeve" d="M38 104q22 12 44 0v10q-22 10-44 0z"/>';
    return `<svg class="sensei ${mood}" viewBox="0 0 120 150" aria-hidden="true">` +
      '<path class="ss-robe" d="M20 150q2-52 40-62q38 10 40 62z"/>' +
      '<path class="ss-robe2" d="M60 88l-16 20 16 30 16-30z"/>' +
      `<rect class="ss-belt" x="28" y="124" width="64" height="8" rx="2" style="fill:var(--${belt})"/>` +
      '<circle class="ss-hair" cx="60" cy="22" r="7"/><rect class="ss-tie" x="55" y="27" width="10" height="3" rx="1.5"/>' +
      '<ellipse class="ss-hair" cx="36" cy="54" rx="5" ry="9"/><ellipse class="ss-hair" cx="84" cy="54" rx="5" ry="9"/>' +
      '<circle class="ss-skin" cx="60" cy="52" r="24"/>' +
      brows + eyes +
      '<circle class="ss-glass" cx="51" cy="53" r="7"/><circle class="ss-glass" cx="69" cy="53" r="7"/><path class="ss-line" d="M58 53h4"/>' +
      '<path class="ss-hair" d="M40 62q20 14 40 0q2 28-20 48q-22-20-20-48z"/>' +
      '<path class="ss-hair" d="M47 66q13-6 26 0q-6 5-13 3q-7 2-13-3z"/>' +
      mouth + hands + '</svg>';
  };

  /* ---------- the Note Ninja mascot: an original kid martial artist ----------
     White gi, red headband, a practice sword (bokken), and a belt in the current belt's color.
     Face showing, no mask or hood, so it doesn't read as any existing ninja character.
     Colors are theme tokens, resolved here, so the same drawing works inline and as a canvas image.
     Parts with classes for animation: .nj-arm (sword arm), .nj-tails (headband tails), .nj-body. */
  A.ninjaSVG = function ({belt = 'belt-white', cls = '', label = ''} = {}) {
    const css = getComputedStyle(document.documentElement), c = n => css.getPropertyValue('--' + n).trim() || '#888';
    const gi = c('ninja-gi'), line = c('ink'), skin = c('ninja-skin'), hair = c('ninja-hair'), band = c('ninja-band'), wood = c('belt-brown'), b = c(belt);
    return `<svg class="ninja ${cls}" viewBox="0 0 100 120" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>` +
      `<g class="nj-body" stroke="${line}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">` +
        `<path d="M36 86L30 114H44L50 94L56 114H70L64 86Z" fill="${gi}"/>` +                                  // pants
        `<path d="M32 58Q50 50 68 58L70 88H30Z" fill="${gi}"/>` +                                            // jacket
        `<path d="M42 57L50 72L58 57" fill="none"/>` +                                                       // lapels
        `<rect x="29" y="76" width="42" height="8" rx="2" fill="${b}"/>` +                                   // belt
        `<path d="M46 84L42 97M54 84L58 96" stroke="${b}" stroke-width="5"/>` +                              // belt ends
        `<path d="M34 62Q24 72 30 82" fill="none" stroke-width="7" stroke="${line}"/><path d="M34 62Q24 72 30 82" fill="none" stroke-width="4" stroke="${gi}"/>` +  // back arm
        `<g class="nj-arm"><path d="M65 62Q76 66 80 56" fill="none" stroke-width="7" stroke="${line}"/><path d="M65 62Q76 66 80 56" fill="none" stroke-width="4" stroke="${gi}"/>` +
          `<line x1="80" y1="57" x2="94" y2="16" stroke="${wood}" stroke-width="4"/><circle cx="80" cy="56" r="4" fill="${skin}"/></g>` +   // sword arm + bokken
        `<circle cx="50" cy="36" r="17" fill="${skin}"/>` +                                                  // head
        `<path d="M33 33Q34 16 50 17Q66 16 67 33Q60 26 50 27Q40 26 33 33Z" fill="${hair}"/>` +               // hair
        `<path d="M47 17Q49 9 55 11Q51 14 52 18Z" fill="${hair}"/>` +                                        // tuft
        `<path d="M33 30Q50 24 67 30L67 35Q50 29 33 35Z" fill="${band}"/>` +                                 // headband
        `<path class="nj-tails" d="M34 32Q24 30 16 36M34 34Q25 38 20 46" fill="none" stroke="${band}" stroke-width="3.5"/>` +
      `</g>` +
      `<ellipse cx="44" cy="40" rx="2.2" ry="3" fill="${line}"/><ellipse cx="56" cy="40" rx="2.2" ry="3" fill="${line}"/>` +   // eyes
      `<path d="M45 47Q50 51 55 47" fill="none" stroke="${line}" stroke-width="2" stroke-linecap="round"/>` +                  // smile
      `</svg>`;
  };

  A.starStr = n => [0, 1, 2].map(i => `<span class="${i < n ? 'on' : ''}">★</span>`).join('');

  /* ---------- links between pages ----------
     linkTo(path, {game}) keeps ?demo (like Arcade.link) but sets or drops ?game=, so the
     select-player page's ?game= never leaks into a game's own links. */
  A.linkTo = function (path, extra = {}) {
    const p = new URLSearchParams();
    Object.keys(extra).forEach(k => extra[k] != null && p.set(k, extra[k]));
    A.params.forEach((v, k) => { if (k !== 'game' && !(k in extra)) p.append(k, v); });
    const q = p.toString().replace(/=(?=&|$)/g, '');          // "?demo=" -> "?demo"
    return path + (q ? '?' + q : '');
  };
  /** Select Player for a game: a view on the arcade floor page, index.html?game=<id> (select-player/player.js).
      root: path back to the site root from this page ('' or '../').
      A two-player game (games.js `players: 2`) gets &players=2, so Player 2 picks too. */
  A.playerLink = (gameId, root = '../') => {
    const g = (A.ALL_GAMES || A.GAMES || []).find(x => x.id === gameId);
    return A.linkTo(root + 'index.html', {game: gameId, players: g && g.players > 1 ? g.players : null, need: null});
  };
  /** where a game's START goes: Select Player, or straight into a game with its own fixed player (games.js `player`:
      an instrument group like 'bells', or 'all' for a game that needs no instrument) */
  A.startLink = (g, root = '../') => g.player ? A.linkTo(root + g.id + '/index.html') : A.playerLink(g.id, root);
  /** the arcade floor, turned to this game's cabinet */
  A.homeLink = (gameId, root = '../') => A.linkTo(root + 'index.html') + (gameId ? '#' + gameId : '');

  /** For game pages: the saved instrument, or (if none) send the student to pick one for this game.
      Usage: const inst = A.requireInstrument(GAME_ID); if (!inst) return; */
  A.requireInstrument = function (gameId) {
    const inst = A.store.player ? A.currentInstrument() : null;      // the exact instrument must be chosen (a member)
    if (!inst) { location.replace(A.playerLink(gameId)); return null; }
    // an unpitched player (the Snare Drum) only plays games marked `unpitched: true` in games.js
    const g = (A.ALL_GAMES || A.GAMES || []).find(x => x.id === gameId);
    // games.js noPlay with block: true (Sustain Speedway: bells and snare can't hold a long tone): back to Select Player
    if (A.blockedBy(g, A.store.player)) { location.replace(A.playerLink(gameId) + '&need=noplay'); return null; }
    // games.js fit with block: true (the Rudiment Trainer: snare and bells only): back to Select Player with its `why`
    if (g && g.fit && g.fit.block && !A.gameFit(g, A.store.player).ok) { location.replace(A.playerLink(gameId) + '&need=fit'); return null; }
    if (inst.pitched === false && !(g && g.unpitched)) { location.replace(A.playerLink(gameId) + '&need=pitched'); return null; }
    return inst;
  };
  /** true when games.js `noPlay` (with `block: true`) rules out this instrument member for game g */
  A.blockedBy = function (g, memberId) {
    const np = g && g.noPlay;
    if (!np || !np.block || !memberId || !A.memberById(memberId)) return false;
    return (np.members || []).includes(memberId) || A.groupsOf(memberId).some(gr => (np.groups || []).includes(gr.id));
  };
  /** the line shown to a snare drummer where a game needs a pitched instrument */
  A.SNARE_MSG = 'Snare drummers: try Showtime Malfunction! Pick a pitched instrument for this game.';

  /* ---------- THE LOBBY'S ZONES (games.js ZONES + each game's zones / fit / tool; arcade.js and lobby.js use these) ---------- */
  /** the games with a cabinet (every game except tools like the Note Checker) */
  A.floorGames = () => (A.GAMES || []).filter(g => !g.tool);
  A.zoneById = id => (A.ZONES || []).find(z => z.id === id) || null;
  /** how many days old game g is (its games.js `added` date, against today's date: ?demo&today= counts); null = no date */
  A.gameAge = function (g) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((g && g.added) || '');
    if (!m) return null;
    const t = (A.store && A.store.dayKey ? A.store.dayKey() : '').split('-').map(Number);
    if (t.length !== 3 || t.some(isNaN)) return null;
    return Math.round((Date.UTC(t[0], t[1] - 1, t[2]) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5);
  };
  /** is game g NEW? added under games.js NEW_GAME_DAYS days ago (never a date still to come: a game added ahead of time
      turns new on its day). The NEW badge and the NEW GAMES zone. */
  A.isNewGame = function (g) {
    const age = A.gameAge(g);
    return age != null && age >= 0 && age < (A.NEW_GAME_DAYS == null ? 30 : A.NEW_GAME_DAYS);
  };
  /* ---------- MY FAVORITES and RECENTLY PLAYED (this device's own lists, store.gameData('floor'): `favs` = game ids
     in the order they were starred, `recent` = the last games opened, newest first; both go into the Backup Code) ---------- */
  const floorData = () => (A.store && A.store.gameData ? A.store.gameData('floor') : null);
  const gameById = id => (A.GAMES || []).find(g => g.id === id && !g.tool) || null;
  /** the starred games (floor games only, in the order they were starred) */
  A.favorites = function () { const d = floorData(); return ((d && d.favs) || []).map(gameById).filter(Boolean); };
  A.isFavorite = function (g) { const d = floorData(); return !!(g && d && (d.favs || []).includes(g.id)); };
  /** star or unstar game g (on = true / false; left out = flip it); tells the page with the 'arcade:favorites' event */
  A.setFavorite = function (g, on) {
    const d = floorData();
    if (!g || !d) return false;
    const list = (d.favs || []).filter(id => id !== g.id);
    if (on === undefined) on = !A.isFavorite(g);
    if (on) list.push(g.id);
    d.favs = list;
    A.store.saveGameData('floor');
    try { dispatchEvent(new CustomEvent('arcade:favorites', {detail: {game: g.id, on}})); } catch (e) { /* old browser */ }
    return on;
  };
  /** THE STAR (☆/★): a button that stars or unstars game g (lobby.js handles every .fav-btn on the floor page). label:
      true = a pill with words ("Add to favorites" / "In my favorites", under a cabinet); else just the star. */
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>';
  A.favButton = function (g, {label = false, cls = ''} = {}) {
    if (!g || g.tool) return '';
    const on = A.isFavorite(g), e = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
    return `<button type="button" class="fav-btn${label ? ' fav-pill' : ''}${cls ? ' ' + cls : ''}" data-fav="${e(g.id)}" aria-pressed="${on}" ` +
      `aria-label="${e(g.name)}: ${on ? 'in my favorites' : 'add to my favorites'}" title="${on ? 'In my favorites' : 'Add to my favorites'}">${STAR}` +
      (label ? `<span class="fav-l">${on ? 'In my favorites' : 'Add to favorites'}</span>` : '') + `</button>`;
  };
  /** put every star for game id on the page in step (after a tap anywhere) */
  A.syncFavButtons = function (root) {
    (root || document).querySelectorAll('.fav-btn[data-fav]').forEach(b => {
      const g = gameById(b.dataset.fav); if (!g) return;
      const on = A.isFavorite(g);
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${g.name}: ${on ? 'in my favorites' : 'add to my favorites'}`);
      b.title = on ? 'In my favorites' : 'Add to my favorites';
      const l = b.querySelector('.fav-l'); if (l) l.textContent = on ? 'In my favorites' : 'Add to favorites';
    });
  };
  /** the games played most recently on this device, newest first (n at most); every game page notes itself
      (mountTopbar), so a game opened from a link counts too */
  A.RECENT_KEEP = 8;
  A.recentGames = function (n) {
    const d = floorData();
    const ids = (d && d.recent && d.recent.length) ? d.recent : (d && d.last ? [d.last] : []);
    return ids.map(gameById).filter(Boolean).slice(0, n || A.RECENT_KEEP);
  };
  A.noteRecent = function (id) {
    const d = floorData();
    if (!d || !id || !gameById(id)) return;
    const was = (d.recent && d.recent.length ? d.recent : (d.last ? [d.last] : [])).filter(x => x !== id);
    d.recent = [id, ...was].slice(0, A.RECENT_KEEP);
    A.store.saveGameData('floor');
  };
  /** is game g in zone z? its own `zones` list, or the zone's `auto` flag (games.js ZONES: the No Instrument Needed
      zone's 'noInstrument'; 'new' = the NEW GAMES zone, Arcade.isNewGame; 'favorites' = MY FAVORITES, Arcade.isFavorite) */
  A.inZone = function (g, z) {
    if (typeof z === 'string') z = A.zoneById(z);
    if (!g || !z) return false;
    if (z.auto === 'new') return A.isNewGame(g);
    if (z.auto === 'favorites') return A.isFavorite(g);
    return !!(z.auto ? g[z.auto] : (g.zones || []).includes(z.id));
  };
  /** a zone's games: the zone's own `order` first (games.js ZONES), then the rest in games.js order (NEW GAMES: the
      newest first) */
  A.zoneGames = function (id) {
    const z = A.zoneById(id), games = A.floorGames().filter(g => A.inZone(g, z)), order = (z && z.order) || [];
    if (z && z.auto === 'new') return games.slice().sort((a, b) => (A.gameAge(a) - A.gameAge(b)) || games.indexOf(a) - games.indexOf(b));
    if (z && z.auto === 'favorites') return A.favorites();                     // in the order they were starred
    const rank = g => { const i = order.indexOf(g.id); return i < 0 ? order.length + games.indexOf(g) : i; };
    return games.slice().sort((a, b) => rank(a) - rank(b));
  };
  /** the zones that have at least one game (an empty zone is hidden) */
  A.zoneList = () => (A.ZONES || []).filter(z => A.zoneGames(z.id).length);
  /** a game's own zones (only ones that exist; never an `auto` zone: those are a second way in) */
  A.zonesOf = g => (g && g.zones || []).map(A.zoneById).filter(Boolean);
  /** does game g suit this instrument member? games.js `fit` ({only} or {not}); no member saved = it fits; in the
      No Instrument Needed zone (pass the zone) every game there fits */
  A.gameFit = function (g, memberId, zone) {
    const f = g && g.fit;
    if (!f || !memberId) return {ok: true};
    if (zone && zone.auto === 'noInstrument' && g.noInstrument) return {ok: true};   // needs no instrument: never dimmed there
    const ok = f.only ? f.only.includes(memberId) : !(f.not || []).includes(memberId);
    return ok ? {ok: true} : {ok: false, tag: f.tag || 'Not for your instrument', why: f.why || ''};
  };
  /** the ASSIGNED game from shared/featured.js (null when off, past its `until` date, or not on the floor) */
  A.featuredGame = function () {
    const F = A.FEATURED;
    if (!F || !F.game) return null;
    if (F.until) {
      const end = new Date(String(F.until) + 'T23:59:59');          // the whole last day counts (local time)
      if (!isNaN(end) && Date.now() > end.getTime()) return null;
    }
    return A.floorGames().find(g => g.id === F.game) || null;
  };
  /** the stars saved in game g for the current instrument (every mode; a fixed-player game: its own player) */
  A.gameStars = function (g) {
    if (!g || !g.maxStars || !A.store) return 0;
    if (g.player) return A.store.allStars(g.player, g.id);
    const m = A.currentMember ? A.currentMember() : null;
    return m ? A.store.allStars(m.id, g.id) : 0;
  };

  /** Standard game top bar: "← Arcade" back to the arcade floor on the left, the sound button and instrument chip on the right.
      The chip opens Select Player for this game. Call on a page that has <div id="topbar"></div>. */
  /* {fixed: 'Bell Kit'}: a game with its own instrument shows it as a plain label, not a link to Select Player.
     {portrait: 'bells'}: the portrait for a fixed label. The chip shows the student's avatar (shared/avatar.js,
     when the page loads it; else the instrument's tiny portrait) and the instrument's name. */
  /** HOLD GUARD: on-screen controls that are held (a D-pad, fingering keys, pads) must never select text, show the iPad
      callout / magnifier, flash a tap highlight, zoom or scroll on a long press. Adds `.hold-guard` (theme.css: no
      selection, no callout, no tap highlight; `lock: true` also `touch-action: none` = no scroll/zoom) and blocks
      contextmenu, selectstart and dragstart there. `touch: true` also cancels touchstart (non-passive): use it only where
      every control is driven by pointer events, because it stops the browser making click events from taps. */
  A.holdGuard = function (el, {lock = false, touch = false} = {}) {
    if (!el || el._holdGuard) return el;
    el._holdGuard = true;
    el.classList.add('hold-guard');
    if (lock) el.classList.add('hold-lock');
    ['contextmenu', 'selectstart', 'dragstart'].forEach(t => el.addEventListener(t, e => e.preventDefault()));
    if (touch) el.addEventListener('touchstart', e => { if (e.cancelable) e.preventDefault(); }, {passive: false});
    return el;
  };

  A.mountTopbar = function (inst, extraRightHTML = '', gameId = '', {fixed, portrait} = {}) {
    if (A.Bg && gameId) A.Bg.mount(gameId);                // the game's menu background (shared/backgrounds.js)
    if (A.PressStart && gameId) A.PressStart.show(gameId);   // the PRESS START title screen, once per page (shared/press-start.js)
    if (gameId) A.pageGame = gameId;                        // this page's game (the pause menu's BACK TO ARCADE GAMES)
    if (gameId && A.noteRecent) A.noteRecent(gameId);       // the lobby's RECENTLY PLAYED (a game opened from a link counts too)
    const el = A.$('topbar'); if (!el) return;
    el.className = 'topbar';
    const m = !fixed && A.currentMember ? A.currentMember() : null;
    // THE AVATAR BADGE (shared/avatar-badge.js): the student's avatar + name + instrument; its menu = EDIT AVATAR (the
    // creator over this page) and CHANGE INSTRUMENT (Choose Your Instrument for this game; a fixed-instrument game:
    // the arcade's instrument pick, then the lobby). Without avatar-badge.js: the old instrument chip.
    const pic = id => !id ? '' : !fixed && A.avatarHTML ? `<span class="chip-pic" aria-hidden="true">${A.avatarHTML({size: 'chip', member: id})}</span>`
      : A.portraitHTML ? `<span class="chip-pic" aria-hidden="true">${A.portraitHTML(id, {size: 'chip'})}</span>` : '';
    const pickLink = () => A.linkTo('../index.html', {pick: ''});
    el.innerHTML =
      `<a class="brand" href="${A.homeLink(gameId)}" aria-label="Back to the arcade"><span aria-hidden="true">←</span><span>Arcade</span></a>` +
      `<div class="topbar-right">${extraRightHTML}` +
      (A.AvatarBadge ? `<div class="avb-slot"></div></div>`
        : fixed ? `<span class="chip">${pic(portrait)}<span class="sr">Playing </span><span class="chip-name">${fixed}</span></span></div>`
        : `<a class="chip" href="${A.playerLink(gameId)}" title="Change instrument">${pic(m && m.id)}` +
          `<span class="sr">Change instrument. Playing as </span><span class="chip-name">${m ? m.short : inst ? inst.shortName : 'Choose instrument'}</span></a></div>`);
    if (A.AvatarBadge) A.AvatarBadge.mount(el.querySelector('.avb-slot'), {member: m ? m.id : null,
      instLabel: fixed || (m ? m.short : inst ? inst.shortName : ''), changeInstrument: fixed ? pickLink() : A.playerLink(gameId)});
    /* sound (shared/sfx.js): the speaker button, this game's sounds preloaded after the first tap, and "← ARCADE"
       plays ui-back before it leaves. Nothing loops on a game page unless the game asks the music manager
       (Arcade.Sfx.setMusic): the first tap (the mic prompt, START, a level button) unlocks the audio. */
    if (A.Sfx) {
      A.Sfx.use('game', gameId);
      let ctl = el.querySelector('.sound-ctl');
      if (!ctl) { ctl = document.createElement('span'); ctl.className = 'sound-ctl'; el.querySelector('.topbar-right').prepend(ctl); }
      A.Sfx.mountControls(ctl);
      el.querySelector('.brand').addEventListener('click', e => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
        e.preventDefault(); A.Sfx.playThenGo('ui-back', e.currentTarget.href);
      });
    }
  };
})(window.Arcade);
