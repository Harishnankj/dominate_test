import onvif from 'node-onvif';

interface PtzDeviceConfig {
  xaddr: string;
  user?: string;
  pass?: string;
}

const deviceCache = new Map<string, any>();
const stopTimers = new Map<string, NodeJS.Timeout>();

export async function getOrInitPtzDevice(key: string, config: PtzDeviceConfig) {
  if (deviceCache.has(key)) {
    return deviceCache.get(key);
  }

  const device = new (onvif as any).OnvifDevice({
    xaddr: config.xaddr,
    user: config.user || '',
    pass: config.pass || '',
  });

  await device.init();
  if (!device.services?.ptz) {
    throw new Error('Device does not support ONVIF PTZ');
  }

  deviceCache.set(key, device);
  return device;
}

export async function ptzMove(
  key: string,
  config: PtzDeviceConfig,
  direction: string,
  speed = 0.4,
  durationMs = 500
) {
  // Clear any existing stop timer for this camera
  if (stopTimers.has(key)) {
    clearTimeout(stopTimers.get(key));
    stopTimers.delete(key);
  }

  let device: any;
  try {
    device = await getOrInitPtzDevice(key, config);
  } catch (err: any) {
    deviceCache.delete(key);
    throw err;
  }

  let x = 0;
  let y = 0;
  let z = 0;

  const sp = Math.max(0.1, Math.min(1.0, speed));
  const dir = direction.toLowerCase().replace(/[^a-z_]/g, '');

  switch (dir) {
    case 'up':
      y = sp;
      break;
    case 'down':
      y = -sp;
      break;
    case 'left':
      x = -sp;
      break;
    case 'right':
      x = sp;
      break;
    case 'up_left':
    case 'upleft':
      x = -sp;
      y = sp;
      break;
    case 'up_right':
    case 'upright':
      x = sp;
      y = sp;
      break;
    case 'down_left':
    case 'downleft':
      x = -sp;
      y = -sp;
      break;
    case 'down_right':
    case 'downright':
      x = sp;
      y = -sp;
      break;
    case 'zoom_in':
    case 'zoomin':
      z = sp;
      break;
    case 'zoom_out':
    case 'zoomout':
      z = -sp;
      break;
    default:
      throw new Error(`Unknown PTZ direction: ${direction}`);
  }

  try {
    await device.ptzMove({ speed: { x, y, z }, timeout: 1 });
  } catch (err: any) {
    // If connection dropped or token expired, invalidate cache and retry once
    deviceCache.delete(key);
    device = await getOrInitPtzDevice(key, config);
    await device.ptzMove({ speed: { x, y, z }, timeout: 1 });
  }

  if (durationMs > 0) {
    const timer = setTimeout(async () => {
      try {
        await device.ptzStop();
      } catch (_) {}
      stopTimers.delete(key);
    }, durationMs);
    stopTimers.set(key, timer);
  }

  return { ok: true, direction: dir, speed: sp };
}

export async function ptzStop(key: string, config: PtzDeviceConfig) {
  if (stopTimers.has(key)) {
    clearTimeout(stopTimers.get(key));
    stopTimers.delete(key);
  }

  try {
    const device = await getOrInitPtzDevice(key, config);
    await device.ptzStop();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}
