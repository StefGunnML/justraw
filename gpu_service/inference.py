from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
import uvicorn
import os
import json
import base64
import torch
from typing import Optional
from faster_whisper import WhisperModel
from vllm import LLM, SamplingParams
import asyncio

app = FastAPI()

# Security
API_KEY = os.getenv("API_KEY", "5b7b1e1e-5c83-4e49-8605-c7c365d4cef6")

# 1. Load Faster-Whisper (STT)
# Using 'medium' for a good balance of speed/accuracy
print("Loading Whisper Model...")
whisper_model = WhisperModel("medium", device="cuda", compute_type="float16")

# 2. Load vLLM (DeepSeek 33B)
# Note: We use quantization if needed, but H100 has 80GB. 
# DeepSeek 33B FP16 is ~66GB, fits perfectly.
print("Loading DeepSeek 33B via vLLM...")
# Optimization: use --model-type chat if possible, but vLLM usually detects it
llm = LLM(
    model="deepseek-ai/deepseek-llm-33b-chat", 
    trust_remote_code=True, 
    gpu_memory_utilization=0.9,
    max_model_len=4096
)
sampling_params = SamplingParams(temperature=0.7, top_p=0.95, max_tokens=200)

@app.post("/process")
async def process_audio(
    file: UploadFile = File(...),
    system_prompt: str = Form(""),
    respect_score: str = Form("50"),
    x_api_key: Optional[str] = Header(None)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

    # 1. Save uploaded file
    audio_path = f"temp_{file.filename}"
    with open(audio_path, "wb") as buffer:
        buffer.write(await file.read())

    try:
        # 2. Transcribe (STT)
        segments, info = whisper_model.transcribe(audio_path, beam_size=5)
        user_text = " ".join([segment.text for segment in segments])
        print(f"Transcribed: {user_text}")

        if not user_text.strip():
            user_text = "[Silence]"

        # 3. Generate AI Response (LLM)
        full_prompt = f"{system_prompt}\n\nUser: {user_text}\nPierre:"
        outputs = llm.generate([full_prompt], sampling_params)
        ai_text = outputs[0].outputs[0].text.strip()
        print(f"AI Response: {ai_text}")

        # 4. Mock TTS (Wait for Kokoro integration)
        # For now, we return a beep or silent WAV as a placeholder
        # In the next step we will add the real Kokoro pipeline
        AUDIBLE_BEEP = "data:audio/wav;base64,UklGRl9vT1RKdmVyc2lvbgEAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAABvT1RK"

        # Simple respect change logic based on keywords
        respect_change = 0
        if "s'il vous plaît" in user_text.lower() or "merci" in user_text.lower():
            respect_change = 2
        elif len(user_text) < 10 and len(user_text.strip()) > 0:
            respect_change = -1

        return {
            "transcription": user_text,
            "aiResponse": ai_text,
            "audioBase64": AUDIBLE_BEEP, 
            "respectChange": respect_change
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
