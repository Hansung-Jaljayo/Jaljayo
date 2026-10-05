# 침대 자세 명령 견본. 기존 데이터(train.json 등)와 따로 둔다. 기준이 맞는지 확인한 뒤에 늘린다
# 실행하면 samples_motion.md(검토표)를 새로 만든다. 견본은 ai/data/seed/motion_samples.json에 있고, 고칠 때는 그 파일만 고친다
# 정답은 규격(ai/spec/spec.py)과 문장 전체의 뜻으로 정한다. 외부 자료는 표현을 참고했을 뿐 정답의 근거가 아니다
# 구분: 가공 = 공개 자료 문장을 침대 말로 고쳐 씀 / 새로 = 기능이나 표현 방식만 참고해 새로 씀
# 묶음: 같은 원문에서 나온 변형은 같은 묶음 번호. 학습과 평가로 나눌 때 묶음 단위로 나눈다
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_rep import seed_out, load_seed, OUT
from check import parse

SEED = load_seed('motion_samples.json')
# 실제로 열어서 확인한 자료만 적는다
SOURCES = {k: (v['name'], v['url'], v['license'], v['license_url']) for k, v in SEED['sources'].items()}
# MASSIVE에서 참고한 문장: id -> (원래 분할, 원문)
MASSIVE_USED = {k: (v['split'], v['text']) for k, v in SEED['massive_used'].items()}
# (묶음, 기능, 문장, 정답, 구분, 출처, 참고한 것, 짝)
ROWS = [(r['group'], r['func'], r['q'], seed_out(r), r['kind'], r['source'], r['ref'], r['pair']) for r in SEED['rows']]
# 앱 상황 견본: 모델 출력은 같고 앱이 상황을 보고 처리하는 것
SITUATIONS = [(r['case'], r['q'], r['app']) for r in SEED['situations']]
# 규격으로 담지 않기로 한 표현
NOT_FIT = [(r['q'], r['reason']) for r in SEED['not_fit']]

if __name__ == '__main__':
    errs = [(q, parse(o)) for _, _, q, o, *_ in ROWS if parse(o)]
    if errs:
        for e in errs: print('오류', e)
        sys.exit(1)
    for _, _, q, o, k, s, *_ in ROWS:
        for part in [x.strip() for x in s.split(',')]:
            if part[0] not in SOURCES or (part[0] == 'M' and part[1:] not in MASSIVE_USED): print('출처 표기 오류', q, s); sys.exit(1)
    n_gagong = sum(1 for r in ROWS if r[4] == '가공'); n_new = len(ROWS) - n_gagong
    L = ['# 침대 자세 명령 견본 (검토용)', '', '이 파일은 samples_motion.py가 만듭니다. 기존 학습 데이터와 따로 둔 견본입니다.', '',
         f'- 모두 {len(ROWS)}문장: 가공 {n_gagong}개, 새로 쓴 것 {n_new}개 (파일에서 집계)',
         '- 정답은 규격과 문장 전체의 뜻으로 정했습니다. 외부 자료는 표현을 참고했을 뿐 정답의 근거가 아닙니다.',
         '- 짝: 비슷하지만 동작이 다른 문장끼리 같은 번호', '', '## 출처', '', '| 표기 | 자료 | 원문 | 라이선스 |', '|---|---|---|---|']
    L += [f'| {k} | {n} | {u} | {lic}{(" " + lu) if lu else ""} |' for k, (n, u, lic, lu) in SOURCES.items()]
    L += ['', '가공한 문장은 원문을 침대 명령에 맞게 고쳐 쓴 것입니다(대상, 동작, 말투를 바꿈).', '', '| MASSIVE id | 원래 분할 | 원문 |', '|---|---|---|']
    L += [f'| {i} | {p} | {t} |' for i, (p, t) in MASSIVE_USED.items()]
    L += ['', '## 견본', '', '| 묶음 | 기능 | 문장 | 정답 | 구분 | 출처 | 참고한 것 | 짝 |', '|---|---|---|---|---|---|---|---|']
    L += [f'| {g} | {f} | {q} | `{o}` | {k} | {s} | {n} | {pair} |' for g, f, q, o, k, s, n, pair in ROWS]
    L += ['', '## 앱 상황 견본', '', '| 상황 | 말 | 앱이 하는 일 |', '|---|---|---|'] + [f'| {a} | {b} | {c} |' for a, b, c in SITUATIONS]
    L += ['', '## 규격으로 담지 않은 표현', '', '| 표현 | 이유 |', '|---|---|'] + [f'| {q} | {r} |' for q, r in NOT_FIT]
    open(os.path.join(OUT, 'samples_motion.md'), 'w').write('\n'.join(L) + '\n')
    print('견본', len(ROWS), '가공', n_gagong, '새로', n_new)
