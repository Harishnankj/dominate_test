import { Router } from 'express';
import { voiceSttService } from '../services/voiceSttService.js';

const router = Router();

router.get('/status', (_req, res) => {
  return res.json({ ok: true, ...voiceSttService.getStatus() });
});

router.post('/transcribe', async (req, res) => {
  try {
    const { pcm16Base64, language } = req.body || {};
    if (!pcm16Base64 || typeof pcm16Base64 !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing pcm16Base64 audio payload' });
    }

    const lang = language === 'ml-IN' ? 'ml-IN' : 'en-IN';
    console.log(`[VoiceSTT] POST /api/voice/transcribe lang=${lang} b64len=${pcm16Base64.length}`);
    const result = await voiceSttService.transcribePcm16(pcm16Base64, lang);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.warn('[VoiceSTT] Transcription error:', err?.message || err);
    return res.status(500).json({ ok: false, error: err?.message || 'Voice transcription failed' });
  }
});

export default router;
