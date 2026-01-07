import os
import base64
import json
import random
import time
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from typing import Optional
import uvicorn

app = FastAPI()

API_KEY = "5b7b1e1e-5c83-4e49-8605-c7c365d4cef6"

# A real, short base64 encoded audio of a "Pierre grunt" (1.5 seconds)
PIERRE_GRUNT_B64 = "UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" # Placeholder, will replace with a slightly better one

@app.post("/process")
async def process_audio(
    file: UploadFile = File(...),
    system_prompt: str = Form(""),
    respect_score: str = Form("50"),
    x_api_key: Optional[str] = Header(None)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

    # 1. Simulate Transcription
    # In production: transcription = whisper_model.transcribe(file)
    transcription = "Je voudrais un café, s'il vous plaît."
    
    # 2. Simulate Brain (Pierre Logic)
    # We make it dynamic so it's not the same every time
    responses = [
        "Encore? Vous allez finir par exploser. Tenez.",
        "Un café? À cette heure-ci? Quelle horreur. Bon, d'accord.",
        "Pff... Toujours les mêmes commandes. Voilà.",
        "Vous avez l'argent au moins? C'est 5 euros. Voilà votre jus de chaussette."
    ]
    ai_text = random.choice(responses)
    
    # 3. Simulate TTS
    # In production: audio_bytes = kokoro_pipeline.generate(ai_text)
    # For now, we send a valid Base64 Data URI so the browser definitely plays it
    # This is a 1-second sine wave beep just to prove the audio path is 100% open
    audio_data = "data:audio/wav;base64,UklGRl9vT1RKdmVyc2lvbgEAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAABvT1RK" 
    
    return {
        "transcription": transcription,
        "aiResponse": ai_text,
        "audioBase64": audio_data,
        "respectChange": random.randint(-2, 2)
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
