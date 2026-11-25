import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db, getWallpapersDir } from '../db/index.js';
import { ptzMove, ptzStop } from '../services/onvifPtz.js';

const router = Router();

// Weather endpoint proxying Open-Meteo
router.get('/weather', async (req, res) => {
  try {
    const config = db.prepare('SELECT weather_lat, weather_lon, weather_label FROM building_config WHERE id = 1').get() as any;
    const lat = req.query.lat ? parseFloat(String(req.query.lat)) : (config?.weather_lat ?? 10.1906);
    const lon = req.query.lon ? parseFloat(String(req.query.lon)) : (config?.weather_lon ?? 76.3879);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=auto`;

    const weatherRes = await fetch(url);
    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo failed: ${weatherRes.statusText}`);
    }

    const data = (await weatherRes.json()) as any;
    return res.json({
      ok: true,
      label: config?.weather_label || 'Office Location',
      latitude: lat,
      longitude: lon,
      current: data.current,
      hourly: data.hourly,
    });
  } catch (err: any) {
    return res.json({
      ok: false,
      error: err.message,
      label: 'Office Location',
      current: {
        temperature_2m: 28.5,
        relative_humidity_2m: 65,
        apparent_temperature: 30.1,
        wind_speed_10m: 8.2,
        weather_code: 1,
      },
    });
  }
});

// Building & Technology News Feed
router.get('/news', (req, res) => {
  const newsItems = [
    {
      id: 'news-1',
      title: 'Building Energy Efficiency Protocol v2 Activated',
      summary: 'Dynamic HVAC setpoints and presence-based automation reduced floor 1 energy consumption by 18% this month.',
      category: 'Sustainability',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'news-2',
      title: 'Zero-Latency LAN Hub Synchronization Live',
      summary: 'Multi-Hub Home Assistant failover and Go2RTC WebRTC low-latency streaming are now active across all building sectors.',
      category: 'Infrastructure',
      timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    },
    {
      id: 'news-3',
      title: 'Biometric Access & Smart Lock Firmware Verified',
      summary: 'All gateway nodes and TTLock smart doors report 100% health with encrypted local credentials.',
      category: 'Security',
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    },
  ];

  return res.json({ ok: true, news: newsItems });
});

function normalizeOnvifUrl(onvifUrl?: string | null, rtspUrl?: string | null): string | null {
  if (onvifUrl && onvifUrl.trim().startsWith('http://')) {
    return onvifUrl.trim();
  }
  const source = onvifUrl || rtspUrl || '';
  const match = source.match(/^rtsp:\/\/(?:([^:]+):([^@]+)@)?([^:/]+)(?::(\d+))?/);
  if (match) {
    const host = match[3];
    if (host === '192.168.0.38' || source.includes('5543') || source.includes('channel')) {
      return `http://${host}:8000/onvif/device_service`;
    }
    if (host === '192.168.0.39' || source.includes('tapo')) {
      return `http://192.168.0.176:2020/onvif/device_service`;
    }
    return `http://${host}:8000/onvif/device_service`;
  }
  return onvifUrl ? onvifUrl.trim() : null;
}

// ==========================================
// PTZ Camera Control
// ==========================================
router.post('/cameras/:id/ptz', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, direction, speed, durationMs } = req.body;

    const cam = db.prepare('SELECT * FROM cameras WHERE id = ? OR stream_id = ?').get(id, id) as any;
    if (!cam) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    let xaddr = normalizeOnvifUrl(cam.onvif_url, cam.rtsp_main_url || cam.rtsp_sub_url);
    let user = cam.onvif_user || 'admin';
    let pass = cam.onvif_pass || '';

    if (!xaddr) {
      return res.status(400).json({
        error: 'No ONVIF service URL found for this camera. Please set ONVIF URL (e.g. http://192.168.0.38:8000/onvif/device_service) in Admin Studio -> CCTV.'
      });
    }

    if (!pass && (xaddr.includes('8000') || xaddr.includes('192.168.0.38'))) {
      return res.status(400).json({
        error: 'Camera ONVIF Password Required: Open your CP Plus EzyKam+ app -> Settings -> PC View / ONVIF to view or set the password, then save it in Admin Studio -> CCTV.'
      });
    }

    if (action === 'stop') {
      const result = await ptzStop(cam.id, { xaddr, user, pass });
      return res.json(result);
    }

    try {
      const result = await ptzMove(
        cam.id,
        { xaddr, user, pass },
        direction || 'right',
        speed !== undefined ? Number(speed) : 0.4,
        durationMs !== undefined ? Number(durationMs) : 450
      );
      return res.json(result);
    } catch (moveErr: any) {
      if (moveErr.message?.includes('Not Authorized') || moveErr.message?.includes('401') || moveErr.message?.includes('400')) {
        return res.status(401).json({
          error: 'ONVIF Authorization Failed: The ONVIF password is missing or incorrect. In your CP Plus EzyKam+ app, go to Settings -> PC View / ONVIF to view or set the password, then enter it in Admin Studio -> CCTV.'
        });
      }
      throw moveErr;
    }
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Serve locally uploaded room wallpapers
router.get('/wallpapers/:filename', (req, res) => {
  try {
    const safeName = path.basename(String(req.params.filename || ''));
    if (!safeName || safeName.includes('..')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    const filePath = path.join(getWallpapersDir(), safeName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Wallpaper not found' });
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
