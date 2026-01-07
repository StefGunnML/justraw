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

# 5. Copy inference.py (Assuming it's uploaded or we create it here)
# For now, let's create a stable version of it right here via the script
cat <<EOF > inference.py
from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException
import uvicorn
import os
import json
import base64
from typing import Optional

app = FastAPI()

# This matches the DigitalOcean API KEY
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

    # Mock response with REAL audible audio (a Pierre-style grunt)
    # In production, this would be: 
    # transcription = whisper.transcribe(file)
    # ai_text = vllm.generate(system_prompt + transcription)
    # audio = kokoro.generate(ai_text)
    
    transcription = "Pardon, je voudrais un café."
    ai_text = "Encore un? Vous allez finir par ne plus dormir. Tenez, voilà votre café."
    
    # Pierre-like audible fallback grumble
    audio_url = "https://www.soundjay.com/human/mumble-01.mp3"

    return {
        "transcription": transcription,
        "aiResponse": ai_text,
        "audioBase64": audio_url,
        "respectChange": 2
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF

# 6. Start the service in the background
nohup venv/bin/python inference.py > /var/log/justraw_gpu.log 2>&1 &

echo "✅ JustRaw Intelligence Engine is running on port 8000"
