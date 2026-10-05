# 공통 평가 문장 25개. 사람이 직접 쓴 문장이며 빌드 템플릿에서 만들지 않았다
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'spec'))  # 9/29 당시 규격 파일은 남아 있지 않아 현재 규격을 씀(README 참고)
from check import parse, norm
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'source_data') + '/'
E = [
 ('목적 자세 부르기', '<maum_0>(command=call, purpose=tv)<maum_end>', '드라마 보기 편하게 해줘'),
 ('목적 자세 부르기', '<maum_0>(command=call, purpose=sleep)<maum_end>', '이제 자려고 누울게'),
 ('목적 자세 부르기', '<maum_0>(command=call, purpose=read)<maum_end>', '독서 자세 부탁해'),
 ('목적 자세 부르기', '<maum_0>(command=call, purpose=rest)<maum_end>', '좀 쉬게 편한 자세로 바꿔줘'),
 ('자세 조절', '<maum_0>(command=adjust, part=head, direction=up, amount=15, amount_type=delta)<maum_end>', '등 쪽 십오 도만 더 세워줘'),
 ('자세 조절', '<maum_0>(command=adjust, part=leg, direction=up, amount=10, amount_type=delta)<maum_end>', '다리 쪽 십 도 높여줘'),
 ('자세 조절', '<maum_0>(command=adjust, part=head, direction=down, amount=none, amount_type=none)<maum_end>', '머리 쪽 살짝 눕혀줘'),
 ('자세 조절', '<maum_0>(command=adjust, part=leg, direction=down, amount=30, amount_type=target)<maum_end>', '다리 삼십 도로 맞춰서 내려줘'),
 ('자세 조절', '<maum_0>(command=adjust, part=head, direction=up, amount=40, amount_type=target)<maum_end>', '상체 사십 도로 올려줘'),
 ('되돌리기', '<maum_0>(command=undo)<maum_end>', '바꾸기 전 자세로 되돌려 줘'),
 ('되돌리기', '<maum_0>(command=undo)<maum_end>', '조금 전 자세로 되돌려'),
 ('알람 설정', '<maum_1>(command=set, date=tomorrow, ampm=am, time=06:30, type=none, repeat=none, days=none)<maum_end>', '내일 아침 여섯 시 반에 알람 울려줘'),
 ('알람 설정', '<maum_1>(command=set, date=none, ampm=pm, time=02:00, type=none, repeat=none, days=none)<maum_end>', '오후 두 시에 깨워 줄래'),
 ('알람 설정', '<maum_1>(command=set, date=tomorrow, ampm=none, time=08:00, type=question, repeat=none, days=none)<maum_end>', '내일 여덟 시에 질문 알람으로 깨워줘'),
 ('알람 설정', '<maum_1>(command=set, date=none, ampm=am, time=10:30, type=leave_bed, repeat=none, days=none)<maum_end>', '오전 열 시 반에 침대에서 나와야 꺼지는 알람 맞춰줘'),
 ('질문 알람 미루기', '<maum_1>(command=snooze, minutes=20)<maum_end>', '이십 분만 더 잘래'),
 ('질문 알람 미루기', '<maum_1>(command=snooze, minutes=10)<maum_end>', '십 분 있다가 다시 깨워'),
 ('질문 알람 미루기', '<maum_1>(command=snooze, minutes=none)<maum_end>', '조금만 더 누워 있을게'),
 ('숫자 대답', '<maum_2>(type=number, value=37)<maum_end>', '삼십칠'),
 ('숫자 대답', '<maum_2>(type=number, value=62)<maum_end>', '육십이요'),
 ('숫자 대답', '<maum_2>(type=number, value=90)<maum_end>', '음 구십'),
 ('일반 대화', '<General_Conversation>()<maum_end>', '오늘 좀 피곤했어'),
 ('일반 대화', '<General_Conversation>()<maum_end>', '재미있는 얘기 해줘'),
 ('지원하지 않는 요청', '<maum_3>(reason=out_of_scope)<maum_end>', '커튼 좀 쳐줘'),
 ('지원하지 않는 요청', '<maum_3>(reason=out_of_scope)<maum_end>', '에어컨 틀어줘'),
]
bad = [(q, parse(o)) for f, o, q in E if parse(o)]
seen = {}
for tag, f in [('v1', 'v1.json'), ('v3', 'v3.json')]:
    d = json.load(open(P + f))
    for s in ('train', 'val'):
        for _, _, q in d[s]:
            seen.setdefault(norm(q), []).append(f'{tag}-{s}:{q}')
ov = [(q, seen[norm(q)]) for _, _, q in E if norm(q) in seen]
dup = len({norm(q) for _, _, q in E}) != len(E)
print('items', len(E), 'format errors', bad, 'overlaps', ov, 'internal dup', dup)
if not bad and not ov and not dup:
    json.dump([{'func': f, 'gold': o, 'q': q} for f, o, q in E], open('eval_frozen.json', 'w'), ensure_ascii=False, indent=1)
    print('frozen')
