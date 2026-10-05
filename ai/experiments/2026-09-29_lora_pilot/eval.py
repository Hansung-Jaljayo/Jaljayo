# 고정된 평가 문장 25개로 한 조건을 채점한다. 사용: python eval.py <조건 이름> [어댑터 경로]
import json, os, sys, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'spec'))  # 9/29 당시 규격 파일은 남아 있지 않아 현재 규격을 씀(README 참고)
from check import parse
from mlx_lm import load, generate
PROMPT = json.load(open('data/summary.json'))['prompt']
MAX_TOKENS = 80
name = sys.argv[1]; adapter = sys.argv[2] if len(sys.argv) > 2 else None
model, tok = load('model/Llama-3.2-1B-Instruct-bf16', adapter_path=adapter)
E = json.load(open('eval_frozen.json'))
longest = max(len(tok.encode(' ' + e['gold'], add_special_tokens=False)) for e in E)
assert longest < MAX_TOKENS, longest
t0 = time.time(); rows = []
for e in E:
    raw = generate(model, tok, prompt=PROMPT.format(q=e['q']), max_tokens=MAX_TOKENS, verbose=False)
    n = len(tok.encode(raw, add_special_tokens=False))
    cut = raw.find('<maum_end>')
    out = raw[:cut + len('<maum_end>')].strip() if cut >= 0 else raw.strip()
    err = '끝 토큰 없음(잘림 포함)' if cut < 0 else parse(out)
    rows.append({**e, 'raw': raw, 'out': out, 'gen_tokens': n, 'truncated': cut < 0 and n >= MAX_TOKENS,
                 'format_error': err, 'correct': err is None and out == e['gold']})
sec = time.time() - t0
c = sum(r['correct'] for r in rows); fe = sum(r['format_error'] is not None for r in rows)
res = {'condition': name, 'adapter': adapter, 'max_tokens': MAX_TOKENS, 'longest_gold_tokens': longest,
       'correct': c, 'total': len(rows), 'accuracy': round(c / len(rows), 3), 'format_errors': fe,
       'truncated': sum(r['truncated'] for r in rows), 'eval_seconds': round(sec, 1), 'rows': rows}
json.dump(res, open(f'results/{name}.json', 'w'), ensure_ascii=False, indent=1)
print(name, f'{c}/{len(rows)}', 'format_errors', fe, 'truncated', res['truncated'], 'longest_gold', longest, f'{sec:.1f}s')
