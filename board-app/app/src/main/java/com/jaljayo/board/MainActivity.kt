package com.jaljayo.board

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.time.Instant
import java.time.ZoneId
import kotlin.math.PI
import kotlin.math.sin

// 보드 앱의 첫 화면(11/17 새 디자인). 왼쪽: 지금 하는 일·침대 각도·알람, 오른쪽: 한 마디씩 나뉜 대화. 준비 기록은 "기록"을 눌러야 보인다.
// 화면은 보드 앱(BoardService)의 값을 읽기만 한다. 듣고 대답하는 동작은 바꾸지 않는다
class MainActivity : Activity() {
    private val ui = Handler(Looper.getMainLooper())
    private fun dp(v: Float) = v * resources.displayMetrics.density
    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private lateinit var orb: Orb
    private lateinit var statusTitle: TextView
    private lateinit var statusSub: TextView
    private lateinit var offButton: TextView
    private lateinit var bedsBox: LinearLayout
    private lateinit var alarmText: TextView
    private lateinit var resvText: TextView
    private lateinit var clockNoticeText: TextView
    private lateinit var clockText: TextView
    private lateinit var modeChip: TextView
    private lateinit var logChip: TextView
    private lateinit var talkList: LinearLayout
    private lateinit var talkScroll: ScrollView
    private lateinit var emptyTalk: TextView
    private lateinit var logPanel: View
    private lateinit var logText: TextView
    private lateinit var qrCard: View
    private lateinit var qrRow: LinearLayout
    private var qrKey = ""
    private lateinit var qrChip: TextView
    private lateinit var qrTitle: TextView
    private lateinit var qrHint: TextView
    // 11/19: 위 "QR" 단추로 모든 침대의 QR을 보여 준다(개발·시연용). 끄면 병원에 등록 전인 침대만
    private var qrAll = false
    private var bedRows = emptyList<BedRow>()
    private var bedKey = ""
    private var bedBitmap: Bitmap? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = C.BG; window.navigationBarColor = C.BG
        bedBitmap = BitmapFactory.decodeResource(resources, R.drawable.bed_art)
        setContentView(build())
        hideStatusBar()
        for (t in Talk.all()) addTalk(t, scroll = false)
        talkScroll.post { talkScroll.fullScroll(View.FOCUS_DOWN) }
        Talk.onAdd = { t -> runOnUiThread { addTalk(t, scroll = true) } }
        logText.text = Status.text(); markLogError(Status.text())
        Status.onChange = { t -> runOnUiThread { logText.text = t; markLogError(t) } }
        val need = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS)
            .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (need.isEmpty()) startBoard() else requestPermissions(need.toTypedArray(), 1)
    }

    override fun onResume() { super.onResume(); hideStatusBar(); ui.post(refresh) }

    // 11/19: 맨 위 시스템 바의 시계는 보드 기기 시계라 틀린다(인터넷이 없어 못 맞춤). 보드 앱이 켜져 있는 동안 숨긴다(위에서 쓸어내리면 잠깐 보임)
    private fun hideStatusBar() {
        window.insetsController?.let {
            it.hide(android.view.WindowInsets.Type.statusBars())
            it.systemBarsBehavior = android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }
    override fun onPause() { super.onPause(); ui.removeCallbacks(refresh) }
    override fun onDestroy() { Talk.onAdd = null; Status.onChange = null; super.onDestroy() }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startBoard()
        else Status.post("마이크 권한이 없어 시작하지 못했어요")
    }

    private fun startBoard() = startForegroundService(Intent(this, BoardService::class.java))

    // ---------------- 화면 짜기 ----------------
    private fun build(): View {
        val root = FrameLayout(this).apply { setBackgroundColor(C.BG) }
        val page = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(dp(20), dp(14), dp(20), dp(16)) }
        page.addView(topBar(), LinearLayout.LayoutParams(-1, dp(40)))
        val body = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        body.addView(leftColumn(), LinearLayout.LayoutParams(0, -1, 0.40f).apply { rightMargin = dp(14) })
        body.addView(rightColumn(), LinearLayout.LayoutParams(0, -1, 0.60f))
        page.addView(body, LinearLayout.LayoutParams(-1, 0, 1f).apply { topMargin = dp(12) })
        root.addView(page, FrameLayout.LayoutParams(-1, -1))
        logPanel = logOverlay()
        root.addView(logPanel, FrameLayout.LayoutParams(dp(440), -1, Gravity.END).apply { setMargins(0, dp(60), dp(20), dp(16)) })
        return root
    }

    private fun topBar(): View = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL
        addView(ImageView(this@MainActivity).apply { setImageBitmap(bedBitmap); scaleType = ImageView.ScaleType.CENTER_CROP }, LinearLayout.LayoutParams(dp(34), dp(34)))
        addView(text("잘자요", 20f, C.TEXT, bold = true), LinearLayout.LayoutParams(-2, -2).apply { leftMargin = dp(6) })
        modeChip = chip("").apply { setOnClickListener { pickMode() } }
        addView(modeChip, LinearLayout.LayoutParams(-2, dp(30)).apply { leftMargin = dp(14) })
        addView(View(this@MainActivity), LinearLayout.LayoutParams(0, 1, 1f))
        clockText = text("", 18f, C.TEXT, bold = true).apply { typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL) }
        addView(clockText, LinearLayout.LayoutParams(-2, -2))
        qrChip = chip("QR").apply { setOnClickListener { qrAll = !qrAll; qrKey = ""; setTextColor(if (qrAll) C.ACCENT else C.TEXT) } }
        addView(qrChip, LinearLayout.LayoutParams(-2, dp(30)).apply { leftMargin = dp(14) })
        logChip = chip("기록").apply { setOnClickListener { logPanel.visibility = if (logPanel.visibility == View.VISIBLE) View.GONE else View.VISIBLE } }
        addView(logChip, LinearLayout.LayoutParams(-2, dp(30)).apply { leftMargin = dp(14) })
    }

    private fun leftColumn(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        // 지금 하는 일
        val status = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; background = card(); setPadding(dp(16), dp(10), dp(16), dp(14))
            orb = Orb(this@MainActivity, bedBitmap)
            addView(orb, LinearLayout.LayoutParams(dp(120), dp(120)))
            statusTitle = text("", 22f, C.TEXT, bold = true).apply { gravity = Gravity.CENTER }
            addView(statusTitle, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4) })
            statusSub = text("", 13f, C.SUB).apply { gravity = Gravity.CENTER }
            addView(statusSub, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(4) })
            // 11/19: 보드 화면은 개발·시연할 때만 보는 화면이라(사용자는 침대 버튼·말·센서로 끈다) 한 번 누르면 바로 알람을 끝낸다
            offButton = text("알람 끄기", 16f, C.ON_ACCENT, bold = true).apply {
                gravity = Gravity.CENTER; background = pill(C.RING); visibility = View.GONE
                setOnClickListener { BoardService.instance?.longPress() }
            }
            addView(offButton, LinearLayout.LayoutParams(-1, dp(44)).apply { topMargin = dp(10) })
        }
        addView(status, LinearLayout.LayoutParams(-1, 0, 1f))
        // 침대 각도·알람·예약
        val info = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.VERTICAL; background = card(); setPadding(dp(16), dp(12), dp(16), dp(12))
            bedsBox = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.VERTICAL }
            addView(bedsBox, LinearLayout.LayoutParams(-1, -2))
            addView(View(this@MainActivity).apply { setBackgroundColor(C.LINE) }, LinearLayout.LayoutParams(-1, dp(1)).apply { topMargin = dp(10); bottomMargin = dp(8) })
            alarmText = infoLine(this, "다음 알람")
            resvText = infoLine(this, "예약")
            // 11/17: 시각을 잃어 알람이 멈췄을 때 안내(폰 앱이 연결되어 시각이 맞춰지면 사라짐)
            clockNoticeText = text("", 13f, C.RING, bold = true).apply { visibility = View.GONE }
            addView(clockNoticeText, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) })
        }
        addView(info, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(12) })
    }

    private fun infoLine(parent: LinearLayout, label: String): TextView {
        val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        row.addView(text(label, 13f, C.SUB), LinearLayout.LayoutParams(dp(70), -2))
        val v = text("", 14f, C.TEXT, bold = true).apply { maxLines = 1; ellipsize = TextUtils.TruncateAt.END }
        row.addView(v, LinearLayout.LayoutParams(0, -2, 1f))
        parent.addView(row, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(3) })
        return v
    }

    // 11/19: 오른쪽 위에 병원에 등록되지 않은 침대의 QR 카드(그런 침대가 있을 때만). 대화 카드는 그만큼 아래로 줄어든다(덮지 않음)
    private fun rightColumn(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        qrCard = LinearLayout(this@MainActivity).apply {
            orientation = LinearLayout.VERTICAL; background = card(); setPadding(dp(18), dp(12), dp(18), dp(12)); visibility = View.GONE
            qrTitle = text("병원에 등록 전인 침대", 15f, C.SUB, bold = true)
            addView(qrTitle, LinearLayout.LayoutParams(-2, -2))
            qrHint = text("폰 앱 병원 관리 → 침대 추가에서 QR을 찍거나 아래 글을 넣어 주세요", 12f, C.SUB)
            addView(qrHint, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(4) })
            qrRow = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.HORIZONTAL }
            addView(qrRow, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(10) })
        }
        addView(qrCard, LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(12) })
        addView(talkCard(), LinearLayout.LayoutParams(-1, 0, 1f))
    }

    private fun showQr(st: ScreenState) {
        val ids = if (qrAll) st.allQr else st.qr
        val key = ids.joinToString(",") + "|" + st.host + "|" + qrAll
        if (key == qrKey) return
        qrKey = key; qrRow.removeAllViews()
        qrCard.visibility = if (ids.isEmpty()) View.GONE else View.VISIBLE
        qrTitle.text = if (!qrAll) "병원에 등록 전인 침대" else if (st.ward) "201호 병실 QR (시연용)" else "침대 QR (시연용)"
        qrHint.text = if (!qrAll) "폰 앱 병원 관리 → 침대 추가에서 QR을 찍거나 아래 글을 넣어 주세요"
            else if (st.ward) "폰 앱에서 QR을 찍거나 고유 번호로 입력에 아래 글을 넣은 뒤, 사과·포도·딸기 중 이름을 고르면 그 침대에 연결돼요"
            else "폰 앱에서 QR을 찍거나 고유 번호로 입력에 아래 글을 넣어 주세요"
        for (id in ids) {
            val item = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
            item.addView(ImageView(this).apply { setImageBitmap(qrBitmap(com.jaljayo.board.net.HospitalBeds.qrText(id, st.host))); scaleType = ImageView.ScaleType.FIT_CENTER },
                LinearLayout.LayoutParams(dp(168), dp(168)))
            item.addView(text(com.jaljayo.board.net.HospitalBeds.typedText(id, st.host), 14f, C.TEXT, bold = true).apply { typeface = Typeface.create("sans-serif-medium", Typeface.BOLD); maxLines = 1 }, LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(6) })
            qrRow.addView(item, LinearLayout.LayoutParams(-2, -2).apply { rightMargin = dp(18) })
        }
    }

    /** QR 칸을 칸마다 8픽셀로 그린다(흐려지지 않게 정수 배). 바깥 여백은 흰색 */
    private fun qrBitmap(text: String): Bitmap {
        // 11/19: 흰 테두리를 표준 권장 4칸으로(어두운 화면 바탕에서 2칸이면 폰 카메라가 잘 못 읽었다)
        val cells = com.jaljayo.board.net.BedQr.cells(text, quiet = 4)
        val k = 8; val n = cells.size; val w = n * k
        val px = IntArray(w * w) { i -> if (cells[(i / w) / k][(i % w) / k]) Color.BLACK else Color.WHITE }
        return Bitmap.createBitmap(px, w, w, Bitmap.Config.ARGB_8888)
    }

    private fun talkCard(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; background = card(); setPadding(dp(18), dp(12), dp(18), dp(4))
        addView(text("대화", 15f, C.SUB, bold = true), LinearLayout.LayoutParams(-2, -2))
        val frame = FrameLayout(this@MainActivity)
        talkScroll = ScrollView(this@MainActivity).apply { isVerticalScrollBarEnabled = false; isFillViewport = true }
        talkList = LinearLayout(this@MainActivity).apply { orientation = LinearLayout.VERTICAL; setPadding(0, 0, 0, dp(12)) }
        talkScroll.addView(talkList)
        frame.addView(talkScroll, FrameLayout.LayoutParams(-1, -1))
        emptyTalk = text("아직 나눈 말이 없어요", 15f, C.SUB).apply { gravity = Gravity.CENTER }
        frame.addView(emptyTalk, FrameLayout.LayoutParams(-1, -1))
        addView(frame, LinearLayout.LayoutParams(-1, 0, 1f).apply { topMargin = dp(6) })
    }

    private fun logOverlay(): View = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL; visibility = View.GONE; elevation = dp(12f)
        background = GradientDrawable().apply { setColor(C.LOG_BG); cornerRadius = dp(16f); setStroke(dp(1), C.LINE) }
        setPadding(dp(16), dp(12), dp(16), dp(12))
        addView(text("준비 기록", 15f, C.TEXT, bold = true), LinearLayout.LayoutParams(-2, -2))
        logText = text("", 12f, C.SUB).apply { typeface = Typeface.MONOSPACE; setLineSpacing(dp(3f), 1f) }
        addView(ScrollView(this@MainActivity).apply { addView(logText) }, LinearLayout.LayoutParams(-1, 0, 1f).apply { topMargin = dp(8) })
    }

    // ---------------- 한 마디씩 ----------------
    private fun addTalk(t: TalkItem, scroll: Boolean) {
        emptyTalk.visibility = View.GONE
        val block = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val time = Instant.ofEpochMilli(t.at).atZone(ZoneId.of("Asia/Seoul")).toLocalTime()
        val timeStr = "${if (time.hour < 12) "오전" else "오후"} ${if (time.hour % 12 == 0) 12 else time.hour % 12}:${"%02d".format(time.minute)}"
        val button = t.output == "버튼 길게" || t.output == "버튼"
        // 사람이 한 말(오른쪽)
        when {
            t.heard.isNotEmpty() -> block.addView(bubble(t.heard, mine = true), wrapRight())
            button -> block.addView(tag("버튼을 길게 눌렀어요"), wrapRight())
        }
        // 보드의 대답(왼쪽) — 말이 없으면 설명을 흐리게
        val reply = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.TOP }
        reply.addView(ImageView(this).apply {
            setImageBitmap(bedBitmap); scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(C.BG) }; clipToOutline = true
        }, LinearLayout.LayoutParams(dp(30), dp(30)).apply { topMargin = dp(2); rightMargin = dp(8) })
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        if (t.say.isNotEmpty()) col.addView(bubble(t.say, mine = false), LinearLayout.LayoutParams(-2, -2))
        else if (t.note.isNotEmpty()) col.addView(text(t.note, 14f, C.SUB).apply { setPadding(dp(2), dp(6), 0, 0) }, LinearLayout.LayoutParams(-2, -2))
        // 시험용 작은 줄: 모델 출력·걸린 시간·시각
        val meta = listOfNotNull(
            t.output.takeIf { it.isNotEmpty() && !button },
            if (t.asrMs > 0) "받아쓰기 ${sec(t.asrMs)}" else null,
            if (t.llmMs > 0) "모델 ${sec(t.llmMs)}" else null,
            timeStr)
        col.addView(text(meta.joinToString("  ·  "), 11f, C.META).apply { typeface = Typeface.MONOSPACE; setPadding(dp(2), dp(5), 0, 0) },
            LinearLayout.LayoutParams(-2, -2))
        reply.addView(col, LinearLayout.LayoutParams(0, -2, 1f))
        block.addView(reply, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(6) })
        // 한 마디 사이는 선으로 나눈다
        if (talkList.childCount > 0) talkList.addView(View(this).apply { setBackgroundColor(C.LINE) }, LinearLayout.LayoutParams(-1, dp(1)).apply { topMargin = dp(12); bottomMargin = dp(12) })
        else block.setPadding(0, dp(8), 0, 0)
        talkList.addView(block, LinearLayout.LayoutParams(-1, -2))
        while (talkList.childCount > 119) talkList.removeViewAt(0)
        if (scroll) talkScroll.post { talkScroll.smoothScrollTo(0, talkList.bottom) }
    }

    private fun sec(ms: Long) = "%.1f초".format(ms / 1000.0)
    private fun wrapRight() = LinearLayout.LayoutParams(-2, -2).apply { gravity = Gravity.END; leftMargin = dp(80) }

    private fun bubble(s: String, mine: Boolean) = text(s, 16f, if (mine) C.ON_CREAM else C.TEXT).apply {
        setPadding(dp(14), dp(9), dp(14), dp(10)); setLineSpacing(dp(2f), 1f)
        background = GradientDrawable().apply {
            setColor(if (mine) C.CREAM else C.BUBBLE)
            val r = dp(16f); val s2 = dp(4f)
            cornerRadii = if (mine) floatArrayOf(r, r, s2, s2, r, r, r, r) else floatArrayOf(s2, s2, r, r, r, r, r, r)
        }
        maxWidth = dp(400)
    }

    private fun tag(s: String) = text(s, 13f, C.SUB).apply {
        setPadding(dp(12), dp(5), dp(12), dp(6)); background = GradientDrawable().apply { cornerRadius = dp(14f); setStroke(dp(1), C.LINE) }
    }

    // ---------------- 0.15초마다 다시 그리기 ----------------
    private val refresh = object : Runnable {
        override fun run() {
            val st = BoardService.instance?.screen ?: ScreenState()
            orb.phase = st.phase
            val (title, sub) = when (st.phase) {
                Phase.BOOT -> "준비하는 중" to "모델과 목소리를 불러오고 있어요"
                Phase.IDLE -> if (st.ward) "침대 이름을 불러 주세요" to st.beds.filter { it.callable }.joinToString(" · ") { it.name + " 침대" }.ifEmpty { "이름을 정한 침대가 없어요" }
                    else "‘${st.callWord}’라고 불러 주세요" to "부르면 띠링 소리 뒤에 말씀하세요"
                Phase.LISTEN -> "듣고 있어요" to "편하게 말씀하세요"
                Phase.HEAR -> "듣는 중" to "말이 끝나면 바로 알아들어요"
                Phase.THINK -> "생각하는 중" to "무슨 말인지 알아보고 있어요"
                Phase.SPEAK -> "말하는 중" to ""
                Phase.RING -> "알람이 울려요" to "말이나 침대 버튼으로 꺼요"
            }
            if (statusTitle.text != title) statusTitle.text = title
            if (statusSub.text != sub) { statusSub.text = sub; statusSub.visibility = if (sub.isEmpty()) View.INVISIBLE else View.VISIBLE }
            val ring = st.phase == Phase.RING
            offButton.visibility = if (ring) View.VISIBLE else View.GONE
            // 11/19: 알람이 울릴 때 빨간 끄기 버튼이 카드 아래로 잘렸다(병원 모드는 아래 침대 카드가 길어 위 카드가 낮음).
            // 버튼이 보이는 동안만 침대 그림을 줄여 버튼 자리를 만든다
            val orbSize = dp(if (ring) 56 else 120)
            (orb.layoutParams as LinearLayout.LayoutParams).let { lp -> if (lp.width != orbSize) { lp.width = orbSize; lp.height = orbSize; orb.layoutParams = lp } }
            modeChip.text = if (st.ward) "병원 · ${st.beds.size}대" else "가정용"
            // 11/17: 안드로이드 시계는 껐다 켜면 틀어지므로 보드 앱 시계(시연 화면·폰에서 받은 시각)를 쓴다. 아직 못 받았으면 --:--
            val ms = BoardService.instance?.screenTime()
            clockText.text = if (ms == null) "--:--" else java.time.Instant.ofEpochMilli(ms).atZone(ZoneId.of("Asia/Seoul")).toLocalTime().let { now ->
                "${if (now.hour < 12) "오전" else "오후"} ${if (now.hour % 12 == 0) 12 else now.hour % 12}:${"%02d".format(now.minute)}" }
            alarmText.text = st.nextAlarm ?: "없음"; alarmText.setTextColor(if (st.nextAlarm == null) C.SUB else C.TEXT)
            resvText.text = st.reservation ?: "없음"; resvText.setTextColor(if (st.reservation == null) C.SUB else C.TEXT)
            if (clockNoticeText.text != (st.clockNotice ?: "")) clockNoticeText.text = st.clockNotice ?: ""
            clockNoticeText.visibility = if (st.clockNotice == null) View.GONE else View.VISIBLE
            showBeds(st)
            // 병원 모드에서는 QR 단추를 숨기고 켜져 있던 QR 보기도 끈다
            qrChip.visibility = if (st.ward) View.GONE else View.VISIBLE
            if (st.ward && qrAll) { qrAll = false; qrKey = ""; qrChip.setTextColor(C.TEXT) }
            showQr(st)
            ui.postDelayed(this, 150)
        }
    }

    private class BedRow(val name: TextView?, val head: Bar, val leg: Bar, val moving: TextView?)

    private fun showBeds(st: ScreenState) {
        val key = st.beds.joinToString(",") { it.name } + st.ward
        if (key != bedKey) {
            bedKey = key; bedsBox.removeAllViews()
            bedRows = st.beds.mapIndexed { i, _ ->
                if (st.ward) {
                    // 병원용: 침대마다 한 줄(이름 | 머리 | 다리)
                    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
                    val name = text("", 14f, C.TEXT, bold = true).apply { maxLines = 1 }
                    row.addView(name, LinearLayout.LayoutParams(dp(78), -2))
                    val head = Bar(this, "머리", 60f, compact = true); val leg = Bar(this, "다리", 40f, compact = true)
                    row.addView(head, LinearLayout.LayoutParams(0, dp(24), 1f))
                    row.addView(leg, LinearLayout.LayoutParams(0, dp(24), 1f).apply { leftMargin = dp(12) })
                    bedsBox.addView(row, LinearLayout.LayoutParams(-1, -2).apply { if (i > 0) topMargin = dp(6) })
                    BedRow(name, head, leg, null)
                } else {
                    val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
                    val top = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
                    top.addView(text("침대 각도", 13f, C.SUB), LinearLayout.LayoutParams(0, -2, 1f))
                    val mv = text("움직이는 중", 12f, C.ACCENT, bold = true).apply { visibility = View.INVISIBLE }
                    top.addView(mv); box.addView(top)
                    val head = Bar(this, "머리", 60f); val leg = Bar(this, "다리", 40f)
                    box.addView(head, LinearLayout.LayoutParams(-1, dp(28)).apply { topMargin = dp(4) })
                    box.addView(leg, LinearLayout.LayoutParams(-1, dp(28)).apply { topMargin = dp(2) })
                    bedsBox.addView(box, LinearLayout.LayoutParams(-1, -2))
                    BedRow(null, head, leg, mv)
                }
            }
        }
        st.beds.forEachIndexed { i, b ->
            val r = bedRows.getOrNull(i) ?: return@forEachIndexed
            // 11/17: 부르기 전에는 셋 다 같은 색. 이름을 불러 그 침대와 이야기하는 동안만 주황
            val talking = b.active && st.phase != Phase.IDLE && st.phase != Phase.BOOT
            r.name?.apply { text = if (b.moving) "${b.name} ↕" else b.name; setTextColor(if (talking) C.ACCENT else C.TEXT) }
            r.head.set(b.head.toFloat()); r.leg.set(b.leg.toFloat())
            r.moving?.visibility = if (b.moving) View.VISIBLE else View.INVISIBLE
        }
    }

    private fun markLogError(t: String) {
        val bad = t.contains("실패")
        logChip.setTextColor(if (bad) C.RING else C.TEXT)
        logChip.text = if (bad) "기록 !" else "기록"
    }

    // 11/14 병원용 연습: 부르는 이름 고르기(가정용이면 "잘자요"). 0 가정용, 1~12 병원용 1대(과일 하나), 마지막 병원 시연(한 보드가 3대)
    private fun pickMode() {
        val fruits = com.jaljayo.board.brain.FruitMatch.FRUITS
        val modes: List<List<String>?> = listOf<List<String>?>(null) + fruits.map { listOf(it) } + listOf(BoardService.WARD_DEMO)
        val names = listOf("가정용 (잘자요)") + fruits.map { "병원용 1대: $it 침대" } + "병원 시연: ${BoardService.WARD_DEMO.joinToString("·")} 침대 ${BoardService.WARD_DEMO.size}대"
        AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
            .setTitle("부르는 이름")
            .setItems(names.toTypedArray()) { _, pos -> BoardService.instance?.setWardMode(modes[pos]) }
            .show()
    }

    // ---------------- 작은 도구 ----------------
    private fun text(s: String, sp: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
        text = s; textSize = sp; setTextColor(color); includeFontPadding = false
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }
    private fun card() = GradientDrawable().apply { setColor(C.CARD); cornerRadius = dp(20f) }
    private fun pill(c: Int) = GradientDrawable().apply { setColor(c); cornerRadius = dp(22f) }
    private fun chip(s: String) = text(s, 13f, C.TEXT, bold = true).apply {
        gravity = Gravity.CENTER; setPadding(dp(14), 0, dp(14), 0)
        background = GradientDrawable().apply { setColor(C.CARD); cornerRadius = dp(15f); setStroke(dp(1), C.LINE) }
    }

    /** 색: 스플래시와 같은 남색 바탕, 침대 그림의 따뜻한 크림·주황 */
    object C {
        val BG = Color.parseColor("#232D46")
        val CARD = Color.parseColor("#2C3858")
        val BUBBLE = Color.parseColor("#3A4770")
        val LOG_BG = Color.parseColor("#1B2338")
        val LINE = Color.parseColor("#3A4566")
        val TEXT = Color.parseColor("#F5F1EA")
        val SUB = Color.parseColor("#A7B0C8")
        val META = Color.parseColor("#7F8BAA")
        val CREAM = Color.parseColor("#F3E3CC")
        val ON_CREAM = Color.parseColor("#2B2420")
        val ACCENT = Color.parseColor("#F4A261")
        val ON_ACCENT = Color.parseColor("#2B1A0E")
        val THINK = Color.parseColor("#8DB4FF")
        val SPEAK = Color.parseColor("#7FD4BC")
        val RING = Color.parseColor("#FF7B6B")
        val IDLE = Color.parseColor("#6E7BA0")
    }
}

/** 지금 하는 일을 보여 주는 동그라미. 가운데 침대 그림, 바깥 고리가 상태에 따라 움직인다 */
class Orb(ctx: Context, private val bed: Bitmap?) : View(ctx) {
    var phase = Phase.BOOT
        set(v) { if (field != v) { field = v; since = System.nanoTime() } }
    private var since = System.nanoTime()
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    private val bmpPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

    private fun color() = when (phase) {
        Phase.BOOT, Phase.IDLE -> MainActivity.C.IDLE
        Phase.LISTEN, Phase.HEAR -> MainActivity.C.ACCENT
        Phase.THINK -> MainActivity.C.THINK
        Phase.SPEAK -> MainActivity.C.SPEAK
        Phase.RING -> MainActivity.C.RING
    }

    override fun onDraw(c: Canvas) {
        val t = (System.nanoTime() - since) / 1e9
        val cx = width / 2f; val cy = height / 2f; val r0 = minOf(width, height) * 0.30f
        val col = color()
        fun alpha(a: Double) = ((a.coerceIn(0.0, 1.0)) * 255).toInt()
        p.style = Paint.Style.FILL
        when (phase) {
            Phase.LISTEN, Phase.HEAR, Phase.RING -> {   // 퍼져 나가는 고리
                val speed = if (phase == Phase.RING) 1.6 else if (phase == Phase.HEAR) 1.3 else 0.8
                for (k in 0 until 3) {
                    val f = ((t * speed + k / 3.0) % 1.0)
                    p.color = col; p.alpha = alpha(0.35 * (1 - f))
                    c.drawCircle(cx, cy, r0 * (1f + 0.62f * f.toFloat()), p)
                }
            }
            Phase.SPEAK -> {   // 말소리처럼 흔들리는 고리
                for (k in 0 until 2) {
                    val f = 0.5 + 0.5 * sin(t * 6.0 + k * 1.7)
                    p.color = col; p.alpha = alpha(0.22 + 0.12 * f)
                    c.drawCircle(cx, cy, r0 * (1.12f + 0.22f * f.toFloat() + 0.18f * k), p)
                }
            }
            Phase.THINK -> {   // 돌아가는 호
                p.color = col; p.alpha = alpha(0.18); c.drawCircle(cx, cy, r0 * 1.32f, p)
                p.style = Paint.Style.STROKE; p.strokeWidth = r0 * 0.12f; p.strokeCap = Paint.Cap.ROUND; p.alpha = 255
                val rr = r0 * 1.32f; val start = ((t * 300) % 360).toFloat()
                c.drawArc(RectF(cx - rr, cy - rr, cx + rr, cy + rr), start, 100f, false, p)
                p.style = Paint.Style.FILL
            }
            Phase.BOOT, Phase.IDLE -> {   // 천천히 숨 쉬기
                val f = 0.5 + 0.5 * sin(t * 2 * PI / 4.0)
                p.color = col; p.alpha = alpha(0.16 + 0.10 * f)
                c.drawCircle(cx, cy, r0 * (1.18f + 0.08f * f.toFloat()), p)
            }
        }
        p.color = MainActivity.C.BG; p.alpha = 255; c.drawCircle(cx, cy, r0, p)
        p.style = Paint.Style.STROKE; p.strokeWidth = r0 * 0.05f; p.color = col; c.drawCircle(cx, cy, r0, p); p.style = Paint.Style.FILL
        bed?.let { b -> val s = r0 * 0.78f; c.drawBitmap(b, null, RectF(cx - s, cy - s, cx + s, cy + s), bmpPaint) }
        postInvalidateOnAnimation()
    }
}

/** 각도 막대: 이름, 막대, 값 */
class Bar(ctx: Context, private val label: String, private val max: Float, private val compact: Boolean = false) : View(ctx) {
    private var value = 0f
    private var shown = -1f
    private val p = Paint(Paint.ANTI_ALIAS_FLAG)
    fun set(v: Float) { if (v != value) { value = v; invalidate() } }
    override fun onDraw(c: Canvas) {
        val d = resources.displayMetrics.density
        if (shown < 0) shown = value
        shown += (value - shown) * 0.35f
        if (kotlin.math.abs(shown - value) > 0.05f) postInvalidateOnAnimation() else shown = value
        val h = height.toFloat(); val labelW = (if (compact) 32 else 44) * d; val valueW = (if (compact) 38 else 48) * d
        p.textSize = (if (compact) 12 else 13) * d; p.color = MainActivity.C.SUB; p.typeface = Typeface.DEFAULT
        val base = h / 2 - (p.descent() + p.ascent()) / 2
        c.drawText(label, 0f, base, p)
        val x0 = labelW; val x1 = width - valueW; val th = (if (compact) 6 else 8) * d; val ty = h / 2 - th / 2
        p.color = MainActivity.C.LINE; c.drawRoundRect(RectF(x0, ty, x1, ty + th), th / 2, th / 2, p)
        val fx = x0 + (x1 - x0) * (shown / max).coerceIn(0f, 1f)
        p.color = MainActivity.C.ACCENT; if (fx > x0) c.drawRoundRect(RectF(x0, ty, maxOf(fx, x0 + th), ty + th), th / 2, th / 2, p)
        p.color = MainActivity.C.TEXT; p.typeface = Typeface.DEFAULT_BOLD; p.textSize = (if (compact) 13 else 14) * d; p.textAlign = Paint.Align.RIGHT
        c.drawText("${Math.round(value)}°", width.toFloat(), base, p); p.textAlign = Paint.Align.LEFT
    }
}
