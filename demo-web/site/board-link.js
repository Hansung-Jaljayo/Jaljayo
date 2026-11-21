// 이 화면을 침대 역할로 보드에 연결한다. 주소 뒤에 ?board=ws://보드주소:8765 를 붙이면 켜진다.
// 형식은 잘자요 저장소 docs/interfaces/board-link.md. 보드가 시키는 대로 움직이고, 현재 각도를 돌려준다.
export function initBoardLink({current,target}){
 const url=new URLSearchParams(location.search).get('board');
 // 압력 센서 표시(pressure.js)가 쓰는 통로. 보드 주소가 없으면 enabled가 false다
 const listeners=[];
 const api={enabled:!!url,open:()=>!!ws&&ws.readyState===1,send:o=>send(o),on:fn=>listeners.push(fn)};
 let ws=null,cmd=0,active=false,timer=0;
 const send=o=>{if(ws&&ws.readyState===1)ws.send(JSON.stringify(o))};
 if(!url)return api;
 const $=id=>document.getElementById(id);
 const dirOf=p=>Math.abs(target[p]-current[p])<=.001?'stop':target[p]>current[p]?'up':'down';
 const moving=()=>dirOf('head')!=='stop'||dirOf('leg')!=='stop';
 const round=v=>Math.round(v*10)/10;
 const report=result=>send({type:'bed-state',id:cmd,head:round(current.head),leg:round(current.leg),targetHead:target.head,targetLeg:target.leg,headMove:dirOf('head'),legMove:dirOf('leg'),result});
 // 연결된 동안에는 화면 자체 조작을 잠근다. 멈춤 버튼만 침대 버튼으로 보드에 보낸다
 function lock(on){
  document.body.classList.toggle('board-linked',on);
  document.querySelectorAll('#head,#leg,[data-purpose],[data-jog],#talk-groups button,#talk-items button,#confirm-yes,#confirm-no,#occupied,#reservation,#alarm').forEach(b=>{b.disabled=on});
 }
 $('stop').addEventListener('click',e=>{if(!ws||ws.readyState!==1)return;e.stopImmediatePropagation();send({type:'button'})},true);
 function apply(m){
  if(m.type==='bed-move'){cmd=m.id;target.head=m.head;target.leg=m.leg;if(m.snap){current.head=m.head;current.leg=m.leg;report(null)}else active=true;$('head').value=m.head;$('leg').value=m.leg}
  else if(m.type==='bed-stop'){cmd=m.id;target.head=current.head;target.leg=current.leg;active=false;report('stopped')}
  else if(m.type==='turn'){if(m.heard)$('heard').textContent=m.heard;if(m.say)$('reply').textContent=m.say;if(m.output)$('model-output').textContent=m.output}
  else if(m.type==='speech'){$('reply').textContent=m.say}
  else if(m.type==='state'){const w=Array.isArray(m.ward)?`   /   병실 · ${m.ward.map(b=>`${b.active?'▶':''}${b.name} ${b.head}°/${b.leg}°${b.moving?'…':''}`).join(' · ')}`:'';$('device-state').textContent=`예약 · ${m.reservation?.label||'없음'}   /   알람 · ${m.ringing?'울리는 중':m.alarms?.[0]?.label||'없음'}${w}`}  // 11/14 병원 시연: 3D 침대는 지금 부른 침대(▶), 침대 3대 각도는 이 줄에
 }
 function connect(){
  ws=new WebSocket(url);
  ws.onopen=()=>{send({type:'hello',role:'bed'});send({type:'time',epochMs:Date.now()});lock(true);report(null)};
  ws.onmessage=e=>{try{const m=JSON.parse(e.data);apply(m);listeners.forEach(fn=>fn(m))}catch(err){console.warn('보드 글 해석 실패',err)}};
  ws.onclose=()=>{lock(false);active=false;setTimeout(connect,2000)};
 }
 timer=setInterval(()=>{if(!active)return;if(moving())report(null);else{active=false;report('arrived')}},200);
 connect();
 return api;
}
