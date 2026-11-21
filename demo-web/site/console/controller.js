import {createMotorSound} from './motor.js?v=3';
import {initialState,interpret,pressButton,toggleOccupied,reservationDue,alarmDue,alarmOff,savePose,resetPose,DEFAULTS} from './engine.js?v=19';
import {createAlarmSound} from './alarm-sound.js?v=1';
const alarmSound=createAlarmSound();
let barDrag=null; // 손으로 끌고 있는 각도 막대
// 저장 자세 버튼을 누를 때 할 일: 평소엔 그 자세로 이동, 'save'면 지금 각도를 저장, 'reset'이면 처음 값으로
let poseMode=null;
function setPoseMode(m){poseMode=m;const $=id=>document.getElementById(id);$('pose-save').setAttribute('aria-pressed',m==='save');$('pose-reset').setAttribute('aria-pressed',m==='reset');$('presets').classList.toggle('picking',!!m);$('pose-mode-hint').textContent=m==='save'?' · 어느 자세에 저장할까요?':m==='reset'?' · 어느 자세를 되돌릴까요?':''}
import {GROUPS,SCENES} from './commands.js?v=22';
export function initConsole({current,target}){
 const $=id=>document.getElementById(id);
 let state={...initialState,angles:{...current},target:{...target}},pendingAt=0,jog=null;
 const motorSound=createMotorSound();
 const moving=()=>Math.abs(current.head-target.head)>.001||Math.abs(current.leg-target.leg)>.001;
 function sync(){state={...state,angles:{...current},target:{...target}}}
 function render(){
  // 각도 막대는 tick에서 실제 각도를 매 프레임 따라간다(목표로 바로 튀지 않게)
  $('confirm-actions').hidden=state.pending?.kind!=='confirm';
  $('heard').textContent=state.heard||'시연 모드 · 예시 문장으로 조작';$('reply').textContent=state.speech||state.note||'원하는 자세를 골라 주세요';$('model-output').textContent=state.output||'없음';$('trace-heard').textContent=state.heard?`「${state.heard}」`:'아직 없음';$('trace-ran-row').hidden=!state.ranPrev;$('trace-ran').textContent=state.ranPrev?`동의 → 앞 요청 ${state.ranPrev}`:'';$('trace-act').textContent=state.speech||state.note||'없음';
  $('device-state').textContent=`센서 · ${state.occupied?'누워 있음':'비어 있음'}   /   예약 · ${state.reservation?.label||'없음'}   /   알람 · ${state.ringing?'울리는 중':state.alarm?.label||'없음'}`;
  $('occupied').textContent=state.occupied?'침대에서 나가기':'침대에 눕기';$('reservation').disabled=!state.reservation;$('alarm').disabled=state.ringing;for(const k of ['read','tv','rest','sleep']){const m=state.memory[k],a=m||DEFAULTS[k],el=$('pose-'+k);el.textContent=`${m?'저장 · ':''}머리 ${a.head}° · 다리 ${a.leg}°`;el.classList.toggle('saved',!!m)}$('ring-overlay').hidden=!state.ringing;alarmSound.set(!!state.ringing);$('alarm-off').disabled=!state.ringing;
  document.querySelectorAll('#talk-items button').forEach(b=>b.disabled=state.ringing);
 }
 function apply(fn){sync();state=fn(state);Object.assign(target,state.target);pendingAt=state.pending?performance.now():0;render()}
 function say(text,output){jog=null;apply(s=>interpret(s,text,output))}
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>{const on=x===b;x.setAttribute('aria-selected',on);$(x.dataset.tab+'-pane').hidden=!on})});
 for(const k of ['head','leg']){$(k).value=target[k];$(k).step='any';$(k).onpointerdown=()=>{barDrag=k};$(k).onpointerup=$(k).onpointercancel=()=>{barDrag=null};$(k).oninput=()=>{sync();state={...state,pending:null,after:'',speech:'',heard:'',output:'',moveStart:{...current},note:'각도를 조절하고 있어요'};target[k]=+$(k).value;state.after='원하는 각도로 맞췄어요';render()}}
 document.querySelectorAll('[data-purpose]').forEach(b=>b.onclick=()=>{const k=b.dataset.purpose;
   if(poseMode){const m=poseMode;setPoseMode(null);apply(st=>m==='save'?savePose(st,k):resetPose(st,k));return}
   say(b.dataset.label+' 자세로 바꿔 줘',`<maum_0>(command=call, purpose=${k}, confirm=no)<maum_end>`)});
 $('pose-save').onclick=()=>setPoseMode(poseMode==='save'?null:'save');$('pose-reset').onclick=()=>setPoseMode(poseMode==='reset'?null:'reset');
 document.querySelectorAll('[data-tab]').forEach(t=>t.addEventListener('click',()=>setPoseMode(null)));
 // 말하기: 대표 장면(번호)을 먼저, 나머지 예시는 '예시 더 보기'에 접어 둔다(11/16)
 const scenes=document.createElement('section');scenes.className='scenes';scenes.innerHTML='<h2>대표 장면</h2>';
 SCENES.forEach((c,i)=>{const b=document.createElement('button');b.className='scene';
  b.innerHTML=`<span class="scene-no">${i+1}</span><span class="scene-text"><small></small></span>`;
  b.querySelector('small').textContent=c.group+(c.hint?' · '+c.hint:'');b.querySelector('.scene-text').append(c.heard);
  b.onclick=()=>say(c.heard,c.output);scenes.append(b)});
 const more=document.createElement('details');more.className='more';more.innerHTML='<summary>예시 더 보기</summary>';
 for(const group of GROUPS){
  const section=document.createElement('section'),heading=document.createElement('h2');
  heading.textContent=group.title;section.append(heading);
  for(const c of group.items){const button=document.createElement('button');button.textContent=c.heard;button.onclick=()=>say(c.heard,c.output);section.append(button);}
  more.append(section);
 }
 $('talk-items').append(scenes,more);
 render();
 $('confirm-yes').onclick=()=>say('응','<maum_2>(type=yes, value=none)<maum_end>');$('confirm-no').onclick=()=>say('아니','<maum_2>(type=no, value=none)<maum_end>');
 $('stop').onclick=()=>{jog=null;apply(pressButton)};$('occupied').onclick=()=>apply(toggleOccupied);$('reservation').onclick=()=>apply(reservationDue);$('alarm').onclick=()=>apply(alarmDue);$('alarm-off').onclick=()=>apply(alarmOff);$('lift').onchange=e=>{state.liftAllowed=e.target.checked};
 function endJog(){if(!jog)return;const j=jog;jog=null;if(performance.now()-j.at<250){const lim=j.k==='head'?60:40;Object.assign(target,j.prev);target[j.k]=Math.max(0,Math.min(lim,Math.round(j.prev[j.k])+j.d*5));sync();state={...state,moveStart:{...current},note:'각도를 조절하고 있어요'};state.after='원하는 각도로 맞췄어요';render();return}Object.assign(target,current);state.after='';state.speech=`머리 ${Math.round(current.head)}도, 다리 ${Math.round(current.leg)}도에서 멈췄어요`;render()}
 document.querySelectorAll('[data-jog]').forEach(b=>{b.onpointerdown=e=>{if(state.ringing)return;if(e.pointerId)b.setPointerCapture(e.pointerId);const[k,d]=b.dataset.jog.split(',');jog={k,d:+d,at:performance.now(),prev:{...target}};sync();state.pending=null;state.after='';state.speech='';Object.assign(target,current)};b.onpointerup=endJog;b.onpointercancel=endJog;b.onkeydown=e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();b.onpointerdown({pointerId:0});}};b.onkeyup=endJog});window.addEventListener('blur',endJog);
 $('motor').checked=true;$('motor').onchange=e=>motorSound.setEnabled(e.target.checked);
 // 압력 센서(pressure.js)가 보드 없이 혼자 돌 때 눕기·나가기를 대신 누른다
 return {setOccupied(v){if(state.occupied!==v)apply(toggleOccupied)},ringing:()=>!!state.ringing,jogging:()=>!!jog,tick(dt){for(const k of ['head','leg'])if(barDrag!==k)$(k).value=target[k];if(jog){target[jog.k]=Math.max(0,Math.min(jog.k==='head'?60:40,current[jog.k]+jog.d*15*dt));}
 const active=moving()||!!jog;$('motion-status').textContent=state.ringing?'알람 울리는 중':active?'움직이는 중':'멈춤';motorSound.update(Math.abs(current.head-target.head)>.001,Math.abs(current.leg-target.leg)>.001);
 if(!active&&state.after){state.speech=state.after;state.after='';state.note='';render()}
 if(state.pending&&performance.now()-pendingAt>10000){state.pending=null;state.speech='';state.note='대답이 없어 제안을 마쳤어요';render()}
 }};
}
