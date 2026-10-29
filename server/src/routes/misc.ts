import { Router } from 'express';
import { db } from '../db/index.js';
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

    let xaddr = cam.onvif_url;
    let user = cam.onvif_user;
    let pass = cam.onvif_pass;

    if (!xaddr) {
      const rtsp = cam.rtsp_main_url || cam.rtsp_sub_url || '';
      const match = rtsp.match(/^rtsp:\/\/(?:([^:]+):([^@]+)@)?([^:/]+)(?::(\d+))?/);
      if (match) {
        const u = match[1];
        const p = match[2];
        const host = match[3];
        if (host === '192.168.0.39' || rtsp.includes('tapo')) {
          xaddr = 'http://192.168.0.176:2020/onvif/device_service';
          user = user || 'bezlin';
          pass = pass || '#Kinhah3059';
        } else {
          xaddr = `http://${host}:2020/onvif/device_service`;
          user = user || u;
          pass = pass || p;
        }
      } else {
        xaddr = 'http://192.168.0.176:2020/onvif/device_service';
        user = user || 'bezlin';
        pass = pass || '#Kinhah3059';
      }
    }

    if (action === 'stop') {
      const result = await ptzStop(cam.id, { xaddr, user, pass });
      return res.json(result);
    }

    const result = await ptzMove(
      cam.id,
      { xaddr, user, pass },
      direction || 'right',
      speed !== undefined ? Number(speed) : 0.4,
      durationMs !== undefined ? Number(durationMs) : 450
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
