import { Router } from 'express';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { automationScheduler } from '../scheduler.js';
import { liveSync } from '../websocket/liveSync.js';

const router = Router();

// List automations
router.get('/', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM automations ORDER BY name ASC').all();
    return res.json({ ok: true, automations: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create automation / scene
router.post('/', (req, res) => {
  try {
    const { name, enabled, trigger, actions, steps } = req.body;
    if (!name) return res.status(400).json({ error: 'Automation name is required' });

    const id = `auto_${crypto.randomBytes(4).toString('hex')}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO automations (id, name, enabled, trigger_json, actions_json, steps_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name.trim(),
      enabled !== undefined ? (enabled ? 1 : 0) : 1,
      JSON.stringify(trigger || { type: 'manual' }),
      JSON.stringify(actions || []),
      JSON.stringify(steps || actions || []),
      now,
      now
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update automation
router.put('/:id', (req, res) => {
  try {
    const { name, enabled, trigger, actions, steps } = req.body;
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE automations SET
        name = COALESCE(?, name),
        enabled = COALESCE(?, enabled),
        trigger_json = COALESCE(?, trigger_json),
        actions_json = COALESCE(?, actions_json),
        steps_json = COALESCE(?, steps_json),
        updated_at = ?
      WHERE id = ?
    `).run(
      name,
      enabled !== undefined ? (enabled ? 1 : 0) : null,
      trigger ? JSON.stringify(trigger) : null,
      actions ? JSON.stringify(actions) : null,
      steps ? JSON.stringify(steps) : null,
      now,
      req.params.id
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete automation
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM automations WHERE id = ?').run(req.params.id);
    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Immediate execution test / manual run (Scenes Trigger)
router.post('/:id/run', async (req, res) => {
  try {
    const result = await automationScheduler.executeAutomation(req.params.id);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
