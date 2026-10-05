# 침대 자세 명령 견본 (검토용)

이 파일은 samples_motion.py가 만듭니다. 기존 학습 데이터와 따로 둔 견본입니다.

- 모두 56문장: 가공 7개, 새로 쓴 것 49개 (파일에서 집계)
- 정답은 규격과 문장 전체의 뜻으로 정했습니다. 외부 자료는 표현을 참고했을 뿐 정답의 근거가 아닙니다.
- 짝: 비슷하지만 동작이 다른 문장끼리 같은 번호

## 출처

| 표기 | 자료 | 원문 | 라이선스 |
|---|---|---|---|
| M | Amazon MASSIVE 1.1, ko-KR (amazon-massive-dataset-1.1.tar.gz의 1.1/data/ko-KR.jsonl) | https://github.com/alexa/massive | CC BY 4.0 https://creativecommons.org/licenses/by/4.0/ |
| G | Google Home OpenClose 문서의 한국어 예시 | https://developers.home.google.com/cloud-to-cloud/traits/openclose | CC BY 4.0 (문서 본문) https://creativecommons.org/licenses/by/4.0/ |
| H | Home Assistant intents, sentences/ko/HassLightSet/name_brightness.yaml (main 브랜치, 2026-10-05 확인) | https://github.com/OHF-Voice/intents/blob/main/sentences/ko/HassLightSet/name_brightness.yaml | CC BY 4.0 https://github.com/OHF-Voice/intents/blob/main/LICENSE.md |
| F | Flexabed Voice Activation System 명령 목록 | https://flexabed.com/adjustable_bed_accessories/flexabed-accessories/voice-activation-system/ | 재사용 허가 미확인. 기능만 참고하고 문장은 새로 씀 |
| R | 팀원 실제 문장 말투 (real_answers.md). 이걸 참고한 문장은 회귀 평가와 가까움 | ai/data/seed/real_answers.md | 우리 자료 |
| D | 상세 설계서 | docs/system-design.md | 우리 자료 |

가공한 문장은 원문을 침대 명령에 맞게 고쳐 쓴 것입니다(대상, 동작, 말투를 바꿈).

| MASSIVE id | 원래 분할 | 원문 |
|---|---|---|
| 646 | train | 조명 조금만 올려줘 |
| 313 | train | 밝기 이십 퍼센트 높여줘 |
| 82 | train | 조명 최대로 올려주세요 |
| 690 | train | 너무 시끄러워 볼륨 낮춰 |

## 견본

| 묶음 | 기능 | 문장 | 정답 | 구분 | 출처 | 참고한 것 | 짝 |
|---|---|---|---|---|---|---|---|
| S01 | 부르기 | 잘 거니까 잠 자세로 바꿔 줘 | `<maum_0>(command=call, purpose=sleep)<maum_end>` | 가공 | M690 | 이유 + 명령 구조 |  |
| S02 | 부르기 | 티비 보기 편하게 맞춰 줄래 | `<maum_0>(command=call, purpose=tv)<maum_end>` | 새로 | D, R | 활동을 말해서 자세를 부름 |  |
| S03 | 부르기 | 책 좀 보려는데 책 볼 때 자세로 해 줘 | `<maum_0>(command=call, purpose=read)<maum_end>` | 새로 | D | 이유 + 목적 이름 |  |
| S04 | 부르기 | 쉬고 싶으니까 휴식 자세 해 주세요 | `<maum_0>(command=call, purpose=rest)<maum_end>` | 새로 | D | 이유 + 존댓말 부탁 |  |
| S05 | 부르기 | 저장해 둔 기본 자세로 가 줘 | `<maum_0>(command=call, purpose=base)<maum_end>` | 새로 | F | 저장 위치 부르기 | 짝1 |
| S06 | 조절 | 머리 쪽 조금만 올려 줘 | `<maum_0>(command=adjust, part=head, direction=up, amount=none, amount_type=none)<maum_end>` | 가공 | M646 | "조금만 올려" 표현 |  |
| S07 | 조절 | 다리 살짝만 내려 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` | 가공 | G | "살짝만 닫아 줘" 표현 |  |
| S08 | 조절 | 머리 오 도 내려 | `<maum_0>(command=adjust, part=head, direction=down, amount=5, amount_type=delta)<maum_end>` | 새로 | D | 숫자가 바꿀 양 | 짝2 |
| S09 | 조절 | 머리 오 도로 맞춰 | `<maum_0>(command=adjust, part=head, direction=none, amount=5, amount_type=target)<maum_end>` | 새로 | D | 숫자가 목표 각도, 방향은 앱이 정함 | 짝2 |
| S10 | 조절 | 머리 삼십 도까지 올려 줘 | `<maum_0>(command=adjust, part=head, direction=up, amount=30, amount_type=target)<maum_end>` | 새로 | D | 숫자가 목표 각도 | 짝3 |
| S11 | 조절 | 머리 이십 도 더 올려 줘 | `<maum_0>(command=adjust, part=head, direction=up, amount=20, amount_type=delta)<maum_end>` | 가공 | M313 | "이십 퍼센트 높여" 표현, 숫자가 바꿀 양 | 짝3 |
| S12 | 조절 | 다리 끝까지 올려 주세요 | `<maum_0>(command=adjust, part=leg, direction=up, amount=max, amount_type=target)<maum_end>` | 가공 | M82 | "최대로 올려주세요" 표현 |  |
| S13 | 조절 | 다리가 너무 높아서 그런데 좀 내려 줄래 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` | 가공 | M690 | 이유 + 명령 구조 |  |
| S14 | 조절 | 다리 오 도 아니 십 도 내려 | `<maum_0>(command=adjust, part=leg, direction=down, amount=10, amount_type=delta)<maum_end>` | 새로 | D | 고쳐 말하기 |  |
| S15 | 조절 | 머리 각도 이십 도로 | `<maum_0>(command=adjust, part=head, direction=none, amount=20, amount_type=target)<maum_end>` | 가공 | H | "밝기 50%로" 처럼 동사 없이 목표만 말함 |  |
| S16 | 되돌리기 | 방금 움직이기 전으로 돌려 줘 | `<maum_0>(command=undo)<maum_end>` | 새로 | D | 직전 상태로 | 짝4 |
| S17 | 되돌리기 | 아까가 훨씬 편했어 그걸로 다시 | `<maum_0>(command=undo)<maum_end>` | 새로 | R | "아까가 더 나았어" 말투 + 이유 |  |
| S18 | 되돌리기 | 괜히 바꿨네 되돌려 줄래 | `<maum_0>(command=undo)<maum_end>` | 새로 | R | 후회 + 부탁 |  |
| S19 | 부르기 | 저장해 둔 기본 자세로 돌아가 줘 | `<maum_0>(command=call, purpose=base)<maum_end>` | 새로 | F | 저장 위치 부르기. 되돌리기와 다름 | 짝4 |
| S20 | 저장 | 지금 이 자세 그대로 기억해 둬 | `<maum_0>(command=set_default, purpose=none)<maum_end>` | 새로 | F | 지금 자세 저장 | 짝1 |
| S21 | 저장 | 책 읽을 때는 이 각도로 저장해 줘 | `<maum_0>(command=set_default, purpose=read)<maum_end>` | 새로 | D | 목적별 저장 |  |
| S22 | 저장 | 티비 볼 때 쓸 자세로 지금 거 저장해 | `<maum_0>(command=set_default, purpose=tv)<maum_end>` | 새로 | D | 목적별 저장 |  |
| S23 | 저장 | 이게 딱 좋다 이걸로 기본 해 두자 | `<maum_0>(command=set_default, purpose=none)<maum_end>` | 새로 | R | "이걸로 고정" 말투 |  |
| S24 | 저장 | 독서 자세로 저장해 | `<maum_0>(command=set_default, purpose=read)<maum_end>` | 새로 | D | 저장 | 짝6 |
| S25 | 부르기 | 독서 자세로 가 | `<maum_0>(command=call, purpose=read)<maum_end>` | 새로 | D | 부르기 | 짝6 |
| S26 | 되돌리기 | 바꾸기 전으로 | `<maum_0>(command=undo)<maum_end>` | 새로 | D | 되돌리기 | 짝6 |
| S27 | 예약 | 열한 시 반 되면 잠 자세로 바꿔 줘 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=11:30, time_type=absolute)<maum_end>` | 새로 | D | 정해진 시각 |  |
| S28 | 예약 | 한 시간쯤 있다가 잘 수 있게 해 줘 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=01:00, time_type=relative)<maum_end>` | 새로 | D | 지금부터, 쯤은 값에 넣지 않음 |  |
| S29 | 예약 | 내일 아침 일곱 시에 쉬는 자세로 바꿔 둬 | `<maum_0>(command=reserve, purpose=rest, date=tomorrow, ampm=am, time=07:00, time_type=absolute)<maum_end>` | 새로 | D | 날짜 + 오전 + 시각 |  |
| S30 | 예약 | 열두 시에 잠 자세로 해 줘 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=12:00, time_type=absolute)<maum_end>` | 새로 | D | 잠 자세 예약(저장된 잠 자세 각도) | 짝7 |
| S31 | 예약 | 열두 시에 평평하게 해 줘 | `<maum_0>(command=reserve, purpose=flat, date=none, ampm=none, time=12:00, time_type=absolute)<maum_end>` | 새로 | D | 평평하게 예약(머리·다리 0도) | 짝7 |
| S32 | 예약 | 삼십 분 뒤에 잘 수 있게 해 줘 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative)<maum_end>` | 새로 | D | 잠 자세 예약 | 짝8 |
| S33 | 예약 | 삼십 분 뒤에 침대 평평하게 해 놔 | `<maum_0>(command=reserve, purpose=flat, date=none, ampm=none, time=00:30, time_type=relative)<maum_end>` | 새로 | D | 평평하게 예약 | 짝8 |
| S34 | 시각 바꾸기 | 예약 열 시로 바꿔 줘 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=10:00, time_type=absolute)<maum_end>` | 새로 | D | 새 시각 |  |
| S35 | 시각 바꾸기 | 잠 자세 예약 삼십 분 앞당겨 | `<maum_0>(command=change_reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=earlier)<maum_end>` | 새로 | D | 앞당기기 | 짝9 |
| S36 | 시각 바꾸기 | 예약을 원래보다 한 시간 늦춰 줄래 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=01:00, time_type=later)<maum_end>` | 새로 | D | 늦추기 | 짝9 |
| S37 | 시각 바꾸기 | 자세 예약 이십 분 일찍 해 줘 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=00:20, time_type=earlier)<maum_end>` | 새로 | D | 앞당기기 |  |
| S38 | 시각 바꾸기 | 독서 자세 예약을 원래보다 이십 분 늦춰 줘 | `<maum_0>(command=change_reserve, purpose=read, date=none, ampm=none, time=00:20, time_type=later)<maum_end>` | 새로 | D | 기준(원래 예약)을 밝힌 늦추기 |  |
| S39 | 시각 바꾸기 | 아직 안 졸리니까 예약 좀 늦춰 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=none, time_type=later)<maum_end>` | 새로 | D | 이유 + 얼마나 없음(방향은 남기고 기기가 얼마나인지 물음) | 짝11 |
| S52 | 시각 바꾸기 | 예약 좀 앞당겨 줘 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=none, time_type=earlier)<maum_end>` | 새로 | D | 얼마나 없이 앞당기기(기기가 얼마나인지 물음) | 짝11 |
| S53 | 시각 바꾸기 | 예약 시간 좀 바꿔 줘 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=none, time_type=none)<maum_end>` | 새로 | D | 방향도 시각도 없음(기기가 몇 시로 바꿀지 물음) | 짝11 |
| S54 | 시각 바꾸기 | 예약 내일 오전 아홉 시로 바꿔 | `<maum_0>(command=change_reserve, purpose=none, date=tomorrow, ampm=am, time=09:00, time_type=absolute)<maum_end>` | 새로 | D | 새 시각의 날짜는 남김 | 짝12 |
| S55 | 시각 바꾸기 | 내일 예약 한 시간 앞당겨 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=01:00, time_type=earlier)<maum_end>` | 새로 | D | 기존 예약을 가리키는 날짜는 버림(예약은 하나뿐) | 짝12 |
| S56 | 취소 | 내일 예약 취소해 | `<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>` | 새로 | D | 기존 예약을 가리키는 날짜는 버림(예약은 하나뿐) | 짝12 |
| S40 | 시각 바꾸기 | 예약 열두 시 반으로 미뤄 줄래 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=12:30, time_type=absolute)<maum_end>` | 새로 | D | 새 시각으로 미루기 |  |
| S41 | 시각 바꾸기 | 자세 예약 한 시간 연장해 줘 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=01:00, time_type=later)<maum_end>` | 새로 | D | 연장 = 늦추기 |  |
| S42 | 시각 바꾸기 | 예약 열 시 아니 열 시 반으로 바꿔 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=10:30, time_type=absolute)<maum_end>` | 새로 | D | 고쳐 말하기 |  |
| S43 | 시각 바꾸기 | 평평하게 해 둔 예약 열한 시로 바꿔 | `<maum_0>(command=change_reserve, purpose=flat, date=none, ampm=none, time=11:00, time_type=absolute)<maum_end>` | 새로 | D | 평평하게 예약의 시각만 바꿈 |  |
| S44 | 취소 | 자세 예약 없던 걸로 해 줘 | `<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>` | 새로 | D | 분명한 취소 | 짝5 |
| S45 | 취소 | 잠 자세 예약 취소해 | `<maum_0>(command=cancel_reserve, purpose=sleep, confirm=no)<maum_end>` | 새로 | D | 분명한 취소(목적 있음) | 짝10 |
| S46 | 취소 | 오늘은 밤새울 거야 | `<maum_0>(command=cancel_reserve, purpose=sleep, confirm=yes)<maum_end>` | 새로 | R | 간접 표현이라 확인 | 짝10 |
| S47 | 취소 | 나 그냥 깨어 있을래 | `<maum_0>(command=cancel_reserve, purpose=sleep, confirm=yes)<maum_end>` | 새로 | R | 간접 표현이라 확인 | 짝5 |
| S48 | 취소 | 알아서 잘 테니까 자동으로 바꾸지 마 | `<maum_0>(command=cancel_reserve, purpose=sleep, confirm=no)<maum_end>` | 새로 | R | "바꾸지 마"라고 분명히 시킴 |  |
| S49 | 취소 | 평평하게 해 둔 예약 취소해 | `<maum_0>(command=cancel_reserve, purpose=flat, confirm=no)<maum_end>` | 새로 | D | 평평하게 예약 취소 |  |
| S50 | 못 하는 일 | 침대 전체 높이 올려 줘 | `<maum_3>(reason=out_of_scope)<maum_end>` | 새로 | F | "Lift Up" 기능. 우리 침대에 없음 |  |
| S51 | 못 하는 일 | 일 번 자세로 해 줘 | `<maum_3>(reason=out_of_scope)<maum_end>` | 새로 | F | 번호 저장 자세. 우리는 목적 이름으로만 저장 |  |

## 앱 상황 견본

| 상황 | 말 | 앱이 하는 일 |
|---|---|---|
| 예약 없음 | 예약 삼십 분 늦춰 | 걸려 있는 예약이 없으면 새 예약을 만들지 않고 "걸려 있는 자세 예약이 없어요" |
| 자정 넘김 | 예약 한 시간 늦춰 | 밤 열한 시 반 예약이면 다음 날 영 시 반으로 날짜도 넘김 |
| 이미 지난 시각 | 예약 열 시로 바꿔 | 밤 열한 시에 말하면 오늘 열 시는 지났으니 내일인지 확인 |
| 목적 묻는 중 평평하게 | 평평하게 | "어떤 자세로 예약할까요?"라고 묻는 중이면 지금 움직이지 않고 예약 목표를 평평하게로 채움 |
| 평평하게 예약 시각 바꾸기 | 예약 삼십 분 앞당겨 | 걸려 있는 예약이 평평하게 예약이면 평평하게라는 목표는 그대로 두고 시각만 바꿈 |
| 목적이 다른 예약 | 평평하게 해 둔 예약 앞당겨 | 걸려 있는 예약이 독서 예약이면 바꾸지 않고 "걸려 있는 자세 예약이 없어요". 목적 검사를 시각 계산보다 먼저 함 |
| 날짜 없이 시각만 바꾸기 | 예약 열 시로 바꿔 | 날짜를 말하지 않았으면 기존 예약 날짜를 기준으로 바꿈 |
| 예약을 가리키는 날짜 | 모레 예약 취소해 | 걸려 있는 예약이 내일 오전 아홉 시 잠 자세 예약이어도 날짜는 보지 않고 그 예약을 취소. "내일 오전 아홉 시 잠 자세 예약을 취소할게요"처럼 실제 날짜로 안내 |
| 24시간 넘음 | 예약 내일 오전 아홉 시로 바꿔 | 아침 여덟 시에 말하면 25시간 뒤라 바꾸지 않고 기존 예약 유지. "자세 예약은 지금부터 24시간 이내로만 설정할 수 있어요" |

## 규격으로 담지 않은 표현

| 표현 | 이유 |
|---|---|
| 머리 반만 올려 | 비율을 담는 값이 지금 규격에 없습니다. 침대가 못 하는 일은 아니고, 이번 규격에서 비율 표현을 지원하지 않는 것입니다. 학습에 넣지 않습니다. |
