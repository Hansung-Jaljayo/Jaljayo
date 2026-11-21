plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.jaljayo.board"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.jaljayo.board"
        minSdk = 33
        targetSdk = 33
        versionCode = 1
        versionName = "0.1"
        ndk { abiFilters += "arm64-v8a" }
    }
    buildTypes {
        release { isMinifyEnabled = false }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    // llama-server 실행 파일을 lib 폴더에 풀어 두어야 앱이 실행할 수 있다
    packaging { jniLibs { useLegacyPackaging = true } }
    androidResources { noCompress += listOf("onnx", "txt", "json", "bin") }
}

kotlin { jvmToolchain(17) }

dependencies {
    implementation("org.java-websocket:Java-WebSocket:1.6.0")
    // 11/15 병원용 이름 점수(NameScorer): onnxruntime-android 1.28.0의 자바 부분만 쓴다. 네이티브는 sherpa가 가진 1.28.2 libonnxruntime.so를 함께 쓰고,
    // 자바 연결 라이브러리(jniLibs/arm64-v8a/libonnxruntime4j_jni.so)는 버전 꼬리표만 VERS_1.28.0 → VERS_1.28.2로 고친 것(그대로 두면 OrtGetApiBase를 못 찾아 앱이 멈춤)
    implementation(files("libs/onnxruntime-android-1.28.0-classes.jar"))
    // 11/19 병원 침대 QR(보드 화면에 등록 전 침대의 QR을 그림). 자바만으로 된 라이브러리
    implementation("com.google.zxing:core:3.5.3")
    // 11/19 침대 버튼·압력 센서 나노를 보드 USB에 바로 꽂아 읽는다(FTDI·CH34x·CP210x·CDC 칩 드라이버). UsbNano.kt
    implementation("com.github.mik3y:usb-serial-for-android:3.12.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("com.microsoft.onnxruntime:onnxruntime:1.28.0")
}
