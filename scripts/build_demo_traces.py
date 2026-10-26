#!/usr/bin/env python3
"""Export a small, reproducible gallery from the submitted trace archive."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

TASKS = [
    'astropy__astropy-12907', 'django__django-11099',
    'scikit-learn__scikit-learn-13439', 'psf__requests-5414',
]
CONFIGS = {
    'gpt-5-no-selection': 'GPT-5 · DPI',
    'gpt-5-mini-no-selection': 'GPT-5 Mini · DPI',
    'opus-4.5-no-selection': 'Claude Opus 4.5 · DPI',
    'gpt-5-selection': 'GPT-5 · DPI + test selection',
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


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'DPIAgent/demo/data')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {'configs': CONFIGS, 'tasks': []}
    with zipfile.ZipFile(args.archive) as archive:
        manifest['archive_trajectory_count'] = sum(n.endswith('.traj') for n in archive.namelist())
        for task in TASKS:
            entry = {'id': task, 'repo': task.rsplit('-', 1)[0].replace('__', '/'), 'runs': []}
            for config in CONFIGS:
                source = f'traces/{config}/{task}/{task}.traj'
                if source not in archive.namelist():
                    continue
                payload = archive.read(source)
                data = convert(json.loads(payload), task, config, source, hashlib.sha256(payload).hexdigest())
                filename = f'{task}--{config}.json'
                (args.output / filename).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
                entry.setdefault('title', data['title'])
                entry['runs'].append({'config': config, 'file': filename, 'steps': len(data['steps'])})
            manifest['tasks'].append(entry)
    (args.output / 'index.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(f"Exported {sum(len(t['runs']) for t in manifest['tasks'])} runs across {len(TASKS)} tasks.")


if __name__ == '__main__':
    main()
