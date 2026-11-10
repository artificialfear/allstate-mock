/* ============================================================
   Feedback library: maps judge-sheet categories to student-facing
   names, practice drills, and quick-tap judge comments.
   ============================================================ */

function catKeyFor(label) {
  const l = label.toLowerCase();
  if (l.startsWith('tone quality') || l === 'tone production' || l.includes('technique/tone')) return 'tone';
  if (l === 'technique' || l === 'mallet technique') return 'technique';
  if (l.startsWith('rhythmic')) return 'rhythm';
  if (l.startsWith('articulation')) return 'artic';
  if (l.startsWith('dynamics')) return 'dynamics';
  if (l.startsWith('interpretation') || l.startsWith('phrasing')) return 'interp';
  if (l.startsWith('rudiment')) return 'rudiments';
  if (l.startsWith('roll')) return 'rolls';
  if (l.startsWith('tempo/pulse')) return 'pulse';
  if (l === 'accuracy' || l === 'note accuracy') return 'accuracy';
  if (l.includes('tuning') || l.startsWith('pitch changes')) return 'tuning';
  if (l.startsWith('chromatic')) return 'chromatic';
  return 'general';
}

const CATS = {
  scales:       { name: 'Major scales & arpeggios',
    tips: ['Play each scale slowly with a metronome, then raise the tempo 4 bpm at a time until you reach audition tempo.',
           'Practice the scale you missed first, every day, before the ones you already know.',
           'Run all of your scales in audition order without stopping, from memory, once a day.'] },
  malletscales: { name: 'Mallet scales',
    tips: ['Practice each scale hands-separate, then together, with a metronome. Raise the tempo 4 bpm at a time.',
           'Say the note names out loud while you play to lock in the key signature.',
           'Run the full set in order once a day with a timer to stay under the time limit.'] },
  chromatic:    { name: 'Chromatic scale',
    tips: ['Practice in 4-note groups with a metronome, slurred and tongued.',
           'Mark the trouble spots (register breaks, alternate fingerings) and loop just those two or three notes.',
           'Record yourself; listen for uneven notes and any spots that rush.'] },
  tone:         { name: 'Tone quality',
    tips: ['Start each practice with 5 minutes of long tones across your whole range.',
           'Play your etude’s slowest phrase at half tempo, focusing only on a full, centered sound.',
           'Listen to a professional recording on your instrument before you practice and copy that sound.'] },
  technique:    { name: 'Technique',
    tips: ['Find the 2–3 hardest measures and loop them slowly. Speed up only when they are perfect three times in a row.',
           'Practice tricky runs in different rhythms (long-short, short-long), then go back to even notes.',
           'Check hand position and posture in a mirror while you play the hard spots.'] },
  rhythm:       { name: 'Rhythmic accuracy',
    tips: ['Count and clap the rhythm out loud before you play it.',
           'Practice with the metronome on beats 2 and 4, or on the off-beats, so you feel the pulse yourself.',
           'Write in the counts above tricky rhythms. Subdivide on long notes and rests.'] },
  artic:        { name: 'Articulation & style',
    tips: ['Circle every articulation marking in your etude and play the passage exaggerating each one.',
           'Practice the articulations on one note before adding the pitches.',
           'Ask yourself what style each phrase is (smooth, light, marcato) and make the difference obvious.'] },
  dynamics:     { name: 'Dynamics & phrasing',
    tips: ['Mark every dynamic change and make the contrast twice as big as feels natural; judges hear less than you think.',
           'Sing each phrase, then shape it the same way on your instrument. Know where each phrase is heading.',
           'Record yourself and check that soft and loud sound clearly different.'] },
  interp:       { name: 'Interpretation & tempo',
    tips: ['Check your tempo with a metronome at the start of every run. Don’t let nerves rush you.',
           'Listen to a model recording and note the tempo, style, and where the music breathes.',
           'Perform the whole piece without stopping, as if for a judge, at least once every day.'] },
  rudiments:    { name: 'Rudiment quality',
    tips: ['Play the etude’s rudiments slow–fast–slow with a metronome, aiming for even heights and sounds.',
           'Practice on a pad in a mirror and check stick heights and matching strokes.',
           'Isolate flams and drags. Grace notes should be low and close.'] },
  rolls:        { name: 'Roll quality',
    tips: ['Practice rolls with a metronome, counting the subdivision so the roll stays even and connected.',
           'Work on roll releases. Know exactly which beat the roll ends on.',
           'Practice crescendo/decrescendo rolls without changing the speed of the roll.'] },
  pulse:        { name: 'Tempo & pulse control',
    tips: ['Practice with a metronome, then turn it off halfway through and see if you’re still with it when it comes back on.',
           'Watch the spots where you rush (rolls, loud passages) and where you drag (soft or busy passages).',
           'Count the first measure out loud before you start, to set the tempo.'] },
  accuracy:     { name: 'Accuracy',
    tips: ['Slow the etude down until it’s 100% correct, then raise the tempo gradually.',
           'Mark sticking, dynamics, and accidentals in the music before practicing.',
           'Do daily mock run-throughs from the top without stopping.'] },
  tuning:       { name: 'Tuning',
    tips: ['Practice tuning to a reference pitch and checking it by singing or humming the pitch into the drum.',
           'Practice pitch changes during rests in the etude while counting out loud.',
           'Use a tuner to check yourself after you tune by ear.'] },
  general:      { name: 'General musicianship', tips: ['Record yourself and listen back with the judge sheet in hand.'] },
};

/* Extra practice cards that come from patterns, not one category */
const PATTERN_TIPS = {
  sightReading: {
    name: 'Sight-reading routine',
    tips: ['Use the study time: check the key signature, time signature, accidentals, rhythms, dynamics, and articulations before playing.',
           'Sight-read one new short exercise every day. Easy material is fine; the habit matters more than the difficulty.',
           'Keep going no matter what. Don’t stop or fix mistakes; holding a steady pulse earns more points than correct notes played out of time.'] },
};

/* Quick-tap comments the judge can drop into a section's comment box */
const QUICK = {
  scales:       ['Strong — clean and confident', 'Missed key signature note', 'Hesitation between scales', 'Rushed the tempo', 'Uneven top octave', 'Arpeggio needs work', 'Not memorized yet'],
  malletscales: ['Strong — clean and confident', 'Missed key signature note', 'Uneven sticking', 'Rushed the tempo', 'Hesitation between scales', 'Arpeggio needs work'],
  chromatic:    ['Even and clean', 'Rushed the top', 'Fingering slips at the break', 'Uneven tempo', 'Missed notes on the descent'],
  wind:         ['Beautiful sound', 'Pinched/thin upper register', 'Breathy tone', 'Watch pitch on long notes', 'Rushing the 16ths', 'Note accuracy in fast passages', 'Articulations not clear', 'Bigger dynamic contrast', 'Shape the phrases more', 'Tempo too slow', 'Tempo too fast', 'Breathing breaks the phrase', 'Great style!'],
  sight:        ['Kept a steady pulse — great!', 'Stopped to fix mistakes — keep going', 'Missed the key signature', 'Missed accidentals', 'Ignored dynamics', 'Rhythms in the dotted/syncopated spots', 'Use your study time to scan the whole exercise'],
  perc:         ['Clean and confident', 'Uneven stick heights', 'Roll not connected', 'Rushed the loud sections', 'Watch the grace notes', 'Bigger dynamic contrast', 'Check tempo at the start', 'Tuning was off', 'Great sound quality'],
};

function quickFor(sec, form) {
  if (sec.kind === 'windScales') return QUICK.scales;
  if (sec.kind === 'malletScales') return QUICK.malletscales;
  if (sec.catKey === 'chromatic') return QUICK.chromatic;
  if (form.inst === 'percussion') return QUICK.perc;
  if (sec.sightReading) return QUICK.sight;
  return QUICK.wind;
}

/* Calibration guide shown in Help (a suggested guide, not GMEA language) */
const CALIBRATION = [
  ['90–100% of the category', 'Clearly ready for the audition. Consistent, characteristic, and confident; any flaws are minor and isolated.'],
  ['75–89%', 'Solid, with a few flaws that are consistent enough for a judge to notice.'],
  ['60–74%', 'Developing. Problems show up regularly and affect the performance.'],
  ['40–59%', 'Inconsistent. The basic skill is still being built.'],
  ['Below 40%', 'Not yet prepared in this area.'],
];
