#!/bin/bash
# 보드 앱에 넣을 음성 모델·라이브러리·실행 파일을 모은다. 레포에는 올리지 않는다(.gitignore)
#  1) 선배 팀 SUDA 앱(보드에서 받은 base.apk)의 받아쓰기·말 구간 모델: SenseVoice(8비트), silero VAD
#  2) sherpa-onnx 공식 목소리 모델: Supertonic 3(8비트, 한국어 여자 목소리 3번을 앱에서 고름)
#  3) sherpa-onnx v2.0.1 공식 안드로이드 배포본의 JNI 라이브러리(Supertonic을 쓰려면 2.0.1 이상)
#  4) llama.cpp 안드로이드 빌드의 llama-server(앱이 lib 폴더에서 실행할 수 있게 lib*.so 이름으로 넣음)
# 사용: tools/fetch_assets.sh <base.apk> <llama-server>
#   2)와 3)은 인터넷에서 받는다. 말 이해 모델(gguf)은 앱에 넣지 않고 보드의 /data/local/tmp/jaljayo_llm/에 따로 둔다.
set -e
APK=$1; LLAMA=$2
REL=https://github.com/k2-fsa/sherpa-onnx/releases/download
cd "$(dirname "$0")/.."
A=app/src/main/assets/models; L=app/src/main/jniLibs/arm64-v8a
rm -rf "$A" "$L"; mkdir -p "$A/asr" "$A/tts_st" "$L"
T=$(mktemp -d)
unzip -q "$APK" 'assets/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/model.int8.onnx' \
  'assets/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/tokens.txt' 'assets/silero_vad.onnx' -d "$T"
cp "$T"/assets/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/{model.int8.onnx,tokens.txt} "$A/asr/"
cp "$T"/assets/silero_vad.onnx "$A/"
curl -sL "$REL/tts-models/sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2" | tar xj -C "$T"
(cd "$T"/sherpa-onnx-supertonic-3-tts-int8-2026-05-11 && cp LICENSE tts.json voice.bin unicode_indexer.bin text_encoder.int8.onnx duration_predictor.int8.onnx vector_estimator.int8.onnx vocoder.int8.onnx "$OLDPWD/$A/tts_st/")
curl -sL "$REL/v2.0.1/sherpa-onnx-v2.0.1-android.tar.bz2" | tar xj -C "$T"
S=$(dirname "$(find "$T" -path '*arm64-v8a/libsherpa-onnx-jni.so' | head -1)")
cp "$S"/libsherpa-onnx-jni.so "$S"/libonnxruntime.so "$L/"
rm -rf "$T"
cp "$LLAMA" "$L/libllama_server.so"
du -sh "$A" "$L"
