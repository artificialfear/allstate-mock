/* ============================================================
   SIGHT READING: First Sight etudes inside the mock audition.
   The generator, notation, voices and click are Band Arcade's First Sight engine (vendor/first-sight/, copied
   unchanged; src/fs-shim.js gives it a sound output). This file is the mock tool's glue:
     • which First Sight instrument reads for each sight-reading section (fsMember)
     • the etude panel on the judge sheet (fsPanel) — the code is saved on the mock: m.sight = {sectionId: code}
     • the full-screen MUSIC STAND (fsOpenStand): study countdown, count-in / click, Hear It, tempo
     • the etude on results (fsResultsBlock), in the printout (fsPrintPages), and in share links (packMock 'sr')
   An etude CODE (5E6-K7QX) is the same music on every device, so a student can replay it later.
   Loaded before app.js (app.js's boot render uses these); uses app.js's S, FORM, store, esc, $, toast at call time.
   ============================================================ */
const FS = window.Arcade.FSEtudes;
const FS_DEFAULTS = { level: 5, key: 'mix', bars: 6, studyS: 30, click: false, speak: true };
const FS_HS_NOTE = 'First Sight writes middle-school district-level etudes (concert F, B♭, E♭, A♭). They make good reading practice, but real 9–12 sight reading is harder.';
const FS_RULES = { tempoStep: 4, tempoMin: 40, tempoOver: 16, leadS: 0.25,
  gain: { p: 0.42, mp: 0.58, mf: 0.75, f: 1 }, accent: 1.3, length: { normal: 0.9, stac: 0.45, ten: 1, slur: 1 },
  clickGain: 0.5, clickDown: 0.8, minScale: 0.8 };   // the same numbers as First Sight's RULES

function fsPrefs() { return Object.assign({}, FS_DEFAULTS, (store.get(LS.prefs, {}).fs) || {}); }
function fsSavePrefs(p) { const all = store.get(LS.prefs, {}); all.fs = Object.assign(fsPrefs(), p); store.set(LS.prefs, all); }

/* which First Sight member reads this section's etude; null = none (timpani) */
const FS_MEMBER = { flute: 'flute', oboe: 'oboe', bassoon: 'bassoon', clarinet: 'clarinet', bassclar: 'basscl', altosax: 'altosax',
  tenorsax: 'tenorsax', barisax: 'barisax', trumpet: 'trumpet', horn: 'horn', trombone: 'trombone', basstrombone: 'trombone', tuba: 'tuba' };
function fsMember(form, sec, m) {
  const A = window.Arcade;
  if (form.inst === 'percussion') {
    if (sec.id.startsWith('sn')) return { member: A.memberById('snare'), label: 'Snare drum' };
    if (sec.id.startsWith('ma') || sec.id.startsWith('xy')) return { member: A.memberById('bells'), label: sec.id.startsWith('xy') ? 'Xylophone (bells part)' : 'Mallets (bells part)' };
    return null;
  }
  if (form.inst === 'baritone') {
    const clef = m.sightBari || (m.variant === 'tc' ? 'tc' : 'bc');
    return { member: A.memberById(clef === 'tc' ? 'baritonetc' : 'euphbc'), label: clef === 'tc' ? 'Baritone (treble clef)' : 'Baritone (bass clef)', bari: clef };
  }
  if (form.inst === 'contraclar') {
    const eb = m.variant === 'eb';
    return { member: A.memberById(eb ? 'barisax' : 'basscl'), label: eb ? 'E♭ Contra Clarinet' : 'B♭ Contra Clarinet', octDown: true,
      note: `Written like the ${eb ? 'baritone sax' : 'bass clarinet'} part. Hear It plays it an octave lower.` };
  }
  return { member: A.memberById(FS_MEMBER[form.inst]), label: form.instrumentLabel };
}
function fsBuild(code, info) {
  const et = FS.make(FS.parseCode(code));
  const real = FS.realize(et, info.member);
  if (info.octDown) real.notes.forEach((n) => { if (n) n.sounding -= 12; });
  return { et, real };
}
const fsPitched = (info) => info.member.pitched !== false;
function fsDescribe(et, info) {
  const L = FS.LEVELS[et.level - 1];
  return `Level ${L.n} · ${L.name} · ${fsPitched(info) ? 'Concert ' + et.keyName + ' · ' : ''}${et.meter} · ${et.bars} bars`;
}
/** a quarter (or dotted quarter) note for tempo markings, drawn (fonts draw ♩ too small) */
const fsNoteIcon = (dotted) => `<svg class="fs-q" viewBox="0 0 ${dotted ? 20 : 14} 30" aria-hidden="true"><ellipse cx="6" cy="24" rx="5.6" ry="4.2" transform="rotate(-20 6 24)" fill="currentColor"/><path d="M10.6 23V2" stroke="currentColor" stroke-width="1.8"/>${dotted ? '<circle cx="16" cy="24" r="1.9" fill="currentColor"/>' : ''}</svg>`;
const fsTempoMark = (et, bpm) => `<b>${esc(et.tempoWord)}</b> ${fsNoteIcon(et.compound)} = ${bpm || et.tempo}`;

/* ---------- engraving: rows of bars (First Sight's layout: 4 a row, 3 for 6 bars, 2 when it gets too small) ---------- */
function fsRowsOf(et, real, nb, idPrefix) {
  const rows = [];
  for (let from = 0; from < et.bars; from += nb) rows.push([from, Math.min(et.bars, from + nb)]);
  return rows.map(([from, to]) => {
    const t0 = from * et.barTicks, evs = [];
    et.events.filter((e) => e.bar >= from && e.bar < to).forEach((e) => {
      const prev = evs[evs.length - 1];
      if (e.tiedFrom && prev && prev.src.tieNext && et.events[e.i - 1].bar >= from) { prev.beats += e.d / 12; prev.tieOut = false; return; }
      const r = real.notes[e.i];
      const ev = { t: (e.t - t0) / 12, beats: e.d / 12, rest: e.rest, n: r ? r.n : null, id: e.rest ? undefined : `${idPrefix}${e.i}`, src: e,
        trip: e.trip || undefined, art: e.art.length ? e.art.slice() : undefined, dyn: e.dyn, hair: e.hair, hairEnd: e.hairEnd,
        slur: e.slur, slurFirst: e.slurFirst, slurLast: e.slurLast, tieIn: !!e.tiedFrom, tieOut: !!e.tieNext, label: '' };
      if (real.unpitched) { ev.n = null; ev.slur = undefined; ev.art = ev.art && ev.art.filter((k) => k === 'acc'); if (ev.art && !ev.art.length) ev.art = undefined; }
      evs.push(ev);
    });
    evs.forEach((ev) => { if (ev.tieOut && evs.indexOf(ev) < evs.length - 1) ev.tieOut = false; });
    return { from, to, evs, t0 };
  });
}
function fsEngrave(et, real, availW, idPrefix = 'fse') {
  const N = window.Arcade.Notation;
  const opts = (r, k, width) => ({ clef: real.clef, sig: real.sig, per: et.per, timeSig: et.ts, measures: r.to - r.from, events: r.evs,
    header: 'full', showTime: k === 0, captions: false, final: r.to === et.bars, groupBeats: 1, width,
    label: k === 0 ? `The etude, bars ${r.from + 1} to ${r.to}` : `Bars ${r.from + 1} to ${r.to}` });
  const wide = et.bars === 6 ? 3 : 4;
  let built = null, W = 0;
  // phones: 2 bars a row, or 1 when 2 would shrink the notes below 75% (dense level 5–6 bars)
  const tries = availW < 520 ? [2, 1] : [wide, 2];
  for (const nb of tries) {
    built = fsRowsOf(et, real, nb, idPrefix);
    W = Math.max(...built.map((r, k) => N.engrave(opts(r, k)).vb.w));
    if (nb === tries[tries.length - 1] || availW / W >= (availW < 520 ? 0.75 : FS_RULES.minScale)) break;
  }
  const width = Math.max(W, availW);
  return built.map((r, k) => Object.assign(r, { E: N.engrave(opts(r, k, width)) }));
}
const fsRowsHTML = (rows) => rows.map((r, k) => `<div class="fs-row" data-row="${k}">${r.E.svg}<i class="fs-marker" hidden></i></div>`).join('');

/* ---------- the panel on the judge sheet ---------- */
function fsPanel(sec) {
  const m = S.mock, info = fsMember(FORM, sec, m);
  if (!info || !info.member) {
    return `<div class="fs-box"><div class="fs-h"><b>Sight-reading etude</b></div>
      <p class="help">First Sight doesn’t write timpani etudes yet. Use your own timpani sight-reading example for this section.</p></div>`;
  }
  const code = (m.sight || {})[sec.id];
  const hs = m.level !== 'ms';
  if (!code || !FS.parseCode(code)) return fsSetup(sec, info, hs);
  const { et } = fsBuild(code, info);
  return `<div class="fs-box">
    <div class="fs-h"><b>Sight-reading etude</b><span class="fs-code" title="The same code is the same music on any device">${esc(et.code)}</span></div>
    <div class="fs-meta">${esc(info.label)} · ${esc(fsDescribe(et, info))}</div>
    ${info.note ? `<p class="help tiny">${esc(info.note)}</p>` : ''}
    <div class="fs-paper fs-preview" data-fs-preview="${sec.id}" role="img" aria-label="Sight-reading etude preview"></div>
    <div class="fs-actions">
      <button class="btn gold" data-act="fsstand" data-v="${sec.id}">⛶ Put it on the stand</button>
      <button class="btn sm" data-act="fsnew" data-v="${sec.id}">New etude</button>
      <button class="btn sm ghost" data-act="fsclear" data-v="${sec.id}">Change settings</button>
    </div>
  </div>`;
}
function fsSetup(sec, info, hs) {
  const p = fsPrefs(), pitched = fsPitched(info);
  const opt = (v, cur, label) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${label}</option>`;
  return `<div class="fs-box fs-setup">
    <div class="fs-h"><b>Sight-reading etude</b><span class="fs-tag">First Sight</span></div>
    <p class="help">Generate an original etude for ${esc(info.label)} and put it on the stand when the student reaches this section. ${hs ? esc(FS_HS_NOTE) : ''}</p>
    ${info.note ? `<p class="help tiny">${esc(info.note)}</p>` : ''}
    <div class="fs-opts">
      <label class="fld"><span>Level</span><select data-fsopt="level">${FS.LEVELS.map((L) => opt(L.n, p.level, `${L.n} · ${L.name}${L.n === 5 ? ' (district audition)' : ''}`)).join('')}</select></label>
      ${pitched ? `<label class="fld"><span>Key</span><select data-fsopt="key">${opt('mix', p.key, 'Surprise me')}${FS.KEYS.map((k) => opt(k, p.key, 'Concert ' + FS.KEY_NAME[k])).join('')}</select></label>` : ''}
      <label class="fld"><span>Length</span><select data-fsopt="bars">${opt(6, p.bars, '6 bars (audition length)')}${opt(8, p.bars, '8 bars')}</select></label>
      ${info.bari ? `<label class="fld"><span>Clef</span><select data-fsopt="bari">${opt('bc', info.bari, 'Bass clef')}${opt('tc', info.bari, 'Treble clef')}</select></label>` : ''}
    </div>
    <div class="fs-actions">
      <button class="btn primary" data-act="fsgen" data-v="${sec.id}">Generate etude</button>
      <form class="fs-codeform" data-fscode="${sec.id}"><input aria-label="Etude code" placeholder="or type a code: 5E6-K7QX" autocomplete="off" spellcheck="false"><button class="btn sm" type="submit">Use code</button></form>
    </div>
  </div>`;
}
function fsGenerate(secId, keepKeyOf) {
  const p = fsPrefs(), sec = FORM.sections.find((x) => x.id === secId), info = fsMember(FORM, sec, S.mock);
  let key = p.key === 'mix' || !FS.KEYS.includes(p.key) ? FS.KEYS[Math.floor(Math.random() * FS.KEYS.length)] : p.key;
  let level = p.level, bars = p.bars;
  if (keepKeyOf) { const c = FS.parseCode(keepKeyOf); level = c.level; bars = c.bars; if (p.key !== 'mix') key = c.key; }
  if (!fsPitched(info)) key = 'Bb';
  S.mock.sight = S.mock.sight || {};
  S.mock.sight[secId] = FS.code({ level, key, bars, seed: FS.newSeed() });
  touch(); refreshSection(secId);
}
/* draw every preview on the page (after render / refreshSection) */
function fsPaintPreviews(root = document) {
  $$('[data-fs-preview]', root).forEach((el) => {
    const sec = FORM.sections.find((x) => x.id === el.dataset.fsPreview);
    const info = sec && fsMember(FORM, sec, S.mock);
    const code = S.mock.sight && S.mock.sight[sec.id];
    if (!info || !code) return;
    const { et, real } = fsBuild(code, info);
    const rows = fsEngrave(et, real, Math.max(260, el.clientWidth - 16), `pv-${sec.id}-`);
    el.innerHTML = `<div class="fs-tempo">${fsTempoMark(et)}</div><div class="fs-rows">${fsRowsHTML(rows)}</div>`;
  });
}

/* ---------- results + share ---------- */
function fsResultsBlock() {
  const m = S.mock, list = FORM.sections.filter((sec) => m.sight && m.sight[sec.id] && FS.parseCode(m.sight[sec.id]));
  if (!list.length) return '';
  return `<section class="panel">
    <h3>Sight-reading etude${list.length > 1 ? 's' : ''}</h3>
    ${list.map((sec) => {
      const info = fsMember(FORM, sec, m); if (!info || !info.member) return '';
      const { et } = fsBuild(m.sight[sec.id], info);
      return `<div class="fs-res"><div><b>${esc(sec.title)}</b><span class="fs-code">${esc(et.code)}</span>
        <div class="muted small">${esc(fsDescribe(et, info))}</div></div>
        <button class="btn sm gold" data-act="fspractice" data-v="${sec.id}">Practice it ▶</button></div>`;
    }).join('')}
    <p class="muted small">Opens the same etude with a count-in, click, and Hear It to check yourself. The code is the same music on any device, and it also works in Band Arcade’s First Sight.</p>
  </section>`;
}

/* ---------- print: one page per etude ---------- */
function fsPrintPages() {
  const m = S.mock;
  return FORM.sections.filter((sec) => m.sight && m.sight[sec.id] && FS.parseCode(m.sight[sec.id])).map((sec) => {
    const info = fsMember(FORM, sec, m); if (!info || !info.member) return '';
    const { et, real } = fsBuild(m.sight[sec.id], info);
    const rows = fsEngrave(et, real, 680, `pr-${sec.id}-`);
    return `<div class="p-page p-break fs-print">
      <div class="p-title">Sight-Reading Etude · ${esc(sec.title.replace(/^.*— /, ''))}</div>
      <div class="p-sub" style="font-weight:400">${esc(m.student.name || '')} · ${esc(info.label)} · ${esc(fsDescribe(et, info))} · Code ${esc(et.code)}</div>
      <div class="fs-paper"><div class="fs-tempo">${fsTempoMark(et)}</div><div class="fs-rows">${rows.map((r) => `<div class="fs-row">${r.E.svg}</div>`).join('')}</div></div>
      <div class="p-foot">Original etude from First Sight (Band Arcade). Practice it again with code ${esc(et.code)}.</div>
    </div>`;
  }).join('');
}

/* ============================================================
   THE MUSIC STAND (full screen)
   From the judge sheet it runs THE AUDITION SEQUENCE, like the real GMEA sight-reading room (Mat's spec):
     1. brief   — the music is covered; the judge reads the instructions aloud and taps ▶ Give the tempo
     2. tempo1  — 8 ticks at the etude's tempo
     3. study   — after the 8th tick the music is revealed and the study clock (30 s) starts by itself
     4. tempo2  — when time is up, 8 more ticks
     5. perform — on the beat after the 8th tick the student plays (no click, no marker)
   then Hear It / play again / start over. PRACTICE (from results) keeps the looser study → count-in → play flow.
   ============================================================ */
const FS_TICKS = 8;
const FS_JUDGE = (s) => s
  ? `You will have ${s} seconds to study this music. You may not produce a tone on your instrument during the study time. Here is the tempo:`
  : 'You may not produce a tone on your instrument until you begin. Here is the tempo:';
const FSS = { secId: null, et: null, real: null, info: null, rows: [], run: null, studyT: 0, studyLeft: 0, studyOn: false,
  played: false, hearArmed: false, bpm: 0, practice: false, click: false, studyS: 30,
  phase: 'free', tick: null };   // phase: brief | tempo1 | study | tempo2 | perform | free (practice / after the sequence)
function fsOpenStand(secId, { practice = false } = {}) {
  const sec = FORM.sections.find((x) => x.id === secId), info = fsMember(FORM, sec, S.mock);
  const code = S.mock.sight && S.mock.sight[secId];
  if (!info || !info.member || !code) return;
  fsStopRun(); fsStopStudy();
  const p = fsPrefs();
  Object.assign(FSS, fsBuild(code, info), { secId, info, practice, played: false, hearArmed: false, click: practice ? true : !!p.click, studyS: p.studyS,
    speak: !!p.speak && fsCanSpeak() });
  if (FSS.speak) try { speechSynthesis.getVoices(); } catch (e) { /* voices load in the background */ }
  FSS.bpm = FSS.et.tempo;
  const el = $('#stand');
  el.innerHTML = `
    <div class="stand-top">
      <div class="stand-t"><b>${esc(practice ? 'Practice' : sec.title)}</b><span>${esc(info.label)}${practice ? ' · ' + esc(fsDescribe(FSS.et, info)) : ''}</span></div>
      <span class="fs-code light">${esc(FSS.et.code)}</span>
      <button class="btn sm on-navy" data-act="fsclose">${practice ? 'Close ✕' : 'Done — back to scoring ✕'}</button>
    </div>
    <div class="stand-paper fs-paper">
      <div class="fs-tempo" id="fs-tempo">${fsTempoMark(FSS.et)}</div><div class="fs-rows" id="fs-rows"></div>
      ${practice ? '' : `<div class="stand-cover" id="fs-cover">
        <div class="cover-in">
          <div class="cover-k">The judge reads aloud</div>
          <blockquote id="fs-judge">“${esc(FS_JUDGE(FSS.studyS))}”</blockquote>
          <div class="fs-ticks" id="fs-ticks1">${fsTickDots()}</div>
          ${fsCanSpeak() ? `<label class="cover-speak"><input type="checkbox" id="fs-speak" ${FSS.speak ? 'checked' : ''}> 🔊 Read the instructions aloud</label>` : ''}
          <button class="btn gold big" id="fs-give" data-act="fsaud"></button>
          <p class="cover-help" id="fs-cover-help"></p>
        </div>
      </div>`}
    </div>
    <div class="stand-study" id="fs-study" hidden>
      <div class="fs-study-bar"><i id="fs-fill"></i></div>
      <p><b id="fs-left">30</b> <span id="fs-word">seconds to study it.</span> ${practice ? 'Find the key, the time signature, the tricky rhythms and the dynamics.' : 'No sound on the instrument yet.'}</p>
      <button class="btn ${practice ? 'gold' : 'sm'}" data-act="fsready">${practice ? 'I’m ready' : 'Skip ▸'}</button>
    </div>
    <div class="stand-ctl">
      <p class="fs-say" id="fs-say" aria-live="polite"></p>
      <div class="fs-ticks big" id="fs-ticks2" hidden>${fsTickDots()}</div>
      <div class="stand-btns">
        <button class="btn primary big" id="fs-play" data-act="fsplay">▶ Count me in</button>
        <button class="btn big" id="fs-hear" data-act="fshear">▶ Hear it</button>
      </div>
      <div class="stand-opts">
        <span class="fs-tempo-ctl"><button class="btn sm" data-act="fstempo" data-v="-4" aria-label="Slower">−</button><span id="fs-bpm"></span><button class="btn sm" data-act="fstempo" data-v="4" aria-label="Faster">+</button></span>
        <label class="fs-tg"><input type="checkbox" id="fs-click" ${FSS.click ? 'checked' : ''}> Click while playing</label>
        ${practice ? '' : '<button class="btn sm" data-act="fsrestart">↺ Start over</button>'}
        <label class="fs-tg">Study time <select id="fs-studys">${[0, 30, 60].map((s) => `<option value="${s}" ${FSS.studyS === s ? 'selected' : ''}>${s ? s + ' s' : 'Off'}</option>`).join('')}</select></label>
      </div>
    </div>`;
  el.hidden = false;
  document.body.classList.add('stand-open');
  FSS.phase = practice ? 'free' : 'brief';
  fsDrawRows(); fsDrawTempo(); fsDrawButtons(); fsDrawCover();
  if (practice) fsStartStudy();
  else fsSay('');
}
const fsTickDots = () => Array.from({ length: FS_TICKS }, (x, i) => `<i>${i + 1}</i>`).join('');

/* ---------- the audition sequence ---------- */
/** FS_TICKS clicks at the etude's tempo; dots in `box` light up with each tick; done() fires on the beat after the last */
function fsTickRun(box, done) {
  fsTickStop();
  const A = window.Arcade, o = A.Sfx.output(), beatS = 60 / FSS.bpm;
  const t = { raf: 0, ctx: o ? o.ctx : null, kit: null, bus: null, t0: 0, p0: performance.now(), lit: -1, done: false };
  if (t.ctx) {
    if (t.ctx.state !== 'running') t.ctx.resume().catch(() => {});
    t.bus = t.ctx.createGain(); t.bus.connect(o.out);
    t.kit = A.MHBacking.create(t.ctx, t.bus);
    t.t0 = t.ctx.currentTime + FS_RULES.leadS;
    for (let i = 0; i < FS_TICKS; i++) t.kit.click(t.t0 + i * beatS, FS_RULES.clickDown, false);
  }
  const now = () => t.ctx ? t.ctx.currentTime - (t.ctx.outputLatency || t.ctx.baseLatency || 0) - t.t0 : (performance.now() - t.p0) / 1000 - FS_RULES.leadS;
  const dots = [...box.children];
  dots.forEach((d) => d.classList.remove('on'));
  box.hidden = false;
  const frame = () => {
    if (FSS.tick !== t) return;
    const n = now(), k = n < 0 ? -1 : Math.min(FS_TICKS - 1, Math.floor(n / beatS));
    if (k !== t.lit) {
      for (let i = t.lit + 1; i <= k; i++) dots[i].classList.add('on');
      dots.forEach((d, i) => d.classList.toggle('now', i === k && n < FS_TICKS * beatS));
      t.lit = k;
    }
    if (n >= FS_TICKS * beatS) { fsTickStop(true); done(); return; }
    t.raf = requestAnimationFrame(frame);
  };
  FSS.tick = t;
  t.raf = requestAnimationFrame(frame);
}
function fsTickStop(finished) {
  const t = FSS.tick; if (!t) return;
  FSS.tick = null;
  cancelAnimationFrame(t.raf);
  if (t.kit) setTimeout(() => { try { t.kit.stopAll(); t.bus.disconnect(); } catch (e) { /* ignore */ } }, finished ? 300 : 0);
}
/* ---------- reading the judge's instructions aloud (the browser's own voice: Web Speech API, works offline) ---------- */
const fsCanSpeak = () => 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
function fsVoice() {
  let vs = [];
  try { vs = speechSynthesis.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang)); } catch (e) { return null; }
  const rank = (v) => (/natural|neural|premium|enhanced/i.test(v.name) ? 0 : 3) + (/en[-_]US/i.test(v.lang) ? 0 : 1)
    + (/google us|samantha|aria|jenny|ava|allison/i.test(v.name) ? -1 : 0) + (v.localService ? 0 : 0.5);
  return vs.sort((a, b) => rank(a) - rank(b))[0] || null;
}
let fsSpeakId = 0;
/** speak `text`, then done(). A safety timer covers browsers that never fire onend (some iPads) or have no voices. */
function fsSpeak(text, done) {
  const id = ++fsSpeakId;
  let over = false;
  const fin = () => { if (over || id !== fsSpeakId) return; over = true; clearTimeout(FSS.speakT); FSS.speaking = false; done(); };
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text), v = fsVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
    u.rate = 0.95; u.pitch = 1; u.volume = 1;
    u.onend = fin; u.onerror = fin;
    FSS.speaking = true;
    speechSynthesis.speak(u);
    FSS.speakT = setTimeout(fin, (text.split(/\s+/).length / 2.2 + 3) * 1000);
  } catch (e) { fin(); }
}
function fsSpeakStop() {
  fsSpeakId++; clearTimeout(FSS.speakT); FSS.speaking = false;
  try { if (fsCanSpeak()) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}
function fsDrawCover() {
  const give = $('#fs-give'), help = $('#fs-cover-help');
  if (!give) return;
  give.textContent = FSS.speak ? '▶ Read the instructions + give the tempo' : '▶ Give the tempo';
  help.textContent = FSS.speak
    ? `The instructions are read aloud, then ${FS_TICKS} ticks. After the ticks, the music appears and the study clock starts by itself. A student can run this alone.`
    : `Read the instructions to the student, then tap. After ${FS_TICKS} ticks the music appears and the study clock starts by itself.`;
}

function fsAudStart() {
  if (FSS.phase !== 'brief') return;
  try { const o = window.Arcade.Sfx.output(); if (o && o.ctx.state !== 'running') o.ctx.resume(); } catch (e) { /* ignore */ }  // unlock audio on this tap
  $('#fs-give').hidden = true;
  const sp = $('.cover-speak'); if (sp) sp.hidden = true;
  if (FSS.speak) {
    FSS.phase = 'speaking';
    $('#fs-cover-help').textContent = 'Listen to the instructions…';
    $('#fs-judge').classList.add('speaking');
    fsDrawButtons();
    fsSpeak(FS_JUDGE(FSS.studyS), () => { if (FSS.phase !== 'speaking') return; $('#fs-judge').classList.remove('speaking'); fsAudTempo1(); });
    return;
  }
  fsAudTempo1();
}
function fsAudTempo1() {
  FSS.phase = 'tempo1';
  $('#fs-cover-help').textContent = 'Here is the tempo…';
  fsDrawButtons();
  fsTickRun($('#fs-ticks1'), () => {
    $('#fs-cover').hidden = true;                 // the music is revealed as the study clock starts
    if (FSS.studyS) { FSS.phase = 'study'; fsDrawButtons(); fsStartStudy(); }
    else fsAudPerform();
  });
}
function fsAudTempo2() {
  FSS.phase = 'tempo2';
  fsDrawButtons();
  fsSay('Time. Here is the tempo again…');
  fsTickRun($('#fs-ticks2'), fsAudPerform);
}
function fsAudPerform() {
  FSS.phase = 'perform';
  FSS.played = true;
  $('#fs-ticks2').hidden = true;
  fsSay('Play! When the student finishes: ▶ Hear it to compare, ↺ Start over, or Done to score it.');
  fsDrawButtons();
}
function fsDrawRows() {
  const box = $('#fs-rows'); if (!box) return;
  FSS.rows = fsEngrave(FSS.et, FSS.real, Math.max(260, box.clientWidth || 800), 'st-');
  box.innerHTML = fsRowsHTML(FSS.rows);
  FSS.lastW = box.clientWidth;
}
function fsDrawTempo() { const b = $('#fs-bpm'); if (b) b.innerHTML = `${fsNoteIcon(FSS.et.compound)} = ${FSS.bpm}`; }
function fsDrawButtons() {
  const run = FSS.run, play = $('#fs-play'), hear = $('#fs-hear');
  if (!play) return;
  play.textContent = run && run.kind === 'play' ? '■ Stop' : FSS.click ? '▶ Play with the click' : '▶ Count me in';
  hear.textContent = run && run.kind === 'hear' ? '■ Stop' : '▶ Hear it';
  hear.classList.toggle('locked', !FSS.played && !FSS.hearArmed);
  const seq = ['brief', 'speaking', 'tempo1', 'study', 'tempo2'].includes(FSS.phase);
  $('.stand-btns').hidden = seq;                                   // no play / hear buttons during the audition sequence
  $('#stand').classList.toggle('running', !!run || (seq && FSS.phase !== 'brief'));
  if (FSS.phase === 'perform') play.textContent = run && run.kind === 'play' ? '■ Stop' : '▶ Play it again';
}
const fsSay = (t) => { const s = $('#fs-say'); if (s) s.textContent = t; };
function fsCloseStand() {
  fsStopRun(); fsStopStudy(); fsTickStop(); fsSpeakStop();
  FSS.phase = 'free';
  try { window.Arcade.Winds.stopAll(); } catch (e) { /* no audio yet */ }
  $('#stand').hidden = true; $('#stand').innerHTML = '';
  document.body.classList.remove('stand-open');
  FSS.secId = null;
}

/* study countdown */
function fsStartStudy() {
  fsStopStudy();
  if (!FSS.studyS) { fsEndStudy(); return; }
  FSS.studyOn = true; FSS.studyLeft = FSS.studyS;
  $('#fs-study').hidden = false; fsSay('');
  fsDrawStudy();
  let last = performance.now();
  FSS.studyT = setInterval(() => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (document.hidden) return;
    FSS.studyLeft = Math.max(0, FSS.studyLeft - dt);
    fsDrawStudy();
    if (FSS.studyLeft <= 0) fsEndStudy();
  }, 200);
}
function fsDrawStudy() {
  const s = Math.ceil(FSS.studyLeft);
  $('#fs-left').textContent = s;
  $('#fs-word').textContent = s === 1 ? 'second to study it.' : 'seconds to study it.';
  $('#fs-fill').style.transform = `scaleX(${FSS.studyS ? FSS.studyLeft / FSS.studyS : 0})`;
}
function fsStopStudy() { clearInterval(FSS.studyT); FSS.studyT = 0; FSS.studyOn = false; const s = $('#fs-study'); if (s) s.hidden = true; }
function fsEndStudy() {
  fsStopStudy();
  if (FSS.phase === 'study') { fsAudTempo2(); return; }
  fsSay(FSS.practice || FSS.click ? 'Your turn! Tap ▶ to play along with the click. Keep going, even after a mistake.'
    : 'Your turn! Tap ▶ Count me in for one bar, then play. Keep going, even after a mistake.');
  fsDrawButtons();
}

/* the run: count-in (1 bar; 2 bars of 2/4 and 6/8), then the click (optional) and a marker; Hear It plays the etude */
function fsTimeline(kind) {
  const et = FSS.et, bpm = FSS.bpm, beatS = 60 / bpm, beatT = et.beatTicks, tickS = beatS / beatT;
  const beatsPerBar = et.barTicks / beatT, countBars = beatsPerBar < 3 ? 2 : 1, countS = countBars * beatsPerBar * beatS;
  const clicks = [];
  for (let b = 0; b < countBars * beatsPerBar; b++) clicks.push({ at: b * beatS, down: b % beatsPerBar === 0 });
  if (FSS.click) for (let b = 0; b < et.bars * beatsPerBar; b++) clicks.push({ at: countS + b * beatS, down: b % beatsPerBar === 0 });
  const notes = [];
  if (kind === 'hear') {
    const G = FS_RULES.gain, evs = et.events;
    let cur = 'mf';
    const base = evs.map((e) => { if (e.dyn) cur = e.dyn; return G[cur] || G.mf; });
    evs.forEach((e, i) => {
      if (!e.hair) return;
      const j = evs.findIndex((x, k) => k > i && x.hairEnd);
      if (j < 0) return;
      const a = base[i], z = G[evs[j].dyn] || base[j];
      for (let k = i; k < j; k++) base[k] = a + (z - a) * (evs[k].t - evs[i].t) / Math.max(1, evs[j].t - evs[i].t);
    });
    evs.forEach((e, i) => {
      if (e.rest || e.tiedFrom) return;
      let d = e.d, k = i;
      while (evs[k].tieNext && evs[k + 1]) { k++; d += evs[k].d; }
      const art = e.art || [], L = FS_RULES.length;
      const frac = art.includes('stac') ? L.stac : art.includes('ten') ? L.ten : e.slur != null && !e.slurLast ? L.slur : L.normal;
      const r = FSS.real.notes[i];
      notes.push({ i, at: countS + e.t * tickS, sec: Math.max(0.06, d * tickS * frac), dur: d * tickS,
        gain: Math.min(1.25, base[i] * (art.includes('acc') ? FS_RULES.accent : 1)), f: r ? 440 * Math.pow(2, (r.sounding - 69) / 12) : 0, acc: art.includes('acc') });
    });
  }
  return { beatS, tickS, countS, endS: countS + et.totalTicks * tickS, clicks, notes, countBars, beatsPerBar };
}
function fsStart(kind) {
  fsStopRun();
  if (FSS.studyOn) fsStopStudy();
  const A = window.Arcade, T = fsTimeline(kind), o = A.Sfx.output();
  const pitched = fsPitched(FSS.info);
  const run = { kind, T, t0: 0, ctx: o ? o.ctx : null, kit: null, voice: null, raf: 0, lit: -1, rowLit: -1, done: false, p0: performance.now() };
  if (run.ctx) {
    if (run.ctx.state !== 'running') run.ctx.resume().catch(() => {});
    const bus = run.ctx.createGain(); bus.gain.value = 1; bus.connect(o.out); run.bus = bus;
    run.kit = A.MHBacking.create(run.ctx, bus);
    if (kind === 'hear' && pitched) {
      const isBells = FSS.info.member.id === 'bells';
      run.voice = A.Winds.phrase(A.Winds.voiceFor(FSS.info.member.id), T.notes.map((n) => ({ f: n.f, at: n.at, sec: isBells ? Math.max(n.sec, 0.6) : n.sec, gain: n.gain })), { lead: FS_RULES.leadS });
      run.t0 = run.voice ? run.voice.t0 : run.ctx.currentTime + FS_RULES.leadS;
    } else run.t0 = run.ctx.currentTime + FS_RULES.leadS;
    T.clicks.forEach((c) => run.kit.click(run.t0 + c.at, c.down ? FS_RULES.clickDown : FS_RULES.clickGain, c.down));
    if (kind === 'hear' && !pitched) T.notes.forEach((n) => run.kit.snare(run.t0 + n.at, Math.min(1, (n.acc ? 1 : 0.62) * n.gain)));
  }
  FSS.run = run;
  fsDrawButtons();
  fsSay(kind === 'play' ? 'Count-in…' : 'Listen…');
  run.raf = requestAnimationFrame(() => fsFrame(run));
}
function fsNow(run) {
  if (run.ctx) return run.ctx.currentTime - (run.ctx.outputLatency || run.ctx.baseLatency || 0) - run.t0;
  return (performance.now() - run.p0) / 1000 - FS_RULES.leadS;
}
function fsFrame(run) {
  if (FSS.run !== run) return;
  const T = run.T, now = fsNow(run);
  if (now < T.countS) {
    const beat = Math.floor(Math.max(0, now) / T.beatS);
    fsSay(now < 0 ? 'Count-in…' : `Count-in: ${Array.from({ length: Math.min(beat + 1, T.countBars * T.beatsPerBar) }, (x, k) => (k % T.beatsPerBar) + 1).join(' ')}`);
  } else {
    const tick = (now - T.countS) / T.tickS, bar = Math.min(FSS.et.bars, Math.floor(tick / FSS.et.barTicks) + 1);
    fsSay(`${run.kind === 'play' ? 'Play!' : 'Listen.'} Bar ${bar} of ${FSS.et.bars}`);
    fsMark(run, tick);
    if (run.kind === 'hear') fsLight(run, now);
  }
  if (now >= T.endS + 0.15) { fsFinish(run, false); return; }
  run.raf = requestAnimationFrame(() => fsFrame(run));
}
function fsMark(run, tick) {
  const et = FSS.et, row = FSS.rows.findIndex((r) => tick < r.to * et.barTicks);
  const k = row < 0 ? FSS.rows.length - 1 : row, r = FSS.rows[k];
  const el = $('#fs-rows') && $('#fs-rows').children[k];
  if (!el) return;
  if (run.rowLit !== k) {
    $$('#fs-rows .fs-marker').forEach((m) => { m.hidden = true; });
    run.rowLit = k;
    el.querySelector('.fs-marker').hidden = false;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const beats = Math.max(0, tick - r.t0) / 12, x = r.E.xAt(beats);
  el.querySelector('.fs-marker').style.left = (100 * x / r.E.vb.w) + '%';
}
function fsLight(run, now) {
  const notes = run.T.notes;
  let k = -1;
  for (let i = 0; i < notes.length && notes[i].at <= now; i++) k = i;
  if (k >= 0 && now >= notes[k].at + notes[k].dur) k = -1;
  if (k === run.lit) return;
  $$('#fs-rows g.fs-on').forEach((g) => g.classList.remove('fs-on'));
  run.lit = k;
  if (k >= 0) { const g = document.getElementById(`st-${notes[k].i}`); if (g) g.classList.add('fs-on'); }
}
function fsFinish(run, stopped) {
  if (run.done) return;
  run.done = true;
  cancelAnimationFrame(run.raf);
  if (run.voice) run.voice.stop();
  if (run.kit) { const k = run.kit; if (stopped) { try { if (k.fade) k.fade(0.02); } catch (e) { /* ignore */ } setTimeout(() => k.stopAll(), 40); } else setTimeout(() => k.stopAll(), 400); }
  if (run.bus) setTimeout(() => { try { run.bus.disconnect(); } catch (e) { /* ignore */ } }, 500);
  $$('#fs-rows .fs-marker').forEach((m) => { m.hidden = true; });
  $$('#fs-rows g.fs-on').forEach((g) => g.classList.remove('fs-on'));
  if (FSS.run === run) FSS.run = null;
  if (run.kind === 'play') {
    if (!stopped) { FSS.played = true; fsSay('Nice work! Tap ▶ Hear it to check yourself, or play it again.'); }
    else fsSay('Stopped. Tap ▶ to start again from the count-in.');
  } else fsSay(stopped ? '' : 'How did yours compare? Play it again if you like.');
  fsDrawButtons();
}
function fsStopRun() { if (FSS.run) fsFinish(FSS.run, true); }

/* stand controls (called from app.js's click / change handlers) */
function fsAction(a, v) {
  switch (a) {
    case 'fsstand': fsOpenStand(v); return true;
    case 'fspractice': fsOpenStand(v, { practice: true }); return true;
    case 'fsclose': fsCloseStand(); return true;
    case 'fsready': fsEndStudy(); return true;
    case 'fsaud': fsAudStart(); return true;
    case 'fsrestart': { const id = FSS.secId; fsCloseStand(); fsOpenStand(id); return true; }
    case 'fsplay': if (FSS.run && FSS.run.kind === 'play') fsStopRun(); else { if (FSS.phase === 'perform') FSS.phase = 'free'; fsStart('play'); } return true;
    case 'fshear':
      if (FSS.run && FSS.run.kind === 'hear') { fsStopRun(); return true; }
      if (!FSS.played && !FSS.hearArmed) {
        FSS.hearArmed = true; fsDrawButtons();
        fsSay('Hear it after the student has played: it shows how the etude goes. Tap ▶ Hear it again to play it now.');
        return true;
      }
      fsStart('hear'); return true;
    case 'fstempo': {
      if (FSS.run || FSS.tick || ['speaking', 'tempo1', 'study', 'tempo2'].includes(FSS.phase)) return true;
      FSS.bpm = Math.max(FS_RULES.tempoMin, Math.min(FSS.et.tempo + FS_RULES.tempoOver, FSS.bpm + +v));
      fsDrawTempo(); return true;
    }
    case 'fsgen': fsGenerate(v); return true;
    case 'fsnew': fsGenerate(v, S.mock.sight[v]); toast('New etude, same level'); return true;
    case 'fsclear': delete S.mock.sight[v]; touch(); refreshSection(v); return true;
  }
  return false;
}
function fsChange(t) {
  if (t.matches('[data-fsopt]')) {
    const k = t.dataset.fsopt;
    if (k === 'bari') { S.mock.sightBari = t.value; touch(); return true; }
    fsSavePrefs({ [k]: k === 'key' ? t.value : +t.value });
    return true;
  }
  if (t.id === 'fs-click') { FSS.click = t.checked; if (!FSS.practice) fsSavePrefs({ click: t.checked }); fsDrawButtons(); return true; }
  if (t.id === 'fs-speak') { FSS.speak = t.checked; fsSavePrefs({ speak: t.checked }); fsDrawCover(); return true; }
  if (t.id === 'fs-studys') {
    FSS.studyS = +t.value; fsSavePrefs({ studyS: FSS.studyS });
    if (FSS.phase === 'brief' && $('#fs-judge')) $('#fs-judge').textContent = `“${FS_JUDGE(FSS.studyS)}”`;
    if (!FSS.studyS && FSS.studyOn) fsEndStudy();
    return true;
  }
  return false;
}
function fsSubmit(form) {
  const secId = form.dataset.fscode, c = FS.parseCode(form.querySelector('input').value);
  if (!c) { toast('That code doesn’t look right. A code looks like 5E6-K7QX.'); return; }
  S.mock.sight = S.mock.sight || {};
  S.mock.sight[secId] = FS.code(c);
  touch(); refreshSection(secId);
}
window.addEventListener('resize', () => {
  if (FSS.secId && !FSS.run && $('#fs-rows') && Math.abs($('#fs-rows').clientWidth - (FSS.lastW || 0)) >= 20) fsDrawRows();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  fsStopRun();
  if ((FSS.tick || FSS.phase === 'speaking') && FSS.secId && !FSS.practice) { const id = FSS.secId; fsCloseStand(); fsOpenStand(id); }  // a tab switch mid-instructions or mid-tempo restarts the sequence
});
