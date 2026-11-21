package com.jaljayo.board

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import android.util.Log
import com.jaljayo.board.audio.AlarmSound
import com.jaljayo.board.audio.Chime
import com.jaljayo.board.audio.Listener
import com.jaljayo.board.audio.Speaker
import com.jaljayo.board.brain.AlarmFinder
import com.jaljayo.board.brain.AlarmItem
import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedSim
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.FruitMatch
import com.jaljayo.board.audio.NameScorer
import com.jaljayo.board.brain.Hearing
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import com.jaljayo.board.model.CommandModel
import com.jaljayo.board.model.LlamaServerModel
import com.jaljayo.board.model.PrevReply
import com.jaljayo.board.net.AdminPass
import com.jaljayo.board.net.AppApi
import com.jaljayo.board.net.BedLink
import com.jaljayo.board.net.Hub
import org.java_websocket.WebSocket
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import kotlin.math.roundToInt

// 보드 앱의 중심. 들은 말 → (정지 말이면 바로 멈춤) → 모델 → 규격 검사 → 두뇌 → 움직임·대답 → PC로 상태 보내기.
// 상태는 한 줄(main)에서만 바꾼다. 모델은 따로 돌고, 멈춘 뒤 늦게 온 결과는 버린다(epoch).
class BoardService : Service() {
    private val main = Executors.newSingleThreadScheduledExecutor()
    private val llm = Executors.newSingleThreadExecutor()
    private val epoch = AtomicInteger(0)
    private lateinit var clock: BoardClock
    private fun now() = if (::clock.isInitialized) clock.now() else System.currentTimeMillis()

    private var state = BedState()
    private val brain = Brain { now() }
    private val sim = BedSim()
    private val appApi = AppApi()
    @Volatile private var bedConn: WebSocket? = null   // 침대 역할(시연 화면, 나중에는 침대 제어부)
    @Volatile private var bedLink: BedLink? = null
    // 11/17 병원 시연: 침대 이름마다 침대 제어부 접속(hello role bed name). 제품의 "보드 한 대 = 침대 한 대"를 보드 하나 안에 침대 수만큼 둔다
    private val links = com.jaljayo.board.net.WardLinks<WebSocket> { c, o -> hub.sendTo(c, o) }
    private val phones = ConcurrentHashMap.newKeySet<WebSocket>()
    // 11/17: 병원 시연에서 폰은 침대 하나(사과)에 붙는다. 제품은 침대 한 대에 보드 한 대라 폰도 자기 침대 하나만 본다
    // 11/19: 어느 폰이 어느 침대에 붙었는지는 병원 침대 목록(hospital)이 기억한다(hello의 bed 또는 bed-register)
    private lateinit var hospital: com.jaljayo.board.net.HospitalBeds<WebSocket>
    private var appExtras: Map<Int, JSONObject> = emptyMap()
    private val replied = ConcurrentHashMap<WebSocket, LinkedHashMap<Int, JSONObject>>()  // 다시 보낸 요청은 앞의 답을 그대로 돌려준다
    private lateinit var extrasFile: File
    private lateinit var adminPass: AdminPass<WebSocket>   // 병원 관리 비밀번호와 지금 관리 중인 폰 접속
    private lateinit var spec: Spec
    private lateinit var model: CommandModel
    private lateinit var speaker: Speaker
    private lateinit var listener: Listener
    private lateinit var hub: Hub
    private var nano: com.jaljayo.board.net.UsbNano? = null
    @Volatile private var speakingNow = false
    private var alwaysListen = false   // 시험용: 부르는 말 없이 듣기
    @Volatile private var wakeUntil = 0L         // "잘자요"만 들은 뒤 이때까지는 부르는 말 없이 듣는다
    private var modelName = ""
    private var ready = false
    private val alarmSound = AlarmSound()
    private val chime by lazy { Chime(assets, "sounds/wake.wav") }     // "잘자요"를 알아들었을 때
    private val understood by lazy { Chime(assets, "sounds/understood.wav") }  // 듣는 중 명령을 알아들었을 때
    @Volatile private var dingNow = false
    @Volatile private var thinking = false
    private val offChime by lazy { Chime(assets, "sounds/off.wav") }   // 듣다가 아무 말 없이 꺼질 때
    private lateinit var store: Store
    // 11/17 병원 시연: 압력 센서도 침대마다 따로 둔다(가정용은 이름 ""). 지금 부른 침대의 센서가 bedSensor
    private val sensors = HashMap<String, com.jaljayo.board.brain.BedSensor>()
    private fun sensorOf(n: String) = sensors.getOrPut(n) { com.jaljayo.board.brain.BedSensor() }
    private val bedSensor get() = sensorOf(if (state.ward) state.name else "")
    private var soundPausedUntil = 0L  // 침대 이탈 알람: 버튼으로 잠깐 멈춘 소리가 다시 울릴 때

    override fun onBind(intent: Intent?): IBinder? = null

    private lateinit var aliveFile: File
    private var aliveWritten = 0L
    @Volatile private var bootAt = 0L
    private var lastAlive = 0L

    /** 11/14 보드 시험: USB 스피커 음량이 15 중 3으로 내려가 있어 말이 안 들렸다. 켤 때 너무 낮으면 기록에 남긴다 */
    private fun checkVolume() {
        val am = getSystemService(android.media.AudioManager::class.java) ?: return
        val v = am.getStreamVolume(android.media.AudioManager.STREAM_MUSIC); val max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
        if (v < max) { am.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, max, 0); log("보드 음량을 최대로 맞췄어요($v → $max/$max)") }
    }

    /** 11/14: 보드 앱이 꺼져 있던 동안(마지막으로 살아 있던 때부터 지금 2분 전까지) 울렸어야 할 알람을 알린다. 울리지는 않는다(설계서: 지난 회차를 늦게 울리지 않음) */
    private fun reportMissed() {
        if (lastAlive <= 0 || !state.timeValid) return
        val from = AlarmFinder.nowLocal(lastAlive); val to = AlarmFinder.nowLocal(bootAt - 120_000)
        if (!to.isAfter(from)) return
        val missed = state.alarms.filter { a ->
            generateSequence(from.toLocalDate()) { it.plusDays(1) }.takeWhile { !it.isAfter(to.toLocalDate()) }
                .any { d -> val at = d.atTime(a.time); at.isAfter(from) && !at.isAfter(to) && a.ringsOn(d) && (a.lastFired == null || a.lastFired.isBefore(at)) }
        }
        if (missed.isEmpty()) return
        val msg = "보드가 꺼져 있는 동안 ${missed.joinToString(", ") { com.jaljayo.board.brain.AlarmItem.timeKo(it.time) }} 알람 시각이 지나 울리지 못했어요"
        say(msg); turn("", "", msg, "", 0, 0)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startAsForeground()
        if (!::hub.isInitialized) Thread({ boot() }, "boot").start()
        return START_STICKY
    }

    private fun boot() {
        try {
            log("켜는 중")
            spec = Spec(assets.open("spec_v09.json").bufferedReader().readText())
            store = Store(File(filesDir, "bed_state.json"))
            aliveFile = File(filesDir, "alive.txt")
            lastAlive = try { aliveFile.readText().trim().toLong() } catch (_: Exception) { 0L }
            clock = BoardClock(File(filesDir, "clock.json"),
                { try { File("/proc/sys/kernel/random/boot_id").readText().trim() } catch (e: Exception) { "" } },
                { android.provider.Settings.Global.getInt(contentResolver, android.provider.Settings.Global.AUTO_TIME, 0) == 1 })
            clock.start()
            // 알람·예약·저장 자세를 다시 읽는다. 시각은 저장해 둔 맞춤값이나 인터넷 시간이 있으면 그대로 쓴다(BoardClock)
            state = store.load(state).copy(timeValid = clock.valid)
            bootAt = now()
            val saved = try { File(filesDir, "ward.txt").readText().trim() } catch (_: Exception) { "" }
            // 11/14: ward.txt에는 맡은 침대 이름들("사과" 또는 "사과,포도,복숭아"). 처음 판의 "demo"는 시연 3대
            val names = (if (saved == "demo") WARD_DEMO else saved.split(",").map { it.trim() }.filter { it in FruitMatch.FRUITS })
                .let { if (it == OLD_WARD_DEMO) WARD_DEMO else it }   // 11/17: 예전 시연(복숭아)으로 저장돼 있으면 새 시연(딸기)으로
            // 11/19 병원 침대 목록(고유 번호·호실·번호·부르는 이름, 병원 설정). 고유 번호는 안드로이드 기기 번호를 줄인 4자 + 칸 번호
            val androidId = try { android.provider.Settings.Secure.getString(contentResolver, android.provider.Settings.Secure.ANDROID_ID) ?: "" } catch (_: Exception) { "" }
            hospital = com.jaljayo.board.net.HospitalBeds(File(filesDir, "hospital_beds.json"), androidId, names)
            log("보드 고유 번호: ${hospital.board}")
            if (names.isNotEmpty()) { loadWard(names, state.timeValid); wardList = names; log("병원용 이어서: ${names.joinToString("·")} 침대") }
            else if (state.ward) state = state.copy(ward = false, name = if (state.name in FruitMatch.FRUITS) "잘자요" else state.name)   // 11/14 한 침대 연습판에서 남은 값
            syncNames()
            log(if (clock.valid) "보드 시계를 써요" else "시각을 모르니 폰 앱과 한 번 연결해 주세요")
            extrasFile = File(filesDir, "app_extras.json")
            appExtras = loadExtras()
            adminPass = AdminPass(File(filesDir, "admin_pass.json")) { now() }
            hub = Hub(8765, { m, c -> onMessage(m, c) }, { c -> left(c) }).also { it.start() }
            nano = com.jaljayo.board.net.UsbNano(this, { log(it) }) { line -> main.execute { nanoLine(line) } }.also { it.start() }   // 11/19 보드 USB에 꽂은 침대 버튼·압력 센서
            val dir = "/data/local/tmp/jaljayo_llm"
            // 16차 모델을 먼저 쓴다. 없으면 이전 모델
            val gguf = listOf("$dir/v22-ans-q8_0.gguf", "$dir/v21-ans-q8_0.gguf", "$dir/v20-ans-q8_0.gguf", "$dir/v16-ans-q8_0.gguf", "$dir/v09-avg-hjln-q8_0.gguf","$dir/v08-7-best-q8_0.gguf", "$dir/v08-7-ep2-q8_0.gguf").first { File(it).exists() }
            modelName = File(gguf).name
            com.jaljayo.board.model.Prompt.forModel(modelName)   // 11/15: 21차부터 입력에 [앞 대답] 칸
            log("모델 입력 모양: ${com.jaljayo.board.model.Prompt.FORMAT}")
            model = LlamaServerModel(File(applicationInfo.nativeLibraryDir, "libllama_server.so"), gguf)
            log("모델 불러오는 중: $modelName")
            model.start()
            log("목소리 불러오는 중")
            speaker = Speaker(this) { speaking -> speakingNow = speaking; muteMic() }
            log("음성 인식 불러오는 중")
            listener = Listener(assets) { text, ms, nm, kind -> heard(text, ms, typed = false, nm, kind) }.also { it.onBarge = { t, nm -> bargeIn(t, nm) }; it.takeBackFragment = { takeBackFragment() }; it.expectAnswer = { state.pending != null || (state.ringing != null && state.question != null) }; it.recDir = getExternalFilesDir("rec"); it.contDir = getExternalFilesDir("cont") }   // 11/14: 받아쓰기 비교용 녹음
            if (state.ward) Thread({ setupNameScorer() }, "name-scorer").start()   // 11/15 병원용 이름 점수(처음 한 번 모델 복사)
            listener.start()
            main.scheduleWithFixedDelay({ tick() }, 0, 50, TimeUnit.MILLISECONDS)
            ready = true
            // 11/11: 정해진 대답 문장을 한가할 때 미리 만들어 둔다(말하는 중·듣는 중·생각 중이면 기다림)
            speaker.warmUp { !speakingNow && !dingNow && now() >= wakeUntil && !thinking && state.pending == null }
            log("준비됨 · 모델 $modelName")
            checkVolume()
            reportMissed()
            publishState()
        } catch (e: Exception) {
            Log.e(TAG, "켜기 실패", e); log("켜기 실패: ${e.message}")
        }
    }

    // ---------- 들은 말 처리 ----------
    private fun heard(raw: String, asrMs: Long, typed: Boolean, nm: NameScorer.Result? = null, kind: Int = Listener.PLAIN) = main.execute {
        if (!ready) return@execute
        // 11/16: 덜 끝난 말을 처리하던 중 이어진 말과 합친 것. 앞말은 이미 듣는 창 안에서 받았고 띠링도 냈다
        val merged = kind == Listener.MERGED && fragTaken
        fragTaken = false
        if (kind != Listener.MERGED) fragEpoch = -1
        val echo = !typed && state.ward && nearAck()
        val norm = Hearing.normalize(raw).let { if (echo) stripAckEcho(it) else it }
        // 11/17: 대답 끝에 걸쳐 시작한 말은 보드 목소리가 섞여 있어 이름 점수를 쓰지 않는다(자기 대답을 이름 부름으로 다시 받지 않게)
        @Suppress("NAME_SHADOWING") val nm = if (echo) null else nm
        if (echo && norm != Hearing.normalize(raw)) Log.i(TAG, "대답 끝에 걸친 보드 목소리를 지웠어요: \"${Hearing.normalize(raw)}\" → \"$norm\"")
        if (norm.isEmpty() && nm?.fruit == null) return@execute
        // 11/14 병원용: "<과일> 침대"가 "잘자요"와 같은 부르는 말이다(띠링 → 이름 넣은 대답 → 8초 듣기, 뒤에 붙은 말은 버림. 잘자요와 같은 방식).
        // 병원 시연은 보드 하나가 침대 여러 대를 맡는다. 부른 이름의 침대로 바꾸고, 이어지는 명령은 그 침대에만 적용한다. 이 병실에 없는 이름이면 대답하지 않는다
        // 11/15: 병원용 이름은 받아쓴 글자 대신 소리 점수(NameScorer)로 정한다. 점수기가 없을 때(직접 친 글, 불러오기 실패)만 글자로 찾는다
        val wardCall = if (!state.ward) null
            else if (nm != null) nm.fruit?.let { FruitMatch.Called(it, FruitMatch.match(norm)?.rest ?: "") }
            else FruitMatch.match(norm)
        // 11/19: 부르는 이름은 병원 침대 목록의 이름을 따른다(환자가 고른 과일). 등록 전이거나 이름이 없는 침대는 대답하지 않는다
        val callKey = wardCall?.let { callKey(it.fruit) }
        if (wardCall != null && callKey == null) { turn(raw, "", "", "이 병실에 없는 침대(${wardCall.fruit} 침대)를 불러 대답하지 않아요.", asrMs, 0, bed = null); return@execute }
        // 11/19 병원 설정 밤 시간: 이름 부르기를 받지 않는다(침대 버튼을 누르면 말할 수 있음). 알람이 울리는 중이거나 이미 듣는 중이면 받는다
        if (wardCall != null && nightNow() && state.ringing == null && now() >= wakeUntil && state.pending == null) { turn(raw, "", "", "밤 시간이라 이름 부르기를 받지 않았어요. 침대 버튼을 누르면 말할 수 있어요.", asrMs, 0, bed = null); return@execute }
        // 11/15: 이름이 둘 들어오면("사과 침대 포도 침대") 어느 침대인지 정하지 않고 다시 묻는다
        if (wardCall != null && FruitMatch.FRUITS.any { it != wardCall.fruit && norm.replace(" ", "").contains(it) }) {
            val again = "다시 한 번 말씀해 주세요"; say(again)
            turn(raw, "", again, "침대 이름이 둘 이상 들려 어느 침대인지 정하지 않았어요.", asrMs, 0); return@execute
        }
        // 11/15: 알람이 울리는 동안에는 울리는 침대 이름만 받는다
        if (wardCall != null && state.ringing != null && callKey != state.name) { turn(raw, "", "", "${callName(state.name)} 침대 알람이 울리는 중이라 ${wardCall.fruit} 침대 부름은 받지 않았어요.", asrMs, 0); return@execute }
        if (callKey != null) switchTo(callKey)
        val h = if (state.ward) Hearing.Heard(wardCall?.rest ?: norm, wardCall != null) else Hearing.wake(norm)
        var text = h.text
        // 11/10 결정: 부르는 말과 명령을 한 번에 받지 않는다. "잘자요"로 시작하면(뒤에 붙은 말은 버림) "띠링" 소리를 내고
        // 다음 말을 8초 동안 부르는 말 없이 듣는다. 소리가 나는 동안은 마이크를 끈다
        if (h.woke) {
            fragText = null; fragWaiting = false
            // 11/14 보드 시험: 물은 뒤 대답 전에 "잘자요"부터 하면 기다리는 10초가 지나 질문이 닫혔다. 묻는 중이면 기다리는 시간을 다시 10초로
            if (state.pending != null) { pendingUntil = now() + 10_000; askLimit = maxOf(askLimit, pendingUntil + 5_000) }
            if (state.ward) {
                // 11/15: 병원용은 "네, 사과 침대예요" → 띠링 → 명령. 띠링이 "이제 말하세요" 신호(가정용과 같은 뜻)
                // 11/17: 시각을 잃은 채 켜졌고 맞춰 둔 알람이 있으면, 켜진 뒤 처음 부를 때 한 번만 대답 뒤에 안내를 붙이고 다 말한 뒤 듣는다
                val notice = clockNoticeOnce()
                val ans = "네, ${callName(state.name)} 침대예요" + (notice?.let { ". $it" } ?: "")
                wardAck(ans)
                turn(raw, "", ans, "부르는 이름을 들었어요. 이름을 넣어 답한 뒤 띠링을 내고 다음 말을 기다려요.${if (notice != null) " 시계를 잃은 뒤 처음 불러 알람 안내를 붙였어요." else ""}${if (text.isNotEmpty()) " 함께 들은 \"$text\"는 버렸어요." else ""}", asrMs, 0); return@execute
            }
            val notice = clockNoticeOnce()
            if (notice != null) {
                // 가정용은 평소 대답 없이 띠링만 내므로, 띠링 → 안내 → 다 말한 뒤 듣기
                ding(chime); nextNotBefore = System.currentTimeMillis() + chime.durationMs
                ackText = notice; ackEndWall = Long.MAX_VALUE
                say(notice) { ackEndWall = System.currentTimeMillis(); openListen(earlyMs = 1000) }
                turn(raw, "", notice, "부르는 말을 들었어요. 시계를 잃은 뒤 처음 불러 알람 안내를 한 뒤 다음 말을 기다려요.", asrMs, 0); return@execute
            }
            openListen()
            ding(chime)
            turn(raw, "", "", "부르는 말을 들었어요(띠링). 다음 말을 기다려요.${if (text.isNotEmpty()) " 함께 들은 \"$text\"는 버렸어요." else ""}", asrMs, 0); return@execute
        }
        // 정지 말은 부르는 말 없이도, 모델을 거치지 않고 바로 멈춘다
        brain.quickStop(state, text)?.let { t ->
            epoch.incrementAndGet()
            apply(t, reply = true); turn(raw, "모델을 거치지 않음", t.say, t.note, asrMs, 0); return@execute
        }
        // 덧셈 알람의 답을 기다리는 중에도 부르는 말 없이 듣는다
        val answering = state.ringing != null && state.question != null
        // 11/14: 결과가 늦게 나와도(긴 말, 숫자 다시 읽기) 말을 시작한 때가 듣는 창 안이면 받는다
        val startedInWindow = !typed && wakeEndWall > 0 && listener.lastStartWall in wakeOpenWall..wakeEndWall
        val listening = merged || typed || alwaysListen || h.woke || now() < wakeUntil || startedInWindow || state.pending != null || answering
        if (!listening) { turn(raw, "", "", "부르는 말이 없어 듣지 않았어요.", asrMs, 0); return@execute }
        wakeUntil = 0; wakeEndWall = 0
        // 11/16: 덜 끝난 말("다리를")을 되물은 뒤 이어진 말이면 앞말을 붙여 한 문장으로 모델에 넘긴다("다리를 십오 도 올려 줘")
        val fragPrev = fragText?.takeIf { kind != Listener.FRAGMENT && now() < fragUntil }
        fragText = null
        if (fragPrev != null) text = "$fragPrev $text"
        // 11/17: 부른 직후(물은 것 없음, 멈춰 있음, 알람 없음) "됐어·아니야·그냥 둬"류면 모델에 넘기지 않고 대답 없이 꺼지는 소리만 내고 듣기를 닫는다
        val quiet = !merged && fragPrev == null && state.pending == null && !answering && state.ringing == null && !state.moving
        if (quiet && Brain.isDismiss(text)) {
            epoch.incrementAndGet(); ding(offChime)
            turn(raw, "모델을 거치지 않음(그만두는 말)", "", "부른 뒤 그만두는 말이라 대답 없이 듣기를 닫았어요.", asrMs, 0); return@execute
        }
        // 11/15: 말이 끝나면(받아 적는 대로) 바로 알아들었다는 소리를 내고, 대답은 그 소리가 끝나는 대로 준비되면 바로 한다
        if (!typed && !merged) { ding(understood); nextNotBefore = System.currentTimeMillis() + understood.durationMs }
        // 11/14 보드 시험: 둘 중 하나를 물은 뒤 '전자·앞에 거·마지막'이면 보드가 고르고, 예·아니오를 물은 뒤 '음'(응을 잘못 받아 적음)이면 '응'으로 받는다
        // 11/17: "다 올려·다 내려"류는 모델 출력과 상관없이 보드가 정한다(둘 다 끝까지·둘 다 0도, 앞 대답이 한 부위 일이면 그 부위)
        if (!answering) brain.allUpDown(state, text, prevReply.get(now()))?.let { t -> epoch.incrementAndGet(); apply(t, listenAfter = true, reply = true); turn(raw, "모델을 거치지 않음(다 올려·다 내려)", t.say, t.note, asrMs, 0); return@execute }
        // 11/17: 숫자 두 개 + 올려·내려에 "로"가 없으면 각각 그만큼 더(모델은 그 각도로 맞추는 쪽으로 냄)
        if (!answering) brain.twoAngleDelta(state, text)?.let { t -> epoch.incrementAndGet(); apply(t, listenAfter = true, reply = true); turn(raw, "모델을 거치지 않음(숫자 둘, 로 없음)", t.say, t.note, asrMs, 0); return@execute }
        brain.pickByOrder(state, text)?.let { t -> epoch.incrementAndGet(); apply(t, listenAfter = true, reply = true); turn(raw, "모델을 거치지 않음(순서 말)", t.say, t.note, asrMs, 0); return@execute }
        if (brain.mumbleYes(state, text)) (spec.parse(YES) as? Spec.Result.Ok)?.let { r ->
            epoch.incrementAndGet()
            val t = brain.handleSafely(state, text, r.cmd, YES); apply(t, listenAfter = true, reply = true); turn(raw, "모델을 거치지 않음(응으로 받음)", t.say, t.note, asrMs, 0); return@execute
        }
        val my = epoch.get()
        fragEpoch = if (kind == Listener.FRAGMENT) my else -1
        // 11/16 보드 시험: 덜 끝난 말을 모델에 맡기면 "다리를"이 잡담으로 나와 엉뚱한 안내를 했다. 모델을 거치지 않고 보드가 직접 되묻는다.
        // 되묻기 전 1.5초 동안 이어진 말이 오면 합쳐 다시 받아쓴다(takeBackFragment). 되물은 뒤 이어진 말은 앞말을 붙여 받는다
        if (kind == Listener.FRAGMENT && !typed && state.pending == null && !answering) {
            fragWaiting = true
            val fragRaw = raw; val fragHeard = text
            val giveUpAt = now() + 15_000
            lateinit var ask: Runnable
            ask = Runnable {
                if (!fragWaiting || epoch.get() != my) return@Runnable
                // 11/16: 사람이 말하는 중이면 되묻지 않고 그 말이 끝날 때까지 기다린다(그 말은 덜 끝난 말과 합쳐진다)
                if (::listener.isInitialized && (listener.inSpeech || listener.busy) && now() < giveUpAt) { main.schedule(ask, 200, TimeUnit.MILLISECONDS); return@Runnable }
                fragWaiting = false; fragEpoch = -1
                val q = fragQuestion(fragHeard)
                fragText = fragHeard; fragUntil = now() + 15_000
                apply(Turn(state, say = q), listenAfter = true, reply = true)
                turn(fragRaw, "모델을 거치지 않음(덜 끝난 말)", q, "덜 끝난 말이라 보드가 이어서 말하도록 되물었어요.", asrMs, 0)
            }
            main.schedule(ask, 1500, TimeUnit.MILLISECONDS)
            return@execute
        }
        val notBefore = nextNotBefore
        val asked = brain.waitingQuestion(state)  // 지금 대답을 기다리는 질문(모델 입력의 [앞 질문])
        val status = brain.status(state)          // 지금 보드 상태(모델 입력의 [상태])
        val reply = prevReply.get(now())          // 11/14 B4: 보드가 직전에 한 대답(모델 입력의 [앞 대답], Prompt.PREV_REPLY_IN_PROMPT가 켜졌을 때만 들어감)
        thinking = true
        llm.execute {
            val t0 = System.currentTimeMillis()
            // 7차·8차 모델(v0.8)의 skip·disable 출력은 v0.9 skip으로 옮긴다
            val out = Spec.upgrade(try { model.infer(text, asked, status, reply) } catch (e: Exception) { Log.e(TAG, "모델 실패", e); "" })
            val ms = System.currentTimeMillis() - t0
            thinking = false
            main.execute {
                if (epoch.get() != my) { turn(raw, out, "", if (my == takenEpoch) "이어진 말과 합쳐 다시 받아써서 이 결과는 쓰지 않았어요." else "멈춘 뒤 늦게 온 결과라 실행하지 않았어요.", asrMs, ms); return@execute }
                val parsed = spec.parse(out)
                // 11/17: 부른 직후 모델이 그만두기(취소·아니)를 냈고 지금도 물은 것·움직임·알람이 없으면 목록의 말과 똑같이 대답 없이 닫는다
                if (quiet && parsed is Spec.Result.Ok && Brain.isQuitCmd(parsed.cmd) && state.pending == null && !state.moving && state.ringing == null) {
                    nextNotBefore = notBefore; ding(offChime)
                    turn(raw, out, "", "부른 뒤 모델이 그만두는 말로 봐서 대답 없이 듣기를 닫았어요.", asrMs, ms); return@execute
                }
                val t = when (val r = parsed) {
                    is Spec.Result.Bad -> (brain.reask(state, text) ?: Turn(state, say = "다시 한 번 말씀해 주세요")).copy(note = "출력 형식 오류(${r.why})라 움직이지 않았어요.")
                    // 11/19: 알람 쓰기를 끈 병원이면 알람을 새로 맞추는 말(맞추기, 없으면 만들어 켜기)은 받지 않는다
                    is Spec.Result.Ok -> if (alarmOff() && Brain.makesAlarm(r.cmd)) Turn(state.copy(pending = null), say = AppApi.NO_ALARM, note = "알람 쓰기를 끈 병원이라 알람을 맞추지 않았어요.")
                        else brain.handleSafely(state, text, r.cmd, out)
                }
                // 11/11: 대답 뒤에는 더 듣지 않는다. 보드가 다시 말해 달라고 했을 때만 8초 기다린다(apply)
                nextNotBefore = notBefore
                apply(t, listenAfter = true, reply = true); turn(raw, out, t.say, t.note, asrMs, ms)
            }
        }
    }

    @Volatile private var fragEpoch = -1    // 11/16: 덜 끝난 말("머리를")을 모델이 처리하는 차례
    @Volatile private var takenEpoch = -1
    @Volatile private var fragTaken = false
    /** 11/16: 넘긴 덜 끝난 말을 모델이 아직 처리하는 중(대답 전)이면 그 결과를 버리게 하고 true. 이어진 말과 합쳐 다시 받는다 */
    private fun takeBackFragment(): Boolean {
        val e = fragEpoch
        if (e < 0 || !(thinking || fragWaiting) || !epoch.compareAndSet(e, e + 1)) return false
        fragEpoch = -1; takenEpoch = e; fragTaken = true; fragWaiting = false
        return true
    }
    @Volatile private var fragWaiting = false   // 11/16: 덜 끝난 말을 되묻기 전 1.5초 기다리는 중
    @Volatile private var fragText: String? = null; @Volatile private var fragUntil = 0L   // 되물은 덜 끝난 말과 그 기한
    /** 덜 끝난 말에 보드가 되묻는 말 */
    private fun fragQuestion(t: String): String {
        val x = t.replace(" ", "")
        return when {
            x.startsWith("머리") -> "머리 올릴까요, 내릴까요?"
            x.startsWith("다리") -> "다리 올릴까요, 내릴까요?"
            x.startsWith("알람") -> "알람을 어떻게 할까요?"
            else -> "이어서 말씀해 주세요."
        }
    }

    /** 11/14 B4: 모델 입력의 [앞 대답]. 사람 말에 한 대답만 적는다(알람이 울린다는 안내·센서 소식은 적지 않음) */
    private val prevReply = PrevReply()

    /** 새 상태를 쓰고, 지금 할 말이 있으면 말한다. 질문이면 대답 뒤 10초를 기다린다.
     *  reply: 사람 말에 한 대답이면 true(앞 대답으로 적음) */
    private fun apply(t0: Turn, listenAfter: Boolean = false, reply: Boolean = false) {
        val t = brain.recordAsked(state, t0)  // 이번에 묻는 질문 문장을 그대로 적어 둔다(다음 말의 모델 입력에 씀)
        state = stampAlarms(state, t.state)
        if (t.say.isNotEmpty()) {
            state = state.copy(lastSpeech = t.say)
            if (reply) prevReply.record(t.say, brain.waitingQuestion(state) != null, now())
            val asked = state.pending
            // 묻는 게 걸려 있으면(pending) 그 대답을 기다리고, 걸린 건 없지만 다시 말해 달라고 했으면 8초 듣는다
            val reopen = listenAfter && asked == null && Regex("(\\?|말씀해 주세요\\.?)$").containsMatchIn(t.say.trim())
            val alarmRef = state.lastAlarmUntil
            val alarmLive = alarmRef >= now()   // 이번 턴이 알람 얘기였을 때만(오래전 알람을 다시 살리지 않음)
            say(t.say) {
                if (reopen) openListen()
                // 알람 얘기를 다 말한 뒤부터 10초 동안 "이 알람"을 받는다
                if (alarmLive && state.lastAlarmUntil == alarmRef) { state = state.copy(lastAlarmUntil = now() + Brain.RECENT_MS) }
                if (asked != null) { pendingUntil = now() + 10_000; askLimit = pendingUntil + 5_000; closeAsk(asked) }
            }
        }
        publishState()
    }

    /** 11/15: 병원용 부름의 대답.
     *  11/17: 띠링을 대답 앞으로 옮겼다("띠링 → 네, ○○ 침대예요"). 사람은 대답을 듣자마자 다음 말을 하니, 대답이 끝나는 즉시 듣기를 열고
     *  대답 끝 1초 전부터 시작한 말도 받는다(Listener가 보드 말 끝 1초를 붙여 줌). 붙은 보드 목소리("…침대예요")는 stripAckEcho가 지운다 */
    private fun wardAck(ans: String) {
        ding(chime); nextNotBefore = System.currentTimeMillis() + chime.durationMs
        ackText = ans; ackEndWall = Long.MAX_VALUE
        say(ans) { ackEndWall = System.currentTimeMillis(); openListen(earlyMs = 1000) }
    }

    /** 11/17: 보드가 시각을 잃었고(껐다 켬) 맞춰 둔 알람이 있으면 알람이 멈춘 상태. 화면에 늘 보이고, 켜진 뒤 처음 부를 때 한 번 말한다 */
    private fun clockLost(): Boolean = !state.timeValid && !alarmOff() && (listOf(state) + beds.values).any { b -> b.alarms.any { it.enabled } }
    @Volatile private var clockTold = false
    /** 11/17: 보드 화면 시계. 앱이 시각을 받았으면 앱 시계(안드로이드 시계 + 맞춘 차이), 아직 못 받았으면 null */
    fun screenTime(): Long? = if (::clock.isInitialized && state.timeValid) clock.now() else null
    private fun clockNoticeOnce(): String? = if (!clockTold && clockLost()) { clockTold = true; CLOCK_NOTICE } else null

    @Volatile private var ackText = ""
    @Volatile private var ackEndWall = 0L

    /** 11/17: 이름 대답이 끝나기 직전에 시작한 말이면, 받아쓴 글 앞에 붙은 보드 목소리(대답의 끝부분)를 지운다 */
    private fun nearAck() = ackText.isNotEmpty() && ackEndWall != Long.MAX_VALUE && System.currentTimeMillis() - ackEndWall < 5000 &&
        ::listener.isInitialized && listener.lastStartWall <= ackEndWall + 100

    private fun stripAckEcho(norm: String): String {
        fun key(t: String) = t.replace(" ", "").replace("예요", "에요").replace("이에요", "에요")
        val a = key(Hearing.normalize(ackText)); val c = key(norm)
        for (k in minOf(a.length, c.length) downTo 2) {
            if (c.startsWith(a.takeLast(k))) {
                // 공백을 빼고 센 글자 k개만큼 앞에서 지운다("예요"→"에요"로 바꿔 셌으니 원래 글에서도 같은 수만큼)
                var cnt = 0; var i = 0
                val src = norm.replace("예요", "에요").replace("이에요", "에요")
                while (i < src.length && cnt < k) { if (src[i] != ' ') cnt++; i++ }
                return src.substring(i).trim()
            }
        }
        return norm
    }

    @Volatile private var askLimit = 0L       // 11/15: 물은 뒤 대답을 기다리는 전체 상한(10초 + 말하는 중이면 최대 5초 더)
    @Volatile private var pendingUntil = 0L   // 11/14: 물은 것의 대답을 이때까지 기다린다("잘자요"를 들으면 늘어남)

    /** 물었는데 대답 없이 기다리는 시간이 지나면 듣기를 끝내고 꺼지는 소리를 낸다 */
    private fun closeAsk(asked: com.jaljayo.board.brain.Pending) {
        main.schedule({
            if (state.pending !== asked) return@schedule
            if (now() < pendingUntil) { closeAsk(asked); return@schedule }
            // 11/15: 기다리는 시간이 끝났을 때 사람이 말하는 중이거나 그 말을 받아 적는 중이면 상한(15초)까지 더 기다린다
            if (::listener.isInitialized && (listener.inSpeech || listener.busy) && now() < askLimit) { pendingUntil = minOf(askLimit, now() + 300); closeAsk(asked); return@schedule }
            state = state.copy(pending = null); publishState(); if (!speakingNow && !dingNow) ding(offChime)
        }, maxOf(200L, pendingUntil - now()), TimeUnit.MILLISECONDS)
    }

    /** 소리를 내는 동안은 마이크를 끈다 */
    private fun ding(c: Chime) {
        val id = dingSeq.incrementAndGet()
        dingNow = true; muteMic()
        // 11/14: 소리 끝 신호가 오지 않아도 3초 뒤에는 마이크를 다시 연다(보드 시험에서 마이크가 계속 막힌 일)
        main.schedule({ if (dingSeq.get() == id && dingNow) { dingNow = false; muteMic(); Log.w(TAG, "알림 소리 끝 신호가 없어 마이크를 다시 열었어요") } }, 3, TimeUnit.SECONDS)
        try { c.play { if (dingSeq.get() == id) { dingNow = false; muteMic() } } }
        catch (e: Exception) { Log.e(TAG, "알림 소리 실패", e); dingNow = false; muteMic() }
    }
    private val dingSeq = AtomicInteger(0)

    /** 11/15: 병원용 이름 점수기를 켠다. SenseVoice 모델 파일(239MB)을 앱 저장 공간에 한 번 복사해 쓴다(onnxruntime은 파일 경로가 필요) */
    private fun setupNameScorer() {
        try {
            val dir = File(filesDir, "name_sv").also { it.mkdirs() }
            for (f in listOf("model.int8.onnx", "tokens.txt")) {
                val dst = File(dir, f)
                val size = assets.openFd("models/asr/$f").use { it.length }
                if (dst.length() != size) assets.open("models/asr/$f").use { i -> dst.outputStream().use { o -> i.copyTo(o, 1 shl 20) } }
            }
            listener.nameScorer = NameScorer(File(dir, "model.int8.onnx"), File(dir, "tokens.txt"))
            log("병원용 이름 점수 켬")
        } catch (e: Throwable) { Log.e(TAG, "이름 점수 켜기 실패", e); log("이름 점수 켜기 실패(글자로 찾음): ${e.message}") }
    }

    /** 11/11: 말하는 중에 "잘자요"를 들으면 말과 하던 일(생각 중인 결과, 묻던 것, 움직임)을 멈추고 다시 듣는다.
     *  울리는 알람은 그대로 둔다. 보드 대답 자체에 "잘자요"가 들어 있으면(앱 이름) 자기 목소리라 무시한다 */
    private fun bargeIn(raw: String, nm: NameScorer.Result? = null) = main.execute {
        val nr = Hearing.normalize(raw)
        // 11/15: 병원용은 소리 점수로 이름만 부른 말인지 본다(이름 뒤에 글자가 나온 칸이 없어야 함)
        val call = if (!state.ward) null
            else if (nm != null) nm.fruit?.takeIf { callKey(it) != null && nm.after == 0 }?.let { FruitMatch.Called(it, "") }
            else FruitMatch.match(nr)?.takeIf { callKey(it.fruit) != null && it.rest.isEmpty() }
        val mine = if (state.ward) call != null else Hearing.wakeOnly(nr)
        if (!speakingNow || !mine) return@execute
        // 11/15 보드 실측: 보드가 "네, 포도 침대예요"라고 말하는 소리를 스스로 "포충야"로 듣고 이름 점수가 포도로 잡았다. 지금 하는 말에 그 이름이 들어 있으면 자기 목소리로 본다
        if (call != null && speaker.text.replace(" ", "").contains("${call.fruit}침대")) { Log.i(TAG, "말하는 중 들은 \"${call.fruit} 침대\"는 지금 보드가 하는 말에 들어 있어 자기 목소리로 봤어요"); return@execute }
        if (call != null && state.ringing != null && callKey(call.fruit) != state.name) return@execute   // 11/15: 울리는 동안에는 울리는 침대 이름만
        if (call != null && state.ringing == null && nightNow()) return@execute   // 11/19: 밤 시간에는 이름 부르기를 받지 않는다
        call?.let { c -> callKey(c.fruit)?.let { switchTo(it) } }
        if (speaker.text.replace(" ", "").contains("잘자")) return@execute
        speaker.cancel()
        epoch.incrementAndGet()
        var s = state.copy(pending = null, after = "")
        if (s.moving) s = brain.stopNow(s, "").state
        state = s
        if (state.ward) wardAck("네, ${callName(state.name)} 침대예요") else { openListen(); ding(chime) }
        turn(raw, "", "", "말하는 중에 부르는 말을 들어 말을 멈추고 하던 일도 멈췄어요. 다음 말을 기다려요.", 0, 0); publishState()
    }

    /** 8초 동안 부르는 말 없이 듣는다("잘자요" 뒤, 다시 말해 달라고 한 뒤). 아무 말이 없으면 꺼지는 소리를 낸다(묻는 중이면 내지 않음) */
    private fun openListen(ms: Long = 8000, earlyMs: Long = 0) {
        val w = now() + ms; wakeUntil = w
        // 11/15: earlyMs만큼 앞에서 시작한 말도 받는다(병원용 띠링 직전에 말을 시작해도 버리지 않게)
        wakeOpenWall = System.currentTimeMillis() - earlyMs; wakeEndWall = System.currentTimeMillis() + ms
        main.schedule({ closeListen(w, w + 15_000) }, ms, TimeUnit.MILLISECONDS)
    }

    /** 11/14 보드 시험: 8초 안에 말을 시작해 말이 길면 끝나기 전에 듣기가 닫혀 버려졌다. 지금 말하는 중이면 말이 끝날 때까지(최대 15초 더) 연다 */
    private fun closeListen(w: Long, limit: Long) {
        if (wakeUntil != w) return
        if (::listener.isInitialized && listener.inSpeech && now() < limit) {
            val w2 = now() + 2000; wakeUntil = w2; wakeEndWall = System.currentTimeMillis() + 2000
            main.schedule({ closeListen(w2, limit) }, 500, TimeUnit.MILLISECONDS); return
        }
        wakeUntil = 0; if (state.pending == null && !speakingNow && !dingNow) ding(offChime)
    }

    /** 버튼으로 알람을 멈춘 뒤 대답을 시작하기까지 쉬는 시간 */
    private val ALARM_OFF_GAP_MS = 500L
    @Volatile private var nextNotBefore = 0L    // 11/15: 다음 대답의 첫 소리를 이때(알아들었다는 소리가 끝나는 때)보다 먼저 내지 않는다
    @Volatile private var wakeOpenWall = 0L   // 11/14: 듣는 창이 열린 때와 닫히는 때(벽시계). 말 시작이 이 안이면 받는다
    @Volatile private var wakeEndWall = 0L

    private fun say(text: String, done: () -> Unit = {}) {
        if (!::speaker.isInitialized) { done(); return }
        val nb = nextNotBefore; nextNotBefore = 0L
        speaker.gain = com.jaljayo.board.brain.Rules.VOLUME_GAIN[state.volume.coerceIn(1, com.jaljayo.board.brain.Rules.VOLUME_MAX) - 1]   // 11/12: 말소리 크기 단계
        speaker.say(com.jaljayo.board.brain.Brain.speakable(text), notBefore = nb, done = done)
    }

    // ---------- 움직임·예약 ----------
    private var lastPublish = 0L
    private fun tick() {
        if (System.currentTimeMillis() - screenAt >= 200) { screenAt = System.currentTimeMillis(); screen = try { buildScreen() } catch (e: Exception) { Log.e(TAG, "화면 값 실패", e); screen } }   // 11/17 보드 화면(실패해도 tick은 계속)
        // 11/14: 꺼진 동안 지난 알람을 알 수 있게 살아 있는 시각을 30초마다 적는다
        if (::aliveFile.isInitialized && now() - aliveWritten > 30_000) { aliveWritten = now(); try { aliveFile.writeText(now().toString()) } catch (_: Exception) {} }
        val sensorOk = bedSensor.occupied != null
        if (state.sensorOk != sensorOk) state = state.copy(sensorOk = sensorOk)
        if (::clock.isInitialized && clock.check() && !state.timeValid) { state = state.copy(timeValid = true); log("보드 시계가 인터넷 시간으로 맞춰져 그대로 써요"); publishState() }
        val s = state
        // 지금 부른 침대. 침대 제어부(시연 화면, 나중에는 실제 침대)가 붙어 있으면 돌려준 각도를 쓰고, 없으면 시뮬레이션으로 센다.
        // 11/17: 붙었다가 끊긴 침대는 움직이는 척하지 않고 그 자리에서 멈춘 것으로 본다(WardLinks.step)
        val st = com.jaljayo.board.net.WardLinks.step(s, activeLink(), activeLost(), sim, 0.05) { r -> if (r == "error") log("${if (s.ward) "${s.name} 침대" else "침대"}가 오류를 알렸어요") }
        state = st
        if (s.moving) {
            if (!st.moving && st.after.isNotEmpty()) {  // 다 움직였으면 결과를 말한다
                val a = st.after
                state = st.copy(after = "", lastSpeech = a)
                prevReply.record(a, false, now())   // 다 움직인 뒤 말하는 결과도 사람 말에 한 대답이다
                say(a); publishState()
                speech(a, curBed())
            } else if (now() - lastPublish > 150 || !st.moving) publishState()
        } else if (st != s) publishState()   // 멈춤·오류로 침대가 멈춘 자리를 받아들였다
        val snoozed = state.snoozeAt != null
        // 11/19: 알람 쓰기를 끈 병원이면 알람을 울리지 않는다(예약은 그대로 소리 없이 움직임)
        if (alarmOff()) Unit else if (beds.isNotEmpty()) wardRing() else brain.dueAlarm(state)?.let { t ->
            apply(t); turn("", "", "", t.note, 0, 0)
            if (!snoozed || state.snoozeAt != null) liftOnRing()   // 미룬 알람이 다시 울릴 때는 더 올리지 않는다
        }
        // 침대 이탈 알람: 압력 센서가 3초 동안 비었다고 해야 끈다
        val known = bedSensor.occupied
        if (bedSensor.check(state.ringing?.type == "leave_bed", now()))
            brain.bedEmpty(state)?.let { t -> apply(t); syncAlarmSound(); turn("", "압력 센서: 3초 동안 비어 있음", t.say, t.note, 0, 0) }
        else if (known != bedSensor.occupied) publishState()   // 센서 소식이 끊김
        // 날짜가 지난 일회용 알람은 지운다(울리는 중이거나 미뤄 둔 알람은 남김)
        if (state.timeValid) {
            val today = AlarmFinder.nowLocal(now()).toLocalDate()
            val keep = state.alarms.filter { it.repeating || it.onceDate == null || !it.onceDate.isBefore(today) || it.id == state.ringing?.id || (state.snoozeAt != null && it.id == state.lastAlarmId) }
            if (keep.size != state.alarms.size) { state = state.copy(alarms = keep); publishState() }
        }
        syncAlarmSound()
        tickOtherBeds()
        val r = state.reservation
        // 11/14: 보드 앱이 꺼져 있던 동안 시각이 지난 예약은 늦게 움직이지 않고 알린다
        if (r != null && state.timeValid && bootAt > 0 && r.atMs < bootAt - 120_000) {
            state = state.copy(reservation = null)
            // 예약 이름이 "삼 분 뒤"처럼 상대 시각일 수 있어 실제 시각과 자세로 말한다
            val at = AlarmFinder.nowLocal(r.atMs); val today = AlarmFinder.nowLocal(now()).toLocalDate()
            val day = if (at.toLocalDate().isBefore(today)) "어제 " else ""
            val what = if (r.angleOnly) "각도" else "${r.purpose.ko} 자세"
            val msg = "보드가 꺼져 있는 동안 $day${com.jaljayo.board.brain.Brain.resvLabel(at, at.toLocalDate())} $what 예약 시각이 지나 실행하지 못했어요"
            say(msg); turn("", "", msg, "", 0, 0); publishState()
        } else if (r != null && state.timeValid && now() >= r.atMs && state.ringing == null) {
            // 예약은 안내 음성 없이 움직인다(받을 때 미리 알려 줌)
            // 11/12: 조절 예약은 그때 각도에서 계산하고, 각도만 정한 예약(말·폰)은 자세 이름을 바꾸지 않는다
            state = state.copy(reservation = null, undo = state.target to state.purpose, moveStart = state.angles, target = brain.reservedTarget(state, r), purpose = if (r.angleOnly) state.purpose else r.purpose, after = "")
            turn("", "", "", "예약 시각이 되어 ${r.label} 예약대로 움직여요.", 0, 0)
            publishState()
        }
    }

    /** 11/14 설계서 4절 상체 올림: 켜 둔 알람이 처음 울릴 때, 센서가 지금 사람이 누워 있다고 할 때만 머리를 30도까지 올린다.
     *  이미 30도 이상이면 그대로 두고 다리는 건드리지 않는다. 비었거나 센서 소식이 없으면 소리만 울린다 */
    private fun liftOnRing() {
        if (state.ringing?.type == "leave_bed" && bedSensor.occupied == null) log("센서에 문제가 있어요. 침대 버튼을 길게 누르면 알람이 꺼져요")
        val a = state.ringing ?: return
        if (!a.lift || bedSensor.occupied != true || state.target.head >= LIFT_HEAD) return
        state = state.copy(undo = state.target to state.purpose, moveStart = state.angles, target = Angles(LIFT_HEAD, state.target.leg), purpose = null, after = "")
        turn("", "", "", "상체 올림을 켠 알람이라 머리를 ${LIFT_HEAD.toInt()}도로 올려요.", 0, 0)
        publishState()
    }

    /** 알람이 울리는 동안(답을 기다리는 동안 빼고) 소리를 내고, 소리가 나는 동안은 말을 듣지 않는다 */
    private var ringCycleAt = 0L       // 11/15: 알람 10초 울림 → 5초 듣기를 되풀이하는 주기의 시작
    private var ringHold = false
    private fun syncAlarmSound() {
        val r = state.ringing
        if (r == null) ringCycleAt = 0L else if (ringCycleAt == 0L) ringCycleAt = now()
        // 듣기 5초에 부르는 말을 듣거나 묻는 중·말하는 중·생각 중·사람이 말하는 중이면 소리를 다시 켜지 않는다. 그게 끝나면 10초 울림부터 다시
        val hold = r != null && (now() < wakeUntil || state.pending != null || speakingNow || thinking ||
            (::listener.isInitialized && !alarmSound.playing && (listener.inSpeech || listener.busy)))
        // 11/19: 문제를 낸 뒤에는 소리를 계속 꺼 두지 않고 같은 주기를 탄다. 묻고 난 직후는 5초 듣기부터 시작하고, 그동안 못 맞히면 다시 10초 울린다
        if (ringHold && !hold && r != null) ringCycleAt = if (state.question != null) now() - RING_ON_MS else now()
        ringHold = hold
        val ringPhase = r != null && (now() - ringCycleAt) % (RING_ON_MS + RING_LISTEN_MS) < RING_ON_MS
        val want = r != null && now() >= soundPausedUntil && ringPhase && !hold
        if (want && !alarmSound.playing) { alarmSound.start(state.ringing?.volume ?: 2); muteMic(); Log.i(TAG, "알람 소리 켬") }
        if (!want && alarmSound.playing) { alarmSound.stop(); muteMic(); Log.i(TAG, "알람 소리 끔(${if (r == null) "알람 끝" else if (hold) "대화 중" else if (now() < soundPausedUntil) "버튼으로 멈춤" else "듣기 5초"})") }
    }

    private fun muteMic() {
        if (!::listener.isInitialized) return
        listener.muted = alarmSound.playing   // 11/14: 띠링(0.4초)이 나는 동안에도 듣는다. 그 순간 시작한 잘자요가 잘렸다
        listener.speaking = speakingNow   // 말하는 동안은 "잘자요"만 짧게 끊어 듣는다(Listener.onBarge)
    }

    // ---------- 침대 역할·폰에서 온 것 ----------
    private fun onMessage(m: JSONObject, c: WebSocket) {
        when (m.optString("type")) {
            "hello" -> main.execute {
                when (m.optString("role")) {
                    "bed" -> {
                        val name = m.optString("name", "").trim()
                        if (name.isEmpty() && state.ward) {
                            // 11/17: 병원 모드는 침대마다 이름 붙은 접속만 침대로 쓴다. 예전처럼 화면 하나가 부른 침대를 번갈아 따라가는 방식은 없앴다(상태는 그대로 받음)
                            log("병원 모드라 이름 없는 화면은 침대로 쓰지 않아요")
                        } else if (name.isEmpty()) {   // 가정용 침대 역할
                            bedConn = c
                            bedLink = BedLink { hub.sendTo(c, it) }.also { it.start(state.angles, state.target) }
                            log("침대 역할 연결됨"); publishState()
                        } else {
                            // 11/17 병원 시연: 이름 붙은 침대 제어부. 그 침대 하나만 맡는다. 같은 이름이 다시 붙으면 새 접속으로 바꾼다
                            val b = bedOf(name)
                            if (b == null) { log("이 병실에 없는 침대($name)의 침대 역할이라 받지 않았어요"); try { c.close() } catch (_: Exception) {} }
                            else {
                                links.hello(name, c, b.angles, b.target)?.let { old -> try { old.close() } catch (_: Exception) {} }
                                log("침대 역할 연결됨: $name 침대"); publishState()
                            }
                        }
                    }
                    "phone" -> {
                        // 11/17: hello에 bed가 있으면 그 침대만 보고 조작한다(부른 침대가 바뀌어도 그대로). 없으면 예전처럼 지금 부른 침대
                        val bed = m.optString("bed", "").trim()
                        // 11/19: bed는 침대 고유 번호나 지금 부르는 과일 이름. 병원 침대 목록에서 찾는다(이름이 바뀌었거나 사용을 끝낸 침대면 붙지 않음)
                        val key = if (bed.isNotEmpty() && state.ward) hospital.hello(c, bed)?.takeIf { bedOf(it) != null } else { hospital.left(c); null }
                        if (key != null) log("폰 연결됨: ${callName(key)} 침대")
                        else { hospital.left(c); log(if (bed.isNotEmpty()) "폰 연결됨(이 병실에 없는 침대 $bed 라 지금 부른 침대를 봐요)" else "폰 연결됨") }
                        phones.add(c); publishState()
                    }
                }
            }
            "bed-state" -> main.execute { links.nameOf(c)?.let { links.link(it)?.read(m) } ?: run { if (c === bedConn) bedLink?.read(m) } }
            "req" -> main.execute { onRequest(m, c) }
            else -> onPc(m)
        }
    }

    private fun left(c: WebSocket) = main.execute {
        phones.remove(c); hospital.left(c); replied.remove(c); adminPass.left(c)
        if (c === bedConn) { bedConn = null; bedLink = null; log("침대 역할 끊김, 시뮬레이션으로 셈"); publishState() }
        // 11/17: 이름 붙은 침대 제어부가 끊기면 그 침대는 마지막으로 받은 각도에서 멈춘 것으로 본다(실제 침대라면 지금 각도를 모른다)
        links.left(c)?.let { n ->
            val b = bedOf(n)
            if (b != null && b.moving) putBed(n, b.copy(target = b.angles, after = ""))
            log("$n 침대 역할 끊김: 그 자리에서 멈춘 것으로 보고 다시 붙을 때까지 움직이지 않아요"); publishState()
        }
    }

    private fun onRequest(m: JSONObject, c: WebSocket) {
        val id = m.getInt("id")
        val seen = replied.getOrPut(c) { object : LinkedHashMap<Int, JSONObject>() { override fun removeEldestEntry(e: MutableMap.MutableEntry<Int, JSONObject>) = size > 64 } }
        seen[id]?.let { hub.sendTo(c, it); return }
        val name = m.getString("name")
        // 병원 관리 비밀번호(admin-login, admin-password)는 침대 상태와 상관없이 보드 하나에 하나라 여기서 따로 답합니다
        adminPass.handle(c, name, m.optJSONObject("body"))?.let { reply ->
            reply.put("type", "reply").put("id", id)
            seen[id] = reply
            hub.sendTo(c, reply)
            log(if (name == "admin-login") (if (reply.getBoolean("ok")) "병원 관리에 들어옴" else "병원 관리 비밀번호 틀림") else if (reply.getBoolean("ok")) "병원 관리 비밀번호 바꿈" else "병원 관리 비밀번호 바꾸기 거절")
            return
        }
        // 11/19 병원 침대 목록(admin-list·admin-add·admin-move·admin-remove·admin-end·admin-save, bed-find·bed-register·name-save). 형식은 hospital-beds.md
        hospital.handle(c, name, m.optJSONObject("body"), adminPass.isAdmin(c), state.ward)?.let { out ->
            for (k in out.clear) clearBed(k)
            if (out.names) syncNames()
            if (out.settings) applySettings()
            val reply = out.reply.put("type", "reply").put("id", id)
            seen[id] = reply
            hub.sendTo(c, reply)
            out.close.forEach { try { it.close() } catch (_: Exception) {} }
            log(if (reply.getBoolean("ok")) "병원 침대 요청 처리: $name" else "병원 침대 요청 거절: $name(${reply.optString("reason")})")
            publishState(); return
        }
        // 11/19: 병실 QR로 등록하고 이름을 아직 안 골랐거나 시연 화면에 없는 침대(다른 과일)를 고른 폰은 침대를 조작하지 않는다
        if (state.ward && hospital.detached(c)) {
            val reply = JSONObject().put("ok", false).put("reason", "시연 화면에 없는 침대라 조작할 수 없어요").put("type", "reply").put("id", id)
            seen[id] = reply; hub.sendTo(c, reply)
            log("시연 화면에 없는 침대의 폰 요청이라 받지 않음: $name"); return
        }
        val today = AlarmFinder.nowLocal(now()).toLocalDate()
        // 11/17: 침대를 정해 붙은 폰은 그 침대에만 적용한다. 부르지 않은 침대면 부른 침대를 바꾸지 않고 그 침대 상태만 고친다(움직임은 tickOtherBeds가 그 침대 제어부로)
        val bed = phoneBedOf(c)
        val cur = if (bed == null) state else bedOf(bed) ?: state
        val r = try { appApi.handle(cur, name, m.optJSONObject("body"), today, appExtras, alarmsAllowed = !alarmOff()) } catch (e: Exception) { Log.w(TAG, "폰 요청 처리 실패: $name", e); return }
        val reply = r.reply ?: run { log("보드에 없는 요청: $name"); return }
        if (bed == null) state = stampAlarms(state, r.state)
        else { putBed(bed, stampAlarms(cur, r.state)); bedOf(bed)?.let { storeFor(bed).save(it) } }
        if (r.extras !== appExtras) { appExtras = r.extras; saveExtras() }
        reply.put("type", "reply").put("id", id)
        seen[id] = reply
        hub.sendTo(c, reply)
        publishState()
    }

    private fun loadExtras(): Map<Int, JSONObject> = try {
        if (!extrasFile.exists()) emptyMap() else JSONObject(extrasFile.readText()).let { o -> o.keys().asSequence().associate { it.toInt() to o.getJSONObject(it) } }
    } catch (e: Exception) { emptyMap() }

    private fun saveExtras() {
        val o = JSONObject(); appExtras.forEach { (k, v) -> o.put(k.toString(), v) }
        val tmp = File(extrasFile.path + ".tmp"); tmp.writeText(o.toString()); tmp.renameTo(extrasFile)
    }

    // ---------- 11/14 병원 시연: 보드 하나가 침대 여러 대(WARD_DEMO)를 맡는다 ----------
    // 지금 부른 침대가 state이고, 나머지는 beds에 둔다. 모델은 하나를 같이 쓰고, 어느 침대인지는 앞에서 들은 이름으로 보드가 정한다
    private val beds = HashMap<String, BedState>()
    private val bedStores = HashMap<String, Store>()
    private fun storeFor(name: String) = bedStores.getOrPut(name) { Store(File(filesDir, "bed_$name.json")) }
    private fun wardNames() = if (state.ward) listOf(state.name) + beds.keys else emptyList()
    /** 병실 침대 하나의 상태(지금 부른 침대면 state). 병실에 없으면 null */
    private fun bedOf(n: String): BedState? = if (!state.ward) null else if (n == state.name) state else beds[n]
    private fun putBed(n: String, b: BedState) { if (n == state.name) state = b else if (beds.containsKey(n)) beds[n] = b }
    /** 지금 부른 침대를 움직이는 쪽: 병원 모드면 그 침대 이름으로 붙은 제어부, 가정용이면 이름 없는 침대 역할 */
    private fun activeLink(): BedLink? = if (state.ward) links.link(state.name) else bedLink
    private fun activeLost() = state.ward && links.lost(state.name)
    private fun curBed(): String? = if (state.ward) state.name else null
    private val wardFile get() = File(filesDir, "ward.txt")
    val wardNow get() = wardList
    /** names: 이 보드가 맡는 침대 이름들(병원용 1대면 하나, 시연이면 셋) */
    private fun loadWard(names: List<String>, tv: Boolean) {
        beds.clear()
        for (n in names) beds[n] = storeFor(n).load(BedState(timeValid = tv)).copy(ward = true, name = n, timeValid = tv, pending = null)
        state = beds.remove(names.first())!!
    }
    private var wardList: List<String> = emptyList()

    /** 부른 침대로 바꾼다. 화면(침대 역할)은 그 침대의 각도로 맞춘다 */
    private fun switchTo(name: String) {
        if (!state.ward || state.name == name) return
        val next = beds.remove(name) ?: return
        val cur = state
        beds[cur.name] = cur; storeFor(cur.name).save(cur)
        prevReply.clear()   // 11/14 B4: 앞 대답은 부른 침대에 한 말이라 다른 침대로 바꾸면 비운다
        state = next.copy(timeValid = cur.timeValid, sensorOk = cur.sensorOk, replyAlarms = emptyList(), replyAt = 0L)   // 앞 대답의 알람도 같이 비운다
        log("$name 침대로 바꿨어요"); publishState()
    }

    /** 보드 화면에서 고른다. null이면 가정용("잘자요"), 이름 하나면 병원용 1대, 여럿이면 병원 시연(한 보드가 여러 대) */
    fun setWardMode(names: List<String>?) = main.execute {
        if ((names ?: emptyList()) == wardList) return@execute
        val tv = state.timeValid
        if (state.ward) { storeFor(state.name).save(state); for ((n, b) in beds) storeFor(n).save(b) } else store.save(state)
        beds.clear()
        if (names == null) {
            state = store.load(BedState(timeValid = tv)).copy(ward = false, name = "잘자요", timeValid = tv)
            wardFile.delete(); wardList = emptyList()
            log("가정용: \"잘자요\"로 불러요")
        } else {
            loadWard(names, tv); wardFile.writeText(names.joinToString(",")); wardList = names
            if (::listener.isInitialized && listener.nameScorer == null) Thread({ setupNameScorer() }, "name-scorer").start()   // 11/15: 병원용으로 바꾸면 이름 점수기를 켠다(모델 복사가 길어 따로)
            log(if (names.size == 1) "병원용 1대: \"${names[0]} 침대\"로 불러요" else "병원 시연: ${names.joinToString("·")} 침대 ${names.size}대. \"○○ 침대\"로 불러요")
        }
        if (::hospital.isInitialized) { hospital.realign(names ?: emptyList()); syncNames() }   // 11/19: 맡은 침대가 바뀌면 병원 침대 목록도 처음 상태로
        // 11/17: 가정용 침대 역할은 가정용 모드에서만 쓴다. 병원 모드로 바꾸면 떼어 낸다(화면 접속은 그대로, 상태만 받음)
        if (names != null && bedLink != null) { bedConn = null; bedLink = null; log("병원 모드라 가정용 침대 역할을 떼어 냈어요") }
        bedLink?.start(state.angles, state.target)
        // 11/17: 새 병실에 없는 침대의 제어부는 떼어 내고, 남은 제어부는 다시 읽은 각도로 맞춘다
        links.retain(names ?: emptyList()).forEach { try { it.close() } catch (_: Exception) {} }
        for (n in names ?: emptyList()) bedOf(n)?.let { b -> links.link(n)?.start(b.angles, b.target) }
        publishState()
    }

    // ---------- 11/19 병원 침대 목록(hospital-beds.md) ----------
    /** 과일 이름으로 불렀을 때 대답할 침대(key). 병원에 등록되고 그 이름을 고른 침대만 */
    private fun callKey(fruit: String): String? = if (!state.ward || !::hospital.isInitialized) null else hospital.keyOfCall(fruit)?.takeIf { bedOf(it) != null }
    /** 침대(key)를 부르는 이름. 이름이 없으면 key 그대로(기록·안내에만 씀) */
    private fun callName(key: String): String = (if (::hospital.isInitialized) hospital.callOf(key) else null) ?: key
    /** 병원 설정에서 알람 쓰기를 껐는지 */
    private fun alarmOff() = state.ward && ::hospital.isInitialized && !hospital.alarm
    /** 병원 설정의 밤 시간인지(이름 부르기를 받지 않음). 보드가 시각을 모르면 밤인지 알 수 없어 받는다 */
    private fun nightNow() = state.ward && state.timeValid && ::hospital.isInitialized && hospital.nightAt(AlarmFinder.nowLocal(now()).toLocalTime())

    /** 침대마다 부르는 이름(BedState.call)을 병원 침대 목록에 맞춘다. "저는 ○○ 침대예요"가 이 이름을 쓴다 */
    private fun syncNames() {
        if (!::hospital.isInitialized) return
        state = state.copy(call = if (state.ward) hospital.callOf(state.name) else null)
        for (n in beds.keys.toList()) beds[n]?.let { beds[n] = it.copy(call = hospital.callOf(n)) }
    }

    /** admin-end·admin-remove: 그 침대의 알람·예약·저장 자세를 지운다(울리는 중이던 알람도 끝냄) */
    private fun clearBed(key: String) {
        val b = bedOf(key) ?: return
        val c = b.copy(alarms = emptyList(), reservation = null, memory = emptyMap(), prevMemory = emptyMap(), lastCalled = null,
            ringing = null, question = null, snoozeAt = null, pending = null)
        putBed(key, c); storeFor(key).save(c)
        waitRings.keys.removeAll { it.startsWith("$key#") }
        if (key == state.name) syncAlarmSound()
        log("$key 침대 기록(알람·예약·저장 자세)을 지웠어요")
    }

    /** admin-save: 알람 쓰기를 끄면 울리는 알람과 미룬 알람을 끝낸다. 맞춰 둔 알람은 지우지 않고 울리지만 않는다 */
    private fun applySettings() {
        val n = hospital.night
        log("병원 설정: 밤 시간 ${if (n.on) "%02d:%02d~%02d:%02d".format(n.from / 60, n.from % 60, n.to / 60, n.to % 60) else "끔"}, 알람 ${if (hospital.alarm) "씀" else "안 씀"}")
        if (hospital.alarm) return
        fun stop(b: BedState) = b.copy(ringing = null, question = null, snoozeAt = null)
        state = stop(state); for (k in beds.keys.toList()) beds[k]?.let { beds[k] = stop(it) }
        waitRings.clear(); wardRinging = false; soundPausedUntil = 0
        syncAlarmSound()
    }

    /** 11/17: 새로 생긴 알람에 맞춘 때를 적는다. 고친 알람은 처음 맞춘 때를 그대로 둔다(폰 앱이 알람을 새로 만들어 보내도) */
    private fun stampAlarms(old: BedState, new: BedState): BedState {
        if (new.alarms === old.alarms || new.alarms.none { it.setAt == 0L }) return new
        val before = old.alarms.associateBy { it.id }
        return new.copy(alarms = new.alarms.map { a ->
            if (a.setAt != 0L) a else before[a.id]?.let { p -> if (p.setAt != 0L) a.copy(setAt = p.setAt) else a } ?: a.copy(setAt = System.currentTimeMillis())
        })
    }

    // ---------- 11/17 병원 시연: 여러 침대 알람이 겹칠 때 ----------
    // 보드가 하나라 알람은 하나만 울린다. 같이 시각이 된 알람 중 먼저 맞춘 것(setAt)만 울리고,
    // 그 알람이 끝나면(끄기·미루기) 기다리던 다른 침대 알람도 울린 것으로 치고 울리지 않는다. 제품은 침대마다 보드가 따로라 겹치지 않는다
    private data class WaitRing(val bed: String, val alarm: AlarmItem, val snooze: Boolean, val setAt: Long, val dueAt: Long)
    private val waitRings = LinkedHashMap<String, WaitRing>()
    private var wardRinging = false

    /** 기다리던 알람을 울린 것으로 적는다(다시 시각이 된 것으로 잡히지 않게) */
    private fun markRung(w: WaitRing) {
        val b = bedOf(w.bed) ?: return
        putBed(w.bed, if (w.snooze) b.copy(snoozeAt = null) else b.copy(alarms = b.alarms.map { if (it.id == w.alarm.id) w.alarm else it }))
    }

    private fun wardRing() {
        // 1) 지금 시각이 된 알람을 침대마다 모은다(울리는 중에 시각이 된 것도)
        for ((n, b) in listOf(state.name to state) + beds.entries.map { it.key to it.value }) {
            if (b.ringing != null) continue
            val r = brain.dueAlarm(b.copy(timeValid = state.timeValid))?.state?.ringing ?: continue
            waitRings.getOrPut("$n#${r.id}") { WaitRing(n, r, b.snoozeAt != null, r.setAt, now()) }
        }
        if (state.ringing != null) { wardRinging = true; return }
        if (waitRings.isEmpty()) { wardRinging = false; return }
        // 2) 울리던 알람이 방금 끝났으면 기다리던 알람은 같이 끝난 것으로 친다
        if (wardRinging) {
            wardRinging = false
            val done = waitRings.values.toList(); waitRings.clear()
            done.forEach { markRung(it) }
            turn("", "", "", "알람을 끄며 같이 시각이 된 ${done.joinToString(", ") { "${it.bed} 침대" }} 알람도 끝난 것으로 했어요.", 0, 0)
            publishState(); return
        }
        // 3) 먼저 맞춘 것 하나만 울린다. 맞춘 때가 같으면 먼저 시각이 된 것, 그다음 병실 순서. 나머지는 울린 것으로 친다
        val w = waitRings.values.minWith(compareBy<WaitRing>({ it.setAt }, { it.dueAt }, { wardList.indexOf(it.bed) }))
        val rest = waitRings.values.filter { it !== w }; waitRings.clear()
        rest.forEach { markRung(it) }
        if (w.bed != state.name) switchTo(w.bed)
        val s = state
        val t = if (w.snooze) Turn(s.copy(ringing = s.alarms.firstOrNull { it.id == w.alarm.id } ?: w.alarm, snoozeAt = null, pending = null), note = "${w.bed} 침대의 미룬 알람이 다시 울려요.")
            else Turn(s.copy(ringing = w.alarm, lastAlarmId = w.alarm.id, alarms = s.alarms.map { if (it.id == w.alarm.id) w.alarm else it }, pending = null, question = null),
                note = "${w.bed} 침대 알람이 울려요.${if (rest.isNotEmpty()) " 같이 시각이 된 ${rest.joinToString(", ") { "${it.bed} 침대" }} 알람은 울리지 않아요(먼저 맞춘 알람 하나만)." else ""}")
        apply(t); turn("", "", "", t.note, 0, 0)
        wardRinging = true
        if (!w.snooze) liftOnRing()
    }

    /** 부르지 않은 침대도 움직임·예약·알람이 이어진다. 알람 시각이 되면 그 침대로 바꿔 울린다 */
    private fun tickOtherBeds() {
        if (beds.isEmpty()) return
        for (n in beds.keys.toList()) {
            var b = beds[n] ?: continue
            // 11/17: 그 침대의 제어부가 붙어 있으면 그 각도를 쓰고, 끊긴 침대는 멈춘 것으로, 붙은 적 없으면 시뮬레이션으로 센다
            val wasMoving = b.moving
            b = com.jaljayo.board.net.WardLinks.step(b, links.link(n), links.lost(n), sim, 0.05) { r -> if (r == "error") log("$n 침대가 오류를 알렸어요") }
            if (wasMoving && !b.moving && b.after.isNotEmpty()) { val a = hospital.callOf(n)?.let { "$it 침대, ${b.after}" } ?: b.after; b = b.copy(after = ""); say(a); speech(a, n) }
            val r = b.reservation
            if (r != null && state.timeValid && now() >= r.atMs && b.ringing == null) {
                b = b.copy(reservation = null, undo = b.target to b.purpose, moveStart = b.angles, target = brain.reservedTarget(b, r), purpose = if (r.angleOnly) b.purpose else r.purpose, after = "")
                turn("", "", "", "$n 침대가 예약 시각이 되어 ${r.label} 예약대로 움직여요.", 0, 0, bed = n)
            }
            beds[n] = b
            if (wasMoving || b.moving) othersMoving = true
        }
        // 11/17: 부르지 않은 침대가 움직이는 동안에도 상태(ward 칸, 그 침대에 붙은 폰)를 보낸다
        if (othersMoving && (now() - lastPublish > 150)) { othersMoving = false; publishState() }
    }
    private var othersMoving = false

    /** 11/14: 버튼 길게 누르기. 울리는 알람은 종류와 상관없이 끝낸다(설계서 센서 오류 절). 보드 화면의 알람 끄기 버튼이 부른다 */
    fun longPress() = main.execute {
        if (state.ringing == null && state.snoozeAt == null) { turn("", "버튼 길게", "", "울리는 알람이 없어요.", 0, 0); return@execute }
        epoch.incrementAndGet(); soundPausedUntil = 0
        nextNotBefore = System.currentTimeMillis() + ALARM_OFF_GAP_MS
        apply(Turn(state.copy(ringing = null, question = null, snoozeAt = null, pending = null), say = "알람을 끌게요")); syncAlarmSound()
        turn("", "버튼 길게", "알람을 끌게요", "버튼을 길게 눌러 알람을 끝냈어요.", 0, 0)
    }

    /** 11/19 나노가 USB로 보낸 한 줄. 시연 화면이 보내던 button·sensor 글과 같은 모양으로 바꿔 같은 처리(onPc)를 거칩니다(NanoLines) */
    private fun nanoLine(line: String) {
        val bed = com.jaljayo.board.net.NanoLines.bedFor(state.ward, wardList)
        val m = com.jaljayo.board.net.NanoLines.toMessage(line, bed)
        if (m == null) { if (line == "READY") log("나노 준비됨"); return }
        if (m.optString("type") == "button") log("나노 버튼: ${if (m.optBoolean("long")) "길게" else "짧게"}${bed?.let { " ($it 침대)" } ?: ""}")
        onPc(m)
    }

    // ---------- PC에서 온 것 ----------
    private fun onPc(m: JSONObject) {
        when (m.optString("type")) {
            "text" -> heard(m.getString("text"), 0, typed = true)
            "record" -> { listener.contWant = m.optBoolean("on"); log(if (listener.contWant) "통째 녹음 켬" else "통째 녹음 끔") }   // 11/15 평가 녹음용
            "button" -> main.execute {
                if (!routeBed(m, "버튼")) return@execute   // 11/17 병원 시연: bed가 있으면 그 침대의 버튼
                if (m.optBoolean("long")) { longPress(); return@execute }
                // 11/19 병원 설정 밤 시간: 이름 부르기가 꺼진 동안에는 침대 버튼이 부르는 말을 대신한다(폰 앱 설명 "꺼진 동안에도 침대 버튼을 누르면 말할 수 있어요")
                if (state.ward && state.ringing == null && state.snoozeAt == null && !state.moving && nightNow()) {
                    val ans = state.call?.let { "네, $it 침대예요" } ?: "네, 말씀하세요"
                    wardAck(ans)
                    turn("", "버튼", ans, "밤 시간이라 이름 대신 버튼으로 불렀어요. 띠링 뒤 다음 말을 기다려요.", 0, 0); return@execute
                }
                epoch.incrementAndGet()
                val ring = state.ringing
                // 11/19: 버튼으로 알람 소리가 멎자마자 말이 튀어나오면 급하게 들린다. 소리가 멎은 뒤 잠깐 쉬고 말한다
                if (ring != null) nextNotBefore = System.currentTimeMillis() + ALARM_OFF_GAP_MS
                val t = brain.alarmButton(state)?.also { if (ring?.type == "leave_bed") soundPausedUntil = now() + 30_000 }
                    ?: if (state.moving) brain.stopNow(state, "버튼은 모델을 거치지 않고 바로 멈춰요.") else Turn(state, note = "움직이는 중이 아니라서 할 일이 없어요.")
                apply(t); syncAlarmSound(); turn("", "버튼", t.say, t.note, 0, 0)
            }
            // 압력 센서 값은 받아 두기만 하고, 침대가 비었는지는 tick()에서 3초를 세어 정한다(BedSensor)
            "sensor" -> main.execute {
                // 11/17 병원 시연: bed가 있으면 그 침대 센서로 받는다(부른 침대를 바꾸지 않음). 없으면 지금 부른 침대
                val bn = if (m.isNull("bed")) "" else m.optString("bed", "")
                if (state.ward && bn.isNotEmpty() && bn !in wardNames()) return@execute
                val sensor = if (state.ward && bn.isNotEmpty()) sensorOf(bn) else bedSensor
                val before = sensor.occupied
                sensor.report(m.optBoolean("occupied", true), if (m.has("value")) m.optInt("value") else null, m.optBoolean("virtual"), now())
                if (sensor === bedSensor && (before != sensor.occupied || state.ringing?.type == "leave_bed")) publishState()
            }
            "demo" -> main.execute { demo(m) }
            "time" -> main.execute { clock.set(m.getLong("epochMs")); state = state.copy(timeValid = true); publishState(); log("시각을 PC에 맞췄어요") }
            "always" -> { alwaysListen = m.optBoolean("on"); log(if (alwaysListen) "부르는 말 없이 들어요(시험용)" else "부르는 말이 있어야 들어요") }
        }
    }

    // ---------- PC로 보내기 ----------
    private fun publishState() {
        if (::store.isInitialized) { if (state.ward) storeFor(state.name).save(state) else store.save(state) }
        if (!::hub.isInitialized) return
        lastPublish = now()
        val s = state
        publishApp(s)
        fun ang(a: com.jaljayo.board.brain.Angles) = JSONObject().put("head", (a.head * 10).roundToInt() / 10.0).put("leg", (a.leg * 10).roundToInt() / 10.0)
        hub.send(JSONObject().put("type", "state").put("simulated", activeLink() == null).put("model", modelName)
            .put("angles", ang(s.angles)).put("target", ang(s.target)).put("moving", s.moving)
            .put("purpose", s.purpose?.code ?: JSONObject.NULL)
            .put("asking", s.pending != null)
            .put("reservation", s.reservation?.let { JSONObject().put("label", it.label).put("purpose", it.purpose.code).put("inMin", ((it.atMs - now()) / 60000.0).roundToInt()) } ?: JSONObject.NULL)
            .put("alarms", JSONArray(s.alarms.filter { it.next(AlarmFinder.nowLocal(now())) != null || it.id == s.ringing?.id }.map { a -> JSONObject().put("label", a.label(AlarmFinder.nowLocal(now()))).put("type", a.type).put("enabled", a.enabled) }))
            .put("timeValid", s.timeValid).put("ringing", s.ringing != null).put("ringingType", s.ringing?.type ?: JSONObject.NULL)
            .put("sensor", JSONObject().put("occupied", bedSensor.occupied ?: JSONObject.NULL).put("value", bedSensor.value ?: JSONObject.NULL).put("virtual", bedSensor.virtual)
                .put("emptyMs", bedSensor.emptyMs(now()) ?: JSONObject.NULL).put("needMs", bedSensor.needMs))
            .put("question", s.question?.let { "${it.first} + ${it.second}" } ?: JSONObject.NULL)
            // 11/14 병원 시연: 침대마다 각도와 지금 부른 침대
            // 11/17: 침대마다 각도(소수 한 자리)·목표·자세·물음·알람·예약·저장 자세와 제어부가 붙어 있는지(linked)
            .put("ward", if (!s.ward) JSONObject.NULL else JSONArray(wardList.map { n -> com.jaljayo.board.net.WardLinks.entry(n, if (n == s.name) s else beds[n], n == s.name, links.linked(n), now())
                .put("call", hospital.callOf(n) ?: JSONObject.NULL) })))   // 11/19: 지금 부르는 이름(병원 침대 목록). name은 침대 제어부를 나누는 이름이라 그대로
    }

    /** 이 폰이 붙은 침대. 병원 모드에서 침대를 정해 붙었을 때만, 아니면 null(지금 부른 침대) */
    private fun phoneBedOf(c: WebSocket): String? = hospital.keyOf(c)?.takeIf { state.ward && bedOf(it) != null }

    private fun publishApp(s: BedState) {
        if (phones.isEmpty()) return
        val today = AlarmFinder.nowLocal(now()).toLocalDate()
        val cache = HashMap<String, JSONObject>()
        phones.forEach { c ->
            // 11/19: 시연 화면에 없는 침대의 폰에는 움직이지 않는 빈 침대 상태를 보낸다(다른 침대 각도·알람을 보이지 않게)
            if (s.ward && hospital.detached(c)) { hub.sendTo(c, cache.getOrPut("\u0000") { appApi.appState(BedState(ward = true, timeValid = s.timeValid), today, emptyMap(), now()) }); return@forEach }
            val bed = phoneBedOf(c)
            val o = cache.getOrPut(bed ?: "") { appApi.appState(if (bed == null) s else bedOf(bed) ?: s, today, appExtras, now()) }
            hub.sendTo(c, o)
        }
    }

    // ---------- 보드 화면(11/17) ----------
    @Volatile var screen = ScreenState(); private set
    private var screenAt = 0L

    private fun buildScreen(): ScreenState {
        val s = state
        val phase = when {
            !ready -> Phase.BOOT
            s.ringing != null -> Phase.RING
            speakingNow -> Phase.SPEAK
            thinking -> Phase.THINK
            alwaysListen || now() < wakeUntil || s.pending != null -> if (::listener.isInitialized && listener.inSpeech) Phase.HEAR else Phase.LISTEN
            else -> Phase.IDLE
        }
        // 11/19: 병원용은 병원 침대 목록의 부르는 이름을 보여 준다. 등록 전이거나 이름이 없는 침대는 "이름 없음"
        fun bv(n: String, b: BedState?, active: Boolean): BedView {
            val call = if (s.ward) hospital.callOf(n) else n
            return BedView(call ?: "이름 없음", (b?.angles?.head ?: 0.0).roundToInt(), (b?.angles?.leg ?: 0.0).roundToInt(), b?.moving == true, active, callable = call != null)
        }
        val beds = if (s.ward) wardList.map { n -> if (n == s.name) bv(n, s, true) else bv(n, this.beds[n], false) } else listOf(bv(s.name, s, true))
        val nowL = AlarmFinder.nowLocal(now())
        val next = if (!s.timeValid || alarmOff()) null else s.alarms.filter { it.enabled }.mapNotNull { it.next(nowL) }.minOrNull()?.let { at ->
            val day = com.jaljayo.board.brain.AlarmItem.dateKo(at.toLocalDate(), nowL.toLocalDate()).let { if (it.contains(" ")) "${at.monthValue}/${at.dayOfMonth}" else it }
            "$day ${clockText(at.hour, at.minute)}"
        }
        val resv = s.reservation?.let { r -> val at = AlarmFinder.nowLocal(r.atMs); "${clockText(at.hour, at.minute)} · ${r.desc().removeSuffix(" 바꾸는").removeSuffix("는")}" }
        return ScreenState(phase, s.ward, if (s.ward) "${callName(s.name)} 침대" else "잘자요", beds, next, resv, modelName, if (clockLost()) CLOCK_NOTICE else null,
            qr = if (s.ward) hospital.unplaced().map { it.id } else emptyList(),
            // 11/19: 보드 화면 QR은 하나. 병원용은 병실 QR(보드 번호), 가정용은 침대 QR
            // 11/19: QR 등록은 가정용(잘자요 침대)에서만 보여 준다. 병원 모드에서는 QR 단추를 숨긴다
            allQr = if (s.ward) emptyList() else listOf("${hospital.board}-1"),
            host = boardHost())
    }

    // 11/19: 보드 IP(랜 우선). 3초마다만 다시 읽는다(화면은 0.15초마다 상태를 읽음)
    @Volatile private var hostAt = 0L
    @Volatile private var hostCache: String? = null
    private fun boardHost(): String? {
        val t = System.currentTimeMillis()
        if (t - hostAt < 3000) return hostCache
        hostAt = t
        hostCache = try {
            java.net.NetworkInterface.getNetworkInterfaces().toList()
                .filter { it.isUp && !it.isLoopback }
                .sortedBy { if (it.name.startsWith("eth")) 0 else 1 }
                .flatMap { i -> i.inetAddresses.toList().filterIsInstance<java.net.Inet4Address>().filter { !it.isLoopbackAddress } }
                .firstOrNull()?.hostAddress?.let { "$it:8765" }
        } catch (_: Exception) { null }
        return hostCache
    }

    private fun clockText(h: Int, m: Int) = "${if (h < 12) "오전" else "오후"} ${if (h % 12 == 0) 12 else h % 12}:${"%02d".format(m)}"

    /** bed: 어느 침대 일인지(병원용). 기본은 지금 부른 침대, 가정용·병실에 없는 이름이면 null */
    private fun turn(heard: String, output: String, say: String, note: String, asrMs: Long, llmMs: Long, bed: String? = curBed()) {
        if (::listener.isInitialized) listener.contNote("들음 \"$heard\" → $output → $say")
        log("들음 \"$heard\" → $output → ${say.ifEmpty { note }}")
        Talk.add(TalkItem(System.currentTimeMillis(), heard, output, say, note, asrMs, llmMs))   // 11/17 보드 화면
        if (!::hub.isInitialized) return
        hub.send(JSONObject().put("type", "turn").put("bed", bed ?: JSONObject.NULL).put("heard", heard).put("output", output).put("say", say).put("note", note)
            .put("asrMs", asrMs).put("llmMs", llmMs))
    }

    /** 다 움직인 뒤 보드가 하는 말. 병원용이면 어느 침대 말인지(bed)를 붙인다 */
    private fun speech(say: String, bed: String?) {
        if (::hub.isInitialized) hub.send(JSONObject().put("type", "speech").put("bed", bed ?: JSONObject.NULL).put("say", say))
    }

    /** 11/17 병원 시연: 글에 bed가 있으면 그 침대로 바꿔 처리한다. 다른 침대 알람이 울리는 중이면 받지 않는다 */
    private fun routeBed(m: JSONObject, what: String): Boolean {
        val b = if (m.isNull("bed")) "" else m.optString("bed", "")
        if (b.isEmpty() || !state.ward || b == state.name) return true
        if (b !in wardNames()) { log("이 병실에 없는 침대($b)의 $what 글이라 받지 않았어요"); return false }
        if (state.ringing != null) { turn("", what, "", "${state.name} 침대 알람이 울리는 중이라 $b 침대 $what 글은 받지 않았어요.", 0, 0); return false }
        switchTo(b); return true
    }

    /** 11/17 병원 시연 화면의 「알람 시각이 됨」·「예약 시각이 됨」 버튼. 시연(침대 여러 대)일 때만 받는다.
     *  같은 공유기의 누구나 보낼 수 있는 글이라 제품에서는 받지 않는다(docs/ward-multi-bed-design.md 제품 전 할 일) */
    private fun demo(m: JSONObject) {
        if (wardList.size <= 1) { log("시연(침대 여러 대)이 아니라 시험 글(demo)을 받지 않았어요"); return }
        val b = if (m.isNull("bed")) state.name else m.optString("bed", state.name)
        val bs = bedOf(b) ?: run { log("이 병실에 없는 침대($b)의 시험 글이라 받지 않았어요"); return }
        when (m.optString("action")) {
            "alarm-now" -> {
                if (alarmOff()) { turn("", "시연 버튼", "", "알람 쓰기를 끈 병원이라 $b 침대 알람을 울리지 않았어요.", 0, 0, bed = b); return }
                // 11/17: 알람은 하나만 울린다. 다른 침대 알람이 울리는 중이면 울리지 않는다
                if (state.ringing != null) { turn("", "시연 버튼", "", "${state.name} 침대 알람이 울리는 중이라 $b 침대 알람을 울리지 않았어요(알람은 하나만).", 0, 0, bed = b); return }
                switchTo(b)
                val t = brain.ringNow(state) ?: run { turn("", "시연 버튼", "", "$b 침대에 울릴 알람이 없어요.", 0, 0); return }
                apply(t); turn("", "시연 버튼", "", t.note, 0, 0); liftOnRing()
            }
            "reservation-now" -> {
                val r = bs.reservation ?: run { turn("", "시연 버튼", "", "$b 침대에 걸린 예약이 없어요.", 0, 0, bed = b); return }
                putBed(b, bs.copy(reservation = r.copy(atMs = now())))
                turn("", "시연 버튼", "", "$b 침대 예약 시각이 된 것으로 바꿨어요.${if (!state.timeValid) " 보드가 시각을 몰라 예약은 시각을 맞춘 뒤에 실행돼요." else ""}", 0, 0, bed = b)
                publishState()
            }
            else -> log("모르는 시험 글: ${m.optString("action")}")
        }
    }

    private fun log(s: String) { Log.i(TAG, s); Status.post(s) }

    private fun startAsForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("board", "잘자요 보드", NotificationManager.IMPORTANCE_LOW))
        val n = Notification.Builder(this, "board").setContentTitle("잘자요 보드").setContentText("듣는 중").setSmallIcon(android.R.drawable.ic_btn_speak_now).build()
        startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // 11/14 보드 시험: 최근 앱 화면에서 밀어 올리자 앱이 통째로 꺼져 예약이 날아갔다. 상태를 저장하고 1초 뒤 화면을 다시 띄운다(화면이 서비스를 켠다)
        if (::store.isInitialized) store.save(state)
        val pi = android.app.PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            android.app.PendingIntent.FLAG_IMMUTABLE)
        getSystemService(android.app.AlarmManager::class.java)?.set(android.app.AlarmManager.RTC, System.currentTimeMillis() + 1000, pi)
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        alarmSound.stop()
        nano?.stop()
        if (::listener.isInitialized) listener.stop()
        if (::model.isInitialized) model.stop()
        if (::hub.isInitialized) hub.stop(500)
        main.shutdownNow(); llm.shutdownNow()
        super.onDestroy()
    }

    override fun onCreate() { super.onCreate(); instance = this }

    companion object {
        const val TAG = "JaljayoBoard"; const val LIFT_HEAD = 30.0
        const val RING_ON_MS = 10_000L; const val RING_LISTEN_MS = 5_000L   // 11/15: 알람 10초 울림 → 5초 듣기
        const val YES = "<maum_2>(type=yes, value=none)<maum_end>"
        // 11/18 새 목소리로 들어 보고 고름: "잘자요 앱"은 "요"에서 문장이 끝난 듯 쉬어서 "앱 잘자요"로, "않아" 뒤에만 쉼표
        const val CLOCK_NOTICE = "시계가 맞지 않아, 알람이 멈춰 있어요. 스마트폰 앱 잘자요를 켜서 연결하면 다시 울려요"
        val WARD_DEMO = listOf("사과", "포도", "딸기")   // 11/14 시연 침대 3대. 11/17: 시연 화면(101 사과·102 포도·103 딸기)과 맞춰 복숭아 → 딸기
        private val OLD_WARD_DEMO = listOf("사과", "포도", "복숭아")
        @Volatile var instance: BoardService? = null   // 보드 화면의 알람 끄기 버튼이 쓴다
    }   // 상체 올림 목표(설계서 4절 초기값)
}

/** 첫 화면에 최근 기록을 보여 주기 위한 작은 통로 */
object Status {
    private val lines = ArrayDeque<String>()
    var onChange: ((String) -> Unit)? = null
    @Synchronized fun post(s: String) {
        lines.addLast(s); while (lines.size > 30) lines.removeFirst()
        onChange?.invoke(lines.joinToString("\n"))
    }
    @Synchronized fun text() = lines.joinToString("\n")
}
