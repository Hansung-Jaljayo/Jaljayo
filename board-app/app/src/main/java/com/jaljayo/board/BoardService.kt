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
import com.jaljayo.board.brain.BedSim
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Hearing
import com.jaljayo.board.brain.Spec
import com.jaljayo.board.brain.Turn
import com.jaljayo.board.model.CommandModel
import com.jaljayo.board.model.LlamaServerModel
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
    private val phones = ConcurrentHashMap.newKeySet<WebSocket>()
    private var appExtras: Map<Int, JSONObject> = emptyMap()
    private val replied = ConcurrentHashMap<WebSocket, LinkedHashMap<Int, JSONObject>>()  // 다시 보낸 요청은 앞의 답을 그대로 돌려준다
    private lateinit var extrasFile: File
    private lateinit var spec: Spec
    private lateinit var model: CommandModel
    private lateinit var speaker: Speaker
    private lateinit var listener: Listener
    private lateinit var hub: Hub
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
    private var soundPausedUntil = 0L  // 침대 이탈 알람: 버튼으로 잠깐 멈춘 소리가 다시 울릴 때

    override fun onBind(intent: Intent?): IBinder? = null

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
            clock = BoardClock(File(filesDir, "clock.json"),
                { try { File("/proc/sys/kernel/random/boot_id").readText().trim() } catch (e: Exception) { "" } },
                { android.provider.Settings.Global.getInt(contentResolver, android.provider.Settings.Global.AUTO_TIME, 0) == 1 })
            clock.start()
            // 알람·예약·저장 자세를 다시 읽는다. 시각은 저장해 둔 맞춤값이나 인터넷 시간이 있으면 그대로 쓴다(BoardClock)
            state = store.load(state).copy(timeValid = clock.valid)
            log(if (clock.valid) "보드 시계를 써요" else "시각을 모르니 폰 앱과 한 번 연결해 주세요")
            extrasFile = File(filesDir, "app_extras.json")
            appExtras = loadExtras()
            hub = Hub(8765, { m, c -> onMessage(m, c) }, { c -> left(c) }).also { it.start() }
            val dir = "/data/local/tmp/jaljayo_llm"
            // 16차 모델을 먼저 쓴다. 없으면 이전 모델
            val gguf = listOf("$dir/v16-ans-q8_0.gguf", "$dir/v09-avg-hjln-q8_0.gguf","$dir/v08-7-best-q8_0.gguf", "$dir/v08-7-ep2-q8_0.gguf").first { File(it).exists() }
            modelName = File(gguf).name
            model = LlamaServerModel(File(applicationInfo.nativeLibraryDir, "libllama_server.so"), gguf)
            log("모델 불러오는 중: $modelName")
            model.start()
            log("목소리 불러오는 중")
            speaker = Speaker(this) { speaking -> speakingNow = speaking; muteMic() }
            log("음성 인식 불러오는 중")
            listener = Listener(assets) { text, ms -> heard(text, ms, typed = false) }.also { it.onBarge = { t -> bargeIn(t) } }
            listener.start()
            main.scheduleWithFixedDelay({ tick() }, 0, 50, TimeUnit.MILLISECONDS)
            ready = true
            // 11/11: 정해진 대답 문장을 한가할 때 미리 만들어 둔다(말하는 중·듣는 중·생각 중이면 기다림)
            speaker.warmUp { !speakingNow && !dingNow && now() >= wakeUntil && !thinking && state.pending == null }
            log("준비됨 · 모델 $modelName")
            publishState()
        } catch (e: Exception) {
            Log.e(TAG, "켜기 실패", e); log("켜기 실패: ${e.message}")
        }
    }

    // ---------- 들은 말 처리 ----------
    private fun heard(raw: String, asrMs: Long, typed: Boolean) = main.execute {
        if (!ready) return@execute
        val norm = Hearing.normalize(raw)
        if (norm.isEmpty()) return@execute
        val h = Hearing.wake(norm)
        val text = h.text
        // 11/10 이도 님 결정: 부르는 말과 명령을 한 번에 받지 않는다. "잘자요"로 시작하면(뒤에 붙은 말은 버림) "띠링" 소리를 내고
        // 다음 말을 8초 동안 부르는 말 없이 듣는다. 소리가 나는 동안은 마이크를 끈다
        if (h.woke) {
            openListen()
            ding(chime)
            turn(raw, "", "", "부르는 말을 들었어요(띠링). 다음 말을 기다려요.${if (text.isNotEmpty()) " 함께 들은 \"$text\"는 버렸어요." else ""}", asrMs, 0); return@execute
        }
        // 정지 말은 부르는 말 없이도, 모델을 거치지 않고 바로 멈춘다
        brain.quickStop(state, text)?.let { t ->
            epoch.incrementAndGet()
            apply(t); turn(raw, "모델을 거치지 않음", t.say, t.note, asrMs, 0); return@execute
        }
        // 덧셈 알람의 답을 기다리는 중에도 부르는 말 없이 듣는다
        val answering = state.ringing != null && state.question != null
        val listening = typed || alwaysListen || h.woke || now() < wakeUntil || state.pending != null || answering
        if (!listening) { turn(raw, "", "", "부르는 말이 없어 듣지 않았어요.", asrMs, 0); return@execute }
        wakeUntil = 0
        val my = epoch.get()
        // 11/11 이도 님: 말이 끝난 때, 알아들었다는 소리, 대답이 나오는 때의 간격을 같게 한다.
        // 대답까지 걸릴 시간은 최근 평균(latencyEst)으로 잡아 그 가운데에 소리를 내고, 대답이 더 빨리 준비되면 같은 간격이 될 때까지 기다린다
        val timing = if (typed) null else {
            val end = System.currentTimeMillis() - 700 - asrMs   // 말이 끝난 때(말 끝 침묵 0.7초 + 받아 적기 시간 전)
            Timing(end, end + latencyEst / 2).also { tm ->
                main.schedule({ if (epoch.get() == my) ding(understood) }, maxOf(0L, tm.chimeAt - System.currentTimeMillis()), TimeUnit.MILLISECONDS)
            }
        }
        val asked = brain.waitingQuestion(state)  // 지금 대답을 기다리는 질문(모델 입력의 [앞 질문])
        val status = brain.status(state)          // 지금 보드 상태(모델 입력의 [상태])
        thinking = true
        llm.execute {
            val t0 = System.currentTimeMillis()
            // 7차·8차 모델(v0.8)의 skip·disable 출력은 v0.9 skip으로 옮긴다
            val out = Spec.upgrade(try { model.infer(text, asked, status) } catch (e: Exception) { Log.e(TAG, "모델 실패", e); "" })
            val ms = System.currentTimeMillis() - t0
            thinking = false
            main.execute {
                if (epoch.get() != my) { turn(raw, out, "", "멈춘 뒤 늦게 온 결과라 실행하지 않았어요.", asrMs, ms); return@execute }
                val t = when (val r = spec.parse(out)) {
                    is Spec.Result.Bad -> (brain.reask(state, text) ?: Turn(state, say = "다시 한 번 말씀해 주세요")).copy(note = "출력 형식 오류(${r.why})라 움직이지 않았어요.")
                    is Spec.Result.Ok -> brain.handleSafely(state, text, r.cmd, out)
                }
                // 11/11 이도 님: 대답 뒤에는 더 듣지 않는다. 보드가 다시 말해 달라고 했을 때만 8초 기다린다(apply)
                nextTiming = timing
                apply(t, listenAfter = true); turn(raw, out, t.say, t.note, asrMs, ms)
            }
        }
    }

    /** 새 상태를 쓰고, 지금 할 말이 있으면 말한다. 질문이면 대답 뒤 10초를 기다린다 */
    private fun apply(t0: Turn, listenAfter: Boolean = false) {
        val t = brain.recordAsked(state, t0)  // 이번에 묻는 질문 문장을 그대로 적어 둔다(다음 말의 모델 입력에 씀)
        state = t.state
        if (t.say.isNotEmpty()) {
            state = state.copy(lastSpeech = t.say)
            val asked = state.pending
            // 묻는 게 걸려 있으면(pending) 그 대답을 기다리고, 걸린 건 없지만 다시 말해 달라고 했으면 8초 듣는다
            val reopen = listenAfter && asked == null && Regex("(\\?|말씀해 주세요\\.?)$").containsMatchIn(t.say.trim())
            val alarmRef = state.lastAlarmUntil
            val alarmLive = alarmRef >= now()   // 이번 턴이 알람 얘기였을 때만(오래전 알람을 다시 살리지 않음)
            say(t.say) {
                if (reopen) openListen()
                // 알람 얘기를 다 말한 뒤부터 10초 동안 "이 알람"을 받는다
                if (alarmLive && state.lastAlarmUntil == alarmRef) { state = state.copy(lastAlarmUntil = now() + Brain.RECENT_MS) }
                if (asked != null) main.schedule({
                    // 물었는데 대답이 없으면 듣기를 끝내고 꺼지는 소리를 낸다
                    if (state.pending === asked) { state = state.copy(pending = null); publishState(); if (!speakingNow && !dingNow) ding(offChime) }
                }, 10, TimeUnit.SECONDS)
            }
        }
        publishState()
    }

    /** 소리를 내는 동안은 마이크를 끈다 */
    private fun ding(c: Chime) { dingNow = true; muteMic(); c.play { dingNow = false; muteMic() } }

    /** 11/11 이도 님: 말하는 중에 "잘자요"를 들으면 말과 하던 일(생각 중인 결과, 묻던 것, 움직임)을 멈추고 다시 듣는다.
     *  울리는 알람은 그대로 둔다. 보드 대답 자체에 "잘자요"가 들어 있으면(앱 이름) 자기 목소리라 무시한다 */
    private fun bargeIn(raw: String) = main.execute {
        if (!speakingNow || !Hearing.wakeOnly(Hearing.normalize(raw))) return@execute
        if (speaker.text.replace(" ", "").contains("잘자")) return@execute
        speaker.cancel()
        epoch.incrementAndGet()
        var s = state.copy(pending = null, after = "")
        if (s.moving) s = brain.stopNow(s, "").state
        state = s
        openListen(); ding(chime)
        turn(raw, "", "", "말하는 중에 부르는 말을 들어 말을 멈추고 하던 일도 멈췄어요. 다음 말을 기다려요.", 0, 0); publishState()
    }

    /** 8초 동안 부르는 말 없이 듣는다("잘자요" 뒤, 다시 말해 달라고 한 뒤). 아무 말이 없으면 꺼지는 소리를 낸다(묻는 중이면 내지 않음) */
    private fun openListen() {
        val w = now() + 8000; wakeUntil = w
        main.schedule({
            if (wakeUntil == w) { wakeUntil = 0; if (state.pending == null && !speakingNow && !dingNow) ding(offChime) }
        }, 8000, TimeUnit.MILLISECONDS)
    }

    private class Timing(val end: Long, val chimeAt: Long)
    @Volatile private var latencyEst = 4000L       // 말이 끝난 뒤 대답 첫 소리가 준비되기까지(최근 평균, ms)
    @Volatile private var nextTiming: Timing? = null

    private fun say(text: String, done: () -> Unit = {}) {
        if (!::speaker.isInitialized) { done(); return }
        val tm = nextTiming; nextTiming = null
        speaker.say(text, notBefore = tm?.let { 2 * it.chimeAt - it.end } ?: 0L,
            onFirstReady = { ready -> if (tm != null) latencyEst = (0.7 * latencyEst + 0.3 * (ready - tm.end)).toLong().coerceIn(1500L, 8000L) },
            done = done)
    }

    // ---------- 움직임·예약 ----------
    private var lastPublish = 0L
    private fun tick() {
        if (::clock.isInitialized && clock.check() && !state.timeValid) { state = state.copy(timeValid = true); log("보드 시계가 인터넷 시간으로 맞춰져 그대로 써요"); publishState() }
        bedLink?.let { link ->
            link.sync(state.angles, state.target)
            link.takeFinished()?.let { f ->
                if (f.result != "arrived") {   // 멈춤·오류: 멈춘 자리를 목표로 삼는다
                    link.accept(f.angles)
                    state = state.copy(angles = f.angles, target = f.angles, after = "")
                    if (f.result == "error") log("침대가 오류를 알렸어요")
                    publishState()
                }
            }
        }
        val s = state
        if (s.moving) {
            // 침대 역할이 접속해 있으면 돌려준 각도를 쓰고, 없으면 시뮬레이션으로 센다. 실제 침대도 BedLink 자리로 들어온다
            val link = bedLink
            state = s.copy(angles = if (link != null) link.latest ?: s.angles else sim.step(s.angles, s.target, 0.05))
            if (!state.moving && state.after.isNotEmpty()) {  // 다 움직였으면 결과를 말한다
                val a = state.after
                state = state.copy(after = "", lastSpeech = a)
                say(a); publishState()
                if (::hub.isInitialized) hub.send(JSONObject().put("type", "speech").put("say", a))
            } else if (now() - lastPublish > 150 || !state.moving) publishState()
        }
        brain.dueAlarm(state)?.let { t -> apply(t); turn("", "", "", t.note, 0, 0) }
        // 날짜가 지난 일회용 알람은 지운다(울리는 중이거나 미뤄 둔 알람은 남김)
        if (state.timeValid) {
            val today = AlarmFinder.nowLocal(now()).toLocalDate()
            val keep = state.alarms.filter { it.repeating || it.onceDate == null || !it.onceDate.isBefore(today) || it.id == state.ringing?.id || (state.snoozeAt != null && it.id == state.lastAlarmId) }
            if (keep.size != state.alarms.size) { state = state.copy(alarms = keep); publishState() }
        }
        syncAlarmSound()
        val r = state.reservation
        if (r != null && state.timeValid && now() >= r.atMs && state.ringing == null) {
            // 예약은 안내 음성 없이 움직인다(받을 때 미리 알려 줌)
            state = state.copy(reservation = null, undo = state.target to state.purpose, moveStart = state.angles, target = r.target, purpose = r.purpose, after = "")
            turn("", "", "", "예약 시각이 되어 ${r.label} 예약대로 움직여요.", 0, 0)
            publishState()
        }
    }

    /** 알람이 울리는 동안(답을 기다리는 동안 빼고) 소리를 내고, 소리가 나는 동안은 말을 듣지 않는다 */
    private fun syncAlarmSound() {
        val want = state.ringing != null && state.question == null && now() >= soundPausedUntil
        if (want && !alarmSound.playing) { alarmSound.start(); muteMic() }
        if (!want && alarmSound.playing) { alarmSound.stop(); muteMic() }
    }

    private fun muteMic() {
        if (!::listener.isInitialized) return
        listener.muted = dingNow || alarmSound.playing
        listener.speaking = speakingNow   // 말하는 동안은 "잘자요"만 짧게 끊어 듣는다(Listener.onBarge)
    }

    // ---------- 침대 역할·폰에서 온 것 ----------
    private fun onMessage(m: JSONObject, c: WebSocket) {
        when (m.optString("type")) {
            "hello" -> main.execute {
                when (m.optString("role")) {
                    "bed" -> {
                        bedConn = c
                        bedLink = BedLink { hub.sendTo(c, it) }.also { it.start(state.angles, state.target) }
                        log("침대 역할 연결됨"); publishState()
                    }
                    "phone" -> { phones.add(c); log("폰 연결됨"); publishState() }
                }
            }
            "bed-state" -> if (c === bedConn) bedLink?.read(m)
            "req" -> main.execute { onRequest(m, c) }
            else -> onPc(m)
        }
    }

    private fun left(c: WebSocket) = main.execute {
        phones.remove(c); replied.remove(c)
        if (c === bedConn) { bedConn = null; bedLink = null; log("침대 역할 끊김, 시뮬레이션으로 셈"); publishState() }
    }

    private fun onRequest(m: JSONObject, c: WebSocket) {
        val id = m.getInt("id")
        val seen = replied.getOrPut(c) { object : LinkedHashMap<Int, JSONObject>() { override fun removeEldestEntry(e: MutableMap.MutableEntry<Int, JSONObject>) = size > 64 } }
        seen[id]?.let { hub.sendTo(c, it); return }
        val name = m.getString("name")
        val today = AlarmFinder.nowLocal(now()).toLocalDate()
        val r = try { appApi.handle(state, name, m.optJSONObject("body"), today, appExtras) } catch (e: Exception) { Log.w(TAG, "폰 요청 처리 실패: $name", e); return }
        val reply = r.reply ?: run { log("보드에 없는 요청: $name"); return }
        state = r.state
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

    // ---------- PC에서 온 것 ----------
    private fun onPc(m: JSONObject) {
        when (m.optString("type")) {
            "text" -> heard(m.getString("text"), 0, typed = true)
            "button" -> main.execute {
                epoch.incrementAndGet()
                val ring = state.ringing
                val t = brain.alarmButton(state)?.also { if (ring?.type == "leave_bed") soundPausedUntil = now() + 30_000 }
                    ?: if (state.moving) brain.stopNow(state, "버튼은 모델을 거치지 않고 바로 멈춰요.") else Turn(state, note = "움직이는 중이 아니라서 할 일이 없어요.")
                apply(t); syncAlarmSound(); turn("", "버튼", t.say, t.note, 0, 0)
            }
            "sensor" -> main.execute {
                if (!m.optBoolean("occupied", true)) brain.bedEmpty(state)?.let { t -> apply(t); syncAlarmSound(); turn("", "압력 센서: 침대가 빔", t.say, t.note, 0, 0) }
            }
            "time" -> main.execute { clock.set(m.getLong("epochMs")); state = state.copy(timeValid = true); publishState(); log("시각을 PC에 맞췄어요") }
            "always" -> { alwaysListen = m.optBoolean("on"); log(if (alwaysListen) "부르는 말 없이 들어요(시험용)" else "부르는 말이 있어야 들어요") }
        }
    }

    // ---------- PC로 보내기 ----------
    private fun publishState() {
        if (::store.isInitialized) store.save(state)
        if (!::hub.isInitialized) return
        lastPublish = now()
        val s = state
        publishApp(s)
        fun ang(a: com.jaljayo.board.brain.Angles) = JSONObject().put("head", (a.head * 10).roundToInt() / 10.0).put("leg", (a.leg * 10).roundToInt() / 10.0)
        hub.send(JSONObject().put("type", "state").put("simulated", bedLink == null).put("model", modelName)
            .put("angles", ang(s.angles)).put("target", ang(s.target)).put("moving", s.moving)
            .put("purpose", s.purpose?.code ?: JSONObject.NULL)
            .put("asking", s.pending != null)
            .put("reservation", s.reservation?.let { JSONObject().put("label", it.label).put("purpose", it.purpose.code).put("inMin", ((it.atMs - now()) / 60000.0).roundToInt()) } ?: JSONObject.NULL)
            .put("alarms", JSONArray(s.alarms.filter { it.next(AlarmFinder.nowLocal(now())) != null || it.id == s.ringing?.id }.map { a -> JSONObject().put("label", a.label(AlarmFinder.nowLocal(now()))).put("type", a.type).put("enabled", a.enabled) }))
            .put("timeValid", s.timeValid).put("ringing", s.ringing != null).put("question", s.question?.let { "${it.first} + ${it.second}" } ?: JSONObject.NULL))
    }

    private fun publishApp(s: BedState) {
        if (phones.isEmpty()) return
        val o = appApi.appState(s, AlarmFinder.nowLocal(now()).toLocalDate(), appExtras, now())
        phones.forEach { hub.sendTo(it, o) }
    }

    private fun turn(heard: String, output: String, say: String, note: String, asrMs: Long, llmMs: Long) {
        log("들음 \"$heard\" → $output → ${say.ifEmpty { note }}")
        if (!::hub.isInitialized) return
        hub.send(JSONObject().put("type", "turn").put("heard", heard).put("output", output).put("say", say).put("note", note)
            .put("asrMs", asrMs).put("llmMs", llmMs))
    }

    private fun log(s: String) { Log.i(TAG, s); Status.post(s) }

    private fun startAsForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("board", "잘자요 보드", NotificationManager.IMPORTANCE_LOW))
        val n = Notification.Builder(this, "board").setContentTitle("잘자요 보드").setContentText("듣는 중").setSmallIcon(android.R.drawable.ic_btn_speak_now).build()
        startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
    }

    override fun onDestroy() {
        alarmSound.stop()
        if (::listener.isInitialized) listener.stop()
        if (::model.isInitialized) model.stop()
        if (::hub.isInitialized) hub.stop(500)
        main.shutdownNow(); llm.shutdownNow()
        super.onDestroy()
    }

    companion object { const val TAG = "JaljayoBoard" }
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
