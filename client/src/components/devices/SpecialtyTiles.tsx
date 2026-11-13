import React, { useState, Suspense, lazy } from 'react';
import {
  Activity,
  AlertTriangle,
  Battery,
  Droplets,
  Eye,
  Fan,
  Gauge,
  Lock,
  Power,
  RotateCw,
  Settings,
  ShieldCheck,
  Star,
  Thermometer,
  Unlock,
  Wind,
  Zap,
} from 'lucide-react';
import type { Device } from '../../types';
import { useBootstrap } from '../../context/BootstrapContext';
import { useEntity } from '../../context/MultiHubHomeAssistantProvider';
import { useAuth } from '../../context/AuthContext';
import { ApiService } from '../../services/api';

const LockDetailModal = lazy(() => import('./LockDetailModal'));

export const PresenceSensorTile: React.FC<{ device: Device }> = ({ device }) => {
  const { getZ2mState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();
  const { state: haState } = useEntity(device.entity_id, device.ha_hub_id);

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const z2mKey = device.z2m_friendly_name || devConfig.z2m_friendly_name || devConfig.z2m_ieee || device.name;
  const liveState = getZ2mState(z2mKey) || {};

  const occupancy = liveState.occupancy ?? liveState.presence ?? (haState === 'on');
  const illuminance = liveState.illuminance_lux ?? liveState.illuminance;
  const distance = liveState.target_distance ?? liveState.distance;
  const lqi = liveState.linkquality;

  return (
    <div className={`relative rounded-2xl p-4 transition-all duration-200 border ${
      occupancy
        ? 'bg-[#191A1D] border-[#22D68A]/50 shadow-[0_0_20px_rgba(34,214,138,0.12)]'
        : 'bg-[#191A1D] border-[#383A3E] hover:border-[#4B4E54]'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
            occupancy ? 'bg-[#22D68A] text-slate-950 font-bold' : 'bg-[#111214] border border-[#383A3E] text-[#A6A6A6]'
          }`}>
            <Eye className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold tracking-wider ${
                occupancy ? 'text-[#22D68A]' : 'text-[#A6A6A6]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${occupancy ? 'bg-[#22D68A] animate-pulse' : 'bg-[#777777]'}`} />
                {occupancy ? 'OCCUPIED' : 'CLEAR'}
              </span>
              {lqi !== undefined && (
                <span className="text-[9px] font-mono text-[#777777]">LQI {lqi}</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(device.id);
          }}
          className={`p-1.5 rounded-lg transition-colors ${isFavorite(device.id) ? 'text-[#F0B94D]' : 'text-[#777777] hover:text-white'}`}
          title="Toggle Favorite"
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#383A3E]/60 text-xs font-mono">
        <div className="bg-[#111214] rounded-lg p-2 border border-[#383A3E]/40">
          <span className="text-[10px] text-[#A6A6A6] block">LIGHT LEVEL</span>
          <span className="text-[#F5F5F5] font-bold">{illuminance !== undefined ? `${illuminance} Lux` : '--'}</span>
        </div>
        <div className="bg-[#111214] rounded-lg p-2 border border-[#383A3E]/40">
          <span className="text-[10px] text-[#A6A6A6] block">DISTANCE</span>
          <span className="text-[#F5F5F5] font-bold">{distance !== undefined ? `${distance} m` : '--'}</span>
        </div>
      </div>
    </div>
  );
};

export const ExhaustFanTile: React.FC<{ device: Device }> = ({ device }) => {
  const { isFavorite, toggleFavorite } = useAuth();
  const { state, callService } = useEntity(device.entity_id, device.ha_hub_id);
  const [loading, setLoading] = useState(false);
  const isOn = state === 'on';

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (device.entity_id) {
        const domain = device.entity_id.split('.')[0] || 'fan';
        await callService(domain, isOn ? 'turn_off' : 'turn_on', { entity_id: device.entity_id });
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  return (
    <div className={`relative rounded-2xl p-4 transition-all duration-200 border ${
      isOn
        ? 'bg-[#191A1D] border-white/40 shadow-sm'
        : 'bg-[#191A1D] border-[#383A3E] hover:border-[#4B4E54]'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            isOn ? 'bg-white text-slate-950 font-bold' : 'bg-[#111214] border border-[#383A3E] text-[#A6A6A6]'
          }`}>
            <Fan className={`w-5 h-5 ${isOn ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-[#22D68A]' : 'bg-[#777777]'}`} />
              <span className={`text-[10px] font-mono uppercase font-bold tracking-wider ${isOn ? 'text-[#F5F5F5]' : 'text-[#777777]'}`}>
                {isOn ? 'RUNNING' : 'IDLE'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggle()}
            disabled={loading}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              isOn
                ? 'bg-white text-slate-950 hover:bg-neutral-200'
                : 'bg-[#202226] border border-[#383A3E] text-[#F5F5F5] hover:border-white/40'
            }`}
          >
            {loading ? '...' : isOn ? 'Turn Off' : 'Turn On'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(device.id);
            }}
            className={`p-1.5 rounded-lg transition-colors ${isFavorite(device.id) ? 'text-[#F0B94D]' : 'text-[#777777] hover:text-white'}`}
          >
            <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const TtlockTile: React.FC<{ device: Device }> = ({ device }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [battery, setBattery] = useState<number | null>(null);

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}

  // Detect if this is a Tuya video lock
  const tuyaId: string | null = device.tuya_device_id || devConfig.tuya_device_id || null;
  const isTuya = Boolean(tuyaId);
  const lockId = devConfig.lockId || device.entity_id;

  // Fetch live Tuya lock status on mount
  React.useEffect(() => {
    if (!isTuya || !tuyaId) return;
    ApiService.getTuyaLockStatus(tuyaId).then(res => {
      if (res.ok) {
        if (res.battery !== undefined) setBattery(res.battery);
        setUnlocked(!res.locked);
      }
    }).catch(() => {});
  }, [isTuya, tuyaId]);

  const handleUnlock = async () => {
    if (loading) return;
    setLoading(true);
    setMsg(null);
    try {
      if (isTuya && tuyaId) {
        const res = await ApiService.unlockTuyaDevice(tuyaId);
        if (res.ok) {
          setUnlocked(true);
          setMsg(res.message || 'Door Unlocked');
          setTimeout(() => { setUnlocked(false); setMsg(null); }, 8000);
        } else {
          setMsg(res.message || 'Unlock Failed');
        }
      } else {
        if (!lockId) return;
        const res = await ApiService.unlockTtlock(lockId);
        if (res.ok) {
          setUnlocked(true);
          setMsg('Unlocked');
          setTimeout(() => { setUnlocked(false); setMsg(null); }, 5000);
        } else {
          setMsg(res.message || 'Failed');
        }
      }
    } catch (err: any) {
      setMsg(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const battDisp = battery !== null ? battery : 70;

  return (
    <>
      <div className={`relative rounded-2xl p-4 transition-all duration-200 border ${
        unlocked
          ? 'bg-[#191A1D] border-[#22D68A]/60 shadow-[0_0_24px_rgba(34,214,138,0.15)]'
          : 'bg-[#191A1D] border-[#383A3E] hover:border-[#4B4E54]'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
              unlocked
                ? 'bg-[#22D68A] text-slate-950 font-bold'
                : 'bg-[#111214] border border-[#383A3E] text-white'
            }`}>
              {unlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#F5F5F5] tracking-wide">{device.name}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold tracking-wider ${
                  unlocked ? 'text-[#22D68A]' : 'text-[#A6A6A6]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${unlocked ? 'bg-[#22D68A] animate-pulse' : 'bg-[#22D68A]'}`} />
                  {unlocked ? 'ACCESS GRANTED' : 'SECURED'}
                </span>
                {msg && <span className="text-[10px] text-[#A6A6A6] font-mono">({msg})</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[#A6A6A6] text-xs font-mono bg-[#111214] px-2 py-1 rounded-lg border border-[#383A3E]">
              <Battery className="w-3.5 h-3.5 text-[#22D68A]" /> {battDisp}%
            </div>
            {isTuya && (
              <button
                onClick={() => setShowModal(true)}
                className="p-1.5 rounded-lg bg-[#202226] border border-[#383A3E] text-[#A6A6A6] hover:text-white hover:border-white/40 transition-colors"
                title="Open Video Surveillance & Lock Controls"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleUnlock}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-100 active:scale-[0.98] text-slate-950 text-xs font-bold tracking-wider shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              Unlocking...
            </span>
          ) : (
            <><Unlock className="w-4 h-4" /> 1-Click Remote Unlock</>
          )}
        </button>
      </div>

      {showModal && isTuya && tuyaId && (
        <Suspense fallback={null}>
          <LockDetailModal
            device={device}
            tuyaDeviceId={tuyaId}
            onClose={() => setShowModal(false)}
          />
        </Suspense>
      )}
    </>
  );
};

export const EnvironmentalSensorTile: React.FC<{ device: Device }> = ({ device }) => {
  const { getZ2mState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();
  const { attributes } = useEntity(device.entity_id, device.ha_hub_id);

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const z2mKey = device.z2m_friendly_name || devConfig.z2m_friendly_name || devConfig.z2m_ieee || device.name;
  const liveState = getZ2mState(z2mKey) || {};

  const temp = liveState.temperature ?? attributes.temperature;
  const humidity = liveState.humidity ?? attributes.humidity;
  const co2 = liveState.co2 ?? attributes.co2;
  const voc = liveState.voc ?? attributes.voc;
  const formaldehyd = liveState.formaldehyd ?? attributes.formaldehyd;
  const lqi = liveState.linkquality;

  const co2Num = typeof co2 === 'number' ? co2 : parseFloat(co2);
  const co2Level = !isNaN(co2Num)
    ? co2Num < 800
      ? { label: 'OPTIMAL', color: 'text-[#22D68A] bg-[#22D68A]/10 border-[#22D68A]/30' }
      : co2Num < 1200
      ? { label: 'MODERATE', color: 'text-[#F0B94D] bg-[#F0B94D]/10 border-[#F0B94D]/30' }
      : { label: 'POOR (VENTILATE)', color: 'text-[#FF5757] bg-[#FF5757]/10 border-[#FF5757]/30' }
    : null;

  return (
    <div className="relative rounded-2xl p-4 bg-[#191A1D] border border-[#383A3E] hover:border-[#4B4E54] transition-all space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
            <Wind className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              {co2Level ? (
                <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold uppercase border ${co2Level.color}`}>
                  {co2Level.label}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-[#A6A6A6] uppercase font-bold">AIR MONITOR</span>
              )}
              {lqi !== undefined && (
                <span className="text-[9px] font-mono text-[#777777]">LQI {lqi}</span>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(device.id);
          }}
          className={`p-1.5 rounded-lg transition-colors ${isFavorite(device.id) ? 'text-[#F0B94D]' : 'text-[#777777] hover:text-white'}`}
        >
          <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Sensor Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#383A3E]/50">
        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <div className="flex items-center gap-1.5 text-[#A6A6A6] text-[10px] font-mono mb-0.5">
            <Thermometer className="w-3 h-3 text-[#F0B94D]" /> TEMP
          </div>
          <span className="text-xs font-mono font-bold text-[#F5F5F5]">
            {temp !== undefined ? `${temp}°C` : '--'}
          </span>
        </div>

        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <div className="flex items-center gap-1.5 text-[#A6A6A6] text-[10px] font-mono mb-0.5">
            <Droplets className="w-3 h-3 text-white" /> HUMIDITY
          </div>
          <span className="text-xs font-mono font-bold text-[#F5F5F5]">
            {humidity !== undefined ? `${humidity}%` : '--'}
          </span>
        </div>

        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <div className="flex items-center gap-1.5 text-[#A6A6A6] text-[10px] font-mono mb-0.5">
            <Activity className="w-3 h-3 text-[#22D68A]" /> CO2
          </div>
          <span className="text-xs font-mono font-bold text-[#F5F5F5]">
            {co2 !== undefined ? `${co2} ppm` : '--'}
          </span>
        </div>

        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <div className="flex items-center gap-1.5 text-[#A6A6A6] text-[10px] font-mono mb-0.5">
            <Gauge className="w-3 h-3 text-slate-300" /> VOC / HCHO
          </div>
          <span className="text-xs font-mono font-bold text-[#F5F5F5]">
            {voc !== undefined ? `${voc} ppb` : formaldehyd !== undefined ? `${formaldehyd} µg` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const EnergyMeterTile: React.FC<{ device: Device }> = ({ device }) => {
  const { getZ2mState, setZ2mState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();
  const { attributes, callService } = useEntity(device.entity_id, device.ha_hub_id);

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const z2mKey = device.z2m_friendly_name || devConfig.z2m_friendly_name || devConfig.z2m_ieee || device.name;
  const liveState = getZ2mState(z2mKey) || {};

  const power = liveState.power_a ?? liveState.power ?? attributes.power;
  const voltage = liveState.voltage_a ?? liveState.voltage ?? attributes.voltage;
  const current = liveState.current_a ?? liveState.current ?? attributes.current;
  const energy = liveState.energy ?? attributes.energy;
  const rawState = liveState.state ?? 'ON';
  const isOn = String(rawState).toUpperCase() === 'ON';
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (toggling) return;
    setToggling(true);
    const targetState = isOn ? 'OFF' : 'ON';
    try {
      if (z2mKey) {
        await setZ2mState(z2mKey, { state: targetState });
      }
      if (device.entity_id) {
        const domain = device.entity_id.split('.')[0] || 'switch';
        await callService(domain, isOn ? 'turn_off' : 'turn_on', { entity_id: device.entity_id }).catch(() => {});
      }
    } catch (_) {}
    finally {
      setTimeout(() => setToggling(false), 500);
    }
  };

  return (
    <div className={`relative rounded-2xl p-4 transition-all duration-200 border space-y-3 ${
      isOn ? 'bg-[#191A1D] border-[#383A3E]' : 'bg-[#191A1D] border-[#383A3E] opacity-75'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
            isOn ? 'bg-white text-slate-950 font-bold' : 'bg-[#111214] border border-[#383A3E] text-[#777777]'
          }`}>
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase font-bold tracking-wider ${isOn ? 'text-[#22D68A]' : 'text-[#777777]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOn ? 'bg-[#22D68A]' : 'bg-[#777777]'}`} />
                {isOn ? 'BREAKER ACTIVE' : 'BREAKER OFF'}
              </span>
              {liveState.linkquality !== undefined && (
                <span className="text-[9px] font-mono text-[#777777]">LQI {liveState.linkquality}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all flex items-center gap-1.5 ${
              isOn
                ? 'bg-[#202226] text-[#FF5757] border-[#383A3E] hover:border-[#FF5757]/40'
                : 'bg-white text-slate-950 border-white hover:bg-neutral-200'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {toggling ? '...' : isOn ? 'TRIP / OFF' : 'TURN ON'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(device.id);
            }}
            className={`p-1.5 rounded-lg transition-colors ${isFavorite(device.id) ? 'text-[#F0B94D]' : 'text-[#777777] hover:text-white'}`}
          >
            <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Electrical Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-[#383A3E]/50">
        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <span className="text-[10px] font-mono text-[#F0B94D] block mb-0.5">POWER (W)</span>
          <span className="text-sm font-mono font-bold text-[#F5F5F5]">
            {power !== undefined ? `${power} W` : '--'}
          </span>
        </div>

        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <span className="text-[10px] font-mono text-white block mb-0.5">VOLTAGE (V)</span>
          <span className="text-sm font-mono font-bold text-[#F5F5F5]">
            {voltage !== undefined ? `${voltage} V` : '--'}
          </span>
        </div>

        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <span className="text-[10px] font-mono text-slate-300 block mb-0.5">CURRENT (A)</span>
          <span className="text-sm font-mono font-bold text-[#F5F5F5]">
            {current !== undefined ? `${current} A` : '--'}
          </span>
        </div>

        <div className="bg-[#111214] rounded-xl p-2.5 border border-[#383A3E]/40">
          <span className="text-[10px] font-mono text-[#22D68A] block mb-0.5">TOTAL ENERGY</span>
          <span className="text-sm font-mono font-bold text-[#F5F5F5]">
            {energy !== undefined ? `${energy} kWh` : '--'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const SmartKnobTile: React.FC<{ device: Device }> = ({ device }) => {
  const { getZ2mState } = useBootstrap();
  const { isFavorite, toggleFavorite } = useAuth();

  let devConfig: any = {};
  try { devConfig = JSON.parse(device.config_json); } catch (_) {}
  const z2mKey = device.z2m_friendly_name || devConfig.z2m_friendly_name || devConfig.z2m_ieee || device.name;
  const liveState = getZ2mState(z2mKey) || {};

  const battery = liveState.battery;
  const action = liveState.action;
  const operationMode = liveState.operation_mode;

  return (
    <div className="relative rounded-2xl p-4 bg-[#191A1D] border border-[#383A3E] hover:border-[#4B4E54] transition-all space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center">
            <RotateCw className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#F5F5F5] tracking-wide">{device.name}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-[#A6A6A6] uppercase font-bold">SMART ROTARY KNOB</span>
              {action && (
                <span className="px-2 py-0.5 rounded bg-white/10 text-white border border-white/20 text-[9px] font-mono uppercase font-bold">
                  {action}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {battery !== undefined && (
            <div className="flex items-center gap-1 text-[#A6A6A6] text-xs font-mono bg-[#111214] px-2 py-1 rounded-lg border border-[#383A3E]">
              <Battery className="w-3.5 h-3.5 text-[#22D68A]" /> {battery}%
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(device.id);
            }}
            className={`p-1.5 rounded-lg transition-colors ${isFavorite(device.id) ? 'text-[#F0B94D]' : 'text-[#777777] hover:text-white'}`}
          >
            <Star className={`w-4 h-4 ${isFavorite(device.id) ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#111214] border border-[#383A3E]/40 text-xs font-mono text-[#A6A6A6]">
        <span>Operation Mode: <strong className="text-[#F5F5F5]">{operationMode || 'Command'}</strong></span>
        <span>Last Trigger: <strong className="text-white">{action || 'Standby'}</strong></span>
      </div>
    </div>
  );
};
