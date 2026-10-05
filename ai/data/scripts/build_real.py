# 팀원이 직접 말한 실제 문장(ai/data/seed/real_answers.md)에 정답을 붙인다. 문장과 정답은 ai/data/seed/real_rows.json에 있고, 고칠 때는 그 파일만 고친다
# 실행하면 정답을 검사하고 real.md(검토표)를 새로 만든다. 이 파일은 직접 고치지 않는다. 데이터(final.json)는 build_train.py가 ROWS를 읽어 만든다
# 다듬은 것: 숫자는 한글로(30도 -> 삼십도), 키보드 오타(꺠워 -> 깨워, 져녁 -> 저녁, 엿서시 -> 여섯시), 문장부호와 자모 조각 제거
# 뺀 것: 부위 낱말 목록(54, 55번), 멈춤 단어(34번, 모델을 거치지 않음), 뜻 없는 말(아, 야 삼십분, 티티리리티티비비)
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_rep import seed_out, load_seed, OUT
from check import parse

SEED = load_seed('real_rows.json')
ROWS = [(r['n'], r['func'], r['q'], seed_out(r)) for r in SEED['rows']]
# 학습 보류: 상황을 알아야 뜻이 정해지는데 지금 규격에 담을 출력이 없는 문장. 출력과 앱 처리 규칙을 정한 뒤 다시 본다
HOLD = set(SEED['hold'])
# 멈춤 단어(34번). 모델을 거치지 않고 앱이 STT 글자로 바로 멈춘다
STOP_WORDS = SEED['stop_words']

if __name__ == '__main__':
    errors = [(n, q, parse(o)) for n, f, q, o in ROWS if parse(o)]
    seen = {}
    for n, f, q, o in ROWS:
        if q in seen and seen[q] != o: errors.append((n, q, '같은 문장에 다른 정답'))
        seen[q] = o
    if errors:
        for e in errors: print('오류', e)
        sys.exit(1)
    missing = HOLD - {q for _, _, q, _ in ROWS}
    if missing: print('보류 목록에 없는 문장', missing); sys.exit(1)
    lines = ['# 실제 사람 문장과 정답 (검토용)', '', '이 파일은 build_real.py가 만듭니다. 고칠 때는 ai/data/seed/real_rows.json을 고치고 build_real.py를 다시 실행해 주세요. 받은 원래 문장은 ai/data/seed/real_answers.md에 있습니다.', '',
             '| 번호 | 기능 | 문장 | 정답 |', '|---|---|---|---|']
    lines += [f'| {n} | {f} | {q} | `{o}` |' for n, f, q, o in ROWS if q not in HOLD]
    lines += ['', '## 학습 보류 (상황이 필요해 출력과 앱 규칙을 정할 때까지 학습에 넣지 않음)', '', '| 번호 | 문장 | 지금 적어 둔 정답 |', '|---|---|---|']
    lines += [f'| {n} | {q} | `{o}` |' for n, f, q, o in ROWS if q in HOLD]
    lines += ['', '## 멈춤 단어 (모델을 거치지 않음)', '', ' / '.join(STOP_WORDS)]
    open(os.path.join(OUT, 'real.md'), 'w').write('\n'.join(lines) + '\n')
    print('문장', len(ROWS), '학습 보류', len(HOLD))
