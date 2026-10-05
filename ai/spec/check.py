# 규격 v0.1 검사 도구. 검사하는 것은 아래 항목뿐이며, 문장의 뜻이 정답과 맞는지는 사람이 검토한다
import json, re, sys
from collections import Counter, defaultdict
from spec import SPEC, END, ANSWER_VALUES
DAYNAMES = {'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'}
PAT = re.compile(r'^<(maum_[0-4]|General_Conversation)>\((.*)\)' + re.escape(END) + r'$')
def norm(q):
    while True:
        q2 = re.sub(r'^(나|지금|그냥)\s+', '', q)
        if q2 == q: return q
        q = q2
def is_date(v):
    if v in ('today', 'tomorrow') or v in DAYNAMES: return True
    if v.startswith('next_') and v[5:] in DAYNAMES: return True
    if re.fullmatch(r'\+\d{1,3}', v): return 2 <= int(v[1:]) <= 365
    if re.fullmatch(r'D\d{1,2}', v): return 1 <= int(v[1:]) <= 31
    m = re.fullmatch(r'(\d\d)-(\d\d)', v)
    # 실제 달력 날짜인지(2월은 29일까지 허용). 해마다 달라지는 최종 확인은 앱이 한다
    return bool(m) and 1 <= int(m[1]) <= 12 and 1 <= int(m[2]) <= [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][int(m[1]) - 1]
def check_value(kind, v, kv):
    if isinstance(kind, list): return v in kind
    if kind == 'time': return v in ('none', '24:00') or (re.fullmatch(r'\d\d:\d\d', v) is not None and int(v[:2]) < 24 and int(v[3:]) < 60)
    if kind == 'angle': return v in ('none', 'max') or (v.isdigit() and 0 <= int(v) <= 90)
    if kind == 'target': return v in ('none', 'all') or check_value('time', v, kv)
    if kind == 'period': return v == 'none' or (v.isdigit() and 1 <= int(v) <= 60)
    if kind == 'minutes': return v == 'none' or (v.isdigit() and 1 <= int(v) <= 60)
    if kind == 'date': return v == 'none' or is_date(v)
    if kind == 'days': return v in ('none', 'daily', 'weekdays', 'weekend') or set(v.split('+')) <= DAYNAMES
    if kind == 'answer':
        allowed = ANSWER_VALUES.get(kv.get('type'))
        if isinstance(allowed, list): return v in allowed
        if allowed == 'answer_date': return is_date(v)
        if allowed == 'answer_number': return v.isdigit() and 0 <= int(v) <= 999
        if allowed == 'answer_time':
            t = v.split('_', 1)[1] if v[:3] in ('am_', 'pm_') else v
            return check_value('time', t, kv) and t != 'none' and (t == v or 1 <= int(t[:2]) <= 12)
        return False
    return False
def parse(out):
    m = PAT.match(out)
    if not m: return '토큰·끝 토큰 형식 불일치'
    tok, body = m.groups()
    pairs = [] if body == '' else body.split(', ')
    kv = {}
    for p in pairs:
        if not re.fullmatch(r'\w+=[A-Za-z0-9_:+\-]+', p): return f'값 표기 오류: {p}'
        k, v = p.split('=', 1)
        if k in kv: return f'값 이름 중복: {k}'
        kv[k] = v
    cmd = kv.pop('command', None)
    key = (tok, cmd)
    if key not in SPEC: return f'정의되지 않은 토큰·명령: {key}'
    names = [n for n, _, _ in SPEC[key]]
    if list(kv) != names: return f'값 이름·순서 불일치: {list(kv)}'
    for n, _, kind in SPEC[key]:
        if not check_value(kind, kv[n], kv): return f'허용되지 않은 값: {n}={kv[n]}'
    if 'amount' in kv and (kv['amount'] == 'none') != (kv['amount_type'] == 'none'): return '양과 양 종류가 어긋남'
    for n, a in (('time', 'ampm'), ('target', 'target_ampm')):
        if kv.get(n, 'none') not in ('none', 'all') and kv.get(a, 'none') != 'none' and not (1 <= int(kv[n][:2]) <= 12):
            return f'오전·오후를 말했는데 시가 1에서 12 사이가 아님: {n}={kv[n]}'
    # 칸 사이 조합 검사
    tt = kv.get('time_type')
    if tt is not None:
        if kv.get('time', 'none') != 'none' and tt == 'none': return '시각이 있는데 time_type이 none'
        # 앞당기기·늦추기는 얼마나인지 말하지 않아도 방향을 남긴다(앱이 "얼마나 늦출까요?"처럼 물음)
        if kv.get('time', 'none') == 'none' and tt not in ('none', 'earlier', 'later'): return '시각이 없는데 time_type이 absolute·relative'
        if tt in ('relative', 'earlier', 'later') and kv.get('ampm', 'none') != 'none': return '걸리는 시간인데 ampm이 있음'
    # 예약 변경에서 날짜는 새 시각(absolute)의 새 날짜로만 쓴다. 앞당기기·늦추기에서 기존 예약을 가리키는 날짜는 버린다
    if cmd == 'change_reserve' and tt in ('earlier', 'later', 'none') and kv.get('date', 'none') != 'none': return '예약 변경에서 date는 absolute일 때만 씀'
    if kv.get('until', 'none') != 'none' and kv.get('period', 'none') != 'none': return 'until과 period를 함께 씀'
    if kv.get('amount') in ('0', 'max') and kv.get('amount_type') != 'target': return '0도와 max는 목표 각도(target)일 때만 쓸 수 있음'
    return None
def run(path):
    data = json.load(open(path)); issues = defaultdict(list)
    for s, rows in data.items():
        for f, out, q in rows:
            if not q.strip(): issues['빈 문장'].append((s, q))
            if re.search(r'[.,?!~\'"]', q): issues['문장부호 포함'].append((s, q))
            if re.search(r'[A-Za-z0-9]', q): issues['한글 외 문자(영문·숫자)'].append((s, q))
            if re.search(r'(^|\s)(\S+)\s+\2(\s|$)', q): issues['같은 낱말 연속 반복'].append((s, q))
            err = parse(out)
            if err: issues['출력 규격 위반'].append((s, q, err))
        for q, n in Counter(q for _, _, q in rows).items():
            if n > 1: issues['같은 세트 안 중복 문장'].append((s, q, n))
        outs = defaultdict(set)
        for _, o, q in rows: outs[q].add(o)
        for q, o in outs.items():
            if len(o) > 1: issues['같은 문장에 다른 정답(충돌)'].append((s, q))
    tr = {q for _, _, q in data['train']}; trn = {norm(q) for q in tr}
    for s in ('val', 'test'):
        for _, _, q in data[s]:
            if q in tr: issues['학습과 완전히 같은 검증·평가 문장'].append((s, q))
            elif norm(q) in trn: issues['학습과 앞말만 다른 검증·평가 문장'].append((s, q))
    vn = {norm(q) for _, _, q in data['val']}
    for _, _, q in data['test']:
        if norm(q) in vn: issues['검증과 평가 사이 겹침(앞말 제거 기준)'].append(('test', q))
    per = defaultdict(Counter)
    for s, rows in data.items():
        for f, _, _ in rows: per[f][s] += 1
    res = {'문장 수': {k: len(v) for k, v in data.items()}, '기능별 문장 수': {f: dict(c) for f, c in per.items()},
           '문제 건수': {k: len(v) for k, v in issues.items()}, '문제 예시': {k: v[:5] for k, v in issues.items()}}
    json.dump(res, open(path.replace('.json', '_check.json'), 'w'), ensure_ascii=False, indent=1)
    return res
if __name__ == '__main__':
    r = run(sys.argv[1]); print(json.dumps({k: r[k] for k in ('문장 수', '문제 건수')}, ensure_ascii=False))
