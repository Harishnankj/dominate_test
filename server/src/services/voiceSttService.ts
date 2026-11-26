import path from 'path';

const CACHE_DIR = path.resolve(__dirname, '../../.whisper-cache');
const MODEL_ID = 'onnx-community/whisper-base';

type TranscriberFn = (audio: Float32Array, options?: Record<string, any>) => Promise<any>;

const HALLUCINATION_PATTERNS = [
  /^\[.*\]$/i,
  /^\(.*\)$/i,
  /^you\.?$/i,
  /^thank\s+you\.?$/i,
  /^thanks\s+for\s+watching\.?$/i,
  /^bye\.?$/i,
  /^uh+\.?$/i,
  /^hmm+\.?$/i,
];

class VoiceSttService {
  private pipelinePromise: Promise<TranscriberFn> | null = null;
  private ready = false;
  private loading = false;
  private lastError: string | null = null;
  private queue: Promise<void> = Promise.resolve();

  public getStatus() {
    return {
      model: MODEL_ID,
      ready: this.ready,
      loading: this.loading,
      error: this.lastError,
      cacheDir: CACHE_DIR,
    };
  }

  public warmup(): void {
    void this.ensurePipeline().catch((err) => {
      console.warn('[VoiceSTT] Warmup failed:', err?.message || err);
    });
  }

  private async ensurePipeline(): Promise<TranscriberFn> {
    if (this.pipelinePromise) {
      return this.pipelinePromise;
    }

    this.loading = true;
    this.lastError = null;
    const t0 = Date.now();
    console.log(`[VoiceSTT] Loading local Whisper model (${MODEL_ID})...`);

    this.pipelinePromise = (async () => {
      try {
        const { pipeline, env } = await import('@huggingface/transformers');
        env.cacheDir = CACHE_DIR;
        const asr = (await pipeline('automatic-speech-recognition', MODEL_ID, {
          dtype: 'q8',
        })) as unknown as TranscriberFn;
        this.ready = true;
        this.loading = false;
        console.log(`[VoiceSTT] Local Whisper ready in ${Date.now() - t0}ms`);
        return asr;
      } catch (err: any) {
        this.ready = false;
        this.loading = false;
        this.lastError = err?.message || 'Failed to load Whisper model';
        this.pipelinePromise = null;
        throw err;
      }
    })();

    return this.pipelinePromise;
  }

  private cleanTranscript(raw: string): string {
    const cleaned = raw
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return '';
    for (const pattern of HALLUCINATION_PATTERNS) {
      if (pattern.test(cleaned)) {
        return '';
      }
    }
    return cleaned;
  }

  public async transcribePcm16(
    pcm16Base64: string,
    language: 'en-IN' | 'ml-IN' = 'en-IN'
  ): Promise<{ text: string; elapsedMs: number; rms: number; peak?: number }> {
    const rawBuf = Buffer.from(pcm16Base64, 'base64');
    const sampleCount = Math.floor(rawBuf.byteLength / 2);
    if (sampleCount < 2400) {
      console.log(`[VoiceSTT] Skipped short audio (${sampleCount} samples)`);
      return { text: '', elapsedMs: 0, rms: 0, peak: 0 };
    }

    const float32 = new Float32Array(sampleCount);
    let sumSq = 0;
    let maxAbs = 0;
    for (let i = 0; i < sampleCount; i++) {
      const s = rawBuf.readInt16LE(i * 2) / 32768;
      float32[i] = s;
      const abs = Math.abs(s);
      if (abs > maxAbs) maxAbs = abs;
      sumSq += s * s;
    }

    const rms = Math.sqrt(sumSq / sampleCount);
    if (rms < 0.0008 && maxAbs < 0.003) {
      console.log(`[VoiceSTT] Skipped near-silent audio (samples=${sampleCount}, rms=${rms.toFixed(5)}, peak=${maxAbs.toFixed(5)})`);
      return { text: '', elapsedMs: 0, rms, peak: maxAbs };
    }

    // Normalize quiet microphone recordings cleanly into Whisper's expected dynamic range
    const gain = maxAbs > 0 ? Math.min(25, 0.72 / maxAbs) : 1;
    if (gain > 1.05) {
      for (let i = 0; i < sampleCount; i++) {
        float32[i] = Math.max(-1, Math.min(1, float32[i] * gain));
      }
    }

    // Serialize ONNX inference calls to keep CPU memory and runtime thread-safe
    const runTask = async () => {
      const transcriber = await this.ensurePipeline();
      const tStart = Date.now();
      const whisperLang = language === 'ml-IN' ? 'malayalam' : 'english';
      const result = await transcriber(float32, {
        language: whisperLang,
        task: 'transcribe',
      });
      const rawText = Array.isArray(result) ? result.map((r) => r?.text || '').join(' ') : result?.text || '';
      const clean = this.cleanTranscript(String(rawText));
      const elapsedMs = Date.now() - tStart;
      console.log(
        `[VoiceSTT] Transcribed ${(sampleCount / 16000).toFixed(2)}s (rms=${rms.toFixed(4)}, peak=${maxAbs.toFixed(4)}, gain=${gain.toFixed(1)}x) in ${elapsedMs}ms: raw=${JSON.stringify(rawText)} -> clean=${JSON.stringify(clean)}`
      );
      return {
        text: clean,
        elapsedMs,
        rms,
        peak: maxAbs,
      };
    };

    const nextPromise = this.queue.then(runTask, runTask);
    this.queue = nextPromise.then(
      () => undefined,
      () => undefined
    );
    return nextPromise;
  }
}

export const voiceSttService = new VoiceSttService();
