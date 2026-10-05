# 3차: 앞말(나·지금·그냥)을 모두 뗀 문장이 같으면 한 묶음으로 보고, 묶음 단위로 학습·검증·평가를 나눈다
# 평가 세트는 이 시점에 확정하며, 이후 데이터 수정과 모델 선정에 쓰지 않는다
import json, random, sys
from collections import defaultdict
sys.path.insert(0, '..')
from check_v01 import norm
random.seed(7)
pool = [tuple(r) for r in json.load(open('v2_pool.json'))['all']]
groups = defaultdict(lambda: defaultdict(list))
for r in pool: groups[r[0]][norm(r[2])].append(r)
split = {'train': [], 'val': [], 'test': []}
for f in sorted(groups):
    g = groups[f]; keys = sorted(g); random.shuffle(keys)
    total = sum(len(v) for v in g.values()); target = max(1, round(total * .15))
    b = {'test': [], 'val': [], 'train': []}
    for k in keys:
        dest = 'test' if len(b['test']) < target else 'val' if len(b['val']) < target else 'train'
        b[dest] += g[k]
    for s in split: split[s] += b[s]
json.dump(split, open('v3.json', 'w'), ensure_ascii=False, indent=0)
# 2차 비교용: 같은 풀을 문장 단위로 무작위 분할했을 때
random.seed(7); p = pool[:]; random.shuffle(p); n = len(p)
json.dump({'train': p[:int(n*.7)], 'val': p[int(n*.7):int(n*.85)], 'test': p[int(n*.85):]}, open('v2.json', 'w'), ensure_ascii=False, indent=0)
print({k: len(v) for k, v in split.items()})
