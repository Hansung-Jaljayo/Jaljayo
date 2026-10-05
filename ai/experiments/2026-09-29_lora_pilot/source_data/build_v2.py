# 2차: 1차 검사에서 나온 문제를 고치고, 평가 항목에 필요한 일반 대화·지원하지 않는 요청 문장을 더한다
import json, re, sys
from collections import defaultdict
sys.path.insert(0, '..')
from spec_v01 import render
v1 = json.load(open('v1.json'))
rows = [tuple(r) for s in v1.values() for r in s]
log = defaultdict(int); fixed = []
for f, out, q in rows:
    q2 = re.sub(r'[.,?!~]', '', q).strip()
    if q2 != q: log['문장부호 제거'] += 1
    q3 = re.sub(r'^(\S+)\s+\1\s', r'\1 ', q2)
    if q3 != q2: log['같은 낱말 반복 정리'] += 1
    if f == '숫자 대답' and q3.endswith('이요'):
        log['모호한 숫자 대답 삭제'] += 1; continue
    if f == '질문 알람 미루기' and q3 == '조금만 더':
        log['조절과 겹치는 미루기 표현 삭제'] += 1; continue
    fixed.append((f, out, q3))
seen = set(); uniq = []
for r in fixed:
    if r in seen: log['중복 문장 삭제'] += 1; continue
    seen.add(r); uniq.append(r)
by_q = defaultdict(set)
for f, o, q in uniq: by_q[q].add(o)
bad = {q for q, o in by_q.items() if len(o) > 1}
uniq = [r for r in uniq if r[2] not in bad]; log['정답 충돌 문장 삭제'] += len(bad)
GEN = ['오늘 날씨 어때', '너 이름이 뭐야', '심심하다', '고마워', '오늘 너무 피곤했어', '배고프다', '좋은 아침', '오늘 하루 어땠어',
       '재밌는 얘기 해줘', '요즘 잠이 잘 안 와', '내일 뭐 입지', '너 몇 살이야', '노래 좋아해', '주말에 뭐 할까', '오늘 회사에서 힘들었어']
OOS = ['불 좀 꺼줘', '음악 틀어줘', '에어컨 켜줘', '티비 켜줘', '커튼 닫아줘', '온도 좀 올려줘', '전화 걸어줘', '문자 보내줘',
       '뉴스 틀어줘', '가습기 켜줘', '창문 열어줘', '라디오 켜줘', '택시 불러줘', '청소기 돌려줘', '조명 좀 어둡게 해줘']
for q in GEN: uniq.append(('일반 대화', render('General_Conversation', []), q))
for q in OOS: uniq.append(('지원하지 않는 요청', render('maum_3', [('reason', 'out_of_scope')]), q))
log['일반 대화 문장 추가'] = len(GEN); log['지원하지 않는 요청 문장 추가'] = len(OOS)
json.dump({'all': uniq}, open('v2_pool.json', 'w'), ensure_ascii=False, indent=0)
json.dump(dict(log), open('v2_fixlog.json', 'w'), ensure_ascii=False, indent=1)
print(dict(log), len(uniq))
