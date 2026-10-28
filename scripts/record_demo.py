#!/usr/bin/env python3
"""Record the real slide presentation, then export MP4, GIF and poster.

Requires Python Playwright/Chromium and ffmpeg. Start the static site server
before running. The three embedded players use the current exported recordings.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import tempfile
from playwright.sync_api import sync_playwright
from PIL import Image


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def export_gif(video, gif, work):
    """Reserve colors for static cover logos before quantizing the full replay."""
    def ffmpeg(*args):
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y',*map(str,args)],check=True)
    cover = work/'cover-frame.png'
    ffmpeg('-ss',0,'-i',video,'-vf','scale=960:-1:flags=lanczos','-frames:v',1,cover)
    with Image.open(cover) as frame:
        pixels = [rgb for rgb in frame.convert('RGB').getdata() if max(rgb)-min(rgb)>12]
    # Keep small colored logos from losing their palette entries to white/text.
    pixels = pixels or [(255,255,255)]
    strip = Image.new('RGB',(256,math.ceil(len(pixels)/256)),'white')
    strip.putdata(pixels)
    strip.save(work/'cover-colors.png')
    ffmpeg('-i',work/'cover-colors.png','-vf','palettegen=max_colors=64:reserve_transparent=0','-frames:v',1,work/'cover-palette.png')
    ffmpeg('-i',video,'-vf','fps=15,scale=960:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=191:reserve_transparent=0','-frames:v',1,work/'trace-palette.png')
    colors = []
    for name in ['cover-palette.png','trace-palette.png']:
        with Image.open(work/name) as palette:
            for color in palette.convert('RGBA').getdata():
                if color[3] and color not in colors:
                    colors.append(color)
    assert len(colors)<=255
    colors += [(255,255,255,255)]*(255-len(colors))
    colors.append((0,0,0,0))
    palette = Image.new('RGBA',(16,16));palette.putdata(colors)
    palette.save(work/'gif-palette.png')
    ffmpeg('-i',video,'-i',work/'gif-palette.png','-filter_complex',
           '[0:v]fps=15,scale=960:-1:flags=lanczos[v];[v][1:v]paletteuse=dither=none:diff_mode=rectangle',
           '-loop',0,gif)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', default='http://localhost:8765')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'DPIAgent/assets/demo')
    parser.add_argument('--fps', type=int, default=20)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    args.output.mkdir(parents=True, exist_ok=True)
    url = args.base_url.rstrip('/') + '/DPIAgent/showcase/?capture=1'
    with tempfile.TemporaryDirectory(prefix='dpi-story-') as directory:
        work = Path(directory)
        video = work / 'dpiagent-demo.mp4'
        errors = []
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
            page = browser.new_page(viewport={'width':1600, 'height':900}, device_scale_factor=1)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(url, wait_until='networkidle')
            page.wait_for_function('window.dpiShowcase?.ready', timeout=60000)
            page.evaluate('document.fonts.ready')
            for frame in page.frames:
                frame.evaluate('document.fonts.ready')
            duration = page.evaluate('dpiShowcase.duration')
            scenes = page.evaluate('dpiShowcase.slides')
            playback_rate = page.evaluate('dpiShowcase.playbackRate')
            recordings = page.evaluate('dpiShowcase.recordings.map(d=>({id:d.id,config:d.config,source:d.source,source_sha256:d.source_sha256,steps:d.steps.length,validation:d.validation,evaluation:d.evaluation}))')
            assert len(recordings) == 3
            assert len({d['config'] for d in recordings}) == 3
            page.evaluate('dpiShowcase.seek(0)')
            page.screenshot(path=str(work/'dpiagent-demo-poster.png'))
            command = ['ffmpeg','-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',str(args.fps),'-vcodec','png','-i','-','-an','-c:v','libx264','-threads','4','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(video)]
            with (work/'encoder.log').open('wb') as log:
                encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
                scene_index = -1
                count = math.ceil(duration * args.fps)
                try:
                    for i in range(count):
                        t = i / args.fps
                        page.evaluate('(t)=>dpiShowcase.seek(t)', t)
                        scene = max(j for j,s in enumerate(scenes) if s['start'] <= t)
                        if scene != scene_index:
                            print(f"Scene {scene+1}/{len(scenes)}: {scenes[scene]['kind']} {scenes[scene].get('task') or ''} ({t:.1f}s)", flush=True)
                            scene_index = scene
                        encoder.stdin.write(page.screenshot())
                        if errors:
                            raise RuntimeError(errors)
                finally:
                    encoder.stdin.close()
                if encoder.wait() != 0:
                    raise RuntimeError((work/'encoder.log').read_text())
            # Every displayed result remains an exact excerpt from its archived log.
            for frame in page.frames[1:]:
                assert frame.evaluate('!!window.dpiReplay?.ready')
            assert not errors, errors
            browser.close()
        print('Encoding GIF…', flush=True)
        gif = work/'dpiagent-demo.gif'
        export_gif(video, gif, work)
        probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(video)]))
        stream = next(s for s in probe['streams'] if s['codec_type']=='video')
        assert stream['width']==1600 and stream['height']==900 and stream['codec_name']=='h264'
        assert abs(float(probe['format']['duration'])-duration) < .15
        sources = ['scripts/record_demo.py','DPIAgent/assets/demo/dpiagent-cover.png','DPIAgent/assets/demo/dpiagent-cover.pptx','DPIAgent/showcase/index.html','DPIAgent/showcase/showcase.js','DPIAgent/showcase/showcase.css','DPIAgent/demo/demo.js','DPIAgent/demo/demo.css','DPIAgent/demo/data/index.json']
        metadata = {'playback_rate':playback_rate,'duration_seconds':float(probe['format']['duration']),'frames':count,'fps':args.fps,'resolution':[1600,900],'audio':False,'gif':{'resolution':[960,540],'fps':15,'speed':1,'palette':'cover-colors-64+trajectory-191','dither':'none'},'presentation':'https://neverwinhao.github.io/DPIAgent/showcase/','capture_url':url,'scenes':scenes,'recordings':recordings,'source_files':{s:sha(repo/s) for s in sources},'browser_errors':errors}
        metadata['artifacts'] = {name:{'bytes':(work/name).stat().st_size,'sha256':sha(work/name)} for name in ['dpiagent-demo.mp4','dpiagent-demo.gif','dpiagent-demo-poster.png']}
        (work/'recording.json').write_text(json.dumps(metadata,indent=2)+'\n')
        for name in ['dpiagent-demo.mp4','dpiagent-demo.gif','dpiagent-demo-poster.png','recording.json']:
            (args.output/name).write_bytes((work/name).read_bytes())
        print(json.dumps({'duration_seconds':metadata['duration_seconds'],'artifacts':metadata['artifacts'],'browser_errors':errors},indent=2),flush=True)


if __name__=='__main__':
    main()
