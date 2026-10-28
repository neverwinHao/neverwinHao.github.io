'use strict';
const $ = id => document.getElementById(id);
const capture = new URLSearchParams(location.search).has('capture');
document.documentElement.classList.toggle('capture', capture);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PLAYBACK_RATE = 3;
const RESULT_SECONDS = 3;
const chapters = [
  {task:'sphinx-doc__sphinx-9367', config:'gpt-5-mini-no-selection', model:'GPT-5 Mini', title:'Single-element tuples', repo:'Sphinx'},
  {task:'matplotlib__matplotlib-26113', config:'gpt-5-no-selection', model:'GPT-5', title:'Hexbin count threshold', repo:'Matplotlib'},
  {task:'pydata__xarray-7233', config:'opus-4.5-no-selection', model:'Claude Opus 4.5', title:'Coordinate preservation', repo:'xarray'},
];
let slides = [], active = -1, currentTime = 0, playing = false, last = 0, raf = 0;
let ready = false;

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}
function addSlide(kind, seconds, chapter, markup) {
  const node = el('section', 'slide '+kind);
  if (markup) node.innerHTML = markup; // Static presentation copy only.
  $('slides').append(node);
  const start = slides.reduce((sum,s)=>sum+s.duration,0);
  const slide = {kind,duration:seconds,chapter,node,start};
  slides.push(slide);
  return slide;
}

addSlide('cover',1.2,null,'<img class="cover-image" src="../assets/demo/dpiagent-cover.png" alt="DPIAgent: Agentic Reproduction Test Generation with Structured Phase Boundaries — authors and affiliations">');
chapters.forEach(chapter=>{
  const demo=addSlide('demo',1,chapter);
  chapter.frame=el('iframe','replay-frame');chapter.frame.title=`${chapter.repo}: original ${chapter.model} recording`;
  chapter.frame.tabIndex=-1;chapter.frame.inert=true;
  chapter.frame.src=`../demo/?presentation=1&task=${chapter.task}&config=${chapter.config}`;
  demo.node.append(chapter.frame);
});
let duration = slides.reduce((sum,s)=>sum+s.duration,0);
$('seek').max=duration;

const playerCSS = `
html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:white!important}
main{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}
.workspace{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.topbar,.model-bar,.casebar,.run-heading,.document,.playback,.trace-guide,.step-index,.footnote{display:none!important}
.method-board{height:700px!important;margin:0!important;gap:18px!important;grid-template-columns:minmax(0,1fr) 300px minmax(0,1fr)!important}
.phase-pane{height:700px!important}.pane-heading{padding:14px!important;min-height:60px!important}
.pane-heading h3{font-size:19px!important}.pane-status{font-size:11px!important}.phase-number{font-size:25px!important}
.tool-scope{min-height:73px!important;padding:8px 12px!important}.tool-scope p{font-size:12px!important}
.phase-stream{height:auto!important;flex:1!important;min-height:0!important;padding:14px!important}
.event pre{font-size:14px!important;line-height:1.65!important}.event .output{max-height:280px!important}
.event .command{max-height:215px!important;overflow:auto!important}
.protocol-pane{height:700px!important;padding-top:8px!important}.protocol-heading h3{font-size:19px!important}
.protocol-heading{margin-bottom:9px!important}.transfer-line{margin-bottom:10px!important}
.protocol-state{min-height:30px!important;font-size:11px!important;margin-bottom:8px!important}
.handoff-progress-wrap{margin-bottom:10px!important}.protocol-fields{gap:6px!important}
.protocol-field{min-height:41px!important;padding:6px 10px!important}.protocol-field>span{font-size:14px!important}
.protocol-field>p{max-height:127px!important;font-size:14px!important;line-height:1.6!important}
.handoff-record,.protocol-jump,#continue-handoff,.phase-jump{display:none!important}
.pane-footer{font-size:11px!important}
.tool-scope p,.protocol-state,.carried-plan,.empty>span{display:none!important}
.tool-scope{min-height:47px!important}.protocol-heading{margin-bottom:20px!important}
.reference-check{margin-top:12px!important;padding-top:12px!important}
.reference-check h4{font-size:16px!important}.reference-source{font-size:11px!important;margin:4px 0 10px!important}
.reference-result{padding:10px!important;margin-top:8px!important}.reference-result strong{font-size:14px!important}
.reference-result pre{font-size:12px!important;line-height:1.5!important;margin:7px 0!important}
.reference-result a{font-size:11px!important;padding:4px 0!important}

`;

function fit() {
  const box=$('viewport').getBoundingClientRect();
  $('stage').style.transform=`scale(${Math.min(box.width/1600,box.height/900)})`;
}
addEventListener('resize',fit);fit();

function seekReplay(chapter, elapsed) {
  const api=chapter.api;
  // A linear clock mapping replays every original action, including the handoff.
  // No selected steps, frozen commands, or per-step timing overrides.
  const replayTime=Math.min(api.timing.total,elapsed*PLAYBACK_RATE);
  api.seek(replayTime);
  return replayTime>=api.timing.total?'evaluation':'trajectory';
}

function render(seconds) {
  currentTime=Math.max(0,Math.min(duration,seconds));
  const index=Math.min(slides.length-1,slides.findLastIndex(s=>s.start<=currentTime));
  const slide=slides[index], elapsed=currentTime-slide.start;
  if(index!==active){
    if(active>=0){slides[active].node.classList.remove('active');slides[active].node.setAttribute('aria-hidden','true');}
    slide.node.classList.add('active');slide.node.setAttribute('aria-hidden','false');active=index;
  }
  // Match the reference's fade through white, with no translation or zoom.
  const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const enter=index===0?1:ease(elapsed/.5);
  const leave=index===slides.length-1?1:ease((slide.duration-elapsed)/.5);
  slide.node.style.opacity=reducedMotion?'1':String(Math.min(enter,leave));
  const cover=slide.kind==='cover';
  $('stage').classList.toggle('on-cover',cover);
  $('chapter-label').textContent=slide.chapter?`${slide.chapter.repo} · ${slide.chapter.title}`:'';
  $('chapter-label').style.opacity=slide.node.style.opacity;
  $('source-label').style.opacity=slide.node.style.opacity;
  $('source-label').textContent='';
  $('slide-number').textContent=`${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
  $('progress-fill').style.transform=`scaleX(${currentTime/duration})`;
  $('seek').value=currentTime;
  $('clock').textContent=`${formatTime(currentTime)} / ${formatTime(duration)}`;
  $('previous').disabled=index===0;$('next').disabled=index===slides.length-1;
  $('open-trace').href=slide.chapter?`../demo/?task=${slide.chapter.task}&config=${slide.chapter.config}`:'../demo/';
  if(ready && slide.kind==='demo'){
    const state=seekReplay(slide.chapter,elapsed);
    $('source-label').textContent=`${slide.chapter.model} · ${state==='evaluation'?'Recorded reference-fix evaluation':`Full recording · ${PLAYBACK_RATE}×`}`;

  }
}
function formatTime(s){return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;}
function setPlaying(value){
  playing=value&&ready&&currentTime<duration;last=0;cancelAnimationFrame(raf);
  $('play').textContent=playing?'Pause':currentTime>=duration?'Replay':'Play presentation';
  if(playing)raf=requestAnimationFrame(tick);
}
function tick(now){if(!playing)return;if(last)render(currentTime+Math.min(100,now-last)/1000);last=now;if(currentTime>=duration)setPlaying(false);else raf=requestAnimationFrame(tick);}
function go(index){setPlaying(false);render(slides[Math.max(0,Math.min(slides.length-1,index))].start+.4);}
$('play').onclick=()=>{if(currentTime>=duration)render(0);setPlaying(!playing);};
$('previous').onclick=()=>go(active-1);$('next').onclick=()=>go(active+1);
$('seek').oninput=()=>{setPlaying(false);render(Number($('seek').value));};
$('fullscreen').onclick=async()=>{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();};
document.addEventListener('keydown',e=>{if(/^(INPUT|BUTTON|A)$/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();$('play').click();}else if(e.code==='ArrowRight')go(active+1);else if(e.code==='ArrowLeft')go(active-1);});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
render(.4);

async function init(){
  await Promise.all(chapters.map(async chapter=>{
    const deadline=Date.now()+45000;
    while(!chapter.frame.contentWindow?.dpiReplay?.ready){if(Date.now()>deadline)throw Error(`Could not load ${chapter.repo} recording.`);await new Promise(r=>setTimeout(r,100));}
    chapter.api=chapter.frame.contentWindow.dpiReplay;
    const doc=chapter.frame.contentDocument;const style=doc.createElement('style');style.textContent=playerCSS;doc.head.append(style);
    const recording=chapter.api.recording;
    if(recording.id!==chapter.task||recording.config!==chapter.config||!recording.evaluation?.replay)throw Error('Recording or evaluation mismatch.');
    chapter.api.seek(0);
  }));
  let start=0;
  for(const slide of slides){
    if(slide.chapter){
      slide.chapter.replayDuration=slide.chapter.api.timing.total/PLAYBACK_RATE;
      slide.duration=slide.chapter.replayDuration+RESULT_SECONDS;
    }
    slide.start=start;start+=slide.duration;
  }
  duration=start;$('seek').max=duration;
  await document.fonts.ready;
  await Promise.all([...document.querySelectorAll('.cover-image')].map(img=>img.decode()));
  ready=true;$('play').disabled=false;setPlaying(false);render(.4);
}
window.dpiShowcase={get ready(){return ready;},get duration(){return duration;},playbackRate:PLAYBACK_RATE, get slides(){return slides.map(s=>({kind:s.kind,start:s.start,duration:s.duration,replayDuration:s.chapter?.replayDuration,task:s.chapter?.task,config:s.chapter?.config}));},get recordings(){return chapters.map(c=>c.api.recording);},seek(t){setPlaying(false);render(t);}};
init().catch(error=>{$('error').hidden=false;$('error').textContent=error.message;$('play').textContent='Unable to load';});
