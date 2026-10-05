# v4 = v3 train에 직접 쓴 문장 31개 추가(미루기 10, 숫자 대답 15, 오후 알람 6). val은 v3 그대로
# 최종 평가 세트 30문장도 여기서 쓰고 학습 전에 고정한다. 기존 25문장은 개발 확인용(dev)으로만 쓴다
import json, os, sys, hashlib
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'spec'))  # 9/29 당시 규격 파일은 남아 있지 않아 현재 규격을 씀(README 참고)
from check import parse, norm
from spec import render
OLD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '2026-09-29_lora_pilot') + '/'; P = OLD + 'source_data/'
SN = lambda m: render('maum_1', [('command', 'snooze'), ('minutes', m)])
NUM = lambda v: render('maum_2', [('type', 'number'), ('value', v)])
AL = lambda d, ap, t, ty='none': render('maum_1', [('command', 'set'), ('date', d), ('ampm', ap), ('time', t), ('type', ty), ('repeat', 'none'), ('days', 'none')])
CALL = lambda p: render('maum_0', [('command', 'call'), ('purpose', p)])
ADJ = lambda pa, di, am, ty: render('maum_0', [('command', 'adjust'), ('part', pa), ('direction', di), ('amount', am), ('amount_type', ty)])
UNDO = render('maum_0', [('command', 'undo')]); GEN = render('General_Conversation', []); OOS = render('maum_3', [('reason', 'out_of_scope')])
ADD = [('질문 알람 미루기', SN(m), q) for q, m in [
 ('삼십 분 뒤에 깨워줘', '30'), ('알람 좀 미뤄줘', 'none'), ('이 분만 더', '2'), ('사십 분만 미뤄줘', '40'), ('잠깐만 더 잘게', 'none'),
 ('칠 분 후에 다시 울려줘', '7'), ('오 분만 봐줘', '5'), ('이십오 분 뒤에 다시', '25'), ('아직 못 일어나겠어', 'none'), ('한 시간만 더 잘래', '60')]] + \
 [('숫자 대답', NUM(v), q) for q, v in [
 ('스물다섯', '25'), ('답은 사십일', '41'), ('쉰둘이요', '52'), ('음 칠십구요', '79'), ('이십삼이야', '23'), ('팔십', '80'), ('서른여섯', '36'),
 ('그거 오십팔', '58'), ('구십구요', '99'), ('십구', '19'), ('육십칠인 것 같아', '67'), ('아마 삼십', '30'), ('마흔넷', '44'), ('일흔', '70'), ('열여덟이요', '18')]] + \
 [('알람 설정', AL(*a), q) for q, a in [
 ('오후 세 시에 알람 맞춰줘', ('none', 'pm', '03:00')), ('오후 네 시 반 깨워줘', ('none', 'pm', '04:30')), ('저녁 여섯 시에 알람 해줘', ('none', 'pm', '06:00')),
 ('내일 오후 한 시에 깨워줘', ('tomorrow', 'pm', '01:00')), ('오후 다섯 시에 질문 알람으로 맞춰줘', ('none', 'pm', '05:00', 'question')), ('밤 열 시에 알람 울려줘', ('none', 'pm', '10:00'))]]
FINAL = [('목적 자세 부르기', CALL('tv'), '누워서 티비 볼래'), ('목적 자세 부르기', CALL('sleep'), '잘 준비 해줘'),
 ('목적 자세 부르기', CALL('read'), '책 읽을 자세 만들어 줘'), ('목적 자세 부르기', CALL('rest'), '편하게 쉬는 자세로'),
 ('자세 조절', ADJ('head', 'up', '20', 'delta'), '머리 쪽 이십 도 올려줘'), ('자세 조절', ADJ('leg', 'up', 'none', 'none'), '다리 쪽 조금 올려줘'),
 ('자세 조절', ADJ('head', 'down', '30', 'target'), '상체 삼십 도로 내려줘'), ('자세 조절', ADJ('leg', 'down', '10', 'delta'), '발 쪽 십 도 낮춰줘'),
 ('되돌리기', UNDO, '이전 자세로 돌려줘'), ('되돌리기', UNDO, '아까대로 해줘'),
 ('알람 설정', AL('none', 'pm', '07:00'), '오후 일곱 시에 알람 맞춰줘'), ('알람 설정', AL('tomorrow', 'pm', '02:30'), '내일 오후 두 시 반 알람 해줘'),
 ('알람 설정', AL('none', 'pm', '09:00'), '저녁 아홉 시에 깨워줘'), ('알람 설정', AL('tomorrow', 'am', '08:00'), '내일 오전 여덟 시에 알람 맞춰줘'),
 ('알람 설정', AL('none', 'none', '05:30', 'leave_bed'), '다섯 시 반에 침대에서 나와야 꺼지는 알람으로 깨워줘'),
 ('질문 알람 미루기', SN('8'), '팔 분만 더 잘게'), ('질문 알람 미루기', SN('30'), '삼십 분 있다 다시 울려줘'),
 ('질문 알람 미루기', SN('none'), '조금만 이따 깨워줘'), ('질문 알람 미루기', SN('50'), '오십 분만 더'),
 ('숫자 대답', NUM('48'), '사십팔'), ('숫자 대답', NUM('27'), '스물일곱이요'), ('숫자 대답', NUM('63'), '음 육십삼'), ('숫자 대답', NUM('91'), '아흔하나'), ('숫자 대답', NUM('83'), '팔십삼이요'),
 ('일반 대화', GEN, '오늘 하루 길었다'), ('일반 대화', GEN, '너는 잠 안 자'), ('일반 대화', GEN, '내일 비 온대'),
 ('지원하지 않는 요청', OOS, '창문 좀 열어줘'), ('지원하지 않는 요청', OOS, '조명 밝게 해줘'), ('지원하지 않는 요청', OOS, '티비 채널 바꿔줘')]
v3 = json.load(open(P + 'v3.json')); v1 = json.load(open(P + 'v1.json'))
dev = [(e['func'], e['gold'], e['q']) for e in json.load(open(OLD + 'eval_frozen.json'))]
train4 = [tuple(x) for x in v3['train']] + ADD; val4 = [tuple(x) for x in v3['val']]
problems = [('형식', q, parse(o)) for f, o, q in ADD + FINAL if parse(o)]
def idx(rows, tag):
    d = {}
    for _, _, q in rows: d.setdefault(norm(q), []).append(f'{tag}:{q}')
    return d
seen = {}
for rows, tag in [(v1['train'], 'v1-train'), (v1['val'], 'v1-val'), (v3['train'], 'v3-train'), (v3['val'], 'v3-val'), (dev, 'dev')]:
    for k, v in idx(rows, tag).items(): seen.setdefault(k, []).extend(v)
problems += [('추가문장 겹침', q, seen[norm(q)]) for _, _, q in ADD if norm(q) in seen]
addn = idx(ADD, 'v4-add')
problems += [('최종평가 겹침', q, (seen.get(norm(q), []) + addn.get(norm(q), []))) for _, _, q in FINAL if norm(q) in seen or norm(q) in addn]
if len({norm(q) for *_, q in ADD}) != len(ADD) or len({norm(q) for *_, q in FINAL}) != len(FINAL): problems.append(('내부 중복', '', ''))
print('추가', len(ADD), '최종평가', len(FINAL), '문제', problems)
if not problems:
    PROMPT = json.load(open(OLD + 'data/summary.json'))['prompt']
    for rows, fn in [(train4, 'train'), (val4, 'valid')]:
        with open(f'data/v4/{fn}.jsonl', 'w') as w:
            for _, o, q in rows: w.write(json.dumps({'text': PROMPT.format(q=q) + ' ' + o}, ensure_ascii=False) + '\n')
    json.dump({'train': train4, 'val': val4, 'added': ADD}, open('data/v4.json', 'w'), ensure_ascii=False, indent=1)
    json.dump([{'func': f, 'gold': o, 'q': q} for f, o, q in FINAL], open('final_eval_frozen.json', 'w'), ensure_ascii=False, indent=1)
    print('train', len(train4), 'val', len(val4), 'sha256', hashlib.sha256(open('final_eval_frozen.json', 'rb').read()).hexdigest())
