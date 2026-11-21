package com.jaljayo.board.net

import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.security.SecureRandom

// 폰 앱 "병원 관리"의 관리 비밀번호(숫자 6자리). 형식은 docs/interfaces/board-link.md
// admin-login: 맞으면 그 접속을 관리 접속으로 기억합니다. admin-password: 관리 접속에서만 바꿀 수 있습니다.
// 비밀번호는 보드 하나(병원 침대 전체)에 하나이고, 침대마다 두지 않습니다.
// 파일(admin_pass.json)에는 비밀번호 그대로가 아니라 소금값을 섞은 SHA-256 값만 둡니다. 파일이 없으면 처음 값(INITIAL)을 씁니다.
// 연달아 여러 번 틀리면 잠시 받지 않습니다(같은 와이파이에서 숫자를 차례로 넣어 맞히는 일을 막으려는 것입니다).
// C는 폰 접속을 가리키는 값입니다(보드에서는 WebSocket, 시험에서는 아무 값).
class AdminPass<C>(private val file: File?, private val now: () -> Long = System::currentTimeMillis) {
    private var salt = ""
    private var hash = ""
    private val admins = HashSet<C>()
    private var fails = 0
    private var lockedUntil = 0L

    init {
        val o = try { file?.takeIf { it.exists() }?.let { JSONObject(it.readText()) } } catch (_: Exception) { null }
        if (o != null && o.optString("salt").isNotEmpty() && o.optString("hash").isNotEmpty()) { salt = o.getString("salt"); hash = o.getString("hash") }
        else set(INITIAL, save = false)
    }

    /** admin-로 시작하는 요청 중 비밀번호 요청만 처리합니다. 그 밖의 요청이면 null입니다 */
    fun handle(c: C, name: String, body: JSONObject?): JSONObject? = when (name) {
        "admin-login" -> login(c, body?.optString("password", "") ?: "")
        "admin-password" -> change(c, body?.optString("password", "") ?: "")
        else -> null
    }

    /** 접속이 끊기면 관리 접속도 끝납니다 */
    fun left(c: C) { admins.remove(c) }

    fun isAdmin(c: C) = c in admins

    private fun login(c: C, pw: String): JSONObject {
        val t = now()
        if (t < lockedUntil) return no(LOCKED)
        if (matches(pw)) { fails = 0; admins.add(c); return ok() }
        admins.remove(c)
        if (++fails >= MAX_FAILS) { fails = 0; lockedUntil = t + LOCK_MS }
        return no(WRONG)
    }

    private fun change(c: C, pw: String): JSONObject {
        if (c !in admins) return no(NOT_ADMIN)
        if (!SIX_DIGITS.matches(pw)) return no(BAD_FORMAT)
        set(pw, save = true)
        // 바꾸면 다른 직원 폰은 새 비밀번호로 다시 들어와야 합니다. 바꾼 폰은 그대로 둡니다
        admins.retainAll(setOf(c))
        return ok()
    }

    private fun matches(pw: String) = SIX_DIGITS.matches(pw) && MessageDigest.isEqual(digest(salt, pw).toByteArray(), hash.toByteArray())

    private fun set(pw: String, save: Boolean) {
        val b = ByteArray(16).also { SecureRandom().nextBytes(it) }
        salt = b.joinToString("") { "%02x".format(it) }
        hash = digest(salt, pw)
        if (save && file != null) {
            val tmp = File(file.path + ".tmp")
            tmp.writeText(JSONObject().put("salt", salt).put("hash", hash).toString())
            tmp.renameTo(file)
        }
    }

    private fun ok() = JSONObject().put("ok", true)
    private fun no(why: String) = JSONObject().put("ok", false).put("reason", why)

    companion object {
        // 처음 비밀번호(시연·납품 전 기본값)입니다. 납품할 때 병원마다 admin-password로 바꿔 넣습니다
        const val INITIAL = "123456"
        const val MAX_FAILS = 5
        const val LOCK_MS = 60_000L
        const val WRONG = "비밀번호가 맞지 않아요"
        const val LOCKED = "여러 번 틀려서 잠시 뒤에 다시 넣어 주세요"
        const val NOT_ADMIN = "병원 관리에 먼저 들어와 주세요"
        const val BAD_FORMAT = "비밀번호는 숫자 6자리예요"
        private val SIX_DIGITS = Regex("\\d{6}")

        private fun digest(salt: String, pw: String): String =
            MessageDigest.getInstance("SHA-256").digest((salt + pw).toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
