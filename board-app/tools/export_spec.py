# 파이썬 규격(ai/spec/<판>)에서 보드 앱이 읽는 규격 파일(app/src/main/assets/spec_<판>.json)을 뽑는다.
# 쓰는 법: python3 tools/export_spec.py v09
import json, sys, pathlib
sys.dont_write_bytecode = True
ver = sys.argv[1]
sys.path.insert(0, '/Users/lumos/Jaljayo/ai')
S = __import__(f'spec.{ver}.spec', fromlist=['SPEC'])
out = {'end': S.END,
       'spec': {f'{t}|{c or ""}': [[n, k] for n, _, k in fs] for (t, c), fs in S.SPEC.items()},
       'answers': dict(S.ANSWER_VALUES)}
p = pathlib.Path(__file__).resolve().parent.parent / f'app/src/main/assets/spec_{ver}.json'
text = json.dumps(out, ensure_ascii=False)
if len(sys.argv) > 2 and sys.argv[2] == '--print': print(text)
else: p.write_text(text); print(p, len(out['spec']))
