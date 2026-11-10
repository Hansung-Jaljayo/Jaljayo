import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "@/components/TabBar";
import {
  closeSettings,
  goOb,
  type ObState,
  openSettings,
  setFlow,
  useFlow,
} from "@/features/app/flow";
import {
  getBedInfo,
  getNightOverride,
  setBedInfo,
  setNightOverride,
  useBedInfo,
  wardDefault,
} from "@/features/bed/bed";
import {
  type BedMessage,
  type DevAnswer,
  pendingRequests,
  receiveBedReply,
  setDevResponder,
} from "@/features/bed/requests";
import {
  getHospital,
  resetHospital,
  setHospital,
} from "@/features/hospital/hospital";
import { regActions, regDev } from "@/features/reg/RegisterFlow";
import { sampleResv, setResvState, useResvState } from "@/features/resv/resv";
import { DEV_QR, qrScanDev } from "@/screens/QRScanScreen";
import { color, font, radius, shadow, space } from "@/theme/tokens";

import { DevSwitch } from "./DevSwitch";
import { useDevScene } from "./useDevScene";

// 개발할 때만 쓰는 시험 도구. 시안의 '등록 시험'·'상황 시험'을 한 판에 모았다.
// - 기능별 묶음 안에 회색 단추는 정상 흐름, 분홍 단추는 오류 상황이다. 단추 하나가 그 장면을 처음부터 바로 보여 준다
// - 스위치는 켜 두는 동안 계속 유지되는 상태(연결 끊김·시각 모름 등)
// - 침대와 주고받는 길이 아직 없어서, '침대 대신 자동으로 답하기'가 켜져 있으면 요청마다 시안과 같은 시간 뒤에 대신 답한다
// 앱은 이 폴더를 모른다(값과 개발용 입구만 쓴다). 떼려면 src/dev 폴더와 src/app/_layout.tsx의 DevTools 두 줄을 지우면 된다.
// README대로 시험 도구는 실제 앱에 넣지 않으므로 개발 빌드(__DEV__)에서만 그린다

// 단추 하나로 고른 상황. 다른 단추를 누르면 모두 지우고 그 단추의 상황만 켠다(시안 시험 칸과 같은 규칙)
type Scenario = {
  taken: boolean; // 찾은 침대가 다른 폰에 등록돼 있음
  notFound: boolean; // 침대를 못 찾음(한 번)
  confirmFail: boolean; // 등록 확인 답이 오지 않음(한 번)
  apFail: boolean; // 침대 와이파이에 붙지 못함(한 번)
  emptyWifi: boolean; // 주변 와이파이 목록이 비어 있음
  wifiFail: boolean; // 침대가 공유기 와이파이에 붙지 못함(한 번)
  nameTaken: boolean; // 고른 이름을 같은 병실 다른 침대가 먼저 씀(한 번)
  adminBad: boolean; // 관리 비밀번호 틀림(한 번)
  apart: boolean; // 병원 관리 저장 때 일부 침대가 답하지 않음
};
const SC0: Scenario = {
  taken: false,
  notFound: false,
  confirmFail: false,
  apFail: false,
  emptyWifi: false,
  wifiFail: false,
  nameTaken: false,
  adminBad: false,
  apart: false,
};
// 한 번 실패한 뒤에는 다시 시도하면 되도록 지우는 상황
const ONCE: (keyof Scenario)[] = [
  "notFound",
  "confirmFail",
  "apFail",
  "wifiFail",
  "nameTaken",
  "adminBad",
];

// 저장 요청(저장 응답 없음 스위치를 켜면 답하지 않는다)
const SAVES: BedMessage["type"][] = [
  "alarm-save",
  "alarm-delete",
  "resv-save",
  "resv-cancel",
  "pose-save",
  "pose-delete",
  "bed-reset",
  "name-save",
  "admin-save",
  "admin-password",
  "admin-move",
  "admin-end",
];

// 시안의 화면 넘김 시간에 맞춘 답 시간
const DELAY: Partial<Record<BedMessage["type"], number>> = {
  "bed-find": 500,
  "bed-register": 900,
  "wifi-join": 900,
  "wifi-scan": 400,
  "wifi-set": 1400,
};

const SCREEN_NAME: Record<ObState, string> = {
  splash: "시작 화면",
  scan: "QR 찍기",
  finding: "침대 찾는 중",
  swap: "다른 폰에 등록된 침대",
  kicked: "다른 폰에 밀려남",
  notfound: "침대를 못 찾음",
  nocam: "카메라 거부",
  nolan: "로컬 네트워크 거부",
  confirming: "등록 확인 중",
  confirmfail: "등록 확인 실패",
  wjoin: "침대 와이파이에 연결 중",
  wjoinfail: "침대 와이파이 연결 실패",
  wlist: "와이파이 고르기",
  wpass: "와이파이 비밀번호",
  wmove: "공유기 와이파이로 옮기는 중",
  wfail: "공유기 와이파이 연결 실패",
  upapp: "앱 업데이트 필요",
  upboard: "침대 업데이트 필요",
  name: "부르는 이름 고르기",
  night: "밤 시간",
  ended: "사용을 끝낸 침대",
  done: "등록 완료",
  apw: "병원 관리 비밀번호",
  admin: "병원 관리",
  abeds: "병원 관리 · 침대 목록",
  abed: "병원 관리 · 침대 하나",
  apwc: "병원 관리 · 비밀번호 바꾸기",
};

export function DevTools() {
  const bed = useBedInfo();
  const resv = useResvState();
  const flow = useFlow();
  const insets = useSafeAreaInsets();
  // 화면을 덜 가리도록 평소엔 "시험" 버튼만 보이고, 누르면 판이 펼쳐진다
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(true);
  const [noReply, setNoReply] = useState(false);
  const [waitCount, setWaitCount] = useState(0);
  const [cutIn, setCutIn] = useState(0);
  const [, rerender] = useState(0);
  const sc = useRef<Scenario>({ ...SC0 });
  const opts = useRef({ auto, noReply });
  useEffect(() => {
    opts.current = { auto, noReply };
  }, [auto, noReply]);
  useDevScene();

  // 침대 대신 답하기: 고른 상황에 맞는 답을 정한다
  useEffect(() => {
    if (!__DEV__) return;
    const answer = (m: BedMessage): DevAnswer => {
      if (!opts.current.auto) return null;
      if (opts.current.noReply && SAVES.includes(m.type)) return null;
      const s = sc.current;
      const once = (k: keyof Scenario) => {
        if (!s[k]) return false;
        if (ONCE.includes(k)) s[k] = false;
        return true;
      };
      const ward = !!getBedInfo().ward;
      switch (m.type) {
        case "bed-find":
          return once("notFound")
            ? "timeout"
            : { taken: s.taken, ward, name: "사과" };
        case "bed-register":
          return once("confirmFail") ? "timeout" : { ward, name: "사과" };
        case "wifi-join":
          return once("apFail") ? "timeout" : {};
        case "wifi-scan":
          return {
            networks: s.emptyWifi ? [] : ["Home_2G", "Home_5G", "Guest"],
          };
        case "wifi-set":
          return once("wifiFail") ? { ok: false } : { ok: true };
        case "admin-login":
          return { ok: !once("adminBad") };
        case "admin-save":
          return {
            missing: s.apart
              ? getHospital()
                  .beds.filter((b) => b.room === "305호")
                  .slice(0, 2)
                  .map((b) => b.id)
              : [],
          };
        case "name-save":
          return { ok: !once("nameTaken") };
        default:
          return {};
      }
    };
    setDevResponder({ answer, delayMs: (m) => DELAY[m.type] ?? 600 });
    return () => setDevResponder(null);
  }, []);

  // 판이 열려 있는 동안 기다리는 요청 수를 보여 준다
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setWaitCount(pendingRequests().length), 400);
    return () => clearInterval(t);
  }, [open]);

  // "± 누르는 중 끊김": 3초 세는 동안 ±를 길게 누르고 있으면 누르는 중에 끊긴다
  useEffect(() => {
    if (!cutIn) return;
    const t = setTimeout(() => {
      if (cutIn > 1) return setCutIn(cutIn - 1);
      setCutIn(0);
      setBedInfo({ connected: false });
    }, 1000);
    return () => clearTimeout(t);
  }, [cutIn]);

  if (!__DEV__) return null;

  const ward = !!bed.ward;
  const blocked = ward && !bed.ward!.alarmAllowed;

  // 장면을 처음 상태에서 시작한다: 고른 상황·열린 설정을 지우고 판을 접는다
  const fresh = (patch: Partial<Scenario> = {}) => {
    sc.current = { ...SC0, ...patch };
    closeSettings();
    setOpen(false);
  };
  // QR 화면을 띄우고(등록 안 된 상태) 화면이 뜨면 QR을 읽은 것처럼 넘긴다
  const scanThen = (data: string | null) => {
    regActions.unregister();
    if (data == null) return;
    let n = 0;
    const tryScan = () => {
      if (qrScanDev.current) qrScanDev.current(data);
      else if (n++ < 20) setTimeout(tryScan, 100);
    };
    setTimeout(tryScan, 150);
  };
  const toTab = (key: "pose" | "alarm" | "resv") => {
    fresh();
    setBedInfo({ registered: true });
    setFlow({ tabAsk: { key, n: Date.now() } });
    goOb(null);
  };
  const setWard = (on: boolean) =>
    setBedInfo({ ward: on ? wardDefault() : null });
  // 병원용 침대에서만 있는 장면: 집 침대면 병원용으로 바꾸고 연다
  const asWard = (fn: () => void) => {
    if (!getBedInfo().ward) setWard(true);
    fn();
  };
  const resetAll = () => {
    fresh();
    setAuto(true);
    setNoReply(false);
    setCutIn(0);
    setNightOverride(null);
    resetHospital();
    setHospital({ back: null });
    setBedInfo({
      registered: true,
      connected: true,
      clockOk: true,
      hasButton: true,
      ringingId: null,
      ward: null,
    });
    setResvState(sampleResv());
    setFlow({ tabAsk: { key: "pose", n: Date.now() } });
    goOb(null);
  };
  const replyNow = () => {
    for (const { id } of pendingRequests()) receiveBedReply(id, {});
    setWaitCount(0);
  };

  const now = flow.settings
    ? "설정"
    : flow.ob
      ? SCREEN_NAME[flow.ob]
      : "홈(탭 화면)";

  return (
    // 접혀 있으면 탭 막대 위 오른쪽 "시험" 버튼만 보인다. 펼치면 화면을 어둡게 덮고 한 장의 판 안에 모아 보여 준다(어두운 곳을 누르면 접힘)
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.dim]}
          onPress={() => setOpen(false)}
          accessibilityLabel="시험 도구 접기"
        />
      )}
      {open && (
        <View
          style={[
            styles.panel,
            {
              top: insets.top + 12,
              bottom: TAB_BAR_SPACE + insets.bottom + 44,
            },
          ]}
        >
          <View style={styles.top}>
            <View style={styles.topText}>
              <Text style={styles.topLabel}>지금 화면</Text>
              <Text style={styles.topNow} numberOfLines={1}>
                {now}
              </Text>
            </View>
            <Chip label="모두 처음으로" onPress={resetAll} />
          </View>
          <View style={styles.legend}>
            <View style={[styles.dot, styles.dotOk]} />
            <Text style={styles.legendText}>정상 흐름</Text>
            <View style={[styles.dot, styles.dotBad]} />
            <Text style={styles.legendText}>오류 상황</Text>
            <Text style={styles.legendText}>· 스위치는 켜 둔 동안 유지</Text>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            <Group title="바로 가기">
              <Chips>
                <Chip label="자세 탭" onPress={() => toTab("pose")} />
                <Chip label="알람 탭" onPress={() => toTab("alarm")} />
                <Chip label="예약 탭" onPress={() => toTab("resv")} />
                <Chip
                  label="설정"
                  onPress={() => {
                    toTab("pose");
                    openSettings();
                  }}
                />
                <Chip
                  label="시작 화면"
                  onPress={() => {
                    fresh();
                    goOb("splash");
                  }}
                />
              </Chips>
            </Group>

            <Group
              title="침대 종류"
              note="병원용을 고르면 병원 묶음이 나온다. 등록할 때 찾는 침대도 이 종류로 답한다"
            >
              <Segment
                options={["가정용", "병원용"]}
                value={ward ? 1 : 0}
                onChange={(i) => setWard(i === 1)}
              />
              <DevSwitch
                label="버튼 없는 침대 (알람 탭 막힘)"
                value={!bed.hasButton}
                onValueChange={(on) => setBedInfo({ hasButton: !on })}
              />
              {ward && (
                <DevSwitch
                  label="병원에서 알람을 막음"
                  value={blocked}
                  onValueChange={(on) =>
                    setBedInfo({
                      ward: {
                        ...(bed.ward ?? wardDefault()),
                        alarmAllowed: !on,
                      },
                    })
                  }
                />
              )}
            </Group>

            <Group title="등록">
              <Chips>
                <Chip
                  label="처음부터 (QR 화면)"
                  onPress={() => {
                    fresh();
                    scanThen(null);
                  }}
                />
                <Chip
                  label="QR 읽은 걸로"
                  onPress={() => {
                    fresh();
                    if (flow.ob === "scan" && qrScanDev.current)
                      qrScanDev.current(DEV_QR);
                    else scanThen(DEV_QR);
                  }}
                />
              </Chips>
              <Chips>
                <Chip
                  bad
                  label="다른 폰에 등록된 침대"
                  onPress={() => {
                    fresh({ taken: true });
                    scanThen(DEV_QR);
                  }}
                />
                <Chip
                  bad
                  label="잘못된 QR"
                  onPress={() => {
                    fresh();
                    scanThen("https://example.com");
                  }}
                />
                <Chip
                  bad
                  label="침대를 못 찾음"
                  onPress={() => {
                    fresh({ notFound: true });
                    scanThen(DEV_QR);
                  }}
                />
                <Chip
                  bad
                  label="등록 확인 실패"
                  onPress={() => {
                    fresh({ confirmFail: true });
                    scanThen(DEV_QR);
                  }}
                />
                <Chip
                  bad
                  label="다른 폰에 밀려남"
                  onPress={() => {
                    fresh();
                    goOb("kicked");
                  }}
                />
              </Chips>
            </Group>

            <Group title="권한">
              <Chips>
                <Chip
                  label="허용하고 돌아옴"
                  onPress={() => {
                    fresh();
                    goOb("scan");
                  }}
                />
              </Chips>
              <Chips>
                <Chip
                  bad
                  label="카메라 거부"
                  onPress={() => {
                    fresh();
                    goOb("nocam");
                  }}
                />
                <Chip
                  bad
                  label="로컬 네트워크 거부"
                  onPress={() => {
                    fresh();
                    goOb("nolan");
                  }}
                />
              </Chips>
            </Group>

            <Group title="와이파이 처음 설정">
              <Chips>
                <Chip
                  label="처음부터"
                  onPress={() => {
                    fresh();
                    regDev.current?.wifiJoin();
                  }}
                />
              </Chips>
              <Chips>
                <Chip
                  bad
                  label="목록 없음"
                  onPress={() => {
                    fresh({ emptyWifi: true });
                    regDev.current?.wifiJoin();
                  }}
                />
                <Chip
                  bad
                  label="비밀번호 틀림"
                  onPress={() => {
                    fresh();
                    regDev.current?.patch({ ssid: "Home_2G", wifiBad: true });
                    goOb("wpass");
                  }}
                />
                <Chip
                  bad
                  label="침대 와이파이 연결 실패"
                  onPress={() => {
                    fresh({ apFail: true });
                    regDev.current?.wifiJoin();
                  }}
                />
                <Chip
                  bad
                  label="공유기 와이파이 연결 실패"
                  onPress={() => {
                    fresh({ wifiFail: true });
                    regDev.current?.patch({ ssid: "Home_2G", wifiBad: false });
                    regDev.current?.wifiSet("12345678");
                  }}
                />
              </Chips>
            </Group>

            <Group title="업데이트">
              <Chips>
                <Chip
                  bad
                  label="앱 업데이트 필요"
                  onPress={() => {
                    fresh();
                    goOb("upapp");
                  }}
                />
                <Chip
                  bad
                  label="침대 업데이트 필요"
                  onPress={() => {
                    fresh();
                    goOb("upboard");
                  }}
                />
              </Chips>
            </Group>

            {/* 병원에만 있는 장면은 침대 종류를 병원용으로 골랐을 때만 보인다 */}
            {ward && (
              <>
                <Group title="병원용 침대">
                  <Chips>
                    <Chip
                      label="부르는 이름 고르기"
                      onPress={() =>
                        asWard(() => {
                          fresh();
                          goOb("name");
                        })
                      }
                    />
                    <Chip
                      label="밤 시간 보기"
                      onPress={() =>
                        asWard(() => {
                          fresh();
                          goOb("night");
                        })
                      }
                    />
                  </Chips>
                  <Chips>
                    <Chip
                      bad
                      label="고른 이름을 먼저 씀"
                      onPress={() =>
                        asWard(() => {
                          fresh({ nameTaken: true });
                          goOb("name");
                        })
                      }
                    />
                    <Chip
                      bad
                      label="병원이 사용을 끝냄"
                      onPress={() =>
                        asWard(() => {
                          fresh();
                          setBedInfo({ registered: false });
                          goOb("ended");
                        })
                      }
                    />
                  </Chips>
                  <DevSwitch
                    label="지금 밤 시간 (홈 안내 줄)"
                    value={getNightOverride() === true}
                    onValueChange={(on) => {
                      if (on && !getBedInfo().ward) setWard(true);
                      setNightOverride(on ? true : null);
                      rerender((n) => n + 1);
                    }}
                  />
                </Group>

                <Group
                  title="병원 관리 (직원)"
                  note="비밀번호는 아무 숫자 6자리"
                >
                  <Chips>
                    <Chip
                      label="병원 관리 열기"
                      onPress={() =>
                        asWard(() => {
                          fresh();
                          regActions.admin();
                        })
                      }
                    />
                  </Chips>
                  <Chips>
                    <Chip
                      bad
                      label="비밀번호 틀림"
                      onPress={() =>
                        asWard(() => {
                          fresh({ adminBad: true });
                          regActions.admin();
                        })
                      }
                    />
                    <Chip
                      bad
                      label="일부 침대 응답 없음"
                      onPress={() =>
                        asWard(() => {
                          fresh({ apart: true });
                          setHospital({ back: null });
                          goOb("admin");
                        })
                      }
                    />
                  </Chips>
                </Group>
              </>
            )}

            <Group title="연결·저장">
              <DevSwitch
                label="연결 끊김"
                value={!bed.connected}
                onValueChange={(on) => setBedInfo({ connected: !on })}
              />
              <DevSwitch
                label="저장 응답 없음 (5초 뒤 실패)"
                value={noReply}
                onValueChange={setNoReply}
              />
              <Chips>
                <Chip
                  label="침대 정보 다시 불러오기"
                  onPress={() => {
                    setOpen(false);
                    if (!getBedInfo().connected) return;
                    setBedInfo({ loading: true });
                    setTimeout(() => setBedInfo({ loading: false }), 1500);
                  }}
                />
                <Chip
                  bad
                  label={
                    cutIn ? `${cutIn}초 뒤 끊김` : "± 누르는 중 끊김 (3초 뒤)"
                  }
                  onPress={() => {
                    setOpen(false);
                    setCutIn(3);
                  }}
                />
              </Chips>
            </Group>

            <Group title="알람·예약">
              <DevSwitch
                label="침대 시계 무효 (시각 모름)"
                value={!bed.clockOk}
                onValueChange={(on) => setBedInfo({ clockOk: !on })}
              />
              <DevSwitch
                label="첫 알람이 지금 울리는 중"
                value={bed.ringingId != null}
                onValueChange={(on) => setBedInfo({ ringingId: on ? 1 : null })}
              />
              <DevSwitch
                label="예약 있음"
                value={resv.item != null}
                onValueChange={(on) =>
                  setResvState({ item: on ? sampleResv().item : null })
                }
              />
              <DevSwitch
                label="지난 예약 실패 기록"
                value={resv.fail != null}
                onValueChange={(on) =>
                  setResvState({ fail: on ? sampleResv().fail : null })
                }
              />
            </Group>

            <Group
              title="침대 답"
              note="침대와 주고받는 길이 없어 시험 도구가 대신 답한다"
            >
              <DevSwitch
                label="침대 대신 자동으로 답하기"
                value={auto}
                onValueChange={setAuto}
              />
              {!auto && (
                <Chips>
                  <Chip
                    label={`지금 답 보내기 (기다리는 요청 ${waitCount}개)`}
                    onPress={replyNow}
                  />
                </Chips>
              )}
            </Group>
          </ScrollView>
        </View>
      )}
      <Pressable
        style={[
          styles.toggle,
          styles.toggleAt,
          { bottom: TAB_BAR_SPACE + insets.bottom },
        ]}
        onPress={() => setOpen((o) => !o)}
        role="button"
        accessibilityLabel={open ? "시험 도구 접기" : "시험 도구 펼치기"}
      >
        <Text style={styles.toggleText}>
          {open ? "시험 접기" : cutIn ? `${cutIn}초 뒤 끊김` : "시험"}
        </Text>
      </Pressable>
    </View>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.head}>{title}</Text>
      {!!note && <Text style={styles.note}>{note}</Text>}
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return <View style={styles.btns}>{children}</View>;
}

function Chip({
  label,
  onPress,
  bad,
}: {
  label: string;
  onPress: () => void;
  bad?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        bad && styles.btnBad,
        pressed && styles.btnPressed,
      ]}
      onPress={onPress}
      role="button"
      accessibilityLabel={`시험: ${label}`}
    >
      <Text style={[styles.btnText, bad && styles.btnTextBad]}>{label}</Text>
    </Pressable>
  );
}

function Segment({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <View style={styles.seg} role="radiogroup">
      {options.map((o, i) => (
        <Pressable
          key={o}
          style={[styles.segBtn, value === i && styles.segOn]}
          onPress={() => onChange(i)}
          role="radio"
          aria-checked={value === i}
        >
          <Text style={[styles.segText, value === i && styles.segTextOn]}>
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: color.backdrop },
  panel: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: color.card,
    borderRadius: radius[26],
    boxShadow: shadow.card,
    overflow: "hidden",
  },
  // 판 머리: 지금 화면 이름 + 모두 처음으로
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[12],
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  topText: { flex: 1 },
  topLabel: { fontFamily: font.semiBold, fontSize: 12, color: color.muted },
  topNow: {
    fontFamily: font.bold,
    fontSize: 17,
    color: color.fg,
    marginTop: 2,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  legendText: { fontFamily: font.medium, fontSize: 12, color: color.muted },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotOk: {
    backgroundColor: color.inset,
    borderWidth: 1,
    borderColor: color.line,
  },
  dotBad: { backgroundColor: color.warnBg, marginLeft: 6 },
  list: { paddingHorizontal: 18, paddingBottom: 18 },
  group: { marginTop: 18 },
  groupBody: { gap: space[8] },
  head: { fontFamily: font.bold, fontSize: 15, color: color.fg },
  note: {
    fontFamily: font.medium,
    fontSize: 12,
    color: color.muted,
    marginTop: 2,
  },
  btns: { flexDirection: "row", flexWrap: "wrap", gap: space[8], marginTop: 2 },
  btn: {
    paddingHorizontal: space[12],
    paddingVertical: 9,
    borderRadius: radius[26],
    backgroundColor: color.inset,
  },
  btnBad: { backgroundColor: color.warnBg },
  btnPressed: { opacity: 0.6 },
  btnText: { fontFamily: font.semiBold, fontSize: 13, color: color.fg },
  btnTextBad: { color: color.red },
  seg: {
    flexDirection: "row",
    backgroundColor: color.inset,
    borderRadius: radius[26],
    padding: 3,
    marginTop: 6,
  },
  segBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radius[26],
  },
  segOn: { backgroundColor: color.ink },
  segText: { fontFamily: font.semiBold, fontSize: 13, color: color["fg-2"] },
  segTextOn: { color: color["on-ink"] },
  toggleAt: { position: "absolute", right: 18 },
  toggle: {
    paddingHorizontal: space[12],
    paddingVertical: space[6],
    borderRadius: radius[26],
    backgroundColor: color.card,
    boxShadow: shadow.card,
  },
  toggleText: { fontFamily: font.bold, fontSize: 13, color: color.red },
});
