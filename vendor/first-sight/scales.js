/* Band Arcade — scales (GMEA All-State middle school scale requirements). Used by every game and the Note Checker.
   Five choices: Concert B♭, E♭, F and A♭ major (one octave, up then down: 8 + 7 = 15 notes) and Chromatic
   (the instrument's whole GMEA chromatic range from instruments.js, sharps going up, flats going down).
   Every scale is built for one instrument MEMBER (instruments.js), written for that instrument:
   transposed with its `sounds` value and spelled in its written key, with the right key signature. */
window.Arcade = window.Arcade || {};
(function (A) {
  "use strict";

  /*
    STARTING NOTES — the WRITTEN note each scale starts on, for every instrument, in scientific
    pitch notation (middle C = C4). These should match the GMEA scale sheets. To move a scale up
    or down an octave, change its note here (for example trumpet A♭: 'Bb3' -> 'Bb4').
    They were filled in with this rule, until checked against the sheets:
      Concert B♭: the same tonic as the first-five notes (the B♭ scale is the first five continued).
      Other scales: the tonic closest to that B♭ tonic whose whole octave fits the GMEA chromatic range;
      on a tie, the higher one for low brass, tuba and bassoon, the lower one for everyone else.
    An instrument missing here uses that rule.
  */
  const START = {
    //            Concert B♭         Concert E♭         Concert F          Concert A♭
    flute:      { Bb: 'Bb4',         Eb: 'Eb5',         F: 'F4',          Ab: 'Ab4' },
    oboe:       { Bb: 'Bb4',         Eb: 'Eb4',         F: 'F4',          Ab: 'Ab4' },
    bells:      { Bb: 'Bb4',         Eb: 'Eb4',         F: 'F4',          Ab: 'Ab4' },
    altosax:    { Bb: 'G4',          Eb: 'C5',          F: 'D4',          Ab: 'F4'  },
    barisax:    { Bb: 'G4',          Eb: 'C5',          F: 'D4',          Ab: 'F4'  },
    trumpet:    { Bb: 'C4',          Eb: 'F4',          F: 'G3',          Ab: 'Bb3' },
    clarinet:   { Bb: 'C4',          Eb: 'F4',          F: 'G3',          Ab: 'Bb3' },
    tenorsax:   { Bb: 'C4',          Eb: 'F4',          F: 'G4',          Ab: 'Bb4' },
    horn:       { Bb: 'F4',          Eb: 'Bb3',         F: 'C4',          Ab: 'Eb4' },
    basscl:     { Bb: 'C4',          Eb: 'F4',          F: 'G3',          Ab: 'Bb3' },
    baritonetc: { Bb: 'C4',          Eb: 'F4',          F: 'G3',          Ab: 'Bb3' },
    trombone:   { Bb: 'Bb2',         Eb: 'Eb3',         F: 'F2',          Ab: 'Ab2' },
    euphbc:     { Bb: 'Bb2',         Eb: 'Eb3',         F: 'F2',          Ab: 'Ab2' },
    bassoon:    { Bb: 'Bb2',         Eb: 'Eb3',         F: 'F2',          Ab: 'Ab2' },
    tuba:       { Bb: 'Bb1',         Eb: 'Eb2',         F: 'F1',          Ab: 'Ab1' },
  };
  const LOW_REGISTER = ['trombone', 'euphbc', 'baritonetc', 'tuba', 'bassoon'];   // ties go up an octave

  /*
    THE AUDITION (Scale Trainer): the GMEA All-State (First Round) / District Honor Band scale audition, in THREE
    SECTIONS (the two auditions ask the same):
      ms = MIDDLE SCHOOL (grades 6–8): the GMEA MS All-State scale sheets (2025-26 mallet sheet for the bells).
      cb = HIGH SCHOOL CONCERT BAND (grades 9–10) and sb = HIGH SCHOOL SYMPHONIC BAND (grades 11–12): the 2025-26 GMEA
           HS All-State scale sheets (the CB oboe sheet: 2024-25, the only one; the CB trombone and tuba sheets are an
           older printing with no time limit printed).
    THE GMEA SHEETS ARE THE SOURCE: edit AUDITION, not the game.
      AUDITION[section][member] = {time (the sheet's limit, s, for every scale of the section), scales: [[concert key,
      the WRITTEN starting note, octaves (1 | 2 | 3)], …] in the order printed, tempo? (the sheet's ♩ =, Practice's SLOW
      GUIDE offers it)} or {time, sameAs: '<member>'} (the same written notes as that member's sheet, its own time).
      The written start note also fixes the written key's spelling: concert B on trumpet = written D♭ major (5 flats),
      on horn G♭ major, concert E on clarinet F♯ major. The order must be AUDITION_ORDER[section] (the HS sheets: "must be
      performed in the order printed"; the HS scales "do not have to be memorized").
    A scale is played up and down, then its arpeggio up to the top tonic and back down, ending on a whole note:
      1 octave  = 1–8–1 + 3-5-8-5-3-1                                  (21 notes)
      2 octaves = 1–15–1 + 3-5-8-10-12-15-12-10-8-5-3-1                  (41 notes)
      3 octaves = 1–22–1 + 3-5-8-10-12-15-17-19-22-19-…-3-1               (61 notes)
    audition(member, key, section) builds it for any number of octaves.
    Mallets (bells): 2 octaves each; they audition on a bigger instrument than the bell kit, so no range check.
    The chromatic: MS = the member's GMEA chromatic range (instruments.js `chromatic`; mallets: AUDITION_CHROM); HS (cb
    and sb share one sheet set) = CHROMATIC_HS. instruments.js `chromatic` stays the MIDDLE SCHOOL range.
    Mat: confirm — SB tenor sax 2:15 (the sheet's footer), the CB trombone / tuba times (2:00 assumed: none printed),
    the CB oboe sheet's year (2024-25), the bells' MS chromatic (the GMEA mallet sheet says 2 octaves from C; we use F).
  */
  const MS_SAX = {time: 60, scales: [['F', 'D4', 2], ['Bb', 'G4', 1], ['Eb', 'C4', 2], ['Ab', 'F4', 1]]};
  const MS_TPT = {time: 60, scales: [['F', 'G3', 2], ['Bb', 'C4', 1], ['Eb', 'F4', 1], ['Ab', 'Bb3', 1]]};
  const MS_TBN = {time: 60, scales: [['F', 'F2', 2], ['Bb', 'Bb2', 1], ['Eb', 'Eb3', 1], ['Ab', 'Ab2', 1]]};
  const AUDITION = {
    // MIDDLE SCHOOL (grades 6–8), order F B♭ E♭ A♭, from memory
    ms: {
      flute:      {time: 60, scales: [['F', 'F4', 2], ['Bb', 'Bb4', 1], ['Eb', 'Eb4', 2], ['Ab', 'Ab4', 1]]},
      oboe:       {time: 60, scales: [['F', 'F4', 1], ['Bb', 'Bb4', 1], ['Eb', 'Eb4', 1], ['Ab', 'Ab4', 1]]},
      clarinet:   {time: 75, scales: [['F', 'G3', 2], ['Bb', 'C4', 2], ['Eb', 'F3', 2], ['Ab', 'Bb3', 2]]},
      basscl:     {time: 60, scales: [['F', 'G3', 2], ['Bb', 'C4', 1], ['Eb', 'F3', 2], ['Ab', 'Bb3', 1]]},
      bassoon:    {time: 75, scales: [['F', 'F2', 2], ['Bb', 'Bb1', 2], ['Eb', 'Eb2', 2], ['Ab', 'Ab2', 1]]},
      altosax: MS_SAX, barisax: MS_SAX,
      tenorsax:   {time: 60, scales: [['F', 'G4', 1], ['Bb', 'C4', 2], ['Eb', 'F4', 1], ['Ab', 'Bb4', 1]]},
      trumpet: MS_TPT, baritonetc: MS_TPT,
      horn:       {time: 60, scales: [['F', 'C4', 1], ['Bb', 'F3', 2], ['Eb', 'Bb3', 1], ['Ab', 'Eb4', 1]]},
      trombone: MS_TBN, euphbc: MS_TBN,
      tuba:       {time: 60, scales: [['F', 'F1', 2], ['Bb', 'Bb1', 1], ['Eb', 'Eb2', 1], ['Ab', 'Ab1', 1]]},
      bells:      {time: 75, scales: [['F', 'F3', 2], ['Bb', 'Bb3', 2], ['Eb', 'Eb4', 2], ['Ab', 'Ab3', 2]]},   // the 2025-26 GMEA mallet sheet: 1:15
    },
    // CONCERT BAND (grades 9–10), order G C F B♭ E♭ A♭ D♭ G♭. Tempo mark on the sheets: ♩ = 132 (horn/tenor/oboe sheets: none).
    cb: {
      flute:      {time: 135, tempo: 132, scales: [['G', 'G4', 2], ['C', 'C4', 3], ['F', 'F4', 2], ['Bb', 'Bb4', 2], ['Eb', 'Eb4', 2], ['Ab', 'Ab4', 2], ['Db', 'Db4', 2], ['Gb', 'Gb4', 2]]},
      oboe:       {time: 105, scales: [['G', 'G4', 1], ['C', 'C4', 2], ['F', 'F4', 2], ['Bb', 'Bb4', 1], ['Eb', 'Eb4', 2], ['Ab', 'Ab4', 1], ['Db', 'Db4', 2], ['Gb', 'Gb4', 1]]},   // 2024-25 sheet (Mat: confirm)
      clarinet:   {time: 150, tempo: 132, scales: [['G', 'A3', 2], ['C', 'D4', 2], ['F', 'G3', 3], ['Bb', 'C4', 2], ['Eb', 'F3', 3], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 2], ['Gb', 'Ab3', 2]]},
      basscl:     {time: 120, tempo: 132, scales: [['G', 'A3', 2], ['C', 'D4', 1], ['F', 'G3', 2], ['Bb', 'C4', 2], ['Eb', 'F3', 2], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 1], ['Gb', 'Ab3', 2]]},
      bassoon:    {time: 120, tempo: 132, scales: [['G', 'G2', 2], ['C', 'C2', 2], ['F', 'F2', 2], ['Bb', 'Bb1', 3], ['Eb', 'Eb2', 2], ['Ab', 'Ab2', 2], ['Db', 'Db2', 2], ['Gb', 'Gb2', 2]]},
      altosax:    {time: 120, tempo: 132, scales: [['G', 'E4', 2], ['C', 'A4', 1], ['F', 'D4', 2], ['Bb', 'G4', 1], ['Eb', 'C4', 2], ['Ab', 'F4', 2], ['Db', 'Bb3', 2], ['Gb', 'Eb4', 2]]},
      barisax:    {time: 120, tempo: 132, sameAs: 'altosax'},
      tenorsax:   {time: 135, scales: [['G', 'A4', 1], ['C', 'D4', 2], ['F', 'G4', 1], ['Bb', 'C4', 2], ['Eb', 'F4', 2], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 2], ['Gb', 'Ab4', 1]]},
      trumpet:    {time: 120, tempo: 132, scales: [['G', 'A3', 2], ['C', 'D4', 1], ['F', 'G3', 2], ['Bb', 'C4', 2], ['Eb', 'F4', 1], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 1], ['Gb', 'Ab3', 2]]},
      baritonetc: {time: 120, tempo: 132, sameAs: 'trumpet'},   // the "Baritone TC" sheet = trumpet's notes
      horn:       {time: 105, scales: [['G', 'D4', 1], ['C', 'G3', 2], ['F', 'C4', 1], ['Bb', 'F3', 2], ['Eb', 'Bb3', 1], ['Ab', 'Eb4', 1], ['Db', 'Ab3', 2], ['Gb', 'Db4', 1]]},
      trombone:   {time: 120, tempo: 132, scales: [['G', 'G2', 2], ['C', 'C3', 1], ['F', 'F2', 2], ['Bb', 'Bb2', 2], ['Eb', 'Eb3', 1], ['Ab', 'Ab2', 2], ['Db', 'Db3', 1], ['Gb', 'Gb2', 2]]},   // older sheet, no time printed: 2:00 assumed (Mat: confirm)
      euphbc:     {time: 120, tempo: 132, sameAs: 'trombone'},  // the "Baritone BC" sheet = trombone's notes
      tuba:       {time: 120, tempo: 132, scales: [['G', 'G1', 2], ['C', 'C2', 1], ['F', 'F1', 2], ['Bb', 'Bb1', 2], ['Eb', 'Eb2', 1], ['Ab', 'Ab1', 2], ['Db', 'Db2', 1], ['Gb', 'Gb1', 2]]},   // older sheet, no time printed: 2:00 assumed (Mat: confirm)
      bells:      {time: 135, tempo: 132, scales: [['G', 'G3', 2], ['C', 'C4', 2], ['F', 'F3', 2], ['Bb', 'Bb3', 2], ['Eb', 'Eb4', 2], ['Ab', 'Ab3', 2], ['Db', 'Db4', 2], ['Gb', 'Gb3', 2]]},   // the GMEA mallet sheet
    },
    // SYMPHONIC BAND (grades 11–12), order G C F B♭ E♭ A♭ D♭ G♭ B E A D. No tempo mark except horn (♩ = 144).
    sb: {
      flute:      {time: 180, scales: [['G', 'G4', 2], ['C', 'C4', 3], ['F', 'F4', 2], ['Bb', 'Bb4', 2], ['Eb', 'Eb4', 2], ['Ab', 'Ab4', 2], ['Db', 'Db4', 2], ['Gb', 'Gb4', 2], ['B', 'B4', 2], ['E', 'E4', 2], ['A', 'A4', 2], ['D', 'D4', 2]]},
      oboe:       {time: 150, scales: [['G', 'G4', 1], ['C', 'C4', 2], ['F', 'F4', 2], ['Bb', 'Bb4', 1], ['Eb', 'Eb4', 2], ['Ab', 'Ab4', 1], ['Db', 'Db4', 2], ['Gb', 'Gb4', 1], ['B', 'B3', 2], ['E', 'E4', 2], ['A', 'A4', 1], ['D', 'D4', 2]]},
      clarinet:   {time: 210, scales: [['G', 'A3', 2], ['C', 'D4', 2], ['F', 'G3', 3], ['Bb', 'C4', 2], ['Eb', 'F3', 3], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 2], ['Gb', 'Ab3', 2], ['B', 'Db4', 2], ['E', 'F#3', 3], ['A', 'B3', 2], ['D', 'E3', 3]]},
      basscl:     {time: 165, scales: [['G', 'A3', 2], ['C', 'D4', 1], ['F', 'G3', 2], ['Bb', 'C4', 2], ['Eb', 'F3', 2], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 1], ['Gb', 'Ab3', 2], ['B', 'Db4', 1], ['E', 'F#3', 2], ['A', 'B3', 2], ['D', 'E3', 2]]},
      bassoon:    {time: 195, scales: [['G', 'G2', 2], ['C', 'C2', 2], ['F', 'F2', 2], ['Bb', 'Bb1', 3], ['Eb', 'Eb2', 2], ['Ab', 'Ab2', 2], ['Db', 'Db2', 2], ['Gb', 'Gb2', 2], ['B', 'B1', 2], ['E', 'E2', 2], ['A', 'A2', 2], ['D', 'D2', 2]]},
      altosax:    {time: 165, scales: [['G', 'E4', 2], ['C', 'A4', 1], ['F', 'D4', 2], ['Bb', 'G4', 1], ['Eb', 'C4', 2], ['Ab', 'F4', 2], ['Db', 'Bb3', 2], ['Gb', 'Eb4', 2], ['B', 'Ab4', 1], ['E', 'Db4', 2], ['A', 'F#4', 1], ['D', 'B3', 2]]},
      barisax:    {time: 165, sameAs: 'altosax'},
      tenorsax:   {time: 135, scales: [['G', 'A4', 1], ['C', 'D4', 2], ['F', 'G4', 1], ['Bb', 'C4', 2], ['Eb', 'F4', 2], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 2], ['Gb', 'Ab4', 1], ['B', 'Db4', 2], ['E', 'F#4', 1], ['A', 'B3', 2], ['D', 'E4', 2]]},   // the sheet's footer says 2:15 (Mat: confirm)
      trumpet:    {time: 165, scales: [['G', 'A3', 2], ['C', 'D4', 1], ['F', 'G3', 2], ['Bb', 'C4', 2], ['Eb', 'F4', 1], ['Ab', 'Bb3', 2], ['Db', 'Eb4', 1], ['Gb', 'Ab3', 2], ['B', 'Db4', 1], ['E', 'F#3', 2], ['A', 'B3', 2], ['D', 'E4', 1]]},
      baritonetc: {time: 165, sameAs: 'trumpet'},               // the "Euphonium TC" sheet = trumpet's notes
      horn:       {time: 150, tempo: 144, scales: [['G', 'D4', 1], ['C', 'G3', 2], ['F', 'C4', 1], ['Bb', 'F3', 2], ['Eb', 'Bb3', 1], ['Ab', 'Eb4', 1], ['Db', 'Ab3', 2], ['Gb', 'Db4', 1], ['B', 'Gb3', 2], ['E', 'B3', 1], ['A', 'E4', 1], ['D', 'A3', 2]]},
      trombone:   {time: 165, scales: [['G', 'G2', 2], ['C', 'C3', 1], ['F', 'F2', 2], ['Bb', 'Bb2', 2], ['Eb', 'Eb3', 1], ['Ab', 'Ab2', 2], ['Db', 'Db3', 1], ['Gb', 'Gb2', 2], ['B', 'B2', 1], ['E', 'E2', 2], ['A', 'A2', 2], ['D', 'D3', 1]]},
      euphbc:     {time: 165, sameAs: 'trombone'},              // the "Baritone BC" sheet = trombone's notes
      tuba:       {time: 165, scales: [['G', 'G1', 2], ['C', 'C2', 1], ['F', 'F1', 2], ['Bb', 'Bb1', 2], ['Eb', 'Eb2', 1], ['Ab', 'Ab1', 2], ['Db', 'Db2', 1], ['Gb', 'Gb1', 2], ['B', 'B1', 1], ['E', 'E1', 2], ['A', 'A1', 2], ['D', 'D2', 1]]},
      bells:      {time: 210, scales: [['G', 'G3', 2], ['C', 'C4', 2], ['F', 'F3', 2], ['Bb', 'Bb3', 2], ['Eb', 'Eb4', 2], ['Ab', 'Ab3', 2], ['Db', 'Db4', 2], ['Gb', 'Gb3', 2], ['B', 'B3', 2], ['E', 'E4', 2], ['A', 'A3', 2], ['D', 'D4', 2]]},
    },
  };
  // the order each section's scales are played in (every member's list follows it)
  const AUDITION_ORDER = {
    ms: ['F', 'Bb', 'Eb', 'Ab'],
    cb: ['G', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'],
    sb: ['G', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D'],
  };
  const SECTIONS = [
    {id: 'ms', name: 'Middle School', grades: '6th–8th grade', memory: true},
    {id: 'cb', name: 'Concert Band', grades: '9th–10th grade', memory: false},
    {id: 'sb', name: 'Symphonic Band', grades: '11th–12th grade', memory: false},
  ];
  // the concert keys an audition can ask for: the name and the concert tonic's pitch class
  const CONCERT = {G: ['G', 7], C: ['C', 0], F: ['F', 5], Bb: ['B♭', 10], Eb: ['E♭', 3], Ab: ['A♭', 8], Db: ['D♭', 1], Gb: ['G♭', 6],
    B: ['B', 11], E: ['E', 4], A: ['A', 9], D: ['D', 2]};
  // the chromatic, MIDDLE SCHOOL audition only: mallets play 2 octaves up and down from concert F (the bells member is
  // unchanged). The GMEA mallet sheet says "2-octave chromatic starting on C" (Mat: decide C or F).
  const AUDITION_CHROM = {bells: ['F4', 'F6']};
  // THE HIGH SCHOOL CHROMATIC (cb and sb: one GMEA sheet set), WRITTEN [lowest, highest]: sharps going up, flats coming
  // down, the top note played once (so the lowest note is A♯3 going up, B♭3 coming down on the oboe). Mallets (the GMEA
  // mallet sheet): "2-octave chromatic starting on C, after the major scales, not in the time limit".
  const CHROMATIC_HS = {
    flute: ['C4', 'C7'], oboe: ['Bb3', 'F6'], clarinet: ['E3', 'G6'], basscl: ['E3', 'C6'],
    altosax: ['Bb3', 'F6'], barisax: ['Bb3', 'F6'], tenorsax: ['Bb3', 'F6'],
    horn: ['F3', 'A5'], trumpet: ['F#3', 'C6'], baritonetc: ['F#3', 'C6'],
    bassoon: ['Bb1', 'Bb4'], trombone: ['E2', 'Bb4'], euphbc: ['E2', 'Bb4'], tuba: ['E1', 'Bb3'],
    bells: ['C4', 'C6'],
  };
  // the sheets' rhythm (4/4), only a picture (nothing is judged on it): beats per note, one list per measure. The SAME
  // note values for 1, 2 and 3 octaves (more octaves = more measures): scale measures = quarter, 2 eighths, 4 eighths
  // (7 notes); arpeggio measures = quarter, 2 eighths, quarter, 2 eighths (6 notes; the first starts on the scale's last
  // note); a final whole note. n octaves = 2n scale bars + n arpeggio bars + the whole note.
  //   1 octave:  | 1 2 3 4 5 6 7 | 8 7 6 5 4 3 2 | 1 3 5 8 5 3 | 1 |                                (21 notes, 4 bars)
  //   2 octaves: | 1–7 | 8–14 | 15 14 … 9 | 8 7 … 2 | 1 3 5 8 10 12 | 15 12 10 8 5 3 | 1 |       (41 notes, 7 bars)
  //   3 octaves: | 1–7 | 8–14 | 15–21 | 22–16 | 15–9 | 8–2 | 1 3 5 8 10 12 | 15 17 19 22 19 17 | 15 12 10 8 5 3 | 1 | (61, 10 bars)
  const SCALE_BAR = [1, .5, .5, .5, .5, .5, .5], ARP_BAR = [1, .5, .5, 1, .5, .5];
  const rhythmOf = oct => Array(2 * oct).fill(SCALE_BAR).concat(Array(oct).fill(ARP_BAR), [[4]]);
  const RHYTHM = {1: rhythmOf(1), 2: rhythmOf(2), 3: rhythmOf(3)};

  const LIST = [
    {id: 'Bb', concert: 'B♭', pc: 10},
    {id: 'Eb', concert: 'E♭', pc: 3},
    {id: 'F',  concert: 'F',  pc: 5},
    {id: 'Ab', concert: 'A♭', pc: 8},
    {id: 'chrom', concert: null},
  ];

  const {parseNote, noteLabel, writtenMidi, mod12} = A.music;
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], LETTER_PC = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
  const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
  // major keys by tonic pitch class, spelled the usual way (never more than 6 sharps or flats)
  const KEYS = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  const SHARP_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯'], FLAT_KEYS = ['C', 'F', 'B♭', 'E♭', 'A♭', 'D♭', 'G♭', 'C♭'];
  const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'], FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

  /** key signature of a major key: {type: '#'|'b', count} (count 0 = C major) */
  function keySignature(tonic) {
    const name = noteLabel(tonic);
    let i = SHARP_KEYS.indexOf(name);
    if (i > 0) return {type: '#', count: i};
    i = FLAT_KEYS.indexOf(name);
    return {type: 'b', count: Math.max(0, i)};
  }
  /** the accidental a key signature gives a letter: +1, -1 or 0 */
  function sigAcc(sig, letter) {
    if (!sig || !sig.count) return 0;
    return sig.type === '#' ? (SHARP_ORDER.slice(0, sig.count).includes(letter) ? 1 : 0)
                            : (FLAT_ORDER.slice(0, sig.count).includes(letter) ? -1 : 0);
  }
  /** how to DRAW a note under a key signature: the accidental only where the key doesn't already give it */
  function shown(n, sig) {
    if (!sig) return n;
    const a = n.acc === sigAcc(sig, n.letter) ? 0 : n.acc;
    return {letter: n.letter, acc: a, oct: n.oct, natural: a === 0 && n.acc === 0 && sigAcc(sig, n.letter) !== 0};
  }

  /** the written tonic pitch class of a concert scale for a member */
  const writtenPc = (m, s) => mod12(s.pc + m.sounds);
  const fits = (m, midi) => midi >= m.lowMidi && midi + 12 <= m.highMidi;

  /** the rule (see START): the member's written starting midi for scale s */
  function ruleStart(m, s) {
    const inst = A.getInstrument(m.group);
    const bbPc = writtenPc(m, LIST[0]);
    const five = writtenMidi(inst.notes[0]);
    const closest = (pc, near) => {
      let best = null;
      for (let w = m.lowMidi; w <= m.highMidi; w++) {
        if (mod12(w) !== pc || !fits(m, w)) continue;
        const d = Math.abs(w - near);
        if (best === null || d < Math.abs(best - near) ||
            (d === Math.abs(best - near) && (LOW_REGISTER.includes(m.id) ? w > best : w < best))) best = w;
      }
      return best;
    };
    const bb = mod12(five) === bbPc && fits(m, five) ? five : closest(bbPc, five);
    return s.id === 'Bb' ? bb : closest(writtenPc(m, s), bb);
  }

  /** the written starting midi for a member and scale: the START table if it has a usable entry, else the rule */
  function startMidi(m, s) {
    const t = START[m.id] && START[m.id][s.id];
    if (t) {
      const w = writtenMidi(parseNote(t));
      if (mod12(w) === writtenPc(m, s)) return w;
      if (window.console) console.warn(`scales.js: START ${m.id} ${s.id} = ${t} is not the right key; using the rule`);
    }
    return ruleStart(m, s);
  }

  /** spell a one-octave major scale from a written tonic midi (spell = {letter, acc}: the tonic's own spelling, e.g.
      F♯ rather than G♭; left out = the usual one from KEYS) */
  function majorScale(tonicMidi, spell) {
    const [tl, ta] = spell && mod12(LETTER_PC[spell.letter] + spell.acc) === mod12(tonicMidi) ? [spell.letter, spell.acc] : KEYS[mod12(tonicMidi)];
    const tOct = Math.floor((tonicMidi - LETTER_PC[tl] - ta) / 12) - 1;
    const li = LETTERS.indexOf(tl);
    return MAJOR.map((iv, i) => {
      const letter = LETTERS[(li + i) % 7], oct = tOct + Math.floor((li + i) / 7);
      const midi = tonicMidi + iv;
      return {letter, acc: midi - ((oct + 1) * 12 + LETTER_PC[letter]), oct, midi};
    });
  }

  /**
   * Build a scale for a member. Returns
   *   {id, name ('Concert E♭'), label ('Concert E♭ (your F Major)'), short ('E♭'), key ('F Major') | null,
   *    sig {type, count} | null, up: [...], notes: [...up, then down]}
   * Each note: {letter, acc, oct, midi (written), sounding (midi), pc (concert pitch class), show (how to draw it)}
   */
  function build(m, id) {
    const s = LIST.find(x => x.id === id) || LIST[0];
    let up, down, sig = null, key = null;
    if (s.id === 'chrom') {
      up = A.chromaticScale(m);
      down = A.chromaticScale(m, {down: true}).slice(1);
    } else {
      up = majorScale(startMidi(m, s));
      down = up.slice(0, -1).reverse();
      sig = keySignature(up[0]);
      key = noteLabel(up[0]) + ' Major';
    }
    const dress = n => Object.assign({}, n, {sounding: n.midi - m.sounds, pc: mod12(n.midi - m.sounds), show: shown(n, sig)});
    up = up.map(dress);
    const notes = up.concat(down.map(dress));
    const name = s.id === 'chrom' ? 'Chromatic' : 'Concert ' + s.concert;
    return {id: s.id, name, short: s.concert || 'Chromatic', key, sig, up, notes,
            label: key ? `${name} (your ${key})` : `Chromatic (${noteLabel(up[0])}${up[0].oct} to ${noteLabel(up[up.length - 1])}${up[up.length - 1].oct})`};
  }

  /** a section id that exists ('ms' when not) */
  const secOf = sec => (AUDITION[sec] ? sec : 'ms');
  /** a member's entry in a section, `sameAs` resolved: {time, tempo, scales: [[key, start, octaves]…]} or null */
  function auditionEntry(m, sec) {
    const T = AUDITION[secOf(sec)], id = m && (m.id || m), e = T[id];
    if (!e) return null;
    const src = e.sameAs ? T[e.sameAs] : e;
    return {time: e.time || src.time, tempo: e.tempo || null, scales: src.scales || [], sameAs: e.sameAs || null};
  }

  /**
   * THE AUDITION SCALE for a member (AUDITION above): {id, name, label, key, sig, octaves, notes, measures, slurs}
   * notes: the scale up and down (any number of octaves), then its arpeggio, each {letter, acc, oct, midi (written),
   * sounding, pc, show, beats, measure}; measures = how many notes each measure holds (the sheet's 4/4 picture).
   */
  function audition(m, id, sec = 'ms') {
    const e = auditionEntry(m, sec), row = e && e.scales.find(x => x[0] === id), c = CONCERT[id];
    if (!row || !c) return null;
    const [, start, octaves] = row;
    const p = parseNote(start), t = writtenMidi(p);
    if (mod12(t - m.sounds) !== c[1] && window.console) console.warn(`scales.js: AUDITION ${secOf(sec)} ${m.id} ${id} = ${start} is not concert ${c[0]}`);
    let up = majorScale(t, p);
    for (let o = 1; o < octaves; o++) up = up.concat(majorScale(t + 12 * o, p).slice(1));
    // the arpeggio: 3-5-8 in each octave up to the top tonic, then back down to the tonic
    const steps = [];
    for (let o = 0; o < octaves; o++) steps.push(7 * o + 2, 7 * o + 4, 7 * o + 7);
    const arp = steps.concat(steps.slice(0, -1).reverse(), [0]).map(i => up[i]);
    const sig = keySignature(up[0]), key = noteLabel(up[0]) + ' Major';
    const R = RHYTHM[octaves] || rhythmOf(octaves), beats = [].concat(...R), bars = R.map(r => r.length);
    let k = 0;
    const measureOf = bars.reduce((a, n, mi) => a.concat(Array(n).fill(mi)), []);
    const notes = up.concat(up.slice(0, -1).reverse(), arp).map(n => Object.assign({}, n, {
      sounding: n.midi - m.sounds, pc: mod12(n.midi - m.sounds), show: shown(n, sig), beats: beats[k], measure: measureOf[k++]}));
    const name = 'Concert ' + c[0];
    // ARTICULATION, as on the GMEA sheets: tongue going up, slur coming down. slurs = [first, last] note indexes: the
    // scale's top note down to the tonic where the scale ends, then the arpeggio's top note down to the final whole
    // note (the arpeggio going up stays tongued). Mallets can't slur: none.
    const top = 7 * octaves, arpTop = 17 * octaves;
    const slurs = m.family === 'percussion' ? [] : [[top, 2 * top], [arpTop, notes.length - 1]];
    return {id, name, short: c[0], key, sig, octaves, notes, measures: bars, slurs, label: `${name} (your ${key})`};
  }
  /** every audition scale of a section for a member, in the order printed */
  const auditionScales = (m, sec = 'ms') => AUDITION_ORDER[secOf(sec)].map(id => audition(m, id, sec)).filter(Boolean);
  /** the audition's chromatic scale for a member: MS = its GMEA range (mallets: AUDITION_CHROM); HS = CHROMATIC_HS.
      Sharps going up, flats coming down (HS: the lowest note too: A♯3 going up, B♭3 coming down) */
  function auditionChromatic(m, sec = 'ms') {
    const hs = secOf(sec) !== 'ms', o = hs ? CHROMATIC_HS[m.id] : AUDITION_CHROM[m.id];
    const withRange = (lo, hi) => Object.assign({}, m, {low: lo, high: hi, lowMidi: writtenMidi(lo), highMidi: writtenMidi(hi)});
    let up, down;
    if (o && hs) {
      const lo = writtenMidi(parseNote(o[0])), hi = parseNote(o[1]);
      up = A.chromaticScale(withRange(Object.assign({midi: lo}, A.music.spell(lo, false)), hi));
      down = A.chromaticScale(withRange(Object.assign({midi: lo}, A.music.spell(lo, true)), hi), {down: true}).slice(1);
    } else {
      const mm = o ? withRange(parseNote(o[0]), parseNote(o[1])) : m;
      up = A.chromaticScale(mm); down = A.chromaticScale(mm, {down: true}).slice(1);
    }
    const notes = up.concat(down).map(n => Object.assign({}, n, {sounding: n.midi - m.sounds, pc: mod12(n.midi - m.sounds), show: n, beats: .5}));
    const lo = up[0], hi = up[up.length - 1];
    return {id: 'chrom', name: 'Chromatic', short: 'Chromatic', key: null, sig: null, notes, slurs: [],   // tongued or slurred: the student's choice
      label: `Chromatic (${noteLabel(lo)}${lo.oct} to ${noteLabel(hi)}${hi.oct})`};
  }
  /** the sheet's time limit (s) for a member in a section */
  const auditionTime = (m, sec = 'ms') => (auditionEntry(m, sec) || {}).time || 60;
  /** the sheet's tempo (♩ =) for a member in a section, or null */
  const auditionTempo = (m, sec = 'ms') => (auditionEntry(m, sec) || {}).tempo || null;
  /** the section's WRITTEN range for a member: the widest of its scales and its chromatic {low, high} (midi) */
  function auditionRange(m, sec = 'ms') {
    const all = auditionScales(m, sec).concat([auditionChromatic(m, sec)]).reduce((a, sc) => a.concat(sc.notes), []);
    const ms = all.map(n => n.midi);
    return {low: Math.min(...ms), high: Math.max(...ms)};
  }

  /** a scale sequence at least `count` notes long: the scale up and down, then again from the second note */
  function sequence(scale, count) {
    const out = scale.notes.slice();
    while (out.length < count) out.push(...scale.notes.slice(1));
    return out;
  }

  /** where a game saves progress for a scale (random mode keeps the plain game id) */
  const progressKey = (gameId, scaleId) => `${gameId}:scale-${scaleId}`;

  A.Scales = {LIST, START, build, sequence, progressKey, keySignature, sigAcc, shown, ruleStart, startMidi,
    AUDITION, AUDITION_ORDER, AUDITION_CHROM, CHROMATIC_HS, SECTIONS, CONCERT, audition, auditionEntry, auditionScales,
    auditionChromatic, auditionTime, auditionTempo, auditionRange, rhythmOf};
})(window.Arcade);
