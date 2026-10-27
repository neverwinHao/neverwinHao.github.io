'use strict';
const $ = id => document.getElementById(id);
const capture = new URLSearchParams(location.search).has('capture');
document.documentElement.classList.toggle('capture', capture);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const chapters = [
  {task:'sphinx-doc__sphinx-9367', config:'gpt-5-mini-no-selection', model:'GPT-5 Mini', repo:'Sphinx', title:'One missing comma.\nA different meaning.', explanation:'A single-element tuple loses its trailing comma when Sphinx renders the expression.', bad:'(1)', good:'(1,)', large:true, inspect:2, edit:6, labels:['Locate the tuple renderer', 'Pass the diagnosis to test generation', 'Write the regression test', 'Reproduce the missing comma']},
  {task:'matplotlib__matplotlib-26113', config:'gpt-5-no-selection', model:'GPT-5', repo:'Matplotlib', title:'The boundary\nshould count.', explanation:'Hexbin drops bins exactly at mincnt when C is supplied. The test compares the two code paths.', bad:'count > mincnt', good:'count >= mincnt', inspect:5, edit:14, labels:['Inspect the count threshold', 'Carry the boundary condition forward', 'Test both sides of the threshold', 'The new tests expose the mismatch']},
  {task:'pydata__xarray-7233', config:'opus-4.5-no-selection', model:'Claude Opus 4.5', repo:'xarray', title:'A coordinate\nloses its role.', explanation:'After coarsen.construct, the day coordinate becomes a data variable. Its role should be preserved.', bad:'day ∈ data_vars', good:'day ∈ coords', inspect:9, edit:14, labels:['Trace coordinate reconstruction', 'Pass the coordinate-preservation diagnosis', 'Check the coordinate roles', 'Both regression tests fail on buggy code']},
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

addSlide('cover',3,null,`<p class="eyebrow">DPIAgent · Reproduction test generation</p><h1>From a reported bug<br>to a <span>regression test.</span></h1><p class="lead">Follow three real issues from code inspection<br>to tests that distinguish buggy and fixed code.</p><div class="cover-flow"><b>Explore the defect</b><span>→</span><b>Hand off the diagnosis</b><span>→</span><b>Write the test</b></div>`);
addSlide('method',4,null,`<p class="eyebrow">How the work is organized</p><h2>The diagnosis connects exploration to testing.</h2><div class="method-row"><div class="method-box"><p>01</p><h3>Explore</h3><p>Code inspection<br>Shell</p></div><span class="method-arrow">→</span><div class="method-box purple"><p>Recorded handoff</p><h3>Diagnosis → test plan</h3><div class="field-list"><span>Root cause</span><span>Test plan</span><span>Bug location</span><span>Reproduction</span><span>Expected / actual</span><span>Reference tests</span></div></div><span class="method-arrow">→</span><div class="method-box green"><p>02</p><h3>Generate</h3><p>Test editor<br>Shell</p></div></div>`);

chapters.forEach((chapter,i)=>{
  const issue = addSlide('issue',3.5,chapter);
  const copy = el('div','issue-copy');
  copy.append(el('p','eyebrow',`Issue ${String(i+1).padStart(2,'0')} / ${chapter.repo}`));
  const title = el('h2','',chapter.title); title.style.whiteSpace='pre-line';
  copy.append(title,el('p','lead',chapter.explanation));
  const meta = el('div','issue-meta'); meta.append(el('span','',chapter.task),el('span','',chapter.model)); copy.append(meta);
  const visual = el('div','issue-visual');
  for (const [kind,label,value] of [['bad','Buggy behavior',chapter.bad],['good','Expected behavior',chapter.good]]) {
    const row=el('div','comparison '+kind);row.append(el('label','',label),el('code',chapter.large?'large-code':'',value));visual.append(row);
  }
  issue.node.append(copy,visual);
  const demo = addSlide('demo',18,chapter);
  const heading=el('div','demo-heading');demo.caption=el('h2','',chapter.labels[0]);demo.phase=el('span','phase-pill','Exploration');heading.append(demo.caption,demo.phase);
  chapter.frame=el('iframe','replay-frame');chapter.frame.title=`${chapter.repo}: original ${chapter.model} recording`;
  chapter.frame.tabIndex=-1;chapter.frame.inert=true;
  chapter.frame.src=`../demo/?presentation=1&task=${chapter.task}&config=${chapter.config}`;
  demo.node.append(heading,chapter.frame);
  const result=addSlide('result',4,chapter);chapter.result=result;
  result.node.append(el('p','eyebrow',`${chapter.repo} / Recorded reference-fix evaluation`),el('h2','','The same test distinguishes the fix.'),el('p','lead','The submitted test patch is identical in both evaluation runs.'));
  chapter.resultGrid=el('div','result-grid');result.node.append(chapter.resultGrid,el('p','result-note','SWT-Bench evaluation logs · separate from the agent trajectory'));
});
const outro=addSlide('outro',4,null,`<p class="eyebrow">Continue with the evidence</p><h2>Explore the trajectories.</h2><p class="lead">Three shared cases, available for every model.<br>Inspect the full actions, test patches, and evaluation logs.</p><div class="case-links"><a href="../demo/?task=sphinx-doc__sphinx-9367">Single-element tuples ↗</a><a href="../demo/?task=matplotlib__matplotlib-26113">Hexbin count threshold ↗</a><a href="../demo/?task=pydata__xarray-7233">Coordinate preservation ↗</a></div><p class="model-line">GPT-5 Mini &nbsp; / &nbsp; GPT-5 &nbsp; / &nbsp; Claude Opus 4.5</p><a class="site-url" href="../demo/">neverwinhao.github.io/DPIAgent</a>`);
const duration = slides.reduce((sum,s)=>sum+s.duration,0);
$('seek').max=duration;

const playerCSS = `
html,body{margin:0!important;padding:0!important;overflow:hidden!important;background:white!important}
main{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}
.workspace{margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.topbar,.model-bar,.casebar,.run-heading,.document,.playback,.trace-guide,.step-index,.footnote{display:none!important}
.method-board{height:625px!important;margin:0!important;gap:18px!important;grid-template-columns:minmax(0,1fr) 300px minmax(0,1fr)!important}
.phase-pane{height:625px!important}.pane-heading{padding:14px!important;min-height:60px!important}
.pane-heading h3{font-size:19px!important}.pane-status{font-size:11px!important}.phase-number{font-size:25px!important}
.tool-scope{min-height:73px!important;padding:8px 12px!important}.tool-scope p{font-size:12px!important}
.phase-stream{height:auto!important;flex:1!important;min-height:0!important;padding:14px!important}
.event pre{font-size:14px!important;line-height:1.65!important}.event .output{max-height:280px!important}
.event .command{max-height:215px!important;overflow:auto!important}
.protocol-pane{height:625px!important;padding-top:8px!important}.protocol-heading h3{font-size:19px!important}
.protocol-heading{margin-bottom:9px!important}.transfer-line{margin-bottom:10px!important}
.protocol-state{min-height:30px!important;font-size:11px!important;margin-bottom:8px!important}
.handoff-progress-wrap{margin-bottom:10px!important}.protocol-fields{gap:6px!important}
.protocol-field{min-height:41px!important;padding:6px 10px!important}.protocol-field>span{font-size:14px!important}
.protocol-field>p{max-height:127px!important;font-size:14px!important;line-height:1.6!important}
.handoff-record,.protocol-jump,#continue-handoff,.phase-jump{display:none!important}
.pane-footer{font-size:11px!important}.carried-plan{font-size:11px!important}
`;

function fit() {
  const box=$('viewport').getBoundingClientRect();
  $('stage').style.transform=`scale(${Math.min(box.width/1600,box.height/900)})`;
}
addEventListener('resize',fit);fit();

function seekReplay(chapter, elapsed) {
  const api=chapter.api, {starts,durations,handoffIndex}=api.timing;
  const steps=api.recording.steps;
  const fail=api.recording.validation[0].step-1;
  let index, progress, phase, label;
  if(elapsed<3.2){ index=chapter.inspect-1;progress=.45+.55*Math.min(1,elapsed/2.1);phase='exploration';label=0; }
  else if(elapsed<9.2){ index=handoffIndex;progress=(elapsed-3.2)/6;phase='handoff';label=1; }
  else if(elapsed<12.5){ index=chapter.edit-1;progress=Math.min(1,(elapsed-9.2)/2.5);phase='generation';label=2; }
  else { index=fail;progress=Math.min(1,(elapsed-12.5)/2.8);phase='generation';label=3; }
  api.seek(starts[index]+durations[index]*Math.min(.9999,progress));
  if (progress >= .94 && phase !== 'handoff') {
    const needle = label === 3 ? 'AssertionError' : label === 2 ? 'assert' : chapter.repo === 'Sphinx' ? 'visit_Tuple' : chapter.repo === 'Matplotlib' ? 'len(acc)' : 'construct';
    api.focus(index + 1, needle, label === 2 ? 'command' : 'output');
  }
  return {phase,label,step:steps[index].index};
}

function render(seconds) {
  currentTime=Math.max(0,Math.min(duration,seconds));
  const index=Math.min(slides.length-1,slides.findLastIndex(s=>s.start<=currentTime));
  const slide=slides[index], elapsed=currentTime-slide.start;
  if(index!==active){
    if(active>=0){slides[active].node.classList.remove('active');slides[active].node.setAttribute('aria-hidden','true');}
    slide.node.classList.add('active');slide.node.setAttribute('aria-hidden','false');active=index;
  }
  const enter=Math.min(1,elapsed/.35),leave=index===slides.length-1?1:Math.min(1,(slide.duration-elapsed)/.2);
  slide.node.style.opacity=reducedMotion?'1':String(Math.max(0,Math.min(enter,leave)));
  slide.node.style.transform=reducedMotion?'none':`translateY(${(1-enter)*14}px)`;
  $('chapter-label').textContent=slide.chapter?`${slide.chapter.repo} / ${slide.chapter.model}`:'A visual walkthrough';
  $('source-label').textContent=slide.kind==='demo'?'Selected moments · original recorded actions and output':slide.kind==='result'?'Recorded evaluation · same test patch, before and after the reference fix':'DPIAgent · Reproduction test generation';
  $('slide-number').textContent=`${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
  $('progress-fill').style.transform=`scaleX(${currentTime/duration})`;
  $('seek').value=currentTime;
  $('clock').textContent=`${formatTime(currentTime)} / ${formatTime(duration)}`;
  $('previous').disabled=index===0;$('next').disabled=index===slides.length-1;
  $('open-trace').href=slide.chapter?`../demo/?task=${slide.chapter.task}&config=${slide.chapter.config}`:'../demo/';
  if(ready && slide.kind==='demo'){
    const state=seekReplay(slide.chapter,elapsed);
    slide.caption.textContent=slide.chapter.labels[state.label];
    slide.phase.textContent={exploration:'01 · Exploration',handoff:'Diagnosis handoff',generation:'02 · Test generation'}[state.phase];
    slide.phase.dataset.phase=state.phase;
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
    for(const [key,name,count] of [['before','FAILED',recording.evaluation.fail_to_pass.length],['after','PASSED',recording.evaluation.fail_to_pass.length]]){
      const box=el('div','result-box'+(key==='after'?' pass':''));
      box.append(el('h3','',`${count} ${name.toLowerCase()} · ${key==='before'?'buggy code':'reference fix'}`),el('pre','',recording.evaluation.replay[key]));
      const link=el('a','','Read the original log ↗');link.href='../demo/data/'+recording.evaluation[key].file;link.target='_blank';link.rel='noopener';box.append(link);chapter.resultGrid.append(box);
    }
    chapter.api.seek(0);
  }));
  await document.fonts.ready;
  ready=true;$('play').disabled=false;setPlaying(false);render(.4);
}
window.dpiShowcase={get ready(){return ready;},duration, get slides(){return slides.map(s=>({kind:s.kind,start:s.start,duration:s.duration,task:s.chapter?.task,config:s.chapter?.config}));},get recordings(){return chapters.map(c=>c.api.recording);},seek(t){setPlaying(false);render(t);}};
init().catch(error=>{$('error').hidden=false;$('error').textContent=error.message;$('play').textContent='Unable to load';});
