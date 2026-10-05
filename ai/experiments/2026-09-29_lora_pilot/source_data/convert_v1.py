# 1차 데이터의 정답 표기만 규격 v0.1로 바꾼다. 입력 문장과 뜻은 그대로 둔다
import json, re, sys
sys.path.insert(0, '..')
from spec_v01 import render
v1 = json.load(open('../v1.json'))
def conv(out):
    tok, body = re.match(r'^<(\w+)>\((.*)\)<jal_end>$', out).groups()
    kv = dict(re.findall(r'(\w+)="([^"]*)"', body))
    if tok == 'pose':
        c = kv.pop('command')
        return render('maum_0', [('command', c)] + list(kv.items()))
    if tok == 'alarm':
        c = kv.pop('command')
        if c == 'set':
            return render('maum_1', [('command', 'set'), ('date', kv['day']), ('ampm', kv['ampm']), ('time', kv['time']), ('type', kv['type']), ('repeat', 'none'), ('days', 'none')])
        return render('maum_1', [('command', c)] + list(kv.items()))
    if tok == 'answer':
        return render('maum_2', list(kv.items()))
    raise ValueError(out)
out = {s: [[f, conv(o), q] for f, o, q in rows] for s, rows in v1.items()}
json.dump(out, open('v1.json', 'w'), ensure_ascii=False, indent=0)
print({k: len(v) for k, v in out.items()})
