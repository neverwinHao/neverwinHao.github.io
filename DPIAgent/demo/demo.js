'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const embedded = params.get('embed') === '1';
document.documentElement.classList.toggle('embed', embedded);
const phaseNames = { exploration: 'Exploration', handoff: 'Handoff', generation: 'Test generation' };
let manifest, data, taskId, configId, controller;
let time = 0, total = 0, starts = [], durations = [], playing = false, raf = 0, last = 0;
let rendered = -1, current = -1, elements = [];
let handoffIndex = -1, boundaryTime = Infinity, transferConfirmed = false, protocolFields = [];
let handoffActiveField = -1, manualHandoffField = null;
let evaluationReplay = null;
const HANDOFF_DURATION = 12;
const HANDOFF_START = 0.04, HANDOFF_END = 0.92;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Presentation only: keep every original character and create text nodes, never HTML.
function appendTokens(parent, text) {
  const tokens = /(`[^`\n]+`)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|((?:\/?[\w.-]+\/)+[\w./-]+(?:[:][\w.]+)?)|\b(def|class|import|from|return|assert|with|raise|if|else|for|in|try|except|True|False|None)\b|(\b(?:test_\w+|assert\w+|\w+(?:Error|Exception))\b)|(--[\w-]+)/g;
  let end = 0;
  for (const match of text.matchAll(tokens)) {
    parent.append(document.createTextNode(text.slice(end, match.index)));
    const kind = match[1] ? 'code' : match[2] ? 'string' : match[3] ? 'path' : match[4] ? 'keyword' : match[5] ? 'symbol' : 'flag';
    parent.append(node('span', `syntax-${kind}`, match[0]));
    end = match.index + match[0].length;
  }
  parent.append(document.createTextNode(text.slice(end)));
}

function paintTrace(target, text, mode = 'code') {
  const fragment = document.createDocumentFragment();
  const lines = text.split('\n');
  let inDiff = mode === 'diff';
  lines.forEach((line, i) => {
    if (line.startsWith('diff --git ')) inDiff = true;
    let style = '';
    if (inDiff) {
      if (/^(diff --git |index |--- |\+\+\+ |@@)/.test(line)) style = 'diff-meta';
      else if (line.startsWith('+')) style = 'diff-add';
      else if (line.startsWith('-')) style = 'diff-remove';
    } else if (mode === 'output') {
      if (/^\s*(?:Traceback \(most recent call last\):|(?:[\w.]+(?:Error|Exception)|FAIL(?:ED)?|ERROR)(?::|\b\s*\()|E\s{2,})/.test(line) || /^=+.*\b(?:failed|error|errors)\b.*=+$/i.test(line)) style = 'log-error';
      else if (/^(?:=+.*\bpassed\b.*=+|OK(?:\s*\(.*\))?)$/.test(line.trim())) style = 'log-result';
      else if (/^\s*\d+[\t |]+.*\b(?:assert\w*|def test_\w+)\b/.test(line)) style = 'log-assert';
    }
    const span = node('span', `trace-line${style ? ' ' + style : ''}`);
    appendTokens(span, line);
    fragment.append(span);
    if (i < lines.length - 1) fragment.append(document.createTextNode('\n'));
  });
  target.replaceChildren(fragment);
}

function stepKind(step) {
  if (step.phase === 'handoff') return ['handoff', 'Handoff'];
  if (step.tool === 'submit') return ['artifact', 'Submission'];
  if (step.tool === 'str_replace_editor' && /^(?:str_replace_editor\s+)?(?:create|insert|str_replace)\b/.test(step.action)) return ['edit', 'Edit'];
  if (step.tool.startsWith('rpg_') || step.tool === 'str_replace_editor') return ['inspect', 'Inspect'];
  if (step.tool === 'bash') return ['execute', 'Execute'];
  return ['inspect', 'Annotation'];
}

function buildKeyMoments() {
  const entries = [];
  const add = (index, label, kind) => { if (index >= 0) entries.push({index, label, kind}); };
  add(data.steps.findIndex(s => s.tool.startsWith('rpg_') || s.tool === 'str_replace_editor'), 'Code inspection', 'inspect');
  add(handoffIndex, 'Diagnosis handoff', 'handoff');
  add(data.steps.findIndex(s => s.phase === 'generation' && stepKind(s)[0] === 'edit'), 'Test edit', 'edit');
  add(data.steps.findIndex(s => s.phase === 'generation' && s.tool === 'bash' && /\b(pytest|runtests\.py|unittest)\b|\bdjango test\b/.test(s.action)), 'Test execution', 'execute');
  $('key-moments').replaceChildren(node('span', 'moments-label', 'Jump to'));
  entries.sort((a,b) => a.index - b.index).forEach(({index, label, kind}) => {
    const button = node('button', 'moment');
    button.dataset.kind = kind;
    button.dataset.index = index;
    button.append(node('span', 'moment-number', String(index + 1).padStart(2, '0')), node('span', '', label));
    button.addEventListener('click', () => {
      jump(index);
      if (innerWidth <= 1000) $(data.steps[index].phase === 'handoff' ? 'protocol-pane' : `${data.steps[index].phase}-pane`).scrollIntoView({block: 'start', behavior: reducedMotion ? 'instant' : 'smooth'});
    });
    $('key-moments').append(button);
  });
  if (data.patch) {
    const button = node('button', 'moment artifact-moment', 'Final patch ↗');
    button.addEventListener('click', () => {
      $('patch-panel').hidden = false;
      $('patch-toggle').setAttribute('aria-expanded', 'true');
      $('patch-panel').scrollIntoView({block: 'nearest', behavior: reducedMotion ? 'instant' : 'smooth'});
    });
    $('key-moments').append(button);
  }
}

function setText(id, text) {
  if ($(id).textContent !== text) $(id).textContent = text;
}

async function fetchJSON(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load trajectory (HTTP ${response.status}).`);
  return response.json();
}

function atBoundary() {
  return data && time >= boundaryTime && time < boundaryTime + 0.001;
}

function setPlaying(value) {
  playing = value && !!data && time < total;
  cancelAnimationFrame(raf);
  last = 0;
  const label = playing ? 'Ⅱ Pause' : time >= total && data ? '↺ Replay both phases' : atBoundary() ? '▶ Continue to phase 2' : time > 0 ? '▶ Continue replay' : '▶ Start exploration';
  $('play').textContent = label;
  $('play').setAttribute('aria-label', playing ? 'Pause trajectory' : atBoundary() ? 'Continue to phase 2' : 'Play trajectory');
  $('play-state').textContent = playing ? 'PLAYING' : time >= total && data ? 'REPLAY COMPLETE' : atBoundary() ? 'HANDOFF RECORDED' : time > 0 ? 'PAUSED' : 'READY';
  $('play-state').classList.toggle('playing', playing);
  $('continue-handoff').hidden = playing || !data || !$('method-board').classList.contains('transferred') || current !== handoffIndex;
  if (playing) raf = requestAnimationFrame(tick);
}

function tick(now) {
  if (!playing) return;
  const previous = time;
  if (last) time = Math.min(total, time + Math.min(now - last, 100) / 1000 * Number($('speed').value));
  last = now;
  const pauseAtBoundary = $('pause-handoff').checked && previous < boundaryTime && time >= boundaryTime;
  if (pauseAtBoundary) time = boundaryTime;
  render();
  if (pauseAtBoundary || time >= total) setPlaying(false);
  else raf = requestAnimationFrame(tick);
}

function emptyPane(id, title, subtitle, symbol) {
  const empty = node('div', 'empty');
  empty.append(node('span', 'empty-symbol', symbol), node('strong', '', title), node('span', '', subtitle));
  $(id).replaceChildren(empty);
}

function emptyTerminal(message = 'Start with the defect.') {
  emptyPane('exploration-stream', message, 'Follow the code inspection and reproduction before the agent writes its test.', '⌕');
  emptyPane('generation-stream', 'Waiting for the diagnosis.', 'The recorded handoff provides the root cause, trigger, and test plan for this phase.', '⇥');
}

function resetRendering() {
  manualHandoffField = null;
  handoffActiveField = -1;
  rendered = -1;
  current = -1;
  elements = [];
  $('exploration-stream').replaceChildren();
  $('generation-stream').replaceChildren();
  $('handoff-events').replaceChildren();
}

const protocolSchema = [
  ['root cause', 'Root cause'], ['test plan', 'Test plan'],
  ['bug location', 'Bug location'], ['reproduction', 'Reproduction'],
  ['expected vs actual', 'Expected vs. actual'], ['reference tests', 'Reference tests'],
];

function buildProtocol() {
  const handoff = data?.steps[handoffIndex];
  const source = handoff?.handoff || '';
  const pattern = /\*{0,2}(bug location|root cause|expected(?: vs actual(?: behavior)?)?|reproduction|reference tests(?: examined)?|test plan)\*{0,2}\s*:/gi;
  const matches = [...source.matchAll(pattern)];
  const fields = {};
  matches.forEach((match, i) => {
    const key = match[1].toLowerCase().replace(' behavior', '').replace(' examined', '').replace(/^expected$/, 'expected vs actual');
    fields[key] = source.slice(match.index + match[0].length, matches[i + 1]?.index ?? source.length).trim();
  });
  $('protocol-fields').replaceChildren();
  handoffActiveField = -1;
  manualHandoffField = null;
  protocolFields = protocolSchema.map(([key, title], index) => {
    const field = node('div', 'protocol-field');
    field.dataset.field = key;
    const text = node('p');
    text.id = `handoff-field-${index}`;
    text.hidden = true;
    text.tabIndex = 0;
    text.setAttribute('aria-label', title);
    const value = fields[key] || 'This field is not separately labeled in the recorded summary. See the full handoff.';
    const expand = node('button', 'field-expand', 'View ↗');
    expand.setAttribute('aria-label', `View ${title}`);
    expand.setAttribute('aria-expanded', 'false');
    expand.setAttribute('aria-controls', text.id);
    expand.addEventListener('click', () => {
      setPlaying(false);
      manualHandoffField = field.classList.contains('expanded') ? -1 : index;
      render();
    });
    field.append(node('span', '', title), text, expand);
    $('protocol-fields').append(field);
    return {field, text, value, expand, key, title};
  });
  $('handoff-progress-fill').style.transform = 'scaleX(0)';
  $('handoff-progress').setAttribute('aria-valuenow', '0');
  $('handoff-progress').setAttribute('aria-valuetext', '0 of 6 fields');
  $('handoff-progress-count').textContent = '0 / 6';
  $('handoff-progress-label').textContent = 'Diagnosis handoff';
  $('handoff-progress-steps').replaceChildren(...protocolSchema.map(([, title], i) => {
    const step = node('span', '', String(i + 1).padStart(2, '0'));
    step.title = title;
    return step;
  }));
  $('handoff-original').textContent = '';
  $('tool-transition').textContent = '';
  $('handoff-record').hidden = true;
  $('handoff-record').open = false;
  document.querySelector('.full-handoff').open = false;
  $('carried-plan').hidden = true;
  $('carried-plan').open = false;
  $('carried-plan-text').textContent = '';
}

// The replay clock owns every animation frame, so pausing and seeking also
// freeze or rewind the handoff. No timers or queued CSS animations can drift.
function updateHandoff(progress, index) {
  const count = protocolFields.length;
  const units = Math.max(0, Math.min(count, (progress - HANDOFF_START) / (HANDOFF_END - HANDOFF_START) * count));
  const completed = Math.min(count, Math.floor(units + 1e-8));
  const active = progress >= HANDOFF_START && progress < HANDOFF_END && index === handoffIndex ? Math.min(count - 1, Math.floor(units)) : -1;
  const fraction = units - Math.floor(units);
  const visibleCount = active >= 0 ? active + 1 : completed;
  if (active !== handoffActiveField) {
    handoffActiveField = active;
    manualHandoffField = null;
  }
  // One accordion item at a time; the final field stays open for inspection.
  const expandedIndex = manualHandoffField ?? (active >= 0 ? active : completed === count ? count - 1 : -1);
  const percent = Math.round(units / count * 100);
  $('handoff-progress-fill').style.transform = `scaleX(${units / count})`;
  $('handoff-progress').setAttribute('aria-valuenow', String(percent));
  $('handoff-progress').setAttribute('aria-valuetext', `${completed} of ${count} fields${active >= 0 ? ': ' + protocolFields[active].title : ''}`);
  setText('handoff-progress-count', `${completed} / ${count}`);
  setText('handoff-progress-label', active >= 0 ? protocolFields[active].title : completed === count ? 'Diagnosis delivered' : 'Diagnosis handoff');
  Array.from($('handoff-progress-steps').children).forEach((el, i) => {
    el.classList.toggle('done', i < completed);
    el.classList.toggle('active', i === active);
    const label = i < completed ? '✓' : String(i + 1).padStart(2, '0');
    if (el.textContent !== label) el.textContent = label;
  });
  protocolFields.forEach((entry, i) => {
    const visible = i < visibleCount;
    entry.field.classList.toggle('received', visible);
    entry.field.classList.toggle('delivered', i < completed);
    entry.field.classList.toggle('presenting', i === active);
    // The background remains subtle; the accordion text stays in normal flow.
    const ramp = fraction < 0.2 ? fraction / 0.2 : fraction > 0.8 ? (1 - fraction) / 0.2 : 1;
    const emphasis = i === active ? (reducedMotion ? 1 : Math.sin(Math.max(0, ramp) * Math.PI / 2)) : 0;
    entry.field.style.setProperty('--emphasis', emphasis.toFixed(4));
    const text = visible ? entry.value : '';
    if (entry.text.textContent !== text) paintTrace(entry.text, text);
    entry.expand.disabled = !visible;
    const expanded = visible && i === expandedIndex;
    if (expanded && !entry.field.classList.contains('expanded')) entry.text.scrollTop = 0;
    entry.field.classList.toggle('expanded', expanded);
    entry.text.hidden = !expanded;
    const label = expanded ? 'Close ↑' : 'View ↗';
    if (entry.expand.textContent !== label) entry.expand.textContent = label;
    entry.expand.setAttribute('aria-label', `${expanded ? 'Close' : 'View'} ${entry.title}`);
    entry.expand.setAttribute('aria-expanded', String(expanded));
  });
}

function updateBoard(index) {
  const phase = index < 0 ? 'exploration' : data.steps[index].phase;
  const progress = handoffIndex < 0 || index < handoffIndex ? 0 : index > handoffIndex ? 1 : Math.min(1, (time - starts[handoffIndex]) / durations[handoffIndex]);
  const sent = transferConfirmed && progress >= 0.98;
  $('method-board').dataset.stage = phase;
  $('method-board').classList.toggle('transferred', sent);
  $('exploration-pane').classList.toggle('active', phase === 'exploration');
  $('protocol-pane').classList.toggle('active', phase === 'handoff' && !sent);
  $('generation-pane').classList.toggle('active', sent);
  $('carried-plan').hidden = !sent;
  setText('carried-plan-text', sent ? protocolFields.find(entry => entry.key === 'test plan').value : '');
  const explorationCount = data.steps.filter((s, i) => i <= index && s.phase === 'exploration').length;
  const generationCount = data.steps.filter((s, i) => i <= index && s.phase === 'generation').length;
  const explorationTotal = data.steps.filter(s => s.phase === 'exploration').length;
  const generationTotal = data.steps.filter(s => s.phase === 'generation').length;
  setText('exploration-count', `${explorationCount} / ${explorationTotal} calls`);
  setText('generation-count', `${generationCount} / ${generationTotal} calls`);
  setText('exploration-status', progress > 0 ? 'RECORDED' : index < 0 ? 'READY' : 'EXPLORING');
  setText('generation-status', time >= total ? 'RECORDED' : phase === 'generation' ? 'WRITING' : sent ? 'READY' : 'WAITING');
  setText('exploration-scope', sent ? 'RPG tools removed from the action space at the recorded transition.' : 'Investigate the code and reproduce the reported behavior.');
  const validation = (data.validation || []).filter(check => time >= starts[check.step - 1] + durations[check.step - 1] * 0.99).at(-1);
  const referenceCheck = data.validation_source === 'reference_fix';
  const evaluationVisible = evaluationReplay?.isConnected;
  setText('generation-scope', evaluationVisible ? 'Same test: failed on buggy code → passed with the reference fix.' : validation ? validation.label : sent ? (referenceCheck ? 'Reproduce the failure, then review the recorded reference-fix check.' : 'The agent checks the same tests before and after a temporary fix.') : 'Write tests using the diagnosis and test plan from phase 1.');
  setText('protocol-state', sent ? '✓ Summary recorded · toolset switched' : progress > 0 ? 'Transferring the exploration summary…' : 'Awaiting the exploration summary');
  updateHandoff(progress, index);
  $('handoff-record').hidden = progress < HANDOFF_END;
  setText('handoff-original', progress >= HANDOFF_END ? data.steps[handoffIndex].handoff : '');
  setText('tool-transition', sent ? 'RPG exploration tools are disabled.\nTest tools: str_replace_editor (create/edit), bash, submit.' : '');
  setText('boundary-title', sent ? 'Diagnosis received · test tools available' : 'Diagnosis shared across phases');
  setText('boundary-copy', sent ? 'Graph exploration is no longer available. The next phase works from this recorded diagnosis to write and validate a reproduction test.' : 'Phase 2 begins after the recorded handoff. The summary keeps the diagnosis available to test writing.');
  if (generationCount === 0) {
    const title = sent ? 'The diagnosis is ready.' : 'Waiting for the diagnosis.';
    const existing = $('generation-stream').querySelector('.empty strong');
    if (existing?.textContent !== title) emptyPane('generation-stream', title, sent ? 'Continue to phase 2 to see the test written from this handoff.' : 'The recorded handoff provides the root cause, trigger, and test plan for this phase.', sent ? '✓' : '⇥');
  }
}

function createEvent(step, index) {
  const article = node('article', 'event');
  article.dataset.phase = step.phase;
  const [kind, label] = stepKind(step);
  article.dataset.kind = kind;
  const heading = node('div', 'event-heading');
  heading.append(node('span', '', String(index + 1).padStart(2, '0')), node('strong', '', step.tool), node('span', 'event-kind', label));
  article.append(heading);
  if (step.thought) {
    const details = node('details');
    details.append(node('summary', '', 'Agent reasoning'), node('pre', '', step.thought));
    article.append(details);
  }
  const command = node('pre', 'command');
  const output = node('pre', 'output');
  article.append(command, node('div', 'output-label', 'OUTPUT'), output);
  let expand;
  if (step.observation.split('\n').length > 13 || step.observation.length > 1800) {
    expand = node('button', 'output-toggle', 'Expand output ↗');
    expand.hidden = true;
    expand.setAttribute('aria-expanded', 'false');
    output.id = `step-output-${index}`;
    expand.setAttribute('aria-controls', output.id);
    expand.addEventListener('click', () => {
      const expanded = output.classList.toggle('expanded');
      expand.textContent = expanded ? 'Collapse output ↑' : 'Expand output ↗';
      expand.setAttribute('aria-expanded', String(expanded));
    });
    article.append(expand);
  }
  const stream = $(step.phase === 'handoff' ? 'handoff-events' : `${step.phase}-stream`);
  stream.querySelector('.empty')?.remove();
  stream.append(article);
  return { article, command, output, expand };
}

function updateEvent(index, progress) {
  const step = data.steps[index], el = elements[index];
  if (step.phase === 'handoff' && !document.querySelector('.full-handoff').open) {
    progress = progress >= 0.93 ? 1 : 0;
  }
  const commandProgress = reducedMotion ? 1 : Math.min(1, progress / 0.28);
  const outputProgress = reducedMotion ? 1 : Math.max(0, Math.min(1, (progress - 0.28) / 0.65));
  const command = step.action.slice(0, Math.floor(step.action.length * commandProgress));
  const output = step.observation.slice(0, Math.floor(step.observation.length * outputProgress));
  if (el.command.textContent !== command) paintTrace(el.command, command);
  if (el.output.textContent !== output) {
    paintTrace(el.output, output, 'output');
    if ($('follow').checked) el.output.scrollTop = el.output.scrollHeight;
  }
  el.article.classList.toggle('streaming', progress < 0.93);
  el.article.classList.toggle('complete', progress >= 0.93);
  if (el.expand) el.expand.hidden = outputProgress < 1;
}

function render() {
  if (!data) return;
  const index = time === 0 ? -1 : Math.min(data.steps.length - 1, starts.findLastIndex(start => start <= time));
  if (index < rendered) resetRendering();
  if (index < 0) {
    if (!$('exploration-stream').querySelector('.empty')) emptyTerminal();
  } else {
    if (rendered < 0) { $('exploration-stream').replaceChildren(); $('handoff-events').replaceChildren(); }
    for (let i = rendered + 1; i <= index; i++) {
      if (i > 0) updateEvent(i - 1, 1);
      elements[i] = createEvent(data.steps[i], i);
      if (i < index) updateEvent(i, 1);
    }
    rendered = index;
    updateEvent(index, (time - starts[index]) / durations[index]);
  }
  if (current !== index) {
    if (elements[current]) elements[current].article.classList.remove('current');
    current = index;
    document.querySelectorAll('.moment[data-index]').forEach(button => {
      const active = Number(button.dataset.index) === index;
      button.classList.toggle('active', active);
      button.setAttribute('aria-current', String(active));
    });
    if (elements[index]) elements[index].article.classList.add('current');
    document.querySelectorAll('.step-link').forEach((button, i) => {
      button.classList.toggle('active', i === index);
      button.setAttribute('aria-current', String(i === index));
    });
  }
  const phase = data.steps[Math.max(0, index)].phase;
  if (evaluationReplay) {
    const last = data.steps.length - 1;
    const complete = time >= starts[last] + durations[last] * 0.99;
    if (complete && !evaluationReplay.isConnected) $('generation-stream').append(evaluationReplay);
    else if (!complete) evaluationReplay.remove();
  }
  updateBoard(index);
  document.querySelectorAll('.phase-jump').forEach(button => {
    button.classList.toggle('active', button.dataset.phase === phase);
    button.setAttribute('aria-current', String(button.dataset.phase === phase));
  });
  $('position').textContent = `${String(index + 1).padStart(2, '0')} / ${String(data.steps.length).padStart(2, '0')}`;
  $('percent').textContent = `${Math.round(time / total * 100)}%`;
  $('seek').value = time;
  $('seek').setAttribute('aria-valuetext', `Step ${index + 1} of ${data.steps.length}`);
  $('current-tool').textContent = index < 0 ? 'Ready · original recorded trajectory' : `${phaseNames[phase]} / ${data.steps[index].tool}`;
  $('prev').disabled = index <= 0;
  $('next').disabled = index >= data.steps.length - 1;
  if ($('follow').checked && index >= 0) {
    for (const name of ['exploration', 'generation']) {
      const stream = $(`${name}-stream`);
      stream.scrollTop = stream.scrollHeight;
    }
  }
}

function jump(index) {
  if (!data) return;
  setPlaying(false);
  const i = Math.max(0, Math.min(index, data.steps.length - 1));
  time = i === handoffIndex && transferConfirmed ? boundaryTime : starts[i] + durations[i] * 0.99;
  resetRendering();
  render();
  setPlaying(false);
}

function showModels() {
  $('models').replaceChildren(...Object.entries(manifest.configs).map(([config, label]) => {
    const button = node('button', 'model-tab', label.replace(' · DPI', ''));
    button.dataset.config = config;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => loadRun(taskId, config));
    return button;
  }));
}

function showTasks() {
  $('tasks').replaceChildren();
  manifest.tasks.forEach((task, i) => {
    const button = node('button', 'task');
    button.textContent = task.label || task.repo.split('/')[1];
    button.title = `${task.repo}: ${task.title}`;
    button.dataset.task = task.id;
    button.addEventListener('click', () => loadRun(task.id, configId));
    $('tasks').append(button);
  });
}

function showEvaluation(evaluation) {
  if (!evaluation?.resolved || !evaluation.fail_to_pass?.length) {
    $('run-status').textContent = 'Evaluation unavailable';
    return;
  }
  $('run-status').textContent = 'Verified: fail → pass ↗';
  $('run-status').disabled = false;
  const count = evaluation.added_fail_to_pass;
  $('evaluation-summary').textContent = `Recorded SWT-Bench evaluation: ${count} new ${count === 1 ? 'test fails' : 'tests fail'} on the buggy version and ${count === 1 ? 'passes' : 'pass'} with the reference fix.`;
  $('evaluation-tests').textContent = evaluation.fail_to_pass.join('\n');
  for (const key of ['report', 'before', 'after']) {
    $(`evaluation-${key}`).href = `data/${evaluation[key].file}`;
  }
  if (evaluation.replay) {
    evaluationReplay = node('section', 'reference-check');
    evaluationReplay.setAttribute('aria-label', 'Recorded reference-fix evaluation');
    evaluationReplay.append(node('h4', '', 'Reference-fix check'), node('p', 'reference-source', 'Recorded SWT-Bench evaluation · same submitted test'));
    for (const [key, label] of [['before', 'Buggy version · FAILED'], ['after', 'Reference fix · PASSED']]) {
      const result = node('div', `reference-result reference-${key}`);
      const output = node('pre', '', evaluation.replay[key]);
      const link = node('a', '', 'Full log ↗');
      link.href = `data/${evaluation[key].file}`;
      link.target = '_blank';
      link.rel = 'noopener';
      result.append(node('strong', '', label), output, link);
      evaluationReplay.append(result);
    }
  }
}

async function loadRun(nextTask, nextConfig) {
  if (controller) controller.abort();
  const request = new AbortController();
  controller = request;
  setPlaying(false);
  data = null;
  evaluationReplay = null;
  $('continue-handoff').hidden = true;
  time = 0;
  total = 0;
  handoffIndex = -1;
  boundaryTime = Infinity;
  transferConfirmed = false;
  resetRendering();
  buildProtocol();
  $('method-board').classList.remove('transferred');
  $('protocol-pane').classList.remove('active');
  $('generation-pane').classList.remove('active');
  $('exploration-pane').classList.add('active');
  $('protocol-state').textContent = 'Awaiting the exploration summary';
  $('exploration-scope').textContent = 'Investigate the code and reproduce the reported behavior.';
  $('generation-scope').textContent = 'Write tests using the diagnosis and test plan from phase 1.';
  $('exploration-count').textContent = '0 calls';
  $('generation-count').textContent = '0 calls';
  $('boundary-title').textContent = 'Diagnosis shared across phases';
  $('boundary-copy').textContent = 'Phase 2 begins after the recorded handoff. The summary keeps the diagnosis available to test writing.';
  $('exploration-status').textContent = 'READY';
  $('generation-status').textContent = 'WAITING';
  $('phase-track').replaceChildren();
  $('key-moments').replaceChildren();
  emptyTerminal('Loading recorded trajectory…');
  $('error').hidden = true;
  $('issue').hidden = true;
  $('patch-panel').hidden = true;
  $('evaluation-panel').hidden = true;
  $('run-status').setAttribute('aria-expanded', 'false');
  $('issue-toggle').setAttribute('aria-expanded', 'false');
  $('patch-toggle').setAttribute('aria-expanded', 'false');
  ['play', 'restart', 'prev', 'next', 'seek', 'patch-toggle', 'watch-handoff', 'run-status'].forEach(id => $(id).disabled = true);
  document.querySelectorAll('.phase-jump').forEach(button => { button.disabled = true; button.classList.remove('active'); });
  $('steps').replaceChildren();
  $('step-total').textContent = 'Loading…';
  $('run-status').textContent = 'Loading evaluation…';
  $('play-state').textContent = 'LOADING';
  $('current-tool').textContent = 'Loading trajectory';
  $('position').textContent = '00 / 00';
  $('percent').textContent = '0%';
  $('seek').value = 0;
  // Model changes keep that model and select one of its recorded cases.
  const requestedTask = manifest.tasks.find(t => t.id === nextTask);
  const preferredConfig = Object.hasOwn(manifest.configs, nextConfig) ? nextConfig : requestedTask?.runs[0].config || Object.keys(manifest.configs)[0];
  const availableTasks = manifest.tasks.filter(task => task.runs.some(run => run.config === preferredConfig));
  const task = availableTasks.find(task => task.id === nextTask) || availableTasks[0];
  const run = task.runs.find(run => run.config === preferredConfig);
  taskId = task.id;
  configId = run.config;
  $('task-id').textContent = task.id;
  $('task-title').textContent = task.title;
  document.querySelectorAll('.model-tab').forEach(button => {
    const active = button.dataset.config === configId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.disabled = false;
  });
  document.querySelectorAll('.task').forEach(button => {
    button.hidden = !availableTasks.some(task => task.id === button.dataset.task);
    const active = button.dataset.task === taskId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  try {
    const loaded = await fetchJSON(`data/${run.file}`, request.signal);
    if (controller !== request) return;
    if (!loaded.steps?.length) throw new Error('This recording has no replayable steps.');
    data = loaded;
    starts = [];
    durations = data.steps.map(step => {
      starts.push(total);
      const duration = step.phase === 'handoff' ? HANDOFF_DURATION : Math.min(9, Math.max(3, (step.action.length + step.observation.length) / 650));
      total += duration;
      return duration;
    });
    handoffIndex = data.steps.findIndex(s => s.phase === 'handoff');
    transferConfirmed = handoffIndex >= 0 && data.steps[handoffIndex].observation.includes('###SWE-AGENT-PHASE-TRANSITION###');
    boundaryTime = transferConfirmed ? starts[handoffIndex] + durations[handoffIndex] - 0.0001 : Infinity;
    buildProtocol();
    $('watch-handoff').disabled = handoffIndex < 0;
    for (const phase of ['exploration', 'handoff', 'generation']) {
      const indices = data.steps.flatMap((step, i) => step.phase === phase ? [i] : []);
      if (!indices.length) continue;
      const button = node('button', 'track-segment', phase === 'handoff' ? 'P' : `${phase === 'exploration' ? '01' : '02'} ${phaseNames[phase]} · ${indices.length}`);
      button.dataset.phase = phase;
      button.style.flexGrow = String(indices.length);
      button.style.flexBasis = '0';
      button.title = `${phaseNames[phase]}: ${indices.length} recorded calls`;
      button.addEventListener('click', () => jump(indices[0]));
      $('phase-track').append(button);
    }
    $('seek').max = total;
    $('step-total').textContent = `${data.steps.length} tool calls`;
    showEvaluation(data.evaluation);
    $('issue').textContent = data.issue;
    paintTrace($('patch'), data.patch || '', 'diff');
    buildKeyMoments();
    $('patch-toggle').disabled = !data.patch;
    $('index-count').textContent = `${data.steps.length} steps`;
    $('steps').replaceChildren(...data.steps.map((step, i) => {
      const button = node('button', 'step-link');
      button.dataset.kind = stepKind(step)[0];
      button.append(node('span', '', String(i + 1).padStart(2, '0')), node('span', 'step-preview', step.action.split('\n')[0]), node('span', 'step-tag', phaseNames[step.phase]));
      button.addEventListener('click', () => jump(i));
      return button;
    }));
    document.querySelectorAll('.phase-jump').forEach(button => {
      const i = data.steps.findIndex(s => s.phase === button.dataset.phase);
      button.disabled = i < 0;
      button.onclick = () => jump(i);
    });
    ['play', 'restart', 'seek'].forEach(id => $(id).disabled = false);
    const url = new URL(location.href);
    url.searchParams.set('task', taskId);
    url.searchParams.set('config', configId);
    history.replaceState(null, '', url);
    emptyTerminal();
    render();
    setPlaying(false);
  } catch (error) {
    if (error.name === 'AbortError') return;
    $('error').textContent = `${error.message} Select a case to retry, or reload the page.`;
    $('error').hidden = false;
    emptyTerminal('This trace could not be loaded.');
    $('play-state').textContent = 'LOAD FAILED';
  }
}

function download(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = node('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('play').addEventListener('click', () => {
  if (time >= total) { time = 0; resetRendering(); render(); }
  setPlaying(!playing);
});
$('restart').addEventListener('click', () => { time = 0; resetRendering(); render(); setPlaying(true); });
$('prev').addEventListener('click', () => jump(current - 1));
$('next').addEventListener('click', () => jump(current + 1));
$('seek').addEventListener('input', () => {
  setPlaying(false);
  time = Number($('seek').value);
  if (total - time < 0.001) time = total;
  resetRendering();
  render();
  setPlaying(false);
});
for (const [toggle, panel] of [['issue-toggle', 'issue'], ['patch-toggle', 'patch-panel'], ['run-status', 'evaluation-panel']]) {
  $(toggle).addEventListener('click', () => {
    $(panel).hidden = !$(panel).hidden;
    $(toggle).setAttribute('aria-expanded', String(!$(panel).hidden));
  });
}
$('download-patch').addEventListener('click', () => data && download(data.patch, `${data.id}.patch`, 'text/plain'));
$('follow').addEventListener('change', () => {
  if ($('follow').checked) document.querySelectorAll('.phase-stream').forEach(stream => stream.scrollTop = stream.scrollHeight);
});
$('watch-handoff').addEventListener('click', () => {
  if (!data || handoffIndex < 0) return;
  time = Math.max(0, starts[handoffIndex] - 0.8);
  resetRendering();
  render();
  setPlaying(true);
  if (innerWidth <= 1000) $('protocol-pane').scrollIntoView({block: 'center', behavior: reducedMotion ? 'instant' : 'smooth'});
});
document.querySelector('.full-handoff').addEventListener('toggle', event => {
  if (event.target.open && elements[handoffIndex]) updateEvent(handoffIndex, 1);
});
$('continue-handoff').addEventListener('click', () => {
  if (!data || !transferConfirmed) return;
  time = boundaryTime;
  render();
  setPlaying(true);
  if (innerWidth <= 1000) $('generation-pane').scrollIntoView({block: 'start', behavior: reducedMotion ? 'instant' : 'smooth'});
});
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });
document.addEventListener('keydown', event => {
  if (!data || /^(INPUT|SELECT|TEXTAREA|BUTTON|SUMMARY|A)$/.test(event.target.tagName)) return;
  if (event.code === 'Space') { event.preventDefault(); $('play').click(); }
  else if (event.code === 'ArrowRight') { event.preventDefault(); jump(current + 1); }
  else if (event.code === 'ArrowLeft') { event.preventDefault(); jump(current - 1); }
});

// Keep the paper's embedded player at its natural height, including open panels.
if (embedded) new ResizeObserver(() => {
  parent.postMessage({ type: 'dpi-demo-height', height: Math.ceil(document.body.getBoundingClientRect().height) }, location.origin);
}).observe(document.body);

(async () => {
  try {
    manifest = await fetchJSON('data/index.json');
    showModels();
    showTasks();
    await loadRun(params.get('task'), params.get('config'));
  } catch (error) {
    $('error').hidden = false;
    $('error').textContent = `${error.message} Reload the page to retry.`;
    emptyTerminal('Unable to load the case studies.');
    $('play-state').textContent = 'LOAD FAILED';
  }
})();
