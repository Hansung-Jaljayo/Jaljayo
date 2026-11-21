package com.jaljayo.board

import com.jaljayo.board.net.AdminPass
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import java.nio.file.Files

// 11/19: 폰 앱 "병원 관리"의 관리 비밀번호(admin-login, admin-password)를 보드가 답한다
class AdminPassTest {
    private var t = 0L
    private fun dir() = Files.createTempDirectory("admin").toFile()
    private fun pass(f: File? = null) = AdminPass<String>(f) { t }
    private fun pw(p: String) = JSONObject().put("password", p)

    @Test fun initialPasswordLetsIn() {
        val a = pass()
        val r = a.handle("폰1", "admin-login", pw(AdminPass.INITIAL))!!
        assertTrue(r.getBoolean("ok")); assertTrue(a.isAdmin("폰1"))
    }

    @Test fun wrongPasswordIsRefused() {
        val a = pass()
        val r = a.handle("폰1", "admin-login", pw("000000"))!!
        assertFalse(r.getBoolean("ok")); assertEquals(AdminPass.WRONG, r.getString("reason")); assertFalse(a.isAdmin("폰1"))
        assertFalse(a.handle("폰1", "admin-login", pw("12345"))!!.getBoolean("ok"))
        assertFalse(a.handle("폰1", "admin-login", null)!!.getBoolean("ok"))
    }

    @Test fun otherRequestsAreNotHandledHere() {
        assertNull(pass().handle("폰1", "admin-save", JSONObject()))
        assertNull(pass().handle("폰1", "bed-move", JSONObject()))
    }

    @Test fun changeNeedsLoginFirst() {
        val a = pass()
        val r = a.handle("폰1", "admin-password", pw("654321"))!!
        assertFalse(r.getBoolean("ok")); assertEquals(AdminPass.NOT_ADMIN, r.getString("reason"))
        assertTrue(a.handle("폰1", "admin-login", pw(AdminPass.INITIAL))!!.getBoolean("ok"))
    }

    @Test fun changeReplacesPasswordAndSignsOutOtherPhones() {
        val a = pass()
        a.handle("폰1", "admin-login", pw(AdminPass.INITIAL)); a.handle("폰2", "admin-login", pw(AdminPass.INITIAL))
        assertTrue(a.handle("폰1", "admin-password", pw("654321"))!!.getBoolean("ok"))
        assertTrue(a.isAdmin("폰1")); assertFalse(a.isAdmin("폰2"))
        assertFalse(a.handle("폰2", "admin-login", pw(AdminPass.INITIAL))!!.getBoolean("ok"))
        assertTrue(a.handle("폰2", "admin-login", pw("654321"))!!.getBoolean("ok"))
    }

    @Test fun changeRefusesNonSixDigits() {
        val a = pass()
        a.handle("폰1", "admin-login", pw(AdminPass.INITIAL))
        for (bad in listOf("12345", "1234567", "abcdef", "")) {
            val r = a.handle("폰1", "admin-password", pw(bad))!!
            assertFalse(bad, r.getBoolean("ok")); assertEquals(AdminPass.BAD_FORMAT, r.getString("reason"))
        }
        assertTrue(pass().handle("폰1", "admin-login", pw(AdminPass.INITIAL))!!.getBoolean("ok"))
    }

    @Test fun changedPasswordSurvivesRestartWithoutPlainText() {
        val f = File(dir(), "admin_pass.json")
        val a = pass(f)
        assertFalse(f.exists())   // 바꾸기 전에는 파일을 만들지 않는다
        a.handle("폰1", "admin-login", pw(AdminPass.INITIAL))
        a.handle("폰1", "admin-password", pw("246802"))
        assertFalse(f.readText().contains("246802"))
        val b = pass(f)   // 보드를 다시 켠 것
        assertFalse(b.isAdmin("폰1"))
        assertFalse(b.handle("폰1", "admin-login", pw(AdminPass.INITIAL))!!.getBoolean("ok"))
        assertTrue(b.handle("폰1", "admin-login", pw("246802"))!!.getBoolean("ok"))
    }

    @Test fun manyWrongTriesLockForAWhile() {
        val a = pass()
        repeat(AdminPass.MAX_FAILS) { a.handle("폰1", "admin-login", pw("000000")) }
        val r = a.handle("폰1", "admin-login", pw(AdminPass.INITIAL))!!
        assertFalse(r.getBoolean("ok")); assertEquals(AdminPass.LOCKED, r.getString("reason"))
        t += AdminPass.LOCK_MS
        assertTrue(a.handle("폰1", "admin-login", pw(AdminPass.INITIAL))!!.getBoolean("ok"))
    }

    @Test fun leavingEndsAdminSession() {
        val a = pass()
        a.handle("폰1", "admin-login", pw(AdminPass.INITIAL))
        a.left("폰1")
        assertFalse(a.handle("폰1", "admin-password", pw("654321"))!!.getBoolean("ok"))
    }
}
