#!/bin/bash
set -e

echo "🚀 Starting JustRaw Production Setup on H100..."

# 1. System Dependencies
apt-get update && apt-get install -y python3-pip python3-venv ffmpeg git-lfs wget

# 2. Directory Setup
mkdir -p /opt/justraw/models
cd /opt/justraw

# 3. Virtual Environment
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate

# 4. Install AI Engines
echo "📦 Installing AI Engines..."
pip install --upgrade pip setuptools wheel
pip install fastapi uvicorn python-multipart
pip install faster-whisper
pip install vllm==0.6.3.post1
pip install "numpy<2.0.0"
# Official Kokoro
pip install kokoro
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121

# 5. Create the Intelligence Script (Embedded)
cat <<EOF > inference.py
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
import uvicorn
import os
import json
import base64
import torch
import soundfile as sf
import io
import numpy as np
from typing import Optional
from faster_whisper import WhisperModel
from vllm import LLM, SamplingParams
from kokoro import KPipeline
import asyncio

app = FastAPI()

# Security
API_KEY = "5b7b1e1e-5c83-4e49-8605-c7c365d4cef6"

# Status tracking
is_ready = False

# 1. Load Faster-Whisper (STT)
print("Loading Whisper Model...")
whisper_model = WhisperModel("medium", device="cuda", compute_type="float16")

# 2. Load Kokoro TTS (French)
print("Loading Kokoro TTS...")
pipeline = KPipeline(lang_code='f') # 'f' for French

# 3. Load vLLM (DeepSeek 33B)
print("Loading DeepSeek 33B via vLLM...")
llm = LLM(
    model="deepseek-ai/deepseek-coder-33b-instruct", 
    trust_remote_code=True, 
    gpu_memory_utilization=0.80,
    max_model_len=2048,
    tensor_parallel_size=1
)
sampling_params = SamplingParams(temperature=0.7, top_p=0.95, max_tokens=200)

is_ready = True
print("✅ PIERRE IS FULLY INITIALIZED AND READY.")

@app.get("/health")
async def health():
    return {"status": "ready" if is_ready else "loading"}

@app.post("/process")
async def process_audio(
    file: UploadFile = File(...),
    system_prompt: str = Form(""),
    respect_score: str = Form("50"),
    x_api_key: Optional[str] = Header(None)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

    if not is_ready:
        raise HTTPException(status_code=53, detail="Pierre is still waking up...")

    audio_path = f"temp_{file.filename}"
    with open(audio_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        # A. Transcribe (STT)
        segments, info = whisper_model.transcribe(audio_path, beam_size=5)
        user_text = " ".join([segment.text for segment in segments])
        print(f"Transcribed: {user_text}")

        if not user_text.strip():
            user_text = "[Silence]"

        # B. Generate AI Response (LLM)
        full_prompt = f"{system_prompt}\n\nUser: {user_text}\nPierre:"
        outputs = llm.generate([full_prompt], sampling_params)
        ai_text = outputs[0].outputs[0].text.strip()
        print(f"AI Response: {ai_text}")

        # C. Generate Real Voice (TTS)
        generator = pipeline(ai_text, voice='ff_siwis', speed=1.1, split_pattern=r'\n+')
        
        all_audio = []
        for gs, ps, audio in generator:
            all_audio.append(audio)
        
        if not all_audio:
            raise Exception("TTS failed to generate audio")
            
        combined_audio = np.concatenate(all_audio)
        
        wav_buffer = io.BytesIO()
        sf.write(wav_buffer, combined_audio, 24000, format='WAV')
        audio_base64 = "data:audio/wav;base64," + base64.b64encode(wav_buffer.getvalue()).decode()

        respect_change = 0
        if "s'il vous plaît" in user_text.lower() or "merci" in user_text.lower():
            respect_change = 2
        elif len(user_text) < 10 and len(user_text.strip()) > 0:
            respect_change = -1

        return {
            "transcription": user_text,
            "aiResponse": ai_text,
            "audioBase64": audio_base64,
            "respectChange": respect_change
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF

# 6. Restart Service
echo "🔄 Restarting Service..."
pkill -f uvicorn || true
export VLLM_USE_V1=0
nohup venv/bin/python inference.py > /var/log/justraw_gpu.log 2>&1 &

echo "✅ Deployment successful. Pierre is now gaining a VOICE."
