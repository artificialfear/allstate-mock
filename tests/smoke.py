#!/usr/bin/env python3
"""Smoke tests for All-State Mock Audition.

Run from the repo root:
    python3 build.py && python3 tests/smoke.py
Starts its own static server, drives the built index.html with Playwright (Chromium),
and exits non-zero on any failure. Pass --shots DIR to save screenshots.
"""
import http.server
import pathlib
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHOTS = None
if "--shots" in sys.argv:
    SHOTS = pathlib.Path(sys.argv[sys.argv.index("--shots") + 1])
    SHOTS.mkdir(parents=True, exist_ok=True)

FAILS = []


def check(cond, msg):
    if not cond:
        FAILS.append(msg)
        print("FAIL:", msg)


def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(ROOT), **k)

        def log_message(self, *a):
            pass

    srv = socketserver.TCPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f"http://127.0.0.1:{srv.server_address[1]}/index.html"


def shot(page, name, full=True):
    if SHOTS:
        page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=full)


# Printed-form anomalies we reproduce on purpose (scale section max != 30)
KNOWN = {"district.concert.tenorsax": 31.875, "district.symphonic.basstrombone": 28.85}


def main():
    srv, url = serve()
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chromium", args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        page = b.new_page(viewport={"width": 1100, "height": 900})
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: m.type == "error" and errs.append(m.text))
        page.goto(url)
        page.wait_for_timeout(200)

        # ---------- 1. form data integrity ----------
        combos = page.evaluate("""() => {
          const out = [];
          for (const L of Object.keys(LEVELS)) for (const I of INSTRUMENTS) {
            if (I.hsOnly && L === 'ms') continue;
            for (const R of ['district', 'state']) {
              const d = L === 'ms' && R === 'district' && MS_DISTRICT[I.id];
              const vars = d && d.variants ? Object.keys(d.variants) : [null];
              for (const V of vars) {
                const f = buildForm(L, R, I.id, V);
                const sc = f.sections.find(s => s.kind === 'windScales');
                out.push({ key: f.key, v: V, max: f.max, scaleMax: sc ? sc.max : null, nSec: f.sections.length,
                  rows: sc ? sc.rows.length : 0, cut: f.cut, perc: I.id === 'percussion', notices: f.notices.length });
              }
            }
          }
          return out;
        }""")
        # MS: 15 instruments x 2 rounds + 2 extra scale-sheet variants (contra Eb/BBb, baritone BC/TC); HS: 16 x 2 x 2
        check(len(combos) == 15 * 2 + 2 + 16 * 2 * 2, f"expected 96 form combos, got {len(combos)}")
        for c in combos:
            k = c["key"]
            if c["perc"]:
                check(abs(c["max"] - 300) < 1e-6, f"{k} max {c['max']} != 300")
                continue
            if k.startswith("state"):
                check(abs(c["max"] - 100) < 1e-6, f"{k} max {c['max']} != 100")
                continue
            exp_scale = KNOWN.get(k, 30)
            check(abs(c["scaleMax"] - exp_scale) < 0.03, f"{k} scale max {c['scaleMax']} != {exp_scale}")
            check(c["cut"] in (70, 80, 85), f"{k} cut {c['cut']}")
            check(c["rows"] == {"ms": 4, "concert": 8, "symphonic": 12}[k.split(".")[1]], f"{k} rows {c['rows']}")
            check((k in KNOWN) == (c["notices"] > 0), f"{k} notice mismatch")

        # ---------- 2. every form renders and a perfect run scores the form max ----------
        for c in combos:
            res = page.evaluate("""async ([key, v]) => {
              const [R, L, I] = key.split('.');
              S.pick = { level: L, inst: I, round: R, variant: v };
              const m = newMock(); m.student.name = 'Test ' + key; setMock(m); S.who = 'teacher'; S.readOnly = false;
              S.view = 'sheet'; render();
              for (const sec of FORM.sections) {
                if (sec.kind === 'windScales' || sec.kind === 'malletScales') {
                  document.querySelector(`[data-act=allperfect][data-v="${sec.id}"]`).click();
                } else {
                  for (const it of sec.items) {
                    const chip = document.querySelector(`[data-act=set][data-k="${sec.id}.${it.id}"][data-v="${it.max}"]`);
                    if (chip) chip.click();
                    else { const r = document.querySelector(`input[type=range][data-k="${sec.id}.${it.id}"]`);
                      r.value = it.max; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }
                  }
                }
              }
              const r = scoreForm(FORM, S.mock.scores.teacher);
              return { total: r.total, max: r.max, done: r.done, cells: r.cells };
            }""", [c["key"], c["v"]])
            check(abs(res["total"] - res["max"]) < 1e-9, f"{c['key']} perfect run {res['total']} != {res['max']}")
            check(res["done"] == res["cells"], f"{c['key']} unscored cells after perfect run")

        # ---------- 3. hand-scored MS clarinet district: exact arithmetic ----------
        page.evaluate("() => { S.pick = { level: 'ms', inst: 'clarinet', round: 'district', variant: null }; setMock(newMock()); S.view='sheet'; render(); }")
        page.click('[data-act=allperfect][data-v=scales]')
        for k in ["scales.r3.d2", "scales.r3.arp", "scales.r1.a2"]:
            page.click(f'[data-act=cell][data-k="{k}"]')
        page.click('[data-act=set][data-k="chrom.c0"][data-v="8"]')
        page.click('[data-act=nudge][data-k="chrom.c0"]')
        for sec, vals in {"lyr": ["4", "3.5", "4", "3", "2.5", "3.5"], "sr": ["3", "2.5", "2", "3", "2", "2.5"]}.items():
            for i, v in enumerate(vals):
                page.click(f'[data-act=set][data-k="{sec}.c{i}"][data-v="{v}"]')
        tot = page.evaluate("() => scoreForm(FORM, S.mock.scores.teacher).total")
        check(abs(tot - 69.5) < 1e-9, f"MS clarinet hand score {tot} != 69.5")
        check(page.inner_text("#live-total").strip() == "69.5", "live total not updated")
        # tapping the selected chip clears it
        page.click('[data-act=set][data-k="lyr.c0"][data-v="4"]')
        check(page.evaluate("() => S.mock.scores.teacher['lyr.c0']") is None, "re-tap did not clear score")
        page.click('[data-act=set][data-k="lyr.c0"][data-v="4"]')
        page.fill('#main input[type=text], #main textarea[data-overall]', 'Great progress since last month.')
        shot(page, "sheet_ms_clarinet")

        # ---------- 4. results + history save ----------
        page.click("[data-act=results]")
        page.wait_for_timeout(150)
        check("69.5" in page.inner_text(".res-total"), "results total")
        check("15.5 points below" in page.inner_text(".cut"), "cut gauge message")
        check("Bb (C)" in page.inner_text(".miss"), "scale misses listed")
        shot(page, "results_ms_clarinet")
        hist = page.evaluate("() => getHistory().length")
        check(hist >= 1, "results did not save to history")

        # ---------- 5. share link round trip (incl. compression) ----------
        page.click("[data-act=share]")
        page.wait_for_timeout(400)
        share = page.input_value("#sh-url")
        check("#view=z" in share, "share link not compressed")
        check(page.locator(".qr svg").count() == 1, "QR code missing")
        page.keyboard.press("Escape")
        p2 = b.new_page(viewport={"width": 390, "height": 844})
        p2.on("pageerror", lambda e: errs.append("shared: " + str(e)))
        p2.goto(share)
        p2.wait_for_timeout(400)
        check("69.5" in p2.inner_text(".res-total"), "shared view total")
        check(p2.locator("[data-act=share]").count() == 0, "shared view should be read-only")
        check(p2.is_hidden("#btn-tools"), "tools button visible on shared view")
        shot(p2, "shared_phone")
        p2.close()

        # ---------- 6. print builds both pages ----------
        page.evaluate("() => buildPrint('teacher')")
        check(page.locator("#print .p-page").count() == 2, "print pages")
        check("AUDITION TOTAL: 69.5" in page.inner_text("#print .p-total"), "print total")
        if SHOTS:
            page.emulate_media(media="print")
            page.pdf(path=str(SHOTS / "print_ms_clarinet.pdf"), format="Letter")
            page.emulate_media(media="screen")

        # ---------- 7. self-assessment compare ----------
        page.evaluate("""() => { S.pick = { level: 'concert', inst: 'trumpet', round: 'state', variant: null };
          const m = newMock(); m.student.name = 'Avery Stone'; m.flow = 'self-first'; setMock(m); S.who = 'self'; S.view = 'sheet'; render(); }""")
        check(page.locator(".banner.self").count() == 1, "self banner")
        for i in range(6):
            page.click(f'[data-act=set][data-k="et1.c{i}"][data-v="5"]')
        page.click("[data-act=handoff]")
        check(page.evaluate("() => S.who") == "teacher", "handoff to teacher")
        check(page.locator('[data-act=set].on').count() == 0, "teacher view shows self scores")
        for i, v in enumerate(["4", "3", "4", "3", "3", "3"]):
            page.click(f'[data-act=set][data-k="et1.c{i}"][data-v="{v}"]')
        shot(page, "sheet_hs_state")
        page.click("[data-act=results]")
        page.wait_for_timeout(150)
        txt = page.inner_text("#main")
        check("self-assessment vs. teacher" in txt.lower(), "compare block missing")
        check("10 points higher" in txt, "compare summary should use shared categories only")
        shot(page, "results_compare")

        # ---------- 8. percussion forms render, mallet + slider widgets work ----------
        for rnd in ["district", "state"]:
            page.evaluate(f"""() => {{ S.pick = {{ level: 'concert', inst: 'percussion', round: '{rnd}', variant: null }};
              const m = newMock(); m.student.name = 'Perc {rnd}'; setMock(m); S.who='teacher'; S.view = 'sheet'; render(); }}""")
            check(page.locator(".group-h").count() == 3, f"percussion {rnd} groups")
            shot(page, f"sheet_perc_{rnd}")
        page.click('[data-act=nudge][data-k="ti_et.c0"][data-v="0.5"]')
        check(page.evaluate("() => S.mock.scores.teacher['ti_et.c0']") == 0.5, "slider nudge")

        # ---------- 9. history view, chart, export/import ----------
        page.evaluate("""() => {
          const base = getHistory().find(x => x.inst === 'clarinet');
          ['2026-09-15', '2026-10-12'].forEach((d, i) => {
            const c = JSON.parse(JSON.stringify(base)); c.id = 'seed' + i; c.date = d; c.created = i;
            Object.keys(c.scores.teacher).forEach(k => { if (k.startsWith('sr')) c.scores.teacher[k] = Math.max(0, c.scores.teacher[k] - (2 - i)); });
            delete c.summary; saveToHistory(c, true);
          });
          S.histKey = studentKey(base); S.histFilter = null; S.view = 'history'; render(); }""")
        check(page.locator("#hchart circle.dot").count() == 3, "history chart points")
        check(page.locator("#hchart .cutl").count() == 1, "history cut line")
        page.hover("#hchart circle.hit >> nth=0")
        check(page.is_visible("#htip"), "chart tooltip")
        shot(page, "history")
        with page.expect_download() as dl:
            page.click("[data-act=export] >> nth=0")
        path = dl.value.path()
        page.evaluate("() => localStorage.removeItem('asm.history.v1')")
        page.set_input_files("#import", path) if page.locator("#import").count() else None
        page.evaluate("() => { S.view = 'history'; render(); }")
        page.set_input_files("#import", path)
        page.wait_for_timeout(300)
        check(page.evaluate("() => getHistory().length") >= 4, "import restored history")

        # ---------- 9b. wind scale boxes default to 0; only an untouched scale section is flagged ----------
        page.evaluate("""() => { S.pick = { level: 'ms', inst: 'trumpet', round: 'district', variant: null };
          const m = newMock(); m.student.name = 'Zero Test'; setMock(m); S.who = 'teacher'; S.view = 'sheet'; render(); }""")
        for sec in ["lyr", "sr"]:
            for i in range(6):
                page.click(f'[data-act=set][data-k="{sec}.c{i}"][data-v="4"]')
        page.click('[data-act=set][data-k="chrom.c0"][data-v="8"]')
        check(page.locator('[data-act=blankzero][data-v=scales]').count() == 0, "wind scales should not show Mark blanks")
        # untouched scale section -> flagged, with no "count as ✗" button
        page.click("[data-act=results]")
        page.wait_for_timeout(150)
        btxt = page.inner_text(".banner.blanks")
        check("Major Scales and Arpeggios (nothing marked)" in btxt, f"untouched scales not flagged: {btxt}")
        check(page.locator("[data-act=blankzero][data-v=all]").count() == 0, "no scale-zero button for wind scales")
        page.click("[data-act=gofix]")
        page.wait_for_timeout(100)
        check(page.evaluate("() => S.view") == "sheet" and page.locator(".srow.flash").count() == 1, "Go to first blank")
        # one tap = ✓, second tap = back to 0; unmarked boxes are scored 0 and not flagged
        k = "scales.r0.a1"
        page.click(f'[data-act=cell][data-k="{k}"]')
        check(page.evaluate(f"() => S.mock.scores.teacher['{k}']") == 1, "first tap should be ✓")
        page.click(f'[data-act=cell][data-k="{k}"]')
        check(page.evaluate(f"() => S.mock.scores.teacher['{k}']") == 0, "second tap should be 0")
        page.click(f'[data-act=cell][data-k="{k}"]')
        check(page.locator(".cell.no").count() == 0, "no red ✗ cells should render")
        page.click('[data-act=rowall][data-row=r2]')
        r = page.evaluate("() => scoreSection(FORM.sections[0], S.mock.scores.teacher)")
        check(r["raw"] == 4 and r["done"] == r["cells"], f"scale section after taps: {r}")  # 1 + Eb row (3)
        page.click('[data-act=rowall][data-row=r2]')
        check(page.evaluate("() => scoreSection(FORM.sections[0], S.mock.scores.teacher).raw") == 1, "✓ all toggles row back to 0")
        page.click("[data-act=results]")
        page.wait_for_timeout(150)
        check(page.locator(".banner.blanks").count() == 0, "banner should not show once scales are touched")
        misses = page.inner_text(".miss")
        check("Bb (C)" in misses and "F (G)" in misses, "unmarked boxes listed as scale misses")
        # mallet scales keep the Mark blanks button (chips, blank = not yet judged)
        page.evaluate("""() => { S.pick = { level: 'ms', inst: 'percussion', round: 'district', variant: null };
          setMock(newMock()); S.view = 'sheet'; render(); }""")
        page.click('[data-act=set][data-k="ma_sc.r0.s"][data-v="8"]')
        page.click('[data-act=blankzero][data-v=ma_sc]')
        check(page.evaluate("() => S.mock.scores.teacher['ma_sc.r1.a']") == 0, "mallet Mark blanks ✗")
        # rubric blanks stay flagged
        page.evaluate("""() => { S.pick = { level: 'ms', inst: 'flute', round: 'state', variant: null }; setMock(newMock());
          S.mock.scores.teacher['prep.c0'] = 8; S.view = 'results'; render(); }""")
        check("Prepared Selection · Technique" in page.inner_text(".banner.blanks"), "rubric blank not named")

        # ---------- 9c. splash page ----------
        page.evaluate("() => { S.view = 'home'; render(); }")
        check(page.locator(".hero-band").count() == 1 and page.locator(".gcard").count() == 3, "splash hero / grade cards")
        check(page.locator(".cont").count() >= 1, "pick-up-where-you-left-off row")
        page.click(".cont[data-act=hopenStudent] >> nth=0")
        check(page.evaluate("() => S.view") == "history", "recent student opens history")
        page.evaluate("() => { S.view = 'home'; render(); }")
        check(page.evaluate("() => document.fonts.check('600 16px Oswald')"), "Oswald font did not load")

        # ---------- 9d. sight reading (First Sight) ----------
        page.evaluate("""() => { S.pick = { level: 'ms', inst: 'trumpet', round: 'district', variant: null };
          const m = newMock(); m.student.name = 'Sight Test'; setMock(m); S.who = 'teacher'; S.view = 'sheet'; render(); }""")
        page.click('[data-act=fsgen][data-v=sr]')
        code = page.evaluate("() => S.mock.sight.sr")
        check(code and code.startswith("5") and "6-" in code, f"default etude should be level 5, 6 bars: {code}")
        check(page.locator('[data-fs-preview=sr] svg').count() >= 2, "etude preview not engraved")
        page.click('[data-act=fsstand][data-v=sr]')
        check(page.is_visible('#stand') and page.locator('#fs-rows svg').count() >= 2, "stand did not open with music")
        # the audition sequence: covered + judge script -> 8 ticks -> study clock -> 8 ticks -> play
        check(page.evaluate("() => FSS.phase") == "brief" and page.is_visible('#fs-cover'), "stand should open on the judge's instructions")
        check("You will have 30 seconds to study this music" in page.inner_text('#fs-judge'), "judge script")
        check(page.is_hidden('.stand-btns'), "play/hear buttons should hide during the sequence")
        check(page.evaluate("() => FSS.click") is False, "click should be off by default in a mock")
        page.evaluate("() => { FSS.bpm = 240; }")                       # speed the ticks up for the test
        # read-aloud is on by default: stub the browser voice so it "finishes" quickly, and check what it was asked to say
        page.evaluate("""() => { window.__said = [];
          speechSynthesis.speak = (u) => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 150); };
          speechSynthesis.cancel = () => {}; }""")
        check(page.locator('#fs-speak').is_checked(), "read-aloud should be on by default")
        check("Read the instructions" in page.inner_text('#fs-give'), "button should mention reading aloud")
        page.click('#fs-give')
        check(page.evaluate("() => FSS.phase") in ("speaking", "tempo1"), "instructions should be read before the ticks")
        page.wait_for_function("() => FSS.phase === 'tempo1' || FSS.phase === 'study'", timeout=15000)
        check(page.evaluate("() => FSS.voiceUsed") == "recording", "30 s study should play the recorded instructions")
        check(page.evaluate("() => window.__said.length") == 0, "the device voice should not speak when the recording plays")
        page.wait_for_function("() => FSS.phase === 'study'", timeout=8000)
        check(page.is_hidden('#fs-cover') and page.is_visible('#fs-study'), "music should be revealed as the study clock starts")
        check(page.locator('#fs-ticks1 i.on').count() == 8, "8 tempo ticks before study")
        page.evaluate("() => { FSS.studyLeft = 0.2; }")
        page.wait_for_function("() => FSS.phase === 'tempo2'", timeout=4000)
        page.wait_for_function("() => FSS.phase === 'perform'", timeout=8000)
        check(page.locator('#fs-ticks2 i.on').count() == 8 or page.is_hidden('#fs-ticks2'), "8 tempo ticks after study")
        check(page.inner_text('#fs-say').startswith("Play!") and page.is_visible('.stand-btns'), "student plays after the second 8 ticks")
        page.click('[data-act=fsrestart]')
        check(page.evaluate("() => FSS.phase") == "brief", "Start over returns to the instructions")
        page.select_option('#fs-studys', '60')
        page.evaluate("() => { FSS.bpm = 240; }")
        page.click('#fs-give')
        page.wait_for_function("() => FSS.phase === 'tempo1' || FSS.phase === 'study'", timeout=6000)
        check(page.evaluate("() => FSS.voiceUsed") == "device" and page.evaluate("() => window.__said[0] || ''").startswith("You will have 60 seconds"),
              "60 s study should use the device voice with the right number")
        page.select_option('#fs-studys', '30') if page.locator('#fs-studys').is_enabled() else None
        page.click('[data-act=fsrestart]')
        page.evaluate("() => { FSS.studyS = 30; fsSavePrefs({ studyS: 30 }); }")
        page.keyboard.press('Escape')
        # Hear It still asks first when the student hasn't played (practice stand from results comes later)
        page.click('[data-act=fsstand][data-v=sr]')
        page.evaluate("() => { FSS.phase = 'free'; fsDrawButtons(); }")
        page.click('#fs-hear')
        check("after the student has played" in page.inner_text('#fs-say'), "Hear It should ask before playing in a mock")
        page.keyboard.press('Escape')
        check(page.is_hidden('#stand'), "Escape should close the stand")
        page.click('[data-act=fsnew][data-v=sr]')
        code2 = page.evaluate("() => S.mock.sight.sr")
        # "Surprise me" picks a new key each time (First Sight's Mix); level (char 0) and length (char 2) stay
        check(code2 != code and code2[0] == code[0] and code2[2] == code[2], f"New etude should keep level/length: {code} -> {code2}")
        # the code survives share links and appears on results + print
        page.evaluate("() => { S.mock.scores.teacher['sr.c0'] = 4; S.view = 'results'; render(); }")
        check(page.locator('[data-act=fspractice][data-v=sr]').count() == 1, "results missing etude block")
        page.evaluate("() => buildPrint('teacher')")
        check(page.locator('#print .fs-print svg').count() >= 2, "print missing etude page")
        packed = page.evaluate("async () => (await decodeShare((await encodeShare(S.mock, {firstName: true, self: true})))).sight.sr")
        check(packed == code2, "share link lost the etude code")
        # every sight-reading section maps to a First Sight instrument (timpani: none) and engraves
        bad = page.evaluate("""() => {
          const out = [];
          for (const L of Object.keys(LEVELS)) for (const I of INSTRUMENTS) for (const R of ['district', 'state']) {
            if (I.hsOnly && L === 'ms') continue;
            const f = buildForm(L, R, I.id, null); const m = { variant: null, level: L, sight: {} };
            f.sections.filter(s => s.sightReading).forEach(s => {
              const info = fsMember(f, s, m);
              if (!info) { if (!s.id.startsWith('ti')) out.push('no member ' + f.key + ' ' + s.id); return; }
              if (!info.member) { out.push('missing member ' + f.key + ' ' + s.id); return; }
              for (let lv = 1; lv <= 6; lv++) {
                const code = FS.code({ level: lv, key: 'Ab', bars: 8, seed: 'K7QX' });
                const b = fsBuild(code, info); const rows = fsEngrave(b.et, b.real, 700, 't-');
                if (!rows.length || !rows[0].E.svg.includes('<svg')) out.push('engrave ' + f.key + ' L' + lv);
              }
            });
          }
          return out; }""")
        check(not bad, f"sight-reading coverage: {bad[:5]}")
        page.evaluate("() => { S.pick = { level: 'concert', inst: 'trumpet', round: 'state', variant: null }; setMock(newMock()); S.view = 'sheet'; render(); }")
        check("middle-school district-level" in page.inner_text('#sec-sr1'), "HS label missing")

        # ---------- 11. quick checks + section trends ----------
        page.evaluate("() => { localStorage.clear(); S.view = 'home'; render(); }")
        page.click("[data-act=level][data-v=ms]"); page.click("[data-act=inst][data-v=clarinet]")
        check(page.locator("[data-act=qround][data-round=district]").count() == 4, "district quick-check chips")
        check(page.locator("[data-act=qround][data-round=state]").count() == 2, "state quick-check chips (etude, sight reading)")
        page.click("[data-act=qround][data-round=district][data-v=scales]")
        page.fill("#f-name", "Quinn Park"); page.click("[data-act=start]")
        check(page.evaluate("() => FORM.sections.map(s => s.id).join()") == "scales", "quick check should show only scales")
        check(page.evaluate("() => FORM.max") == 30 and page.evaluate("() => FORM.cut") is None, "quick check max 30, no cut line")
        page.click("[data-act=allperfect][data-v=scales]")
        page.click('[data-act=cell][data-k="scales.r0.arp"]')
        page.click("[data-act=results]"); page.wait_for_timeout(150)
        check("Quick check: Major scales" in page.inner_text("#main"), "results label quick check")
        check(page.locator(".panel.cut").count() == 0, "no cut gauge on a quick check")
        sm = page.evaluate("() => getHistory().find(x => x.student.name === 'Quinn Park').summary")
        check(sm["scope"] == "Major scales" and "scales" in sm["secs"], f"quick-check summary: {sm}")
        # a full mock with scales too -> the Scales series has 2 points (1 quick hollow + 1 full)
        page.evaluate("""() => { S.pick = { level: 'ms', inst: 'clarinet', round: 'district', variant: null, scope: null };
          const m = newMock(); m.student.name = 'Quinn Park'; m.date = '2026-11-12'; setMock(m);
          const s = m.scores.teacher; sectionKeys(FORM.sections[0]).forEach(k => s[k] = 1); s['chrom.c0'] = 8;
          ['lyr','sr'].forEach(x => { for (let i = 0; i < 6; i++) s[x + '.c' + i] = 4; }); saveToHistory(m, true);
          S.histKey = 'quinn park'; S.histFilter = null; S.histSeries = null; S.view = 'history'; render(); }""")
        check(page.locator("[data-act=hseries]").count() >= 4, "series chips")
        page.click("[data-act=hseries][data-v=scales]")
        check(page.locator("#hchart circle.dot").count() == 2 and page.locator("#hchart circle.dot.quick").count() == 1, "scales trend uses quick + full")
        page.click("[data-act=hseries][data-v=overall]")
        check(page.locator("#hchart circle.dot").count() == 1, "overall chart: full mocks only")
        shot(page, "v2_history_quick")

        # ---------- 12. goals ----------
        page.fill("[data-goal=date]", "2027-01-31"); page.dispatch_event("[data-goal=date]", "change")
        page.fill("[data-goal=target]", "90"); page.dispatch_event("[data-goal=target]", "change")
        txt = page.inner_text(".goal-card")
        check("days" in txt and "to the target" in txt, f"goal card: {txt}")
        check(page.locator("#hchart .goall").count() == 1, "goal line on chart")
        page.evaluate("""() => { const base = getHistory().find(x => x.student.name === 'Quinn Park' && !x.scope);
          [['2026-10-01', 3], ['2026-10-20', 3.5]].forEach(([d, v], i) => { const c = JSON.parse(JSON.stringify(base)); c.id = 'g' + i; c.date = d;
            ['lyr','sr'].forEach(x => { for (let k = 0; k < 6; k++) c.scores.teacher[x + '.c' + k] = v; }); delete c.summary; saveToHistory(c, true); });
          render(); }""")
        check(page.locator(".pace").count() == 1 and ("pace" in page.inner_text(".pace").lower()), "pace projection shown")
        page.click("[data-act=goalall]")
        check(page.evaluate("() => JSON.parse(localStorage.getItem('asm.prefs.v1')).auditionDate") == "2027-01-31", "default audition date saved")
        shot(page, "v2_goals")

        # ---------- 13. instrument tips ----------
        tip = page.evaluate("() => tipsFor('tone', 'trumpet')[0]")
        check("partial" in tip.lower() or "buzz" in tip.lower(), f"trumpet tone tip: {tip}")
        check(page.evaluate("() => tipsFor('technique', 'clarinet')[0]").lower().find("break") >= 0, "clarinet technique tip mentions the break")
        bad = page.evaluate("() => ['trumpet', 'horn', 'lowbrass'].flatMap(f => Object.values(INST_TIPS[f]).flat()).filter(t => /\\blip/i.test(t))")
        check(not bad, f"brass tips must say partial, not lip: {bad}")
        plan = page.evaluate("() => practicePlan([{key:'tone', got:3, max:5, pct:60, ctx:[]}], null, [], 'percussion')")
        check(plan[0]["t"] == "Warm-up on a pad", "percussion warm-up")

        # ---------- 14. audition day ----------
        page.evaluate("() => { S.view = 'home'; render(); }")
        page.click("[data-act=session]")
        page.fill("[data-ss=roster]", "Ava Lee\nBen Cruz, Trumpet\nCam Diaz")
        page.click("[data-act=ssstart]")
        check(page.locator(".sess-bar").count() == 1 and "Student 1 of 3" in page.inner_text(".sess-bar"), "session bar")
        check(page.evaluate("() => S.mock.student.name") == "Ava Lee", "first student opened")
        page.click("[data-act=fsgen][data-v=sr]")
        code = page.evaluate("() => S.mock.sight.sr")
        page.click("[data-act=set][data-k='lyr.c0'][data-v='4']")
        page.wait_for_timeout(350)
        page.click("[data-act=ssnext]")
        check(page.evaluate("() => S.mock.student.name") == "Ben Cruz" and page.evaluate("() => S.mock.inst") == "trumpet", "roster instrument override")
        check(page.evaluate("() => S.mock.sight.sr") == code, "shared sight-reading etude carries to the next student")
        page.click("[data-act=set][data-k='lyr.c0'][data-v='5']")
        page.click("[data-act=ssprev]")
        check(page.evaluate("() => S.mock.scores.teacher['lyr.c0']") == 4, "going back reopens the saved mock")
        page.click("[data-act=sssummary]")
        rows = page.locator(".sess-table tbody tr")
        check(rows.count() == 3 and "Ben Cruz" in rows.nth(0).inner_text(), "summary ranked (Ben first), 3 rows")
        check("not scored" in rows.nth(2).inner_text(), "unscored student listed last")
        with page.expect_download() as dl:
            page.click("[data-act=sscsv]")
        csv = open(dl.value.path(), encoding="utf-8-sig").read()
        check("Ben Cruz" in csv and "Rank" in csv, "CSV download")
        shot(page, "v2_session_summary")
        page.evaluate("() => sessAction('ssopen', '1')")
        shot(page, "v2_session_sheet", full=False)
        page.evaluate("() => sessAction('ssend')")
        check(page.evaluate("() => sessActive()") is None, "end audition day")

        # ---------- 15. recording (fake microphone) ----------
        page.evaluate("""() => { S.pick = { level: 'ms', inst: 'flute', round: 'district', variant: null };
          const m = newMock(); m.student.name = 'Rec Test'; setMock(m); S.view = 'sheet'; render(); }""")
        page.click("[data-act=recstart][data-v=lyr]")
        page.wait_for_function("() => !!REC.mr", timeout=5000)
        page.wait_for_timeout(1500)
        page.click("[data-act=recstop][data-v=lyr]")
        page.wait_for_function("() => !!document.querySelector('[data-rec-row=lyr] audio')", timeout=5000)
        r = page.evaluate("async () => { const x = await recGet(S.mock.id + '|lyr'); return x && x.blob.size; }")
        check(r and r > 1000, f"recording saved to IndexedDB ({r} bytes)")
        page.click("[data-act=set][data-k='lyr.c0'][data-v='4']")
        page.click("[data-act=results]")
        page.wait_for_function("() => { const p = document.querySelector('[data-rec-panel]'); return p && !p.hidden; }", timeout=5000)
        check(page.locator("[data-rec-panel] audio").count() == 1 and page.locator("[data-rec-panel] a[download]").count() == 1, "results recording + download")
        shot(page, "v2_results_recording", full=False)
        mid = page.evaluate("() => S.mock.id")
        page.evaluate(f"async () => {{ await recDeleteMock('{mid}'); }}")
        check(page.evaluate(f"async () => !!(await recGet('{mid}|lyr'))") is False, "deleting a mock deletes its recordings")
        # stand auto-record at "Play!"
        page.evaluate("() => { S.view = 'sheet'; render(); fsGenerate('sr'); fsSavePrefs({ rec: true }); }")
        page.click("[data-act=fsstand][data-v=sr]")
        check(page.locator("#fs-rec").is_checked(), "stand record switch")
        page.evaluate("() => { FSS.bpm = 240; FSS.speak = false; fsDrawCover(); }")
        page.click("#fs-give")
        page.wait_for_function("() => FSS.phase === 'study'", timeout=8000)
        page.evaluate("() => { FSS.studyLeft = 0.2; }")
        page.wait_for_function("() => FSS.phase === 'perform' && !!REC.mr", timeout=8000)
        check(page.is_visible("#fs-rec-live"), "REC indicator on the stand")
        page.wait_for_timeout(800)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !REC.mr", timeout=5000)
        page.wait_for_timeout(300)
        check(page.evaluate("async () => !!(await recGet(S.mock.id + '|sr'))"), "stand recording saved for the sight-reading section")
        page.evaluate("() => fsSavePrefs({ rec: false })")

        # ---------- 16. offline ----------
        ctx2 = b.new_context()
        po = ctx2.new_page()
        po.goto(url.replace("127.0.0.1", "localhost"))
        po.wait_for_function("() => navigator.serviceWorker && navigator.serviceWorker.controller !== undefined", timeout=5000)
        po.evaluate("() => navigator.serviceWorker.ready")
        po.wait_for_timeout(800)
        po.reload(); po.wait_for_timeout(500)
        ctx2.set_offline(True)
        po.reload(); po.wait_for_timeout(600)
        check(po.locator(".hero-band").count() == 1, "app loads offline after the first visit")
        check(po.evaluate("() => document.fonts.check('600 16px Oswald')"), "fonts available offline")
        ctx2.set_offline(False); ctx2.close()

        # ---------- 10. dark mode + phone sheet ----------
        page.evaluate("() => { document.documentElement.dataset.theme = 'dark'; S.pick = { level: 'symphonic', inst: 'basstrombone', round: 'district', variant: null }; setMock(newMock()); S.view='sheet'; render(); }")
        check(page.locator(".banner.warn").count() == 1, "bass trombone factor notice")
        shot(page, "sheet_dark_basstrombone", full=False)
        ph = b.new_page(viewport={"width": 390, "height": 844})
        ph.on("pageerror", lambda e: errs.append("phone: " + str(e)))
        ph.goto(url)
        ph.click("[data-act=level][data-v=ms]")
        ph.click("[data-act=inst][data-v=contraclar]")
        ph.click("[data-act=variant][data-v=eb]")
        ph.click("[data-act=round][data-v=district]")
        ph.fill("#f-name", "Sam Lee")
        ph.click("[data-act=start]")
        check(ph.evaluate("() => FORM.sections[0].rows.map(r => r.oct).join('')") == "1212", "Eb contra octaves")
        overflow = ph.evaluate("() => document.documentElement.scrollWidth > window.innerWidth + 1")
        check(not overflow, "horizontal overflow on phone")
        shot(ph, "phone_sheet")
        ph.click("[data-act=home]")
        shot(ph, "phone_home")
        ph.close()

        check(not errs, f"console/page errors: {errs}")
        b.close()
    srv.shutdown()
    print(f"\n{'FAILED' if FAILS else 'PASSED'}: {len(FAILS)} failure(s)")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()
