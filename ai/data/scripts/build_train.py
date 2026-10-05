# 학습 데이터를 만든다. 문장 틀과 낱말 목록을 섞어 명령마다 문장을 만들고, 평가용 문장과 겹치는 것은 뺀다
# 실행하면 train.json(학습), dev.json(개발용 평가 = 대표 문장), final.json(최종 평가 = 실제 사용자 문장), split.md(요약)를 새로 만든다
# 생성 파일은 직접 고치지 않는다. 문장 틀이나 낱말을 바꿀 때는 이 파일을 고치고 다시 실행한다
# 기준: ai/spec/spec.py(정답 모양), docs/system-design.md(뜻), docs/interfaces/stt-to-model-text.md(숫자는 한글)
import json, os, random, re, sys
from collections import Counter, defaultdict
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_rep import out, P, A, R, OUT
from check import parse, norm

random.seed(20261003)
G = out('General_Conversation')

# ---------- 숫자 읽기 ----------
SINO = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
def sino(n):
    if n == 0: return '영'
    s = ''
    if n >= 100: s += ('' if n // 100 == 1 else SINO[n // 100]) + '백'; n %= 100
    if n >= 10: s += ('' if n // 10 == 1 else SINO[n // 10]) + '십'; n %= 10
    if n: s += SINO[n]
    return s
NATIVE_H = {1: '한', 2: '두', 3: '세', 4: '네', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉', 10: '열', 11: '열한', 12: '열두'}
NATIVE_HR = {**NATIVE_H, 24: '스물네'}  # 기간 "N시간"

def pick(xs): return random.choice(xs)
_TENS = {1: '열', 2: '스물', 3: '서른', 4: '마흔', 5: '쉰', 6: '예순', 7: '일흔', 8: '여든', 9: '아흔'}
_ONES = {1: '하나', 2: '둘', 3: '셋', 4: '넷', 5: '다섯', 6: '여섯', 7: '일곱', 8: '여덟', 9: '아홉'}
def native(n):  # 고유어 숫자(10에서 99). 스물셋, 마흔여덟
    t, o = divmod(n, 10); return _TENS[t] + _ONES.get(o, '')
def _bat(w):  # 마지막 글자의 받침 번호(없으면 0)
    c = ord(w.rstrip()[-1]) - 0xAC00
    return c % 28 if 0 <= c < 11172 else 0
def ro(w): return w + ('로' if _bat(w) in (0, 8) else '으로')   # 받침 없거나 ㄹ이면 로
def eun(w): return w + ('은' if _bat(w) else '는')
def sp(a, b):  # 숫자와 단위 사이 띄어쓰기를 섞는다(띄어쓰기 변형)
    return a + (' ' if random.random() < .6 else '') + b

# ---------- 시각과 기간 ----------
AMPM_WORDS = {'am': [('오전', range(5, 12)), ('아침', range(5, 11)), ('새벽', range(3, 7))],
              'pm': [('오후', range(1, 7)), ('저녁', range(5, 10)), ('밤', range(8, 12))]}
MINUTES = [(0, ''), (30, '반'), (10, '십 분'), (15, '십오 분'), (20, '이십 분'), (40, '사십 분'), (45, '사십오 분'), (5, '오 분')]
def clock(with_ampm=None, allow24=True):
    """(말, ampm 값, HH:MM) 하나를 만든다. with_ampm: True면 반드시, False면 없이, None이면 섞어서"""
    use = with_ampm if with_ampm is not None else random.random() < .5
    if use:
        ap = pick(['am', 'pm']); word, hours = pick(AMPM_WORDS[ap]); h = pick(list(hours)); pre = word + ' '
    else:
        ap = 'none'; pre = ''
        h = pick(list(range(1, 13)) * 3 + ([13, 15, 18, 20, 22, 23] if allow24 else []))
    m, mw = pick(MINUTES[:4] * 2 + MINUTES[4:])
    if h <= 12: hw = sp(NATIVE_H[h], '시')
    else: hw = sp(pick([sino(h), {13: '열세', 15: '열다섯', 18: '열여덟', 20: '스무', 22: '스물두', 23: '스물세'}[h]]), '시')
    text = pre + hw + ((' ' + mw) if mw else '')
    return text, ap, f'{h:02d}:{m:02d}'
DURS = [('삼십 분', '00:30'), ('이십 분', '00:20'), ('십 분', '00:10'), ('십오 분', '00:15'), ('사십 분', '00:40'), ('오 분', '00:05'),
        ('한 시간', '01:00'), ('두 시간', '02:00'), ('한 시간 반', '01:30'), ('세 시간', '03:00'), ('사십오 분', '00:45'), ('일곱 시간', '07:00')]
def dur():
    w, v = pick(DURS); return w.replace(' ', '') if random.random() < .3 else w, v

# ---------- 날짜 ----------
WEEKDAY = [('월요일', 'mon'), ('화요일', 'tue'), ('수요일', 'wed'), ('목요일', 'thu'), ('금요일', 'fri'), ('토요일', 'sat'), ('일요일', 'sun')]
def date_expr(kinds=('today', 'tomorrow', 'plus', 'week', 'next', 'md', 'd')):
    k = pick(kinds)
    if k == 'today': return '오늘', 'today'
    if k == 'tomorrow': return pick(['내일', '낼']), 'tomorrow'
    if k == 'plus':
        n = pick([2, 2, 3, 4, 5, 7]); w = {2: '모레', 3: '글피'}.get(n) if random.random() < .6 else None
        return (w or sp(sino(n), '일 뒤')), f'+{n}'
    if k == 'week': w, v = pick(WEEKDAY); return pick(['', '이번 주 ']) + w, v
    if k == 'next': w, v = pick(WEEKDAY); return pick(['다음 주 ', '담주 ']) + w, 'next_' + v
    if k == 'md':
        mo = random.randint(1, 12); d = random.randint(1, 28)
        mw = {6: '유월', 10: '시월'}.get(mo, sino(mo) + '월')
        return f'{mw} {sp(sino(d), "일")}', f'{mo:02d}-{d:02d}'
    d = random.randint(1, 31); return sp(sino(d), '일'), f'D{d}'
DAYS_EXPR = [('매일', 'daily'), ('날마다', 'daily'), ('평일', 'weekdays'), ('평일마다', 'weekdays'), ('주말', 'weekend'), ('주말마다', 'weekend'),
             ('월요일 수요일마다', 'mon+wed'), ('월수금', 'mon+wed+fri'), ('화목', 'tue+thu'), ('토요일마다', 'sat'), ('매주 월요일', 'mon')]

# ---------- 낱말 ----------
PURPOSE_W = {'read': ['책', '독서', '책 읽는', '책 볼'], 'tv': ['티비', '테레비', '텔레비전', '티브이'], 'rest': ['휴식', '쉬는'],
             'sleep': ['잠', '수면', '자는'], 'base': ['기본', '늘 하던', '평소']}
PART_W = {'head': ['머리', '등', '상체', '머리 쪽', '위쪽', '어깨', '허리'], 'leg': ['다리', '발', '종아리', '다리 쪽', '아래쪽', '무릎']}
UP_W = ['올려', '올려 줘', '올려줘', '세워', '세워 줘', '들어', '높여', '올려 주세요', '올려라', '올려봐']
DOWN_W = ['내려', '내려 줘', '내려줘', '낮춰', '낮춰 줘', '내려 주세요', '내려라', '내려봐']  # 눕혀는 잠 자세 부르기라 넣지 않음
PRE = ['', '', '', '', '야 ', '저기 ', '음 ', '아 ', '침대야 ', '좀 ']
def pre(): return pick(PRE)

# ---------- 명령별 만들기 ----------
def gen_call():
    rows = []
    T = {'read': ['{p} 자세로 해 줘', '{p} 자세', '책 좀 읽을래', '책 읽을 거야', '책 볼래', '독서할래', '책 읽게 맞춰 줘', '책 읽기 좋게 해 주세요', '나 책 볼 거야', '독서 모드', '책 읽을게요', '소설 좀 읽을래'],
         'tv': ['{p} 자세로 해 줘', '{p} 볼래', '{p} 볼 거야', '{p} 볼게', '영화 볼래', '드라마 볼 거야', '뉴스 볼래', '축구 볼 거야', '유튜브 볼래', '티비 보게 맞춰 줘', '영화 보기 좋게 해 주세요', '예능 볼랜다'],
         'rest': ['{p} 자세로 해 줘', '쉴래', '좀 쉬고 싶어', '쉬는 자세 해 줘', '휴식 모드', '편하게 기댈래', '좀 쉬자', '쉬게 해 주세요', '기대서 쉴래', '쉬어 보자'],
         'sleep': ['{p} 자세로 해 줘', '잘래', '이제 잘게', '잘게요', '자야겠다', '눕혀 줘', '잘 준비할게', '수면 모드', '나 잔다', '이제 잘 거야', '꿈나라 갈래', '잘 시간이야'],
         'base': ['기본으로 가자', '기본 자세로 해 줘', '늘 하던 그 자세', '평소 자세로 해 줘', '기본 자세', '야 기본', '늘 쓰던 자세로', '기본 자세로 돌려 줘', '기본으로 해 주세요']}
    for p, ts in T.items():
        for t in ts:
            for _ in range(3):
                q = pre() + t.format(p=pick(PURPOSE_W[p]))
                rows.append((q, P('call', purpose=p)))
    return rows

def gen_adjust():
    rows = []
    for _ in range(260):
        part = pick(['head', 'leg', 'none', 'none']); pw = (pick(PART_W[part]) + ' ') if part != 'none' else ''
        d = pick(['up', 'down']); vw = pick(UP_W if d == 'up' else DOWN_W)
        kind = pick(['plain', 'plain', 'delta', 'target', 'max', 'soft'])
        if kind == 'plain': rows.append((pre() + pw + vw, P('adjust', part=part, direction=d)))
        elif kind == 'soft': rows.append((pre() + pw + pick(['조금 ', '살짝 ', '좀만 ', '아주 조금 ', '더 ']) + vw, P('adjust', part=part, direction=d)))
        elif kind == 'delta':
            n = pick([5, 10, 15, 20, 3]); rows.append((pre() + pw + sp(sino(n), '도') + pick([' ', ' 더 ']) + vw, P('adjust', part=part, direction=d, amount=n, amount_type='delta')))
        elif kind == 'target':
            n = pick([0, 10, 20, 30, 40, 45, 60, 80]); rows.append((pre() + pw + sp(sino(n), '도로') + ' ' + vw, P('adjust', part=part, direction=d, amount=n, amount_type='target')))
        else:
            rows.append((pre() + pw + pick(['끝까지 ', '최대한 ', '다 ', '할 수 있는 만큼 ']) + vw, P('adjust', part=part, direction=d, amount='max', amount_type='target')))
    for a, b in [(5, 10), (10, 20), (20, 30), (15, 10)]:
        rows.append((pre() + f'머리 {sino(a)} 도 아니 {sino(b)} 도 올려', P('adjust', part='head', direction='up', amount=b, amount_type='delta')))
        rows.append((pre() + f'다리 {sino(a)} 도로 아니다 {sino(b)} 도로 내려', P('adjust', part='leg', direction='down', amount=b, amount_type='target')))
    for t in ['조금 더', '좀 더', '조금 더 해 줘', '더 해 줘', '아까처럼 더', '조금만 더 해']:
        rows.append((pre() + t, P('adjust', direction='same')))
    for t in ['최대한', '끝까지', '끝까지 해 줘']:
        rows.append((pre() + t, P('adjust', direction='same', amount='max', amount_type='target')))
    for t in ['평평하게 해 줘', '평평하게', '쭉 펴 줘', '완전히 평평하게', '침대 평평하게 해', '다 내려서 평평하게']:
        rows.append((pre() + t, P('adjust', part='both', direction='down', amount=0, amount_type='target')))
    for t in ['너무 높아', '너무 서 있어', '너무 누웠어']:
        rows.append((pre() + t, P('adjust', direction='down' if '높' in t or '서' in t else 'up')))
    return rows

def gen_undo():
    T = ['아까 자세로 돌려 줘', '원래대로 해 줘', '되돌려', '되돌려 줘', '전으로', '직전으로', '아까로 가자', '전 자세로', '방금 거 취소하고 돌려', '바꾸기 전으로',
         '이전 자세로 돌려 주세요', '아까가 나았어 돌려', '다시 아까처럼', '원위치', '처음 거로 돌려', '전이 낫다 돌려', '방금 전으로 돌아가 줘', '되돌려 주세요']
    return [(pre() + t, P('undo')) for t in T for _ in range(9)]

def gen_set_default():
    rows = []
    T_none = ['이 자세가 이제 기본이야', '이 자세 기록해', '이걸로 고정', '앞으로 이렇게 해 줘', '이 각도 기억해 둬', '이거 저장해', '지금 자세 저장해 줘', '이게 딱이야 저장', '이 자세 기억해', '이걸로 해 둬']
    T_p = ['{p} 자세 이걸로 고정', '{pe} 이걸로', '{p} 각도 이걸로 해', '{p} 자세는 이걸로 기억해', '{p} 자세 이걸로 저장해 줘']
    NOUN = {'read': ['책', '독서'], 'tv': ['티비', '테레비'], 'rest': ['휴식'], 'sleep': ['잠', '수면']}
    for t in T_none:
        for _ in range(4): rows.append((pre() + t, P('set_default')))
    for t in T_p:
        for p in ['read', 'tv', 'rest', 'sleep']:
            for _ in range(2):
                n = pick(NOUN[p]); rows.append((pre() + t.format(p=n, pe=eun(n)), P('set_default', purpose=p)))
    for t in ['이 자세 기본 자세로 저장해', '기본 자세 이걸로 해', '기본은 이걸로']:
        rows.append((pre() + t, P('set_default', purpose='base')))
    return rows

def gen_reserve():
    rows = []
    for _ in range(70):
        p = pick(['sleep', 'sleep', 'sleep', 'rest', 'read', 'tv'])
        if random.random() < .55:
            t, ap, v = clock(allow24=False); pw = pick(['잠 자세로', '잘 수 있게', '수면 자세로']) if p == 'sleep' else pick(PURPOSE_W[p][:2]) + ' 자세로'
            q = f'{t}에 {pw} {pick(["해 줘", "바꿔 줘", "예약해", "바꿔 주세요", "해라"])}'
            rows.append((pre() + q, P('reserve', purpose=p, ampm=ap, time=v, time_type='absolute')))
        else:
            w, v = dur()
            q = pick([f'{w} 뒤에 잠 자세로 해 줘', f'{w} 뒤에 잘게', f'{w} 있다가 잠 자세로', f'{w} 뒤에 수면 자세로 바꿔 줘', f'{w} 후에 잘 수 있게 해 줘'])
            rows.append((pre() + q, P('reserve', purpose='sleep', time=v, time_type='relative')))
    for t in ['잠 자세 예약해 줘', '자세 예약할래', '나중에 잠 자세로 예약해']:
        rows.append((pre() + t, P('reserve', purpose='sleep' if '잠' in t else 'none')))
    return rows

def gen_delay():
    rows = []
    for _ in range(55):
        p, pw = pick([('none', '예약'), ('none', '자세 예약'), ('sleep', '잠 자세 예약'), ('read', '독서 자세 예약')])
        if random.random() < .65:
            w, v = dur(); q = f'{pw} {w} {pick(["늦춰 줘", "미뤄", "늦춰", "뒤로 미뤄 줘", "미뤄 주세요"])}'
            rows.append((pre() + q, P('change_reserve', purpose=p, time=v, time_type='later')))
        else:
            t, ap, v = clock(allow24=False); q = f'{pw} {ro(t)} {pick(["늦춰 줘", "미뤄", "미뤄 주세요"])}'
            rows.append((pre() + q, P('change_reserve', purpose=p, ampm=ap, time=v, time_type='absolute')))
    for t in ['예약 좀 미뤄 줘', '자세 예약 미뤄', '예약 늦춰']:
        rows.append((pre() + t, P('change_reserve', time_type='later')))
    for t in ['나 좀 더 있다 잘래', '조금 더 있다가 잘게', '아직 안 잘래 좀 이따 잘게', '잠은 좀 더 있다가']:
        rows.append((pre() + t, P('change_reserve', purpose='sleep', time_type='later')))
    # 얼마나인지 없이 방향만 말한 앞당기기, 방향도 없는 시각 바꾸기, 날짜를 말한 시각 바꾸기
    for t in ['예약 좀 앞당겨 줘', '자세 예약 좀 일찍 해 줘', '예약 조금 당겨']:
        rows.append((pre() + t, P('change_reserve', time_type='earlier')))
    for t in ['예약 시간 좀 바꿔 줘', '자세 예약 시각 바꿀래']:
        rows.append((pre() + t, P('change_reserve')))
    for t, dv, ap, v in [('예약 내일 열 시로 바꿔 줘', 'tomorrow', 'none', '10:00'), ('자세 예약 모레 아침 여섯 시로 옮겨', '+2', 'am', '06:00'), ('잠 자세 예약 토요일 열한 시로 바꿔', 'sat', 'none', '11:00')]:
        rows.append((pre() + t, P('change_reserve', purpose='sleep' if '잠' in t else 'none', date=dv, ampm=ap, time=v, time_type='absolute')))
    # 앞당기기·늦추기에서 기존 예약을 가리키는 날짜는 버림(예약은 하나뿐). 새 시각의 날짜만 남김
    for t, v, tt in [('내일 예약 한 시간 앞당겨', '01:00', 'earlier'), ('오늘 자세 예약 삼십 분 늦춰 줘', '00:30', 'later'), ('내일 예약 좀 미뤄', 'none', 'later')]:
        rows.append((pre() + t, P('change_reserve', time=v, time_type=tt)))
    for t in ['내일 예약 취소해', '오늘 자세 예약 지워 줘']:
        rows.append((pre() + t, P('cancel_reserve')))
    return rows

def gen_cancel():
    rows = []
    for t in ['자세 예약 취소해', '예약 취소', '예약한 거 없애 줘', '자세 예약 지워 줘', '예약 취소해 주세요', '예약 안 할래', '예약 없던 걸로 해', '자세 바꾸는 예약 지워']:
        for _ in range(8): rows.append((pre() + t, P('cancel_reserve')))
    for t in ['잠 자세 예약 취소해', '잠 자세 예약 지워 줘', '오늘 잠 자세 예약 취소해', '수면 예약 취소', '자동으로 바꾸지 마 내가 잘게']:
        for _ in range(6): rows.append((pre() + t, P('cancel_reserve', purpose='sleep')))
    # 간접 표현은 확인(confirm=yes)
    for t in ['안 잘래', '오늘은 안 잘래', '내가 알아서 잘게', '잠드는 건 내가 알아서 할게', '오늘은 그냥 안 잘래', '나 오늘 밤샐 거야', '알아서 잘 테니까 놔둬']:
        for _ in range(4): rows.append((pre() + t, P('cancel_reserve', purpose='sleep', confirm='yes')))
    return rows

ALARM_V = ['깨워 줘', '깨워줘', '깨워', '알람 맞춰 줘', '알람 맞춰', '알람', '알람 해 줘', '일어나야 돼', '깨워 주세요', '기상', '알람 좀 맞춰 줄래', '울려 줘']
def gen_set():
    rows = []
    for _ in range(150):
        k = pick(['basic', 'basic', 'date', 'repeat', 'type', 'relative'])
        t, ap, v = clock(); kw = dict(ampm=ap, time=v); words = [t + pick(['에', '에', ''])]
        if k == 'date': dw, dv = date_expr(); words.insert(0, dw); kw['date'] = dv
        if k == 'repeat': dw, dv = pick(DAYS_EXPR); words.insert(0, dw); kw.update(repeat='weekly', days=dv)
        if k == 'type':
            tw, tv = pick([('침대에서 나와야 꺼지는 알람으로', 'leave_bed'), ('문제 내는 알람으로', 'question'), ('덧셈 알람으로', 'question'), ('기본 알람으로', 'basic'), ('일어나야 꺼지는 걸로', 'leave_bed')])
            words.append(tw); kw['type'] = tv
            rows.append((pre() + ' '.join(words + [pick(['맞춰 줘', '맞춰', '해 줘', '맞춰 주세요'])]), A('set', **kw))); continue
        if k == 'relative':
            w, dv = dur(); words = [w + pick([' 뒤에', ' 후에', '만 잘게 그 뒤에'])]; kw = dict(time=dv, time_type='relative')
        rows.append((pre() + ' '.join(words + [pick(ALARM_V)]), A('set', **kw)))
    for t in ['알람 맞춰 줘', '알람 하나 맞춰', '깨워 줘']:
        rows.append((pre() + t, A('set')))
    # 시각이나 기상을 말했으니 확인하지 않는 말(confirm=no)
    for _ in range(10):
        w, dv = dur(); rows.append((pre() + w + pick([' 뒤에 소리 내 줘', ' 뒤에 울려', ' 뒤에 소리 나게 해', ' 뒤에 울어']), A('set', time=dv, time_type='relative')))
    # 알람이라고 직접 말하지 않은 간접 표현은 확인(confirm=yes)
    for _ in range(14):
        w, dv = dur(); rows.append((pre() + w + pick([' 뒤에 노래해 줘', ' 뒤에 노래 좀 해', ' 뒤에 노래 불러', ' 있다가 노래해라']), A('set', time=dv, time_type='relative', confirm='yes')))
    for _ in range(4):
        t, ap, v = clock(False); rows.append((pre() + t + pick(['에 네가 일해라', '에 네가 할 일 알지']), A('set', ampm=ap, time=v)))
    for t in ['이십사 시에 알람 맞춰', '스물네 시에 깨워', '오늘 이십사 시에 알람', '이십사시에 울려 줘']:
        rows.append((pre() + t, A('set', date='today' if '오늘' in t else 'none', time='24:00')))
    # 고쳐 말하기: 고친 항목만 바꾸고 나머지는 그대로
    for a, b in [(7, 8), (6, 7), (9, 10), (5, 6)]:
        rows.append((pre() + f'내일 아침 {NATIVE_H[a]} 시 아니 {NATIVE_H[b]} 시에 깨워 줘', A('set', date='tomorrow', ampm='am', time=f'{b:02d}:00')))
        rows.append((pre() + f'{NATIVE_H[a]} 시 반 아니다 {NATIVE_H[b]} 시 반에 알람', A('set', time=f'{b:02d}:30')))
    for (w1, v1), (w2, v2) in [(('월요일', 'mon'), ('화요일', 'tue')), (('토요일', 'sat'), ('일요일', 'sun'))]:
        rows.append((pre() + f'{w1} 아니 {w2} 오전 일곱 시에 깨워', A('set', date=v2, ampm='am', time='07:00')))
    return rows

def tgt():
    """대상 알람을 고르는 말과 칸"""
    k = pick(['none', 'none', 'time', 'ampm', 'days', 'all'])
    if k == 'none': return pick(['', '이 ', '그 ']) + pick(['알람', '알림']), {}
    if k == 'time': t, ap, v = clock(); return t + ' 알람', dict(target=v, target_ampm=ap)
    if k == 'ampm': ap = pick(['am', 'pm']); return pick(['아침', '오전'] if ap == 'am' else ['저녁', '밤']) + ' 알람', dict(target_ampm=ap)
    if k == 'days': w, v = pick(WEEKDAY + [('평일', 'weekdays'), ('주말', 'weekend')]); return w + ' 알람', dict(target_days=v)
    return pick(['알람 다', '알람 전부', '모든 알람']), dict(target='all')

def gen_change_time():
    rows = []
    for _ in range(100):
        tw, kw = tgt()
        if kw.get('target') == 'all': tw, kw = '알람', {}
        k = pick(['abs', 'abs', 'shift', 'once', 'always'])
        if k == 'shift':
            w, v = dur(); e = random.random() < .5
            rows.append((pre() + f'{tw} {w} {pick(["당겨", "일찍", "앞당겨 줘"] if e else ["늦춰", "늦게", "미뤄 줘"])}', A('change_time', **kw, time=v, time_type='earlier' if e else 'later')))
            continue
        t, ap, v = clock(); kw.update(ampm=ap, time=v)
        if k == 'once': dw, dv = date_expr(('today', 'tomorrow', 'week')); rows.append((pre() + f'{dw}만 {tw} {ro(t)} 바꿔 줘', A('change_time', **kw, date=dv, scope='once'))); continue
        if k == 'always': rows.append((pre() + f'{tw} 앞으로 계속 {ro(t)} 바꿔', A('change_time', **kw, scope='always'))); continue
        rows.append((pre() + f'{tw} {ro(t)} {pick(["바꿔 줘", "바꿔", "변경해 줘", "옮겨 줘"])}', A('change_time', **kw)))
    for t in ['알람 시간 바꿔 줘', '알람 시각 바꿀래']:
        rows.append((pre() + t, A('change_time')))
    # 얼마나인지 없이 방향만 말한 알람 시각 바꾸기
    for t, tt in [('알람 좀 늦춰 줘', 'later'), ('아침 알람 조금 미뤄', 'later'), ('알람 좀 당겨 줘', 'earlier'), ('알람 조금 일찍 울리게 해', 'earlier')]:
        rows.append((pre() + t, A('change_time', target_ampm='am' if '아침' in t else 'none', time_type=tt)))
    return rows

TYPE_W = [('침대에서 나와야 꺼지는 알람으로', 'leave_bed'), ('일어나서 나가야 꺼지게', 'leave_bed'), ('침대 이탈 알람으로', 'leave_bed'),
          ('문제 내는 알람으로', 'question'), ('덧셈 알람으로', 'question'), ('계산 문제 알람으로', 'question'),
          ('기본 알람으로', 'basic'), ('그냥 소리만 나는 알람으로', 'basic'), ('보통 알람으로', 'basic')]
def gen_change_type():
    rows = []
    for _ in range(90):
        tw, kw = tgt()
        if kw.get('target') == 'all': tw, kw = '알람', {}
        w, v = pick(TYPE_W); kw['type'] = v
        if random.random() < .25:
            dw, dv = date_expr(('today', 'tomorrow', 'week')); rows.append((pre() + f'{eun(dw)} {tw} {w} {pick(["해 줘", "바꿔"])}', A('change_type', **kw, date=dv, scope='once')))
        else: rows.append((pre() + f'{tw} {w} {pick(["바꿔 줘", "해 줘", "바꿔", "해", "바꿔 주세요"])}', A('change_type', **kw)))
    for t in ['기본 말고 문제', '기본 말고 덧셈으로', '문제로 해', '계산으로 해 줘']:
        rows.append((pre() + t, A('change_type', type='question')))
    for t in ['알람 종류 바꿔 줘', '기본 말고']:
        rows.append((pre() + t, A('change_type')))
    return rows

def gen_change_level():
    rows = []
    for w, v in [('두 자리로', 'two'), ('두 자리 덧셈으로', 'two'), ('한 자리로', 'one'), ('한 자리 덧셈으로', 'one')]:
        for t in ['알람 문제 {w} 내 줘', '문제 {w} 바꿔', '덧셈 {w} 해 줘', '알람 덧셈 {w} 바꿔 주세요']:
            for _ in range(2): rows.append((pre() + t.format(w=w), A('change_level', level=v)))
    for t in ['문제 너무 쉬워', '알람 문제 더 어렵게', '난이도 높여', '문제 좀 어렵게 내 줘', '덧셈 너무 쉽다']:
        for _ in range(2): rows.append((pre() + t, A('change_level', level='up')))
    for t in ['문제 너무 어려워', '알람 문제 쉽게 해 줘', '난이도 낮춰', '덧셈 좀 쉽게']:
        for _ in range(2): rows.append((pre() + t, A('change_level', level='down')))
    return rows

def gen_skip():
    rows = []
    for _ in range(90):
        tw, kw = tgt()
        if kw.get('target') == 'all': tw, kw = '알람', {}
        dw, dv = date_expr(('today', 'tomorrow', 'tomorrow', 'week', 'plus'))
        q = pick([f'{dw}만 {tw} 건너뛰어', f'{dw} {tw} 울리지 마', f'{eun(dw)} {tw} 쉬어', f'{dw} {tw} 한 번만 빼 줘', f'{dw}만 {tw} 안 울리게 해 줘', f'{dw} 쉬니까 {tw} 꺼'])
        rows.append((pre() + q, A('skip', **kw, date=dv)))
    for t in ['이번 알람 건너뛰어', '다음 알람 한 번 건너뛰어 줘']:
        rows.append((pre() + t, A('skip')))
    return rows

def gen_disable():
    rows = []
    for _ in range(70):
        tw, kw = tgt(); k = pick(['plain', 'period', 'until'])
        if k == 'plain': rows.append((pre() + f'{tw} {pick(["당분간 꺼 둬", "잠깐 꺼 놔", "한동안 꺼 줘", "지우지 말고 꺼만 놔", "잠시 멈춰 둬"])}', A('disable', **kw))); continue
        if k == 'period':
            n = pick([2, 3, 5, 7, 10]); rows.append((pre() + f'{sp(sino(n), "일간")} {tw} {pick(["꺼", "꺼 줘", "쉬게 해 줘"])}', A('disable', **kw, period=n))); continue
        dw, dv = date_expr(('week', 'md', 'd', 'tomorrow'))
        rows.append((pre() + f'{dw}까지 {tw} {pick(["꺼", "꺼 둬", "꺼 줘"])}', A('disable', **kw, until=dv)))
    return rows

def gen_enable():
    rows = []
    for _ in range(60):
        tw, kw = tgt(); rows.append((pre() + f'{tw} {pick(["다시 켜 줘", "다시 켜", "다시 울리게 해 줘", "다시 살려 줘", "켜 줘", "다시 쓸래"])}', A('enable', **kw)))
    for t, kw in [('꺼 둔 알람 다시 켜', {}), ('휴가 끝났으니 알람 다 켜', dict(target='all')), ('알람 다 키자', dict(target='all')), ('알람 다시 켜 줘', {})]:
        rows.append((pre() + t, A('enable', **kw)))
    return rows

def gen_delete():
    rows = []
    for _ in range(70):
        tw, kw = tgt(); rows.append((pre() + f'{tw} {pick(["삭제해", "지워 줘", "완전히 지워", "목록에서 지워 주세요", "아예 없애 줘", "삭제해 주세요"])}', A('delete', **kw)))
    return rows

def gen_off():
    rows = []
    for _ in range(55):
        tw, kw = tgt()
        if kw.get('target') == 'all': tw, kw = '알람', {}
        rows.append((pre() + f'{tw} {pick(["꺼 줘", "꺼", "끌래", "꺼 주세요", "취소해", "필요 없어", "필요없어 이제", "끄고 싶어"])}', A('off', **kw)))
    return rows

def gen_snooze():
    rows = []
    for _ in range(60):
        n = pick([5, 10, 15, 20, 3, 30])
        rows.append((pre() + pick([f'{sp(sino(n), "분만")} 더', f'{sp(sino(n), "분")} 더 잘게', f'{sp(sino(n), "분")} 뒤에 다시 깨워', f'{sp(sino(n), "분만")} 더 잘래', f'{sp(sino(n), "분")}만']), A('snooze', minutes=n)))
    for t in ['조금만 더 잘래', '조금 이따 깨워', '더 잘래', '조용히 해 더 자게', '닥쳐 더 잘 거야', '좀 더 잘게', '오늘은 좀 더 잘게', '오 분만 봐줘', '조금만 더 자자']:
        rows.append((pre() + t, A('snooze', minutes=5) if '오 분' in t else A('snooze')))
    rows.append((pre() + '한 시간만 더 잘래', A('snooze', minutes=60)))
    return rows

def gen_answer():
    rows = []
    AP = ['', '음 ', '어 ', '아 ', '그 ', '음 그 ']
    for t in ['응', '어', '네', '그래', '맞아', '그렇게 해', '좋아', '응 그거', '예', '맞아요', '그래 해 줘', '음 맞아']: rows.extend((p + t, R(type='yes')) for p in AP)
    for t in ['아니', '아니요', '아냐', '아니 그거 아니야', '싫어', '삭제는 하지 마', '그건 아니고']: rows.extend((p + t, R(type='no')) for p in AP)
    for t in ['딱 좋아', '이거 좋네', '편하다', '이게 젤 편해', '완벽해', '딱이야']: rows.extend((p + t, R(type='good')) for p in AP)
    for t in ['불편해', '별로야', '개별론데', '이상해', '안 편해', '불편하다']: rows.extend((p + t, R(type='bad')) for p in AP)
    for t, v in [('오전', 'am'), ('아침', 'am'), ('오후', 'pm'), ('저녁', 'pm'), ('밤이야', 'pm'), ('오전이요', 'am'), ('아니 오후야', 'pm'), ('오전에 말고', 'pm'), ('저녁이라고', 'pm')]:
        rows.extend((p + t, R(type='ampm', value=v)) for p in AP)
    for _ in range(45):
        t, ap, v = clock(); val = (ap + '_' + v) if ap != 'none' else v
        rows.append((pick(['', '', '음 ', '어 ']) + pick([t, t, t + '요', ro(t) + ' 해 줘']), R(type='time', value=val)))
    for _ in range(35):
        dw, dv = date_expr(); rows.append((pick(['', '음 ']) + pick([dw, dw + '만', ro(dw) + ' 해 줘']), R(type='date', value=dv)))
    for t, v in [('다리', 'leg'), ('머리', 'head'), ('다리요', 'leg'), ('머리 쪽', 'head'), ('발', 'leg'), ('등', 'head')]: rows.extend((p + t, R(type='part', value=v)) for p in AP)
    # 목적 이름만 말한 것은 대답이 아니라 자세 부르기로 낸다(같은 말에 정답 하나)
    for t, v in [('독서', 'read'), ('티비', 'tv'), ('휴식', 'rest'), ('잠', 'sleep'), ('기본', 'base'), ('책 읽는 거', 'read')]: rows.extend((p + t, P('call', purpose=v)) for p in AP)
    for t, v in [('이번만', 'once'), ('계속', 'always'), ('앞으로 쭉', 'always'), ('이번만 말고', 'always'), ('한 번만', 'once'), ('앞으로', 'always')]: rows.extend((p + t, R(type='scope', value=v)) for p in AP)
    for t in ['취소해', '그거 취소해', '됐어', '안 할래', '안 해', '하지 마', '그만', '필요 없어']: rows.extend((p + t, R(type='cancel')) for p in AP)
    for _ in range(40):
        n = random.randint(2, 198); suf = pick(['', '', '요', '이요', ' 세끼야'])
        rows.append((pick(['', '음 ', '아 ']) + sino(n) + suf, R(type='number', value=n)))
    for _ in range(14):
        a, b = random.sample(range(2, 99), 2); rows.append((pick(['', '음 ']) + f'{sino(a)} {pick(["", "어 "])}{sino(b)}', R(type='unclear')))
    for a, b in [(7, 8), (15, 16), (23, 24), (40, 41), (12, 21), (36, 63), (9, 19)]:
        rows.append((f'{sino(a)} 아니 {sino(b)}', R(type='number', value=b)))
        rows.append((f'{sino(a)} {sino(b)}', R(type='unclear')))
    for _ in range(30):
        n = random.randint(10, 99); rows.append((pick(['', '음 ', '아 ']) + native(n) + pick(['', '요', '이요']), R(type='number', value=n)))
    return rows

def gen_unsupported():
    T = ['불 좀 꺼 줘', '음악 틀어 줘', '노래 틀어', '에어컨 켜', '커튼 쳐 줘', '마사지 해 줘', '침대 따뜻하게 해 줘', '물 좀 갖다 줘', '문 잠가 줘', '라디오 켜 주세요',
         '허리가 아파', '아이고 허리야', '무릎이 쑤셔', '날씨 알려 줘', '티비 켜 줘', '보일러 켜', '전화 걸어 줘', '뮤직큐', '노래해', '창문 열어', '삼십 분 뒤에 음악 틀어 줘', '이십 분 뒤에 음악 틀어 줘',
         '진동 켜 줘', '공기청정기 켜', '불 좀 켜 줘', '가습기 켜 줘', '선풍기 틀어', '조명 어둡게 해 줘', '청소기 돌려', '커피 타 줘', '택시 불러 줘', '티비 소리 줄여', '커튼 열어 줘',
         '전기장판 켜', '방 온도 올려 줘', '목이 아파', '다리가 저려', '등이 결려']
    rows = [(pre() + t, out('maum_3', reason='out_of_scope')) for t in T for _ in range(4)]
    for t in ['알람 소리 줄여', '알람 소리 키워', '기본 자세 지워 줘', '독서 자세 저장한 거 해제해', '알람 소리 바꿔 줘', '티비 기본 자세 지워']:
        for _ in range(8): rows.append((pre() + t, out('maum_3', reason='app_only')))
    return rows

def gen_info():
    rows = []
    MORE = {'tell_time': ['지금 시간 좀 알려 줘', '몇 시쯤 됐어', '시간이 어떻게 돼', '지금 몇 시 몇 분이야', '몇 시인지 말해 줘', '시계 좀 봐 줘', '지금 시각 알려 주세요', '현재 시간', '몇 시나 됐냐', '벌써 몇 시야', '지금 몇 시쯤이야'],
            'repeat_last': ['방금 뭐라고 했어', '다시 한 번만', '잘 안 들려', '한 번만 더', '다시 얘기해 줘', '못 알아들었어 다시', '뭐라고 했지', '방금 그거 다시', '크게 다시 말해 줘', '아까 한 말 다시 해 줘', '다시 말해 주세요'],
            'tell_alarms': ['알람 몇 개 있어', '내일 알람 있어', '내일 몇 시에 일어나', '알람 확인해 줘', '알람 목록 읽어 줘', '맞춰 둔 알람 알려 줘', '알람 뭐 걸려 있어', '내일 몇 시 알람이야', '내일 알람 몇 개야', '알람 어떻게 돼 있어']}
    for c, ts in MORE.items():
        for t in ts:
            for _ in range(4): rows.append((pre() + t, out('maum_4', c)))
    for t in ['몇 시야', '지금 몇 시', '몇시', '시간 알려 줘', '지금 몇 시예요', '타임', '지금 시간', '몇 시냐']:
        for _ in range(8): rows.append((pre() + t, out('maum_4', 'tell_time')))
    for t in ['뭐라고', '다시 말해', '다시 말해 줘', '못 들었어', '뭐', '뭐라는 거야', '한 번 더 말해 줘', '리핏', '뭐래']:
        for _ in range(8): rows.append((pre() + t, out('maum_4', 'repeat_last')))
    for t in ['알람 뭐 있어', '알람 뭐뭐 있냐', '내일 알람 몇 시야', '알람 맞춰 놓은 거 있어', '알람 다 말해 봐', '내일 알람 알려 줘']:
        for _ in range(8): rows.append((pre() + t, out('maum_4', 'tell_alarms')))
    return rows

def gen_general():
    T = ['안녕', '하이', '굿모닝', '좋은 아침', '잘 잤어', '고마워', '수고했어', '너 이름이 뭐야', '심심해', '배고프다', '오늘 너무 피곤하다', '오늘 하루 길었어', '오늘 날씨 어때',
         '너 뭐 하는 놈이냐', '넌 의식이 있냐', '너 무슨 재미로 사냐', '왜 이렇게 멍청해', '발전 좀 해', '말귀를 못 알아먹네', '휴가 끝났다', '내일 쉬거든', '알람 문제 장난하냐',
         '사랑해', '잘 자', '오늘 회사 힘들었어', '너 나 안 무겁냐', '뭐 하냐', '재밌는 얘기 해 봐', '너 몇 살이야', '오늘 기분 좋다', '아 졸려', '내일 출근하기 싫다', '밥 먹었어',
         '오늘 운동했어', '나 오늘 시험 봤어', '고장 났냐', '이거 왜 이래', '흠', '그렇구나',
         '오늘 뭐 했어', '배불러', '피곤해 죽겠다', '오늘 비 온대', '친구 만났어', '내일 뭐 하지', '좋은 꿈 꿔', '너 귀엽다', '너 똑똑하네', '이거 신기하다',
         '나 요즘 잠이 안 와', '스트레스 받아', '주말에 놀러 갈 거야', '오늘 월급날이다', '고생했다', '반가워', '오늘 춥다', '오늘 덥다', '야식 먹을까', '너 누가 만들었어',
         '나 오늘 늦게 들어왔어', '내일 비 온다던데', '오늘 하루 어땠냐면', '아 배고파 죽겠네', '너 말 잘한다', '나 감기 걸렸나 봐', '엄마랑 통화했어', '오늘 고양이 봤어']
    return [(pre() + t, G) for t in T for _ in range(7)]

GENS = [gen_call, gen_adjust, gen_undo, gen_set_default, gen_reserve, gen_delay, gen_cancel, gen_set, gen_change_time, gen_change_type,
        gen_change_level, gen_skip, gen_disable, gen_enable, gen_delete, gen_off, gen_snooze, gen_answer, gen_unsupported, gen_info, gen_general]

def func_name(o):
    m = re.match(r'<(\w+)>\((?:command=(\w+))?', o)
    tok, cmd = m.group(1), m.group(2)
    if tok == 'maum_2': return 'maum_2 ' + re.search(r'type=(\w+)', o).group(1)
    if tok == 'maum_3': return 'maum_3 ' + re.search(r'reason=(\w+)', o).group(1)
    return f'{tok} {cmd}' if cmd else tok

FILLERS = ('야', '저기', '음', '아', '어', '그', '침대야', '좀', '나', '지금', '그냥', '으음')
def key(q):  # 앞말과 띄어쓰기를 모두 뗀 비교용 열쇠. 생성 문장과 평가 문장이 사실상 같은지 볼 때 쓴다
    w = q.split()
    while len(w) > 1 and w[0] in FILLERS: w = w[1:]
    return ''.join(w)
def clean(q):
    q = re.sub(r'\s+', ' ', q).strip()
    return re.sub(r'^(\S+) \1(?=\s|$)', r'\1', q)  # 앞말과 첫 낱말이 같으면 하나만(아 아 졸려 -> 아 졸려)

if __name__ == '__main__':
    import build_rep, build_real
    dev = [[f, o, q] for f, q, o in build_rep.ROWS]
    final = [[f, o, q] for n, f, q, o in build_real.ROWS if q not in build_real.HOLD]
    final_n = {key(q) for _, _, q in final}
    dev = [r for r in dev if key(r[2]) not in final_n]          # 회귀 평가와 겹치는 대표 문장은 개발용에서 뺀다
    held = final_n | {key(q) for _, _, q in dev}
    raw = [(clean(q), o) for g in GENS for q, o in g()]
    errors = [(q, parse(o)) for q, o in raw if parse(o)]
    if errors:
        for e in errors[:20]: print('출력 오류', e)
        sys.exit(1)
    bad = [q for q, _ in raw if re.search(r'[A-Za-z0-9.,?!~]', q)]
    if bad: print('한글 외 문자', bad[:10]); sys.exit(1)
    seen, train, dropped = {}, [], Counter()
    for q, o in raw:
        if key(q) in held: dropped['평가 문장과 겹침'] += 1; continue
        if q in seen:
            if seen[q] != o: print('같은 문장에 다른 정답', q, seen[q], o); sys.exit(1)
            dropped['중복'] += 1; continue
        seen[q] = o; train.append([func_name(o), o, q])
    # 같은 열쇠(앞말·띄어쓰기만 다른 문장)에 다른 정답이 붙었는지 세 묶음 전체에서 본다
    ans = defaultdict(set)
    for f, o, q in [[None, o, q] for q, o in raw] + dev + final: ans[key(q)].add(o)  # 겹쳐서 빠진 생성 문장도 포함
    clash = {k: v for k, v in ans.items() if len(v) > 1}
    if clash:
        for k, v in list(clash.items())[:20]: print('앞말만 다른데 정답이 다름', k, v)
        sys.exit(1)
    random.shuffle(train)
    json.dump(train, open(os.path.join(OUT, 'train.json'), 'w'), ensure_ascii=False, indent=0)
    json.dump(dev, open(os.path.join(OUT, 'dev.json'), 'w'), ensure_ascii=False, indent=0)
    json.dump(final, open(os.path.join(OUT, 'final.json'), 'w'), ensure_ascii=False, indent=0)
    cnt = Counter(f for f, _, _ in train)
    space = sum(1 for _, _, q in train if re.search(r'[가-힣](시|분|도|일)(?=\s|$|[에로까뒤만])', q))
    lines = ['# 학습 데이터 나누기 (요약)', '', '이 파일은 build_train.py가 만듭니다. 직접 고치지 않습니다.', '',
             f'- 학습(train.json): {len(train)}문장. 문장 틀로 만든 것이며 평가 문장과 앞말·띄어쓰기만 다른 것({dropped["평가 문장과 겹침"]}개)과 중복({dropped["중복"]}개)은 뺐습니다.',
             f'- 개발용 평가(dev.json): {len(dev)}문장. 대표 문장입니다. 틀린 것을 보고 데이터를 고칠 때 씁니다.',
             f'- 실제 사용자 문장 회귀 평가(final.json): {len(final)}문장. 팀원이 직접 말한 문장입니다. 모델을 고르거나 데이터를 고칠 때 쓰지 않습니다. 다만 이 문장들을 보며 규격을 여러 번 고쳤으므로 처음 보는 말에 대한 시험은 아닙니다. 그 시험은 규격이 정리된 뒤 새로 모은 문장으로 합니다.',
             f'- 숫자와 단위를 붙여 쓴 문장(띄어쓰기 변형): 약 {round(space / len(train) * 100)}%', '',
             '## 기능별 학습 문장 수', '', '| 기능 | 문장 수 |', '|---|---|'] + [f'| {f} | {n} |' for f, n in sorted(cnt.items())]
    lines += ['', '## 평가에서 따로 셀 것', '', '- 전체 정답률(이름표, 명령, 값까지 모두 맞아야 정답)', '- 기능별 정답률', '- confirm=yes여야 하는데 no로 낸 경우(확인 없이 실행되는 오류)', '- 일반 대화나 못 하는 일을 명령으로 낸 경우(침대가 엉뚱하게 움직이는 오류)']
    open(os.path.join(OUT, 'split.md'), 'w').write('\n'.join(lines) + '\n')
    print('학습', len(train), '개발', len(dev), '최종', len(final), '뺀 것', dict(dropped))
