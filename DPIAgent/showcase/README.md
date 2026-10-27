# DPIAgent walkthrough

Four slides: the user's updated NIPS cover and three complete trajectory replays.
Every action plays in its original order at a constant **3×** speed. No steps are
selected, skipped or held. The original player handles command/output streaming,
scrolling and the six-field handoff. Each replay is followed by three seconds of
its recorded reference-fix evaluation. Transitions fade through white.

| Case | Model | Full original actions | Replay at 3× |
| --- | --- | --- | --- |
| Sphinx single-element tuple | GPT-5 Mini | 9 | 17.46 seconds |
| Matplotlib Hexbin threshold | GPT-5 | 17 | 33.80 seconds |
| xarray coordinate preservation | Claude Opus 4.5 | 22 | 42.94 seconds |

Including the four-second cover and evaluation displays, the presentation lasts
about 107 seconds. These are the player's replay timings, not original inference
wall-clock times. Commands, observations, tools and tests are unchanged. The
FAILED/PASSED cards are archived SWT-Bench reference-fix evaluations of the same
submitted test patch, separately labeled from the agent's own output.

Space plays/pauses, arrow keys change slides, and controls support seeking and
fullscreen. The full explorer still has the same three cases for all three models.
The presentation uses its `?presentation=1` read/seek API; standard explorer URLs
are unaffected.

The cover is extracted directly from the user's updated `DPIAgent-Demo.pptx`,
including its NIPS logo and placement. The editable source is
`../assets/demo/dpiagent-cover.pptx`; its matching PNG is used in web/video exports.
The fades follow the [InfiniDepth demo](https://github.com/zju3dv/InfiniDepth).

Run `python scripts/record_demo.py` from the site root with a static server on
port 8765. `?capture=1` hides controls. `../assets/demo/recording.json` records the
playback multiplier, complete trajectory references, scene timings and source /
artifact SHA-256 hashes. Then run `python scripts/build_demo_pptx.py` to embed all
three new clips in the four-slide PowerPoint.
