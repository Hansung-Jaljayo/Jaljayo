package com.jaljayo.board.net

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import com.hoho.android.usbserial.driver.CdcAcmSerialDriver
import com.hoho.android.usbserial.driver.Ch34xSerialDriver
import com.hoho.android.usbserial.driver.Cp21xxSerialDriver
import com.hoho.android.usbserial.driver.FtdiSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialDriver
import com.hoho.android.usbserial.driver.UsbSerialPort
import com.hoho.android.usbserial.driver.UsbSerialProber

/**
 * 11/19 보드 USB(허브)에 바로 꽂은 침대 버튼·압력 센서 나노를 읽습니다. 맥 중계(firmware/bridge/nano_bridge.py) 없이 보드 혼자 받습니다.
 * - USB 직렬 칩은 FTDI·CH34x·CP210x·CDC(정품 아두이노)만 찾습니다. 같은 허브의 USB 사운드카드·마우스는 건드리지 않습니다.
 * - 처음에는 안드로이드가 USB 사용 허락을 묻습니다. 허락하면 115200bps 8N1로 열고 따로 도는 줄에서 한 줄씩 읽어 onLine으로 넘깁니다.
 * - 뽑으면 닫고 기다렸다가 다시 꽂으면 다시 엽니다. 어떤 오류가 나도 앱을 멈추지 않고 기록만 남깁니다.
 * onLine·log는 읽는 줄(나노 읽기)에서 불리므로 받는 쪽이 자기 줄로 옮겨 처리해야 합니다.
 */
class UsbNano(private val ctx: Context, private val log: (String) -> Unit, private val onLine: (String) -> Unit) {
    private val usb = ctx.getSystemService(UsbManager::class.java)
    private val thread = HandlerThread("usb-nano").also { it.start() }
    private val h = Handler(thread.looper)
    private val prober = UsbSerialProber.getDefaultProber()
    @Volatile private var port: UsbSerialPort? = null
    @Volatile private var openDevice: String? = null
    @Volatile private var reader: Thread? = null
    @Volatile private var stopped = false
    private var asked: String? = null   // 허락을 물어보고 답을 기다리는 장치(같은 창을 여러 번 띄우지 않기 위해)
    private var missingLogged = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            val dev = i.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
            when (i.action) {
                // 꽂힌 직후에는 안드로이드가 "앱을 열까요" 창을 먼저 띄울 수 있어 잠깐 기다렸다가 봅니다
                UsbManager.ACTION_USB_DEVICE_ATTACHED -> h.postDelayed({ missingLogged = false; scan() }, 1500)
                UsbManager.ACTION_USB_DEVICE_DETACHED -> if (dev != null && dev.deviceName == openDevice) h.post { close("나노 끊김(USB 뽑힘)") }
                ACTION_PERMISSION -> h.post {
                    asked = null
                    if (i.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)) scan()
                    else log("나노 USB 사용을 허락하지 않아 읽지 않아요. 나노를 다시 꽂으면 다시 물어봐요")
                }
            }
        }
    }

    fun start() {
        if (usb == null) { log("이 보드는 USB 장치를 읽을 수 없어 나노를 쓰지 않아요"); return }
        val f = IntentFilter().apply { addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED); addAction(UsbManager.ACTION_USB_DEVICE_DETACHED); addAction(ACTION_PERMISSION) }
        try { ctx.registerReceiver(receiver, f, Context.RECEIVER_NOT_EXPORTED) } catch (e: Exception) { Log.w(TAG, "USB 알림 받기 실패", e) }
        h.post { scan() }
    }

    fun stop() {
        stopped = true
        try { ctx.unregisterReceiver(receiver) } catch (_: Exception) {}
        h.post { close(null); thread.quitSafely() }
    }

    /** 꽂힌 나노를 찾아 허락을 받았으면 열고, 아니면 허락을 묻습니다. 나노 읽기 줄(h)에서만 부릅니다 */
    private fun scan() {
        if (stopped || port != null) return
        try {
            val drv = findNano()
            if (drv == null) { if (!missingLogged) { missingLogged = true; Log.i(TAG, "꽂힌 나노가 없어요") }; return }
            val dev = drv.device
            if (!usb.hasPermission(dev)) {
                if (asked == dev.deviceName) return
                asked = dev.deviceName
                val pi = PendingIntent.getBroadcast(ctx, 0, Intent(ACTION_PERMISSION).setPackage(ctx.packageName), PendingIntent.FLAG_MUTABLE)
                usb.requestPermission(dev, pi)
                log("나노 USB 사용 허락을 묻는 중(보드 화면에서 확인을 눌러 주세요)")
                return
            }
            open(drv)
        } catch (e: Exception) {
            Log.w(TAG, "나노 찾기 실패", e); log("나노 찾기 실패: ${e.message}")
        }
    }

    private fun findNano(): UsbSerialDriver? = prober.findAllDrivers(usb).firstOrNull {
        it is FtdiSerialDriver || it is Ch34xSerialDriver || it is Cp21xxSerialDriver || it is CdcAcmSerialDriver
    }

    private fun open(drv: UsbSerialDriver) {
        val dev = drv.device
        val conn = usb.openDevice(dev) ?: run { log("나노를 열지 못했어요(허락은 있음). 다시 꽂아 주세요"); return }
        val p = drv.ports.firstOrNull() ?: run { conn.close(); return }
        try {
            p.open(conn)
            p.setParameters(115200, 8, UsbSerialPort.STOPBITS_1, UsbSerialPort.PARITY_NONE)
            try { p.dtr = true; p.rts = true } catch (_: Exception) {}   // CDC 칩은 DTR이 켜져야 보내는 경우가 있습니다(FTDI 나노는 이때 한 번 다시 켜지고 READY를 보냅니다)
        } catch (e: Exception) {
            try { p.close() } catch (_: Exception) {}
            Log.w(TAG, "나노 열기 실패", e); log("나노 열기 실패: ${e.message}"); return
        }
        port = p; openDevice = dev.deviceName
        log("나노 연결됨(${drv.javaClass.simpleName.removeSuffix("SerialDriver")}, ${dev.deviceName})")
        reader = Thread({ readLoop(p) }, "usb-nano-read").also { it.isDaemon = true; it.start() }
    }

    private fun readLoop(p: UsbSerialPort) {
        val buf = ByteArray(256)
        val lines = NanoLines.Buffer()
        try {
            while (!stopped && port === p) {
                val n = p.read(buf, 200)
                if (n <= 0) continue
                for (line in lines.feed(buf, n)) {
                    try { onLine(line) } catch (e: Exception) { Log.w(TAG, "나노 글 처리 실패: $line", e) }
                }
            }
        } catch (e: Exception) {
            if (!stopped && port === p) {
                Log.w(TAG, "나노 읽기 실패", e)
                h.post { close("나노 끊김(${e.message ?: "읽기 실패"})") }
                h.postDelayed({ scan() }, 2000)   // 뽑힌 것이 아니라 잠깐 오류면 다시 엽니다(뽑혔으면 찾지 못하고 꽂힐 때까지 기다림)
            }
        }
    }

    private fun close(why: String?) {
        val p = port ?: return
        port = null; openDevice = null
        try { p.close() } catch (_: Exception) {}
        reader = null
        if (why != null) log(why)
    }

    companion object {
        const val TAG = "JaljayoNano"
        private const val ACTION_PERMISSION = "com.jaljayo.board.USB_NANO_PERMISSION"
    }
}
