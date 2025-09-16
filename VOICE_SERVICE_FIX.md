# Voice Generation Service - ElevenLabs Abuse Detection Fix

## Problem
When deploying on cloud platforms like Render, ElevenLabs may detect "unusual activity" and disable free tier access, returning a 401 error with status "detected_unusual_activity".

## Solution Implemented

### 1. Cache Management
- Added `clearVoiceCache()` function to clear stale cache data
- Cache keys can be cleared individually or entirely

### 2. OpenAI TTS Fallback
- Implemented OpenAI TTS as a backup when ElevenLabs fails
- Automatic fallback triggers on abuse detection errors
- Voice gender mapping to OpenAI voices:
  - Male → 'onyx' (deep voice)
  - Female → 'nova' (clear voice)  
  - Child → 'shimmer' (lighter voice)
  - Default → 'alloy' (neutral voice)

### 3. Environment Detection
- Detects cloud platforms (Render, Heroku, Vercel, Netlify)
- Identifies proxy/VPN usage through headers
- Uses OpenAI TTS first in high-risk environments

### 4. Enhanced Rate Limiting
- Longer delays for cloud environments (12s for Render vs 8s production)
- Exponential backoff on retries

### 5. Admin Endpoints
- `POST /admin/voice/clear-cache` - Clear voice cache
- `GET /admin/voice/status` - Check environment and configuration
- `POST /admin/voice/test` - Test voice generation

## Environment Variables

Add these to your Render environment:

```bash
# Enable OpenAI fallback (recommended for Render)
USE_OPENAI_TTS_FALLBACK=true

# Required for fallback functionality
OPENAI_API_KEY=your_openai_api_key

# Optional: Custom rate limiting (milliseconds)
ELEVENLABS_RATE_LIMIT_MS=12000
```

## Quick Fix Steps

1. **Clear Cache**: Call `POST /admin/voice/clear-cache`
2. **Set Fallback**: Add `USE_OPENAI_TTS_FALLBACK=true` to environment
3. **Check Status**: Call `GET /admin/voice/status` to verify configuration
4. **Test**: Call `POST /admin/voice/test` to verify functionality

## Long-term Solutions

1. **Upgrade ElevenLabs**: Purchase a paid plan to avoid free tier restrictions
2. **Use OpenAI Primary**: Set OpenAI TTS as primary for cloud deployments
3. **Monitor Logs**: Check environment detection logs for proxy/VPN issues

## Usage

The voice generation service now automatically:
- Detects cloud/proxy environments
- Uses OpenAI TTS first in high-risk environments
- Falls back to ElevenLabs if OpenAI fails
- Falls back to OpenAI if ElevenLabs detects abuse
- Provides detailed error messages and recovery instructions