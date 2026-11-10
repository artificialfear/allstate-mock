#!/usr/bin/env python3
"""Regenerate src/hs_district.js from the GMEA district (first round) audition-form PDF.

Usage:  python3 tools/gen_hs_district.py "first round score sheets.pdf"
Needs poppler's pdftotext. Finds every 9-10 / 11-12 wind page, reads each scale row
"<Key> (<written>) ... (N max)", the "x <factor>" adjustment, and the recommendation line,
then prints a math check (raw max x factor should be ~30).
"""
import json, pathlib, re, subprocess, sys

IDS = {'Flute': 'flute', 'Oboe': 'oboe', 'Bassoon': 'bassoon', 'Clarinet': 'clarinet', 'Bass Clarinet': 'bassclar',
       'Contra Clarinet': 'contraclar', 'Alto Saxophone': 'altosax', 'Tenor Saxophone': 'tenorsax',
       'Baritone Saxophone': 'barisax', 'Trumpet': 'trumpet', 'French Horn': 'horn', 'Trombone': 'trombone',
       'Bass Trombone': 'basstrombone', 'Baritone': 'baritone', 'Tuba': 'tuba'}

pdf = sys.argv[1]
n = int(re.search(r'Pages:\s+(\d+)', subprocess.check_output(['pdfinfo', pdf]).decode()).group(1))
out = {}
for p in range(1, n + 1):
    t = subprocess.check_output(['pdftotext', '-layout', '-f', str(p), '-l', str(p), pdf, '-']).decode()
    lvl = 'concert' if 'Grades 9-10' in t else 'symphonic' if 'Grades 11-12' in t else None
    inst = re.search(r'Instrument:\s*(.+?)\s{2,}', t)
    if not lvl or not inst or 'Wind Instrument' not in t:
        continue
    rows = []
    for a, b in re.findall(r'^(\S.*?)\s{5,}\((\d+) max\)', t, re.M):
        m = re.match(r'(\S+)(?:\s*\((\S+)\))?', a.strip())
        rows.append([m.group(1), m.group(2) or '', int(b)])
    fac = float(re.search(r'x\s*([\d.]+)', t).group(1))
    cut = float(re.search(r'recommendation:\s*([\d.]+)', t).group(1))
    out.setdefault(lvl, {})[IDS[inst.group(1)]] = {'factor': fac, 'cut': cut, 'scales': rows}

for lvl, d in out.items():
    for k, v in d.items():
        raw = sum(r[2] for r in v['scales'])
        flag = '' if abs(raw * v['factor'] - 30) < 0.05 else '   <-- printed factor does not give 30'
        print(f"{lvl:9} {k:13} raw {raw:3} x {v['factor']:.4f} = {raw * v['factor']:.3f}{flag}")
dest = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'hs_district.js'
dest.write_text('const HS_DISTRICT = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print('wrote', dest)
