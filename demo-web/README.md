# demo-web · 침대 시연 화면

보드 앱과 WebSocket(8765)으로 연결해 침대 역할을 하는 시연 화면입니다. 가정용과 병상용 두 가지가 있습니다.

| 폴더 | 내용 | 여는 법 |
| --- | --- | --- |
| `site/` | 가정용 화면. 빌드 없이 그대로 여는 HTML·JS·CSS(three.js r160 사용) | `site/` 폴더를 웹 서버로 열기. 보드와 이을 때는 주소 뒤에 `?board=ws://<보드 주소>:8765` |
| `site/ward/index.html` | 병상용 화면을 감싸는 틀. 안쪽 `site/ward/content/`에 `ward-app` 빌드 결과를 넣음 | 가정용 화면 오른쪽 아래 "병상용" 버튼 |
| `ward-app/` | 병상용 화면(3인실) React 소스(Vite, react-three-fiber) | `npm ci` → `npm run dev`, 넣을 때는 `npm run build` 결과(`dist/`)를 `site/ward/content/`로 복사 |
| `ASSET_CREDITS.md` | 화면에 쓴 에셋의 출처·라이선스·바꾼 점 | - |

- `site/assets/three/`는 three.js r160(MIT, `LICENSE` 포함)의 필요한 파일만 넣은 것입니다.
- `ward-app/gen_commands.py`는 가정용 `site/console/commands.js`와 병상용 `ward-app/src/commands.ts`를 같은 내용으로 만드는 코드입니다. 경로는 저장소 안 상대 경로라 그대로 실행됩니다.
- 빌드 결과(`dist/`)와 `node_modules/`는 올리지 않습니다.

## 에셋과 출처

화면이 실제로 불러오는 3D 모델·질감·하늘·나무 그림·글꼴만 넣었습니다. 파일마다 원본 주소, 만든 사람, 라이선스, 바꾼 점은 **`ASSET_CREDITS.md`**에 있습니다.

- 외부 자료는 Poly Haven(CC0), Wikimedia 프라하 사진(CC BY-SA 4.0, `view.jpg`·`city-prague.webp` 두 파일), Noto Emoji(Apache 2.0), 글꼴(SIL OFL 1.1), three.js 등 라이브러리(MIT 등)입니다.
- 라이선스 전문: `site/fonts/Pretendard-License.txt`, `site/fonts/Nanum-Pen-License.txt`, `ward-app/public/Nanum-Pen-License.txt`, `ward-app/public/fruit/LICENSE-Apache-2.0.txt`, `site/assets/three/LICENSE`, `ward-app/public/THIRD_PARTY_LICENSES.txt`
- `site/assets/suite.glb`는 48MB로 GitHub 경고선(50MB)에 가깝습니다.
