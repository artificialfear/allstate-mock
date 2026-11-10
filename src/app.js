/* ============================================================
   All-State Mock Audition — app
   ============================================================ */
const APP_VERSION = '1.0.0';
const LS = { draft: 'asm.draft.v1', hist: 'asm.history.v1', theme: 'asm.theme', prefs: 'asm.prefs.v1', exported: 'asm.lastExport' };

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
function fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; const r = Math.round(n * 10 ** d) / 10 ** d; return String(r); }
function pct(a, b) { return b ? (a / b) * 100 : 0; }
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
function mmss(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------- state ---------- */
const S = { view: 'home', pick: { level: null, inst: null, round: null, variant: null }, mock: null, who: 'teacher', readOnly: false, histKey: null, histFilter: null, sheetTab: 'judge' };
let FORM = null;
function setMock(m) { S.mock = m; FORM = buildForm(m.level, m.round, m.inst, m.variant); }
function sc(who = S.who) { return S.mock.scores[who]; }

/* ---------- scoring ---------- */
function cellKeys(sec, r) {
  const k = [];
  for (let i = 1; i <= r.oct; i++) k.push(`${sec.id}.${r.id}.a${i}`);
  for (let i = 1; i <= r.oct; i++) k.push(`${sec.id}.${r.id}.d${i}`);
  k.push(`${sec.id}.${r.id}.arp`);
  return k;
}
function sectionKeys(sec) {
  if (sec.kind === 'windScales') return sec.rows.flatMap((r) => cellKeys(sec, r));
  if (sec.kind === 'malletScales') return sec.rows.flatMap((r) => [`${sec.id}.${r.id}.s`, `${sec.id}.${r.id}.a`]);
  return sec.items.map((it) => `${sec.id}.${it.id}`);
}
function scoreSection(sec, s) {
  const keys = sectionKeys(sec);
  const done = keys.filter((k) => s[k] != null).length;
  const raw = keys.reduce((a, k) => a + (s[k] || 0), 0);
  const total = sec.kind === 'windScales' ? raw * sec.factor : raw;
  return { sec, raw, total, max: sec.max, done, cells: keys.length };
}
function scoreForm(form, s) {
  const sections = form.sections.map((sec) => scoreSection(sec, s));
  return {
    sections, total: sections.reduce((a, x) => a + x.total, 0), max: form.max,
    done: sections.reduce((a, x) => a + x.done, 0), cells: sections.reduce((a, x) => a + x.cells, 0),
  };
}
function hasScores(who) { return S.mock && Object.values(S.mock.scores[who] || {}).some((v) => v != null); }

/* category roll-up across sections (scored items only) */
function categoryStats(form, s) {
  const m = {};
  const add = (key, got, max, ctx) => {
    if (!m[key]) m[key] = { key, got: 0, max: 0, ctx: [] };
    m[key].got += got; m[key].max += max; if (ctx && !m[key].ctx.includes(ctx)) m[key].ctx.push(ctx);
  };
  form.sections.forEach((sec) => {
    const r = scoreSection(sec, s);
    if (sec.kind === 'windScales' || sec.kind === 'malletScales') {
      if (r.done) add(sec.catKey, r.total, sec.max * (r.done / r.cells), sec.group || null);
      return;
    }
    sec.items.forEach((it) => {
      const v = s[`${sec.id}.${it.id}`];
      if (v == null) return;
      add(it.catKey || catKeyFor(it.label), v, it.max, sec.title.replace(/^.*— /, ''));
    });
  });
  return Object.values(m).filter((x) => x.max > 0).map((x) => ({ ...x, pct: pct(x.got, x.max) }));
}
function scaleMisses(form, s) {
  const out = [];
  form.sections.forEach((sec) => {
    if (sec.kind === 'windScales') {
      sec.rows.forEach((r) => {
        const miss = [];
        for (let i = 1; i <= r.oct; i++) if (s[`${sec.id}.${r.id}.a${i}`] === 0) miss.push(r.oct > 1 ? `up oct ${i}` : 'ascending');
        for (let i = 1; i <= r.oct; i++) if (s[`${sec.id}.${r.id}.d${i}`] === 0) miss.push(r.oct > 1 ? `down oct ${i}` : 'descending');
        if (s[`${sec.id}.${r.id}.arp`] === 0) miss.push('arpeggio');
        if (miss.length) out.push({ key: keyLabel(r), miss });
      });
    } else if (sec.kind === 'malletScales') {
      sec.rows.forEach((r) => {
        const sv = s[`${sec.id}.${r.id}.s`], av = s[`${sec.id}.${r.id}.a`]; const miss = [];
        if (sv != null && sv < sec.scaleMax) miss.push(`scale ${fmt(sv)}/${sec.scaleMax}`);
        if (av != null && av < sec.arpMax) miss.push(`arpeggio ${fmt(av)}/${sec.arpMax}`);
        if (miss.length) out.push({ key: r.concert, miss });
      });
    }
  });
  return out;
}
function keyLabel(r) { return r.written ? `${r.concert} (${r.written})` : r.concert; }

/* ---------- mocks / history ---------- */
function newMock() {
  const p = S.pick; const prefs = store.get(LS.prefs, {});
  return {
    id: uid(), v: 1, created: Date.now(), updated: Date.now(),
    level: p.level, round: p.round, inst: p.inst, variant: p.variant,
    student: { name: '', school: prefs.school || '', grade: '' }, judge: prefs.judge || '', date: todayISO(),
    flow: 'teacher', scores: { teacher: {}, self: {} }, comments: { teacher: {}, self: {} },
    overall: { teacher: '', self: '' }, saved: false,
  };
}
let draftTimer = null;
function touch() {
  if (S.readOnly || !S.mock) return;
  S.mock.updated = Date.now();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    store.set(LS.draft, S.mock);
    if (S.mock.saved) saveToHistory(S.mock, true);
  }, 250);
}
function getHistory() { return store.get(LS.hist, []); }
function summarize(m) {
  const f = buildForm(m.level, m.round, m.inst, m.variant);
  const who = Object.values(m.scores.teacher || {}).some((v) => v != null) ? 'teacher' : 'self';
  const r = scoreForm(f, m.scores[who]);
  return { total: r.total, max: r.max, who, cut: f.cut };
}
function saveToHistory(m, quiet) {
  const h = getHistory(); m.saved = true;
  const entry = { ...m, summary: summarize(m) };
  const i = h.findIndex((x) => x.id === m.id);
  if (i >= 0) h[i] = entry; else h.push(entry);
  const ok = store.set(LS.hist, h);
  store.set(LS.draft, m);
  if (!quiet) toast(ok ? 'Saved to this device’s history' : 'Could not save — browser storage is unavailable');
  return ok;
}
function studentKey(m) { return (m.student.name || 'Unnamed').trim().toLowerCase(); }

/* ---------- share links ---------- */
function b64u(bytes) { let s = ''; bytes.forEach((b) => (s += String.fromCharCode(b))); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(str) { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); }
async function streamBytes(bytes, Stream, fmtName) {
  const st = new Blob([bytes]).stream().pipeThrough(new Stream(fmtName));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
function packMock(m, opts) {
  const strip = (o) => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v != null && v !== ''));
  return {
    v: 1, id: m.id, l: m.level, r: m.round, i: m.inst, va: m.variant || undefined,
    n: opts.firstName ? (m.student.name || '').trim().split(/\s+/)[0] : m.student.name, sch: m.student.school, g: m.student.grade,
    j: m.judge, d: m.date, t: strip(m.scores.teacher), s: opts.self ? strip(m.scores.self) : {},
    ct: strip(m.comments.teacher), cs: opts.self ? strip(m.comments.self) : {}, ot: m.overall.teacher, os: opts.self ? m.overall.self : '',
  };
}
function unpackMock(p) {
  return {
    id: p.id || uid(), v: 1, created: Date.now(), updated: Date.now(), level: p.l, round: p.r, inst: p.i, variant: p.va || null,
    student: { name: p.n || '', school: p.sch || '', grade: p.g || '' }, judge: p.j || '', date: p.d || '',
    flow: 'teacher', scores: { teacher: p.t || {}, self: p.s || {} }, comments: { teacher: p.ct || {}, self: p.cs || {} },
    overall: { teacher: p.ot || '', self: p.os || '' }, saved: false,
  };
}
async function encodeShare(m, opts) {
  const bytes = new TextEncoder().encode(JSON.stringify(packMock(m, opts)));
  if (window.CompressionStream) {
    try { return 'z' + b64u(await streamBytes(bytes, CompressionStream, 'deflate-raw')); } catch (e) { /* fall through */ }
  }
  return 'j' + b64u(bytes);
}
async function decodeShare(data) {
  let bytes = unb64u(data.slice(1));
  if (data[0] === 'z') bytes = await streamBytes(bytes, DecompressionStream, 'deflate-raw');
  return unpackMock(JSON.parse(new TextDecoder().decode(bytes)));
}
function shareBase() { return location.origin + location.pathname; }

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  const main = $('#main');
  const v = S.view;
  document.body.dataset.view = v;
  main.innerHTML =
    v === 'home' ? viewHome() :
    v === 'inst' ? viewInst() :
    v === 'round' ? viewRound() :
    v === 'setup' ? viewSetup() :
    v === 'sheet' ? viewSheet() :
    v === 'results' ? viewResults() :
    v === 'history' ? viewHistory() : '';
  renderTopbar();
  if (v === 'history') drawHistoryChart();
  window.scrollTo(0, 0);
}

function renderTopbar() {
  const tb = $('#topbar-mid');
  if ((S.view === 'sheet' || S.view === 'results') && S.mock) {
    const r = scoreForm(FORM, sc(S.view === 'results' ? resultsWho() : S.who));
    tb.innerHTML = `<div class="tb-student">${esc(S.mock.student.name || 'Student')}</div>
      <div class="tb-meta">${esc(FORM.instrumentLabel)} · ${LEVELS[S.mock.level].grades} · ${S.mock.round === 'district' ? 'First Round' : 'Final Round'}</div>`;
    $('#tb-total').innerHTML = S.view === 'sheet' ? `<span class="tb-score" id="live-total">${fmt(r.total, 1)}</span><span class="tb-max">/ ${fmt(r.max, 2)}</span>` : '';
  } else {
    tb.innerHTML = `<div class="tb-brand">All-State Mock Audition</div>`;
    $('#tb-total').innerHTML = '';
  }
  $('#btn-tools').hidden = S.view !== 'sheet';
}

function steps(n) {
  const labels = ['Grade', 'Instrument', 'Round', 'Student'];
  return `<ol class="steps">${labels.map((l, i) => `<li class="${i + 1 < n ? 'done' : i + 1 === n ? 'cur' : ''}"><span>${i + 1}</span>${l}</li>`).join('')}</ol>`;
}

/* ---------- home ---------- */
function viewHome() {
  const draft = store.get(LS.draft, null);
  const h = getHistory();
  const lastExp = store.get(LS.exported, 0);
  const stale = h.length >= 3 && Date.now() - lastExp > 21 * 864e5;
  let resume = '';
  if (draft && draft.level && !draft.saved && Object.values(draft.scores.teacher).concat(Object.values(draft.scores.self)).some((v) => v != null)) {
    const inst = INSTRUMENTS.find((i) => i.id === draft.inst);
    resume = `<button class="resume" data-act="resume"><span class="resume-k">Resume unfinished mock</span>
      <span class="resume-v">${esc(draft.student.name || 'Unnamed student')} · ${esc(inst ? inst.name : '')} · ${draft.round === 'district' ? 'First Round' : 'Final Round'}</span></button>`;
  }
  return `
  <section class="hero">
    <h1>Mock All-State auditions, on the real judge sheet.</h1>
    <p>Score a practice audition on the GMEA district or state form. Then print the sheet, share it with your student, and track progress until audition day.</p>
  </section>
  ${stale ? exportNag() : ''}
  ${resume}
  ${steps(1)}
  <h2 class="pick-h">Which band is the student auditioning for?</h2>
  <div class="cards three">
    ${Object.values(LEVELS).map((L) => `
      <button class="card pick" data-act="level" data-v="${L.id}">
        <span class="pick-g">Grades ${L.grades}</span>
        <span class="pick-t">${L.short}</span>
        <span class="pick-s">${L.id === 'ms' ? '4 scales · scales at QN=120' : L.id === 'concert' ? '8 scales · QN=132' : '12 scales · QN=144'}</span>
      </button>`).join('')}
  </div>
  <div class="home-links">
    <button class="btn ghost" data-act="history">Student history${h.length ? ` (${new Set(h.map(studentKey)).size})` : ''}</button>
    <button class="btn ghost" data-act="help">How to run a great mock audition</button>
  </div>`;
}
function exportNag() {
  return `<div class="nag"><strong>Back up your history.</strong> Saved mocks live only in this browser on this device. Export a backup file now and then.
    <button class="btn sm" data-act="export">Export backup</button></div>`;
}

/* ---------- instrument ---------- */
function viewInst() {
  const L = LEVELS[S.pick.level];
  const list = INSTRUMENTS.filter((i) => !(i.hsOnly && L.id === 'ms'));
  const fams = ['Woodwinds', 'Brass', 'Percussion'];
  return `${backBtn('home')}${steps(2)}
  <h2 class="pick-h">${L.short} (${L.grades}) — which instrument?</h2>
  ${fams.map((f) => `<h3 class="fam">${f}</h3><div class="cards inst">
    ${list.filter((i) => i.fam === f).map((i) => `<button class="card pick sm" data-act="inst" data-v="${i.id}"><span class="pick-t">${i.name}</span></button>`).join('')}
  </div>`).join('')}`;
}

/* ---------- round ---------- */
function viewRound() {
  const p = S.pick; const L = LEVELS[p.level];
  const inst = INSTRUMENTS.find((i) => i.id === p.inst);
  const d = p.level === 'ms' && MS_DISTRICT[p.inst];
  let variant = '';
  if (d && d.variants) {
    const cur = p.variant || d.defaultVariant;
    variant = `<div class="variant"><span>Scale sheet for First Round:</span>
      <div class="seg">${Object.entries(d.variants).map(([k, v]) => `<button class="${k === cur ? 'on' : ''}" data-act="variant" data-v="${k}">${v.label}</button>`).join('')}</div></div>`;
  }
  const card = (round, title, sub) => `
    <button class="card pick round" data-act="round" data-v="${round}">
      <span class="pick-g">${sub}</span><span class="pick-t">${title}</span>
      <ul>${roundSummary(p.level, round, p.inst).map((x) => `<li>${x}</li>`).join('')}</ul>
      ${round === 'district' && p.inst !== 'percussion' ? `<span class="pick-s">State recommendation line: ${fmt(buildForm(p.level, 'district', p.inst, p.variant).cut)}</span>` : ''}
    </button>`;
  return `${backBtn('inst')}${steps(3)}
  <h2 class="pick-h">${L.short} ${inst.name} — which round?</h2>
  ${variant}
  <div class="cards two">
    ${card('district', 'First Round', 'District audition')}
    ${card('state', 'Final Round', 'State audition')}
  </div>`;
}

/* ---------- setup ---------- */
function viewSetup() {
  const m = S.mock; const L = LEVELS[m.level];
  const names = [...new Set(getHistory().map((x) => x.student.name).filter(Boolean))];
  const grades = { ms: [6, 7, 8], concert: [9, 10], symphonic: [11, 12] }[m.level];
  const flows = [
    ['teacher', 'Teacher scores', 'You fill out the judge sheet.'],
    ['self-first', 'Student self-assesses first', 'The student scores themselves, then hands it to you. Their scores stay hidden until results, so they don’t influence yours.'],
    ['self', 'Student self-assessment only', 'Good for scoring a practice recording at home.'],
  ];
  return `${backBtn('round')}${steps(4)}
  <h2 class="pick-h">Who’s auditioning?</h2>
  <div class="formcard">
    <div class="sheet-id"><strong>${esc(FORM.title)}</strong><span>${esc(FORM.subtitle)} · ${esc(FORM.instrumentLabel)}${FORM.variantLabel ? ' (' + esc(FORM.variantLabel) + ')' : ''}</span></div>
    <div class="grid2">
      <label class="fld"><span>Student name</span><input id="f-name" list="names" autocomplete="off" value="${esc(m.student.name)}" placeholder="First and last name"><datalist id="names">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <label class="fld"><span>Grade</span><select id="f-grade"><option value="">—</option>${grades.map((g) => `<option ${String(m.student.grade) === String(g) ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="fld"><span>School</span><input id="f-school" value="${esc(m.student.school)}"></label>
      <label class="fld"><span>Date</span><input id="f-date" type="date" value="${esc(m.date)}"></label>
      <label class="fld wide"><span>Judge / teacher</span><input id="f-judge" value="${esc(m.judge)}" placeholder="Shown on the printed sheet"></label>
    </div>
    <fieldset class="flow"><legend>Who scores this mock?</legend>
      ${flows.map(([k, t, d]) => `<label class="radio ${m.flow === k ? 'on' : ''}"><input type="radio" name="flow" value="${k}" ${m.flow === k ? 'checked' : ''}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}
    </fieldset>
    <button class="btn primary big" data-act="start">Open the judge sheet →</button>
  </div>
  <details class="tips"><summary>Run it like the real thing</summary>${realThingTips()}</details>`;
}
function realThingTips() {
  return `<ul>
    <li><strong>Set up a screen.</strong> GMEA auditions are blind. Put the student behind a stand or partition, or turn your back, and listen only.</li>
    <li><strong>No restarts.</strong> Once a section starts, score what you hear, just like a real panel.</li>
    <li><strong>Use the order on the sheet:</strong> scales from memory, chromatic, then the etude and sight reading.</li>
    <li><strong>Unfamiliar sight reading.</strong> Use an exercise the student hasn’t seen. Last year’s examples are ideal.</li>
    <li><strong>Make it a little stressful.</strong> Have them wait outside, walk in, play. A mock with an audience of friends adds healthy pressure.</li>
    <li><strong>Mock early and repeat.</strong> Two or three mocks spaced a few weeks apart show real growth in the history chart.</li>
  </ul>`;
}
function backBtn(to) { return `<button class="back" data-act="go" data-v="${to}">← Back</button>`; }

/* ---------- sheet ---------- */
function viewSheet() {
  const m = S.mock; const who = S.who;
  let banner = '';
  if (who === 'self') {
    banner = `<div class="banner self"><strong>Student self-assessment.</strong> Score yourself honestly: how would a judge hear this performance?
      ${m.flow === 'self-first' ? '<button class="btn sm" data-act="handoff">Done — hand to teacher →</button>' : ''}</div>`;
  } else if (hasScores('self')) {
    banner = `<div class="banner">The student’s self-scores are hidden while you judge. You’ll see them side by side on the results page.</div>`;
  }
  let lastGroup = null;
  const secs = FORM.sections.map((sec) => {
    let gh = '';
    if (sec.group && sec.group !== lastGroup) { lastGroup = sec.group; gh = `<h3 class="group-h">${sec.group}</h3>`; }
    return gh + `<section class="sec" id="sec-${sec.id}">${sectionInner(sec)}</section>`;
  }).join('');
  return `
  <div class="sheet-head">
    <div class="sheet-id"><strong>${esc(FORM.title)}</strong><span>${esc(FORM.subtitle)} · ${esc(FORM.instrumentLabel)}${FORM.variantLabel ? ' (' + esc(FORM.variantLabel) + ')' : ''}${FORM.division ? ' · Division preference line on form' : ''}</span></div>
    <div class="seg who">${['teacher', 'self'].map((w) => `<button class="${S.who === w ? 'on' : ''}" data-act="who" data-v="${w}">${w === 'teacher' ? 'Teacher scoring' : 'Student self-score'}</button>`).join('')}</div>
  </div>
  ${FORM.notices.map((n) => `<div class="banner warn">${esc(n)}</div>`).join('')}
  ${banner}
  ${secs}
  <section class="sec">
    <div class="sec-h"><h3>${who === 'self' ? 'My reflection' : 'Overall comments'}</h3></div>
    <textarea class="cmt" data-overall="1" rows="3" placeholder="${who === 'self' ? 'What went well? What will you practice next?' : 'Big-picture feedback for the student'}">${esc(m.overall[who])}</textarea>
  </section>
  <div class="sheet-foot"><button class="btn primary big" data-act="results">See results →</button></div>`;
}

function sectionInner(sec) {
  const s = sc(); const r = scoreSection(sec, s);
  const prog = r.cells ? Math.round((r.done / r.cells) * 100) : 0;
  let body = '';
  if (sec.kind === 'windScales') body = windScalesBody(sec, s, r);
  else if (sec.kind === 'malletScales') body = malletBody(sec, s);
  else body = sec.items.map((it) => rubricItem(sec, it, s[`${sec.id}.${it.id}`])).join('');
  const cmt = S.mock.comments[S.who][sec.id] || '';
  const quick = quickFor(sec, FORM);
  const tools = [];
  if (sec.timeLimit) tools.push(`<button class="chip-btn" data-act="timer" data-v="${sec.timeLimit}">⏱ Time limit ${mmss(sec.timeLimit * 1000)}</button>`);
  if (sec.tempo) tools.push(`<button class="chip-btn" data-act="metro" data-v="${sec.tempo}">♩ = ${sec.tempo}</button>`);
  if (sec.kind === 'windScales' || sec.kind === 'malletScales') tools.push(`<button class="chip-btn" data-act="allperfect" data-v="${sec.id}">Start from perfect</button>`);
  return `
    <div class="sec-h">
      <h3>${esc(sec.title)}</h3>
      <div class="sec-score"><span>${fmt(r.total, 2)}</span> / ${fmt(sec.maxLabel || sec.max, 2)}</div>
    </div>
    <div class="progress" title="${r.done} of ${r.cells} scored"><i style="width:${prog}%"></i></div>
    ${sec.help ? `<p class="help">${esc(sec.help)}</p>` : ''}
        ${tools.length ? `<div class="sec-tools">${tools.join('')}</div>` : ''}
    <div class="sec-body">${body}</div>
    <details class="cmt-wrap" ${cmt ? 'open' : ''}><summary>Comments${cmt ? ' ✎' : ''}</summary>
      <div class="quick">${quick.map((q) => `<button class="qc" data-act="quick" data-sec="${sec.id}" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <textarea class="cmt" data-sec="${sec.id}" rows="2" placeholder="Notes for the student">${esc(cmt)}</textarea>
    </details>`;
}

function windScalesBody(sec, s, r) {
  const rows = sec.rows.map((row) => {
    const ks = cellKeys(sec, row);
    const rr = ks.reduce((a, k) => a + (s[k] || 0), 0);
    const cell = (k, label) => { const v = s[k]; return `<button class="cell ${v === 1 ? 'ok' : v === 0 ? 'no' : ''}" data-act="cell" data-k="${k}" aria-label="${label}">${v === 1 ? '✓' : v === 0 ? '✗' : label}</button>`; };
    const up = []; const dn = [];
    for (let i = 1; i <= row.oct; i++) { up.push(cell(`${sec.id}.${row.id}.a${i}`, row.oct > 1 ? String(i) : '↑')); dn.push(cell(`${sec.id}.${row.id}.d${i}`, row.oct > 1 ? String(i) : '↓')); }
    return `<div class="srow">
      <div class="skey"><b>${row.concert}</b>${row.written ? `<small>(${row.written})</small>` : ''}<span class="oct">${row.oct} oct</span></div>
      <div class="cg"><span>Up</span>${up.join('')}</div>
      <div class="cg"><span>Down</span>${dn.join('')}</div>
      <div class="cg"><span>Arp</span>${cell(`${sec.id}.${row.id}.arp`, '•')}</div>
      <div class="stot">${rr}<small>/${2 * row.oct + 1}</small></div>
      <button class="rowbtn" data-act="rowall" data-sec="${sec.id}" data-row="${row.id}" title="Mark this scale perfect">✓ all</button>
    </div>`;
  }).join('');
  return `${rows}<div class="factor">Raw ${r.raw} / ${sec.rawMax} × ${sec.factor.toFixed(4)} = <strong>${fmt(r.total, 2)}</strong></div>
    <p class="help tiny">Tap a cell: ✓ played correctly, tap again for ✗. Written keys (in parentheses) are for transposing instruments.</p>`;
}
function malletBody(sec, s) {
  return sec.rows.map((row) => `<div class="mrow"><div class="skey"><b>${row.concert}</b></div>
    <div class="mcol"><span class="lbl">Scale</span>${scoreWidget(`${sec.id}.${row.id}.s`, s[`${sec.id}.${row.id}.s`], sec.scaleMax, 0.5)}</div>
    <div class="mcol"><span class="lbl">Arpeggio</span>${scoreWidget(`${sec.id}.${row.id}.a`, s[`${sec.id}.${row.id}.a`], sec.arpMax, 0.5)}</div></div>`).join('');
}
function rubricItem(sec, it, v) {
  return `<div class="item"><div class="item-h"><span>${esc(it.label)}</span><span class="val">${v == null ? '—' : fmt(v)} <small>/ ${it.max}</small></span></div>
    ${scoreWidget(`${sec.id}.${it.id}`, v, it.max, it.step)}</div>`;
}
function scoreWidget(key, v, max, step) {
  const n = Math.round(max / step);
  if (n <= 10) {
    let h = '';
    for (let i = 0; i <= n; i++) { const x = i * step; h += `<button class="sc ${v === x ? 'on' : ''}" data-act="set" data-k="${key}" data-v="${x}">${fmt(x)}</button>`; }
    return `<div class="scale-chips">${h}</div>`;
  }
  if (max <= 10) {
    let h = '';
    for (let i = 0; i <= max; i++) { const on = v != null && Math.floor(v) === i; h += `<button class="sc ${on ? 'on' : ''} ${on && v % 1 ? 'half' : ''}" data-act="set" data-k="${key}" data-v="${i}">${i}${on && v % 1 ? '½' : ''}</button>`; }
    return `<div class="scale-chips int">${h}<button class="sc nudge" data-act="nudge" data-k="${key}" data-v="${step}" data-max="${max}" aria-label="Add half point">+½</button></div>`;
  }
  return `<div class="slider ${v == null ? 'unset' : ''}">
    <button class="sc nudge" data-act="nudge" data-k="${key}" data-v="${-step}" data-max="${max}" aria-label="Minus half point">−</button>
    <input type="range" min="0" max="${max}" step="${step}" value="${v == null ? 0 : v}" data-k="${key}" aria-label="score">
    <button class="sc nudge" data-act="nudge" data-k="${key}" data-v="${step}" data-max="${max}" aria-label="Plus half point">+</button>
    <span class="ticks"><span>0</span><span>${max / 2}</span><span>${max}</span></span></div>`;
}
function refreshSection(secId) {
  const sec = FORM.sections.find((x) => x.id === secId);
  const el = $(`#sec-${secId}`);
  if (!sec || !el) return;
  const open = $('.cmt-wrap', el)?.open;
  el.innerHTML = sectionInner(sec);
  if (open) $('.cmt-wrap', el).open = true;
  const r = scoreForm(FORM, sc());
  const lt = $('#live-total'); if (lt) lt.textContent = fmt(r.total, 1);
}
function setScore(k, v) {
  const s = sc();
  if (v == null) delete s[k]; else s[k] = v;
  touch(); refreshSection(k.split('.')[0]);
}

/* ---------- results ---------- */
/* strengths / focus areas / sight-reading gap / practice plan — shared by results page and printout */
function analyze(form, s) {
  const cats = categoryStats(form, s).sort((a, b) => b.pct - a.pct);
  const strengths = cats.filter((c) => c.pct >= 70).slice(0, 3);
  const focus = cats.slice().sort((a, b) => a.pct - b.pct || (b.max - b.got) - (a.max - a.got))
    .filter((c) => c.pct < 90 && !strengths.includes(c)).slice(0, 3);
  const misses = scaleMisses(form, s);
  /* sight reading vs prepared music, scored items only */
  const part = (secs) => {
    let got = 0, max = 0;
    secs.forEach((sec) => sec.items.forEach((it) => { const v = s[`${sec.id}.${it.id}`]; if (v != null) { got += v; max += it.max; } }));
    return max ? pct(got, max) : null;
  };
  const sp = part(form.sections.filter((x) => x.sightReading));
  const pp = part(form.sections.filter((x) => !x.sightReading && x.kind === 'rubric' && !x.catKey));
  const srGap = sp != null && pp != null && pp - sp >= 12 ? { sp, pp } : null;
  return { cats, strengths, focus, misses, srGap, plan: practicePlan(focus, srGap, misses) };
}
function resultsWho() { return hasScores('teacher') ? 'teacher' : 'self'; }
function viewResults() {
  const m = S.mock; const who = resultsWho();
  const s = m.scores[who]; const r = scoreForm(FORM, s);
  const { strengths, focus, misses, srGap, plan } = analyze(FORM, s);
  const unscored = r.cells - r.done;
  const ro = S.readOnly;
  const lost = r.sections.map((x) => ({ t: x.sec.title, lost: Math.max(0, x.max - x.total) })).sort((a, b) => b.lost - a.lost);
  const cutBlock = FORM.cut ? cutGauge(r.total, FORM.cut, r.max) : '';

  return `
  ${ro ? `<div class="banner">Shared mock audition results (read-only). Nothing here is stored online; everything is inside the link.</div>` : backBtn('sheet')}
  <section class="res-head">
    <div>
      <div class="res-name">${esc(m.student.name || 'Student')}</div>
      <div class="res-meta">${esc(FORM.instrumentLabel)}${FORM.variantLabel ? ' (' + esc(FORM.variantLabel) + ')' : ''} · ${esc(LEVELS[m.level].short)} (${LEVELS[m.level].grades}) · ${m.round === 'district' ? 'First Round (District)' : 'Final Round (State)'}<br>
      ${m.date ? fmtDate(m.date) : ''}${m.judge ? ' · Judge: ' + esc(m.judge) : ''}${who === 'self' ? ' · <em>Student self-assessment</em>' : ''}</div>
    </div>
    <div class="res-total"><span class="big">${fmt(r.total, 2)}</span><span class="of">/ ${fmt(r.max, 0)}</span><span class="pc">${fmt(pct(r.total, r.max), 0)}%</span></div>
  </section>
  ${unscored ? `<div class="banner warn">${unscored} item${unscored > 1 ? 's were' : ' was'} left unscored and count as 0, like the official sheet.${ro ? '' : ' <button class="btn sm" data-act="go" data-v="sheet">Finish scoring</button>'}</div>` : ''}
  ${cutBlock}
  <div class="res-actions">
    <button class="btn primary" data-act="print">Print / Save PDF</button>
    ${ro ? '' : '<button class="btn" data-act="share">Share link</button>'}
    ${ro ? '' : '<button class="btn" data-act="go" data-v="sheet">Edit scores</button>'}
    ${ro ? '' : '<button class="btn ghost" data-act="again">New mock, same student</button>'}
  </div>

  <div class="res-grid">
    <section class="panel">
      <h3>Section scores</h3>
      ${r.sections.map((x) => barRow(x.sec.title, x.total, x.max)).join('')}
    </section>
    <section class="panel">
      <h3>Where the points went</h3>
      <ol class="lost">${lost.filter((x) => x.lost > 0.004).map((x) => `<li><span>${esc(x.t)}</span><b>−${fmt(x.lost, 2)}</b></li>`).join('') || '<li><span>No points lost. A perfect sheet!</span></li>'}</ol>
      ${misses.length ? `<h4>Scale spots to fix</h4><ul class="miss">${misses.map((x) => `<li><b>${esc(x.key)}</b> ${x.miss.map(esc).join(', ')}</li>`).join('')}</ul>` : ''}
    </section>
  </div>

  <div class="res-grid">
    <section class="panel good">
      <h3>Strengths</h3>
      ${strengths.length ? strengths.map((c) => catLine(c)).join('') : '<p class="muted">Score more categories to see strengths.</p>'}
    </section>
    <section class="panel focus">
      <h3>Focus next</h3>
      ${focus.length ? focus.map((c) => catLine(c)).join('') : '<p class="muted">Nothing below 90%. Keep polishing and run the full audition often.</p>'}
      ${srGap ? `<p class="insight">Sight reading (${fmt(srGap.sp, 0)}%) is well behind prepared music (${fmt(srGap.pp, 0)}%). A daily sight-reading habit will gain the most points.</p>` : ''}
    </section>
  </div>

  <section class="panel">
    <h3>Practice plan for this week</h3>
    <ol class="plan">${plan.map((p) => `<li><span class="min">${p.min} min</span><div><b>${esc(p.t)}</b><span>${esc(p.d)}</span></div></li>`).join('')}</ol>
    <p class="muted small">Suggested daily routine based on this mock. Adjust it to the student.</p>
  </section>

  ${hasScores('self') && hasScores('teacher') ? compareBlock() : ''}
  ${commentsBlock(who)}
  ${ro ? '' : `<p class="muted small center">${m.saved ? 'Saved to this device’s student history.' : ''}</p>`}`;
}
function cutGauge(total, cut, max) {
  const diff = total - cut;
  const p = Math.min(100, pct(total, max)); const c = pct(cut, max);
  return `<section class="panel cut ${diff >= 0 ? 'above' : 'below'}">
    <div class="cut-msg">${diff >= 0
      ? `<b>${fmt(diff, 2)} points above</b> the state-level recommendation line (${fmt(cut)}).`
      : `<b>${fmt(-diff, 2)} points below</b> the state-level recommendation line (${fmt(cut)}).`}</div>
    <div class="gauge"><i style="width:${p}%"></i><span class="mark" style="left:${c}%"><em>${fmt(cut)}</em></span></div>
    <p class="muted small">The minimum district total for a state-level audition recommendation, as printed on this instrument’s form.</p>
  </section>`;
}
function barRow(label, got, max) {
  const p = Math.max(0, Math.min(100, pct(got, max)));
  return `<div class="bar"><div class="bar-l"><span>${esc(label)}</span><b>${fmt(got, 2)} / ${fmt(max, 2)}</b></div><div class="bar-t"><i style="width:${p}%"></i></div></div>`;
}
function catLine(c) {
  const C = CATS[c.key] || CATS.general;
  return `<div class="cat"><div class="cat-h"><b>${C.name}</b><span>${fmt(c.pct, 0)}%</span></div>
    ${c.ctx.filter((x) => x.toLowerCase() !== C.name.toLowerCase()).length ? `<div class="cat-ctx">${c.ctx.filter((x) => x.toLowerCase() !== C.name.toLowerCase()).map(esc).join(' · ')}</div>` : ''}</div>`;
}
function practicePlan(focus, srGap, misses) {
  const plan = [{ min: 5, t: 'Warm-up and long tones', d: 'Start every session with a full, centered sound across the range.' }];
  focus.forEach((c, i) => {
    const C = CATS[c.key] || CATS.general;
    let d = C.tips[0];
    if ((c.key === 'scales' || c.key === 'malletscales') && misses.length) d = `Start with ${misses.slice(0, 3).map((x) => x.key).join(', ')}. ` + C.tips[0];
    plan.push({ min: i === 0 ? 10 : 8, t: C.name, d });
  });
  if (srGap) plan.push({ min: 5, t: 'Sight reading', d: PATTERN_TIPS.sightReading.tips[1] });
  plan.push({ min: 5, t: 'Full mock run', d: 'Play the whole audition in order without stopping, as if a judge is listening. Record it once a week.' });
  return plan;
}
function compareBlock() {
  const t = S.mock.scores.teacher, s = S.mock.scores.self;
  const rows = [];
  FORM.sections.forEach((sec) => {
    if (sec.kind === 'windScales' || sec.kind === 'malletScales') {
      const a = scoreSection(sec, s), b = scoreSection(sec, t);
      if (a.done && b.done) rows.push({ l: sec.title, self: a.total, tch: b.total, max: sec.max });
      return;
    }
    sec.items.forEach((it) => {
      const a = s[`${sec.id}.${it.id}`], b = t[`${sec.id}.${it.id}`];
      if (a != null && b != null) rows.push({ l: (sec.items.length > 1 ? sec.title.replace(/^.*— /, '') + ' · ' : '') + it.label, self: a, tch: b, max: it.max });
    });
  });
  if (!rows.length) return '';
  /* compare only what both people scored, so a half-finished self-assessment isn't read as "lower" */
  const ss = rows.reduce((a, x) => a + x.self, 0), ts = rows.reduce((a, x) => a + x.tch, 0), mx = rows.reduce((a, x) => a + x.max, 0);
  const d = ss - ts;
  const flagged = rows.filter((x) => Math.abs(x.self - x.tch) >= Math.max(1, x.max * 0.15));
  return `<section class="panel">
    <h3>Self-assessment vs. teacher</h3>
    <p class="cmp-sum">On the ${rows.length} categories both of you scored (${fmt(mx, 1)} points possible): student <b>${fmt(ss, 2)}</b> · teacher <b>${fmt(ts, 2)}</b>. ${Math.abs(d) < 1 ? 'Very well calibrated.' : d > 0 ? `The student rated themselves <b>${fmt(d, 1)} points higher</b>.` : `The student rated themselves <b>${fmt(-d, 1)} points lower</b>.`}</p>
    <div class="cmp-legend"><span class="k self"></span>Student <span class="k tch"></span>Teacher</div>
    <div class="cmp">${rows.map((x) => {
      const big = Math.abs(x.self - x.tch) >= Math.max(1, x.max * 0.15);
      return `<div class="cmp-row ${big ? 'flag' : ''}"><div class="cmp-l">${esc(x.l)}${big ? `<em>${x.self > x.tch ? 'rated higher' : 'rated lower'}</em>` : ''}</div>
        <div class="cmp-bars"><div class="cb self"><i style="width:${pct(x.self, x.max)}%"></i><span>${fmt(x.self)}</span></div>
        <div class="cb tch"><i style="width:${pct(x.tch, x.max)}%"></i><span>${fmt(x.tch)}</span></div></div></div>`;
    }).join('')}</div>
    ${flagged.length ? `<p class="insight">Talk through the ${flagged.length} flagged categor${flagged.length > 1 ? 'ies' : 'y'}. Big gaps usually mean the student can’t yet hear that problem in their own playing. Recording and listening back helps.</p>` : ''}
  </section>`;
}
function commentsBlock(who) {
  const m = S.mock;
  const blocks = [];
  ['teacher', 'self'].forEach((w) => {
    const c = m.comments[w] || {};
    const list = FORM.sections.filter((sec) => c[sec.id]).map((sec) => `<li><b>${esc(sec.title)}:</b> ${esc(c[sec.id])}</li>`);
    const ov = m.overall[w];
    if (list.length || ov) blocks.push(`<div class="cmt-block"><h4>${w === 'teacher' ? 'Judge comments' : 'Student reflection'}</h4>${ov ? `<p>${esc(ov)}</p>` : ''}${list.length ? `<ul>${list.join('')}</ul>` : ''}</div>`);
  });
  return blocks.length ? `<section class="panel">${blocks.join('')}</section>` : '';
}

/* ---------- history ---------- */
function viewHistory() {
  const h = getHistory();
  const groups = {};
  h.forEach((m) => { (groups[studentKey(m)] = groups[studentKey(m)] || []).push(m); });
  const keys = Object.keys(groups).sort();
  const io = `<div class="hist-io"><button class="btn sm" data-act="export">Export backup</button><label class="btn sm ghost">Import backup<input type="file" accept=".json,application/json" id="import" hidden></label></div>`;
  if (!h.length) {
    return `${backBtn('home')}<h2 class="pick-h">Student history</h2>
      <p class="muted">No saved mocks yet. Every mock you finish is saved here, on this device, when you open its results.</p>${io}`;
  }
  if (!S.histKey || !groups[S.histKey]) S.histKey = keys[0];
  const mine = groups[S.histKey].slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.created - b.created);
  const combos = [...new Set(mine.map((m) => `${m.round}|${m.level}|${m.inst}`))];
  if (!S.histFilter || !combos.includes(S.histFilter)) S.histFilter = combos[combos.length - 1];
  const comboLabel = (c) => { const [r, l, i] = c.split('|'); return `${INSTRUMENTS.find((x) => x.id === i).name} · ${LEVELS[l].short} · ${r === 'district' ? 'First Round' : 'Final Round'}`; };
  return `${backBtn('home')}<h2 class="pick-h">Student history</h2>
  ${Date.now() - store.get(LS.exported, 0) > 21 * 864e5 ? exportNag() : ''}
  <div class="hist">
    <aside class="hist-list">${keys.map((k) => {
      const g = groups[k]; const last = g.slice().sort((a, b) => b.updated - a.updated)[0];
      return `<button class="hist-st ${k === S.histKey ? 'on' : ''}" data-act="hstudent" data-v="${esc(k)}"><b>${esc(last.student.name || 'Unnamed')}</b><span>${g.length} mock${g.length > 1 ? 's' : ''}</span></button>`;
    }).join('')}</aside>
    <div class="hist-main">
      ${combos.length > 1 ? `<div class="seg wrap">${combos.map((c) => `<button class="${c === S.histFilter ? 'on' : ''}" data-act="hfilter" data-v="${c}">${comboLabel(c)}</button>`).join('')}</div>` : `<div class="combo">${comboLabel(S.histFilter)}</div>`}
      <div class="chart-wrap"><div id="hchart"></div><div id="htip" class="htip" hidden></div></div>
      <table class="htable"><thead><tr><th>Date</th><th>Mock</th><th class="num">Score</th><th></th></tr></thead><tbody>
      ${mine.slice().reverse().map((m) => {
        const sm = m.summary || summarize(m);
        return `<tr><td>${fmtDate(m.date)}</td><td>${m.round === 'district' ? 'First' : 'Final'} · ${esc(INSTRUMENTS.find((x) => x.id === m.inst).name)}${sm.who === 'self' ? ' <em>(self)</em>' : ''}</td>
          <td class="num">${fmt(sm.total, 2)} / ${fmt(sm.max, 0)}${sm.cut ? `<small class="${sm.total >= sm.cut ? 'pos' : 'neg'}">${sm.total >= sm.cut ? '+' : ''}${fmt(sm.total - sm.cut, 1)} vs line</small>` : ''}</td>
          <td class="acts"><button class="btn sm" data-act="hopen" data-v="${m.id}">Open</button><button class="btn sm ghost" data-act="hdel" data-v="${m.id}" aria-label="Delete">✕</button></td></tr>`;
      }).join('')}
      </tbody></table>
    </div>
  </div>${io}`;
}
function drawHistoryChart() {
  const el = $('#hchart'); if (!el) return;
  const h = getHistory().filter((m) => studentKey(m) === S.histKey && `${m.round}|${m.level}|${m.inst}` === S.histFilter)
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.created - b.created);
  const pts = h.map((m) => ({ m, s: m.summary || summarize(m) }));
  if (!pts.length) { el.innerHTML = ''; return; }
  const W = 640, H = 220, P = { l: 40, r: 16, t: 16, b: 34 };
  const max = pts[0].s.max; const cut = pts[0].s.cut;
  const x = (i) => pts.length === 1 ? (P.l + W - P.r) / 2 : P.l + (i * (W - P.l - P.r)) / (pts.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(f * max)}" y2="${y(f * max)}" class="g"/><text x="${P.l - 6}" y="${y(f * max) + 4}" class="ax" text-anchor="end">${fmt(f * max, 0)}</text>`).join('');
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.s.total)}`).join(' ');
  const cutL = cut ? `<line x1="${P.l}" x2="${W - P.r}" y1="${y(cut)}" y2="${y(cut)}" class="cutl"/><text x="${W - P.r}" y="${y(cut) - 5}" class="ax cutt" text-anchor="end">Recommendation line ${fmt(cut)}</text>` : '';
  const xl = pts.map((p, i) => `<text x="${x(i)}" y="${H - 12}" class="ax" text-anchor="middle">${esc(fmtDate(p.m.date).replace(/, \d{4}$/, ''))}</text>`).join('');
  const dots = pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.s.total)}" r="5" class="dot"/><circle cx="${x(i)}" cy="${y(p.s.total)}" r="16" class="hit" data-i="${i}"/>`).join('');
  const last = pts[pts.length - 1];
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Score history chart">${grid}${cutL}<path d="${line}" class="ln"/>${dots}${xl}
    <text x="${x(pts.length - 1)}" y="${y(last.s.total) - 12}" class="lbl" text-anchor="${pts.length > 1 ? 'end' : 'middle'}">${fmt(last.s.total, 1)}</text></svg>`;
  const tip = $('#htip');
  $$('.hit', el).forEach((c) => {
    const show = () => {
      const p = pts[+c.dataset.i]; const b = el.getBoundingClientRect(); const cb = c.getBoundingClientRect();
      tip.innerHTML = `<b>${fmt(p.s.total, 2)} / ${fmt(p.s.max, 0)}</b><span>${fmtDate(p.m.date)}${p.s.who === 'self' ? ' · self' : ''}</span>`;
      tip.hidden = false; tip.style.left = (cb.left - b.left + cb.width / 2) + 'px'; tip.style.top = (cb.top - b.top - 8) + 'px';
    };
    c.addEventListener('pointerenter', show); c.addEventListener('click', show);
    c.addEventListener('pointerleave', () => (tip.hidden = true));
  });
}
function exportHistory() {
  const data = { app: 'allstate-mock', v: 1, exported: new Date().toISOString(), mocks: getHistory() };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `mock-auditions-backup-${todayISO()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  store.set(LS.exported, Date.now()); toast('Backup downloaded');
}
function importHistory(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result); const inc = Array.isArray(d) ? d : d.mocks;
      if (!Array.isArray(inc)) throw new Error('bad');
      const h = getHistory(); let added = 0, upd = 0;
      inc.forEach((m) => {
        if (!m || !m.id || !m.level || !LEVELS[m.level]) return;
        const i = h.findIndex((x) => x.id === m.id);
        if (i < 0) { h.push(m); added++; } else if ((m.updated || 0) > (h[i].updated || 0)) { h[i] = m; upd++; }
      });
      store.set(LS.hist, h); toast(`Imported ${added} new, updated ${upd}`); render();
    } catch (e) { toast('That file isn’t a mock audition backup'); }
  };
  rd.readAsText(file);
}

/* ============================================================
   MODALS: share, help
   ============================================================ */
function modal(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; }
async function openShare() {
  const opts = store.get(LS.prefs, {}).share || { firstName: true, self: true };
  const url = shareBase() + '#view=' + await encodeShare(S.mock, opts);
  let qr = '';
  if (typeof qrcode === 'function' && url.length < 2300) {
    try { const q = qrcode(0, 'L'); q.addData(url); q.make(); qr = q.createSvgTag({ cellSize: 3, margin: 2, scalable: true }); } catch (e) { qr = ''; }
  }
  modal(`<h3>Share with the student</h3>
    <p class="muted">Anyone with this link sees a read-only copy of this mock (scores, comments, and practice plan). Nothing is uploaded; all the data is inside the link itself.</p>
    <div class="share-opts">
      <label><input type="checkbox" id="sh-first" ${opts.firstName ? 'checked' : ''}> First name only</label>
      <label><input type="checkbox" id="sh-self" ${opts.self ? 'checked' : ''}> Include student self-assessment</label>
    </div>
    <div class="share-url"><input id="sh-url" readonly value="${esc(url)}"><button class="btn primary" data-act="copy">Copy</button></div>
    ${qr ? `<div class="qr">${qr}<span>Student can scan this to open it on a phone</span></div>` : ''}
    <p class="muted small">Tip: paste the link into a Brightspace or Canvas message, an email, or your LMS assignment feedback.</p>`);
  const re = async () => {
    const o = { firstName: $('#sh-first').checked, self: $('#sh-self').checked };
    const p = store.get(LS.prefs, {}); p.share = o; store.set(LS.prefs, p); openShare();
  };
  $('#sh-first').onchange = re; $('#sh-self').onchange = re;
}
function openHelp() {
  modal(`<h3>How to run a great mock audition</h3>${realThingTips()}
    <h4>Scoring calibration guide</h4>
    <p class="muted small">A suggested guide for consistent scoring. GMEA does not publish one.</p>
    <table class="calib">${CALIBRATION.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('')}</table>
    <h4>About this tool</h4>
    <p class="small">An unofficial practice tool, not affiliated with GMEA. Sections, point values, adjustment factors, and recommendation lines are copied from the 2025–26 GMEA All-State Band district and state audition forms, and the MS octave requirements from the 2025–26 GMEA scale sheets. Always check the current year’s official materials.</p>
    <p class="small">The HS state percussion forms labeled Vibraphone, Drum Set, and Piano use the same snare/xylophone/timpani layout as the Percussion form, so this tool uses that one form for all of them.</p>
    <p class="small">Everything stays on this device. Student history is saved in this browser only, so use <b>Export backup</b> to move it or keep it safe.</p>
    <p class="muted small">Version ${APP_VERSION}</p>`);
}

/* ============================================================
   PRINT
   ============================================================ */
function printTicks(max, step, v) {
  const ticks = [];
  for (let x = 0; x <= max + 1e-9; x += step) ticks.push(Math.round(x * 100) / 100);
  let placed = v == null;
  const out = [];
  ticks.forEach((t, i) => {
    if (!placed && v < t && (i === 0 || v > ticks[i - 1])) { out.push(`<b class="circ">${fmt(v)}</b>`); placed = true; }
    out.push(v === t ? `<b class="circ">${fmt(t)}</b>` : `<span>${fmt(t)}</span>`);
    if (v === t) placed = true;
  });
  return out.join('<i> . . . </i>');
}
function buildPrint(who) {
  const m = S.mock; const s = m.scores[who]; const r = scoreForm(FORM, s);
  const printStep = (it) => (FORM.round === 'state' ? (it.max === 10 || it.max <= 5 ? 1 : 5) : it.max <= 5 ? 0.5 : 5);
  let body = '';
  let lastGroup = null;
  FORM.sections.forEach((sec) => {
    const x = scoreSection(sec, s);
    if (sec.group && sec.group !== lastGroup) { lastGroup = sec.group; body += `<h3 class="p-group">${sec.group} <span>(${FORM.sections.filter((q) => q.group === sec.group).reduce((a, q) => a + q.max, 0)} points maximum)</span></h3>`; }
    if (sec.kind === 'windScales') {
      body += `<div class="p-sec"><div class="p-sech">• ${esc(sec.title)}:</div><table class="p-scales"><thead><tr><th>Scale</th><th>Ascending</th><th>Descending</th><th>Arpeggio</th><th>Total</th></tr></thead><tbody>
      ${sec.rows.map((row) => {
        let a = 0, d = 0; for (let i = 1; i <= row.oct; i++) { a += s[`${sec.id}.${row.id}.a${i}`] || 0; d += s[`${sec.id}.${row.id}.d${i}`] || 0; }
        const arp = s[`${sec.id}.${row.id}.arp`] || 0;
        return `<tr><td>${keyLabel(row)}</td><td>${a} / ${row.oct}</td><td>${d} / ${row.oct}</td><td>${arp} / 1</td><td>${a + d + arp} <small>(${2 * row.oct + 1} max)</small></td></tr>`;
      }).join('')}</tbody></table>
      <div class="p-calc">Total Raw Score: <b>${x.raw}</b> (${sec.rawMax} max) &nbsp; Adjustment Factor: x ${sec.factor.toFixed(4)} &nbsp; Major Scale Total: <b>${fmt(x.total, 2)}</b></div></div>`;
    } else if (sec.kind === 'malletScales') {
      body += `<div class="p-sec"><div class="p-sech">• Major Scales: (48 points maximum) <span class="p-tot">Major Scale Total: <b>${fmt(x.total)}</b> /48</span></div>
        <div class="p-mallet">${sec.rows.map((row) => `<span>${row.concert}: <b>${fmt(s[`${sec.id}.${row.id}.s`] ?? 0)}</b>/${sec.scaleMax} + <b>${fmt(s[`${sec.id}.${row.id}.a`] ?? 0)}</b>/${sec.arpMax}</span>`).join('')}</div></div>`;
    } else {
      const showTicks = sec.items.every((it) => it.max <= 10);
      body += `<div class="p-sec"><div class="p-sech">• ${esc(sec.title.replace(/^.*— /, ''))}: (${sec.max} points maximum)<span class="p-tot">${esc(sec.title.replace(/^.*— /, ''))} Total: <b>${fmt(x.total)}</b> /${sec.max}</span></div>
        ${sec.items.length === 1 && sec.items[0].catKey === 'chromatic' ? '' : `<table class="p-rub">${sec.items.map((it) => {
          const v = s[`${sec.id}.${it.id}`];
          return `<tr><td>${esc(it.label)}</td><td>${showTicks ? printTicks(it.max, printStep(it), v) : `<b>${v == null ? '—' : fmt(v)}</b> / ${it.max}`}</td></tr>`;
        }).join('')}</table>`}
        ${sec.practice ? '<div class="p-note">Category breakdown is a practice aid; the official state form records only the total.</div>' : ''}</div>`;
    }
  });
  const { strengths, focus, misses, srGap, plan } = analyze(FORM, s);
  const comments = FORM.sections.filter((sec) => m.comments[who][sec.id]).map((sec) => `<li><b>${esc(sec.title)}:</b> ${esc(m.comments[who][sec.id])}</li>`).join('');
  $('#print').innerHTML = `
  <div class="p-page">
    <div class="p-mock">MOCK AUDITION — practice only${who === 'self' ? ' · student self-assessment' : ''}</div>
    <div class="p-title">${esc(FORM.title)}</div>
    <div class="p-sub">${esc(FORM.subtitle)}</div>
    ${FORM.division ? '<div class="p-div">Division Preference: Band | Orchestra | None</div>' : ''}
    <table class="p-info"><tr><td>Student: <b>${esc(m.student.name)}</b></td><td>School: <b>${esc(m.student.school)}</b></td><td>Date: <b>${esc(fmtDate(m.date))}</b></td></tr>
      <tr><td>Grade: <b>${esc(m.student.grade)}</b></td><td>Instrument: <b>${esc(FORM.instrumentLabel)}${FORM.variantLabel ? ' (' + esc(FORM.variantLabel) + ')' : ''}</b></td><td>Judge: <b>${esc(m.judge)}</b></td></tr></table>
    ${body}
    <div class="p-total">AUDITION TOTAL: <b>${fmt(r.total, 2)}</b> / ${fmt(r.max, 0)}${FORM.cut ? `<span>Min. total score needed for state-level audition recommendation: ${FORM.cut.toFixed(4)}</span>` : ''}</div>
  </div>
  <div class="p-page p-break">
    <div class="p-title">Mock Audition Feedback — ${esc(m.student.name || 'Student')}</div>
    <div class="p-sub">${esc(FORM.instrumentLabel)} · ${esc(LEVELS[m.level].short)} (${LEVELS[m.level].grades}) · ${m.round === 'district' ? 'First Round' : 'Final Round'} · ${esc(fmtDate(m.date))}</div>
    <div class="p-big">${fmt(r.total, 2)} / ${fmt(r.max, 0)} ${FORM.cut ? `<span>(${r.total >= FORM.cut ? fmt(r.total - FORM.cut, 2) + ' above' : fmt(FORM.cut - r.total, 2) + ' below'} the recommendation line of ${fmt(FORM.cut)})</span>` : ''}</div>
    <div class="p-cols"><div><h4>Strengths</h4><ul>${strengths.map((c) => `<li>${CATS[c.key].name} — ${fmt(c.pct, 0)}%</li>`).join('') || '<li>—</li>'}</ul></div>
      <div><h4>Focus next</h4><ul>${focus.map((c) => `<li>${CATS[c.key].name} — ${fmt(c.pct, 0)}%</li>`).join('') || '<li>—</li>'}</ul></div></div>
    ${srGap ? `<p><b>Sight reading (${fmt(srGap.sp, 0)}%) is well behind prepared music (${fmt(srGap.pp, 0)}%).</b> A daily sight-reading habit will gain the most points.</p>` : ''}
    ${misses.length ? `<h4>Scale spots to fix</h4><p>${misses.map((x) => `<b>${esc(x.key)}</b>: ${x.miss.map(esc).join(', ')}`).join(' &nbsp;·&nbsp; ')}</p>` : ''}
    <h4>Practice plan for this week</h4><ol>${plan.map((p) => `<li><b>${p.min} min — ${esc(p.t)}.</b> ${esc(p.d)}</li>`).join('')}</ol>
    ${focus.map((c) => `<h4>${CATS[c.key].name}: practice ideas</h4><ul>${CATS[c.key].tips.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`).join('')}
    ${m.overall[who] || comments ? `<h4>${who === 'self' ? 'Student reflection' : 'Judge comments'}</h4>${m.overall[who] ? `<p>${esc(m.overall[who])}</p>` : ''}${comments ? `<ul>${comments}</ul>` : ''}` : ''}
    <div class="p-foot">Unofficial practice tool based on the GMEA 2025–26 All-State Band audition forms. Not affiliated with GMEA.</div>
  </div>`;
}
function doPrint() {
  const who = resultsWho();
  buildPrint(who);
  setTimeout(() => window.print(), 50);
}

/* ============================================================
   TOOLS: timer + metronome
   ============================================================ */
const T = { start: 0, acc: 0, running: false, limit: 0, iv: null };
function timerNow() { return T.acc + (T.running ? Date.now() - T.start : 0); }
function timerPaint() {
  const el = $('#t-time'); if (!el) return;
  const ms = timerNow(); el.textContent = mmss(ms);
  el.classList.toggle('over', !!T.limit && ms > T.limit * 1000);
  $('#t-limit').textContent = T.limit ? `limit ${mmss(T.limit * 1000)}` : 'no limit';
  $('#t-go').textContent = T.running ? 'Pause' : timerNow() ? 'Resume' : 'Start';
}
function timerToggle() {
  if (T.running) { T.acc = timerNow(); T.running = false; clearInterval(T.iv); }
  else { T.start = Date.now(); T.running = true; T.iv = setInterval(timerPaint, 200); }
  timerPaint();
}
function timerReset() { T.running = false; T.acc = 0; clearInterval(T.iv); timerPaint(); }

const MT = { ctx: null, on: false, bpm: 120, next: 0, iv: null, beat: 0 };
function metroStart() {
  if (!MT.ctx) MT.ctx = new (window.AudioContext || window.webkitAudioContext)();
  MT.ctx.resume(); MT.on = true; MT.next = MT.ctx.currentTime + 0.05; MT.beat = 0;
  clearInterval(MT.iv);
  MT.iv = setInterval(() => {
    while (MT.next < MT.ctx.currentTime + 0.12) {
      const o = MT.ctx.createOscillator(), g = MT.ctx.createGain();
      o.frequency.value = MT.beat % 4 === 0 ? 1500 : 1000;
      g.gain.setValueAtTime(0.0001, MT.next); g.gain.exponentialRampToValueAtTime(0.5, MT.next + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, MT.next + 0.05);
      o.connect(g).connect(MT.ctx.destination); o.start(MT.next); o.stop(MT.next + 0.06);
      MT.next += 60 / MT.bpm; MT.beat++;
    }
  }, 25);
  metroPaint();
}
function metroStop() { MT.on = false; clearInterval(MT.iv); metroPaint(); }
function metroPaint() {
  const b = $('#m-go'); if (!b) return;
  b.textContent = MT.on ? 'Stop' : 'Start'; $('#m-bpm').textContent = MT.bpm;
  $('#btn-tools').classList.toggle('live', MT.on || T.running);
}
function openTools(focus) {
  const tp = $('#tools'); tp.hidden = false;
  if (focus) tp.dataset.focus = focus;
  timerPaint(); metroPaint();
}

/* ============================================================
   EVENTS
   ============================================================ */
function go(view) { S.view = view; render(); }
function readSetup() {
  const m = S.mock;
  m.student.name = $('#f-name').value.trim(); m.student.school = $('#f-school').value.trim();
  m.student.grade = $('#f-grade').value; m.date = $('#f-date').value; m.judge = $('#f-judge').value.trim();
  m.flow = ($('input[name=flow]:checked') || {}).value || 'teacher';
  const p = store.get(LS.prefs, {}); p.judge = m.judge; p.school = m.student.school; store.set(LS.prefs, p);
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, v = b.dataset.v;
  switch (a) {
    case 'go': if (v === 'sheet' && S.readOnly) return; go(v); break;
    case 'level': S.pick = { level: v, inst: null, round: null, variant: null }; go('inst'); break;
    case 'inst': S.pick.inst = v; S.pick.variant = null; go('round'); break;
    case 'variant': S.pick.variant = v; render(); break;
    case 'round': {
      S.pick.round = v;
      const d = S.pick.level === 'ms' && MS_DISTRICT[S.pick.inst];
      if (v === 'district' && d && d.variants && !S.pick.variant) S.pick.variant = d.defaultVariant;
      if (v !== 'district') S.pick.variant = null;
      const keep = S.mock && S.mock._again ? S.mock : null;
      const m = newMock();
      if (keep) { m.student = { ...keep.student }; m.judge = keep.judge; }
      setMock(m); go('setup'); break;
    }
    case 'start': readSetup(); S.who = S.mock.flow === 'teacher' ? 'teacher' : 'self'; touch(); go('sheet'); break;
    case 'resume': { const d = store.get(LS.draft, null); if (d) { setMock(d); S.who = d.flow === 'self' ? 'self' : 'teacher'; S.readOnly = false; go('sheet'); } break; }
    case 'history': S.histKey = null; S.histFilter = null; go('history'); break;
    case 'help': openHelp(); break;
    case 'who': S.who = v; render(); break;
    case 'handoff': S.who = 'teacher'; render(); toast('Teacher scoring — the student’s scores are hidden'); break;
    case 'set': { const cur = sc()[b.dataset.k]; const nv = +v; setScore(b.dataset.k, cur === nv ? null : nv); break; }
    case 'nudge': {
      const cur = sc()[b.dataset.k]; const max = +b.dataset.max; const d = +v;
      let nv = cur == null ? (d > 0 ? d : 0) : cur + d;
      if (max <= 10 && d > 0 && cur != null && cur % 1) nv = cur - d; // toggle half off
      nv = Math.max(0, Math.min(max, Math.round(nv * 2) / 2));
      setScore(b.dataset.k, nv); break;
    }
    case 'cell': { const cur = sc()[b.dataset.k]; setScore(b.dataset.k, cur === 1 ? 0 : 1); break; }
    case 'rowall': {
      const sec = FORM.sections.find((x) => x.id === b.dataset.sec); const row = sec.rows.find((x) => x.id === b.dataset.row);
      const ks = cellKeys(sec, row); const all = ks.every((k) => sc()[k] === 1);
      ks.forEach((k) => { if (all) delete sc()[k]; else sc()[k] = 1; });
      touch(); refreshSection(sec.id); break;
    }
    case 'allperfect': {
      const sec = FORM.sections.find((x) => x.id === v); const s = sc();
      if (sec.kind === 'windScales') sectionKeys(sec).forEach((k) => (s[k] = 1));
      else sec.rows.forEach((r) => { s[`${sec.id}.${r.id}.s`] = sec.scaleMax; s[`${sec.id}.${r.id}.a`] = sec.arpMax; });
      touch(); refreshSection(sec.id); toast('All marked perfect — now tap what was missed'); break;
    }
    case 'quick': {
      const ta = $(`textarea[data-sec="${b.dataset.sec}"]`);
      ta.value = (ta.value.trim() ? ta.value.trim().replace(/[.;]?$/, '. ') : '') + v;
      S.mock.comments[S.who][b.dataset.sec] = ta.value; touch(); break;
    }
    case 'results': {
      if (!hasScores('teacher') && !hasScores('self')) { toast('Score at least one category first'); return; }
      if (!S.readOnly) saveToHistory(S.mock, true);
      go('results'); break;
    }
    case 'again': {
      const m = S.mock; S.pick = { level: m.level, inst: m.inst, round: m.round, variant: m.variant };
      const nm = newMock(); nm.student = { ...m.student }; nm.judge = m.judge; nm.flow = m.flow;
      setMock(nm); store.set(LS.draft, nm); go('setup'); break;
    }
    case 'print': doPrint(); break;
    case 'share': openShare(); break;
    case 'copy': { const i = $('#sh-url'); i.select(); try { await navigator.clipboard.writeText(i.value); } catch (er) { document.execCommand('copy'); } toast('Link copied'); break; }
    case 'close': closeModal(); break;
    case 'export': exportHistory(); render(); break;
    case 'hstudent': S.histKey = v; S.histFilter = null; render(); break;
    case 'hfilter': S.histFilter = v; render(); break;
    case 'hopen': { const m = getHistory().find((x) => x.id === v); if (m) { const c = JSON.parse(JSON.stringify(m)); delete c.summary; setMock(c); S.readOnly = false; S.who = 'teacher'; go('results'); } break; }
    case 'hdel': {
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Delete?'; b.classList.add('danger'); setTimeout(() => { if (b.isConnected) { b.dataset.confirm = ''; b.textContent = '✕'; b.classList.remove('danger'); } }, 3000); return; }
      store.set(LS.hist, getHistory().filter((x) => x.id !== v)); toast('Deleted'); render(); break;
    }
    case 'theme': {
      const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx; store.set(LS.theme, nx); break;
    }
    case 'tools': { const tp = $('#tools'); if (tp.hidden) openTools(); else tp.hidden = true; break; }
    case 'timer': T.limit = +v; timerReset(); openTools('timer'); break;
    case 'metro': MT.bpm = +v; openTools('metro'); metroPaint(); break;
    case 't-go': timerToggle(); metroPaint(); break;
    case 't-reset': timerReset(); metroPaint(); break;
    case 't-limit': T.limit = +v; timerPaint(); break;
    case 'm-go': MT.on ? metroStop() : metroStart(); break;
    case 'm-bpm': MT.bpm = Math.max(40, Math.min(240, v === '+' ? MT.bpm + 4 : v === '-' ? MT.bpm - 4 : +v)); if (MT.on) { metroStop(); metroStart(); } metroPaint(); break;
    case 'tools-close': $('#tools').hidden = true; break;
    case 'home': if (S.readOnly) { S.readOnly = false; window.history.replaceState(null, '', location.pathname); } go('home'); break;
  }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.matches('input[type=range][data-k]')) { sc()[t.dataset.k] = +t.value; touch(); const it = t.closest('.item, .mcol'); const vl = it && $('.val', it); if (vl) vl.innerHTML = `${fmt(+t.value)} <small>/ ${t.max}</small>`; t.closest('.slider').classList.remove('unset'); }
  if (t.matches('textarea.cmt')) {
    if (t.dataset.overall) S.mock.overall[S.who] = t.value; else S.mock.comments[S.who][t.dataset.sec] = t.value;
    touch();
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.matches('input[type=range][data-k]')) refreshSection(t.dataset.k.split('.')[0]);
  if (t.matches('input[name=flow]')) { $$('.radio').forEach((r) => r.classList.toggle('on', r.contains(t))); }
  if (t.id === 'import' && t.files[0]) importHistory(t.files[0]);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); $('#tools').hidden = true; } });
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
window.addEventListener('afterprint', () => { $('#print').innerHTML = ''; });

/* ---------- boot ---------- */
(async function boot() {
  const th = store.get(LS.theme, null); if (th) document.documentElement.dataset.theme = th;
  if (location.hash.startsWith('#view=')) {
    try {
      const m = await decodeShare(location.hash.slice(6));
      if (!LEVELS[m.level]) throw new Error('bad');
      setMock(m); S.readOnly = true; S.view = 'results';
    } catch (e) { toast('That share link is damaged or incomplete'); }
  }
  render();
})();
