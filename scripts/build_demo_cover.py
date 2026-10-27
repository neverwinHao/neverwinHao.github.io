#!/usr/bin/env python3
"""Extract the user's updated first slide, preserving its logo and layout.

Run before recording. By default reads ../DPIAgent-Demo.pptx; --source accepts
another deck. Render the resulting cover PPTX to 1600x900 PNG for web/video use.
"""
from pathlib import Path
import argparse
from pptx import Presentation
ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'neverwinHao.github.io/DPIAgent/assets/demo'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source', type=Path, default=ROOT / 'DPIAgent-Demo.pptx')
args = parser.parse_args()
prs = Presentation(args.source)
for sid in list(prs.slides._sldIdLst)[1:]:
    prs.part.drop_rel(sid.rId)
    prs.slides._sldIdLst.remove(sid)
prs.save(ASSETS / 'dpiagent-cover.pptx')
print('Preserved updated cover from', args.source)
