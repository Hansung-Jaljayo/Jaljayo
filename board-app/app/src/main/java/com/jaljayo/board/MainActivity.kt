package com.jaljayo.board

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

// 보드 앱의 첫 화면. 실제 제품에는 화면이 없고, 여기서는 켜기와 최근 기록 보기만 한다
class MainActivity : Activity() {
    private lateinit var log: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        log = TextView(this).apply { textSize = 18f; setPadding(32, 32, 32, 32) }
        setContentView(ScrollView(this).apply { addView(log) })
        log.text = Status.text()
        Status.onChange = { t -> runOnUiThread { log.text = t } }
        val need = arrayOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS)
            .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (need.isEmpty()) startBoard() else requestPermissions(need.toTypedArray(), 1)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startBoard()
        else Status.post("마이크 권한이 없어 시작하지 못했어요")
    }

    private fun startBoard() = startForegroundService(Intent(this, BoardService::class.java))
}
