package com.jaljayo.board

import com.jaljayo.board.brain.Angles
import com.jaljayo.board.brain.BedState
import com.jaljayo.board.brain.Brain
import com.jaljayo.board.brain.Command
import com.jaljayo.board.brain.FruitMatch
import com.jaljayo.board.net.AppApi
import com.jaljayo.board.net.HospitalBeds
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.time.LocalDate
import java.time.LocalTime

// 11/19: 병원 침대 목록(hospital-beds.md)의 요청마다 받는 경우와 거절하는 경우, 이름을 바꾸면 부르는 이름도 따라가는지, 알람 쓰기를 끈 병원
class HospitalBedsTest {
    private val keys = listOf("사과", "포도", "딸기")
    private fun beds(f: File? = null) = HospitalBeds<String>(f, "abc123", keys)
    private fun h(b: HospitalBeds<String>, c: String, name: String, body: JSONObject = JSONObject(), admin: Boolean = true, ward: Boolean = true) = b.handle(c, name, body, admin, ward)!!.reply
    private fun JSONObject.ok() = getBoolean("ok")
    private fun id(b: HospitalBeds<String>, i: Int) = "${b.board}-$i"
    private fun qr(b: HospitalBeds<String>, i: Int) = JSONObject().put("qr", HospitalBeds.qrText(id(b, i)))
    private fun roomQr(b: HospitalBeds<String>) = JSONObject().put("qr", HospitalBeds.qrText(b.board, "192.168.1.2:8765"))
    /** 시연 침대는 처음부터 사과·포도·딸기 이름이 들어 있다(11/19). 예전 시험이 쓰던 이름 붙은 상태 그대로 */
    private fun named(b: HospitalBeds<String>) = b
    /** 병실 QR 흐름 시험용: 시연 침대 이름을 간호사 사용 끝으로 비운다 */
    private fun emptied(b: HospitalBeds<String>): HospitalBeds<String> {
        for (i in 1..3) assertTrue(h(b, "간호사", "admin-end", JSONObject().put("bed", id(b, i))).ok())
        return b
    }

    @Test fun boardIdIsShortAndStable() {
        val a = HospitalBeds.boardId("9774d56d682e549c"); val b = HospitalBeds.boardId("9774d56d682e549c")
        assertEquals(a, b); assertEquals(4, a.length); assertTrue(a.all { it.isUpperCase() || it.isDigit() })
        assertNotEquals(a, HospitalBeds.boardId("1234567890abcdef"))
        assertEquals(listOf("${a}-1", "${a}-2", "${a}-3"), HospitalBeds<String>(null, "9774d56d682e549c", keys).slots.filter { !it.sample }.map { it.id })
    }

    // 11/19: 시연 침대(201호 1·2·3번)는 사과·포도·딸기 이름으로 시작해 바로 불러 시연하고, 다른 병실에는 이름 있는 보기용 침대가 있다
    @Test fun demoStartsPlacedAt201() {
        val b = beds()
        val r = h(b, "간호사", "admin-list")
        assertTrue(r.ok())
        val arr = r.getJSONArray("beds")
        assertEquals(3 + HospitalBeds.SAMPLES.size, arr.length())
        for (i in 0 until 3) {
            val o = arr.getJSONObject(i)
            assertEquals(id(b, i + 1), o.getString("id")); assertEquals("201호", o.getString("room")); assertEquals(i + 1, o.getInt("no"))
            assertEquals(keys[i], o.getString("name")); assertFalse(o.getBoolean("phone"))
        }
        for (i in 3 until arr.length()) { val o = arr.getJSONObject(i); assertNotEquals("201호", o.getString("room")); assertFalse(o.isNull("name")); assertTrue(o.getBoolean("phone")) }
        assertTrue(r.getJSONArray("rooms").toList().containsAll(listOf("201호", "308호")))
        assertTrue(b.unplaced().isEmpty())
        assertEquals("사과", b.keyOfCall("사과")); assertEquals("딸기", b.callOf("딸기"))
        // 보기용 침대는 불러도 대답하지 않는다
        assertNull(b.keyOfCall("바나나"))
    }

    @Test fun adminRequestsNeedLogin() {
        val b = beds()
        for (n in HospitalBeds.ADMIN) {
            val r = h(b, "폰", n, admin = false)
            assertFalse(r.ok()); assertEquals("병원 관리에 먼저 들어와 주세요", r.getString("reason"))
        }
        assertNull(b.handle("폰", "admin-login", JSONObject(), false, true))   // 비밀번호는 AdminPass가 답함
        assertNull(b.handle("폰", "bed-move", JSONObject(), true, true))
    }

    @Test fun removeThenAddAgain() {
        val b = named(beds())
        val rm = b.handle("간호사", "admin-remove", JSONObject().put("bed", id(b, 2)), true, true)!!
        assertTrue(rm.reply.ok()); assertEquals(listOf("포도"), rm.clear); assertTrue(rm.names)
        assertEquals(listOf(id(b, 2)), b.unplaced().map { it.id })
        assertNull(b.keyOfCall("포도"))
        assertEquals(2 + HospitalBeds.SAMPLES.size, h(b, "간호사", "admin-list").getJSONArray("beds").length())
        // 자리가 차 있으면 거절
        val full = h(b, "간호사", "admin-add", qr(b, 2).put("room", "201호").put("no", 1))
        assertFalse(full.ok()); assertEquals("201호 1번에는 이미 침대가 있어요", full.getString("reason"))
        // 다른 보드의 침대
        val other = h(b, "간호사", "admin-add", JSONObject().put("qr", "jaljayo://bed/ZZZZ-1").put("room", "202호").put("no", 1))
        assertEquals("이 보드의 침대가 아니에요", other.getString("reason"))
        // 고유 번호를 직접 넣어도(소문자도) 받는다
        val ok = h(b, "간호사", "admin-add", JSONObject().put("qr", id(b, 2).lowercase()).put("room", "202호").put("no", 3))
        assertTrue(ok.ok())
        val bed = ok.getJSONObject("bed")
        assertEquals(id(b, 2), bed.getString("id")); assertEquals("202호", bed.getString("room")); assertEquals(3, bed.getInt("no")); assertTrue(bed.isNull("name"))
        // 이미 등록된 침대
        val again = h(b, "간호사", "admin-add", qr(b, 2).put("room", "203호").put("no", 1))
        assertEquals("이미 등록된 침대예요(202호 3번)", again.getString("reason"))
        assertTrue(b.unplaced().isEmpty())
        // 잘못된 칸
        assertEquals(AppApi.BAD, h(b, "간호사", "admin-add", qr(b, 1).put("room", "").put("no", 1)).getString("reason"))
    }

    @Test fun moveRefusesTakenSpotAndClearsSameName() {
        val b = named(beds())
        val taken = h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 1)).put("room", "201호").put("no", 2))
        assertFalse(taken.ok()); assertEquals("201호 2번에는 이미 침대가 있어요", taken.getString("reason"))
        // 보기용 침대가 있는 자리도 찬 자리
        assertEquals("202호 1번에는 이미 침대가 있어요", h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 1)).put("room", "202호").put("no", 1)).getString("reason"))
        // 포도를 206호로 옮기고, 사과 침대를 206호로 옮겨도 이름이 겹치지 않으면 그대로
        assertTrue(h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 2)).put("room", "206호").put("no", 1)).ok())
        val apple = h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 1)).put("room", "206호").put("no", 2))
        assertTrue(apple.ok()); assertFalse(apple.has("nameCleared")); assertEquals("사과", apple.getJSONObject("bed").getString("name"))
        // 딸기 침대를 207호로 옮겨 이름을 사과로 바꾼 뒤(207호에는 사과가 없음) 206호로 옮기면 이름이 비워진다
        assertTrue(h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 3)).put("room", "207호").put("no", 1)).ok())
        b.hello("환자", id(b, 3))
        assertTrue(h(b, "환자", "name-save", JSONObject().put("name", "사과")).ok())
        val clash = b.handle("간호사", "admin-move", JSONObject().put("bed", id(b, 3)).put("room", "206호").put("no", 3), true, true)!!
        assertTrue(clash.reply.ok()); assertTrue(clash.reply.getBoolean("nameCleared")); assertTrue(clash.reply.getJSONObject("bed").isNull("name")); assertTrue(clash.names)
        assertNull(b.callOf("딸기"))
        assertEquals("사과", b.keyOfCall("사과"))   // 206호 2번(사과 칸)만 사과로 대답
        // 목록에 없는 침대
        h(b, "간호사", "admin-remove", JSONObject().put("bed", id(b, 2)))
        assertEquals(HospitalBeds.NOT_PLACED, h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 2)).put("room", "203호").put("no", 1)).getString("reason"))
        assertEquals("이 보드의 침대가 아니에요", h(b, "간호사", "admin-move", JSONObject().put("bed", "ZZZZ-9").put("room", "203호").put("no", 1)).getString("reason"))
    }

    @Test fun endClearsNameAndDisconnectsPatient() {
        val b = named(beds())
        assertEquals("사과", b.hello("환자폰", "사과"))
        assertEquals("사과", b.keyOf("환자폰"))
        assertTrue(h(b, "간호사", "admin-list").getJSONArray("beds").getJSONObject(0).getBoolean("phone"))
        val out = b.handle("간호사", "admin-end", JSONObject().put("bed", id(b, 1)), true, true)!!
        assertTrue(out.reply.ok()); assertEquals(listOf("사과"), out.clear); assertEquals(listOf("환자폰"), out.close)
        assertNull(b.keyOf("환자폰")); assertNull(b.keyOfCall("사과")); assertNull(b.callOf("사과"))
        val bed = h(b, "간호사", "admin-list").getJSONArray("beds").getJSONObject(0)
        assertEquals("201호", bed.getString("room")); assertEquals(1, bed.getInt("no")); assertTrue(bed.isNull("name")); assertFalse(bed.getBoolean("phone"))
        // 같은 폰이 관리자이면서 환자 폰이면 떼기만 하고 끊지 않는다(답을 받아야 함)
        b.hello("둘다", id(b, 2))
        val self = b.handle("둘다", "admin-end", JSONObject().put("bed", id(b, 2)), true, true)!!
        assertTrue(self.close.isEmpty()); assertNull(b.keyOf("둘다"))
        // 이름이 없어진 침대에는 예전 이름으로 hello해도 붙지 않는다
        assertNull(b.hello("환자폰", "사과"))
    }

    @Test fun removeAlsoDisconnects() {
        val b = beds()
        b.hello("환자폰", id(b, 3))
        val out = b.handle("간호사", "admin-remove", JSONObject().put("bed", id(b, 3)), true, true)!!
        assertEquals(listOf("환자폰"), out.close); assertEquals(listOf("딸기"), out.clear)
        assertEquals("이 보드의 침대가 아니에요", h(b, "간호사", "admin-remove", JSONObject().put("bed", "ZZZZ-1")).getString("reason"))
    }

    @Test fun saveSettings() {
        val b = beds()
        val body = JSONObject().put("night", JSONObject().put("on", true).put("from", 22 * 60).put("to", 6 * 60)).put("alarm", false).put("beds", org.json.JSONArray())
        val out = b.handle("간호사", "admin-save", body, true, true)!!
        assertTrue(out.reply.ok()); assertEquals(0, out.reply.getJSONArray("missing").length()); assertTrue(out.settings)
        assertFalse(b.alarm); assertTrue(b.night.on)
        assertTrue(b.nightAt(LocalTime.of(23, 0))); assertTrue(b.nightAt(LocalTime.of(5, 59))); assertFalse(b.nightAt(LocalTime.of(6, 0))); assertFalse(b.nightAt(LocalTime.of(21, 59)))
        // 같은 날 안의 밤 시간
        h(b, "간호사", "admin-save", JSONObject().put("night", JSONObject().put("on", true).put("from", 60).put("to", 120)).put("alarm", true))
        assertTrue(b.nightAt(LocalTime.of(1, 30))); assertFalse(b.nightAt(LocalTime.of(2, 0))); assertTrue(b.alarm)
        h(b, "간호사", "admin-save", JSONObject().put("night", JSONObject().put("on", false).put("from", 60).put("to", 120)).put("alarm", true))
        assertFalse(b.nightAt(LocalTime.of(1, 30)))
        // 칸이 빠지거나 틀리면 거절하고 값은 그대로
        assertEquals(AppApi.BAD, h(b, "간호사", "admin-save", JSONObject().put("alarm", false)).getString("reason"))
        assertEquals(AppApi.BAD, h(b, "간호사", "admin-save", JSONObject().put("night", JSONObject().put("on", true).put("from", 2000).put("to", 0)).put("alarm", false)).getString("reason"))
        assertTrue(b.alarm)
    }

    @Test fun findAndRegister() {
        val b = named(beds())
        // 가정용은 예전 답 그대로
        val home = h(b, "폰", "bed-find", qr(b, 1), ward = false)
        assertTrue(home.ok()); assertFalse(home.getBoolean("ward")); assertEquals("잘자요", home.getString("name"))
        assertEquals("잘자요", h(b, "폰", "bed-register", qr(b, 1), ward = false).getString("name"))
        assertEquals("이 보드의 침대가 아니에요", h(b, "폰", "bed-find", JSONObject().put("qr", "jaljayo://bed/ZZZZ-1")).getString("reason"))
        val f = h(b, "폰1", "bed-find", qr(b, 2))
        assertTrue(f.ok()); assertEquals(id(b, 2), f.getString("id")); assertTrue(f.getBoolean("ward")); assertTrue(f.getBoolean("placed"))
        assertEquals("201호", f.getString("room")); assertEquals(2, f.getInt("no")); assertEquals("포도", f.getString("name")); assertFalse(f.getBoolean("taken"))
        val r = b.handle("폰1", "bed-register", qr(b, 2).put("replace", false), false, true)!!
        assertTrue(r.reply.ok()); assertEquals(id(b, 2), r.reply.getString("id")); assertEquals("201호", r.reply.getString("room")); assertEquals(2, r.reply.getInt("no"))
        assertEquals(setOf("사과", "딸기"), r.reply.getJSONArray("used").toList().toSet())   // 자기 이름은 빼고
        assertEquals("포도", b.keyOf("폰1"))
        // 다른 폰이 찾으면 쓰는 중이고, replace 없이 등록하면 거절, replace면 바꾸고 앞 폰을 끊는다
        assertTrue(h(b, "폰2", "bed-find", qr(b, 2)).getBoolean("taken"))
        assertFalse(h(b, "폰1", "bed-find", qr(b, 2)).getBoolean("taken"))
        assertEquals(HospitalBeds.TAKEN, h(b, "폰2", "bed-register", qr(b, 2).put("replace", false)).getString("reason"))
        val rep = b.handle("폰2", "bed-register", qr(b, 2).put("replace", true), false, true)!!
        assertTrue(rep.reply.ok()); assertEquals(listOf("폰1"), rep.close); assertNull(b.keyOf("폰1")); assertEquals("포도", b.keyOf("폰2"))
        // 등록 전 침대
        h(b, "간호사", "admin-remove", JSONObject().put("bed", id(b, 3)))
        val nf = h(b, "폰3", "bed-find", qr(b, 3))
        assertTrue(nf.ok()); assertFalse(nf.getBoolean("placed")); assertTrue(nf.isNull("room")); assertTrue(nf.isNull("no")); assertTrue(nf.isNull("name"))
        assertEquals("병원 관리자가 먼저 이 침대를 등록해야 해요", h(b, "폰3", "bed-register", qr(b, 3).put("replace", false)).getString("reason"))
    }

    // 시연 병실(201호) 밖의 침대는 이름을 바꿔도 같은 칸이 그 이름으로 대답한다
    @Test fun nameSaveMovesNameCalling() {
        val b = named(beds())
        assertEquals(HospitalBeds.NOT_REGISTERED, h(b, "폰", "name-save", JSONObject().put("name", "키위")).getString("reason"))
        assertTrue(h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 1)).put("room", "204호").put("no", 1)).ok())
        assertTrue(h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 2)).put("room", "204호").put("no", 2)).ok())
        assertTrue(h(b, "폰", "bed-register", qr(b, 1).put("replace", false)).ok())
        assertEquals("같은 병실에서 이미 쓰는 이름이에요", h(b, "폰", "name-save", JSONObject().put("name", "포도")).getString("reason"))
        assertEquals(AppApi.BAD, h(b, "폰", "name-save", JSONObject().put("name", "사과나무")).getString("reason"))
        val out = b.handle("폰", "name-save", JSONObject().put("name", "키위"), false, true)!!
        assertTrue(out.reply.ok()); assertTrue(out.names)
        // 키위로 부르면 사과 칸(key 사과)이 대답하고, 사과로 부르면 아무 침대도 대답하지 않는다
        assertEquals("사과", b.keyOfCall("키위")); assertNull(b.keyOfCall("사과")); assertEquals("키위", b.callOf("사과"))
        // 받아쓴 말에서 찾은 과일 → 침대
        assertEquals("사과", FruitMatch.match("키위 침대")?.fruit?.let { b.keyOfCall(it) })
        assertNull(FruitMatch.match("사과 침대")?.fruit?.let { b.keyOfCall(it) })
        // 자기 이름을 다시 골라도 된다
        assertTrue(h(b, "폰", "name-save", JSONObject().put("name", "키위")).ok())
        // 가정용은 받지 않음
        assertEquals(HospitalBeds.NOT_WARD, h(b, "폰", "name-save", JSONObject().put("name", "키위"), ward = false).getString("reason"))
        // 이름을 묻는 말에는 부르는 이름으로 대답한다
        val s = BedState(ward = true, name = "사과", call = "키위")
        assertEquals("저는 키위 침대예요", Brain { 1_800_000_000_000L }.handle(s, "이름이 뭐야", Command("maum_4", "tell_name", emptyMap()), "").say)
    }

    @Test fun adminRequestsInHomeModeAreRefused() {
        val b = HospitalBeds<String>(null, "abc", emptyList())
        assertTrue(b.slots.isEmpty())
        assertEquals(HospitalBeds.NOT_WARD, h(b, "간호사", "admin-list", ward = false).getString("reason"))
    }

    @Test fun savedToFileAndReadBack() {
        val f = File(Files.createTempDirectory("hosp").toFile(), "hospital_beds.json")
        val b = beds(f)
        h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 3)).put("room", "305호").put("no", 4))
        h(b, "간호사", "admin-save", JSONObject().put("night", JSONObject().put("on", true).put("from", 21 * 60).put("to", 7 * 60)).put("alarm", false))
        h(b, "간호사", "admin-remove", JSONObject().put("bed", id(b, 2)))
        val again = HospitalBeds<String>(f, "다른 기기 번호여도 저장된 번호를 씀", keys)
        assertEquals(b.board, again.board)
        assertEquals(b.slots, again.slots)
        assertFalse(again.alarm); assertEquals(HospitalBeds.Night(true, 21 * 60, 7 * 60), again.night)
        assertFalse(File(f.path + ".tmp").exists())
        // 맡은 침대가 바뀌면 처음 상태로
        again.realign(listOf("수박"))
        assertEquals(HospitalBeds.Slot("${b.board}-1", "수박", "201호", 1, "수박"), again.slots.first())
        assertEquals(1 + HospitalBeds.SAMPLES.size, again.slots.size)
    }

    @Test fun alarmSaveRefusedWhenHospitalTurnsAlarmsOff() {
        val api = AppApi()
        val today = LocalDate.of(2026, 11, 19)
        val draft = JSONObject().put("time", 420).put("days", org.json.JSONArray()).put("way", "basic").put("dateOff", 1)
        val no = api.handle(BedState(), "alarm-save", JSONObject().put("id", JSONObject.NULL).put("draft", draft), today, emptyMap(), alarmsAllowed = false)
        assertFalse(no.reply!!.getBoolean("ok")); assertEquals("이 병원에서는 알람을 쓰지 않아요", no.reply!!.getString("reason")); assertTrue(no.state.alarms.isEmpty())
        val yes = api.handle(BedState(), "alarm-save", JSONObject().put("id", JSONObject.NULL).put("draft", draft), today, emptyMap())
        assertTrue(yes.reply!!.getBoolean("ok")); assertEquals(1, yes.state.alarms.size)
        // 켜고 끄기와 지우기는 받는다. 예약도 그대로 받는다
        val s = yes.state
        assertTrue(api.handle(s, "alarm-save", JSONObject().put("id", 1).put("draft", JSONObject.NULL).put("on", false), today, emptyMap(), alarmsAllowed = false).reply!!.getBoolean("ok"))
        assertTrue(api.handle(s, "alarm-delete", JSONObject().put("id", 1), today, emptyMap(), alarmsAllowed = false).reply!!.getBoolean("ok"))
        assertTrue(api.handle(s, "resv-save", JSONObject().put("time", 600).put("off", 1).put("purpose", "sleep").put("head", 0).put("leg", 0), today, emptyMap(), alarmsAllowed = false).reply!!.getBoolean("ok"))
        // 병원 침대 요청은 AppApi가 답하지 않는다(HospitalBeds가 먼저 받음)
        assertNull(api.handle(s, "bed-find", JSONObject(), today, emptyMap()).reply)
        assertEquals(Angles(0.0, 0.0), s.angles)
        // 말로 하는 알람 중 새로 만드는 명령만 막는다(보드 앱이 "이 병원에서는 알람을 쓰지 않아요"로 대답)
        assertTrue(Brain.makesAlarm(Command("maum_1", "set", emptyMap())))
        assertTrue(Brain.makesAlarm(Command("maum_1", "enable", mapOf("create" to "yes"))))
        assertFalse(Brain.makesAlarm(Command("maum_1", "enable", mapOf("create" to "no"))))
        assertFalse(Brain.makesAlarm(Command("maum_1", "delete", emptyMap())))
        assertFalse(Brain.makesAlarm(Command("maum_0", "reserve", emptyMap())))
        assertEquals("이 병원에서는 알람을 쓰지 않아요", AppApi.NO_ALARM)
    }

    private fun org.json.JSONArray.toList() = (0 until length()).map { get(it) }

    // 11/19 데모 시연 "첫 화면에서 시작하기": 환자 폰이 떨어진다. 로그인 없이 된다.
    // 시연 병실(201호) 침대는 이름을 지우지 않고(불러서 시연), 다른 병실 침대는 이름을 비운다
    @Test fun bedReleaseClearsOnlyOwnBed() {
        val b = named(beds())
        assertEquals("사과", b.hello("폰", id(b, 1)))
        val keep = b.handle("폰", "bed-release", JSONObject(), false, true)!!
        assertTrue(keep.reply.ok()); assertTrue(keep.clear.isEmpty())
        assertEquals("사과", b.slots[0].name); assertNull(b.keyOf("폰"))
        assertTrue(h(b, "간호사", "admin-move", JSONObject().put("bed", id(b, 1)).put("room", "204호").put("no", 1)).ok())
        assertEquals("사과", b.hello("폰", id(b, 1)))
        val out = b.handle("폰", "bed-release", JSONObject(), false, true)!!
        assertTrue(out.reply.ok()); assertEquals(listOf("사과"), out.clear); assertTrue(out.names)
        assertNull(b.slots[0].name); assertEquals("포도", b.slots[1].name)
        assertNull(b.keyOf("폰"))
        // 붙은 침대가 없으면 아무것도 지우지 않고 ok
        val none = b.handle("폰", "bed-release", JSONObject(), false, true)!!
        assertTrue(none.reply.ok()); assertTrue(none.clear.isEmpty())
    }

    // 11/19: 보드 화면 QR은 병실 QR 하나. 사과·포도·딸기 중 고른 이름의 침대에 붙고, 다른 과일이면 시연 화면에 없는 침대(조작·대답 없음)
    @Test fun roomQrPicksBedByName() {
        val b = emptied(beds())
        val f = h(b, "폰1", "bed-find", roomQr(b), admin = false)
        assertTrue(f.ok()); assertEquals(b.board, f.getString("id")); assertEquals("201호", f.getString("room")); assertFalse(f.getBoolean("taken")); assertTrue(f.isNull("name"))
        val r = h(b, "폰1", "bed-register", roomQr(b), admin = false)
        assertTrue(r.ok()); assertEquals(0, r.getJSONArray("used").length()); assertTrue(r.isNull("name"))
        assertTrue(b.detached("폰1")); assertNull(b.keyOf("폰1"))
        val p = h(b, "폰1", "name-save", JSONObject().put("name", "포도"), admin = false)
        assertTrue(p.ok()); assertEquals(id(b, 2), p.getString("id"))
        assertEquals("포도", b.keyOf("폰1")); assertFalse(b.detached("폰1")); assertEquals("포도", b.keyOfCall("포도"))
        // 두 번째 폰: 포도는 막히고, 망고는 시연 화면에 없는 침대로
        assertEquals(listOf("포도"), h(b, "폰2", "bed-register", roomQr(b), admin = false).getJSONArray("used").toList())
        assertEquals(HospitalBeds.SAME_ROOM, h(b, "폰2", "name-save", JSONObject().put("name", "포도"), admin = false).getString("reason"))
        val m = h(b, "폰2", "name-save", JSONObject().put("name", "망고"), admin = false)
        assertTrue(m.ok()); assertEquals("${b.board}-X-망고", m.getString("id"))
        assertTrue(b.detached("폰2")); assertNull(b.keyOf("폰2")); assertNull(b.keyOfCall("망고"))
        assertEquals(setOf("포도", "망고"), h(b, "폰3", "bed-register", roomQr(b), admin = false).getJSONArray("used").toList().toSet())
        // 폰1이 사과로 바꾸면 포도 침대 이름은 비고 사과 침대에 붙는다
        assertTrue(h(b, "폰1", "name-save", JSONObject().put("name", "사과"), admin = false).ok())
        assertNull(b.slots[1].name); assertEquals("사과", b.slots[0].name); assertEquals("사과", b.keyOf("폰1"))
        // 같은 폰이 병실 QR을 다시 찍으면 쓰던 침대 이름을 비우고 새로 고른다
        assertTrue(h(b, "폰1", "bed-register", roomQr(b), admin = false).ok())
        assertNull(b.slots[0].name); assertTrue(b.detached("폰1"))
        // 앱을 다시 켜서 저장한 번호로 붙으면 그대로
        b.left("폰2")
        assertNull(b.hello("폰2", "${b.board}-X-망고")); assertTrue(b.detached("폰2"))
        assertTrue(h(b, "폰1", "name-save", JSONObject().put("name", "딸기"), admin = false).ok()); b.left("폰1")
        assertEquals("딸기", b.hello("폰1", id(b, 3)))
        // 사용 끝(bed-release)이면 떨어진다
        assertTrue(h(b, "폰2", "bed-release", admin = false).ok()); assertFalse(b.detached("폰2"))
    }
}
