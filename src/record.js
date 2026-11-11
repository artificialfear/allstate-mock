/* ============================================================
   RECORDING THE STUDENT
   ● Record on any section of the judge sheet, and (optionally) automatically on the music stand from "Play!".
   One recording per mock + section, kept in this browser's IndexedDB ('asm-media' → 'rec', key "mockId|secId"):
   too big for share links or the JSON backup, so the results page offers a Download button for each.
   Deleting a mock from history deletes its recordings. Nothing is uploaded.
   ============================================================ */
const REC_DB = 'asm-media', REC_STORE = 'rec';
const REC = { mr: null, stream: null, chunks: [], key: null, secId: null, t0: 0, iv: 0, auto: 0, mime: '' };
let recDbP = null;
function recDb() {
  if (recDbP) return recDbP;
  recDbP = new Promise((res, rej) => {
    if (!window.indexedDB) { rej(new Error('no idb')); return; }
    const r = indexedDB.open(REC_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(REC_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  recDbP.catch(() => { recDbP = null; });
  return recDbP;
}
function recTx(mode, fn) {
  return recDb().then((db) => new Promise((res, rej) => {
    const tx = db.transaction(REC_STORE, mode), st = tx.objectStore(REC_STORE);
    const out = fn(st);
    tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    tx.onerror = () => rej(tx.error);
  }));
}
const recGet = (key) => recTx('readonly', (st) => st.get(key)).catch(() => null);
const recPut = (key, val) => recTx('readwrite', (st) => st.put(val, key));
const recDel = (key) => recTx('readwrite', (st) => st.delete(key)).catch(() => {});
function recAll() {
  return recDb().then((db) => new Promise((res) => {
    const out = [], tx = db.transaction(REC_STORE, 'readonly');
    tx.objectStore(REC_STORE).openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { out.push({ key: c.key, val: c.value }); c.continue(); } };
    tx.oncomplete = () => res(out);
    tx.onerror = () => res(out);
  })).catch(() => []);
}
async function recDeleteMock(mockId) {
  const all = await recAll();
  await Promise.all(all.filter((r) => String(r.key).startsWith(mockId + '|')).map((r) => recDel(r.key)));
}
const recCan = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
function recMime() {
  const c = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const t of c) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) { /* ignore */ } }
  return '';
}
const recExt = (mime) => (/mp4|aac/.test(mime) ? 'm4a' : /ogg/.test(mime) ? 'ogg' : 'webm');

/** ask for the microphone (music settings: no echo cancelling, noise suppression or auto-gain) */
async function recMic() {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
}
async function recStart(secId, { autoStopS = 0 } = {}) {
  if (!recCan()) { toast('Recording isn’t supported in this browser'); return false; }
  if (REC.mr) await recStop();
  let stream;
  try { stream = await recMic(); } catch (e) { toast('Microphone blocked. Allow the microphone for this site in the browser settings.'); return false; }
  const mime = recMime();
  let mr;
  try { mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch (e) { stream.getTracks().forEach((t) => t.stop()); toast('Recording couldn’t start'); return false; }
  Object.assign(REC, { mr, stream, chunks: [], key: `${S.mock.id}|${secId}`, secId, mockId: S.mock.id, t0: Date.now(), mime: mr.mimeType || mime });
  mr.ondataavailable = (e) => { if (e.data && e.data.size) REC.chunks.push(e.data); };
  mr.start(1000);
  clearInterval(REC.iv);
  REC.iv = setInterval(recPaintLive, 500);
  clearTimeout(REC.auto);
  if (autoStopS) REC.auto = setTimeout(() => recStop(), autoStopS * 1000);
  recPaintLive(); recRefresh(secId);
  return true;
}
/** stop and save; resolves when the recording is stored */
function recStop() {
  const { mr } = REC;
  if (!mr) return Promise.resolve();
  clearInterval(REC.iv); clearTimeout(REC.auto);
  return new Promise((res) => {
    const key = REC.key, secId = REC.secId, mime = REC.mime, dur = (Date.now() - REC.t0) / 1000, stream = REC.stream;
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(REC.chunks, { type: mime || 'audio/webm' });
      Object.assign(REC, { mr: null, stream: null, chunks: [], key: null, secId: null });
      if (blob.size > 0) {
        try { await recPut(key, { blob, mime: blob.type, dur, created: Date.now() }); toast('Recording saved on this device'); }
        catch (e) { toast('Couldn’t save the recording (storage is full or blocked)'); }
      }
      recPaintLive(); recRefresh(secId);
      res();
    };
    try { mr.stop(); } catch (e) { res(); }
  });
}
const recIsOn = (secId) => !!REC.mr && REC.secId === secId && REC.mockId === (S.mock && S.mock.id);

/* ---------- UI ---------- */
/** the record button + player row inside a judge-sheet section */
function recSectionRow(sec) {
  if (!recCan() || S.readOnly) return '';
  const on = recIsOn(sec.id);
  return `<div class="rec-row" data-rec-row="${sec.id}">
    <button class="chip-btn rec-btn ${on ? 'on' : ''}" data-act="${on ? 'recstop' : 'recstart'}" data-v="${sec.id}">${on ? '■ Stop recording <span class="rec-time" data-rec-time></span>' : '● Record'}</button>
    <span class="rec-slot" data-rec-key="${esc(S.mock.id + '|' + sec.id)}"></span>
  </div>`;
}
/** fill every [data-rec-key] slot under root with a player (if a recording exists) */
async function recPaint(root = document) {
  const slots = $$('[data-rec-key]', root);
  for (const el of slots) {
    const r = await recGet(el.dataset.recKey);
    if (!el.isConnected) continue;
    if (!r || !r.blob) { el.innerHTML = el.dataset.empty || ''; continue; }
    const url = URL.createObjectURL(r.blob);
    el.innerHTML = `<audio controls preload="metadata" src="${url}"></audio>
      ${el.dataset.download ? `<a class="btn sm" href="${url}" download="${esc(el.dataset.download)}.${recExt(r.mime)}">Download</a>` : ''}
      ${S.readOnly ? '' : `<button class="btn sm ghost rec-del" data-act="recdel" data-v="${esc(el.dataset.recKey)}" aria-label="Delete recording">✕</button>`}`;
  }
}
function recRefresh(secId) { const row = $(`[data-rec-row="${secId}"]`); if (row) { row.outerHTML = recSectionRow(FORM.sections.find((s) => s.id === secId)); recPaint($(`[data-rec-row="${secId}"]`) || document); } }
function recPaintLive() {
  const s = REC.mr ? mmss(Date.now() - REC.t0) : '';
  $$('[data-rec-time]').forEach((el) => { el.textContent = s; });
  document.body.classList.toggle('recording', !!REC.mr);
  const sr = $('#fs-rec-live'); if (sr) { sr.hidden = !REC.mr; sr.textContent = REC.mr ? `● REC ${s}` : ''; }
}
/** the results-page panel: every recording for this mock */
function recResultsBlock() {
  if (!recCan() && !window.indexedDB) return '';
  const m = S.mock, base = `${(m.student.name || 'Student').replace(/[^\w\- ]+/g, '')} - ${m.date || ''}`;
  return `<section class="panel rec-panel" data-rec-panel hidden>
    <h3>Recordings</h3>
    ${FORM.sections.map((sec) => `<div class="rec-res" data-rec-res><b>${esc(sec.title)}</b>
      <span class="rec-slot" data-rec-key="${esc(m.id + '|' + sec.id)}" data-download="${esc(base + ' - ' + sec.title.replace(/[^\w\- #]+/g, ''))}"></span></div>`).join('')}
    <p class="muted small">Saved only on this device; share links and backups don’t include audio. Use Download to send one to the student.</p>
  </section>`;
}
async function recPaintResults() {
  const panel = $('[data-rec-panel]'); if (!panel) return;
  await recPaint(panel);
  let any = false;
  $$('[data-rec-res]', panel).forEach((row) => { const has = !!$('audio', row); row.hidden = !has; any = any || has; });
  panel.hidden = !any;
}
async function recUsage() {
  const all = await recAll();
  return { n: all.length, bytes: all.reduce((a, r) => a + ((r.val && r.val.blob && r.val.blob.size) || 0), 0) };
}
function recAction(a, v) {
  switch (a) {
    case 'recstart': recStart(v); return true;
    case 'recstop': recStop(); return true;
    case 'recdel': recDel(v).then(() => { const sid = v.split('|')[1]; if (S.view === 'results') recPaintResults(); else recRefresh(sid); toast('Recording deleted'); }); return true;
    case 'recclear': recAll().then((all) => Promise.all(all.map((r) => recDel(r.key)))).then(() => { toast('All recordings deleted'); render(); }); return true;
  }
  return false;
}
