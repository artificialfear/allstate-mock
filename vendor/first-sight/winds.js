/* Band Arcade: THE WIND VOICES (Arcade.Winds; docs/engine/sound.md). Synthesized band instruments for games that make
   every sound themselves (Perfect Pitch first; any later game may use them). Everything plays on the arcade's own output
   (shared/sfx.js Sfx.output(): the first tap unlocks it; SOUND OFF and the EFFECTS slider apply; never an AudioContext
   of its own).

   THE PITCHED-AUDIO RULE (CLAUDE.md hard rules): only a game with NO MICROPHONE may use these, and every sound here
   REFUSES to play while Arcade.Pitch.listening() (such a game never listens; the guard keeps the rule honest).

   A VOICE is a recipe in the WINDS block below: a PeriodicWave (its harmonic recipe) through a low-pass that opens with
   the attack and settles, plus a soft band-passed breath. No vibrato: tuning needs a steady tone. Built like Slide
   Quest's horn (slide-quest/brass.js, which keeps its own copy; it could move here later).
   THE REFERENCE is a tuner's tone, deliberately a different timbre: a mellow sine with a quiet 2nd and 3rd harmonic
   (Slide Quest's DRONE). With a voice it BEATS (wah-wah-wah), slower as the two get closer.

     Winds.play(voice, f, {sec})            a timed note (→ a handle {stop(), onEnd} or null: sound off, locked, listening)
     Winds.phrase(voice, notes, {lead})     a MELODY scheduled on the audio clock: notes = [{f, at (s from the phrase's
                                            start), sec, gain (1 = normal)}] → a handle {stop(), onEnd, t0 (the context
                                            time of at = 0)} or null; stop() silences every note, sounding or waiting
                                            (First Sight's ▶ HEAR IT)
     Winds.start(voice, f)                  a HELD note (→ true / false); Winds.setFreq(f) glides it; Winds.stop() releases it
     Winds.playing()                        is the held note sounding?
     Winds.ref(f, {sec})                    the reference tone for sec seconds (→ a handle or null)
     Winds.together(voice, f, fRef, {sec})  the voice and the reference at once, so they beat (→ a handle or null)
     Winds.stopAll()                        everything off (pause, leaving, a hidden page)
     Winds.VOICES                           the voice names
     Winds.test                             tests: {history, live(), target(), voiceStart(), render(voice, f, fRef, sec, rate)}
   Loaded after sfx.js. */
window.Arcade = window.Arcade || {};
(function (A) {
  'use strict';

  /* ================= THE VOICES: every number of the sound, tune by ear =================
     Each voice:
       vol       its loudness, into the EFFECTS bus
       harm      the harmonic recipe: harm(k) = harmonic k's loudness (k = 1 … n)       n  how many harmonics
       open / openS / settle / settleS   THE ATTACK: the low-pass opens to `open` × the pitch in `openS` seconds, then
                 settles to `settle` × the pitch (a time constant of settleS / 3)
       minCut / maxCut   Hz: the low-pass never closes below / opens above these (low notes keep the harmonics that
                 carry them on tablet speakers; no fizz)
       q         the low-pass's resonance        attackS / releaseS   the level's rise and fall (s)
       breath    {vol, freq, q}: band-passed noise under the tone (a flute's air is louder than a brass player's)
     Change a number, reload the page, play the game: it is the test. */
  const BRASS = {vol: 0.34, n: 24, harm: k => ({2: 1.3, 3: 1.2}[k] || 1) / Math.pow(k, 0.7),   // Slide Quest's BRASS
    open: 9, openS: 0.04, settle: 4.5, settleS: 0.15, minCut: 900, maxCut: 9000, q: 0.8, attackS: 0.018, releaseS: 0.08,
    breath: {vol: 0.018, freq: 1800, q: 0.7}};
  const WINDS = {
    // FLUTE: nearly a sine, a soft 2nd harmonic, a breathy air layer, a gentle attack
    flute: {vol: 0.36, n: 6, harm: k => [0, 1, 0.2, 0.07, 0.03, 0.015, 0.008][k],
      open: 7, openS: 0.07, settle: 5, settleS: 0.2, minCut: 1200, maxCut: 9000, q: 0.5, attackS: 0.06, releaseS: 0.1,
      breath: {vol: 0.03, freq: 2600, q: 0.6}},
    // CLARINET: strong ODD harmonics (1, 3, 5, 7), weak even ones, a woody low-pass
    clarinet: {vol: 0.3, n: 15, harm: k => k % 2 ? [0, 1, 0, 0.6, 0, 0.38, 0, 0.24, 0, 0.12, 0, 0.07, 0, 0.04, 0, 0.02][k] : 0.025 / k,
      open: 7, openS: 0.04, settle: 4, settleS: 0.15, minCut: 1000, maxCut: 7000, q: 0.6, attackS: 0.025, releaseS: 0.08,
      breath: {vol: 0.012, freq: 2200, q: 0.7}},
    // SAX: bright, every harmonic, a reedy 1/k^0.9 roll-off, a quick attack
    sax: {vol: 0.28, n: 24, harm: k => 1 / Math.pow(k, 0.9),
      open: 10, openS: 0.03, settle: 6, settleS: 0.12, minCut: 1000, maxCut: 9000, q: 0.9, attackS: 0.012, releaseS: 0.07,
      breath: {vol: 0.016, freq: 2400, q: 0.8}},
    // BRASS: Slide Quest's horn (trumpet, trombone)
    brass: BRASS,
    // HORN: the brass voice, darker (a lower settle)
    horn: Object.assign({}, BRASS, {settle: 2.8, open: 6, minCut: 700}),
    // LOW BRASS: darker still (euphonium, baritone, tuba)
    lowbrass: Object.assign({}, BRASS, {settle: 2.2, open: 5, minCut: 650, maxCut: 6000}),
    // MALLET (bells, for First Sight's ▶ HEAR IT): a struck bar: a quick attack, then it rings away (decayS); nearly no air
    mallet: {vol: 0.3, n: 8, harm: k => [0, 1, 0.05, 0.28, 0.02, 0.12, 0, 0.05, 0][k], decayS: 1.1,
      open: 12, openS: 0.006, settle: 6, settleS: 0.4, minCut: 2000, maxCut: 12000, q: 0.5, attackS: 0.004, releaseS: 0.25,
      breath: {vol: 0.001, freq: 4000, q: 0.7}},
    // THE REFERENCE (a tuner's tone; Slide Quest's DRONE): a sine with a quiet 2nd and 3rd harmonic, faded in and out
    ref: {vol: 0.26, harmonics: [1, 0.22, 0.1], fadeIn: 0.3, fadeOut: 0.3},
    glide: 0.012,                 // s: a held note's glide (setTargetAtTime's time constant) as the mechanism moves
  };
  const VOICES = ['flute', 'clarinet', 'sax', 'brass', 'horn', 'lowbrass', 'mallet'];
  /* each instrument member's voice (shared/instruments.js ids): First Sight plays an etude in the student's own sound.
     (Perfect Pitch keeps its own table in perfect-pitch/instruments.js.) */
  const VOICE_FOR = {flute: 'flute', oboe: 'sax', clarinet: 'clarinet', basscl: 'clarinet', bassoon: 'sax', altosax: 'sax', tenorsax: 'sax',
    barisax: 'sax', trumpet: 'brass', horn: 'horn', trombone: 'brass', baritonetc: 'lowbrass', euphbc: 'lowbrass', tuba: 'lowbrass', bells: 'mallet'};

  const history = [];
  const now = () => performance.now();
  const log = e => { history.push(Object.assign({at: Math.round(now())}, e)); if (history.length > 80) history.shift(); };
  const listening = () => !!(A.Pitch && A.Pitch.listening && A.Pitch.listening());
  function output() {
    if (listening()) return null;                         // the rule: never a pitched sound while a mic listens
    const o = A.Sfx && A.Sfx.output && A.Sfx.output();
    if (!o) return null;
    if (o.ctx.state !== 'running') o.ctx.resume().catch(() => {});
    return o;
  }

  /* the waves and the breath's noise, made once per context */
  const waves = new WeakMap(), noises = new WeakMap();
  function wave(ctx, name) {
    let w = waves.get(ctx); if (!w) { w = {}; waves.set(ctx, w); }
    if (w[name]) return w[name];
    let im;
    if (name === 'ref') { im = new Float32Array(WINDS.ref.harmonics.length + 1); WINDS.ref.harmonics.forEach((h, i) => { im[i + 1] = h; }); }
    else { const V = WINDS[name]; im = new Float32Array(V.n + 1); for (let k = 1; k <= V.n; k++) im[k] = V.harm(k) || 0; }
    return (w[name] = ctx.createPeriodicWave(new Float32Array(im.length), im));
  }
  function noise(ctx) {
    let b = noises.get(ctx); if (b) return b;
    const n = Math.round(ctx.sampleRate * 1.5); b = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    noises.set(ctx, b); return b;
  }
  const cutFor = (V, f, k) => Math.max(V.minCut, Math.min(V.maxCut, f * k));

  /* A VOICE on any context (the game's output, or a test's OfflineAudioContext); sec = null: held */
  function buildVoice(ctx, dest, name, f, t, sec, gain = 1) {
    const V = WINDS[name];
    const osc = ctx.createOscillator(), lp = ctx.createBiquadFilter(), env = ctx.createGain(), out = ctx.createGain();
    osc.setPeriodicWave(wave(ctx, name)); osc.frequency.setValueAtTime(f, t);
    lp.type = 'lowpass'; lp.Q.value = V.q;
    lp.frequency.setValueAtTime(cutFor(V, f, 1.5), t);
    lp.frequency.linearRampToValueAtTime(cutFor(V, f, V.open), t + V.openS);
    lp.frequency.setTargetAtTime(cutFor(V, f, V.settle), t + V.openS, V.settleS / 3);
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + V.attackS);
    if (V.decayS) env.gain.setTargetAtTime(0, t + V.attackS, V.decayS / 3);               // a struck voice rings away
    out.gain.value = V.vol * gain;
    osc.connect(lp); lp.connect(env); env.connect(out); out.connect(dest);
    const ns = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    ns.buffer = noise(ctx); ns.loop = true;
    bp.type = 'bandpass'; bp.frequency.value = V.breath.freq; bp.Q.value = V.breath.q;
    ng.gain.value = V.breath.vol / V.vol;
    ns.connect(bp); bp.connect(ng); ng.connect(env);
    osc.start(t); ns.start(t);
    const v = {ctx, name, osc, lp, env, out, ns, freq: f, t0: t, sec, stopped: false};
    if (sec != null) {
      const end = t + Math.max(V.attackS, sec);
      if (V.decayS) env.gain.setTargetAtTime(0, end, V.releaseS / 3);                     // (no jump back up first)
      else { env.gain.setValueAtTime(1, end); env.gain.linearRampToValueAtTime(0, end + V.releaseS); }
      osc.stop(end + V.releaseS + 0.03); ns.stop(end + V.releaseS + 0.03);
    }
    return v;
  }
  /* THE REFERENCE on any context */
  function buildRef(ctx, dest, f, t, sec) {
    const R = WINDS.ref, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.setPeriodicWave(wave(ctx, 'ref')); osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(R.vol, t + R.fadeIn);
    osc.connect(g); g.connect(dest); osc.start(t);
    if (sec != null) {
      const end = t + Math.max(R.fadeIn, sec);
      g.gain.setValueAtTime(R.vol, end); g.gain.linearRampToValueAtTime(0, end + R.fadeOut); osc.stop(end + R.fadeOut + 0.05);
    }
    return {ctx, name: 'ref', osc, g, freq: f, t0: t, sec, stopped: false};
  }
  function release(v, s) {
    if (!v || v.stopped) return;
    v.stopped = true;
    const t = v.ctx.currentTime, g = v.name === 'ref' ? v.g.gain : v.env.gain;
    s = s != null ? s : v.name === 'ref' ? WINDS.ref.fadeOut : WINDS[v.name].releaseS;
    try { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + s); v.osc.stop(t + s + 0.03); if (v.ns) v.ns.stop(t + s + 0.03); } catch (e) {}
  }

  /* ================= TIMED SOUNDS (play, ref, together): each a handle; stopAll ends them ================= */
  const timed = [];
  function handle(voices, sec, kind) {
    const h = {voices, sec, kind, onEnd: null, done: false,
      stop() { if (h.done) return; h.done = true; clearTimeout(h.timer); voices.forEach(v => release(v)); drop(h); }};
    const tail = Math.max(...voices.map(v => v.name === 'ref' ? WINDS.ref.fadeOut : WINDS[v.name].releaseS));
    h.timer = setTimeout(() => { h.done = true; voices.forEach(v => { v.stopped = true; }); drop(h); if (h.onEnd) h.onEnd(); }, (sec + tail) * 1000);
    timed.push(h);
    return h;
  }
  function drop(h) { const i = timed.indexOf(h); if (i >= 0) timed.splice(i, 1); }
  const known = v => !!WINDS[v] && v !== 'ref' && v !== 'glide';
  function play(voice, f, {sec = 1.6} = {}) {
    const o = known(voice) && f > 0 ? output() : null;
    log({kind: 'play', voice, freq: f, sec, played: !!o});
    if (!o) return null;
    return handle([buildVoice(o.ctx, o.out, voice, f, o.ctx.currentTime + 0.01, sec)], sec, 'play');
  }
  /** a melody: every note built now, each starting at its own time on the audio clock (never a timer per note) */
  function phrase(voice, notes, {lead = 0.12} = {}) {
    const o = known(voice) && notes && notes.length ? output() : null;
    log({kind: 'phrase', voice, notes: notes ? notes.length : 0, played: !!o});
    if (!o) return null;
    const t0 = o.ctx.currentTime + lead;
    const vs = notes.filter(n => n.f > 0 && n.sec > 0).map(n => buildVoice(o.ctx, o.out, voice, n.f, t0 + n.at, n.sec, n.gain == null ? 1 : n.gain));
    if (!vs.length) return null;
    const end = Math.max(0, ...notes.map(n => n.at + n.sec));
    const h = handle(vs, lead + end, 'phrase'), stopAll = h.stop;
    // a note still waiting to start is cancelled outright (stop before its start: it never sounds)
    h.stop = () => { if (h.done) return; const now = o.ctx.currentTime; vs.forEach(v => { if (v.t0 > now + 0.01 && !v.stopped) { v.stopped = true; try { v.osc.stop(0); v.ns.stop(0); } catch (e) {} } }); stopAll(); };
    h.t0 = t0;
    return h;
  }
  function ref(f, {sec = 1.6} = {}) {
    const o = f > 0 ? output() : null;
    log({kind: 'ref', freq: f, sec, played: !!o});
    if (!o) return null;
    return handle([buildRef(o.ctx, o.out, f, o.ctx.currentTime + 0.01, sec)], sec, 'ref');
  }
  function together(voice, f, fRef, {sec = 1.6} = {}) {
    const o = known(voice) && f > 0 && fRef > 0 ? output() : null;
    log({kind: 'together', voice, freq: f, ref: fRef, sec, played: !!o});
    if (!o) return null;
    const t = o.ctx.currentTime + 0.01;
    return handle([buildVoice(o.ctx, o.out, voice, f, t, sec), buildRef(o.ctx, o.out, fRef, t, sec)], sec, 'together');
  }

  /* ================= THE HELD NOTE: bends with the mechanism while it is dragged ================= */
  let held = null;
  function start(voice, f) {
    const o = known(voice) && f > 0 ? output() : null;
    if (!o) { log({kind: 'start', voice, freq: f, played: false}); return false; }
    if (held && !held.stopped && held.ctx === o.ctx && held.name === voice) { setFreq(f); return true; }   // already sounding: it glides
    stop();
    held = buildVoice(o.ctx, o.out, voice, f, o.ctx.currentTime + 0.005, null);
    log({kind: 'start', voice, freq: f, played: true});
    return true;
  }
  function setFreq(f) {
    if (!held || held.stopped || !(f > 0)) return false;
    const V = WINDS[held.name], t = held.ctx.currentTime;
    held.osc.frequency.cancelScheduledValues(t); held.osc.frequency.setTargetAtTime(f, t, WINDS.glide);
    held.lp.frequency.cancelScheduledValues(t); held.lp.frequency.setTargetAtTime(cutFor(V, f, V.settle), t, WINDS.glide);
    held.freq = f;
    return true;
  }
  function stop() { release(held); }
  const playing = () => !!held && !held.stopped;
  function stopAll() { stop(); timed.slice().forEach(h => h.stop()); }

  A.Winds = {
    WINDS, VOICES, VOICE_FOR, voiceFor: id => VOICE_FOR[id] || 'flute', play, phrase, ref, together, start, setFreq, stop, playing, stopAll,
    busy: () => playing() || timed.length > 0,
    test: {
      history,
      /** the held note's oscillator frequency right now (what the audio engine plays), or null */
      live: () => held && !held.stopped ? held.osc.frequency.value : null,
      /** the frequency the held note is headed for */
      target: () => held && !held.stopped ? held.freq : null,
      /** when the held note's voice started (its context time): a glide never changes it */
      voiceStart: () => held && !held.stopped ? held.t0 : null,
      /** a voice (or null) at f and the reference (or null) at fRef together for `sec` s in an OfflineAudioContext
          (mono) → Promise<{data: Float32Array, rate}>: THE TIMBRES and THE BEATS, checked offline */
      render(voice, f, fRef = null, sec = 2, rate = 22050) {
        const C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const ctx = new C(1, Math.round(rate * sec), rate);
        if (voice) buildVoice(ctx, ctx.destination, voice, f, 0, null);
        if (fRef) buildRef(ctx, ctx.destination, fRef, 0, null);
        return ctx.startRendering().then(b => ({data: b.getChannelData(0), rate}));
      },
    },
  };
})(window.Arcade);
