# 명령마다 대표 문장과 정답을 만든다. 문장과 정답은 ai/data/seed/representative_rows.json에 있고, 고칠 때는 그 파일만 고친다
# 실행하면 정답을 검사하고 representative.md(검토표)를 새로 만든다. 이 파일은 직접 고치지 않는다. 데이터(dev.json)는 build_train.py가 ROWS를 읽어 만든다
import json, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'spec'))
from spec import SPEC, render
from check import parse
# 원본(사람이 고치는 문장과 정답)과 결과(코드가 만드는 데이터·검토표) 위치
SEED = os.path.join(HERE, '..', 'seed')
OUT = os.path.join(HERE, '..', 'datasets', 'v0.2')

def out(tok, cmd=None, **kw):
    # 명령의 칸을 SPEC 순서대로 채우고, 말에 없는 칸은 none으로 둔다
    names = [n for n, _, _ in SPEC[(tok, cmd)]]
    unknown = set(kw) - set(names)
    if unknown: raise ValueError(f'{tok} {cmd}에 없는 칸: {unknown}')
    if tok == 'maum_1' and cmd in ('set', 'change_time') and kw.get('time') and 'time_type' not in kw:
        kw['time_type'] = 'absolute'  # 시각을 말했고 따로 정하지 않았으면 정해진 시각
    if 'confirm' in names and 'confirm' not in kw:
        kw['confirm'] = 'no'  # 예약 취소와 알람 설정은 따로 정하지 않으면 분명한 명령(no)
    fields = ([('command', cmd)] if cmd else []) + [(n, str(kw.get(n, 'none'))) for n in names]
    return render(tok, fields)

P = lambda cmd, **kw: out('maum_0', cmd, **kw)
A = lambda cmd, **kw: out('maum_1', cmd, **kw)
R = lambda **kw: out('maum_2', **kw)


def seed_out(r):
    # seed 파일의 한 줄(tok, cmd, fields)을 정답 글로 만든다. 적지 않은 칸은 none
    return out(r['tok'], r.get('cmd'), **r.get('fields', {}))

def load_seed(name):
    return json.load(open(os.path.join(SEED, name), encoding='utf-8'))

ROWS = [(r['func'], r['q'], seed_out(r)) for r in load_seed('representative_rows.json')]

if __name__ == '__main__':
    errors = [(f, q, parse(o)) for f, q, o in ROWS if parse(o)]
    seen = {}
    for f, q, o in ROWS:
        if q in seen and seen[q] != o: errors.append((f, q, '같은 문장에 다른 정답'))
        seen[q] = o
    if errors:
        for e in errors: print('오류', e)
        sys.exit(1)
    lines = ['# 대표 문장과 정답 (검토용)', '', '이 파일은 build_rep.py가 만듭니다. 고칠 때는 ai/data/seed/representative_rows.json을 고치고 build_rep.py를 다시 실행해 주세요.', '']
    cur = None
    for f, q, o in ROWS:
        if f != cur:
            lines += ['', f'## {f}', '', '| 문장 | 정답 |', '|---|---|']; cur = f
        lines.append(f'| {q} | `{o}` |')
    open(os.path.join(OUT, 'representative.md'), 'w').write('\n'.join(lines) + '\n')
    print('문장', len(ROWS), '기능', len({f for f, _, _ in ROWS}))
