# 보드 연결 형식

보드 앱이 WebSocket 서버(8765번)로 기다리고, 시연 화면(침대 역할)과 폰 앱이 각각 보드에 접속합니다. 모든 글은 JSON입니다. 판단과 저장은 보드가 맡습니다.

## 접속 직후

접속하면 자기 역할을 먼저 알립니다. 알리지 않으면 예전 PC 화면처럼 상태만 받습니다.

| 보내는 쪽 | 글 |
|---|---|
| 침대 역할 | `{ "type": "hello", "role": "bed" }` |
| 폰 앱 | `{ "type": "hello", "role": "phone" }`. 병원 모드에서 침대 하나에만 붙으려면 `"bed": "사과"`를 더합니다(아래 병상용 절) |

시각은 기존과 같이 `{ "type": "time", "epochMs": 1762668000000 }`로 맞춥니다.

## 보드와 침대

실제 침대를 붙일 때는 시연 화면 자리에 침대 제어부가 들어갑니다. 침대 속도는 초당 6도입니다.

### 보드 → 침대

| type | 내용 |
|---|---|
| `bed-move` | `id` 명령 번호, `head`, `leg` 목표 각도. `snap`이 true면 움직이지 않고 그 각도로 바로 맞춥니다(접속 직후 한 번) |
| `bed-stop` | `id` 명령 번호. 지금 자리에서 멈춥니다 |

### 침대 → 보드: `bed-state`

```json
{ "type": "bed-state", "id": 3, "head": 24.5, "leg": 12.0, "targetHead": 30, "targetLeg": 20,
  "headMove": "up", "legMove": "stop", "result": null }
```

| 항목 | 값 |
|---|---|
| `id` | 지금 수행 중인 명령 번호 |
| `head`, `leg` | 현재 각도 |
| `targetHead`, `targetLeg` | 가고 있는 각도 |
| `headMove`, `legMove` | `up`, `down`, `stop` |
| `result` | 진행 중이면 `null`, 끝나면 `arrived`(도착), `stopped`(멈춤 명령), `error`(오류) |

보내는 때: 접속 직후 한 번, 움직이는 동안 0.2초마다, 끝날 때 `result`를 채워 한 번.

침대 역할이 접속해 있지 않으면 보드는 내부 시뮬레이션으로 각도를 셉니다.

### 침대 → 보드: `sensor`

압력 센서 값입니다. 침대 쪽이 약 0.2초마다 보냅니다.

```json
{ "type": "sensor", "occupied": false, "value": 42, "virtual": false }
```

| 항목 | 값 |
|---|---|
| `occupied` | 사람이 누워 있으면 true. 센서 값이 기준선 이상인지로 침대 쪽이 정합니다 |
| `value` | 센서 값(0에서 1023). 화면 표시용이고 보드 판정에는 쓰지 않습니다 |
| `virtual` | 키보드로 넣은 가상 값이면 true |

보드의 판정 규칙입니다.

- 침대 이탈 알람이 울리는 동안 `occupied: false`가 3초 이어지면 알람을 끕니다.
- 중간에 `occupied: true`가 오면 처음부터 다시 셉니다.
- 1초 넘게 값이 안 오면 모르는 상태로 보고 세지 않습니다. 센서가 끊겼다고 알람을 끄지 않습니다.
- 알람이 울리기 전부터 비어 있었어도 울린 뒤 3초를 채워야 합니다.

보드는 `state`의 `sensor` 칸에 `occupied`, `value`, `virtual`, `emptyMs`(비었음을 센 시간, 세지 않으면 `null`), `needMs`(3000)를 담아 돌려주고, 울리는 알람 종류를 `ringingType`으로 알려 줍니다.

### 보드 USB에 꽂은 나노(침대 버튼·압력 센서)

11/19부터 침대 버튼·압력 센서 나노(`firmware/bed_io/bed_io.ino`)를 보드 USB 허브에 바로 꽂으면 보드 앱이 직접 읽습니다(`net/UsbNano.kt`, `net/NanoLines.kt`). 맥 중계(`firmware/bridge/nano_bridge.py`)는 필요 없습니다.

- 연결: FTDI·CH34x·CP210x·CDC(정품 아두이노) USB 직렬 칩만 찾고, 115200bps 8N1로 엽니다. 뽑으면 닫고, 다시 꽂으면 다시 엽니다.
- 허락: 처음 꽂으면 보드 화면에 "잘자요 보드 앱을 열까요"(또는 "USB 장치에 액세스하도록 허용할까요") 창이 뜹니다. "항상"에 체크하고 확인을 누르면 다음부터 묻지 않습니다.
- 나노가 보내는 줄은 아래 글로 바꿔 시연 화면이 보내던 글과 같은 처리를 거칩니다.

| 나노 줄 | 보드가 받는 글 |
|---|---|
| `BTN SHORT` | `{ "type": "button" }` |
| `BTN LONG` | `{ "type": "button", "long": true }` |
| `FSR 값`(0.2초마다) | `{ "type": "sensor", "occupied": 값 > 300, "value": 값, "virtual": false }`. `NanoLines.FSR_ENABLED`가 true일 때만 |
| `READY` | 기록에 "나노 준비됨"만 남김 |

- 압력 센서는 아직 연결 전이라 값이 아무렇게나 떠다녀 `FSR_ENABLED = false`로 꺼 두었습니다. 센서를 꽂고 값을 확인한 뒤 켜고, 기준값 `FSR_THRESHOLD`(300)도 실제로 누웠을 때와 비었을 때 값을 재어 다시 맞춰야 합니다.
- 병원 모드에서는 `bed`에 이 보드에 실제로 붙은 침대 `NanoLines.NANO_BED`(지금은 사과)를 넣습니다. 맡은 침대에 사과가 없으면 맡은 첫 침대를 씁니다. 가정용은 `bed`를 넣지 않습니다.
- 기록: "나노 연결됨", "나노 버튼: 짧게/길게", "나노 끊김"(기록 태그 `JaljayoBoard`, 자세한 오류는 `JaljayoNano`).

## 병상용(침대 여러 대)

제품은 침대 한 대에 보드 한 대입니다. 병원 시연은 보드 한 대가 사과, 포도, 딸기 침대 세 대를 맡고, 침대마다 접속을 하나씩 받습니다. 구조와 이유는 `docs/ward-multi-bed-design.md`에 있습니다.

**폰:** `{ "type": "hello", "role": "phone", "bed": "사과" }`로 붙으면 보드는 그 폰에 사과 침대의 `app-state`만 보내고, 그 폰의 `req`는 사과 침대에만 적용합니다. 다른 침대를 불러도 폰은 사과 침대 그대로입니다. 사과 침대를 부르지 않은 때 폰이 움직이면 부른 침대는 바뀌지 않고, 움직임은 사과 침대 제어부로 갑니다. 병실에 없는 이름이거나 `bed`가 없으면 예전처럼 지금 부른 침대를 봅니다. 시연 폰 앱은 사과로 붙습니다.

`bed`에는 침대 고유 번호(`B7Q2-1`)나 지금 부르는 과일 이름을 넣습니다. 과일 이름은 병원 침대 목록(`hospital-beds.md`)의 `name`으로 찾으므로, 환자가 이름을 바꾸거나 사용을 끝낸 침대는 예전 이름으로 붙지 않습니다. `bed-register`로 등록한 폰도 그 침대에 붙습니다.

**부르는 이름과 침대 이름:** 침대 제어부(`hello role bed name`)·`turn`·`speech`·`button`·`sensor`·`demo`·`state.ward`의 `name`은 보드가 맡은 침대 이름(ward.txt의 사과·포도·딸기)이고, 바뀌지 않습니다. 사람이 부르는 이름은 병원 침대 목록의 `name`을 따르며, `state.ward` 칸마다 `call`(지금 부르는 이름, 없으면 null)로 함께 보냅니다.

### 접속

```json
{ "type": "hello", "role": "bed", "name": "포도" }
```

- 침대 이름마다 접속 하나입니다. 그 접속으로 그 침대의 `bed-move`, `bed-stop`만 가고, 그 접속에서 온 `bed-state`는 그 침대 값으로 받습니다. 글 모양은 위 "보드와 침대"와 같습니다.
- 접속하면 보드가 그 침대 각도로 바로 맞추는 `bed-move`(`snap: true`)를 한 번 보냅니다.
- 같은 이름으로 다시 접속하면 예전 접속을 끊고 새 접속을 씁니다.
- 병실에 없는 이름이면 보드가 접속을 끊습니다.
- `name`이 없으면 가정용 침대 역할입니다. 가정용 모드에서만 침대로 씁니다. 병원 모드에서는 이름 없는 화면을 침대로 쓰지 않고 상태 글만 보냅니다(예전처럼 화면 하나가 부른 침대를 번갈아 따라가는 방식은 없앴습니다).
- 움직이는 중에 접속이 끊기면 그 침대는 마지막으로 받은 각도에서 멈춘 것으로 보고, 다시 붙을 때까지 움직이지 않습니다. 한 번도 붙은 적 없는 침대는 시뮬레이션으로 셉니다.

### 보드 → 화면: `state`의 `ward` 배열

맨 위 칸(`angles`, `target`, `alarms` 등)은 지금 부른 침대 것 그대로입니다. 가정용 화면과 폰이 씁니다. `ward`는 병원용일 때만 있고, 침대마다 아래 칸이 있습니다.

```json
"ward": [
  { "name": "사과", "active": true, "linked": true,
    "head": 24, "leg": 12, "moving": true,
    "angles": { "head": 24.5, "leg": 12.0 }, "target": { "head": 30.0, "leg": 20.0 },
    "purpose": "read", "asking": false, "ringing": false, "ringingType": null,
    "reservation": { "label": "삼십 분 뒤", "purpose": "sleep", "inMin": 30 },
    "alarms": [ { "label": "내일 오후 12시", "type": "basic", "enabled": true } ],
    "presets": { "read": { "head": 50.0, "leg": 15.0 }, "tv": null, "rest": null, "sleep": null } }
]
```

| 항목 | 값 |
|---|---|
| `active` | 지금 부른 침대 |
| `linked` | 그 침대 제어부(시연 화면 침대)가 지금 붙어 있는지 |
| `head`, `leg` | 정수 각도(예전 화면용) |
| `angles`, `target` | 소수 한 자리 각도와 목표 |
| `purpose` | 지금 자세(`read`, `tv`, `rest`, `sleep`, `flat`) 또는 `null` |
| `asking` | 그 침대가 대답을 기다리는 중 |
| `ringing`, `ringingType` | 알람이 울리는 중인지, 종류(`basic`, `question`, `leave_bed`) |
| `reservation`, `alarms` | 맨 위 칸과 같은 모양 |
| `presets` | 폰 `app-state`의 `presets`와 같은 모양 |

### 보드 → 화면: `turn`, `speech`의 `bed`

```json
{ "type": "turn", "bed": "포도", "heard": "머리 올려", "output": "<maum_0>(...)<maum_end>", "say": "", "note": "...", "asrMs": 210, "llmMs": 900 }
{ "type": "speech", "bed": "사과", "say": "사과 침대, 머리를 올렸어요" }
```

- 이름 부르기 턴("네, 포도 침대예요")에도 부른 침대가 들어갑니다.
- 병실에 없는 이름을 부른 턴과 가정용은 `bed: null`입니다.

### 화면 → 보드

| 글 | 보드 처리 |
|---|---|
| `{ "type": "text", "text": "포도 침대" }` | 이름 부르기 |
| `{ "type": "text", "text": "삼십 이십 해줘" }` | 지금 부른 침대에 적용 |
| `{ "type": "button", "bed": "포도" }` | 그 침대를 부른 것처럼 바꾼 뒤 버튼 처리. 다른 침대 알람이 울리는 중이면 받지 않음. `long: true`면 길게 누름 |
| `{ "type": "sensor", "bed": "포도", "occupied": false, "value": 42, "virtual": true }` | 그 침대 센서로 받음(부른 침대는 바꾸지 않음) |
| `{ "type": "demo", "action": "alarm-now", "bed": "포도" }` | 시연(침대 2대 이상)일 때만. 그 침대의 다음 알람 회차를 지금 울림. 그 회차는 실제 시각에 다시 울리지 않음. 다른 침대 알람이 울리는 중이면 울리지 않음(알람은 하나만) |
| `{ "type": "demo", "action": "reservation-now", "bed": "사과" }` | 시연일 때만. 그 침대 예약 시각을 지금으로 바꿈. 보드가 시각을 알 때만 실행 |

`bed`가 없으면 지금 부른 침대에 적용합니다.

## 폰과 보드

### 요청과 답

```json
{ "type": "req", "id": 12, "name": "resv-save", "body": { "time": 1390, "off": 0, "purpose": "sleep", "head": 0, "leg": 0 } }
{ "type": "reply", "id": 12, "ok": true }
```

답은 요청을 보낸 폰에만 갑니다. 같은 접속에서 같은 `id`를 다시 보내면 다시 처리하지 않고 앞의 답을 그대로 돌려줍니다. 거절이면 `ok`가 false이고 `reason`에 이유가 들어갑니다.

| name | body | 처리 |
|---|---|---|
| `bed-move` | `head`, `leg` | 그 각도로 움직임 |
| `bed-stop` | 없음 | 지금 자리에서 멈춤 |
| `pose-save` | `preset`, `head`, `leg` | 자세별 각도 저장 |
| `pose-delete` | `preset` | 저장한 각도 지움 |
| `alarm-save` | `id`, `draft`, `overwrite` 또는 `id`, `on`, `overwrite` | 알람 저장 또는 켜고 끄기 |
| `alarm-delete` | `id` | 알람 지움 |
| `resv-save` | `time`, `off`, `purpose`, `head`, `leg` | 자세 예약 |
| `resv-cancel` | 없음 | 예약 취소 |
| `bed-find`, `bed-register` | `qr` (`bed-register`는 `replace`도) | 등록 확인. 병원용은 `hospital-beds.md`, 가정용은 `{ ok: true, ward: false, name: "잘자요" }` |
| `bed-reset` | 없음 | 알람, 예약, 저장 자세 지움 |

`alarm-save`의 `draft` 중 보드가 쓰는 칸은 아래와 같습니다.

- 소리 크기(1·2·3): 울릴 때 그 크기로 울립니다.
- 등받이 올리기(`lift`): 알람이 처음 울릴 때 압력 센서가 누워 있다고 할 때만 등받이를 30도로 올립니다. 이미 30도 이상이면 그대로 두고, 다시 울림(스누즈) 때는 올리지 않으며, 다리는 건드리지 않습니다.
- 이번만(`exc`): 반복 알람의 그날 시각·종류를 바꾸면 원래 알람은 그날 건너뛰고, 목록에 안 보이는 한 번짜리 알람을 따로 만들어 울립니다. `exc`는 날짜로 보관해 폰에 다시 돌려줍니다.

병원 관리 비밀번호(숫자 6자리)는 보드 하나에 하나입니다. 처음 값은 `123456`이고, 보드 `filesDir/admin_pass.json`에 소금값을 섞은 SHA-256 값으로 보관합니다.

| name | body | 답 |
|---|---|---|
| `admin-login` | `password` | 맞으면 `{ "ok": true }`이고 그 접속을 관리 접속으로 기억합니다. 틀리면 `{ "ok": false, "reason": "비밀번호가 맞지 않아요" }`. 5번 연달아 틀리면 60초 동안 맞아도 `ok: false`(이유: 잠시 뒤에 다시) |
| `admin-password` | `password`(새 비밀번호) | 관리 접속에서만 바꿉니다. 바꾸면 `{ "ok": true }`이고 다른 폰의 관리 접속은 끝납니다. 들어오지 않은 접속이거나 숫자 6자리가 아니면 `ok: false`와 `reason` |

접속이 끊기면 관리 접속도 끝납니다.

병원 침대 목록 요청 `admin-list`, `admin-add`, `admin-move`, `admin-remove`, `admin-end`, `admin-save`, `bed-find`, `bed-register`, `name-save`는 `hospital-beds.md`대로 답합니다. 보드 `filesDir/hospital_beds.json`에 침대 칸(고유 번호·호실·번호·이름)과 병원 설정(밤 시간·알람 쓰기)을 둡니다. 규격에 문장이 없는 거절 이유는 보드에서 이렇게 정했습니다.

| 경우 | `reason` |
|---|---|
| 가정용 보드에 `admin-*`(로그인·비밀번호 빼고)나 `name-save` | `병원용 침대가 아니에요` |
| `admin-move`로 병원 목록에 없는(빼 둔) 침대를 옮기려 할 때 | `병원 목록에 없는 침대예요` |
| `bed-register`에서 다른 환자 폰이 쓰는 중인데 `replace`가 false | `다른 폰이 이 침대를 쓰고 있어요` |
| `name-save`를 침대에 붙지 않은 폰이 보냄 | `먼저 침대를 등록해 주세요` |
| 칸이 빠지거나 값이 틀림 | `잘못된 요청이에요` |
| 알람 쓰기를 끈 병원에서 `alarm-save`(새로 만들거나 고침. 켜고 끄기는 받음) | `이 병원에서는 알람을 쓰지 않아요` |

`wifi-*`는 아직 보드에 없어서 답하지 않습니다. 폰은 5초 뒤 실패로 처리합니다.

### 보드 → 폰: `app-state`

상태가 바뀔 때와 움직이는 동안 약 0.15초마다 보냅니다.

| 항목 | 내용 |
|---|---|
| `angles`, `target` | `head`, `leg` |
| `moving` | 움직이는 중인지 |
| `clockOk` | 보드가 시각을 아는지 |
| `ringingId` | 울리는 알람 번호 또는 `null` |
| `alarms` | 알람 목록(폰의 `AlarmDraft`에 `id`, `on`을 더한 모양) |
| `resv` | 자세 예약(`time`, `off`, `purpose`, `head`, `leg`) 또는 `null` |
| `presets` | 자세별 저장 각도(`read`, `tv`, `rest`, `sleep`, 없으면 `null`) |
