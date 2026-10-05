# 실제 사람 문장과 정답 (검토용)

이 파일은 build_real.py가 만듭니다. 고칠 때는 ai/data/seed/real_rows.json을 고치고 build_real.py를 다시 실행해 주세요. 받은 원래 문장은 ai/data/seed/real_answers.md에 있습니다.

| 번호 | 기능 | 문장 | 정답 |
|---|---|---|---|
| 1 | 목적 자세 부르기 | 하아아아 책을래 | `<maum_0>(command=call, purpose=read)<maum_end>` |
| 2 | 목적 자세 부르기 | 티비 볼랜다 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 2 | 목적 자세 부르기 | 테레비 볼랜다 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 2 | 목적 자세 부르기 | 축구 볼랜다 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 2 | 목적 자세 부르기 | 뉴스 볼랜다 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 3 | 자세 조절 | 평평 | `<maum_0>(command=adjust, part=both, direction=down, amount=0, amount_type=target)<maum_end>` |
| 3 | 목적 자세 부르기 | 잘래 | `<maum_0>(command=call, purpose=sleep)<maum_end>` |
| 3 | 목적 자세 부르기 | 눕혀 | `<maum_0>(command=call, purpose=sleep)<maum_end>` |
| 4 | 목적 자세 부르기 | 휴식 | `<maum_0>(command=call, purpose=rest)<maum_end>` |
| 4 | 목적 자세 부르기 | 휴식 모드 온 | `<maum_0>(command=call, purpose=rest)<maum_end>` |
| 4 | 목적 자세 부르기 | 쉴래 | `<maum_0>(command=call, purpose=rest)<maum_end>` |
| 4 | 목적 자세 부르기 | 쉬는 자세 해줘 | `<maum_0>(command=call, purpose=rest)<maum_end>` |
| 4 | 목적 자세 부르기 | 쉬고 싶구나 침대야 | `<maum_0>(command=call, purpose=rest)<maum_end>` |
| 4 | 목적 자세 부르기 | 쉬어 보자 좀 | `<maum_0>(command=call, purpose=rest)<maum_end>` |
| 5 | 자세 조절 | 살짝 내려 | `<maum_0>(command=adjust, part=none, direction=down, amount=none, amount_type=none)<maum_end>` |
| 5 | 자세 조절 | 좀만 내려바 | `<maum_0>(command=adjust, part=none, direction=down, amount=none, amount_type=none)<maum_end>` |
| 5 | 자세 조절 | 좀 낮춰 | `<maum_0>(command=adjust, part=none, direction=down, amount=none, amount_type=none)<maum_end>` |
| 5 | 자세 조절 | 너무 높아 | `<maum_0>(command=adjust, part=none, direction=down, amount=none, amount_type=none)<maum_end>` |
| 5 | 자세 조절 | 좀 내려가바 | `<maum_0>(command=adjust, part=none, direction=down, amount=none, amount_type=none)<maum_end>` |
| 6 | 자세 조절 | 다리 좀 올려 | `<maum_0>(command=adjust, part=leg, direction=up, amount=none, amount_type=none)<maum_end>` |
| 6 | 자세 조절 | 다리 들어 | `<maum_0>(command=adjust, part=leg, direction=up, amount=none, amount_type=none)<maum_end>` |
| 6 | 자세 조절 | 다리쪽 올려바 | `<maum_0>(command=adjust, part=leg, direction=up, amount=none, amount_type=none)<maum_end>` |
| 6 | 대답 | 다리 | `<maum_2>(type=part, value=leg)<maum_end>` |
| 7 | 자세 조절 | 삼십도 해줘 | `<maum_0>(command=adjust, part=none, direction=none, amount=30, amount_type=target)<maum_end>` |
| 7 | 자세 조절 | 삼십도 맞춰 | `<maum_0>(command=adjust, part=none, direction=none, amount=30, amount_type=target)<maum_end>` |
| 7 | 자세 조절 | 삼십도로 올려 | `<maum_0>(command=adjust, part=none, direction=up, amount=30, amount_type=target)<maum_end>` |
| 7 | 자세 조절 | 삼십도 해라 | `<maum_0>(command=adjust, part=none, direction=none, amount=30, amount_type=target)<maum_end>` |
| 7 | 자세 조절 | 삼십도라 했다 난 | `<maum_0>(command=adjust, part=none, direction=none, amount=30, amount_type=target)<maum_end>` |
| 7 | 자세 조절 | 삼십도 파딱파딱 | `<maum_0>(command=adjust, part=none, direction=none, amount=30, amount_type=target)<maum_end>` |
| 8 | 되돌리기 | 야 직전으로 | `<maum_0>(command=undo)<maum_end>` |
| 8 | 되돌리기 | 야 전이 나 | `<maum_0>(command=undo)<maum_end>` |
| 8 | 되돌리기 | 야 전으로 | `<maum_0>(command=undo)<maum_end>` |
| 8 | 되돌리기 | 아까로 돌려 | `<maum_0>(command=undo)<maum_end>` |
| 8 | 되돌리기 | 아까로 가자 | `<maum_0>(command=undo)<maum_end>` |
| 8 | 대답 | 개별론데 | `<maum_2>(type=bad, value=none)<maum_end>` |
| 8 | 대답 | 불편해 | `<maum_2>(type=bad, value=none)<maum_end>` |
| 9 | 기본 정하기 | 책 자세 이걸로 고정 | `<maum_0>(command=set_default, purpose=read)<maum_end>` |
| 9 | 기본 정하기 | 책각도 이걸로 고정 | `<maum_0>(command=set_default, purpose=read)<maum_end>` |
| 9 | 기본 정하기 | 독서 각도 이걸로해 | `<maum_0>(command=set_default, purpose=read)<maum_end>` |
| 9 | 기본 정하기 | 독서는 이걸로 | `<maum_0>(command=set_default, purpose=read)<maum_end>` |
| 9 | 기본 정하기 | 책은 이걸로 | `<maum_0>(command=set_default, purpose=read)<maum_end>` |
| 11 | 자세 예약 | 열한시 반에 수면 자세로 해줘 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=11:30, time_type=absolute)<maum_end>` |
| 11 | 자세 예약 | 열한시 반에 잠자세 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=11:30, time_type=absolute)<maum_end>` |
| 11 | 자세 예약 | 열한시반에 잘게 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=11:30, time_type=absolute)<maum_end>` |
| 12 | 자세 예약 | 삼십분 뒤에 잘게 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative)<maum_end>` |
| 12 | 자세 예약 | 삼십분 뒤 잠 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative)<maum_end>` |
| 12 | 자세 예약 | 삼십분 뒤에 골아떨어질게 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative)<maum_end>` |
| 12 | 자세 예약 | 삼십분 뒤에 기절할게 | `<maum_0>(command=reserve, purpose=sleep, date=none, ampm=none, time=00:30, time_type=relative)<maum_end>` |
| 13 | 예약 늦추기 | 야 자세 예약 미뤄 | `<maum_0>(command=change_reserve, purpose=none, date=none, ampm=none, time=none, time_type=later)<maum_end>` |
| 13 | 예약 늦추기 | 야 나 좀 더 있다 잘래 | `<maum_0>(command=change_reserve, purpose=sleep, date=none, ampm=none, time=none, time_type=later)<maum_end>` |
| 13 | 예약 취소 | 예약 전부 취소 | `<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>` |
| 14 | 알람 설정 | 내일 일곱시 기상 | `<maum_1>(command=set, date=tomorrow, ampm=none, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 14 | 알람 설정 | 일곱시에 깨워줘 | `<maum_1>(command=set, date=none, ampm=none, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 14 | 알람 설정 | 일곱시에 일어나야됨 | `<maum_1>(command=set, date=none, ampm=none, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 14 | 알람 설정 | 일곱시에 네가 일해라 | `<maum_1>(command=set, date=none, ampm=none, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 15 | 알람 설정 | 매일 아침 일곱시 알람 맞춰줘 | `<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>` |
| 15 | 알람 설정 | 난 이제 앞으로 아침 일곱시에 일어날거야 | `<maum_1>(command=set, date=none, ampm=am, time=07:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>` |
| 15 | 알람 설정 | 난 항상 앞으로 일곱시 | `<maum_1>(command=set, date=none, ampm=none, time=07:00, time_type=absolute, type=none, repeat=weekly, days=daily, confirm=no)<maum_end>` |
| 16 | 알람 시각 바꾸기 | 야 내일만 여덟시 | `<maum_1>(command=change_time, target=none, target_ampm=none, target_days=none, date=tomorrow, ampm=none, time=08:00, time_type=absolute, scope=once)<maum_end>` |
| 17 | 알람 종류 바꾸기 | 내일은 알람 침대에서 나와야 꺼지게 해줘 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=tomorrow, type=leave_bed, scope=once)<maum_end>` |
| 17 | 알람 종류 바꾸기 | 나 완전히 일어나기 전까진 계속 울리게 해 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=leave_bed, scope=none)<maum_end>` |
| 18 | 잠시 끄기 | 앞으로 이십칠일까지 휴가니까 알람 다 꺼 | `<maum_1>(command=disable, target=all, target_ampm=none, target_days=none, until=D27, period=none)<maum_end>` |
| 18 | 잠시 끄기 | 오일 간 휴가야 알림 꺼 | `<maum_1>(command=disable, target=none, target_ampm=none, target_days=none, until=none, period=5)<maum_end>` |
| 19 | 다시 켜기 | 좋은 시간 다 갔다 다 키자 | `<maum_1>(command=enable, target=all, target_ampm=none, target_days=none)<maum_end>` |
| 19 | 일반 대화 | 휴가 끝났다 | `<General_Conversation>()<maum_end>` |
| 19 | 일반 대화 | 이제 다쉬었어 뭐해야될 지 알지 | `<General_Conversation>()<maum_end>` |
| 20 | 삭제 | 야 그 수요일 오전 일곱시 알람 있지 그거 삭제해 | `<maum_1>(command=delete, target=07:00, target_ampm=am, target_days=wed)<maum_end>` |
| 20 | 끄기 | 수요일 아침 알람 필요없어 이제 | `<maum_1>(command=off, target=none, target_ampm=am, target_days=wed)<maum_end>` |
| 21 | 대답 | 십오 | `<maum_2>(type=number, value=15)<maum_end>` |
| 21 | 대답 | 십오 세끼야 | `<maum_2>(type=number, value=15)<maum_end>` |
| 22 | 질문 알람 미루기 | 조용히 해 더 자게 | `<maum_1>(command=snooze, minutes=none)<maum_end>` |
| 23 | 질문 알람 미루기 | 닥쳐 | `<maum_1>(command=snooze, minutes=none)<maum_end>` |
| 23 | 질문 알람 미루기 | 닥쳐 더 자게 | `<maum_1>(command=snooze, minutes=none)<maum_end>` |
| 24 | 지원하지 않는 요청 | 침대야 불좀 끄고 와라 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 25 | 일반 대화 | 하이 | `<General_Conversation>()<maum_end>` |
| 25 | 일반 대화 | 굿모닝 | `<General_Conversation>()<maum_end>` |
| 25 | 일반 대화 | 안녕 | `<General_Conversation>()<maum_end>` |
| 25 | 일반 대화 | 잘 잤어 | `<General_Conversation>()<maum_end>` |
| 26 | 대답 | 어 | `<maum_2>(type=yes, value=none)<maum_end>` |
| 26 | 대답 | 응 | `<maum_2>(type=yes, value=none)<maum_end>` |
| 26 | 대답 | 맞아 | `<maum_2>(type=yes, value=none)<maum_end>` |
| 26 | 대답 | 그렇게 해 | `<maum_2>(type=yes, value=none)<maum_end>` |
| 26 | 대답 | 맞다고 | `<maum_2>(type=yes, value=none)<maum_end>` |
| 26 | 대답 | 음 아니 음 맞아 | `<maum_2>(type=yes, value=none)<maum_end>` |
| 27 | 대답 | 아니 | `<maum_2>(type=no, value=none)<maum_end>` |
| 27 | 대답 | 저녁이라고 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 밤이라고 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 오후에 맞추라고 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 저녁 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 밤 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 오후 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 아침에 말고 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 오전에 말고 | `<maum_2>(type=ampm, value=pm)<maum_end>` |
| 27 | 대답 | 저녁 일곱시 | `<maum_2>(type=time, value=pm_07:00)<maum_end>` |
| 29 | 목적 자세 부르기 | 야 기본 | `<maum_0>(command=call, purpose=base)<maum_end>` |
| 29 | 목적 자세 부르기 | 기본만 해 | `<maum_0>(command=call, purpose=base)<maum_end>` |
| 29 | 목적 자세 부르기 | 기본으로 가자 | `<maum_0>(command=call, purpose=base)<maum_end>` |
| 29 | 목적 자세 부르기 | 야 늘 하던 그 자세 | `<maum_0>(command=call, purpose=base)<maum_end>` |
| 30 | 대답 | 안 맞출래 | `<maum_2>(type=cancel, value=none)<maum_end>` |
| 30 | 대답 | 됐어 | `<maum_2>(type=cancel, value=none)<maum_end>` |
| 30 | 대답 | 아 안해 | `<maum_2>(type=cancel, value=none)<maum_end>` |
| 30 | 대답 | 아 필요없어 | `<maum_2>(type=cancel, value=none)<maum_end>` |
| 30 | 목적 자세 부르기 | 그냥 잘래 | `<maum_0>(command=call, purpose=sleep)<maum_end>` |
| 31 | 대답 | 일곱시 알람 | `<maum_2>(type=time, value=07:00)<maum_end>` |
| 31 | 대답 | 으음 아 일곱시로 하자 | `<maum_2>(type=time, value=07:00)<maum_end>` |
| 31 | 대답 | 아침 일곱시 | `<maum_2>(type=time, value=am_07:00)<maum_end>` |
| 31 | 끄기 | 아홉시 꺼 아아아니다 일곱시 | `<maum_1>(command=off, target=07:00, target_ampm=none, target_days=none)<maum_end>` |
| 31 | 대답 | 아홉시여덟시여덟시아아아 아니 일곱시 | `<maum_2>(type=time, value=07:00)<maum_end>` |
| 32 | 한 번 건너뛰기 | 내일만 안울리게 | `<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow)<maum_end>` |
| 32 | 한 번 건너뛰기 | 내일만 필요없는거야 | `<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow)<maum_end>` |
| 32 | 한 번 건너뛰기 | 내일은 안울리게 | `<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow)<maum_end>` |
| 32 | 대답 | 완전히 삭제는 하지마 | `<maum_2>(type=no, value=none)<maum_end>` |
| 32 | 대답 | 삭제는 말아야지 | `<maum_2>(type=no, value=none)<maum_end>` |
| 33 | 대답 | 계속 | `<maum_2>(type=scope, value=always)<maum_end>` |
| 33 | 대답 | 꾸준히 | `<maum_2>(type=scope, value=always)<maum_end>` |
| 33 | 대답 | 앞으로 | `<maum_2>(type=scope, value=always)<maum_end>` |
| 33 | 대답 | 이번만 말고 | `<maum_2>(type=scope, value=always)<maum_end>` |
| 33 | 대답 | 쭉바꾸라고 | `<maum_2>(type=scope, value=always)<maum_end>` |
| 33 | 대답 | 계속바꿔야지 | `<maum_2>(type=scope, value=always)<maum_end>` |
| 35 | 대답 | 야 이 자세 나한테 맞는데 | `<maum_2>(type=good, value=none)<maum_end>` |
| 35 | 대답 | 야 딱 좋다 | `<maum_2>(type=good, value=none)<maum_end>` |
| 35 | 대답 | 야 이게 젤 편하네 | `<maum_2>(type=good, value=none)<maum_end>` |
| 35 | 대답 | 야 이거 기본으로 하고 싶긴하네 | `<maum_2>(type=good, value=none)<maum_end>` |
| 36 | 지원하지 않는 요청 | 아 허리아파 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 36 | 지원하지 않는 요청 | 아 내 허리 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 36 | 지원하지 않는 요청 | 아 끊어지겠네 허리 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 36 | 지원하지 않는 요청 | 아이고 허리야 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 36 | 지원하지 않는 요청 | 허리가 허리가 아프구나아아아아 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 36 | 지원하지 않는 요청 | 허리 허리허리 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 37 | 지원하지 않는 요청 | 뮤직큐 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 37 | 지원하지 않는 요청 | 음악좀 틀어 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 37 | 지원하지 않는 요청 | 노래 시작 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 37 | 지원하지 않는 요청 | 노래해 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 37 | 지원하지 않는 요청 | 야 노래좀 불러봐 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 37 | 지원하지 않는 요청 | 노래 틀어 | `<maum_3>(reason=out_of_scope)<maum_end>` |
| 38 | 일반 대화 | 야 너 뭐하는 놈이냐 | `<General_Conversation>()<maum_end>` |
| 38 | 일반 대화 | 야 넌 의식이 있냐 | `<General_Conversation>()<maum_end>` |
| 38 | 일반 대화 | 야 너 나 안무겁냐 | `<General_Conversation>()<maum_end>` |
| 38 | 일반 대화 | 야 너 무슨 재미로 사냐 | `<General_Conversation>()<maum_end>` |
| 38 | 일반 대화 | 야 너 왜이렇게 멍청해 | `<General_Conversation>()<maum_end>` |
| 38 | 일반 대화 | 야 발전을 좀해 | `<General_Conversation>()<maum_end>` |
| 39 | 알람 설정 | 삼십분 뒤에 알람 | `<maum_1>(command=set, date=none, ampm=none, time=00:30, time_type=relative, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 39 | 알람 설정 | 삼십분 뒤에 깨워 | `<maum_1>(command=set, date=none, ampm=none, time=00:30, time_type=relative, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 39 | 알람 설정 | 삼십분만 잘게 | `<maum_1>(command=set, date=none, ampm=none, time=00:30, time_type=relative, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 39 | 알람 설정 | 삼십분뒤에 울어 | `<maum_1>(command=set, date=none, ampm=none, time=00:30, time_type=relative, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 39 | 알람 설정 | 삼십분 뒤에 소리 나게 해 | `<maum_1>(command=set, date=none, ampm=none, time=00:30, time_type=relative, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 39 | 알람 설정 | 삼십분 뒤에 노래해라 | `<maum_1>(command=set, date=none, ampm=none, time=00:30, time_type=relative, type=none, repeat=none, days=none, confirm=yes)<maum_end>` |
| 40 | 알람 시각 바꾸기 | 야 아침 알림 하나 있는거 삼십분 당겨 | `<maum_1>(command=change_time, target=none, target_ampm=am, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=none)<maum_end>` |
| 40 | 알람 시각 바꾸기 | 야 아침 알림 당겨 삼십분 | `<maum_1>(command=change_time, target=none, target_ampm=am, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=none)<maum_end>` |
| 40 | 알람 시각 바꾸기 | 야 아침에 삼십분만 일찍 깨워 | `<maum_1>(command=change_time, target=none, target_ampm=am, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=none)<maum_end>` |
| 40 | 알람 시각 바꾸기 | 야 아침에 삼십분 더 일찍 | `<maum_1>(command=change_time, target=none, target_ampm=am, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=none)<maum_end>` |
| 40 | 알람 시각 바꾸기 | 야 오전에 삼십분 빨리 | `<maum_1>(command=change_time, target=none, target_ampm=am, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=none)<maum_end>` |
| 40 | 알람 시각 바꾸기 | 야 오전 삼십분 일찍 출발해야돼 | `<maum_1>(command=change_time, target=none, target_ampm=am, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=none)<maum_end>` |
| 40 | 알람 시각 바꾸기 | 야 오전 삼십분 더 앞으로 | `<maum_1>(command=change_time, target=none, target_ampm=am, target_days=none, date=none, ampm=none, time=00:30, time_type=earlier, scope=none)<maum_end>` |
| 41 | 자세 조절 | 다리 쭉 필래 | `<maum_0>(command=adjust, part=leg, direction=down, amount=0, amount_type=target)<maum_end>` |
| 41 | 자세 조절 | 다리 다 내려 | `<maum_0>(command=adjust, part=leg, direction=down, amount=0, amount_type=target)<maum_end>` |
| 41 | 자세 조절 | 다리 쭉 | `<maum_0>(command=adjust, part=leg, direction=down, amount=0, amount_type=target)<maum_end>` |
| 41 | 자세 조절 | 다리 펴 | `<maum_0>(command=adjust, part=leg, direction=down, amount=0, amount_type=target)<maum_end>` |
| 42 | 자세 조절 | 야 머리 다 올려 | `<maum_0>(command=adjust, part=head, direction=up, amount=max, amount_type=target)<maum_end>` |
| 42 | 자세 조절 | 야 다올려 | `<maum_0>(command=adjust, part=none, direction=up, amount=max, amount_type=target)<maum_end>` |
| 42 | 자세 조절 | 야 끝까지 올려봐 | `<maum_0>(command=adjust, part=none, direction=up, amount=max, amount_type=target)<maum_end>` |
| 42 | 자세 조절 | 최대한 올려봐 | `<maum_0>(command=adjust, part=none, direction=up, amount=max, amount_type=target)<maum_end>` |
| 42 | 자세 조절 | 할수 있는만큼 올려봐 | `<maum_0>(command=adjust, part=none, direction=up, amount=max, amount_type=target)<maum_end>` |
| 42 | 자세 조절 | 야 최대한 | `<maum_0>(command=adjust, part=none, direction=same, amount=max, amount_type=target)<maum_end>` |
| 43 | 예약 취소 | 야 자세 예약 취소 시켜 | `<maum_0>(command=cancel_reserve, purpose=none, confirm=no)<maum_end>` |
| 43 | 예약 취소 | 야 안 잘래 | `<maum_0>(command=cancel_reserve, purpose=sleep, confirm=yes)<maum_end>` |
| 43 | 예약 취소 | 야 잠자세 취소 | `<maum_0>(command=cancel_reserve, purpose=sleep, confirm=no)<maum_end>` |
| 43 | 예약 취소 | 내가 알아서 잘게 | `<maum_0>(command=cancel_reserve, purpose=sleep, confirm=yes)<maum_end>` |
| 44 | 한 번 건너뛰기 | 내일 아침 알람 울리지마 | `<maum_1>(command=skip, target=none, target_ampm=am, target_days=none, date=tomorrow)<maum_end>` |
| 44 | 한 번 건너뛰기 | 내일 쉬니까 너도 쉬어 | `<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow)<maum_end>` |
| 44 | 한 번 건너뛰기 | 내일 쉬는데 울리는건 아니지 설마 | `<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow)<maum_end>` |
| 44 | 한 번 건너뛰기 | 내일 알림 꺼 | `<maum_1>(command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow)<maum_end>` |
| 44 | 일반 대화 | 내일 쉬거든 뭔 말인지 알아 | `<General_Conversation>()<maum_end>` |
| 45 | 질문 알람 난이도 바꾸기 | 알람 문제 두자리로 내 | `<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=two)<maum_end>` |
| 45 | 질문 알람 난이도 바꾸기 | 알람 문제 한 자리 너무 쉬워 | `<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=up)<maum_end>` |
| 45 | 질문 알람 난이도 바꾸기 | 알람 문제 난이도 높여라 | `<maum_1>(command=change_level, target=none, target_ampm=none, target_days=none, level=up)<maum_end>` |
| 45 | 일반 대화 | 알람 문제 장난하냐 | `<General_Conversation>()<maum_end>` |
| 46 | 질문 알람 미루기 | 야 오늘은 좀 더 잘게 | `<maum_1>(command=snooze, minutes=none)<maum_end>` |
| 46 | 질문 알람 미루기 | 야 나 잘거니까 닥쳐 | `<maum_1>(command=snooze, minutes=none)<maum_end>` |
| 46 | 질문 알람 미루기 | 야 오늘은 좀 더 쉴래 | `<maum_1>(command=snooze, minutes=none)<maum_end>` |
| 46 | 일반 대화 | 야 오늘 원래 안울리기로 했는데 너 뭐냐 왜 오작동하냐 | `<General_Conversation>()<maum_end>` |
| 46 | 일반 대화 | 야 너 고장났냐 오늘 알람 없어 | `<General_Conversation>()<maum_end>` |
| 47 | 일반 대화 | 말귀를 못알아먹네 | `<General_Conversation>()<maum_end>` |
| 47 | 일반 대화 | 얘 머리가 너무 나쁘네 | `<General_Conversation>()<maum_end>` |
| 47 | 일반 대화 | 뭐하는거지 | `<General_Conversation>()<maum_end>` |
| 47 | 일반 대화 | 아니 못알아들었으면 다시 물어보든가 | `<General_Conversation>()<maum_end>` |
| 47 | 일반 대화 | 뭐하냐 | `<General_Conversation>()<maum_end>` |
| 47 | 안내 요청 | 뭐라는거야 | `<maum_4>(command=repeat_last)<maum_end>` |
| 47 | 안내 요청 | 뭐래 | `<maum_4>(command=repeat_last)<maum_end>` |
| 47 | 일반 대화 | 뭐지 얘 | `<General_Conversation>()<maum_end>` |
| 47 | 일반 대화 | 뭐하는 놈이냐 | `<General_Conversation>()<maum_end>` |
| 48 | 안내 요청 | 리핏 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 다시 말해 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 뭐라고 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 못들었어 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 뭐 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 잘못들었습니다 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 뭐라 함 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 뭐라는지 알아들을 수가 있어야지 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 말을 왜이렇게 작게 하는거야 | `<maum_4>(command=repeat_last)<maum_end>` |
| 48 | 안내 요청 | 뭐라는겨 | `<maum_4>(command=repeat_last)<maum_end>` |
| 49 | 안내 요청 | 왓타임이즈잇 | `<maum_4>(command=tell_time)<maum_end>` |
| 49 | 안내 요청 | 몇시야 | `<maum_4>(command=tell_time)<maum_end>` |
| 49 | 안내 요청 | 몇시 | `<maum_4>(command=tell_time)<maum_end>` |
| 49 | 안내 요청 | 시각 | `<maum_4>(command=tell_time)<maum_end>` |
| 49 | 안내 요청 | 시간 | `<maum_4>(command=tell_time)<maum_end>` |
| 49 | 안내 요청 | 타임 | `<maum_4>(command=tell_time)<maum_end>` |
| 49 | 안내 요청 | 지금몇시냐 | `<maum_4>(command=tell_time)<maum_end>` |
| 50 | 안내 요청 | 알람 뭐뭐 있냐 | `<maum_4>(command=tell_alarms)<maum_end>` |
| 50 | 안내 요청 | 내가 뭐뭐 맞춰놨지 알람 | `<maum_4>(command=tell_alarms)<maum_end>` |
| 50 | 안내 요청 | 알람 다 말해봐 | `<maum_4>(command=tell_alarms)<maum_end>` |
| 50 | 안내 요청 | 알람이 뭐있었나 | `<maum_4>(command=tell_alarms)<maum_end>` |
| 50 | 안내 요청 | 알람 설정해놓은거 있어 | `<maum_4>(command=tell_alarms)<maum_end>` |
| 51 | 목적 자세 부르기 | 티비 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 티비 자세 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 테레비 자세 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 텔레비전을 볼게 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 텔레비전 자세 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 티비 볼게 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 티비 볼거야 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 티비본다 나 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 티비 킨다 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 51 | 목적 자세 부르기 | 티비 티비티비티비 | `<maum_0>(command=call, purpose=tv)<maum_end>` |
| 52 | 자세 조절 | 오도 올려 | `<maum_0>(command=adjust, part=none, direction=up, amount=5, amount_type=delta)<maum_end>` |
| 52 | 자세 조절 | 아주 조금 올려 | `<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none)<maum_end>` |
| 52 | 자세 조절 | 좀만 더 올려 | `<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none)<maum_end>` |
| 52 | 자세 조절 | 더 올려 | `<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none)<maum_end>` |
| 52 | 자세 조절 | 살짝 올려 | `<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none)<maum_end>` |
| 52 | 자세 조절 | 좀 더 | `<maum_0>(command=adjust, part=none, direction=same, amount=none, amount_type=none)<maum_end>` |
| 52 | 자세 조절 | 음 올려봐 좀 | `<maum_0>(command=adjust, part=none, direction=up, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 다리 좀 내려 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 다리 좀 더 내려 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 다리 좀만 아래로 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 발 아래로 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 발 좀 아래로 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 발 내려 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 발 좀 만 더 아래 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 종아리 좀 내려 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 종아리 아래 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 종아리 좀만 밑으로 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 야 다리가 너무 높아 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 종아리 높아 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 발이 좀 높네 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 53 | 자세 조절 | 발 왜 이렇게 높냐 | `<maum_0>(command=adjust, part=leg, direction=down, amount=none, amount_type=none)<maum_end>` |
| 56 | 알람 설정 | 여섯시 사십사분 알람 | `<maum_1>(command=set, date=none, ampm=none, time=06:44, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 56 | 알람 설정 | 여섯시 이십칠분에 맞춰라 | `<maum_1>(command=set, date=none, ampm=none, time=06:27, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 56 | 알람 설정 | 여섯시 십일분에 깨워 | `<maum_1>(command=set, date=none, ampm=none, time=06:11, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 56 | 알람 설정 | 여섯시 구분엔 일어나야돼 | `<maum_1>(command=set, date=none, ampm=none, time=06:09, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 56 | 알람 설정 | 여섯시 칠분에 울려라 | `<maum_1>(command=set, date=none, ampm=none, time=06:07, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 57 | 알람 설정 | 저녁 일곱시에 깨워 | `<maum_1>(command=set, date=none, ampm=pm, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 57 | 알람 설정 | 밤에 깨워 일곱시 | `<maum_1>(command=set, date=none, ampm=pm, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 57 | 알람 설정 | 저녁 즈음 한 일곱시 어 울려라 | `<maum_1>(command=set, date=none, ampm=pm, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 57 | 알람 설정 | 밤에 깨워봐 한 일곱시 쯤 | `<maum_1>(command=set, date=none, ampm=pm, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 57 | 알람 설정 | 오후에 나 깨워 음 일곱시 | `<maum_1>(command=set, date=none, ampm=pm, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 58 | 알람 설정 | 야 다음주 월요일 아침 여섯시 알람 | `<maum_1>(command=set, date=next_mon, ampm=am, time=06:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 58 | 알람 설정 | 이십구일 아침 여섯시 알람 | `<maum_1>(command=set, date=D29, ampm=am, time=06:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 58 | 알람 설정 | 이십구일 아침에 한 음 여섯시쯤 알람 | `<maum_1>(command=set, date=D29, ampm=am, time=06:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 58 | 알람 설정 | 담주월 아침에 한 여섯시쯤 | `<maum_1>(command=set, date=next_mon, ampm=am, time=06:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>` |
| 58 | 알람 설정 | 여섯시에 울려라 담주월요일만 | `<maum_1>(command=set, date=next_mon, ampm=none, time=06:00, time_type=absolute, type=none, repeat=once, days=none, confirm=no)<maum_end>` |
| 59 | 알람 종류 바꾸기 | 기본 말고 문제 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=none)<maum_end>` |
| 59 | 알람 종류 바꾸기 | 기본 말고 덧셈 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=none)<maum_end>` |
| 59 | 알람 종류 바꾸기 | 기본 말고 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=none, scope=none)<maum_end>` |
| 59 | 알람 종류 바꾸기 | 아 문제로해 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=none)<maum_end>` |
| 59 | 알람 종류 바꾸기 | 아 계산 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=none)<maum_end>` |
| 59 | 알람 종류 바꾸기 | 아 수식으로 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=none)<maum_end>` |
| 59 | 알람 종류 바꾸기 | 아 덧셈 할래 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=question, scope=none)<maum_end>` |
| 60 | 알람 종류 바꾸기 | 야 기본 알람으로 바꿔 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=basic, scope=none)<maum_end>` |
| 60 | 목적 자세 부르기 | 보통으로 바꿔 | `<maum_0>(command=call, purpose=base)<maum_end>` |
| 60 | 목적 자세 부르기 | 기본으로 바꿔 | `<maum_0>(command=call, purpose=base)<maum_end>` |
| 60 | 알람 종류 바꾸기 | 야 침대 나가야 되는거 말고 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=none, scope=none)<maum_end>` |
| 60 | 알람 종류 바꾸기 | 야 계산이나 침대 말고 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=basic, scope=none)<maum_end>` |
| 60 | 목적 자세 부르기 | 야 기본 기본 | `<maum_0>(command=call, purpose=base)<maum_end>` |
| 60 | 알람 종류 바꾸기 | 야 기초 알람 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=basic, scope=none)<maum_end>` |
| 60 | 알람 종류 바꾸기 | 야 소리만 나는걸로 | `<maum_1>(command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=basic, scope=none)<maum_end>` |

## 학습 보류 (상황이 필요해 출력과 앱 규칙을 정할 때까지 학습에 넣지 않음)

| 번호 | 문장 | 지금 적어 둔 정답 |
|---|---|---|

## 멈춤 단어 (모델을 거치지 않음)

야 스탑 / 멈춰 / 야 가만히 있어봐 / 야 올스톱 / 야 타임 / 야 얼음
