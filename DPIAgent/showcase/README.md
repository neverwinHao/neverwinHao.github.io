# DPIAgent visual walkthrough

A 16:9 slide presentation that introduces three real issues, embeds selected
moments from the current trajectory player, and shows the recorded reference-fix
evaluation. Use Space to play/pause and arrow keys to move between slides. The
controls also support seeking and fullscreen. Playback starts only on request.

The sequence is 87.5 seconds: cover, method overview, three issue/recording/result
chapters, and links to the complete explorer. Each chapter uses a different model:

| Issue | Model | Selected original steps |
| --- | --- | --- |
| Sphinx single-element tuple | GPT-5 Mini | 2: inspection, 5: handoff, 6: test, 7: failure |
| Matplotlib Hexbin threshold | GPT-5 | 5: inspection, 13: handoff, 14: test, 15: failures |
| xarray coordinate preservation | Claude Opus 4.5 | 9: inspection, 11: handoff, 14: test, 15: failures |

These are editorially selected moments, not a claim to show every tool call in
real time. The underlying player retains every original step. Presentation
framing removes navigation chrome and scrolls to relevant source/assertion lines;
it does not change commands, outputs, tool names, or generated tests. The result
slides use the named FAILED/PASSED excerpts already verified by the exporter.
They are labeled as separate SWT-Bench evaluation, not agent tool outputs.

The presentation uses the same player with `?presentation=1`, which exposes a
small read/seek/focus API. Standard explorer URLs are unaffected. The full explorer
continues to offer the same three cases for each of all three models.

Visual references: the chapter-based GIF on
[InfiniDepth](https://github.com/zju3dv/InfiniDepth), and the user-provided
`TestExplora-Pre.pptx` (white slides, blue title rule, sequential flow emphasis).
No TestExplora results, author lists, or conference branding are reused.

Record MP4/GIF with `python scripts/record_demo.py` from the site root while a
static server runs on port 8765. `?capture=1` fits the stage to the viewport and
hides presentation controls. Recording metadata includes source file hashes,
trajectory hashes, scene timings and artifact hashes in
`../assets/demo/recording.json`.
