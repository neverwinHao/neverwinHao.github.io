# DPIAgent trajectory demo

Static HTML/CSS/JavaScript; no build step, runtime API, or JavaScript dependencies.
The paper and demo share visual tokens in `assets/theme.css` and load the same
Inter stylesheet (with system font fallbacks).
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

The gallery contains four cases and four configurations (16 runs), selected from
the supplied `agent-traces.zip`. Only the selected run is fetched. Each JSON keeps
the original actions, observations, recorded reasoning, issue, and submitted patch.
Repeated queries, system prompts, environment settings, and replay configuration
are excluded. Source member names and SHA-256 hashes identify the original records.

Regenerate the checked-in JSON from the archive:

```bash
python scripts/build_demo_traces.py /path/to/agent-traces.zip
```

Edit `TASKS` in that script to change the case selection. The archive is not
required to serve the generated site. A `ready_to_write_test` call marks a handoff;
the explicit phase-transition marker in its observation changes subsequent steps
to test generation. Exit status is displayed verbatim and is not a benchmark score.

Playback uses illustrative timing (3–9 seconds per tool call at 1×), not original
wall-clock time. All action/output text is retained; long outputs can be expanded
and reasoning is available under each call. Reduced-motion settings reveal each
step without character animation. Task/config selections are preserved in the URL.

## Local verification

Validated in Chromium: play/pause, restart, speed selection, phase and step jumps,
seeking through completion, task/config changes, URL reload, artifact downloads,
load-error recovery, reduced motion, and desktop/mobile embedded layouts.
Also checked across all 16 runs: protocol fields match their source summaries,
phase histories stay separate, the incoming plan matches the handoff, and rewinding
clears the transferred state. Automatic boundary pause and continuous playback
were exercised separately.
All 16 exported runs were compared against the source archive for exact action,
observation, and final-patch fidelity.

The files can be served from GitHub Pages without changing paths. Publishing is
a separate step after local review.
