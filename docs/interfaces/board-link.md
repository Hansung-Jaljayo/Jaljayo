# 보드 연결 형식

보드 앱이 WebSocket 서버(8765번)로 기다리고, 시연 화면(침대 역할)과 폰 앱이 각각 보드에 접속합니다. 모든 글은 JSON입니다. 판단과 저장은 보드가 맡습니다.

## 접속 직후

접속하면 자기 역할을 먼저 알립니다. 알리지 않으면 예전 PC 화면처럼 상태만 받습니다.

| 보내는 쪽 | 글 |
|---|---|
| 침대 역할 | `{ "type": "hello", "role": "bed" }` |
| 폰 앱 | `{ "type": "hello", "role": "phone" }` |

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
| `bed-find`, `bed-register` | `qr` | 등록 확인 |
| `bed-reset` | 없음 | 알람, 예약, 저장 자세 지움 |

`wifi-*`, `name-save`, `admin-*`는 아직 보드에 없어서 답하지 않습니다. 폰은 5초 뒤 실패로 처리합니다.

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
