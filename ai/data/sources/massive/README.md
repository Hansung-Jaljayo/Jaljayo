# MASSIVE 한국어 (ko-KR)

| 항목 | 내용 |
| --- | --- |
| 자료 | Amazon MASSIVE 1.1, 한국어(ko-KR) |
| 저장소 | https://github.com/alexa/massive |
| 받은 파일 | https://amazon-massive-nlu-dataset.s3.amazonaws.com/amazon-massive-dataset-1.1.tar.gz |
| 받은 날 | 2026-10-05 |
| 압축 파일 SHA-256 | `4cba5faa11c71437928e17cb1b9b3d8b8e727e7ea363a3a9a8045e19c0491577` |
| 사용 파일 | 압축 안의 `1.1/data/ko-KR.jsonl` (16,520줄) |
| 사용 파일 SHA-256 | `3f44944978e95b1b3c083a6b378fc15ddcee996ef3371f1ca10635c772b93037` |
| 라이선스 | CC BY 4.0 (`LICENSE`), 출처 안내는 `NOTICE.md` |

## 원본을 올리지 않는 이유

`ko-KR.jsonl`은 12MB이고 우리가 쓰는 것은 그중 일부 문장입니다. 원본은 저장소에 올리지 않고(`.gitignore`), 위 주소에서 받아 이 폴더에 두고 씁니다. 받은 뒤 SHA-256이 위 값과 같은지 확인합니다.

```sh
curl -LO https://amazon-massive-nlu-dataset.s3.amazonaws.com/amazon-massive-dataset-1.1.tar.gz
tar -xzf amazon-massive-dataset-1.1.tar.gz 1.1/data/ko-KR.jsonl
mv 1.1/data/ko-KR.jsonl ai/data/sources/massive/
shasum -a 256 ai/data/sources/massive/ko-KR.jsonl
```

## 가공 방법

- 문장의 원래 의도 이름은 후보를 찾는 데만 쓰고, 정답은 문장 뜻과 우리 규격(`ai/spec/spec.py`)으로 새로 붙입니다.
- 침대에 맞게 대상이나 말투를 고친 문장은 원문 id와 원래 분할(train, dev, test)을 함께 기록합니다. 지금까지 참고한 문장은 `ai/data/seed/motion_samples.json`의 `massive_used`에 있습니다.
- 가공한 문장도 CC BY 4.0 조건에 따라 출처와 변경 사실을 표시합니다.
