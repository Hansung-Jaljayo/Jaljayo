// Quiet geared actuator, synthesized locally; no recording or audio download.
export function createMotorSound(){
 let ctx,master,voices=[],enabled=true,last=0;
 function unlock(){
  if(!enabled)return;
  try{
   if(!ctx){
    ctx=new (window.AudioContext||window.webkitAudioContext)();
    master=ctx.createGain();master.gain.value=0;const soften=ctx.createBiquadFilter();soften.type='lowpass';soften.frequency.value=420;soften.Q.value=.5;master.connect(soften).connect(ctx.destination);
    for(const [freq,volume] of [[145,.024],[290,.003]]){
     const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='sine';osc.frequency.value=freq;g.gain.value=volume;osc.connect(g).connect(master);osc.start();voices.push({osc,freq});
    }
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),ng=ctx.createGain();
    noise.buffer=buffer;noise.loop=true;filter.type='bandpass';filter.frequency.value=210;filter.Q.value=.55;ng.gain.value=.035;noise.connect(filter).connect(ng).connect(master);noise.start();
   }
   ctx.resume().catch(()=>{});
  }catch{ /* Keep controls usable on browsers without audio support. */ }
 }
 function update(head,leg){
  if(!ctx)return;
  const count=Number(head)+Number(leg),on=enabled&&!document.hidden&&count>0;
  const level=on?(count===2?.24:.19):0;
  if(level!==last){master.gain.setTargetAtTime(level,ctx.currentTime,on?.12:.045);voices.forEach(v=>v.osc.frequency.setTargetAtTime(v.freq*(on?(count===2?1.012:1):.85),ctx.currentTime,.14));last=level;}
 }
 document.addEventListener('pointerdown',unlock,{passive:true});document.addEventListener('keydown',unlock);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)update(false,false)});
 window.addEventListener('pagehide',()=>{if(ctx)ctx.suspend()});
 return {update,setEnabled(value){enabled=value;if(enabled)unlock();else update(false,false)}};
}
