# DPIAgent trajectory demo

Static HTML/CSS/JavaScript; no build step, runtime API, or JavaScript dependencies.
The paper and demo share visual tokens in `assets/theme.css` and load the same
Inter stylesheet (with system font fallbacks).
A model navigation bar switches between GPT-5, GPT-5 Mini, and Claude Opus 4.5.
Case tabs sit below it. Only the DPI runs without test selection are exported;
old selection URLs fall back to the default model for the same case.
The project page embeds this player at `DPIAgent/#demo`; the standalone player is at `DPIAgent/demo/`.

The interface presents **two phases**, with the protocol at their boundary.
Divide, Protocol, and Isolate are design principles, not three execution phases.
Exploration and test-generation histories remain in separate panes. During the
handoff, six fields are extracted verbatim from the recorded summary (including
bold, uppercase, and `Reference tests examined` heading variants). No new diagnosis
is generated. Fields can be expanded, and the complete recorded handoff remains
available. The incoming test plan is also shown in the second phase.

The explicit transition marker confirms the toolset change: RPG graph tools are
removed and the recorded test-writing tools become available. This depicts the
recorded action space; the browser does not execute tools. Playback pauses at the
handoff by default, then resumes with **Continue to phase 2**. Disable the pause
to watch continuously, or use **Watch the handoff** to focus on the boundary.

From the repository root:

```bash
python -m http.server 8765 --bind 0.0.0.0
```

Open http://localhost:8765/DPIAgent/demo/ or http://localhost:8765/DPIAgent/#demo.
For a remote development machine, forward port 8765 to your browser's machine.

## Trace data

The gallery contains four cases and three models (12 runs), selected from
the supplied `agent-traces.zip`. Only the selected run is fetched. Each JSON keeps
the original actions, observations, recorded reasoning, issue, and submitted patch.
Repeated queries, system prompts, environment settings, and replay configuration
are excluded. Source member names and SHA-256 hashes identify the original records.

The Astropy case is `astropy__astropy-14365` (QDP command case sensitivity),
and Django is `django__django-10999` (negative duration parsing). Together with
the existing scikit-learn and Requests cases, all 12 original runs have been
checked for zero `python_add*` or `generate_test` invocations in their tool/action
records. The exporter rejects a selected run if it calls those helpers; it does
not filter individual steps. Original observations can still mention a helper
in an environment-generated usage hint. Such hints are not tool calls.

Old links to the replaced Astropy/Django cases resolve to the new case for that
library. The previously recorded GIF/MP4 remain historical recordings of the
old Django username-validation case, separate from the current gallery.

Regenerate the checked-in JSON from the archive:

```bash
python scripts/build_demo_traces.py /path/to/agent-traces.zip
```

Edit `TASKS` in that script to change the case selection. The archive is not
required to serve the generated site. A `ready_to_write_test` call marks a handoff;
the explicit phase-transition marker in its observation changes subsequent steps
to test generation. Exit status is displayed verbatim and is not a benchmark score.

Playback uses illustrative timing (3–9 seconds per ordinary tool call and
12 seconds for the diagnosis handoff at 1×), not original wall-clock time. All action/output text is retained; long outputs can be expanded
and reasoning is available under each call. Reduced-motion settings reveal each
step without character animation. Task/config selections are preserved in the URL.

## Reading the trajectory

The player keeps two spacious phase workspaces around the diagnosis handoff,
using the paper's shared font and blue accent. Action labels and colored rules distinguish inspection (blue), shell
execution (ochre), edits/submissions (green), and the handoff (purple). Commands
and output have separate surfaces. Source paths, strings, Python keywords, test
names, and assertions are highlighted; error lines and unified-diff additions,
deletions, and headers receive distinct backgrounds. These are text patterns,
not independent judgments of correctness. A green edit or submitted patch does
not imply a passing evaluation.

Key-step links are derived from the recorded tool calls and command text. The
handoff puts root cause and test plan first, with the original summary available
in full. Highlighting creates text nodes and spans only, preserves every source
character, and never executes markup from a trace. The primary play button sits beside the run title; detailed playback controls
follow the panes. Key-step navigation and the color guide are expandable.
Trace text is 14px on desktop and 16px on small screens.

## Handoff animation

The six fields form a single-open accordion. Playback opens the current field's
original text and closes the previous one as the progress indicator advances.
After the sixth field, that final item remains open for inspection. Use **View**
to inspect another received field; it pauses playback and closes the other item.
Resuming continues the sequence at the next field. Seeking reconstructs the
matching open item, and switching runs clears manual selections.

The text uses normal document flow, with long values scrolling inside the open
item (maximum 180px). Collapsed items only show their headers. No overlay or
text scaling is used. The replay clock drives the subtle background emphasis;
reduced-motion mode disables its scaling. The hidden full handoff transcript is
rendered when complete or explicitly opened rather than on every frame.

## Local verification

Validated in Chromium: play/pause, restart, speed selection, phase and step jumps,
seeking through completion, task/config changes, URL reload, artifact downloads,
load-error recovery, reduced motion, and desktop/mobile embedded layouts.
Also checked across all 12 runs: protocol fields match their source summaries,
phase histories stay separate, the incoming plan matches the handoff, and rewinding
clears the transferred state. Automatic boundary pause and continuous playback
were exercised separately.
All 12 exported runs were compared against the source archive for exact action,
observation, and final-patch fidelity.

The files can be served from GitHub Pages without changing paths. Publishing is
a separate step after local review.
