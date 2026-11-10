/* ============================================================
   GMEA All-State Band audition forms (2025–26) encoded as data.
   Source: GMEA district (first round) and state (final round)
   audition forms + GMEA MS scale sheets 2025–26.
   HS district wind scale tables live in hs_district.js (generated
   straight from the PDF text).
   ============================================================ */

const LEVELS = {
  ms:        { id: 'ms',        grades: '6–8',   band: 'All State Middle School Band', short: 'Middle School', tempo: 120 },
  concert:   { id: 'concert',   grades: '9–10',  band: 'All State Concert Band',      short: 'Concert Band',  tempo: 132 },
  symphonic: { id: 'symphonic', grades: '11–12', band: 'All State Symphonic Band',    short: 'Symphonic Band', tempo: 144 },
};

const INSTRUMENTS = [
  { id: 'flute',        name: 'Flute',              fam: 'Woodwinds' },
  { id: 'oboe',         name: 'Oboe',               fam: 'Woodwinds' },
  { id: 'bassoon',      name: 'Bassoon',            fam: 'Woodwinds' },
  { id: 'clarinet',     name: 'Clarinet',           fam: 'Woodwinds' },
  { id: 'bassclar',     name: 'Bass Clarinet',      fam: 'Woodwinds' },
  { id: 'contraclar',   name: 'Contra Clarinet',    fam: 'Woodwinds' },
  { id: 'altosax',      name: 'Alto Saxophone',     fam: 'Woodwinds' },
  { id: 'tenorsax',     name: 'Tenor Saxophone',    fam: 'Woodwinds' },
  { id: 'barisax',      name: 'Baritone Saxophone', fam: 'Woodwinds' },
  { id: 'trumpet',      name: 'Trumpet',            fam: 'Brass' },
  { id: 'horn',         name: 'French Horn',        fam: 'Brass' },
  { id: 'trombone',     name: 'Trombone',           fam: 'Brass' },
  { id: 'basstrombone', name: 'Bass Trombone',      fam: 'Brass', hsOnly: true },
  { id: 'baritone',     name: 'Baritone',           fam: 'Brass' },
  { id: 'tuba',         name: 'Tuba',               fam: 'Brass' },
  { id: 'percussion',   name: 'Percussion',         fam: 'Percussion' },
];

/* Instruments whose HS state form carries the "Division Preference: Band | Orchestra | None" line */
const ORCH_INSTRUMENTS = ['flute', 'oboe', 'bassoon', 'clarinet', 'trumpet', 'horn', 'trombone', 'basstrombone', 'tuba', 'percussion'];

/* ---------- Middle school district (first round) winds ----------
   Concert scales F, Bb, Eb, Ab. Octaves per scale read from the GMEA
   2025–26 MS scale sheets; they reproduce every printed adjustment
   factor (raw max × factor = 30). Written keys added for transposing
   instruments (the official MS form lists concert names only). */
const MS_KEYS = ['F', 'Bb', 'Eb', 'Ab'];
const W_Bb = ['G', 'C', 'F', 'Bb'];   // Bb instruments
const W_Eb = ['D', 'G', 'C', 'F'];    // Eb instruments
const W_F  = ['C', 'F', 'Bb', 'Eb'];  // F horn
const MS_DISTRICT = {
  flute:      { oct: [2, 1, 2, 1], factor: 1.875, cut: 85 },
  oboe:       { oct: [1, 1, 1, 1], factor: 2.5,   cut: 80 },
  bassoon:    { oct: [2, 2, 2, 1], factor: 1.667, cut: 70 },
  clarinet:   { oct: [2, 2, 2, 2], factor: 1.5,   cut: 85, written: W_Bb },
  bassclar:   { oct: [2, 1, 2, 1], factor: 1.875, cut: 70, written: W_Bb },
  contraclar: { factor: 1.875, cut: 70, variants: {
                  eb:  { label: 'Eb Contra', oct: [1, 2, 1, 2], written: W_Eb },
                  bbb: { label: 'BBb Contra', oct: [2, 1, 2, 1], written: W_Bb } }, defaultVariant: 'bbb' },
  altosax:    { oct: [2, 1, 2, 1], factor: 1.875, cut: 85, written: W_Eb },
  tenorsax:   { oct: [1, 2, 1, 1], factor: 2.143, cut: 80, written: W_Bb },
  barisax:    { oct: [2, 1, 2, 1], factor: 1.875, cut: 80, written: W_Eb },
  trumpet:    { oct: [2, 1, 1, 1], factor: 2.143, cut: 80, written: W_Bb },
  horn:       { oct: [1, 2, 1, 1], factor: 2.143, cut: 70, written: W_F },
  trombone:   { oct: [2, 1, 1, 1], factor: 2.143, cut: 70 },
  baritone:   { oct: [2, 1, 1, 1], factor: 2.143, cut: 70, variants: {
                  bc: { label: 'Bass clef', oct: [2, 1, 1, 1] },
                  tc: { label: 'Treble clef', oct: [2, 1, 1, 1], written: W_Bb } }, defaultVariant: 'bc' },
  tuba:       { oct: [2, 1, 1, 1], factor: 2.143, cut: 70 },
};

/* Known printed-form anomalies, reproduced on purpose so mock scores match the real sheet */
const FORM_NOTICES = {
  'district.concert.tenorsax': 'GMEA’s printed 9–10 Tenor Sax form uses an adjustment factor of 0.9375, but its scale maximums add up to 34 (the factor should be about 0.8824). This tool follows the printed form, so a perfect scale run scores 31.88 instead of 30.',
  'district.symphonic.basstrombone': 'GMEA’s printed 11–12 Bass Trombone form uses an adjustment factor of 0.5770, but its scale maximums add up to 50 (the factor should be 0.6000). This tool follows the printed form, so a perfect scale run scores 28.85 instead of 30.',
};

const SCALE_TIME_LIMIT = { ms: 60 };                 // MS wind scale sheets: "Time Limit = 1:00"
const MALLET_TIME_LIMIT = { ms: 75, concert: 135, symphonic: 210 }; // percussion scale sheet

/* ---------- rubric category sets ---------- */
const R6 = ['Tone Quality', 'Technique', 'Rhythmic Accuracy', 'Articulation/Style', 'Dynamics/Phrasing', 'Interpretation/Tempo'];
const SR_MS_STATE = ['Rhythmic Accuracy', 'Tone Quality', 'Technique', 'Interpretation/Tempo'];
const SR_HS_STATE = ['Tone Quality', 'Technique', 'Rhythmic Accuracy', 'Articulation/Style/Dynamics', 'Phrasing/Interpretation/Tempo'];

function items(labels, max, step = 0.5) {
  return labels.map((label, i) => ({ id: 'c' + i, label, max, step }));
}
function itemsMax(pairs, step = 0.5) {
  return pairs.map(([label, max], i) => ({ id: 'c' + i, label, max, step }));
}
const sum = (a) => a.reduce((x, y) => x + y, 0);

/* ---------- form builders ---------- */
function buildForm(level, round, inst, variant) {
  const L = LEVELS[level];
  const instMeta = INSTRUMENTS.find((i) => i.id === inst);
  const key = `${round}.${level}.${inst}`;
  const form = {
    key, level, round, inst, variant: variant || null,
    title: `${L.band} (Grades ${L.grades.replace('–', '-')})`,
    subtitle: (inst === 'percussion' ? 'Percussion ' : 'Wind Instrument ') + (round === 'district' ? 'District' : 'State') + ' Audition Form',
    instrumentLabel: instMeta.name,
    division: round === 'state' && level !== 'ms' && ORCH_INSTRUMENTS.includes(inst),
    cut: null,
    notices: [],
    sections: [],
  };
  if (FORM_NOTICES[key]) form.notices.push(FORM_NOTICES[key]);

  if (inst === 'percussion') {
    round === 'district' ? buildPercDistrict(form, level) : buildPercState(form);
  } else if (round === 'district') {
    buildWindDistrict(form, level, inst, variant);
  } else {
    buildWindState(form, level);
  }
  form.max = sum(form.sections.map((s) => s.max));
  return form;
}

function buildWindDistrict(form, level, inst, variant) {
  let rows, factor, cut;
  if (level === 'ms') {
    const d = MS_DISTRICT[inst];
    let oct = d.oct, written = d.written;
    if (d.variants) {
      const v = d.variants[variant || d.defaultVariant];
      form.variant = variant || d.defaultVariant;
      form.variantLabel = v.label;
      oct = v.oct; written = v.written;
    }
    rows = MS_KEYS.map((k, i) => ({ id: 'r' + i, concert: k, written: written ? written[i] : '', oct: oct[i] }));
    factor = d.factor; cut = d.cut;
  } else {
    const d = HS_DISTRICT[level][inst];
    rows = d.scales.map(([concert, written, max], i) => ({ id: 'r' + i, concert, written, oct: (max - 1) / 2 }));
    factor = d.factor; cut = d.cut;
  }
  form.cut = cut;
  const rawMax = sum(rows.map((r) => 2 * r.oct + 1));
  form.sections.push({
    id: 'scales', title: 'Major Scales and Arpeggios', kind: 'windScales', rows, factor, rawMax,
    max: rawMax * factor, maxLabel: 30, catKey: 'scales',
    timeLimit: SCALE_TIME_LIMIT[level] || null, tempo: LEVELS[level].tempo,
    help: 'One point for each octave played correctly ascending, one for each octave descending, and one for the arpeggio. From memory, per the GMEA scale sheet.',
  });
  form.sections.push({ id: 'chrom', title: 'Chromatic Scale', kind: 'rubric', max: 10, catKey: 'chromatic',
    items: [{ id: 'c0', label: 'Chromatic Scale', max: 10, step: 0.5, catKey: 'chromatic' }] });
  form.sections.push({ id: 'lyr', title: 'Lyrical Etude', kind: 'rubric', max: 30, items: items(R6, 5) });
  form.sections.push({ id: 'sr', title: 'Sight Reading Exercise', kind: 'rubric', max: 30, items: items(R6, 5), sightReading: true });
}

function buildWindState(form, level) {
  if (level === 'ms') {
    form.sections.push({ id: 'prep', title: 'Prepared Selection', kind: 'rubric', max: 60, items: items(R6, 10) });
    form.sections.push({ id: 'sr1', title: 'Sight Reading #1', kind: 'rubric', max: 20, items: items(SR_MS_STATE, 5), sightReading: true });
    form.sections.push({ id: 'sr2', title: 'Sight Reading #2', kind: 'rubric', max: 20, items: items(SR_MS_STATE, 5), sightReading: true });
  } else {
    form.sections.push({ id: 'et1', title: 'Etude #1', kind: 'rubric', max: 30, items: items(R6, 5) });
    form.sections.push({ id: 'et2', title: 'Etude #2', kind: 'rubric', max: 30, items: items(R6, 5) });
    form.sections.push({ id: 'sr1', title: 'Sight Reading #1', kind: 'rubric', max: 20, items: items(SR_HS_STATE, 4), sightReading: true });
    form.sections.push({ id: 'sr2', title: 'Sight Reading #2', kind: 'rubric', max: 20, items: items(SR_HS_STATE, 4), sightReading: true });
  }
}

function buildPercDistrict(form, level) {
  const scaleCfg = { ms: [8, 4], concert: [4, 2], symphonic: [3, 1] }[level];
  const keys = { ms: MS_KEYS, concert: ['G', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'],
    symphonic: ['G', 'C', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'B', 'E', 'A', 'D'] }[level];
  const S = form.sections;
  S.push({ id: 'sn_et', group: 'Snare Drum', title: 'Snare — Etude Performance', kind: 'rubric', max: 60,
    items: itemsMax([['Rudiment Quality', 15], ['Roll Quality', 15], ['Tempo/Pulse Control', 15], ['Accuracy', 15]]) });
  S.push({ id: 'sn_sr', group: 'Snare Drum', title: 'Snare — Sight Reading', kind: 'rubric', max: 40, sightReading: true,
    items: itemsMax([['Rhythmic Accuracy', 20], ['Technique/Tone Production', 10], ['Dynamics/Expression', 10]]) });
  S.push({ id: 'ma_sc', group: 'Mallets', title: 'Mallets — Major Scales', kind: 'malletScales', max: 48, catKey: 'malletscales',
    scaleMax: scaleCfg[0], arpMax: scaleCfg[1], rows: keys.map((k, i) => ({ id: 'r' + i, concert: k })),
    timeLimit: MALLET_TIME_LIMIT[level], tempo: LEVELS[level].tempo,
    help: `Two octaves each, from memory, in the order listed (QN=${LEVELS[level].tempo}). Up to ${scaleCfg[0]} points per scale and ${scaleCfg[1]} per arpeggio.` });
  S.push({ id: 'ma_ch', group: 'Mallets', title: 'Mallets — Chromatic Scale', kind: 'rubric', max: 12, catKey: 'chromatic',
    help: '2-octave chromatic starting on C, played after the major scales (not included in the time limit).',
    items: [{ id: 'c0', label: 'Chromatic Scale', max: 12, step: 0.5, catKey: 'chromatic' }] });
  S.push({ id: 'ma_sr', group: 'Mallets', title: 'Mallets — Sight Reading', kind: 'rubric', max: 40, sightReading: true,
    items: itemsMax([['Rhythmic Accuracy', 15], ['Technique/Tone Production', 15], ['Dynamics/Expression', 10]]) });
  S.push({ id: 'ti_et', group: 'Timpani', title: 'Timpani — Etude Performance', kind: 'rubric', max: 60,
    items: itemsMax([['Tuning Accuracy', 15], ['Roll Quality', 15], ['Tempo/Pulse Control', 15], ['Accuracy', 15]]) });
  S.push({ id: 'ti_sr', group: 'Timpani', title: 'Timpani — Sight Reading', kind: 'rubric', max: 40, sightReading: true,
    items: itemsMax([['Rhythmic Accuracy', 20], ['Technique/Tone Production', 10], ['Dynamics/Expression', 10]]) });
}

function buildPercState(form) {
  const S = form.sections;
  const P = 'Practice breakdown: the official state percussion form records only section totals (snare 60/40, xylophone 60/40, timpani 50/30/20). The categories inside each section are borrowed from the district form so students get specific feedback; they add up to the official totals.';
  form.notices.push(P);
  S.push({ id: 'sn_et', group: 'Snare Drum', title: 'Snare — Etude', kind: 'rubric', max: 60, practice: P,
    items: itemsMax([['Rudiment Quality', 15], ['Roll Quality', 15], ['Tempo/Pulse Control', 15], ['Accuracy', 15]]) });
  S.push({ id: 'sn_sr', group: 'Snare Drum', title: 'Snare — Sight Reading', kind: 'rubric', max: 40, practice: P, sightReading: true,
    items: itemsMax([['Rhythmic Accuracy', 20], ['Technique/Tone Production', 10], ['Dynamics/Expression', 10]]) });
  S.push({ id: 'xy_et', group: 'Xylophone', title: 'Xylophone — Etude', kind: 'rubric', max: 60, practice: P,
    items: itemsMax([['Tone Production', 15], ['Mallet Technique', 15], ['Tempo/Pulse Control', 15], ['Note Accuracy', 15]]) });
  S.push({ id: 'xy_sr', group: 'Xylophone', title: 'Xylophone — Sight Reading', kind: 'rubric', max: 40, practice: P, sightReading: true,
    items: itemsMax([['Rhythmic Accuracy', 15], ['Technique/Tone Production', 15], ['Dynamics/Expression', 10]]) });
  S.push({ id: 'ti_et', group: 'Timpani', title: 'Timpani — Etude', kind: 'rubric', max: 50, practice: P,
    items: itemsMax([['Roll Quality', 15], ['Tempo/Pulse Control', 15], ['Accuracy', 20]]) });
  S.push({ id: 'ti_sr', group: 'Timpani', title: 'Timpani — Sight Reading', kind: 'rubric', max: 30, practice: P, sightReading: true,
    items: itemsMax([['Rhythmic Accuracy', 15], ['Technique/Tone Production', 10], ['Dynamics/Expression', 5]]) });
  S.push({ id: 'ti_tu', group: 'Timpani', title: 'Timpani — Tuning', kind: 'rubric', max: 20, practice: P,
    items: itemsMax([['Initial Tuning', 10], ['Pitch Changes', 10]]) });
}

/* What appears on each round, for the round-picker cards */
function roundSummary(level, round, inst) {
  if (inst === 'percussion') {
    return round === 'district'
      ? ['Snare: etude + sight reading', 'Mallets: major scales, chromatic, sight reading', 'Timpani: etude + sight reading', 'Scored out of 300']
      : ['Snare: etude + sight reading', 'Xylophone: etude + sight reading', 'Timpani: etude, sight reading, tuning', 'Scored out of 300'];
  }
  if (round === 'district') {
    const n = level === 'ms' ? 4 : level === 'concert' ? 8 : 12;
    return [`${n} major scales + arpeggios (30)`, 'Chromatic scale (10)', 'Lyrical etude (30)', 'Sight reading (30)'];
  }
  return level === 'ms'
    ? ['Prepared selection (60)', 'Sight reading #1 (20)', 'Sight reading #2 (20)']
    : ['Etude #1 (30)', 'Etude #2 (30)', 'Sight reading #1 (20)', 'Sight reading #2 (20)'];
}
