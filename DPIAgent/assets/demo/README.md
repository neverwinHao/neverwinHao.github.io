# DPIAgent demo recording

[![DPIAgent walkthrough](dpiagent-demo.gif)](https://neverwinhao.github.io/DPIAgent/showcase/)

[MP4](dpiagent-demo.mp4) · [GIF](dpiagent-demo.gif) · [Presentation](https://neverwinhao.github.io/DPIAgent/showcase/) · [Full explorer](https://neverwinhao.github.io/DPIAgent/demo/)

The user's updated NIPS cover for 1.2 seconds, followed by three **complete replays at 3× speed**.
All 48 original actions play continuously and in order. Each case ends with its
recorded fail-to-pass evaluation, and scenes fade through white.

| Case | Model | Original actions |
| --- | --- | --- |
| Sphinx single-element tuple | GPT-5 Mini | 9 |
| Matplotlib Hexbin count threshold | GPT-5 | 17 |
| xarray coordinate preservation | Claude Opus 4.5 | 22 |

| Artifact | Format |
| --- | --- |
| `dpiagent-demo.mp4` | About 104 seconds, 1600 × 900, H.264, 20 fps, silent |
| `dpiagent-demo.gif` | About 104 seconds, 960 × 540, 15 fps, looping, same speed as MP4 |
| `dpiagent-demo-poster.png` | Updated NIPS cover, 1600 × 900 |
| `dpiagent-cover.pptx` / `.png` | User's editable cover and matching rendered image |
| `recording.json` | Playback rate, scene timings, trajectory/evaluation references and hashes |

Playback speeds up the existing player's timeline, not original inference
wall-clock time. No actions or outputs are rewritten. FAILED/PASSED cards are
exact excerpts from separate recorded SWT-Bench evaluations of the same submitted
test patch. The full explorer retains all nine model/case recordings.

## Re-record

Start `python -m http.server 8765` from the site root, then run:

```bash
python scripts/record_demo.py
python scripts/build_demo_pptx.py
```

Requires Python Playwright/Chromium, Pillow, python-pptx and ffmpeg. The second command
writes `../DPIAgent-Demo.pptx` with its editable cover and three embedded videos.
To sync later user edits to the cover, run `python scripts/build_demo_cover.py`
before recording and render the extracted cover to a 1600 × 900 PNG.

GIF export reserves 64 palette entries for colored cover artwork and up to 191
for the replay, with a transparent entry for compression. Static logos keep their
colors instead of competing with changing terminal output for the whole palette.
