# 잘자요 학습 데이터 규격
#
# 모델이 사용자 말을 받아 어떤 모양으로 답해야 하는지 정한 파일입니다.
# 예: "내일 오전 일곱 시 깨워줘" -> <maum_1>(command=set, date=tomorrow, ampm=am, time=07:00, ...)<maum_end>
#
# 이 파일에 들어 있는 것
# - SPEC: 이름표(토큰)와 명령마다 쓰는 칸 이름, 칸에 들어갈 수 있는 값
# - FUNCS: 기능 목록과 예시 문장 (제출 문서의 기능 표에 씁니다)
# - render: 이름표와 칸 값을 받아 정답 글자를 만드는 함수
# - FUNC_DESC: 이름표마다 붙이는 함수 설명. 학습 문장 뒤에 붙여 모델이 이름표와 값의 뜻을 함께 배우게 합니다
#
# 출력 규칙
# - 명령마다 정해진 칸만 아래 SPEC의 순서대로 씁니다. 다른 명령의 칸은 쓰지 않습니다.
# - 사용자 말에 없는 값은 none이라고 씁니다. none은 따옴표 없는 글자이며, 숫자 칸에서도 같습니다.
# - 시각은 들은 숫자 그대로 HH:MM으로 쓰고, 오전·오후를 말했으면 따로 ampm 칸에 씁니다. 바꾸는 계산은 앱이 합니다.
#   예: 밤 열한 시 반 -> ampm=pm, time=11:30 / 열여덟 시 -> ampm=none, time=18:00
#   아침·새벽·오전은 am, 오후·저녁·밤은 pm입니다. 정오는 pm, 12:00이고 자정과 밤 열두 시는 am, 12:00입니다.
#   오전·오후를 말했으면 시는 1에서 12 사이입니다. 24시는 24:00만 받고 "그날이 끝나는 자정"으로 앱이 해석합니다(24:30은 없음).
# - 예약 취소와 알람 설정에는 confirm 칸이 있습니다. 분명한 명령은 no, 간접 표현으로 지원하기로 정한 말("야 안 잘래", "삼십분 뒤에 노래해라")은 yes입니다.
# - 숫자는 학습 문장에서 모두 한글로 씁니다(삼십). STT가 숫자(30)로 적으면 앱이 모델에 넣기 전에 한글로 바꿉니다.
#   바꾸는 규칙은 docs/interfaces/stt-to-model-text.md에 있습니다(11시는 열한 시, 11분은 십일 분).
# - 같은 항목을 아니(아니다)로 고쳐 말하면 그 항목만 마지막 값으로 쓰고 다른 값은 그대로 둡니다.
#   예: 내일 오전 일곱 시 아니 여덟 시 -> date=tomorrow, ampm=am, time=08:00. "아니"만 말하면 type=no입니다.
# - 날짜는 오늘 today, 내일 tomorrow, 모레 +2, 글피 +3, N일 뒤 +N, 요일 sat, 다음 주 요일 next_sat, 몇 월 며칠 10-15로 씁니다.
#   월 없이 일만 말하면 D29처럼 씁니다(다가오는 29일).
#   "내일만", "오 일 뒤만"처럼 날짜에 만을 붙인 대답도 날짜(type=date)로 씁니다. 그날만이라는 뜻은 앱이 앞 질문으로 압니다.
#   지금부터 얼마 뒤를 뜻하는 시간(relative, earlier, later)은 걸리는 시간을 HH:MM으로 씁니다. 예: 삼십 분 뒤 -> time=00:30
#   걸리는 시간은 24시간(24:00)까지만 받습니다. 하루가 넘는 일은 날짜로 말합니다.
#
# 이 파일을 읽는 곳: check.py(데이터 검사), ai/data/scripts/의 데이터 만드는 파일들
# 규칙의 근거는 docs/system-design.md에 있습니다. 값을 바꾸면 check.py의 검사 범위도 함께 확인해 주세요.
# 9/29 파일럿 때 처음 만들었고(v0.1), 그 뒤 설계서와 대조해 고쳤습니다.
END = '<maum_end>'
PURPOSE = ['read', 'tv', 'rest', 'sleep', 'base']   # base = 목적 없이 저장한 "기본 자세"
PURPOSE_DESC = 'read, tv, rest, sleep, base(목적 없이 저장한 기본 자세)'
# 예약 명령(reserve, change_reserve, cancel_reserve)에서만 쓰는 대상. flat은 저장된 잠 자세와 상관없이 머리와 다리 모두 0도
RESERVE_TARGET = PURPOSE + ['flat', 'none']
RESERVE_DESC = PURPOSE_DESC + ', flat(머리와 다리 모두 0도, 예약에만), none'
AMPM = ['am', 'pm', 'none']
WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
DATE = 'date'  # 검사는 check.py의 날짜 규칙
DATE_DESC = 'today, tomorrow, +N(N일 뒤, 모레 +2), 요일 mon에서 sun(다가오는 그 요일), next_요일(다음 주), MM-DD(몇 월 며칠), D일(월 없이 일만, D29), none'
DAYS = 'none, daily, weekdays, weekend, 또는 요일을 +로 연결(mon+wed)'
TIME_DESC = '들은 그대로 HH:MM(00:00에서 23:59, 그리고 24:00), none'
# 대상 알람을 가리키는 칸. 시각·오전오후·요일로 고르고, all이면 전부
TARGET = [('target', '대상 알람 시각 HH:MM, all(전부), none', 'target'), ('target_ampm', '대상 알람의 오전·오후 am, pm, none', AMPM),
          ('target_days', '대상 알람의 요일 mon, mon+wed, weekdays, weekend, daily, none', 'days')]
SCOPE = ('scope', 'once(이번만), always(계속), none', ['once', 'always', 'none'])
ALARM_TYPE = ('type', 'basic, leave_bed, question, none', ['basic', 'leave_bed', 'question', 'none'])
# 대답(maum_2)의 type마다 value에 들어갈 수 있는 값. 목록이 아닌 것은 check.py가 모양을 검사한다
ANSWER_VALUES = {
 'yes': ['none'], 'no': ['none'], 'good': ['none'], 'bad': ['none'], 'cancel': ['none'], 'unclear': ['none'],
 'ampm': ['am', 'pm'], 'part': ['head', 'leg'], 'scope': ['once', 'always'],
 'date': 'answer_date',      # DATE와 같은 모양, none은 안 됨
 'time': 'answer_time',      # HH:MM, 오전·오후를 말했으면 am_HH:MM 또는 pm_HH:MM
 'number': 'answer_number',  # 들은 숫자 그대로 0에서 999. 맞는지는 앱이 덧셈 정답과 비교한다
}
# (토큰, command) -> [(값 이름, 허용 값 설명, 허용 값 목록 또는 검사 종류)]
SPEC = {
 ('maum_0', 'call'): [('purpose', PURPOSE_DESC, PURPOSE)],
 ('maum_0', 'adjust'): [('part', 'head, leg, both(머리와 다리 모두, "평평"), none', ['head', 'leg', 'both', 'none']),
                        ('direction', 'up, down, same(직전 조절과 같은 방향, "조금 더"), none', ['up', 'down', 'same', 'none']),
                        ('amount', '0에서 90 사이 정수, max(끝까지), none. 말한 숫자 그대로이며 범위 맞추기는 앱이 한다', 'angle'),
                        ('amount_type', 'delta(direction 쪽으로 바꿀 양), target(목표 각도. max와 0은 target), none', ['delta', 'target', 'none'])],
 ('maum_0', 'undo'): [],
 ('maum_0', 'set_default'): [('purpose', PURPOSE_DESC + ', none(말하지 않으면 앱이 지금 목적에, 목적이 없으면 base에 저장)', PURPOSE + ['none'])],
 ('maum_0', 'reserve'): [('purpose', RESERVE_DESC, RESERVE_TARGET), ('date', DATE_DESC, DATE),
                         ('ampm', 'am, pm, none', AMPM), ('time', TIME_DESC + '. relative면 지금부터 걸리는 시간', 'time'), ('time_type', 'absolute(정해진 시각), relative(지금부터), none', ['absolute', 'relative', 'none'])],
 ('maum_0', 'change_reserve'): [('purpose', RESERVE_DESC + ' (none이면 걸려 있는 예약)', RESERVE_TARGET),
                                ('date', DATE_DESC + ' (absolute일 때만 새 날짜. 말하지 않으면 none이고 앱은 기존 예약 날짜를 기준으로 함. earlier·later면 늘 none: "내일 예약 한 시간 앞당겨"의 "내일"처럼 기존 예약을 가리키는 날짜는 버림. 예약은 하나뿐임)', DATE), ('ampm', 'am, pm, none (absolute일 때 새 시각의 오전·오후)', AMPM),
                                ('time', TIME_DESC + '. earlier·later면 기존 예약에서 바꿀 시간', 'time'),
                                ('time_type', 'absolute(이 시각으로), earlier(기존 예약에서 이만큼 앞당김), later(기존 예약에서 이만큼 늦춤), none. 얼마나인지 말하지 않아도 방향을 말했으면 time=none에 earlier·later', ['absolute', 'earlier', 'later', 'none'])],
 ('maum_0', 'cancel_reserve'): [('purpose', RESERVE_DESC + ' (none이면 걸려 있는 예약)', RESERVE_TARGET), ('confirm', 'yes(간접 표현이라 앱이 확인한 뒤 실행), no(분명한 명령). 모델의 자신감이 아니라 표현마다 정해 둔 값', ['yes', 'no'])],
 ('maum_1', 'set'): [('date', DATE_DESC, DATE), ('ampm', 'am, pm, none', AMPM), ('time', TIME_DESC + '. relative면 지금부터 걸리는 시간', 'time'),
                     ('time_type', 'absolute(정해진 시각), relative(지금부터), none', ['absolute', 'relative', 'none']),
                     ALARM_TYPE, ('repeat', 'once, weekly, none', ['once', 'weekly', 'none']), ('days', DAYS, 'days'), ('confirm', 'yes(간접 표현이라 앱이 확인한 뒤 실행), no(분명한 명령). 모델의 자신감이 아니라 표현마다 정해 둔 값', ['yes', 'no'])],
 ('maum_1', 'change_time'): TARGET + [('date', DATE_DESC + ' (바꿀 날)', DATE), ('ampm', 'am, pm, none (새 시각의 오전·오후)', AMPM),
                             ('time', TIME_DESC + '. absolute면 새 시각, earlier·later면 당기거나 늦출 시간', 'time'),
                             ('time_type', 'absolute(이 시각으로), earlier(이만큼 당기기), later(이만큼 늦추기), none. 얼마나인지 말하지 않아도 방향을 말했으면 time=none에 earlier·later', ['absolute', 'earlier', 'later', 'none']), SCOPE],
 ('maum_1', 'change_type'): TARGET + [('date', DATE_DESC + ' (바꿀 날)', DATE), ALARM_TYPE, SCOPE],
 ('maum_1', 'change_level'): TARGET + [('level', 'one(한 자리), two(두 자리), up(한 단계 어렵게), down(한 단계 쉽게), none', ['one', 'two', 'up', 'down', 'none'])],
 ('maum_1', 'skip'): TARGET + [('date', DATE_DESC + ' (건너뛸 날)', DATE)],
 ('maum_1', 'disable'): TARGET + [('until', DATE_DESC + ' (날짜를 말했을 때. 이날까지 끄고 다음 날 다시 켬)', DATE),
                                  ('period', '1에서 60 사이 정수 일, none ("오 일간"처럼 기간을 말했을 때. 끝나는 날은 앱이 계산)', 'period')],
 ('maum_1', 'enable'): list(TARGET),
 ('maum_1', 'delete'): list(TARGET),
 ('maum_1', 'off'): list(TARGET),
 ('maum_1', 'snooze'): [('minutes', '1에서 60 사이 정수, none', 'minutes')],
 ('maum_2', None): [('type', ', '.join(ANSWER_VALUES), list(ANSWER_VALUES)),
                    ('value', 'type마다 정해진 값(ANSWER_VALUES). yes, no, good, bad, cancel, unclear는 none', 'answer')],
 ('maum_3', None): [('reason', 'out_of_scope(침대가 못 하는 일), app_only(폰 앱에서만 되는 일)', ['out_of_scope', 'app_only'])],
 ('maum_4', 'tell_time'): [],
 ('maum_4', 'repeat_last'): [],
 ('maum_4', 'tell_alarms'): [],
 ('General_Conversation', None): [],
}
# 보고서·기획 시트에 쓸 기능 목록: (파일럿 여부, 분류, 기능명, 토큰, command, 예시 출력, 예시 문장)
FUNCS = [
 ('파일럿', '자세', '목적 자세 부르기', 'maum_0', 'call', 'command=call, purpose=read', '책 좀 읽을래'),
 ('파일럿', '자세', '자세 조절', 'maum_0', 'adjust', 'command=adjust, part=head, direction=down, amount=5, amount_type=delta', '머리 오 도 내려'),
 ('파일럿', '자세', '되돌리기', 'maum_0', 'undo', 'command=undo', '아까 자세로 돌려줘'),
 ('정의', '자세', '기본 정하기', 'maum_0', 'set_default', 'command=set_default, purpose=none', '이 자세가 이제 기본이야'),
 ('정의', '자세', '자세 예약', 'maum_0', 'reserve', 'command=reserve, purpose=sleep, date=none, ampm=pm, time=11:30, time_type=absolute', '밤 열한 시 반에 잠 자세로 해줘'),
 ('정의', '자세', '예약 시각 바꾸기', 'maum_0', 'change_reserve', 'command=change_reserve, purpose=none, date=none, ampm=none, time=00:30, time_type=later', '예약 삼십 분 늦춰줘'),
 ('정의', '자세', '평평하게 예약', 'maum_0', 'reserve', 'command=reserve, purpose=flat, date=none, ampm=none, time=12:00, time_type=absolute', '열두 시에 평평하게 해 줘'),
 ('정의', '자세', '예약 취소', 'maum_0', 'cancel_reserve', 'command=cancel_reserve, purpose=none, confirm=no', '자세 예약 취소해'),
 ('파일럿', '알람', '알람 설정', 'maum_1', 'set', 'command=set, date=tomorrow, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no', '내일 오전 일곱 시 깨워줘'),
 ('정의', '알람', '알람 시각 바꾸기', 'maum_1', 'change_time', 'command=change_time, target=07:00, target_ampm=am, target_days=none, date=none, ampm=pm, time=08:00, time_type=absolute, scope=none', '오전 일곱 시 알람을 오후 여덟 시로 바꿔줘'),
 ('정의', '알람', '알람 종류 바꾸기', 'maum_1', 'change_type', 'command=change_type, target=none, target_ampm=none, target_days=none, date=none, type=leave_bed, scope=none', '침대에서 나와야 꺼지는 알람으로 해줘'),
 ('정의', '알람', '질문 알람 난이도 바꾸기', 'maum_1', 'change_level', 'command=change_level, target=none, target_ampm=none, target_days=none, level=two', '알람 문제 두 자리로 내'),
 ('정의', '알람', '한 번 건너뛰기', 'maum_1', 'skip', 'command=skip, target=none, target_ampm=none, target_days=none, date=tomorrow', '내일만 건너뛰어'),
 ('정의', '알람', '잠시 끄기', 'maum_1', 'disable', 'command=disable, target=all, target_ampm=none, target_days=none, until=none, period=5', '오 일간 알람 다 꺼'),
 ('정의', '알람', '다시 켜기, 삭제', 'maum_1', 'enable, delete', 'command=delete, target=07:00, target_ampm=am, target_days=wed', '수요일 오전 일곱 시 알람 삭제해'),
 ('정의', '알람', '끄기(건너뛰기와 삭제 중 모름, 앱이 되물음)', 'maum_1', 'off', 'command=off, target=none, target_ampm=none, target_days=none', '알람 꺼줘'),
 ('파일럿', '알람', '질문 알람 미루기', 'maum_1', 'snooze', 'command=snooze, minutes=10', '십 분만 더'),
 ('파일럿', '대답', '숫자 대답', 'maum_2', '(없음)', 'type=number, value=15', '십오요'),
 ('정의', '대답', '예·아니오 대답', 'maum_2', '(없음)', 'type=yes, value=none', '응'),
 ('정의', '대답', '빠진 값 채우는 대답', 'maum_2', '(없음)', 'type=part, value=leg', '다리'),
 ('정의', '대답', '마음에 듦·안 듦', 'maum_2', '(없음)', 'type=bad, value=none', '불편해'),
 ('정의', '대답', '대상 없는 취소', 'maum_2', '(없음)', 'type=cancel, value=none', '그거 취소해'),
 ('파일럿', '기타', '지원하지 않는 요청', 'maum_3', '(없음)', 'reason=out_of_scope', '불 좀 꺼줘'),
 ('정의', '기타', '앱에서만 되는 요청', 'maum_3', '(없음)', 'reason=app_only', '알람 소리 줄여'),
 ('정의', '안내', '지금 시각 알려 주기', 'maum_4', 'tell_time', 'command=tell_time', '몇 시야'),
 ('정의', '안내', '방금 한 말 다시 들려주기', 'maum_4', 'repeat_last', 'command=repeat_last', '뭐라고'),
 ('정의', '안내', '내일 알람 알려 주기', 'maum_4', 'tell_alarms', 'command=tell_alarms', '알람 뭐뭐 있어'),
 ('파일럿', '기타', '일반 대화', 'General_Conversation', '(없음)', '(값 없음)', '오늘 날씨 어때'),
]
def render(tok, fields):
    body = ', '.join(f'{k}={v}' for k, v in fields)
    return f'<{tok}>({body}){END}'

# 함수 설명(Function Description). 마음AI 방식처럼 학습 문장 뒤에 붙여 모델이 토큰과 값의 뜻을 함께 배우게 한다
# 이름표 하나에 설명 하나. 값 목록은 위 SPEC과 같아야 한다. 실행하는 함수가 아니라 학습용 설명이다
FUNC_DESC = {
'maum_0': """def control_bed_posture(command, **fields):
    \"\"\"
    Controls the motion bed posture.
    This is a description for training, not a function that runs. Output only the fields of the chosen command, in the order below. Write none for a field the user did not say. none is plain text, also in number fields. If the user corrects one item with "no", such as "five degrees no ten degrees", use the last value for that item only and keep the other values.

    Commands and their fields:
    - call(purpose): Move to the posture for a purpose. Example: "I want to read" -> purpose=read; "my usual posture" -> purpose=base
    - adjust(part, direction, amount, amount_type): Raise or lower the head board, the leg board, or both. "Make it flat" -> part=both, direction=down, amount=0, amount_type=target
    - undo(): Go back to the posture before the last adjustment.
    - set_default(purpose): Save the current posture as the default. If the user does not say a purpose, purpose=none; the app saves it to the current purpose, or to base when there is none.
    - reserve(purpose, date, ampm, time, time_type): Schedule a posture change. purpose=flat means head and leg both to 0 degrees at that time, regardless of the saved sleep posture ("make it flat at midnight"); purpose=sleep means the sleep posture.
    - change_reserve(purpose, date, ampm, time, time_type): Change the time of the scheduled posture change. "move it to ten" -> time_type=absolute; "move it to ten tomorrow" -> date=tomorrow, time_type=absolute (the new date); "move tomorrow's reservation an hour earlier" -> date=none, time=01:00, time_type=earlier (there is only one reservation, so a date that only names the existing reservation is dropped; date is used only for the new date with absolute); "thirty minutes earlier" -> earlier; "thirty minutes later" -> later. If the user gives a direction but no length, keep the direction: "a bit later" -> time=none, time_type=later; "a bit earlier" -> time=none, time_type=earlier; "change the reservation time" -> time=none, time_type=none. purpose names which reservation ("sleep a bit later" -> purpose=sleep); none means the reservation that is set.
    - cancel_reserve(purpose, confirm): Cancel the scheduled posture change. purpose names which reservation, as in change_reserve. A date that names the reservation is dropped ("cancel tomorrow's reservation" is the same as "cancel the reservation"). confirm=no for a clear command ("cancel the posture reservation"); confirm=yes for an indirect phrase that the app must confirm first ("I'm not going to sleep", "I'll fall asleep on my own").

    The output is written as text, not as a function call. Example:
    "lower my head five degrees" -> <maum_0>(command=adjust, part=head, direction=down, amount=5, amount_type=delta)<maum_end>

    Field values:
    - purpose: read, tv, rest, sleep, base (the user's own default posture saved without a purpose). In reserve, change_reserve and cancel_reserve only, also flat (head and leg 0 degrees). none is allowed except in call
    - part: head, leg, both, none
    - direction: up, down, same (same part and direction as the last adjustment, such as "a little more"), none
    - amount: the angle in degrees as spoken, 0 to 90, max (as far as it goes), or none. The app limits it to the bed's range
    - amount_type: delta (change by this amount in the direction), target (go to this angle; max and 0 are targets), none
    - date: today, tomorrow, +N (N days later; the day after tomorrow is +2), mon to sun (the coming day), next_mon to next_sun (next week), MM-DD (month and day, such as 10-15), D29 (day only), none
    - ampm: am, pm, none
    - time: HH:MM as heard. Do not convert: "18 o'clock" -> ampm=none, time=18:00; "6 in the evening" -> ampm=pm, time=06:00. Noon is ampm=pm, time=12:00; midnight is ampm=am, time=12:00; "24 o'clock" is time=24:00 (the end of that day). For relative time it is a length of time, such as 00:30 for thirty minutes
    - confirm: yes, no
    - time_type: in reserve, absolute (a clock time) or relative (from now). In change_reserve, absolute (new time), earlier or later (move the current reservation by this length, or time=none when no length is said), none

    Returns:
    - int: 0 if the operation succeeds; otherwise, an error code.
    \"\"\"""",
'maum_1': """def control_alarm(command, **fields):
    \"\"\"
    Sets and manages wake-up alarms.
    This is a description for training, not a function that runs. Output only the fields of the chosen command, in the order below. Write none for a field the user did not say. If the user corrects one item with "no", such as "seven no eight o'clock tomorrow morning", use the last value for that item only and keep the other values.

    Commands and their fields:
    - set(date, ampm, time, time_type, type, repeat, days, confirm): Create a new alarm. time_type is relative for "in thirty minutes". confirm=no for a clear command ("wake me up in thirty minutes"); confirm=yes for an indirect phrase that the app must confirm first ("sing in thirty minutes"). A time phrase alone does not make a request an alarm: "play music in thirty minutes" is unsupported.
    - change_time(target, target_ampm, target_days, date, ampm, time, time_type, scope): Change the time of an existing alarm. target, target_ampm and target_days choose the existing alarm; date is the day to change; ampm and time are the new time, or the length to move it with time_type earlier or later.
    - change_type(target, target_ampm, target_days, date, type, scope): Change the type of an existing alarm, for one day or from now on.
    - change_level(target, target_ampm, target_days, level): Change the difficulty of the question alarm's addition problem.
    - skip(target, target_ampm, target_days, date): Skip one ring of an alarm.
    - disable(target, target_ampm, target_days, until, period): Turn an alarm off for a while without deleting it. until is a date the user said ("until the 8th"); period is a number of days the user said ("for five days" -> period=5, until=none). Do not calculate the end date; the app does.
    - enable(target, target_ampm, target_days): Turn a disabled alarm back on.
    - delete(target, target_ampm, target_days): Delete an alarm from the list.
    - off(target, target_ampm, target_days): The user asks to turn an alarm off but does not say whether to skip it or delete it. The app asks.
    - snooze(minutes): Postpone the question alarm.

    The output is written as text, not as a function call. Example:
    "wake me up at seven tomorrow morning" -> <maum_1>(command=set, date=tomorrow, ampm=am, time=07:00, time_type=absolute, type=none, repeat=none, days=none, confirm=no)<maum_end>

    Field values:
    - target: HH:MM of the existing alarm as heard, all (every alarm), none
    - target_ampm, ampm: am, pm, none
    - target_days, days: daily, weekdays, weekend, days joined by + such as mon+wed, none
    - date, until: today, tomorrow, +N (N days later), mon to sun, next_mon to next_sun, MM-DD, D29 (day only), none
    - time: HH:MM as heard, none. Do not convert: "18 o'clock" -> time=18:00 with ampm=none; "6 in the evening" -> time=06:00 with ampm=pm. A length of time is HH:MM too, such as 00:30
    - time_type: absolute, relative (from now, in set), earlier or later (move by a length, in change_time; time=none when the user says the direction but no length, such as "push the alarm back a bit"), none
    - type: basic (normal alarm), leave_bed (stops only when the user gets out of bed), question (stops when the user answers an addition problem), none
    - level: one (one-digit addition), two (two-digit addition), up (harder), down (easier), none
    - repeat: once, weekly, none
    - scope: once (only this time), always (from now on), none
    - minutes: 1 to 60, none
    - confirm: yes, no
    - period: number of days, 1 to 60, none

    Returns:
    - int: 0 if the operation succeeds; otherwise, an error code.
    \"\"\"""",
'maum_2': """def answer(type, value):
    \"\"\"
    "raise" or "lower" alone is not an answer; it is adjust with part=none (the app uses it as the answer when it asked up or down). A purpose word alone, such as "reading" or "TV", is call with that purpose, not an answer. "Don't do it" is cancel.
    Handles a short answer or a short reply that needs the conversation before it, such as "yes", "leg", "this is perfect", "this is uncomfortable" or "cancel that". It does not create a new command; the app uses it with the conversation it is holding.
    This is a description for training, not a function that runs.
    If the user corrects the answer with "no", use the final value for the corrected item and preserve any other values in the answer, such as "tomorrow no Saturday" -> date sat. "no" alone is type=no.

    Parameters:
    - type: yes, no, good (the user likes the current posture), bad (the user dislikes the current posture), ampm, time, date, part, scope (only this time or from now on), cancel (cancel without naming what), number (a number answer to the question alarm), unclear (several different numbers were said without a correction)
    - value:
        - yes, no, good, bad, cancel, unclear: none
        - ampm: am, pm
        - time: HH:MM, or am_HH:MM / pm_HH:MM when morning or afternoon is said. Example: "seven in the morning" -> am_07:00
        - date: today, tomorrow, +N, mon to sun, next_mon to next_sun, MM-DD, D29. A date with "only", such as "only tomorrow", is also a date answer
        - part: head, leg
        - scope: once, always
        - number: the number as heard, 0 to 999

    Example: "leg" -> <maum_2>(type=part, value=leg)<maum_end>

    Returns:
    - int: 0 if the answer is accepted; otherwise, an error code.
    \"\"\"""",
'maum_3': """def unsupported_request(reason):
    \"\"\"
    Used when the user asks for something the bed cannot do by voice. The bed does not move.
    This is a description for training, not a function that runs.

    Parameters:
    - reason: out_of_scope (the bed cannot do it, such as turning off the lights or playing music), app_only (it can be set only in the phone app, such as the alarm volume or deleting a saved default posture)

    Example: "turn off the lights" -> <maum_3>(reason=out_of_scope)<maum_end>

    Returns:
    - int: 0 after the app tells the user.
    \"\"\"""",
'maum_4': """def tell_info(command):
    \"\"\"
    Used when the user asks the bed to tell something.
    This is a description for training, not a function that runs.

    Commands:
    - tell_time(): Tell the current time. Example: "what time is it"
    - repeat_last(): Say again what the bed said last. Example: "what did you say"
    - tell_alarms(): Tell tomorrow's alarms. Example: "what alarms do I have"

    Example: "what time is it" -> <maum_4>(command=tell_time)<maum_end>

    Returns:
    - str: the sentence the app reads.
    \"\"\"""",
'General_Conversation': """def general_conversation():
    \"\"\"
    Used when the user is just talking and not asking the bed to do anything, such as greetings or small talk. The bed does not move.
    This is a description for training, not a function that runs.

    Parameters:
    - None

    Example: "good morning" -> <General_Conversation>()<maum_end>

    Returns:
    - None
    \"\"\"""",
}
