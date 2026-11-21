// 시연용 예시: 사용자가 하는 말과 22차 모델이 내야 하는 출력(규격 v09).
// 대표 장면은 22차 6에폭이 같은 원문을 낸 채점 기록이 있는 것(11/16 확인). 5번은 6번을 보이기 위한 준비 단계
// 원본: ward-1115/preview/gen_commands.py 로 가정용 commands.js 와 병상용 commands.ts 를 같이 만든다
export const SCENES = [
  { group: '바로 움직이기', heard: '등을 사십 도로 맞춰 줘', output: '<maum_0>(command=adjust, part=head, direction=none, amount=40, amount_type=target, confirm=no)<maum_end>', hint: '' },
  { group: '물으면 답하기', heard: '책 좀 읽을래', output: '<maum_0>(command=call, purpose=read, confirm=yes)<maum_end>', hint: '침대가 먼저 물어요' },
  { group: '물으면 답하기', heard: '네가 말한 대로 해 줘', output: '<maum_2>(type=yes, value=none)<maum_end>', hint: '2번 질문에 대답' },
  { group: '예약·알람', heard: '티비 자세로 예약할게 시간은 십 분 뒤야', output: '<maum_0>(command=reserve, purpose=tv, date=none, ampm=none, time=00:10, time_type=relative, confirm=no)<maum_end>', hint: '기기 탭 「예약 시각이 됨」으로 이어서' },
  { group: '예약·알람', heard: '내일 아침 아홉 시 삼십삼 분에 깨워 줘', output: '<maum_1>(command=set, date=tomorrow, ampm=am, time=09:33, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>', hint: '6번 준비' },
  { group: '방금 한 말 고치기', heard: '삼십삼 분이 아니라 그냥 삼 분이요', output: '<maum_1>(command=change_time, target=09:33, target_ampm=am, target_days=none, date=none, ampm=am, time=09:03, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>', hint: '5번 알람을 고쳐요' },
  { group: '못 하는 말', heard: '불 좀 꺼', output: '<maum_3>(reason=out_of_scope)<maum_end>', hint: '' },
]
export const GROUPS = [
  { title: '바로 움직이기', items: [
    { heard: '머리 칠 도 올려 줘', output: '<maum_0>(command=adjust, part=head, direction=up, amount=7, amount_type=delta, confirm=no)<maum_end>' },
    { heard: '다리 삼 도 내려', output: '<maum_0>(command=adjust, part=leg, direction=down, amount=3, amount_type=delta, confirm=no)<maum_end>' },
    { heard: '조금만 더', output: '<maum_0>(command=adjust, part=none, direction=same, amount=small, amount_type=delta, confirm=no)<maum_end>' },
    { heard: '머리 끝까지 올려 줘', output: '<maum_0>(command=adjust, part=head, direction=up, amount=max, amount_type=target, confirm=no)<maum_end>' },
    { heard: '평평하게 해 줘', output: '<maum_0>(command=adjust, part=both, direction=none, amount=0, amount_type=target, confirm=no)<maum_end>' },
    { heard: '직전으로 돌아가', output: '<maum_0>(command=undo, confirm=no, part=none, destination=previous)<maum_end>' },
  ] },
  { title: '물으면 답하기', items: [
    { heard: '좀 쉬고 싶어', output: '<maum_0>(command=call, purpose=rest, confirm=yes)<maum_end>' },
    { heard: '이제 잘게', output: '<maum_0>(command=call, purpose=sleep, confirm=yes)<maum_end>' },
    { heard: '응', output: '<maum_2>(type=yes, value=none)<maum_end>' },
    { heard: '아니요 틀렸어요', output: '<maum_2>(type=no, value=none)<maum_end>' },
    { heard: '머리', output: '<maum_2>(type=part, value=head)<maum_end>' },
    { heard: '움직이지 마', output: '<maum_2>(type=reference, value=keep)<maum_end>' },
  ] },
  { title: '예약·알람', items: [
    { heard: '삼십분 뒤에 잘게', output: '<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative, confirm=yes)<maum_end>' },
    { heard: '예약 반 시간 늦춰', output: '<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=00:30, time_type=later, confirm=no)<maum_end>' },
    { heard: '자세 예약 취소해 줘', output: '<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>' },
    { heard: '내일 정오에 깨워 줘', output: '<maum_1>(command=set, date=tomorrow, ampm=pm, time=12:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>' },
  ] },
  { title: '자세 저장', items: [
    { heard: '티비 자세로 저장해', output: '<maum_0>(command=set_default, purpose=tv, confirm=no)<maum_end>' },
    { heard: '티비 자세 리셋해', output: '<maum_0>(command=reset_default, purpose=tv, to=factory, confirm=no)<maum_end>' },
    { heard: '모든 자세 초기화해', output: '<maum_0>(command=reset_default, purpose=all, to=factory, confirm=no)<maum_end>' },
  ] },
  { title: '못 하는 말', items: [
    { heard: '불 좀 꺼', output: '<maum_3>(reason=out_of_scope)<maum_end>' },
    { heard: '주스보다 그냥 과일이 좋더라고', output: '<General_Conversation>()<maum_end>' },
  ] },
]
