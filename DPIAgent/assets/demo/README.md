# DPIAgent demo recording

[![DPIAgent visual walkthrough](dpiagent-demo.gif)](https://neverwinhao.github.io/DPIAgent/showcase/)

[MP4](dpiagent-demo.mp4) · [GIF](dpiagent-demo.gif) · [Poster](dpiagent-demo-poster.png) · [Slide presentation](https://neverwinhao.github.io/DPIAgent/showcase/) · [Full explorer](https://neverwinhao.github.io/DPIAgent/demo/)

The walkthrough uses the latest trajectory player within a slide presentation:
the adapted TestExplora cover and three demos, with smooth fades through white. Each demo ends
on the recorded fail-to-pass evaluation in the player.

| Chapter | Issue | Model |
| --- | --- | --- |
| 1 | Sphinx: a single-element tuple loses its comma | GPT-5 Mini |
| 2 | Matplotlib: Hexbin excludes the count boundary | GPT-5 |
| 3 | xarray: coordinates become data variables | Claude Opus 4.5 |

| Artifact | Format |
| --- | --- |
| `dpiagent-demo.mp4` | 88 seconds, 1600 × 900, H.264, 20 fps, silent |
| `dpiagent-demo.gif` | 88 seconds, 960 × 540, 15 fps, looping; same speed as MP4 |
| `dpiagent-demo-poster.png` | Cover slide, 1600 × 900 |
| `dpiagent-cover.pptx` / `dpiagent-cover.png` | Editable template-based cover and matching rendered image |
| `recording.json` | Scene timings, original trajectory and evaluation references, source/artifact SHA-256 hashes |

Each demo holds three exploration actions for four seconds each, then shows
the handoff, test writing, failure and reference-fix results. The clips show
selected recorded moments with editorial timing. Original tool
commands and outputs are unchanged. The framing scrolls to relevant code and
assertion lines. FAILED/PASSED player cards are exact named excerpts from the
separate recorded SWT-Bench evaluations of the same submitted test patch.
The complete explorer retains every step and all nine recordings.

Short titles and fades through white take inspiration from InfiniDepth's demo
GIF. The cover directly adapts `TestExplora-Pre.pptx`, with DPIAgent title, authors,
affiliations and venue from the current project page.

## Re-record

From the site root, start `python -m http.server 8765`, then run:

```bash
python scripts/record_demo.py --base-url http://localhost:8765
```

For the native presentation, run `python scripts/build_demo_pptx.py` after
recording. It writes `../DPIAgent-Demo.pptx` with three embedded MP4 clips and
the editable cover. `scripts/build_demo_cover.py` rebuilds the cover from the
user-provided template and current project-page title/authors.

Requires Python Playwright with Chromium and ffmpeg. The recorder seeks the
presentation at fixed frame intervals and pipes browser screenshots into the
video encoder. The GIF is derived from that MP4. Outputs are replaced after
successful capture and format verification.

## README embed

```markdown
[![DPIAgent walkthrough](DPIAgent/assets/demo/dpiagent-demo.gif)](https://neverwinhao.github.io/DPIAgent/showcase/)
```
