# 학습 데이터 나누기 (요약)

이 파일은 build_train.py가 만듭니다. 직접 고치지 않습니다.

- 학습(train.json): 2249문장. 문장 틀로 만든 것이며 평가 문장과 앞말·띄어쓰기만 다른 것(745개)과 중복(395개)은 뺐습니다.
- 개발용 평가(dev.json): 259문장. 대표 문장입니다. 틀린 것을 보고 데이터를 고칠 때 씁니다.
- 실제 사용자 문장 회귀 평가(final.json): 274문장. 팀원이 직접 말한 문장입니다. 모델을 고르거나 데이터를 고칠 때 쓰지 않습니다. 다만 이 문장들을 보며 규격을 여러 번 고쳤으므로 처음 보는 말에 대한 시험은 아닙니다. 그 시험은 규격이 정리된 뒤 새로 모은 문장으로 합니다.
- 숫자와 단위를 붙여 쓴 문장(띄어쓰기 변형): 약 23%

## 기능별 학습 문장 수

| 기능 | 문장 수 |
|---|---|
| General_Conversation | 183 |
| maum_0 adjust | 258 |
| maum_0 call | 116 |
| maum_0 cancel_reserve | 50 |
| maum_0 change_reserve | 70 |
| maum_0 reserve | 72 |
| maum_0 set_default | 53 |
| maum_0 undo | 51 |
| maum_1 change_level | 38 |
| maum_1 change_time | 105 |
| maum_1 change_type | 91 |
| maum_1 delete | 64 |
| maum_1 disable | 67 |
| maum_1 enable | 62 |
| maum_1 off | 42 |
| maum_1 set | 192 |
| maum_1 skip | 92 |
| maum_1 snooze | 63 |
| maum_2 ampm | 18 |
| maum_2 bad | 18 |
| maum_2 cancel | 24 |
| maum_2 date | 28 |
| maum_2 good | 24 |
| maum_2 no | 30 |
| maum_2 number | 76 |
| maum_2 part | 30 |
| maum_2 scope | 12 |
| maum_2 time | 44 |
| maum_2 unclear | 20 |
| maum_2 yes | 36 |
| maum_3 app_only | 26 |
| maum_3 out_of_scope | 74 |
| maum_4 repeat_last | 38 |
| maum_4 tell_alarms | 39 |
| maum_4 tell_time | 43 |

## 평가에서 따로 셀 것

- 전체 정답률(이름표, 명령, 값까지 모두 맞아야 정답)
- 기능별 정답률
- confirm=yes여야 하는데 no로 낸 경우(확인 없이 실행되는 오류)
- 일반 대화나 못 하는 일을 명령으로 낸 경우(침대가 엉뚱하게 움직이는 오류)
