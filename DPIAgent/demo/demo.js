'use strict';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const embedded = params.get('embed') === '1';
document.documentElement.classList.toggle('embed', embedded);
const phaseNames = { exploration: 'Exploration', handoff: 'Handoff', generation: 'Test generation' };
const shortTitles = {
  'astropy__astropy-12907': 'Nested model separability',
  'django__django-11099': 'Username validation',
  'scikit-learn__scikit-learn-13439': 'Pipeline length & slicing',
  'psf__requests-5414': 'Invalid URL labels',
};
let manifest, data, taskId, configId, controller;
let time = 0, total = 0, starts = [], durations = [], playing = false, raf = 0, last = 0;
let rendered = -1, current = -1, elements = [];
let handoffIndex = -1, boundaryTime = Infinity, transferConfirmed = false, protocolFields = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
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
  rendered = -1;
  current = -1;
  elements = [];
  $('exploration-stream').replaceChildren();
  $('generation-stream').replaceChildren();
  $('handoff-events').replaceChildren();
}

const protocolSchema = [
  ['bug location', 'Bug location'], ['root cause', 'Root cause'],
  ['reproduction', 'Trigger / reproduction'], ['expected vs actual', 'Expected vs. actual'],
  ['reference tests', 'Reference tests'], ['test plan', 'Test plan'],
];

function buildProtocol() {
  const handoff = data?.steps[handoffIndex];
  const source = handoff?.handoff || '';
  const pattern = /\*{0,2}(bug location|root cause|expected vs actual(?: behavior)?|reproduction|reference tests(?: examined)?|test plan)\*{0,2}\s*:/gi;
  const matches = [...source.matchAll(pattern)];
  const fields = {};
  matches.forEach((match, i) => {
    const key = match[1].toLowerCase().replace(' behavior', '').replace(' examined', '');
    fields[key] = source.slice(match.index + match[0].length, matches[i + 1]?.index ?? source.length).trim();
  });
  $('protocol-fields').replaceChildren();
  protocolFields = protocolSchema.map(([key, title]) => {
    const field = node('div', 'protocol-field');
    const text = node('p');
    const value = fields[key] || 'This field is not separately labeled in the recorded summary. See the full handoff.';
    const expand = node('button', 'field-expand', 'Read field ↗');
    expand.setAttribute('aria-expanded', 'false');
    expand.addEventListener('click', () => {
      const expanded = field.classList.toggle('expanded');
      expand.textContent = expanded ? 'Collapse ↑' : 'Read field ↗';
      expand.setAttribute('aria-expanded', String(expanded));
    });
    field.append(node('span', '', title), text, expand);
    $('protocol-fields').append(field);
    return {field, text, value, expand, key};
  });
  $('handoff-original').textContent = '';
  $('tool-transition').textContent = '';
  $('handoff-record').hidden = true;
  $('handoff-record').open = false;
  $('carried-plan').hidden = true;
  $('carried-plan').open = false;
  $('carried-plan-text').textContent = '';
}

function updateBoard(index) {
  const phase = index < 0 ? 'exploration' : data.steps[index].phase;
  const progress = handoffIndex < 0 || index < handoffIndex ? 0 : index > handoffIndex ? 1 : Math.min(1, (time - starts[handoffIndex]) / durations[handoffIndex]);
  const sent = transferConfirmed && progress >= 0.93;
  $('method-board').dataset.stage = phase;
  $('method-board').classList.toggle('transferred', sent);
  $('exploration-pane').classList.toggle('active', phase === 'exploration');
  $('protocol-pane').classList.toggle('active', phase === 'handoff' && !sent);
  $('generation-pane').classList.toggle('active', sent);
  $('carried-plan').hidden = !sent;
  $('carried-plan-text').textContent = sent ? protocolFields.find(entry => entry.key === 'test plan').value : '';
  const explorationCount = data.steps.filter((s, i) => i <= index && s.phase === 'exploration').length;
  const generationCount = data.steps.filter((s, i) => i <= index && s.phase === 'generation').length;
  const explorationTotal = data.steps.filter(s => s.phase === 'exploration').length;
  const generationTotal = data.steps.filter(s => s.phase === 'generation').length;
  $('exploration-count').textContent = `${explorationCount} / ${explorationTotal} calls`;
  $('generation-count').textContent = `${generationCount} / ${generationTotal} calls`;
  $('exploration-status').textContent = progress > 0 ? 'RECORDED' : index < 0 ? 'READY' : 'EXPLORING';
  $('generation-status').textContent = time >= total ? 'RECORDED' : phase === 'generation' ? 'WRITING' : sent ? 'READY' : 'WAITING';
  $('exploration-scope').textContent = sent ? 'RPG tools removed from the action space at the recorded transition.' : 'Investigate the code and reproduce the reported behavior.';
  $('generation-scope').textContent = sent ? 'Test editor, shell, generate_test, python_add_description, submit now available.' : 'Write tests using the diagnosis and test plan from phase 1.';
  $('protocol-state').textContent = sent ? '✓ Summary recorded · toolset switched' : progress > 0 ? 'Transferring the exploration summary…' : 'Awaiting the exploration summary';
  const received = Math.min(protocolFields.length, Math.floor(progress / 0.8 * protocolFields.length));
  protocolFields.forEach((entry, i) => {
    const visible = i < received;
    entry.field.classList.toggle('received', visible);
    const text = visible ? entry.value : '';
    if (entry.text.textContent !== text) entry.text.textContent = text;
    entry.expand.disabled = !visible;
  });
  $('handoff-record').hidden = progress < 0.8;
  $('handoff-original').textContent = progress >= 0.8 ? data.steps[handoffIndex].handoff : '';
  $('tool-transition').textContent = sent ? data.steps[handoffIndex].observation.split('You are now in TEST WRITING mode.')[1] || data.steps[handoffIndex].observation : '';
  $('boundary-title').textContent = sent ? 'The objective changes. The diagnosis carries forward.' : 'A deliberate change of objective';
  $('boundary-copy').textContent = sent ? 'Graph exploration is no longer available. The next phase works from this recorded diagnosis to write and validate a reproduction test.' : 'Phase 2 begins after the recorded handoff. The summary keeps the diagnosis available to test writing.';
  if (generationCount === 0) {
    const title = sent ? 'The diagnosis is ready.' : 'Waiting for the diagnosis.';
    const existing = $('generation-stream').querySelector('.empty strong');
    if (existing?.textContent !== title) emptyPane('generation-stream', title, sent ? 'Continue to phase 2 to see the test written from this handoff.' : 'The recorded handoff provides the root cause, trigger, and test plan for this phase.', sent ? '✓' : '⇥');
  }
}

function createEvent(step, index) {
  const article = node('article', 'event');
  article.dataset.phase = step.phase;
  const heading = node('div', 'event-heading');
  heading.append(node('span', '', String(index + 1).padStart(2, '0')), node('strong', '', step.tool), node('span', 'step-phase', phaseNames[step.phase]));
  article.append(heading);
  if (step.thought) {
    const details = node('details');
    details.append(node('summary', '', 'Agent reasoning'), node('pre', '', step.thought));
    article.append(details);
  }
  const command = node('pre', 'command');
  const output = node('pre', 'output');
  article.append(command, output);
  let expand;
  if (step.observation.split('\n').length > 13 || step.observation.length > 1800) {
    expand = node('button', 'output-toggle', 'Expand output ↗');
    expand.hidden = true;
    expand.setAttribute('aria-expanded', 'false');
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
  const commandProgress = reducedMotion ? 1 : Math.min(1, progress / 0.28);
  const outputProgress = reducedMotion ? 1 : Math.max(0, Math.min(1, (progress - 0.28) / 0.65));
  const command = step.action.slice(0, Math.floor(step.action.length * commandProgress));
  const output = step.observation.slice(0, Math.floor(step.observation.length * outputProgress));
  if (el.command.textContent !== command) el.command.textContent = command;
  if (el.output.textContent !== output) {
    el.output.textContent = output;
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
    if (elements[index]) elements[index].article.classList.add('current');
    document.querySelectorAll('.step-link').forEach((button, i) => {
      button.classList.toggle('active', i === index);
      button.setAttribute('aria-current', String(i === index));
    });
  }
  const phase = data.steps[Math.max(0, index)].phase;
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
  if ($('follow').checked && index >= 0 && phase !== 'handoff') {
    const stream = $(`${phase}-stream`);
    stream.scrollTop = stream.scrollHeight;
  }
}

function jump(index) {
  if (!data) return;
  setPlaying(false);
  const i = Math.max(0, Math.min(index, data.steps.length - 1));
  time = starts[i] + durations[i] * 0.99;
  resetRendering();
  render();
  setPlaying(false);
}

function showTasks() {
  $('tasks').replaceChildren();
  manifest.tasks.forEach((task, i) => {
    const button = node('button', 'task');
    button.textContent = task.repo.split('/')[1];
    button.title = shortTitles[task.id] || task.title;
    button.dataset.task = task.id;
    button.addEventListener('click', () => loadRun(task.id, configId));
    $('tasks').append(button);
  });
}

async function loadRun(nextTask, nextConfig) {
  if (controller) controller.abort();
  const request = new AbortController();
  controller = request;
  setPlaying(false);
  data = null;
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
  $('boundary-title').textContent = 'A deliberate change of objective';
  $('boundary-copy').textContent = 'Phase 2 begins after the recorded handoff. The summary keeps the diagnosis available to test writing.';
  $('exploration-status').textContent = 'READY';
  $('generation-status').textContent = 'WAITING';
  $('phase-track').replaceChildren();
  emptyTerminal('Loading recorded trajectory…');
  $('error').hidden = true;
  $('issue').hidden = true;
  $('patch-panel').hidden = true;
  $('issue-toggle').setAttribute('aria-expanded', 'false');
  $('patch-toggle').setAttribute('aria-expanded', 'false');
  ['play', 'restart', 'prev', 'next', 'seek', 'download-trace', 'patch-toggle', 'watch-handoff'].forEach(id => $(id).disabled = true);
  document.querySelectorAll('.phase-jump').forEach(button => { button.disabled = true; button.classList.remove('active'); });
  $('steps').replaceChildren();
  $('step-total').textContent = 'Loading…';
  $('run-status').textContent = 'Recorded run';
  $('play-state').textContent = 'LOADING';
  $('current-tool').textContent = 'Loading trajectory';
  $('position').textContent = '00 / 00';
  $('percent').textContent = '0%';
  $('seek').value = 0;
  const task = manifest.tasks.find(t => t.id === nextTask) || manifest.tasks[0];
  const run = task.runs.find(r => r.config === nextConfig) || task.runs[0];
  taskId = task.id;
  configId = run.config;
  $('task-id').textContent = task.id;
  $('task-title').textContent = task.title;
  $('config').replaceChildren(...task.runs.map(r => {
    const option = node('option', '', manifest.configs[r.config]);
    option.value = r.config;
    return option;
  }));
  $('config').value = configId;
  $('config').disabled = false;
  document.querySelectorAll('.task').forEach(button => {
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
      const duration = Math.min(9, Math.max(3, (step.action.length + step.observation.length) / 650));
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
    $('run-status').textContent = `Exit: ${data.exit_status}`;
    $('issue').textContent = data.issue;
    $('patch').textContent = data.patch;
    $('patch-toggle').disabled = !data.patch;
    $('index-count').textContent = `${data.steps.length} steps`;
    $('steps').replaceChildren(...data.steps.map((step, i) => {
      const button = node('button', 'step-link');
      button.append(node('span', '', String(i + 1).padStart(2, '0')), node('span', 'step-preview', step.action.split('\n')[0]), node('span', 'step-tag', phaseNames[step.phase]));
      button.addEventListener('click', () => jump(i));
      return button;
    }));
    document.querySelectorAll('.phase-jump').forEach(button => {
      const i = data.steps.findIndex(s => s.phase === button.dataset.phase);
      button.disabled = i < 0;
      button.onclick = () => jump(i);
    });
    ['play', 'restart', 'seek', 'download-trace'].forEach(id => $(id).disabled = false);
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
$('config').addEventListener('change', event => loadRun(taskId, event.target.value));
for (const [toggle, panel] of [['issue-toggle', 'issue'], ['patch-toggle', 'patch-panel']]) {
  $(toggle).addEventListener('click', () => {
    $(panel).hidden = !$(panel).hidden;
    $(toggle).setAttribute('aria-expanded', String(!$(panel).hidden));
  });
}
$('download-patch').addEventListener('click', () => data && download(data.patch, `${data.id}.patch`, 'text/plain'));
$('download-trace').addEventListener('click', () => data && download(JSON.stringify(data, null, 2), `${data.id}--${data.config}.json`, 'application/json'));
$('follow').addEventListener('change', () => {
  if ($('follow').checked) document.querySelectorAll('.phase-stream').forEach(stream => stream.scrollTop = stream.scrollHeight);
});
$('watch-handoff').addEventListener('click', () => {
  if (!data || handoffIndex < 0) return;
  time = Math.max(0, starts[handoffIndex] - 0.8);
  resetRendering();
  render();
  setPlaying(true);
  if (innerWidth <= 850) $('protocol-pane').scrollIntoView({block: 'center', behavior: reducedMotion ? 'instant' : 'smooth'});
});
$('continue-handoff').addEventListener('click', () => {
  if (!data || !transferConfirmed) return;
  time = boundaryTime;
  render();
  setPlaying(true);
  if (innerWidth <= 850) $('generation-pane').scrollIntoView({block: 'start', behavior: reducedMotion ? 'instant' : 'smooth'});
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
    showTasks();
    await loadRun(params.get('task'), params.get('config'));
  } catch (error) {
    $('error').hidden = false;
    $('error').textContent = `${error.message} Reload the page to retry.`;
    emptyTerminal('Unable to load the case studies.');
    $('play-state').textContent = 'LOAD FAILED';
  }
})();
