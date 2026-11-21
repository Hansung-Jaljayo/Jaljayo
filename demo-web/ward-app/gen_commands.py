# 가정용 commands.js 와 병상용 commands.ts 를 같은 내용으로 만든다
import os
W=os.path.dirname(os.path.abspath(__file__))   # demo-web/ward-app
S=os.path.dirname(W)                           # demo-web
A=lambda part,dir_,amt,typ,conf='no':f'<maum_0>(command=adjust, part={part}, direction={dir_}, amount={amt}, amount_type={typ}, confirm={conf})<maum_end>'
CALL=lambda p,c:f'<maum_0>(command=call, purpose={p}, confirm={c})<maum_end>'
SCENES=[
 ('바로 움직이기','등을 사십 도로 맞춰 줘',A('head','none',40,'target'),''),
 ('물으면 답하기','책 좀 읽을래',CALL('read','yes'),'침대가 먼저 물어요'),
 ('물으면 답하기','네가 말한 대로 해 줘','<maum_2>(type=yes, value=none)<maum_end>','2번 질문에 대답'),
 ('예약·알람','티비 자세로 예약할게 시간은 십 분 뒤야','<maum_0>(command=reserve, purpose=tv, date=none, ampm=none, time=00:10, time_type=relative, confirm=no)<maum_end>','기기 탭 「예약 시각이 됨」으로 이어서'),
 ('예약·알람','내일 아침 아홉 시 삼십삼 분에 깨워 줘','<maum_1>(command=set, date=tomorrow, ampm=am, time=09:33, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>','6번 준비'),
 ('방금 한 말 고치기','삼십삼 분이 아니라 그냥 삼 분이요','<maum_1>(command=change_time, target=09:33, target_ampm=am, target_days=none, date=none, ampm=am, time=09:03, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>','5번 알람을 고쳐요'),
 ('못 하는 말','불 좀 꺼','<maum_3>(reason=out_of_scope)<maum_end>',''),
]
GROUPS=[
 ('바로 움직이기',[('머리 칠 도 올려 줘',A('head','up',7,'delta')),('다리 삼 도 내려',A('leg','down',3,'delta')),('조금만 더',A('none','same','small','delta')),
   ('머리 끝까지 올려 줘',A('head','up','max','target')),('평평하게 해 줘',A('both','none',0,'target')),('직전으로 돌아가',  '<maum_0>(command=undo, confirm=no, part=none, destination=previous)<maum_end>')]),
 ('물으면 답하기',[('좀 쉬고 싶어',CALL('rest','yes')),('이제 잘게',CALL('sleep','yes')),('응','<maum_2>(type=yes, value=none)<maum_end>'),
   ('아니요 틀렸어요','<maum_2>(type=no, value=none)<maum_end>'),('머리',  '<maum_2>(type=part, value=head)<maum_end>'),('움직이지 마','<maum_2>(type=reference, value=keep)<maum_end>')]),
 ('예약·알람',[('삼십분 뒤에 잘게','<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative, confirm=yes)<maum_end>'),
   ('예약 반 시간 늦춰','<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=00:30, time_type=later, confirm=no)<maum_end>'),
   ('자세 예약 취소해 줘','<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>'),
   ('내일 정오에 깨워 줘','<maum_1>(command=set, date=tomorrow, ampm=pm, time=12:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>')]),
 ('자세 저장',[('티비 자세로 저장해','<maum_0>(command=set_default, purpose=tv, confirm=no)<maum_end>'),('티비 자세 리셋해','<maum_0>(command=reset_default, purpose=tv, to=factory, confirm=no)<maum_end>'),('모든 자세 초기화해','<maum_0>(command=reset_default, purpose=all, to=factory, confirm=no)<maum_end>')]),
 ('못 하는 말',[('불 좀 꺼','<maum_3>(reason=out_of_scope)<maum_end>'),('주스보다 그냥 과일이 좋더라고','<General_Conversation>()<maum_end>')]),
]
YES='<maum_2>(type=yes, value=none)<maum_end>'
SA=lambda h,l:f'<maum_0>(command=set_angles, purpose=none, head={h}, leg={l}, confirm=no)<maum_end>'
RES30='<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative, confirm=yes)<maum_end>'
NOON='<maum_1>(command=set, date=tomorrow, ampm=pm, time=12:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>'
# 병상용 대표 장면: 침대마다 다르다(101 각도, 102 자세·확인·예약, 103 알람·못 하는 말). 위 칸에서 부른 침대의 목록이 보인다
WARD=[
 [('다리 올리기','다리 올려',A('leg','up','none','none'),''),
  ('머리·다리 같이','머리랑 다리 올려',A('both','up','none','none'),''),
  ('두 각도 한 번에','삼십 이십 해줘',SA(30,20),'머리 30도 · 다리 20도'),
  ('머리·다리 같이','머리 다리 삼십오 도로 해',A('both','none',35,'target'),''),
  ('다리 내리기','다리 이십일 도 내려 줘',A('leg','down',21,'delta'),''),
  ('이어 말하기','다리 조금 내려줘',A('leg','down','small','delta'),''),
  ('이어 말하기','다리 조금만 더',A('leg','same','small','delta'),'6번과 같은 쪽으로')],
 [('자세 부르기','티비 자세 해',CALL('tv','no'),''),
  ('자세 부르기','휴식 자세 해줘',CALL('rest','no'),''),
  ('물으면 답하기','책 보면서 쉬고 싶어',CALL('read','yes'),'침대가 먼저 물어요'),
  ('물으면 답하기','응',YES,'3번 질문에 대답'),
  ('물으면 답하기','이제 잠잘래',CALL('sleep','yes'),'예·아니오로 대답'),
  ('예약','삼십분 뒤에 잘게','<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative, confirm=yes)<maum_end>','먼저 물어요 · 기기 탭에서 이어서'),
  ('예약','티비 자세로 예약할게 시간은 십 분 뒤야','<maum_0>(command=reserve, purpose=tv, date=none, ampm=none, time=00:10, time_type=relative, confirm=no)<maum_end>','')],
 [('머리 올리기','머리 삼십 도 올려 줘',A('head','up',30,'delta'),''),
  ('평평하게','평평하게 해 줘',A('both','none',0,'target'),''),
  ('알람','내일 아침 아홉 시 삼십삼 분에 깨워 줘','<maum_1>(command=set, date=tomorrow, ampm=am, time=09:33, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>','4번 준비'),
  ('방금 한 말 고치기','삼십삼 분이 아니라 그냥 삼 분이요','<maum_1>(command=change_time, target=09:33, target_ampm=am, target_days=none, date=none, ampm=am, time=09:03, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>','3번 알람을 고쳐요'),
  ('알람','내일 정오에 깨워 줘','<maum_1>(command=set, date=tomorrow, ampm=pm, time=12:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>',''),
  ('못 하는 말','불 좀 꺼','<maum_3>(reason=out_of_scope)<maum_end>','')],
]
# 「예시 더 보기」에 더하는 병상용 문장(22차 학습 데이터 정답)
WARD_EXTRA={'바로 움직이기':[('머리 삼십 도 올려 줘',A('head','up',30,'delta')),('머리 다리 삼십오 도로 해',A('both','none',35,'target')),
   ('다리 이십일 도 내려 줘',A('leg','down',21,'delta')),('다리 조금 내려줘',A('leg','down','small','delta')),('다리 조금만 더',A('leg','same','small','delta'))],
 '물으면 답하기':[('이제 잠잘래',CALL('sleep','yes'))],
 '예약·알람':[('티비 자세로 예약할게 시간은 십 분 뒤야','<maum_0>(command=reserve, purpose=tv, date=none, ampm=none, time=00:10, time_type=relative, confirm=no)<maum_end>'),
   ('내일 아침 아홉 시 삼십삼 분에 깨워 줘','<maum_1>(command=set, date=tomorrow, ampm=am, time=09:33, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>'),
   ('삼십삼 분이 아니라 그냥 삼 분이요','<maum_1>(command=change_time, target=09:33, target_ampm=am, target_days=none, date=none, ampm=am, time=09:03, time_type=absolute, scope=none, target_type=none, target_order=none, confirm=no)<maum_end>')]}
def q(s): return "'"+s.replace("'","\\'")+"'"
def body(ts):
    T=lambda t: t if ts else ''
    o=["// 시연용 예시: 사용자가 하는 말과 22차 모델이 내야 하는 출력(규격 v09).",
       "// 대표 장면은 22차 6에폭이 같은 원문을 낸 채점 기록이 있는 것(11/16 확인). 5번은 6번을 보이기 위한 준비 단계",
       "// 원본: ward-1115/preview/gen_commands.py 로 가정용 commands.js 와 병상용 commands.ts 를 같이 만든다"]
    if ts: o+=["export type Command = { heard: string; output: string; ask?: boolean; group?: string; hint?: string }","export type Group = { title: string; items: Command[] }"]
    o.append(f"export const SCENES{T(': Command[]')} = [")
    for g,h,out,hint in SCENES: o.append(f"  {{ group: {q(g)}, heard: {q(h)}, output: {q(out)}, hint: {q(hint)} }},")
    o.append("]")
    o.append(f"export const GROUPS{T(': Group[]')} = [")
    for t,items in GROUPS:
        o.append(f"  {{ title: {q(t)}, items: [")
        for h,out in items: o.append(f"    {{ heard: {q(h)}, output: {q(out)} }},")
        o.append("  ] },")
    o.append("]")
    if ts:
        o+=["// 병상용 이름 부르기(보드와 같은 두 단계): 이름만 부르면 그 침대가 \"네, ○○ 침대예요\"와 띠링으로 답하고 다음 말을 명령으로 받는다.",
            "// 이름 찾기는 보드가 소리로 하므로 언어 모델을 거치지 않는다. 수박은 이 병실에 없는 이름",
            "export const WARD_CALLS = ['사과 침대', '포도 침대', '딸기 침대', '수박 침대']",
            "// 병상용 대표 장면: 침대마다 다른 목록(부른 침대의 목록이 보인다). 문장과 출력은 22차 학습 데이터 정답 그대로",
            "export const WARD_SCENES: Command[][] = ["]
        for bed in WARD:
            o.append("  [")
            for g,h,out,hint in bed: o.append(f"    {{ group: {q(g)}, heard: {q(h)}, output: {q(out)}, hint: {q(hint)} }},")
            o.append("  ],")
        o.append("]")
        used=set()
        o.append("export const WARD_GROUPS: Group[] = [")
        for t,items in GROUPS:
            o.append(f"  {{ title: {q(t)}, items: [")
            for h,out in items+WARD_EXTRA.get(t,[]):
                if h not in used: o.append(f"    {{ heard: {q(h)}, output: {q(out)} }},")
            o.append("  ] },")
        o.append("]")
    return '\n'.join(o)+'\n'
import shutil
for path,ts in [(S+'/ward-app/src/commands.ts',True),(S+'/site/console/commands.js',False)]:
    import os
    b=path.replace('commands.','commands.before-rework.')
    if not os.path.exists(b): shutil.copy(path,b)
    open(path,'w').write(body(ts))
print('ok')
