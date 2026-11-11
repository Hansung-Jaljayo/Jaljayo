# board-app · 잘자요 보드 앱

QCS6490 보드에서 도는 침대의 두뇌입니다. 말을 듣고, 언어 모델로 기능 호출 코드를 만들고, 상황을 보고 침대를 움직이고 대답합니다. 실제 제품에는 화면이 없습니다.

```
마이크 → 말 끝 감지(silero VAD) → 음성 인식(SenseVoice) → 다듬기·부르는 말 확인
      → (단독 정지 말이면 모델 없이 바로 멈춤)
      → 언어 모델(llama.cpp, 16차 모델 8비트) → 규격 검사 → 두뇌(상황별 처리)
      → 움직임(지금은 시뮬레이션) · 알림 소리 · 대답 소리(Supertonic) · PC로 상태 보내기(WebSocket 8765)
```

## 폴더

| 위치 | 내용 |
|---|---|
| `brain/Spec.kt` | 모델 출력 규격 검사. `ai/spec/v09/check.py`와 같은 판단(9차 학습·보강·평가 후보 정답 16,914개로 확인). 규격 파일은 `tools/export_spec.py v09`로 뽑음. 7차·8차 모델(v0.8)의 skip·disable 출력은 `Spec.upgrade`로 v0.9 skip으로 옮긴 뒤 검사 |
| `brain/Brain.kt` | 16차 모델의 세부 기능 82종 처리. 17차에 생긴 새 명령 4개(듣고 있는지 묻기, 각도 예약, 조절 예약, 예약 자세 바꾸기)는 아직 처리하지 않음. 기준은 데이터시트의 "상황별 침대 동작"과 `docs/system-design.md` |
| `brain/Alarms.kt` | 알람 장부(다음 울릴 때 계산, 말로 가리킨 알람 찾기) |
| `brain/Hearing.kt` | 음성 인식 결과 다듬기(문장부호 제거, 숫자를 한글로, "모래"를 "모레"로), 부르는 말("잘자요", 잘못 들린 "살 자요"·"별 자요" 포함) 떼기 |
| `brain/BedSim.kt` | 침대 역할이 접속해 있지 않을 때 각도를 움직이는 시뮬레이션(초당 6도) |
| `model/CommandModel.kt` | 문장 → 모델 출력. 지금은 llama.cpp, 양자화 모델이 오면 이 자리만 Genie(NPU)로 바꿈 |
| `audio/` | 말 듣기(작은 소리 자동 키움, 말하는 중 "잘자요"로 끊기), 말하기(Supertonic, 쉼표 쉼, 문장 단위로 만들며 말하기, 자주 하는 문장 미리 만들기), 알림 소리, 알람 소리 |
| `net/Hub.kt` | PC(시연 화면·언리얼)·폰과 주고받는 창구 |
| `net/BedLink.kt` | 침대 역할에 명령을 보내고 돌려준 각도를 받는 부분(`docs/interfaces/board-link.md`) |
| `net/AppApi.kt` | 폰 앱 요청 처리와 폰에 보낼 상태 |
| `BoardService.kt` | 전체를 묶는 서비스. 상태는 한 줄에서만 바꾸고, 멈춘 뒤 늦게 온 모델 결과는 버림 |
| `Store.kt` | 알람·자세 예약·저장 자세를 파일에 남김(앱을 다시 켜도 유지) |
| `BoardClock.kt` | 받은 시각을 기억해 앱을 다시 켜도 스스로 계산. 보드가 인터넷 시각을 받으면 그것을 씀 |

## 준비

음성 모델·라이브러리·실행 파일은 크기와 출처 조건 때문에 레포에 올리지 않습니다. 아래 스크립트로 모읍니다.

```
tools/fetch_assets.sh <SUDA 앱 base.apk> <llama.cpp 안드로이드 빌드 llama-server>
```

- 음성 인식·말 끝 감지: 선배 팀 SUDA 앱(`com.suda.agent`)에 들어 있는 모델
- 목소리: sherpa-onnx 공식 Supertonic 3(8비트, 스크립트가 인터넷에서 받음). 앱은 한국어 여자 목소리 3번을 씀
- sherpa-onnx 라이브러리: v2.0.1 공식 안드로이드 배포본(Supertonic은 2.0.1 이상 필요, 스크립트가 받음)
- 언어 모델 파일: 보드 `/data/local/tmp/jaljayo_llm/v16-ans-q8_0.gguf`(16차, 8비트). 앱에는 넣지 않음

## 빌드와 설치

```
./gradlew :app:testDebugUnitTest   # 맥에서 규격·두뇌·알람 시험
./gradlew :app:assembleDebug
adb install -r -g app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.jaljayo.board/.MainActivity
adb forward tcp:8765 tcp:8765
```

PC 화면은 시연 화면 주소 뒤에 `?board=ws://127.0.0.1:8765`를 붙여 엽니다. 연결되면 PC 시각을 보드에 보내 줍니다. 보드는 받은 시각을 기억하고, 한 번도 시각을 받지 못했고 인터넷 시각도 없을 때만 알람·예약을 하지 않습니다.

## PC와 주고받는 내용(WebSocket 8765, JSON)

| 방향 | type | 내용 |
|---|---|---|
| 보드 → PC | `state` | 각도(시뮬레이션 값), 움직이는 중, 자세, 자세 예약, 알람 목록, 알람 울림, 물어보는 중 |
| 보드 → PC | `turn` | 들은 말, 모델 출력, 대답, 설명, 음성 인식·모델 시간 |
| 보드 → PC | `speech` | 다 움직인 뒤 한 말 |
| PC → 보드 | `text` | 시험용 글자 입력(부르는 말 없이 처리) |
| PC → 보드 | `button` | 물리 버튼 |
| PC → 보드 | `sensor` | 압력 센서(`occupied`: 누워 있음 여부) |
| PC → 보드 | `time` | 시각 맞추기(`epochMs`) |
| PC → 보드 | `always` | 부르는 말 없이 듣기 켜고 끄기(시험용) |

## 아직 대신하고 있는 것

- 모터: 시뮬레이션 각도. 실제 침대 제어부 신호로 바꿀 자리는 `BoardService.tick()`
- 버튼·압력 센서: 부품이 오기 전까지 PC에서 보내는 신호
- 폰 앱 연결: 알람·예약·자세·움직임은 있음. 와이파이 처음 설정·이름·병원 관리는 아직 없음
- 언어 모델: CPU(llama.cpp, 짧은 명령 약 1초에서 알람 명령 약 4초). NPU 양자화 모델로 바꾸면 1초 안팎이 목표
