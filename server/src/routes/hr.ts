import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { ZKTecoAdapter, type PunchLog } from '../services/zktecoAdapter.js';
import { liveSync } from '../websocket/liveSync.js';

const router = Router();

// In-memory / temporary buffer for custom punched logs
let customPunches: PunchLog[] = [];

// Get attendance logs
router.get('/attendance', async (req, res) => {
  try {
    const config = db.prepare('SELECT hr_base_url, hr_auth_token, excluded_employee_ids_json FROM building_config WHERE id = 1').get() as any;
    let excludedIds: string[] = [];
    try {
      excludedIds = JSON.parse(config?.excluded_employee_ids_json || '[]');
    } catch (_) {}

    const logs = await ZKTecoAdapter.getAttendance(config?.hr_base_url || '', config?.hr_auth_token || '', excludedIds);

    // Merge custom punches
    const allLogs = [...customPunches, ...logs];
    // Sort descending by timestamp
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({ ok: true, logs: allLogs });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Manual Punch In / Out
router.post('/punch', (req, res) => {
  try {
    const { employeeId, employeeName, department, type } = req.body;
    if (!employeeId || !employeeName) {
      return res.status(400).json({ error: 'Employee ID and name are required' });
    }

    const newPunch: PunchLog = {
      id: `punch_${crypto.randomBytes(4).toString('hex')}`,
      employeeId: String(employeeId),
      employeeName: String(employeeName),
      department: department || 'General',
      timestamp: new Date().toISOString(),
      type: type === 'OUT' ? 'OUT' : 'IN',
      deviceSn: 'WEB-KIOSK-01',
    };

    customPunches.unshift(newPunch);
    liveSync.broadcast('attendance_punched', newPunch);

    return res.json({ ok: true, punch: newPunch });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Batch CSV / JSON upload
router.post('/batch-upload', (req, res) => {
  try {
    const { content, format } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const parsed = ZKTecoAdapter.parseUploadBatch(content, format === 'json' ? 'json' : 'csv');
    customPunches = [...parsed, ...customPunches];

    liveSync.broadcast('attendance_punched', { count: parsed.length });
    return res.json({ ok: true, importedCount: parsed.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
