package com.jaljayo.board.net

import com.jaljayo.board.brain.FruitMatch
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.time.LocalTime

// 11/19 병원 침대 목록. 형식은 docs/interfaces/hospital-beds.md
// 침대 칸마다 고유 번호(id)·호실(room)·침대 번호(no)·과일 이름(name)을 두고, 병원 설정(밤 시간 night, 알람 쓰기 alarm)과 함께
// filesDir/hospital_beds.json에 적어 둡니다. 시연에서는 보드 한 대가 침대 여러 대를 맡으므로 칸도 여럿입니다.
// 칸마다 붙는 key는 보드 안에서 그 침대를 가리키는 이름(ward.txt의 과일 이름)입니다. 침대 상태 파일·침대 제어부 접속·센서는 key로 나누고,
// 사람이 부르는 이름은 name을 따릅니다. 그래서 환자가 이름을 바꿔도 시연 화면의 침대 제어부는 그대로 붙어 있습니다.
// 환자 폰은 hello(bed)나 bed-register로 칸 하나에 붙습니다. C는 폰 접속을 가리키는 값입니다(보드에서는 WebSocket, 시험에서는 아무 값).
class HospitalBeds<C>(private val file: File?, androidId: String, keys: List<String>) {
    data class Slot(val id: String, val key: String, val room: String?, val no: Int?, val name: String?) {
        val placed get() = room != null && no != null
        /** 11/19: 보기용 침대(key 없음). 병원 관리 목록에만 보이고 침대 제어부·목소리와는 이어지지 않습니다 */
        val sample get() = key.isEmpty()
    }
    data class Night(val on: Boolean, val from: Int, val to: Int)

    /** 요청 하나의 결과입니다. clear: 알람·예약·저장 자세를 지울 침대(key), close: 끊을 환자 폰 접속, names: 부르는 이름이 바뀌었는지, settings: 병원 설정이 바뀌었는지 */
    data class Out<C>(val reply: JSONObject, val clear: List<String> = emptyList(), val close: List<C> = emptyList(), val names: Boolean = false, val settings: Boolean = false)

    val board: String
    var slots: List<Slot> = emptyList(); private set
    var night = Night(false, 22 * 60, 6 * 60); private set
    var alarm = true; private set
    private val patients = LinkedHashMap<C, String>()   // 환자 폰 접속 → 침대 칸 id

    init {
        val o = try { file?.takeIf { it.exists() }?.let { JSONObject(it.readText()) } } catch (_: Exception) { null }
        board = o?.optString("board")?.takeIf { it.isNotBlank() } ?: boardId(androidId)
        if (o != null) {
            o.optJSONArray("slots")?.let { a ->
                slots = (0 until a.length()).map { i ->
                    val s = a.getJSONObject(i)
                    Slot(s.getString("id"), s.getString("key"), str(s, "room"), if (s.isNull("no") || !s.has("no")) null else s.getInt("no"), str(s, "name"))
                }
            }
            o.optJSONObject("night")?.let { n -> night = Night(n.optBoolean("on", false), n.optInt("from", 22 * 60), n.optInt("to", 6 * 60)) }
            alarm = o.optBoolean("alarm", true)
        }
        // 11/19: 시연 처음 값이 바뀌었습니다(사과·포도·딸기 이름 비움, 다른 병실 보기용 침대). 예전 파일이면 칸을 새 처음 값으로 다시 만듭니다
        if (o != null && o.optInt("seed", 1) < SEED) slots = emptyList()
        realign(keys)
    }

    /** 보드가 맡는 침대(ward.txt)가 바뀌면 칸을 처음 상태로 다시 만듭니다. 같으면 그대로 둡니다. 가정용(빈 목록)이면 칸을 비웁니다 */
    fun realign(keys: List<String>) {
        if (slots.filter { !it.sample }.map { it.key } == keys) return
        // 11/19(새벽 결정 뒤 다시 정함): 시연 침대(201호 1·2·3번)는 처음부터 사과·포도·딸기 이름이 들어 있어 바로 불러 시연합니다. QR 등록은 가정용에서만 보여 줍니다.
        // 병원 관리 화면이 비어 보이지 않게 다른 병실에 보기용 침대 몇 대를 이름과 함께 넣어 둡니다(가정용이면 넣지 않음)
        slots = keys.mapIndexed { i, k -> Slot("$board-${i + 1}", k, DEMO_ROOM, i + 1, k.takeIf { it in FruitMatch.FRUITS }) } +
            (if (keys.isEmpty()) emptyList() else SAMPLES.mapIndexed { i, (room, no, name) -> Slot("$board-S${i + 1}", "", room, no, name) })
        patients.clear()
        save()
    }

    // ---------- 요청 ----------
    /** 병원 침대 요청이면 답을 돌려줍니다. 다른 요청이면 null입니다. admin: 이 접속이 admin-login을 마쳤는지, ward: 병원용 보드인지 */
    fun handle(c: C, name: String, body: JSONObject?, admin: Boolean, ward: Boolean): Out<C>? {
        val b = body ?: JSONObject()
        if (name in ADMIN) {
            if (!admin) return Out(no(NOT_ADMIN))
            if (!ward) return Out(no(NOT_WARD))
        }
        return when (name) {
            "admin-list" -> Out(ok().put("beds", JSONArray(placed().map(::bedJson))).put("rooms", JSONArray(rooms())))
            "admin-add" -> add(b)
            "admin-move" -> move(b)
            "admin-remove" -> remove(c, b)
            "admin-end" -> end(c, b)
            "admin-save" -> saveSettings(b)
            // 가정용은 예전 답 그대로입니다(병원 목록이 없음)
            "bed-find" -> if (!ward) Out(ok().put("taken", false).put("ward", false).put("name", "잘자요")) else if (isRoomQr(b)) roomFind() else find(c, b)
            "bed-register" -> if (!ward) Out(ok().put("ward", false).put("name", "잘자요")) else if (isRoomQr(b)) roomRegister(c) else register(c, b)
            "name-save" -> if (!ward) Out(no(NOT_WARD)) else nameSave(c, b)
            // 11/19 데모 시연 "첫 화면에서 시작하기": 이 폰이 붙은 침대의 사용을 끝냅니다(admin-end와 같되 자기 침대만, 관리자 로그인 없이)
            "bed-release" -> release(c)
            else -> null
        }
    }

    private fun add(b: JSONObject): Out<C> {
        val s = slotOfQr(b.optString("qr", "")) ?: return Out(no(NOT_MINE))
        val room = roomOf(b) ?: return Out(no(BAD)); val no = noOf(b) ?: return Out(no(BAD))
        if (s.placed) return Out(no("이미 등록된 침대예요(${s.room} ${s.no}번)"))
        if (taken(room, no, s.id)) return Out(no(occupied(room, no)))
        val ns = put(s.copy(room = room, no = no, name = null))
        return Out(ok().put("bed", bedJson(ns)), names = true)
    }

    private fun move(b: JSONObject): Out<C> {
        val s = slot(b.optString("bed", "")) ?: return Out(no(NOT_MINE))
        if (!s.placed) return Out(no(NOT_PLACED))
        val room = roomOf(b) ?: return Out(no(BAD)); val no = noOf(b) ?: return Out(no(BAD))
        if (taken(room, no, s.id)) return Out(no(occupied(room, no)))
        // 옮긴 병실에 같은 과일 이름이 있으면 이름을 비웁니다(환자가 새로 고름)
        val clash = s.name != null && room != s.room && slots.any { it.id != s.id && it.placed && it.room == room && it.name == s.name }
        val ns = put(s.copy(room = room, no = no, name = if (clash) null else s.name))
        val r = ok().put("bed", bedJson(ns))
        if (clash) r.put("nameCleared", true)
        return Out(r, names = clash)
    }

    private fun remove(c: C, b: JSONObject): Out<C> {
        val s = slot(b.optString("bed", "")) ?: return Out(no(NOT_MINE))
        put(s.copy(room = null, no = null, name = null))
        return Out(ok(), clear = listOf(s.key), close = unbind(s.id, except = c), names = true)
    }

    private fun end(c: C, b: JSONObject): Out<C> {
        val s = slot(b.optString("bed", "")) ?: return Out(no(NOT_MINE))
        put(s.copy(name = null))
        return Out(ok(), clear = listOf(s.key), close = unbind(s.id, except = c), names = true)
    }

    private fun release(c: C): Out<C> {
        val s = patients[c]?.let(::slot) ?: run { patients.remove(c); return Out(ok()) }
        // 시연 병실 침대는 이름을 지우지 않고 이 폰만 뗍니다(이름이 비면 불러도 대답하지 않아 시연이 끊김)
        if (!s.sample && s.room == DEMO_ROOM) { patients.remove(c); return Out(ok()) }
        put(s.copy(name = null))
        return Out(ok(), clear = listOf(s.key), close = unbind(s.id, except = c), names = true)
    }

    private fun saveSettings(b: JSONObject): Out<C> {
        val n = b.optJSONObject("night") ?: return Out(no(BAD))
        val on = n.opt("on") as? Boolean ?: return Out(no(BAD))
        val from = minuteOf(n.opt("from")) ?: return Out(no(BAD)); val to = minuteOf(n.opt("to")) ?: return Out(no(BAD))
        val al = b.opt("alarm") as? Boolean ?: return Out(no(BAD))
        night = Night(on, from, to); alarm = al
        save()
        // 시연은 보드 한 대가 침대 전체를 맡으므로 답하지 않은 침대가 없습니다
        return Out(ok().put("missing", JSONArray()), settings = true)
    }

    private fun find(c: C, b: JSONObject): Out<C> {
        val s = slotOfQr(b.optString("qr", "")) ?: return Out(no(NOT_MINE))
        return Out(ok().put("id", s.id).put("ward", true).put("placed", s.placed)
            .put("room", s.room ?: JSONObject.NULL).put("no", s.no ?: JSONObject.NULL).put("name", s.name ?: JSONObject.NULL)
            .put("taken", patients.any { it.value == s.id && it.key != c }))
    }

    private fun register(c: C, b: JSONObject): Out<C> {
        val s = slotOfQr(b.optString("qr", "")) ?: return Out(no(NOT_MINE))
        if (!s.placed) return Out(no(NOT_PLACED_YET))
        val others = patients.filter { it.value == s.id && it.key != c }.keys.toList()
        // 다른 환자 폰이 쓰는 중이면 replace가 true일 때만 이 폰으로 바꿉니다(폰은 bed-find의 taken을 보고 물은 뒤 보냄)
        if (others.isNotEmpty() && !b.optBoolean("replace", false)) return Out(no(TAKEN))
        others.forEach { patients.remove(it) }
        patients[c] = s.id
        return Out(ok().put("id", s.id).put("ward", true).put("room", s.room).put("no", s.no).put("name", s.name ?: JSONObject.NULL)
            .put("used", JSONArray(usedIn(s.room!!, except = s.id))), close = others)
    }

    // ---------- 11/19 병실 QR 하나(시연) ----------
    // 보드 화면에는 병실 QR 하나(jaljayo://bed/<보드 번호>)만 띄웁니다. 그 QR로 등록한 폰은 이름을 고를 때 침대가 정해집니다:
    // 사과·포도·딸기를 고르면 그 침대(시연 화면의 그 침대)에 붙고, 다른 과일을 고르면 이름만 정해지고 시연 화면에 없는 침대라 조작·대답이 없습니다.
    private fun isRoomQr(b: JSONObject) = idOfQr(b.optString("qr", "")) == board
    private fun roomUsed(exceptPhone: C?): List<String> =
        slots.filter { it.room == DEMO_ROOM && it.name != null && patients.entries.none { e -> e.key == exceptPhone && e.value == it.id } }.map { it.name!! } +
            patients.filter { it.key != exceptPhone }.values.mapNotNull(::virtualName)

    private fun roomFind(): Out<C> = Out(ok().put("id", board).put("ward", true).put("placed", true)
        .put("room", DEMO_ROOM).put("no", JSONObject.NULL).put("name", JSONObject.NULL).put("taken", false))

    private fun roomRegister(c: C): Out<C> {
        // 이 폰이 이미 침대에 붙어 있었으면 그 침대 이름을 비우고 새로 고르게 합니다(폰 하나에 침대 하나)
        val old = patients[c]?.let(::slot)
        if (old != null) put(old.copy(name = null))
        patients[c] = board
        return Out(ok().put("id", board).put("ward", true).put("room", DEMO_ROOM).put("no", 0).put("name", JSONObject.NULL)
            .put("used", JSONArray(roomUsed(c).distinct())), names = old != null)
    }

    /** 병실 QR로 등록한 폰의 이름 고르기. 사과·포도·딸기면 그 침대에 붙고, 다른 과일이면 시연 화면에 없는 침대로 붙습니다 */
    private fun roomNameSave(c: C, name: String): Out<C> {
        if (name in roomUsed(c)) return Out(no(SAME_ROOM))
        val old = patients[c]?.let(::slot)
        val target = slots.firstOrNull { !it.sample && it.key == name && it.room == DEMO_ROOM }
        if (old != null && old.id != target?.id) put(old.copy(name = null))
        val id = if (target != null) { put(target.copy(name = name)); target.id } else "$board-X-$name"
        patients[c] = id
        return Out(ok().put("id", id), names = true)
    }

    private fun virtualName(id: String): String? = id.takeIf { it.startsWith("$board-X-") }?.substringAfter("$board-X-")?.takeIf { it in FruitMatch.FRUITS }

    /** 이 폰이 시연 화면에 없는 침대(다른 과일)를 골랐거나 아직 이름을 고르지 않았는지. 이런 폰의 침대 조작은 받지 않습니다 */
    fun detached(c: C): Boolean = patients[c]?.let { it == board || virtualName(it) != null } ?: false

    private fun nameSave(c: C, b: JSONObject): Out<C> {
        val cur = patients[c]
        if (cur != null && (cur == board || virtualName(cur) != null || slot(cur)?.let { !it.sample && it.room == DEMO_ROOM } == true)) {
            val name = b.optString("name", "").trim()
            if (name !in FruitMatch.FRUITS) return Out(no(BAD))
            return roomNameSave(c, name)
        }
        val s = cur?.let(::slot) ?: return Out(no(NOT_REGISTERED))
        if (!s.placed) return Out(no(NOT_PLACED_YET))
        val name = b.optString("name", "").trim()
        if (name !in FruitMatch.FRUITS) return Out(no(BAD))
        if (name in usedIn(s.room!!, except = s.id)) return Out(no(SAME_ROOM))
        put(s.copy(name = name))
        return Out(ok(), names = true)
    }

    // ---------- 보드 앱이 쓰는 것 ----------
    /** hello(role phone)의 bed로 환자 폰을 침대에 붙입니다. bed는 고유 번호나 지금 부르는 과일 이름입니다. 붙은 침대의 key(없으면 null) */
    fun hello(c: C, bed: String): String? {
        val t = bed.trim()
        // 병실 QR로 등록만 하고 이름을 아직 안 골랐거나, 시연 화면에 없는 침대(다른 과일)를 고른 폰
        if (t.equals(board, ignoreCase = true) || virtualName(t) != null) { patients[c] = if (virtualName(t) != null) t else board; return null }
        val s = slot(bed)?.takeIf { !it.sample } ?: slots.firstOrNull { !it.sample && it.placed && it.name == t }
        if (s == null) { patients.remove(c); return null }
        patients[c] = s.id; return s.key
    }

    fun left(c: C) { patients.remove(c) }

    /** 이 폰이 붙은 침대의 key */
    fun keyOf(c: C): String? = patients[c]?.let(::slot)?.key

    /** 과일 이름으로 불렀을 때 대답할 침대의 key. 병원에 등록되고 이름이 있는 칸만 대답합니다 */
    fun keyOfCall(fruit: String): String? = slots.firstOrNull { !it.sample && it.placed && it.name == fruit }?.key

    /** 침대(key)를 부르는 이름. 등록 전이거나 이름이 없으면 null */
    fun callOf(key: String): String? = slots.firstOrNull { !it.sample && it.key == key }?.takeIf { it.placed }?.name

    /** 병원에 등록되지 않은 칸(보드 화면에 QR을 보여 줄 칸) */
    fun unplaced(): List<Slot> = slots.filter { !it.placed && !it.sample }

    /** 지금(그 시각)이 밤 시간인지. 끝 시각은 넣지 않고, 시작이 끝보다 늦으면 다음 날 끝까지입니다(폰 앱 isNightNow와 같음) */
    fun nightAt(t: LocalTime): Boolean {
        if (!night.on) return false
        val m = t.hour * 60 + t.minute
        return if (night.from <= night.to) m >= night.from && m < night.to else m >= night.from || m < night.to
    }

    // ---------- 작은 도구 ----------
    private fun slot(id: String): Slot? { val k = id.trim().uppercase(); return slots.firstOrNull { it.id == k } }
    private fun slotOfQr(qr: String): Slot? = slot(idOfQr(qr))
    private fun placed() = slots.filter { it.placed }.sortedWith(compareBy({ it.room }, { it.no }))
    private fun taken(room: String, no: Int, except: String) = slots.any { it.id != except && it.room == room && it.no == no }
    private fun usedIn(room: String, except: String) = slots.filter { it.id != except && it.room == room && it.name != null }.map { it.name!! }
    private fun occupied(room: String, no: Int) = "$room ${no}번에는 이미 침대가 있어요"
    private fun rooms() = (ROOMS + slots.mapNotNull { it.room }).distinct()

    /** 그 칸에 붙은 환자 폰을 떼어 내고, 끊을 접속을 돌려줍니다. 요청을 보낸 접속(except)은 답을 받아야 하므로 떼기만 하고 끊지 않습니다 */
    private fun unbind(id: String, except: C): List<C> {
        val gone = patients.filter { it.value == id }.keys.toList()
        gone.forEach { patients.remove(it) }
        return gone.filter { it != except }
    }

    private fun put(s: Slot): Slot { slots = slots.map { if (it.id == s.id) s else it }; save(); return s }

    private fun bedJson(s: Slot) = JSONObject().put("id", s.id).put("room", s.room ?: JSONObject.NULL).put("no", s.no ?: JSONObject.NULL)
        .put("name", s.name ?: JSONObject.NULL).put("phone", patients.containsValue(s.id) || (s.sample && s.name != null))

    private fun roomOf(b: JSONObject): String? = (b.opt("room") as? String)?.trim()?.takeIf { it.isNotEmpty() && it.length <= 20 }
    private fun noOf(b: JSONObject): Int? = when (val v = b.opt("no")) {
        is Number -> v.toDouble().takeIf { it == Math.floor(it) }?.toInt()
        is String -> v.trim().toIntOrNull()
        else -> null
    }?.takeIf { it in 1..99 }
    private fun minuteOf(v: Any?): Int? = (v as? Number)?.toInt()?.takeIf { it in 0 until 24 * 60 }

    private fun save() {
        if (file == null) return
        val o = JSONObject().put("board", board).put("seed", SEED)
            .put("slots", JSONArray(slots.map { s -> JSONObject().put("id", s.id).put("key", s.key).put("room", s.room ?: JSONObject.NULL).put("no", s.no ?: JSONObject.NULL).put("name", s.name ?: JSONObject.NULL) }))
            .put("night", JSONObject().put("on", night.on).put("from", night.from).put("to", night.to))
            .put("alarm", alarm)
        val tmp = File(file.path + ".tmp")
        tmp.writeText(o.toString()); tmp.renameTo(file)
    }

    private fun ok() = JSONObject().put("ok", true)
    private fun no(why: String) = JSONObject().put("ok", false).put("reason", why)
    private fun str(j: JSONObject, k: String) = if (j.isNull(k) || !j.has(k)) null else j.getString(k)

    companion object {
        val ADMIN = setOf("admin-list", "admin-add", "admin-move", "admin-remove", "admin-end", "admin-save")
        const val QR_PREFIX = "jaljayo://bed/"
        const val DEMO_ROOM = "201호"
        // 11/19: 시연 처음 값의 판. 바꾸면 예전 파일의 칸을 새 처음 값으로 다시 만듭니다
        const val SEED = 3
        // 보기용 침대(호실, 번호, 이름). 병원 관리 목록이 비어 보이지 않게 일부만. 다른 병실이라 사과·포도와 겹쳐도 됩니다
        val SAMPLES = listOf(Triple("202호", 1, "바나나"), Triple("202호", 2, "사과"), Triple("203호", 1, "포도"), Triple("203호", 2, "키위"), Triple("205호", 1, "복숭아"))
        // 폰 앱의 호실 목록(hospital.ts ROOMS)과 같습니다. 등록된 침대의 호실이 여기에 없으면 뒤에 붙입니다
        val ROOMS = listOf(2, 3).flatMap { f -> (1..8).map { "${f}0${it}호" } }
        const val NOT_ADMIN = AdminPass.NOT_ADMIN
        const val NOT_MINE = "이 보드의 침대가 아니에요"
        const val NOT_PLACED_YET = "병원 관리자가 먼저 이 침대를 등록해야 해요"
        const val SAME_ROOM = "같은 병실에서 이미 쓰는 이름이에요"
        // 아래 이유는 규격에 문장이 정해져 있지 않아 보드에서 정한 것입니다
        const val NOT_PLACED = "병원 목록에 없는 침대예요"
        const val NOT_WARD = "병원용 침대가 아니에요"
        const val TAKEN = "다른 폰이 이 침대를 쓰고 있어요"
        const val NOT_REGISTERED = "먼저 침대를 등록해 주세요"
        const val BAD = AppApi.BAD

        /** QR 글(jaljayo://bed/<id>?h=<주소>)이나 직접 넣은 글(<id>@<주소>, <id>)에서 고유 번호만 꺼냅니다. ? 뒤와 @ 뒤(보드 주소)는 무시합니다 */
        fun idOfQr(qr: String): String {
            val t = qr.trim()
            val rest = if (t.startsWith(QR_PREFIX, ignoreCase = true)) t.substring(QR_PREFIX.length) else t
            return rest.substringBefore('?').substringBefore('@').trim().uppercase()
        }

        /** 11/19: QR에 보드 주소(host = IP:포트)를 함께 담습니다. 폰은 이 주소로 보드에 붙은 뒤 bed-find를 보냅니다 */
        fun qrText(id: String, host: String? = null) = QR_PREFIX + id + (host?.let { "?h=$it" } ?: "")

        /** QR 아래에 보여 주는 글(카메라가 없을 때 손으로 넣는 글). 포트가 8765면 뺍니다 */
        fun typedText(id: String, host: String?) = if (host == null) id else "$id@${host.removeSuffix(":8765")}"

        // 헷갈리기 쉬운 글자(0·O, 1·I)를 뺀 32자입니다
        private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

        /** 안드로이드 기기 번호(ANDROID_ID)를 줄인 보드 고유 번호 4자입니다. 같은 기기 번호면 늘 같은 값입니다 */
        fun boardId(androidId: String): String {
            val h = MessageDigest.getInstance("SHA-256").digest(androidId.trim().lowercase().toByteArray())
            var v = ((h[0].toInt() and 0xff) shl 16) or ((h[1].toInt() and 0xff) shl 8) or (h[2].toInt() and 0xff)
            val sb = StringBuilder()
            repeat(4) { sb.append(ALPHABET[v and 31]); v = v shr 5 }
            return sb.toString()
        }
    }
}
