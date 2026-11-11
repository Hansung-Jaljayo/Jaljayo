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
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
