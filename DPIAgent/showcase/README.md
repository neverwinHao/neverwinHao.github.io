# DPIAgent visual walkthrough

A 16:9 slide presentation that introduces three real issues, embeds selected
moments from the current trajectory player, and shows the recorded reference-fix
evaluation. Use Space to play/pause and arrow keys to move between slides. The
controls also support seeking and fullscreen. Playback starts only on request.

The sequence is 88 seconds: a four-second cover and three 28-second demos.
Transitions fade through white without zoom or translation. Each demo ends on
the recorded fail-to-pass evaluation in the player and uses a different model:

| Issue | Model | Selected original steps |
| --- | --- | --- |
| Sphinx single-element tuple | GPT-5 Mini | 2, 3, 4: exploration, 5: handoff, 6: test, 7: failure |
| Matplotlib Hexbin threshold | GPT-5 | 3, 5, 9: exploration, 13: handoff, 14: test, 15: failures |
| xarray coordinate preservation | Claude Opus 4.5 | 1, 9, 10: exploration, 11: handoff, 14: test, 15: failures |

Each exploration action stays visible for four seconds (12 seconds total), followed
by the six-second handoff, three seconds of test writing, three seconds of original
failure, and four seconds of reference-fix results. A single exploration action is
kept in view, with its command and relevant output; later steps cannot scroll it away.

These are editorially selected moments, not a claim to show every tool call in
real time. The underlying player retains every original step. Presentation
framing removes navigation chrome and scrolls to relevant source/assertion lines;
it does not change commands, outputs, tool names, or generated tests. The final
player cards use the named FAILED/PASSED excerpts already verified by the exporter.
They are labeled as separate SWT-Bench evaluation, not agent tool outputs.

The presentation uses the same player with `?presentation=1`, which exposes a
small read/seek/focus API. Standard explorer URLs are unaffected. The full explorer
continues to offer the same three cases for each of all three models.

Visual references: the minimal titles and fades in the GIF on
[InfiniDepth](https://github.com/zju3dv/InfiniDepth), and the user-provided
`TestExplora-Pre.pptx`. The cover directly reuses its first-slide layout, with the
title, authors, affiliations and venue updated from the DPIAgent project page.
`../assets/demo/dpiagent-cover.pptx` is the editable cover; its rendered PNG is used
by the web presentation and video so their appearance matches the PowerPoint.

Record MP4/GIF with `python scripts/record_demo.py` from the site root while a
static server runs on port 8765. `?capture=1` fits the stage to the viewport and
hides presentation controls. Recording metadata includes source file hashes,
trajectory hashes, scene timings and artifact hashes in
`../assets/demo/recording.json`.
