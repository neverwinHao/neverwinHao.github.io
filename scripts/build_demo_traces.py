#!/usr/bin/env python3
"""Export a small, reproducible gallery from the submitted trace archive."""
import argparse
from contextlib import ExitStack
import hashlib
import json
from pathlib import Path
import re
import zipfile

TASKS = [
    'scikit-learn__scikit-learn-13135',
    'scikit-learn__scikit-learn-13328',
    'pydata__xarray-3151',
]
CASE_LABELS = ['K-means bin edges', 'Boolean regression input', 'Coordinate merging']
MAX_STEPS = 16
CONFIGS = {
    'gpt-5-no-selection': 'GPT-5 · DPI',
    'gpt-5-mini-no-selection': 'GPT-5 Mini · DPI',
    'opus-4.5-no-selection': 'Claude Opus 4.5 · DPI',
}


def content_text(value):
    if isinstance(value, list):
        return '\n'.join(x.get('text', '') for x in value if isinstance(x, dict))
    return str(value or '')


def convert(raw, task, config, source, digest):
    prompt = next((content_text(x.get('content')) for x in raw['history']
                   if x.get('role') == 'user'), '')
    match = re.search(r'<pr_description>(.*?)</pr_description>', prompt, re.S)
    issue = (match[1] if match else prompt).strip().replace('\r\n', '\n')
    steps, phase = [], 'exploration'
    for i, original in enumerate(raw['trajectory']):
        action = original.get('action', '')
        observation = original.get('observation', '')
        tool, params = '', {}
        try:
            match = re.search(r'<action>\s*(.*?)\s*</action>', original.get('response', ''), re.S)
            response = json.loads(match[1]) if match else json.loads(original.get('response', '{}'))
            tool = response.get('tool_name', '')
            params = response.get('parameters', {})
        except (ValueError, TypeError, AttributeError):
            pass
        tool = tool or (action.split()[0] if action.split() else 'agent')
        handoff = tool == 'ready_to_write_test'
        steps.append({
            'index': i + 1, 'tool': tool,
            'phase': 'handoff' if handoff else phase,
            'thought': original.get('thought', '') or params.get('thinking', ''),
            'action': action, 'observation': observation,
            'handoff': params.get('summary', '') if handoff else '',
            'execution_seconds': original.get('execution_time'),
        })
        # A tool request alone is not evidence that the phase actually changed.
        if '###SWE-AGENT-PHASE-TRANSITION###' in observation:
            phase = 'generation'
    return {
        'id': task, 'config': config, 'label': CONFIGS[config],
        'title': issue.split('\n')[0], 'issue': issue, 'steps': steps,
        'exit_status': raw.get('info', {}).get('exit_status', 'unknown'),
        'patch': raw.get('info', {}).get('submission') or '',
        'source': source, 'source_sha256': digest,
    }


def evaluation_evidence(data, root, logs, aggregate, prediction):
    """Require matching patches and recorded fail-to-pass evidence, not just submission."""
    task, config = data['id'], data['config']
    source = f'{config}/{config}/{task}/report.json'
    report_bytes = logs.read(source)
    report = json.loads(report_bytes)[task]
    tests = report['tests_pred']
    if (task not in aggregate['resolved_ids'] or report.get('resolved') is not True
            or not report.get('patch_successfully_applied')
            or report.get('added_f2p', 0) <= 0 or not tests['FAIL_TO_PASS']
            or tests['FAIL_TO_FAIL'] or tests['PASS_TO_FAIL']):
        raise ValueError(f'{config}/{task}: reproduction evaluation did not pass')
    if data['patch'].strip() != prediction.strip():
        raise ValueError(f'{config}/{task}: evaluated prediction differs from trace submission')
    directory = f'evidence/{task}--{config}'
    files = {f'{directory}/report.json': report_bytes}
    evidence = {
        'resolved': True, 'added_fail_to_pass': report['added_f2p'],
        'fail_to_pass': tests['FAIL_TO_PASS'],
        'aggregate_source': f'evaluation_results/{config}.json',
        'aggregate_sha256': hashlib.sha256((root / 'evaluation_results' / f'{config}.json').read_bytes()).hexdigest(),
        'archive': f'run_instance_swt_logs/{config}.zip',
        'report': {'file': f'{directory}/report.json', 'source': source,
                   'sha256': hashlib.sha256(report_bytes).hexdigest()},
    }
    for phase, key, status in [('pre', 'before', 'FAILED'), ('post', 'after', 'PASSED')]:
        prefix = f'{config}/pred_{phase}__{config}/{task}'
        patch = logs.read(f'{prefix}/model_patch.diff').decode()
        if patch.strip() != data['patch'].strip():
            raise ValueError(f'{prefix}: evaluation patch differs from trace submission')
        output = logs.read(f'{prefix}/test_output.txt')
        for test in tests['FAIL_TO_PASS']:
            if not re.search(rf'^{status} {re.escape(test)}(?:\s|$)', output.decode(), re.M):
                raise ValueError(f'{prefix}: missing {status} evidence for {test}')
        filename = f'{directory}/{key}.txt'
        files[filename] = output
        evidence[key] = {'file': filename, 'source': f'{prefix}/test_output.txt',
                         'sha256': hashlib.sha256(output).hexdigest()}
    return evidence, files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--submission-dir', type=Path, help='Directory containing evaluation_results, inference_outputs and run_instance_swt_logs (defaults to archive parent)')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'DPIAgent/demo/data')
    args = parser.parse_args()
    root = args.submission_dir or args.archive.parent
    files = {}
    manifest = {'configs': CONFIGS, 'tasks': []}
    with ExitStack() as stack:
        archive = stack.enter_context(zipfile.ZipFile(args.archive))
        logs = {config: stack.enter_context(zipfile.ZipFile(root / 'run_instance_swt_logs' / f'{config}.zip')) for config in CONFIGS}
        aggregates = {config: json.loads((root / 'evaluation_results' / f'{config}.json').read_text()) for config in CONFIGS}
        predictions = {}
        for config in CONFIGS:
            rows = (json.loads(line) for line in (root / 'inference_outputs' / f'{config}.jsonl').read_text().splitlines() if line.strip())
            predictions[config] = {row['instance_id']: row['model_patch'] for row in rows}
        manifest['archive_trajectory_count'] = sum(n.endswith('.traj') for n in archive.namelist())
        for task, label in zip(TASKS, CASE_LABELS, strict=True):
            entry = {'id': task, 'label': label, 'repo': task.rsplit('-', 1)[0].replace('__', '/'), 'runs': []}
            for config in CONFIGS:
                source = f'traces/{config}/{task}/{task}.traj'
                payload = archive.read(source)
                data = convert(json.loads(payload), task, config, source, hashlib.sha256(payload).hexdigest())
                handoffs = [s for s in data['steps'] if s['phase'] == 'handoff']
                if (len(data['steps']) > MAX_STEPS or data['exit_status'] != 'submitted'
                        or not data['patch'] or len(handoffs) != 1
                        or '###SWE-AGENT-PHASE-TRANSITION###' not in handoffs[0]['observation']):
                    raise ValueError(f'{source}: expected a short, complete two-phase run')
                # These gallery cases must genuinely avoid the unused helpers.
                # Reject unsuitable source runs instead of hiding recorded calls.
                forbidden = [step['index'] for step in data['steps']
                             if step['tool'].startswith('python_add')
                             or step['tool'] == 'generate_test'
                             or re.search(r'\b(?:python_add\w*|generate_test)\b', step['action'])]
                if forbidden:
                    raise ValueError(f'{source}: excluded helper called at steps {forbidden}')
                data['evaluation'], evidence_files = evaluation_evidence(data, root, logs[config], aggregates[config], predictions[config][task])
                files.update(evidence_files)
                filename = f'{task}--{config}.json'
                files[filename] = (json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
                entry.setdefault('title', data['title'])
                entry['runs'].append({'config': config, 'file': filename, 'steps': len(data['steps'])})
            manifest['tasks'].append(entry)
    # Validate the entire gallery before changing any generated files.
    previous_path = args.output / 'index.json'
    previous = json.loads(previous_path.read_text()) if previous_path.exists() else {'tasks': []}
    for filename, payload in files.items():
        path = args.output / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
    for task in previous['tasks']:
        for run in task['runs']:
            filename = run['file']
            if filename not in files:
                (args.output / filename).unlink(missing_ok=True)
    previous_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f"Exported {sum(len(t['runs']) for t in manifest['tasks'])} runs across {len(TASKS)} tasks.")


if __name__ == '__main__':
    main()
