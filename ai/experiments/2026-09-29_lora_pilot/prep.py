# 수정 전(v1)과 수정 후(v3)의 train, val을 mlx-lm 학습 파일로 옮긴다. test는 쓰지 않는다
import json, os, collections
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'source_data') + '/'
PROMPT = '<|im_start|>Below is the query from the users, please choose the correct function and generate the parameters to call the function. Query: {q} Response:'
summary = {}
for cond, f in [('before', 'v1.json'), ('after', 'v3.json')]:
    d = json.load(open(P + f)); os.makedirs(f'data/{cond}', exist_ok=True)
    for s, out in [('train', 'train'), ('val', 'valid')]:
        with open(f'data/{cond}/{out}.jsonl', 'w') as w:
            for _, o, q in d[s]:
                w.write(json.dumps({'text': PROMPT.format(q=q) + ' ' + o}, ensure_ascii=False) + '\n')
    summary[cond] = {'source': f, 'train': len(d['train']), 'val': len(d['val']),
                     'train_by_func': dict(collections.Counter(x[0] for x in d['train']))}
json.dump({'prompt': PROMPT, 'conditions': summary}, open('data/summary.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(summary, ensure_ascii=False, indent=1))
