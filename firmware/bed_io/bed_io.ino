// 잘자요 침대 장치: 버튼(D2)과 압력 센서(A0)를 읽어 USB로 한 줄씩 알려 줍니다.
// 보내는 글(115200bps, 줄 끝 \n)
//   BTN SHORT   버튼을 1초 안에 눌렀다 뗌(멈춤)
//   BTN LONG    버튼을 1초 넘게 누름(알람 강제 종료). 1초가 되는 순간 한 번 보냅니다
//   FSR <값>    압력 센서 값 0~1023을 0.2초마다(클수록 세게 눌림)
// 버튼: 한쪽 다리는 D2, 다른 쪽은 GND. 안쪽 풀업을 써서 누르면 LOW가 됩니다.
// 압력 센서: 한쪽 다리는 5V, 다른 쪽은 A0. A0과 GND 사이에 10K옴 저항을 둡니다.

const int BTN = 2;
const int FSR = A0;
const unsigned long LONG_MS = 1000, DEBOUNCE_MS = 30, FSR_MS = 200;

bool down = false, longSent = false;
unsigned long changedAt = 0, downAt = 0, fsrAt = 0;
int lastRaw = HIGH;

void setup() {
  pinMode(BTN, INPUT_PULLUP);
  Serial.begin(115200);
  Serial.println("READY");
}

void loop() {
  unsigned long now = millis();
  int raw = digitalRead(BTN);
  if (raw != lastRaw) { lastRaw = raw; changedAt = now; }
  // 30ms 동안 같은 값이면 진짜로 바뀐 것으로 봅니다(접점 떨림 거르기)
  if (now - changedAt >= DEBOUNCE_MS) {
    bool pressed = (raw == LOW);
    if (pressed && !down) { down = true; downAt = now; longSent = false; }
    if (!pressed && down) {
      down = false;
      if (!longSent) Serial.println("BTN SHORT");
    }
  }
  if (down && !longSent && now - downAt >= LONG_MS) { longSent = true; Serial.println("BTN LONG"); }
  if (now - fsrAt >= FSR_MS) {
    fsrAt = now;
    Serial.print("FSR "); Serial.println(analogRead(FSR));
  }
}
