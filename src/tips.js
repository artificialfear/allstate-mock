/* ============================================================
   INSTRUMENT-SPECIFIC PRACTICE TIPS
   Each instrument family can add tips for a feedback category (CATS keys in feedback.js). tipsFor() puts the
   family's tips first, then the general ones, so every practice plan item is about THIS instrument.
   Brass tips say "partial", never "lip" (Mat's teaching rule). Mat reviews this file before each season.
   ============================================================ */
const INST_FAMILY = {
  flute: 'flute', oboe: 'reed', bassoon: 'reed', clarinet: 'clar', bassclar: 'clar', contraclar: 'clar',
  altosax: 'sax', tenorsax: 'sax', barisax: 'sax', trumpet: 'trumpet', horn: 'horn',
  trombone: 'lowbrass', basstrombone: 'lowbrass', baritone: 'lowbrass', tuba: 'lowbrass', percussion: 'perc',
};
const INST_TIPS = {
  flute: {
    tone: ['Play harmonics: finger low C and blow faster to sound the next partials (C, G, C, E). Then play those notes with their normal fingerings and match the harmonic sound.',
           'Long tones in all three octaves with a tuner. Keep the lip opening small and relaxed; speed up the air for the high octave instead of pinching.'],
    technique: ['Keep your right pinky down on the D♯ key for almost every note. It steadies the flute and keeps the notes in tune.',
                'Pick your B♭ fingering on purpose: thumb B♭ in flat keys, 1-and-1 or the lever when a B natural is close by. Mark it in the music.'],
    dynamics: ['Flutes go flat when soft and sharp when loud. Do crescendo–decrescendo long tones with a tuner. Aim the air a little higher (jaw forward) for soft notes and lower for loud ones.'],
    artic: ['Tongue just behind the top teeth ("too") and keep the air moving between notes, so short notes still ring.'],
    scales: ['Do the high octave slowly with a tuner first. Faster air, not more pressure, makes the top notes speak.'],
    chromatic: ['Use 1-and-1 or the lever B♭ (not thumb B♭) in the chromatic so your thumb never slides mid-scale.'],
  },
  reed: {
    tone: ['Check your reed before you practice: it should crow (two octaves, oboe) or buzz evenly (bassoon). Rotate three good reeds so you are never stuck on one.',
           'Long tones with a round, cushioned embouchure. Biting makes the sound thin and sharp; support with air instead.'],
    technique: ['Mark the special fingerings in your music (oboe: forked F or left F and the half-hole; bassoon: the flick keys and the whisper key) and practice those spots slowly.'],
    artic: ['Tongue lightly on the tip of the reed and keep the air going. Don’t let the embouchure bite between notes.'],
    dynamics: ['Practice soft entrances on long tones: start the air first, then the sound. Soft playing is where reed players lose the most points.'],
    scales: ['Slur each scale slowly and listen for the notes that crack or jump in pitch; those are your reed- or fingering-check notes.'],
  },
  clar: {
    tone: ['Firm, flat chin and corners in. Keep the tongue high ("eee") and the air fast so the upper (clarion) notes sound full, not thin.',
           'Long tones over the break with a tuner. The upper notes should sound as full as the low ones.'],
    technique: ['Crossing the break: keep your right-hand fingers down on the throat tones (G♯, A, B♭) and move only the left hand.',
                'Plan your pinky keys (left or right) for B, C, C♯ and E♭ so you never slide one pinky from key to key. Mark L or R in the music.'],
    scales: ['Slur over the break slowly, two notes at a time, until the crossing is silent. Then add the full scale.'],
    chromatic: ['Use the side keys for the throat B♭ only where your teacher shows you, and choose your pinky keys before you play.'],
    artic: ['Tongue touches the reed tip lightly ("tee") and the air never stops. Practice on one note before the etude.'],
  },
  sax: {
    tone: ['Play the mouthpiece alone and match its pitch (alto: concert A, tenor: concert G, bari: concert D) to set your air and voicing.',
           'For low notes: open the throat, use a little less mouthpiece pressure, and more air, so low C and B♭ come out soft and without a honk.'],
    technique: ['Pick one B♭ fingering on purpose: bis or 1-and-1 in flat keys, side B♭ in chromatic passages. Mark it and play it the same way every time.',
                'Keep fingers close to the pearls and the palm keys under the left hand, so fast passages stay even.'],
    dynamics: ['High notes go sharp when soft. Practice soft high long tones with a tuner and relax the jaw slightly instead of biting.'],
    artic: ['Tongue the tip of the reed lightly ("dah") and keep the air steady, so notes don’t bump.'],
    chromatic: ['Use side B♭ and side C (or side F♯) in the chromatic. Practice the palm-key notes at the top slowly.'],
  },
  trumpet: {
    tone: ['Buzz the opening phrase of your etude on the mouthpiece, then play it. Aim for the same centered buzz.',
           'Partial slurs every day on all seven valve combinations (0, 2, 1, 12, 23, 13, 123). They center each note and build range.'],
    technique: ['Press the valves all the way down and fast; slow valves cause smeared notes. Practice tricky valve changes slowly with a metronome.'],
    scales: ['Before every high note, hear the pitch in your head so you land on the right partial instead of cracking to the one next to it.'],
    dynamics: ['Low D and C♯ (1-3 and 1-2-3) are very sharp. Kick out the third-valve slide on those notes.'],
    artic: ['Tongue with "tah" for regular notes and "dah" for legato, with steady air behind every note.'],
  },
  horn: {
    tone: ['Right hand cupped with fingers together and the palm against the far side of the bell. It shapes your sound and your pitch.',
           'Partial slurs every day. On horn the partials are close together up high, so slur slowly and listen.'],
    technique: ['High notes sit on partials that are very close together. Sing or buzz the pitch before you play it so you land on the right one.',
                'On a double horn, use the B♭ side (thumb) in the upper register the way your teacher shows you, and mark it in the music.'],
    scales: ['Play each scale slowly with a drone or tuner. Most horn misses are the wrong partial, not the wrong fingering.'],
    dynamics: ['Practice soft entrances in the middle register. Start the air before the tongue, so the note speaks on time.'],
  },
  lowbrass: {
    tone: ['Breathe low and relaxed and keep the throat open. Buzz long tones on the mouthpiece, then play them on the instrument with the same feel.',
           'Partial slurs every day (trombone: in each position; baritone and tuba: on each valve combination) to center your sound.'],
    technique: ['Trombone: move the slide at the last moment and fast, and use a soft "dah" tongue for legato. Baritone and tuba: keep the valves fast and fully down.',
                'Trombone: use alternate positions (like 4th-position D or 6th-position F) to avoid long slide jumps in fast passages.'],
    dynamics: ['Valve combinations 1-3 and 1-2-3 run sharp. Bring those notes down with your air and embouchure, or use the 4th valve if your instrument has one.'],
    scales: ['Slur every scale slowly first. Listen for the partial changes, then add the tongue and the tempo.'],
    artic: ['Use more air, not more tongue, on low notes, so short notes still have a full sound.'],
  },
  perc: {
    rudiments: ['Practice the etude’s rudiments slow–fast–slow on a pad with a metronome. Let the stick rebound and keep both hands at the same height.'],
    rolls: ['Snare: keep a double-stroke or buzz roll even by counting the subdivision. Timpani: slower, even single strokes; let the drum ring between strokes.'],
    malletscales: ['Strike the center of the bar (or the edge of the raised bars), keep wrists loose, and look one note ahead. Say the note names while you practice.'],
    tuning: ['Hum the pitch into the drum (or tap it lightly) and adjust the pedal. Check with a tuner afterward, not before.'],
    technique: ['Play from the wrists with relaxed fingers. Tight grips cause uneven sound on every instrument.'],
    tone: ['Snare: play in the center to slightly off-center for the best sound. Mallets: hit the bar center. Timpani: play a hand’s width in from the edge.'],
    pulse: ['Practice with a metronome, then with the click on beats 2 and 4 only, so you keep the time yourself.'],
  },
};
/** tips for a category: this instrument's first, then the general ones (no repeats) */
function tipsFor(catKey, inst) {
  const fam = INST_FAMILY[inst];
  const own = (fam && INST_TIPS[fam] && INST_TIPS[fam][catKey]) || [];
  const gen = (CATS[catKey] || CATS.general).tips;
  return own.concat(gen.filter((t) => !own.includes(t)));
}
