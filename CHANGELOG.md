# Changelog

## 1.5.0 — 2026-11-10
- **The sight-reading instructions now play Mat's own recording** (8.6 s) instead of the device's voice, so every device hears the same thing. The 8 ticks start the moment it ends.
- The recording says "30 seconds," so it plays when study time is 30 s (the default). At 60 s or with no study time, the device's voice reads the matching script instead.
- On iPads and iPhones (Safari 17+), the instructions, ticks, and Hear It now play even with the ringer switch on silent.
- **↺ Start over** works at any point in the sequence (tempo and study time stay locked until you restart).

## 1.4.0 — 2026-11-10
- **The judge's instructions can be read aloud.** "🔊 Read the instructions aloud" is on the instruction screen (on by default, remembered per device). Tapping **▶ Read the instructions + give the tempo** speaks the script in the device's own voice. The 8 ticks start right after "Here is the tempo," and the rest of the sequence runs by itself, so a student can run a mock alone.
- Uses the browser's built-in voice (works offline, nothing new to load). It picks the most natural English voice the device has. If a device has no voice, the sequence goes straight to the ticks.

## 1.3.0 — 2026-11-10
- **"Put it on the stand" now runs the real audition sequence:**
  1. The music is covered, and the judge's instructions show in large type to read aloud: "You will have 30 seconds to study this music. You may not produce a tone on your instrument during the study time. Here is the tempo:"
  2. **▶ Give the tempo** plays 8 ticks at the etude's tempo.
  3. After the 8th tick the music is revealed and the 30-second study clock starts by itself.
  4. When time is up, 8 more ticks play, and the student plays on the next beat.
- Play/Hear buttons stay hidden during the sequence. Afterward: Hear It, Play it again, or **↺ Start over**.
- The instructions follow the study-time setting (30 s, 60 s, or off). Tempo and study time can only be changed before the tempo starts.
- Practice mode (from results) keeps the simpler study → count-in → play flow.

## 1.2.0 — 2026-11-10
- **Sight-reading etudes from First Sight (Band Arcade), built into every sight-reading section.**
  - Generate an original etude for the student's instrument. Default is Level 5 · District Ready, 6 bars, any concert key; level, key, and length are adjustable. Or type in an etude code.
  - **Put it on the stand:** a full-screen music stand with a study countdown (30 s by default; 60 s or off), then a one-bar count-in. The click and **Hear It** are available but stay out of the way in a mock: the click is off by default, and Hear It asks before playing until the student has played.
  - State rounds get separate etudes for Sight Reading #1 and #2. Percussion gets a snare etude (rhythm) and a bells etude for mallets/xylophone. Timpani isn't supported yet.
  - Grades 9–12 can use it too, labeled as middle-school-level reading practice.
  - The etude code is saved with the mock. Results show a **Practice it** button (also in share links). Print / Save PDF adds a page with the etude.

## 1.1.0 — 2026-11-10
- New look in the Raven Band style: navy and gold, with Oswald headings bundled with the site so they load on school networks.
- New splash page:
  - Full-width navy hero with a sample filled-in judge sheet.
  - Bold grade cards that show what's on each audition.
  - A "How it works" strip.
- New "Pick up where you left off" row: resume an unfinished mock or jump to a recent student's history.
- Navy top bar with a gold total. Section titles, student names, and totals use the new heading style.
- Footer credit: Built by Mat Graham · Raven Band, STEM Academy @ Bartlett. The tool itself stays neutrally named for colleagues.

## 1.0.2 — 2026-11-10
- Wind scale boxes now start at 0 points. One tap marks ✓; tap again to set it back to 0. No more double-tapping for a zero, and no red ✗ marks.
- Unmarked scale boxes count as earned zeros and are no longer flagged. The results page flags a scale section only if nothing in it was tapped (it was probably skipped).
- "✓ all" toggles a whole scale between all correct and all 0.
- Unmarked boxes appear under "Scale spots to fix" on the results page and the printout.
- Percussion mallet scales are unchanged: they use point chips (0 is one tap) and keep "Mark blanks ✗".

## 1.0.1 — 2026-11-10
- The blank-box warning on the results page now names each blank box (e.g., "Bb (C) arpeggio").
- New **Count blank scale boxes as ✗** button on the results page turns blank scale boxes into 0-point ✗ marks in one tap. Blank rubric categories still stay flagged, because those are usually forgotten, not zero.
- New **Mark blanks ✗** button in each scale section, for teachers who only tap what was played correctly.
- **Go to first blank** opens the sheet at the first blank box and highlights it.
- Clearer scale hint: tap once for ✓ (1 point), twice for ✗ (0 points).

## 1.0.0 — 2026-11-10
First release.
- Choose grade band (6–8, 9–10, 11–12), instrument, and First Round (District) or Final Round (State). The tool opens the matching GMEA 2025–26 judge sheet.
- Tap-to-score sheets:
  - Per-octave scale cells, with the adjustment factor shown.
  - Rubric chips and sliders that match each form's point scale.
  - Live total.
- Scale tools: "Start from perfect", timer with the official time limits, and a metronome at audition tempo.
- Per-section comments with quick-tap phrases, plus overall comments.
- Results:
  - Recommendation-line gauge and section scores.
  - "Where the points went" and scale spots to fix.
  - Strengths and focus areas, a sight-reading gap insight, and a weekly practice plan.
- Student self-assessment: the student scores first, then hands off to the teacher. Results compare the two side by side.
- Printing: a print/PDF copy of the filled-in judge sheet plus a feedback page.
- Share links: read-only, with a QR code. No data leaves the device except inside the link.
- Per-student history with a score chart, plus export/import backup.
- Dark mode, and works on phones, iPads, Chromebooks, and viewboards.
