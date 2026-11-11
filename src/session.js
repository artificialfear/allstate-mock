/* ============================================================
   AUDITION DAY: score a whole group back to back.
   Setup (view 'session'): grade band, round, what to check (full audition or a quick check type), a pasted roster
   (one student per line; ", Instrument" overrides the default instrument), and whether everyone gets the same
   sight-reading etude (like a real audition room).
   Running: the judge sheet shows a queue bar (◀ Prev · jump list · Next ▶). Each student is a normal mock tagged
   m.session = session id, saved to history when scored. Summary (view 'summary'): ranked table, print, CSV.
   localStorage 'asm.session.v1' holds the one active session.
   ============================================================ */
const LS_SESSION = 'asm.session.v1';
const sessGet = () => store.get(LS_SESSION, null);
const sessSet = (s) => store.set(LS_SESSION, s);
function sessActive() { const s = sessGet(); return s && !s.ended ? s : null; }
const SESS_TYPES = [['full', 'Full audition'], ['scales', 'Scales'], ['chromatic', 'Chromatic'], ['etude', 'Etude'], ['sight', 'Sight reading']];
function sessTypeLabel(ss) {
  if (ss.type === 'full') return 'Full audition';
  return unitLabel(buildForm(ss.level, ss.round, 'clarinet', null), ss.type);
}
function sessTypesFor(level, round) {
  const f = buildForm(level, round, 'clarinet', null);
  return SESS_TYPES.filter(([t]) => t === 'full' || unitSecs(f, t).length);
}
/* ---------- roster parsing ---------- */
const INST_ALIASES = { fl: 'flute', flute: 'flute', ob: 'oboe', oboe: 'oboe', bsn: 'bassoon', bassoon: 'bassoon', cl: 'clarinet', clar: 'clarinet', clarinet: 'clarinet',
  'bass cl': 'bassclar', 'bass clar': 'bassclar', 'bass clarinet': 'bassclar', bcl: 'bassclar', contra: 'contraclar', 'contra clarinet': 'contraclar',
  alto: 'altosax', 'alto sax': 'altosax', 'alto saxophone': 'altosax', as: 'altosax', tenor: 'tenorsax', 'tenor sax': 'tenorsax', 'tenor saxophone': 'tenorsax', ts: 'tenorsax',
  bari: 'barisax', 'bari sax': 'barisax', 'baritone sax': 'barisax', 'baritone saxophone': 'barisax', tpt: 'trumpet', trumpet: 'trumpet', cornet: 'trumpet',
  hn: 'horn', horn: 'horn', 'french horn': 'horn', tbn: 'trombone', trombone: 'trombone', 'bass trombone': 'basstrombone', 'bass tbn': 'basstrombone',
  bar: 'baritone', baritone: 'baritone', euph: 'baritone', euphonium: 'baritone', tuba: 'tuba', perc: 'percussion', percussion: 'percussion', drums: 'percussion' };
function parseRoster(text, defInst, level) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/\s*[,\t]\s*/);
    let inst = defInst;
    if (parts.length > 1) {
      const k = parts.slice(1).join(' ').toLowerCase().replace(/[^a-z ]/g, '').trim();
      if (INST_ALIASES[k]) inst = INST_ALIASES[k];
    }
    if (inst === 'basstrombone' && level === 'ms') inst = 'trombone';
    return { name: parts[0], inst, mockId: null };
  });
}

/* ---------- setup view ---------- */
function sessDraft() {
  if (!S.sessDraft) {
    const p = store.get(LS.prefs, {});
    S.sessDraft = { level: 'ms', round: 'district', type: 'full', inst: 'clarinet', roster: '', share: true, judge: p.judge || '', date: todayISO() };
  }
  return S.sessDraft;
}
function viewSession() {
  const d = sessDraft(), L = LEVELS[d.level];
  const types = sessTypesFor(d.level, d.round);
  if (!types.some(([t]) => t === d.type)) d.type = 'full';
  const insts = INSTRUMENTS.filter((i) => !(i.hsOnly && d.level === 'ms'));
  const n = d.roster.split(/\r?\n/).filter((l) => l.trim()).length;
  const seg = (act, cur, list) => `<div class="seg wrap">${list.map(([v, l]) => `<button class="${v === cur ? 'on' : ''}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `${backBtn('home')}
  <h2 class="pick-h">Audition day: run a group</h2>
  <p class="muted">Score a whole section back to back, the way a real audition room runs. Each student is saved to history, and you get a ranked summary at the end.</p>
  <div class="formcard sess-form">
    <div class="fld"><span>Grade band</span>${seg('sslevel', d.level, Object.values(LEVELS).map((x) => [x.id, `${x.short} (${x.grades})`]))}</div>
    <div class="fld"><span>Round</span>${seg('ssround', d.round, [['district', 'First Round'], ['state', 'Final Round']])}</div>
    <div class="fld"><span>What are you checking?</span>${seg('sstype', d.type, types.map(([t, l]) => [t, t === 'full' ? l : unitLabel(buildForm(d.level, d.round, 'clarinet', null), t)]))}</div>
    <div class="grid2">
      <label class="fld"><span>Instrument (unless a line says otherwise)</span><select data-ss="inst">${insts.map((i) => `<option value="${i.id}" ${i.id === d.inst ? 'selected' : ''}>${i.name}</option>`).join('')}</select></label>
      <label class="fld"><span>Date</span><input type="date" data-ss="date" value="${esc(d.date)}"></label>
      <label class="fld wide"><span>Judge / teacher</span><input data-ss="judge" value="${esc(d.judge)}"></label>
      <label class="fld wide"><span>Students — one per line${n ? ` (${n})` : ''}</span>
        <textarea data-ss="roster" rows="8" placeholder="Jordan Rivers&#10;Avery Stone&#10;Sam Lee, Trumpet">${esc(d.roster)}</textarea>
        <small class="muted">Add a comma and an instrument to change one student’s instrument: <i>Sam Lee, Alto Sax</i>.</small></label>
    </div>
    ${d.type === 'full' || d.type === 'sight' ? `<label class="check"><input type="checkbox" data-ss="share" ${d.share ? 'checked' : ''}> Everyone gets the same sight-reading etude (like a real audition room)</label>` : ''}
    <button class="btn primary big" data-act="ssstart">Start audition day →</button>
  </div>`;
}
function sessStart() {
  const d = sessDraft();
  const students = parseRoster(d.roster, d.inst, d.level);
  if (!students.length) { toast('Add at least one student'); return; }
  const prefs = store.get(LS.prefs, {}); prefs.judge = d.judge; store.set(LS.prefs, prefs);
  sessSet({ id: uid(), created: Date.now(), level: d.level, round: d.round, type: d.type, share: d.type === 'full' || d.type === 'sight' ? d.share : false,
    codes: {}, judge: d.judge, date: d.date, students, idx: 0 });
  sessOpen(0);
}
/** open student i of the active session on the judge sheet */
function sessOpen(i) {
  const ss = sessActive(); if (!ss) return;
  i = Math.max(0, Math.min(ss.students.length - 1, i));
  ss.idx = i;
  const st = ss.students[i];
  let m = null;
  if (st.mockId) {
    const h = getHistory().find((x) => x.id === st.mockId) || (store.get(LS.draft, {}) || {}).id === st.mockId && store.get(LS.draft, null);
    if (h) { m = JSON.parse(JSON.stringify(h)); delete m.summary; }
  }
  if (!m) {
    S.pick = { level: ss.level, inst: st.inst, round: ss.round, variant: null };
    const dv = ss.level === 'ms' && ss.round === 'district' && MS_DISTRICT[st.inst];
    if (dv && dv.variants) S.pick.variant = dv.defaultVariant;
    m = newMock();
    Object.assign(m, { session: ss.id, judge: ss.judge, date: ss.date });
    m.student.name = st.name;
    if (ss.type !== 'full') {
      const f = buildForm(m.level, m.round, m.inst, m.variant);
      const secs = unitSecs(f, ss.type);
      if (secs.length) { m.scope = secs; m.scopeLabel = unitLabel(f, ss.type); }
    }
    st.mockId = m.id;
  }
  sessSet(ss);
  if (ss.share) Object.entries(ss.codes || {}).forEach(([sid, code]) => { if (!m.sight[sid]) m.sight[sid] = code; });
  setMock(m); S.who = 'teacher'; S.readOnly = false;
  go('sheet');
}
/** keep the shared etude codes in step with the current student's mock */
function sessSync() {
  const ss = sessActive(); const m = S.mock;
  if (!ss || !m || m.session !== ss.id || !ss.share) return;
  const codes = Object.assign({}, ss.codes || {});
  let changed = false;
  Object.entries(m.sight || {}).forEach(([sid, code]) => { if (codes[sid] !== code) { codes[sid] = code; changed = true; } });
  if (changed) { ss.codes = codes; sessSet(ss); }
}
function sessSaveCurrent() {
  const m = S.mock; if (!m || !m.session) return;
  if (hasScores('teacher') || hasScores('self')) saveToHistory(m, true);
  else store.set(LS.draft, m);
}
function sessMockFor(st) { return st.mockId ? getHistory().find((x) => x.id === st.mockId) : null; }

/** the queue bar on the judge sheet / results for a session mock */
function sessBar() {
  const ss = sessActive(); const m = S.mock;
  if (!ss || !m || m.session !== ss.id) return '';
  const i = ss.idx, n = ss.students.length, next = ss.students[i + 1];
  const done = (st) => { const h = sessMockFor(st); return h && (h.summary || summarize(h)).total != null && Object.values(h.scores.teacher || {}).some((v) => v != null); };
  return `<div class="sess-bar">
    <div class="sess-info"><span class="sess-k">Audition day · ${esc(sessTypeLabel(ss))}</span><b>Student ${i + 1} of ${n}</b></div>
    <div class="sess-nav">
      <button class="btn sm on-navy" data-act="ssprev" ${i === 0 ? 'disabled' : ''} aria-label="Previous student">◀</button>
      <select data-sess-jump aria-label="Jump to a student">${ss.students.map((st, k) => `<option value="${k}" ${k === i ? 'selected' : ''}>${k + 1}. ${esc(st.name)}${done(st) ? ' ✓' : ''}</option>`).join('')}</select>
      ${next ? `<button class="btn sm gold" data-act="ssnext">Next: ${esc(next.name.split(/\s+/)[0])} ▶</button>` : '<button class="btn sm gold" data-act="sssummary">Finish: summary ▶</button>'}
      ${next ? '<button class="btn sm on-navy" data-act="sssummary">Summary</button>' : ''}
    </div>
  </div>`;
}

/* ---------- summary ---------- */
function sessRows(ss) {
  return ss.students.map((st, k) => {
    const h = sessMockFor(st);
    if (!h || !Object.values(h.scores.teacher || {}).concat(Object.values(h.scores.self || {})).some((v) => v != null)) return { k, st, scored: false };
    const f = formFor(h), who = Object.values(h.scores.teacher || {}).some((v) => v != null) ? 'teacher' : 'self';
    const r = scoreForm(f, h.scores[who]), an = analyze(f, h.scores[who]);
    const focus = an.focus[0] ? (CATS[an.focus[0].key] || CATS.general).name : '';
    return { k, st, scored: true, total: r.total, max: r.max, pct: pct(r.total, r.max), cut: f.cut, focus, blanks: r.cells - r.done, inst: f.instrumentLabel };
  });
}
function viewSummary() {
  const ss = sessGet();
  if (!ss) return `${backBtn('home')}<p class="muted">No audition day in progress.</p>`;
  const rows = sessRows(ss);
  const scored = rows.filter((r) => r.scored).sort((a, b) => b.pct - a.pct), rest = rows.filter((r) => !r.scored);
  const L = LEVELS[ss.level];
  return `${ss.ended ? backBtn('home') : '<button class="back" data-act="ssback">← Back to scoring</button>'}
  <h2 class="pick-h">Audition day summary</h2>
  <p class="muted">${esc(L.short)} (${L.grades}) · ${ss.round === 'district' ? 'First Round' : 'Final Round'} · ${esc(sessTypeLabel(ss))} · ${esc(fmtDate(ss.date))}${ss.judge ? ' · ' + esc(ss.judge) : ''} — ${scored.length} of ${rows.length} scored</p>
  <div class="res-actions">
    <button class="btn primary" data-act="ssprint">Print summary</button>
    <button class="btn" data-act="sscsv">Download CSV</button>
    ${ss.ended ? '' : '<button class="btn ghost" data-act="ssend">End audition day</button>'}
  </div>
  <div class="panel sess-table-wrap">
  <table class="htable sess-table"><thead><tr><th>#</th><th>Student</th><th>Instrument</th><th class="num">Score</th><th class="num">vs line</th><th>Focus next</th><th></th></tr></thead><tbody>
    ${scored.map((r, n) => `<tr><td>${n + 1}</td><td><b>${esc(r.st.name)}</b>${r.blanks ? ` <small class="neg">${r.blanks} blank</small>` : ''}</td><td>${esc(r.inst)}</td>
      <td class="num">${fmt(r.total, 2)} / ${fmt(r.max, 0)}<small>${fmt(r.pct, 0)}%</small></td>
      <td class="num">${r.cut ? `<span class="${r.total >= r.cut ? 'pos' : 'neg'}">${r.total >= r.cut ? '+' : ''}${fmt(r.total - r.cut, 1)}</span>` : '—'}</td>
      <td>${esc(r.focus)}</td><td class="acts"><button class="btn sm" data-act="ssopen" data-v="${r.k}">Open</button></td></tr>`).join('')}
    ${rest.map((r) => `<tr class="unscored"><td>—</td><td>${esc(r.st.name)}</td><td>${esc((INSTRUMENTS.find((i) => i.id === r.st.inst) || {}).name || '')}</td><td class="num muted">not scored</td><td></td><td></td>
      <td class="acts">${ss.ended ? '' : `<button class="btn sm" data-act="ssopen" data-v="${r.k}">Score</button>`}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function sessCSV() {
  const ss = sessGet(); if (!ss) return;
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Rank', 'Student', 'Instrument', 'Score', 'Max', 'Percent', 'vs recommendation line', 'Focus next'].map(q).join(',')];
  const rows = sessRows(ss), scored = rows.filter((r) => r.scored).sort((a, b) => b.pct - a.pct);
  scored.forEach((r, n) => lines.push([n + 1, r.st.name, r.inst, fmt(r.total, 2), fmt(r.max, 2), fmt(r.pct, 1), r.cut ? fmt(r.total - r.cut, 2) : '', r.focus].map(q).join(',')));
  rows.filter((r) => !r.scored).forEach((r) => lines.push(['', r.st.name, (INSTRUMENTS.find((i) => i.id === r.st.inst) || {}).name, 'not scored', '', '', '', ''].map(q).join(',')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `audition-day-${ss.date || todayISO()}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function sessPrint() {
  const ss = sessGet(); if (!ss) return;
  const rows = sessRows(ss), scored = rows.filter((r) => r.scored).sort((a, b) => b.pct - a.pct), L = LEVELS[ss.level];
  $('#print').innerHTML = `<div class="p-page">
    <div class="p-mock">MOCK AUDITION — practice only</div>
    <div class="p-title">Audition Day Summary</div>
    <div class="p-sub" style="font-weight:400">${esc(L.short)} (${L.grades}) · ${ss.round === 'district' ? 'First Round' : 'Final Round'} · ${esc(sessTypeLabel(ss))} · ${esc(fmtDate(ss.date))}${ss.judge ? ' · Judge: ' + esc(ss.judge) : ''}</div>
    <table class="p-scales p-summary"><thead><tr><th>#</th><th>Student</th><th>Instrument</th><th>Score</th><th>%</th><th>vs line</th><th>Focus next</th></tr></thead><tbody>
    ${scored.map((r, n) => `<tr><td>${n + 1}</td><td style="text-align:left">${esc(r.st.name)}</td><td>${esc(r.inst)}</td><td>${fmt(r.total, 2)} / ${fmt(r.max, 0)}</td><td>${fmt(r.pct, 0)}%</td><td>${r.cut ? (r.total >= r.cut ? '+' : '') + fmt(r.total - r.cut, 1) : '—'}</td><td style="text-align:left">${esc(r.focus)}</td></tr>`).join('')}
    ${rows.filter((r) => !r.scored).map((r) => `<tr><td>—</td><td style="text-align:left">${esc(r.st.name)}</td><td colspan="5">not scored</td></tr>`).join('')}
    </tbody></table>
    <div class="p-foot">Unofficial practice tool based on the GMEA 2025–26 All-State Band audition forms. Not affiliated with GMEA.</div>
  </div>`;
  setTimeout(() => window.print(), 50);
}
function sessAction(a, v) {
  switch (a) {
    case 'session': S.sessDraft = null; go('session'); return true;
    case 'sslevel': sessDraft().level = v; render(); return true;
    case 'ssround': sessDraft().round = v; render(); return true;
    case 'sstype': sessDraft().type = v; render(); return true;
    case 'ssstart': sessStart(); return true;
    case 'ssnext': { sessSaveCurrent(); const ss = sessActive(); if (ss) sessOpen(ss.idx + 1); return true; }
    case 'ssprev': { sessSaveCurrent(); const ss = sessActive(); if (ss) sessOpen(ss.idx - 1); return true; }
    case 'sssummary': sessSaveCurrent(); go('summary'); return true;
    case 'ssback': { const ss = sessActive(); if (ss) sessOpen(ss.idx); return true; }
    case 'ssopen': sessOpen(+v); return true;
    case 'ssresume': { const ss = sessActive(); if (ss) sessOpen(ss.idx); return true; }
    case 'ssprint': sessPrint(); return true;
    case 'sscsv': sessCSV(); return true;
    case 'ssend': { const ss = sessGet(); if (ss) { ss.ended = true; sessSet(ss); } toast('Audition day ended. Everyone’s mocks are in Student history.'); render(); return true; }
  }
  return false;
}
function sessInput(t) {
  if (t.matches('[data-ss]')) {
    const d = sessDraft(), k = t.dataset.ss;
    d[k] = t.type === 'checkbox' ? t.checked : t.value;
    if (k === 'roster') { const lab = t.closest('.fld'); const n = t.value.split(/\r?\n/).filter((l) => l.trim()).length; const sp = lab && lab.querySelector('span'); if (sp) sp.textContent = `Students — one per line${n ? ` (${n})` : ''}`; }
    return true;
  }
  if (t.matches('[data-sess-jump]')) { sessSaveCurrent(); sessOpen(+t.value); return true; }
  return false;
}
