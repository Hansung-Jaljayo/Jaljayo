// 각도 막대의 채워진 부분(흰색)을 현재 값에 맞춘다. 값은 버튼·음성으로도 바뀌므로 매 프레임 확인한다
(function tick(){
  document.querySelectorAll('.console input[type=range]').forEach(function(r){
    var p=((+r.value-(+r.min||0))/((+r.max||100)-(+r.min||0))*100).toFixed(1)+'%';
    if(r.style.getPropertyValue('--p')!==p)r.style.setProperty('--p',p);
  });
  requestAnimationFrame(tick);
})();
