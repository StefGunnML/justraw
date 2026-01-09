from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
import uvicorn
import os
import json
import base64
import torch
import httpx
import re
from typing import Optional
from faster_whisper import WhisperModel
import asyncio
from kokoro import KPipeline

app = FastAPI()

# Security
API_KEY = os.getenv("API_KEY", "5b7b1e1e-5c83-4e49-8605-c7c365d4cef6")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-88968cda0bc54682a9d9156a432b1037")

# 1. Load Faster-Whisper (STT) on CPU to save GPU memory
print("Loading Whisper Model on CPU...")
whisper_model = WhisperModel("medium", device="cpu", compute_type="int8")

# 2. DeepSeek API (no local model needed)
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

# 3. Load Kokoro TTS
print("Loading Kokoro TTS...")
pipeline = KPipeline(lang_code='fr', voice='ff_siwis')

def clean_text_for_tts(text):
    """Remove markdown and stage directions from text before TTS"""
    # Remove text between asterisks (stage directions like *taps notepad*)
    text = re.sub(r'\*[^*]+\*', '', text)
    # Remove markdown bold/italic
    text = re.sub(r'[*_]+', '', text)
    # Remove markdown headers
    text = re.sub(r'#+\s*', '', text)
    # Remove links [text](url)
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    # Clean up extra spaces
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

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

        # 3. Generate AI Response via DeepSeek API
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_text}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 200
                }
            )
            response.raise_for_status()
            ai_text = response.json()["choices"][0]["message"]["content"].strip()
            print(f"AI Response: {ai_text}")

        # 4. Clean text for TTS (remove stage directions and markdown)
        clean_ai_text = clean_text_for_tts(ai_text)
        print(f"Cleaned for TTS: {clean_ai_text}")

        # 5. Generate speech with Kokoro TTS
        audio_data, sample_rate = pipeline(clean_ai_text, voice='ff_siwis', speed=0.9, split_pattern=r'\n+')
        
        # Convert to WAV and base64
        import io
        import scipy.io.wavfile as wavfile
        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, sample_rate, audio_data)
        wav_buffer.seek(0)
        audio_base64 = base64.b64encode(wav_buffer.read()).decode('utf-8')

        # Simple respect change logic based on keywords
        respect_change = 0
        if "s'il vous plaît" in user_text.lower() or "merci" in user_text.lower():
            respect_change = 2
        elif len(user_text) < 10 and len(user_text.strip()) > 0:
            respect_change = -1

        return {
            "transcription": user_text,
            "aiResponse": ai_text,
            "audioBase64": f"data:audio/wav;base64,{audio_base64}",
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
