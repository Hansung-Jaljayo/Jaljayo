# 임시(오늘 시연용): 맥에 꽂은 나노의 버튼·압력 센서 신호를 랜으로 보드에 넘긴다.
# 제품에서는 나노를 보드에 바로 꽂고 보드 앱이 USB로 직접 읽어야 한다(아직 없음).
# 쓰는 법: python3 nano_bridge.py [--bed 사과] [--fsr] [--board 192.168.1.2] [--alarm-now]
#   --fsr       압력 센서 값도 보낸다(센서를 꽂은 뒤에만. 안 꽂으면 아무 값이나 읽혀서 끈다)
#   --alarm-now 연결되자마자 그 침대의 다음 알람을 지금 울리게 한다(시연용)
import argparse, glob, json, time, serial, websocket

p = argparse.ArgumentParser()
p.add_argument('--bed', default='사과'); p.add_argument('--board', default='192.168.1.2')
p.add_argument('--fsr', action='store_true'); p.add_argument('--alarm-now', action='store_true')
p.add_argument('--threshold', type=int, default=300)   # 이 값보다 크게 눌리면 누워 있다고 본다
a = p.parse_args()

port = sorted(glob.glob('/dev/cu.usbserial*') + glob.glob('/dev/cu.usbmodem*'))[0]
nano = serial.Serial(port, 115200, timeout=0.2)
print('나노:', port)

def connect():
    while True:
        try:
            ws = websocket.create_connection(f'ws://{a.board}:8765', timeout=3)
            print('보드에 연결됨'); return ws
        except Exception as e:
            print('보드 연결 실패, 2초 뒤 다시:', e); time.sleep(2)

import threading
alive = {'ok': False}
def watch(w):
    # 보드가 보내는 글을 계속 읽는다. 읽다가 끊기면 연결이 죽은 것으로 표시한다
    # (끊긴 줄 모르고 보내면 글이 조용히 사라져서, 보낼 때마다 이 표시를 본다)
    try:
        while True: w.recv()
    except Exception: alive['ok'] = False
def open_ws():
    w = connect(); alive['ok'] = True
    threading.Thread(target=watch, args=(w,), daemon=True).start(); return w
ws = open_ws()
if a.alarm_now: ws.send(json.dumps({'type': 'demo', 'action': 'alarm-now', 'bed': a.bed})); print('알람을 지금 울리게 보냄')
while True:
    line = nano.readline().decode(errors='ignore').strip()
    msg = None
    if line == 'BTN SHORT': msg = {'type': 'button', 'bed': a.bed}
    elif line == 'BTN LONG': msg = {'type': 'button', 'bed': a.bed, 'long': True}
    elif line.startswith('FSR ') and a.fsr:
        v = int(line[4:]); msg = {'type': 'sensor', 'bed': a.bed, 'occupied': v > a.threshold, 'value': v, 'virtual': False}
    if not msg: continue
    # 보드 앱이 다시 켜지면 연결이 끊겨 있으므로, 다시 붙은 뒤 같은 신호를 한 번 더 보낸다(눌린 버튼을 잃지 않게)
    if not alive['ok']: print('보드 연결이 끊겨 있어서 다시 붙어요', flush=True); ws = open_ws()
    for attempt in range(2):
        try:
            ws.send(json.dumps(msg, ensure_ascii=False))
            if msg['type'] == 'button': print(time.strftime('%H:%M:%S'), '보냄:', '길게' if msg.get('long') else '짧게', flush=True)
            break
        except Exception:
            print('보드 연결이 끊겨서 다시 붙어요', flush=True); ws = open_ws()
