# DPIAgent trajectory demo

Static HTML/CSS/JavaScript; no build step, runtime API, or JavaScript dependencies.
The paper and demo share visual tokens in `assets/theme.css` and load the same
Inter stylesheet (with system font fallbacks).
The model bar lists GPT-5 Mini, GPT-5 and Claude Opus 4.5, in that order.
Case tabs below it show recordings available for the selected model. Switching
models keeps the case when available, otherwise opens that model's first case.
Only runs without test selection are exported. Retired case URLs preserve a
valid requested model and fall back to one of its available recordings.
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

The gallery contains nine runs: the same three cases for each of the three
models. Switching models preserves the selected case. Every run
shows the generated regression test failing in the original trajectory, and
the same submitted test passing with the reference fix in the recorded
SWT-Bench evaluation. The agent's task is to write reproduction tests, not fix
the implementation. A temporary implementation fix inside its trajectory is
therefore not required for inclusion.

Complete recorded step counts:

| Case | Opus 4.5 | GPT-5 | GPT-5 Mini |
| --- | ---: | ---: | ---: |
| `sphinx-doc__sphinx-9367` — Single-element tuples | 13 | 11 | 9 |
| `matplotlib__matplotlib-26113` — Hexbin count threshold | 24 | 17 | 12 |
| `pydata__xarray-7233` — Coordinate preservation | 22 | 13 | 11 |

The cases cover a missing trailing comma in `(1,)`, an inclusive bin-count
threshold, and coordinates becoming data variables after `coarsen.construct`.

The Opus Matplotlib recording additionally shows a temporary implementation
fix: step 14 fails, step 16 passes, and step 18 fails after restoration.

At the end of the other eight replays, a separate **Reference-fix check** shows the
named FAILED and PASSED lines from the recorded evaluation with full-log links.
This section is labeled as SWT-Bench evaluation, is not a numbered agent tool
call, and does not change the trajectory or its step count. Seeking backward,
restarting, or switching recordings removes the result until the replay ends.
`validation_source` distinguishes `original_trajectory` from `reference_fix`.
All final submitted patches change test files only.

Counts are complete recorded steps, including repeated submission calls. No steps
are removed. Each JSON retains original actions, observations, recorded reasoning,
issue, handoff and submitted patch; source names and SHA-256 hashes identify the
records. System prompts and replay configuration are excluded.

The exporter requires all of the following before writing the gallery:

- No actual `python_add*` or `generate_test` calls in tool/action records.
- Every RPG tool call must be `rpg_search_code`; all other `rpg_*` calls are
  rejected, including calls embedded in shell actions.
- At most 26 steps, a confirmed handoff, and a submitted test-only patch.
- The same named regression tests fail in the original trajectory. For Opus Matplotlib,
  the temporary fix and restoration checks are also verified against the source;
  for the other eight runs, the reference-fix results come from the evaluation logs.
- Resolved status and newly added fail-to-pass tests in the evaluation report,
  with no fail-to-fail or pass-to-fail tests.
- Matching patches in the trajectory, inference output and both evaluation runs
  (ignoring surrounding whitespace).
- A named failing result before the reference fix and passing result afterward for every
  reported fail-to-pass test, corroborated in the raw evaluation logs.

The **Verified: fail → pass** control opens the test names and links to the
original per-instance report and before/after logs. These are separate recorded
evaluations, not extra agent steps or fresh reruns. Terminal color escapes are
ignored when validating statuses and displaying the named evaluation excerpts.
Files in `data/evidence/` are
byte-for-byte copies from `run_instance_swt_logs/<model>.zip`; the exported run
records their source paths and SHA-256 hashes. Failures on buggy code in the replay
are expected for a successful reproduction test. The complete raw logs also
retain evaluator setup/cleanup output; the verification concerns the named tests.

Environment-generated usage hints can still mention unused helpers; these hints
are not invocations. Indexing diagnostics are retained verbatim and do not by
themselves disqualify a recording: Matplotlib reports Python 3 parsing errors for
vendored Python 2 scripts in `build/freetype-2.6.1/`, while its target regression
test completes the recorded fail/pass/restore sequence. These diagnostics
are separate from the test results. Retired case/model URLs fall back to an
available showcased recording. Historical GIF/MP4 recordings are separate from this
gallery.

Regenerate from a complete submission directory:

```bash
python scripts/build_demo_traces.py /path/to/DPIAgent-submission/agent-traces.zip
```

The archive's parent must contain `evaluation_results/`, `inference_outputs/` and
`run_instance_swt_logs/`; use `--submission-dir` if they live elsewhere. Edit
`TASKS`, `CASE_LABELS` and `CASE_CONFIGS` to change selection. The exporter validates all runs
before writing and removes retired trajectory JSON files and their evaluation
evidence listed in the previous manifest. No source archives are needed to serve the generated site.

Playback uses illustrative timing (3–9 seconds per ordinary tool call and
12 seconds for the diagnosis handoff at 1×), not original wall-clock time. All action/output text is retained; long outputs can be expanded
and reasoning is available under each call. Reduced-motion settings reveal each
step without character animation. Task/config selections are preserved in the URL.

## Reading the trajectory

The player keeps two spacious phase workspaces around the diagnosis handoff,
using the paper's shared font and blue accent. Action labels and colored rules distinguish inspection (blue), code/test
execution (ochre), edits/submissions (green), and the handoff (purple). Bash calls
are labeled by command activity: listing/searching/reading files is Inspect,
file modifications are Edit, running code or tests is Execute, and commands that
both modify files and run code are Edit + execute. Unknown shell operations
remain Execute. These presentation annotations preserve the original command
and output; they are not a shell security classifier. Commands
and output have separate surfaces. Source paths, strings, Python keywords, test
names, and assertions are highlighted; error lines and unified-diff additions,
deletions, and headers receive distinct backgrounds. These are text patterns,
not independent judgments of correctness. The separate verification control is
backed by recorded before/after evaluation evidence.

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
Also checked across both runs: protocol fields match their source summaries,
phase histories stay separate, the incoming plan matches the handoff, and rewinding
clears the transferred state. Automatic boundary pause and continuous playback
were exercised separately.
Both exported runs were compared against the source archive for exact action,
observation, and final-patch fidelity.

The files can be served from GitHub Pages without changing paths. Publishing is
a separate step after local review.
