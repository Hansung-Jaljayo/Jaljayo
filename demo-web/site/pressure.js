// 압력 센서 표시. 센서 값(0~1023)을 막대로 보여 주고, 기준선을 넘으면 "사람 있음"으로 본다.
// 값이 오는 길은 두 가지다.
//   실제 센서: 맥에서 도는 sensor_bridge.py가 http://127.0.0.1:8772/events 로 흘려 준다(?sensor=주소 로 바꿀 수 있다)
//   가상 센서: V 키로 켜고 1(없음)·2(가벼운 물건)·3(사람 무게)으로 값을 넣는다. 화면에 "가상 센서"라고 적힌다
// 보드에 연결돼 있으면 값을 보드로 보내고, 3초 판정과 알람 해제는 보드가 알려 준 대로만 보여 준다.
// 보드 주소 없이 혼자 돌 때는 화면이 3초를 세어 흉내 낸다.
export function initPressure({remote,link}){
 const $=id=>document.getElementById(id),q=new URLSearchParams(location.search);
 const MAX=1023,NEED=3000,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
 let line=clamp(Number(q.get('line'))||Number(store.get('pressure-line'))||300,20,1000);
 let real=null,realAt=0,virtual=false,vTarget=0,vValue=0;
 let occupied=null,board=null,boardAt=0,released=0,localEmptySince=null,shown=q.has('pressure'),n=0;

 try{const es=new EventSource(q.get('sensor')||'http://127.0.0.1:8772/events');es.onmessage=e=>{try{const m=JSON.parse(e.data);if(typeof m.value==='number'){real=clamp(m.value,0,MAX);realAt=performance.now()}}catch{}}}catch{}

 link.on(m=>{
  if(m.type==='state'){board=m;boardAt=performance.now()}
  else if(m.type==='turn'&&String(m.output||'').startsWith('압력 센서'))released=performance.now()+8000;
 });

 addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||e.repeat)return;
  const t=e.target;if(t&&(t.tagName==='TEXTAREA'||(t.tagName==='INPUT'&&t.type==='text')))return;
  if(e.code==='KeyV'){virtual=!virtual;vTarget=vValue=0;shown=true}
  else if(e.code==='BracketLeft'||e.code==='BracketRight'){line=clamp(line+(e.code==='BracketRight'?20:-20),20,1000);store.set('pressure-line',line)}
  else if(virtual&&e.code==='Digit1')vTarget=0;
  else if(virtual&&e.code==='Digit2')vTarget=Math.round(line*.4);
  else if(virtual&&e.code==='Digit3')vTarget=Math.min(1000,Math.max(Math.round(line*2.2),line+150));
 });

 function step(){
  const now=performance.now();n++;
  const src=virtual?'virtual':real!=null&&now-realAt<1000?'real':null;
  let value=null;
  if(src==='virtual'){vValue+=(vTarget-vValue)*.4;if(Math.abs(vTarget-vValue)<2)vValue=vTarget;value=Math.round(vValue)}
  else if(src==='real')value=real;
  occupied=value==null?null:value>=line;
  if(src)shown=true;

  const linked=link.enabled&&link.open();
  if(linked&&src&&n%2===0)link.send({type:'sensor',occupied,value,virtual:src==='virtual'});

  // 판정: 보드에 연결돼 있으면 보드가 알려 준 값, 아니면 화면이 센 값
  let judged=null,countMs=null,ringing=false,leave=false;
  if(link.enabled){
   if(linked&&board){
    const s=board.sensor||{};judged=s.occupied??null;
    countMs=s.emptyMs==null?null:s.emptyMs+(now-boardAt);
    ringing=!!board.ringing;leave=board.ringingType==='leave_bed';
    if(judged!=null)shown=true;
   }
   localEmptySince=null;
  }else if(src){
   ringing=remote.ringing();leave=ringing;
   if(occupied){localEmptySince=null;remote.setOccupied(true)}
   else if(!ringing){localEmptySince=null;remote.setOccupied(false)}
   else{
    localEmptySince??=now;
    if(now-localEmptySince>=NEED){localEmptySince=null;remote.setOccupied(false);released=now+8000;ringing=leave=false}
   }
   judged=occupied;countMs=localEmptySince==null?null:now-localEmptySince;
  }else localEmptySince=null;

  const counting=judged===false&&countMs!=null;
  $('pressure').hidden=!shown;
  $('pressure-source').textContent=(src==='real'?'실제 센서':src==='virtual'?'가상 센서 · 키보드':'센서 없음')+' / '+(link.enabled?(linked?'보드 판정':'보드 끊김'):'보드 없이 화면만');
  $('pressure-fill').style.width=(value==null?0:value/MAX*100)+'%';
  $('pressure-fill').classList.toggle('over',occupied===true);
  $('pressure-line').style.left=line/MAX*100+'%';
  $('pressure-value').textContent=value==null?'없음':value;
  $('pressure-line-value').textContent=line;
  const st=$('pressure-state');
  st.textContent=link.enabled&&!linked?'보드 연결을 기다리는 중':judged==null?'센서 값 기다리는 중':judged?'사람 있음':counting?`확인 중 ${Math.min(3,Math.floor(countMs/1000)+1)}`:'비었음';
  st.dataset.kind=judged==null?'none':judged?'on':counting?'count':'off';
  $('pf-lying').style.opacity=judged===true?1:counting?.35:0;
  $('pf-standing').style.opacity=judged===false&&!counting?1:0;
  const al=$('pressure-alarm');
  al.textContent=ringing?(leave?'알람 울리는 중 · 침대에서 나와야 꺼져요':'알람 울리는 중'):now<released?'알람 해제':'';
  al.dataset.kind=ringing?'ring':now<released?'done':'';
  $('pressure-keys').hidden=!virtual;
 }
 setInterval(step,100);step();
}
