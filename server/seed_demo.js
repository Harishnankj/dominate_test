const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('building_os.db');

const floorId = 'fl_executive_01';
db.prepare(`
  INSERT OR REPLACE INTO floors (id, name, slug, icon, accent_color, sort_order)
  VALUES (?, 'Executive Floor', 'executive-floor', 'Building2', 'primary-400', 0)
`).run(floorId);

const room1Id = 'rm_exec_suite';
db.prepare(`
  INSERT OR REPLACE INTO rooms (id, floor_id, name, slug, icon, accent_color, aliases_json, sort_order)
  VALUES (?, ?, 'Executive Suite', 'executive-suite', 'Briefcase', 'primary-400', '["CEO Office", "Exec Office"]', 0)
`).run(room1Id, floorId);

const room2Id = 'rm_boardroom';
db.prepare(`
  INSERT OR REPLACE INTO rooms (id, floor_id, name, slug, icon, accent_color, aliases_json, sort_order)
  VALUES (?, ?, 'Boardroom 101', 'boardroom-101', 'Users', 'brand-400', '["Conference Room", "Meeting Room 1"]', 1)
`).run(room2Id, floorId);

// Add devices to Executive Suite
const insertDevice = db.prepare(`
  INSERT OR REPLACE INTO devices (id, room_id, type, name, subtitle, entity_id, config_json, show_on_default_dashboard, sort_order)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insertDevice.run(
  'dev_exec_lights',
  room1Id,
  'dimmable_light',
  'Chandelier & Coves',
  'Dimmable / Tunable Kelvin',
  'light.executive_ceiling',
  JSON.stringify({ min_mireds: 153, max_mireds: 500, min_kelvin: 2700, max_kelvin: 6500, max_watts: 120 }),
  1,
  0
);

insertDevice.run(
  'dev_exec_ac',
  room1Id,
  'ac_ir',
  'Daikin Executive AC',
  'Zigbee2MQTT IR Blaster',
  'text.ac_ir_blaster_ir_code_to_send',
  JSON.stringify({ ir_profile_id: 'daikin_arc480' }),
  1,
  1
);

insertDevice.run(
  'dev_exec_blinds',
  room1Id,
  'blinds_relay',
  'Dual Motorized Shades',
  'Relay Blinds (Up/Down)',
  null,
  JSON.stringify({
    blinds: [
      { name: 'Sheer Curtain', up_entity: 'switch.blind_1_up', down_entity: 'switch.blind_1_down', travel_time_ms: 18000, color: 'cyan' },
      { name: 'Blackout Shade', up_entity: 'switch.blind_2_up', down_entity: 'switch.blind_2_down', travel_time_ms: 22000, color: 'amber' }
    ]
  }),
  1,
  2
);

insertDevice.run(
  'dev_exec_presence',
  room1Id,
  'presence_sensor',
  'Executive Presence Radar',
  'Millimeter-Wave 24GHz',
  'binary_sensor.exec_presence_occupancy',
  '{}',
  1,
  3
);

console.log('Sample floor, rooms, and rich devices inserted successfully!');
