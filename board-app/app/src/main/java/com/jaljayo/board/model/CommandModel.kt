package com.jaljayo.board.model

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

// 문장을 넣으면 모델 출력 <maum_N>(...)<maum_end>를 돌려주는 자리.
// 지금은 llama.cpp(CPU)로 돌리고, 마음AI 양자화 모델이 오면 이 자리만 Genie(NPU)로 바꾼다.
interface CommandModel {
    fun start()
    /** asked: 지금 대답을 기다리는 질문(두뇌가 실제로 말한 문장), 없으면 null */
    fun infer(text: String, asked: String? = null, status: String? = null): String
    fun stop()
}

class LlamaServerModel(
    private val binary: File,       // 앱 lib 폴더에 풀린 libllama_server.so
    private val modelPath: String,  // /data/local/tmp/jaljayo_llm/*.gguf
    private val port: Int = 8090,
    private val threads: Int = 4,
) : CommandModel {
    private var proc: Process? = null

    override fun start() {
        if (healthy()) return
        val cmd = listOf(binary.absolutePath, "-m", modelPath, "--host", "127.0.0.1", "--port", "$port",
            "-c", "512", "-t", "$threads", "-sp", "--no-webui")
        Log.i(TAG, "모델 서버 시작: $cmd")
        proc = ProcessBuilder(cmd).redirectErrorStream(true).start()
        Thread { proc?.inputStream?.bufferedReader()?.forEachLine { Log.d(TAG, it) } }.apply { isDaemon = true }.start()
        val until = System.currentTimeMillis() + 120_000
        while (System.currentTimeMillis() < until) {
            if (healthy()) { Log.i(TAG, "모델 서버 준비됨"); return }
            Thread.sleep(500)
        }
        error("모델 서버가 2분 안에 준비되지 않았어요")
    }

    private fun healthy(): Boolean = try {
        val c = URL("http://127.0.0.1:$port/health").openConnection() as HttpURLConnection
        c.connectTimeout = 500; c.readTimeout = 500
        c.responseCode == 200
    } catch (e: Exception) { false }

    override fun infer(text: String, asked: String?, status: String?): String {
        val body = JSONObject()
            .put("prompt", Prompt.build(text, asked, status))
            .put("n_predict", 96).put("temperature", 0).put("top_k", 1)
            .put("stop", JSONArray().put("<maum_end>"))
            // 11/11 보드 측정: 앞부분 설명 문장을 다시 읽지 않게 하면 답은 그대로(12/12)이고 한 번에 약 0.4초 빨라진다
            .put("cache_prompt", true)
        val c = URL("http://127.0.0.1:$port/completion").openConnection() as HttpURLConnection
        c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 2000; c.readTimeout = 30_000
        c.setRequestProperty("Content-Type", "application/json")
        c.outputStream.use { it.write(body.toString().toByteArray()) }
        val res = JSONObject(c.inputStream.bufferedReader().readText())
        val content = res.getString("content").trim()
        val stoppedByWord = res.optString("stop_type") == "word" || res.optString("stopping_word").isNotEmpty()
        return if (stoppedByWord && !content.endsWith("<maum_end>")) "$content<maum_end>" else content
    }

    override fun stop() { proc?.destroy(); proc = null }

    companion object { const val TAG = "JaljayoModel" }
}
