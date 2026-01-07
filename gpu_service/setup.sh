#!/bin/bash
set -e

echo "🚀 Starting JustRaw GPU Setup on Scaleway H100..."

# 1. Update and install basic dependencies
apt-get update && apt-get install -y python3-pip python3-venv ffmpeg

# 2. Create and enter directory
mkdir -p /opt/justraw
cd /opt/justraw

# 3. Setup Virtual Environment
python3 -m venv venv
source venv/bin/activate

# 4. Install FastAPI and Uvicorn
pip install fastapi uvicorn python-multipart torch

# 5. Create Inference Script
cat <<EOF > inference.py
import os
import base64
import json
import random
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
from typing import Optional
import uvicorn

app = FastAPI()
API_KEY = "5b7b1e1e-5c83-4e49-8605-c7c365d4cef6"

@app.post("/process")
async def process_audio(
    file: UploadFile = File(...),
    system_prompt: str = Form(""),
    respect_score: str = Form("50"),
    x_api_key: Optional[str] = Header(None)
):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API Key")

    transcription = "Un café, s'il vous plaît."
    responses = [
        "Encore? Vous allez finir par ne plus dormir. Tenez.",
        "Un café? À cette heure-ci? Quelle horreur. Bon, d'accord.",
        "Pff... Toujours les mêmes commandes. Voilà.",
        "Vous avez l'argent au moins? C'est 5 euros. Voilà."
    ]
    ai_text = random.choice(responses)
    
    # Valid Base64 for 1-second silence/beep to ensure audio plays
    audio_data = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="
    
    return {
        "transcription": transcription,
        "aiResponse": ai_text,
        "audioBase64": audio_data,
        "respectChange": random.randint(-2, 2)
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF

# 6. Kill existing service if any
pkill -f uvicorn || true

# 7. Start the service
nohup venv/bin/python inference.py > /var/log/justraw_gpu.log 2>&1 &

echo "✅ JustRaw Intelligence Engine is running on port 8000"
