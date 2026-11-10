/* Band Arcade — instruments and note helpers.
   This is the single source of truth for instrument groups and transpositions.
   Every game reads from here; never copy this table into a game. */
window.Arcade = window.Arcade || {};
(function (A) {
  "use strict";

  const NAMES = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];  // pitch-class names (flats preferred, as in band parts)
  const LETTER_PC = {C:0, D:2, E:4, F:5, G:7, A:9, B:11};
  const STEP_OF   = {C:0, D:1, E:2, F:3, G:4, A:5, B:6};

  const mod12 = x => ((x % 12) + 12) % 12;
  const mtof  = m => 440 * Math.pow(2, (m - 69) / 12);

  /** "Bb4" -> {letter:'B', acc:-1, oct:4} */
  function parseNote(s) {
    const m = s.match(/^([A-G])(b|#)?(\d)$/);
    return {letter: m[1], acc: m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0, oct: +m[3]};
  }
  const noteLabel   = n => n.letter + (n.acc < 0 ? '♭' : n.acc > 0 ? '♯' : '');
  const writtenMidi = n => (n.oct + 1) * 12 + LETTER_PC[n.letter] + n.acc;
  const stepOf      = n => n.oct * 7 + STEP_OF[n.letter];   // diatonic staff position

  /*
    Each group (matches the instrument picker Mat uses in class):
      clef     'treble' | 'bass'
      t        semitones the part is written ABOVE concert pitch (pitch class only)
      written  the first five notes as they appear on the student's part
      range    rough sounding MIDI range; only used to tune the pitch detector
    The concert pitches the game listens for are computed from written + t.
  */
  const INSTRUMENTS = [
    {id:'flute', name:'Flute, Oboe',                              clef:'treble', t:0, written:['Bb4','C5','D5','Eb5','F5'], range:[70,89]},
    {id:'bells', name:'Orchestral Bells / Bell Kit',              clef:'treble', t:0, written:['Bb4','C5','D5','Eb5','F5'], range:[94,101]},
    {id:'alto',  name:'Alto Saxophone',                           clef:'treble', t:9, written:['G4','A4','B4','C5','D5'],   range:[58,65]},
    {id:'bari',  name:'Baritone Saxophone',                       clef:'treble', t:9, written:['G4','A4','B4','C5','D5'],   range:[46,53]},
    {id:'bb',    name:'Trumpet, Clarinet, Tenor Saxophone',       clef:'treble', t:2, written:['C4','D4','E4','F4','G4'],   range:[46,65]},
    {id:'hornF', name:'French Horn (F, G, A, B♭, C)',             clef:'treble', t:7, written:['F4','G4','A4','Bb4','C5'],  range:[58,65]},
    {id:'hornC', name:'French Horn (C, D, E, F, G)',              clef:'treble', t:7, written:['C5','D5','E5','F5','G5'],   range:[65,72]},
    {id:'bcl',   name:'Bass Clarinet & Baritone T.C.',            clef:'treble', t:2, written:['C4','D4','E4','F4','G4'],   range:[46,53]},
    {id:'low',   name:'Trombone, Baritone, Euphonium, Bassoon',   clef:'bass',   t:0, written:['Bb2','C3','D3','Eb3','F3'], range:[46,53]},
    {id:'tuba',  name:'Tuba',                                     clef:'bass',   t:0, written:['Bb1','C2','D2','Eb2','F2'], range:[34,41]},
    // UNPITCHED (pitched: false): no notes, only attacks (Arcade.Pitch.onAttack). Only games with `unpitched: true`
    // in games.js (Showtime Malfunction, the Note Checker's ARTICULATION test) take it; the others send it to Select Player.
    {id:'snare', name:'Snare Drum',                               clef:'treble', t:0, written:[], range:[55,67], pitched:false},
  ];

  INSTRUMENTS.forEach(inst => {
    inst.pitched  = inst.pitched !== false;
    inst.notes    = inst.written.map(parseNote);
    inst.targetPc = inst.notes.map(n => mod12(writtenMidi(n) - inst.t));  // concert pitch classes to listen for
    inst.minF     = mtof(inst.range[0]) * 0.78;
    inst.maxF     = Math.min(7000, mtof(inst.range[1]) * 2.3);
    inst.writtenName = pc => NAMES[mod12(pc + inst.t)];                 // concert pc -> name on the student's part
    inst.concertLabel = inst.targetPc.map(pc => NAMES[pc]).join(' ');
    inst.shortName = inst.name.split(/[,/&(]/)[0].trim();
  });

  /*
    Members: the real instruments in each group. The saved player choice is a MEMBER (Select Player shows one
    tile per instrument); its group (below) decides the first five notes and where progress is saved.
      short   the tile / chip label        family  'woodwind' | 'brass' | 'percussion' (tile color on Select Player)
    Ranges (used by the Note Checker's CHROMATIC and SCALES, and by scales everywhere):
    Ranges come from the GMEA All-State Middle School Chromatic Scale sheets. If GMEA changes a range,
    update it here to match the new sheet.
      chromatic  [lowest, highest] WRITTEN note, scientific pitch notation (middle C = C4)
      sounds     semitones the instrument SOUNDS below written pitch (negative = sounds higher).
                 Exact, octave included, so the checker can tell a low D from a high D.
                 Always matches the group's `t` modulo 12.
  */
  const MEMBERS = {
    flute: [
      {id: 'flute',     name: 'Flute',              short: 'Flute',   family: 'woodwind', chromatic: ['C4', 'F6'], sounds: 0},
      {id: 'oboe',      name: 'Oboe',               short: 'Oboe',    family: 'woodwind', chromatic: ['C4', 'C6'], sounds: 0},
    ],
    bells: [{id: 'bells', name: 'Orchestral Bells / Bell Kit', short: 'Bells', family: 'percussion', chromatic: ['G3', 'C6'], sounds: -24}],   // sounds two octaves higher than written
    alto:  [{id: 'altosax', name: 'Alto Sax', short: 'Alto Sax', family: 'woodwind', chromatic: ['C4', 'D6'], sounds: 9}],
    bari:  [{id: 'barisax', name: 'Baritone Sax', short: 'Bari Sax', family: 'woodwind', chromatic: ['C4', 'D6'], sounds: 21}],
    bb: [
      {id: 'trumpet',  name: 'Trumpet',     short: 'Trumpet',   family: 'brass',    chromatic: ['F#3', 'G5'], sounds: 2},
      {id: 'clarinet', name: 'B♭ Clarinet', short: 'Clarinet',  family: 'woodwind', chromatic: ['E3', 'D6'],  sounds: 2},
      {id: 'tenorsax', name: 'Tenor Sax',   short: 'Tenor Sax', family: 'woodwind', chromatic: ['C4', 'D6'],  sounds: 14},
    ],
    hornF: [{id: 'horn', name: 'Horn in F', short: 'Horn', family: 'brass', chromatic: ['F3', 'F5'], sounds: 7}],
    hornC: [{id: 'horn', name: 'Horn in F', short: 'Horn', family: 'brass', chromatic: ['F3', 'F5'], sounds: 7}],
    bcl: [
      {id: 'basscl',     name: 'Bass Clarinet', short: 'Bass Clarinet',  family: 'woodwind', chromatic: ['E3', 'A5'],  sounds: 14},
      {id: 'baritonetc', name: 'Baritone T.C.', short: 'Baritone (T.C.)', family: 'brass',   chromatic: ['F#3', 'G5'], sounds: 14},   // the B.C. range E2–F4, written a 9th higher
    ],
    low: [
      {id: 'trombone', name: 'Trombone',                 short: 'Trombone',         family: 'brass',    chromatic: ['E2', 'F4'],  sounds: 0},
      {id: 'euphbc',   name: 'Baritone/Euphonium B.C.',  short: 'Euphonium (B.C.)', family: 'brass',    chromatic: ['E2', 'F4'],  sounds: 0},
      {id: 'bassoon',  name: 'Bassoon',                  short: 'Bassoon',          family: 'woodwind', chromatic: ['Bb1', 'F4'], sounds: 0},
    ],
    tuba: [{id: 'tuba', name: 'Tuba', short: 'Tuba', family: 'brass', chromatic: ['E1', 'F3'], sounds: 0}],
    snare: [{id: 'snare', name: 'Snare Drum', short: 'Snare', family: 'percussion', pitched: false, chromatic: null, sounds: 0}],   // unpitched: no range
  };
  INSTRUMENTS.forEach(inst => {
    inst.members = (MEMBERS[inst.id] || []).map(m => Object.assign({}, m, {
      group: inst.id, clef: inst.clef, pitched: m.pitched !== false,
      low: m.chromatic ? parseNote(m.chromatic[0]) : null, high: m.chromatic ? parseNote(m.chromatic[1]) : null,
    }));
    inst.members.forEach(m => {
      if (!m.chromatic) return;                                                     // unpitched: no range
      m.lowMidi = writtenMidi(m.low); m.highMidi = writtenMidi(m.high);             // written
      m.soundLow = m.lowMidi - m.sounds; m.soundHigh = m.highMidi - m.sounds;       // sounding (concert, exact octave)
    });
  });

  /* Spelling for chromatic scales: sharps going up (as on the GMEA sheets), flats going down. */
  const SHARP = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const FLAT  = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  /** written midi -> {letter, acc, oct, midi} spelled with sharps or flats */
  function spell(midi, flats) {
    const [letter, acc] = (flats ? FLAT : SHARP)[mod12(midi)];
    const oct = Math.floor((midi - LETTER_PC[letter] - acc) / 12) - 1;
    return {letter, acc, oct, midi};
  }
  /**
   * The chromatic scale for a member, as WRITTEN notes: [{letter, acc, oct, midi, sounding}]
   * Ascending with sharps; {down: true} gives the same pitches descending, spelled with flats.
   * The lowest and highest notes keep the spelling from the range data (e.g. B♭1 for bassoon).
   */
  function chromaticScale(m, {down = false} = {}) {
    const out = [];
    for (let w = m.lowMidi; w <= m.highMidi; w++) {
      const n = w === m.lowMidi ? Object.assign({midi: w}, m.low) : w === m.highMidi ? Object.assign({midi: w}, m.high) : spell(w, down);
      n.sounding = w - m.sounds;
      out.push(n);
    }
    return down ? out.reverse() : out;
  }

  /*
    PLAYERS: the Select Player tiles, one per instrument, in grid order (8 × 2: woodwinds, then brass and percussion). The saved player choice is one
    of these ids. groupFor(id) maps it to its player GROUP (the old saved choice): first five notes, clef,
    transposition and the id games save progress under, so stars saved before members existed stay put.
    Horn is one tile in two groups (hornF: F G A B♭ C, hornC: C D E F G); hornStart 'F' | 'C' picks one.
  */
  const PLAYERS = ['flute', 'oboe', 'clarinet', 'basscl', 'bassoon', 'altosax', 'tenorsax', 'barisax',
                   'trumpet', 'horn', 'trombone', 'baritonetc', 'euphbc', 'tuba', 'bells', 'snare'];
  const HORN_GROUPS = {F: 'hornF', C: 'hornC'};
  /** every group a member belongs to (horn: both horn groups) */
  const groupsOf = id => INSTRUMENTS.filter(g => g.members.some(m => m.id === id));
  /** THE member -> group helper: the player group for an instrument member ('trumpet' -> the bb group) */
  function groupFor(id, {hornStart = 'F'} = {}) {
    if (id === 'horn') return INSTRUMENTS.find(g => g.id === (HORN_GROUPS[hornStart] || 'hornF'));
    return groupsOf(id)[0] || null;
  }
  /** a member by id (from its first group), or null */
  const memberById = id => { const g = groupsOf(id)[0]; return g ? g.members.find(m => m.id === id) : null; };

  A.music = {NAMES, parseNote, noteLabel, writtenMidi, stepOf, mod12, mtof, spell};
  A.PLAYERS = PLAYERS;
  A.HORN_GROUPS = HORN_GROUPS;
  A.groupFor = groupFor;
  A.groupsOf = groupsOf;
  A.memberById = memberById;
  A.INSTRUMENTS = INSTRUMENTS;
  A.getInstrument = id => INSTRUMENTS.find(i => i.id === id) || null;
  A.chromaticScale = chromaticScale;
  /** a group's member by id (or its only member), or null */
  A.getMember = (inst, id) => inst ? (inst.members.find(m => m.id === id) || (inst.members.length === 1 ? inst.members[0] : null)) : null;
})(window.Arcade);
