/* ============================================================
   GOALS: an audition date + target score per student, days left, the gap, and whether they're on pace.
   Stored on this device: localStorage 'asm.goals.v1' = { [studentKey]: { date, target } }.
   A default audition date (prefs.auditionDate) covers every student without their own date, since a whole
   class usually auditions the same day. The default target is the instrument's recommendation line.
   "On pace" fits a straight line through the student's FULL mocks (score vs. date) and projects it to audition day.
   ============================================================ */
const LS_GOALS = 'asm.goals.v1';
function goalOf(key) {
  const g = (store.get(LS_GOALS, {}) || {})[key] || {};
  const def = store.get(LS.prefs, {}).auditionDate || '';
  return { date: g.date || def, ownDate: !!g.date, target: g.target != null && g.target !== '' ? +g.target : null };
}
function setGoal(key, patch) {
  const all = store.get(LS_GOALS, {}) || {};
  all[key] = Object.assign({}, all[key] || {}, patch);
  store.set(LS_GOALS, all);
}
function daysUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(y, m - 1, d), now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((t - now) / 864e5);
}
const dayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / 864e5; };
/** pace for a student's full mocks of one combo: { n, latest, target, gap, days, slopeWeek, projected, onPace } */
function goalStatus(key, mocks, cut) {
  const g = goalOf(key);
  const target = g.target != null ? g.target : cut;
  const full = mocks.filter((m) => !m.scope && m.date).map((m) => ({ d: m.date, t: (m.summary || summarize(m)).total }))
    .sort((a, b) => a.d.localeCompare(b.d));
  const out = { goal: g, target, days: daysUntil(g.date), n: full.length, latest: full.length ? full[full.length - 1].t : null };
  if (out.latest != null && target != null) out.gap = target - out.latest;
  const xs = [...new Set(full.map((p) => p.d))];
  if (full.length >= 2 && xs.length >= 2) {
    const X = full.map((p) => dayNum(p.d)), Y = full.map((p) => p.t);
    const mx = X.reduce((a, b) => a + b, 0) / X.length, my = Y.reduce((a, b) => a + b, 0) / Y.length;
    const sxx = X.reduce((a, x) => a + (x - mx) ** 2, 0), sxy = X.reduce((a, x, i) => a + (x - mx) * (Y[i] - my), 0);
    const slope = sxx ? sxy / sxx : 0;
    out.slopeWeek = slope * 7;
    if (g.date && target != null) {
      out.projected = my + slope * (dayNum(g.date) - mx);
      out.onPace = out.projected >= target;
    }
  }
  return out;
}
/** the goal card on a student's history page */
function goalCard(key, mocks, cut, max) {
  const st = goalStatus(key, mocks, cut);
  const g = st.goal;
  const line = [];
  if (st.days != null) line.push(st.days > 1 ? `<b>${st.days} days</b> to audition day` : st.days === 1 ? '<b>Tomorrow</b> is audition day' : st.days === 0 ? '<b>Audition day is today</b>' : 'Audition day has passed');
  if (st.latest != null) line.push(`latest full mock <b>${fmt(st.latest, 1)}</b>`);
  if (st.gap != null) line.push(st.gap > 0 ? `<b>${fmt(st.gap, 1)} points</b> to the target` : '<b>at or above the target</b>');
  let pace = '';
  if (st.slopeWeek != null) {
    const trend = `${st.slopeWeek >= 0 ? '+' : ''}${fmt(st.slopeWeek, 1)} points a week`;
    if (st.projected != null) {
      pace = `<div class="pace ${st.onPace ? 'ok' : 'behind'}"><b>${st.onPace ? 'On pace' : 'Behind pace'}</b> · trend ${trend} · projected ${fmt(Math.min(max, Math.max(0, st.projected)), 1)} on audition day${st.onPace ? '' : `, short of ${fmt(st.target, 1)}`}</div>`;
    } else pace = `<div class="pace">Trend ${trend}. Set an audition date to see if they’re on pace.</div>`;
  } else if (st.n === 1) pace = '<div class="pace">Run another full mock on a later day to see the trend.</div>';
  return `<div class="goal-card">
    <div class="goal-fields">
      <label class="fld"><span>Audition day</span><input type="date" data-goal="date" value="${esc(g.date)}"></label>
      <label class="fld"><span>Target score</span><input type="number" inputmode="decimal" min="0" max="${max}" step="0.5" data-goal="target" value="${g.target != null ? g.target : ''}" placeholder="${cut != null ? fmt(cut) + ' (line)' : 'none'}"></label>
      <button class="btn sm ghost" data-act="goalall" title="Use this audition day for every student without their own">Use this date for everyone</button>
    </div>
    ${line.length ? `<p class="goal-line">${line.join(' · ')}</p>` : '<p class="goal-line muted">Set the audition day and a target to track the countdown.</p>'}
    ${pace}
  </div>`;
}
/** one line for the results page (full mocks of a student who has a goal or date) */
function goalResultLine(m, total) {
  if (m.scope) return '';
  const key = studentKey(m), g = goalOf(key);
  const f = buildForm(m.level, m.round, m.inst, m.variant);
  const target = g.target != null ? g.target : null;
  const d = daysUntil(g.date);
  if (target == null && d == null) return '';
  const bits = [];
  if (d != null && d >= 0) bits.push(`${d} day${d === 1 ? '' : 's'} until audition day`);
  if (target != null && target !== f.cut) bits.push(total >= target ? `${fmt(total - target, 2)} above the goal of ${fmt(target)}` : `${fmt(target - total, 2)} below the goal of ${fmt(target)}`);
  return bits.length ? `<p class="goal-res">🎯 ${bits.join(' · ')}</p>` : '';
}
