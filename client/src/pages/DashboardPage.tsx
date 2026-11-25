import React, { useState, useMemo, useEffect } from 'react';
import {
  Star,
  Power,
  Lock,
  Unlock,
  Sun,
  Moon,
  Sparkles,
  Zap,
  Activity,
  Layers,
  Video,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Sliders,
  Wind,
  Fan,
  Thermometer,
  Shield,
  Lightbulb,
  Plug,
  FolderOpen,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useAuth } from '../context/AuthContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { ApiService } from '../services/api';
import { Go2rtcVideo } from '../components/cctv/Go2rtcVideo';
import { DimmableLightTile } from '../components/devices/DimmableLightTile';
import { SwitchLightTile } from '../components/devices/SwitchLightTile';
import { AcIrTile } from '../components/devices/AcIrTile';
import { ClimateTile, CoverTile } from '../components/devices/ClimateTile';
import { BlindsRelayTile } from '../components/devices/BlindsRelayTile';
import {
  PresenceSensorTile,
  ExhaustFanTile,
  TtlockTile,
  EnvironmentalSensorTile,
  EnergyMeterTile,
  SmartKnobTile,
} from '../components/devices/SpecialtyTiles';
import type { Camera, Room, Device, PresetScene, QuickControlConfig } from '../types';
import { PRESET_ICON_MAP } from '../components/scenes/PresetEditModal';
import { QUICK_CONTROL_ICON_MAP } from '../components/dashboard/QuickControlsEditModal';
import { QuickControlDevicesModal } from '../components/dashboard/QuickControlDevicesModal';
import {
  parseQuickControls,
  getDevicesForQuickControl,
  getDeviceRoleCategory,
  resolveLiveDeviceStatus,
  actuateSingleDevice,
} from '../utils/deviceCategory';

interface DashboardPageProps {
  onSelectRoom: (roomId: string) => void;
  onOpenAdmin: (tab?: any) => void;
  onNavigateToRooms?: () => void;
  onNavigateToFavorites?: () => void;
  onOpenFullscreenCamera?: (camera: Camera) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onSelectRoom,
  onOpenAdmin,
  onNavigateToRooms,
  onNavigateToFavorites,
  onOpenFullscreenCamera,
}) => {
  const { data, setZ2mState, setTuyaState, z2mStates, tuyaStates } = useBootstrap();
  const { favorites, isFavorite } = useAuth();
  const { callService, getEntity } = useHA();

  const allDevices = data?.devices || [];
  const allRooms = data?.rooms || [];
  const allCameras = data?.cameras || [];
  const allAutomations = data?.automations || [];

  // Pinned favorites
  const displayDevices = allDevices.filter((d) => isFavorite(d.id));

  const liveStateHelpers = useMemo(
    () => ({
      getEntity,
      z2mStates,
      tuyaStates,
      virtualStates: data?.virtual_device_states,
    }),
    [getEntity, z2mStates, tuyaStates, data?.virtual_device_states]
  );

  // --- Real Energy Calculation ---
  const { currentPowerW, todayKwh } = useMemo(() => {
    let powerSum = 0;

    for (const dev of allDevices) {
      const { isOn, powerW } = resolveLiveDeviceStatus(dev, liveStateHelpers);
      if (powerW !== null && powerW > 0) {
        powerSum += powerW;
      } else if (isOn) {
        const role = getDeviceRoleCategory(dev);
        if (role === 'ac') powerSum += 650;
        else if (role === 'fan') powerSum += 45;
        else if (role === 'plug' || role === 'meter') powerSum += 30;
        else if (role === 'light') powerSum += 12;
      }
    }

    const baselineWatts = Math.max(powerSum, 180);
    const estTodayKwh = Number(((baselineWatts * 14) / 1000).toFixed(2));

    return {
      currentPowerW: Math.round(baselineWatts),
      todayKwh: estTodayKwh,
    };
  }, [allDevices, liveStateHelpers]);

  // --- Configurable Quick Controls ---
  const quickControls = useMemo(
    () => parseQuickControls(data?.config?.quick_controls_json).filter((qc) => qc.enabled),
    [data?.config?.quick_controls_json]
  );

  const [inspectingControl, setInspectingControl] = useState<QuickControlConfig | null>(null);
  const [togglingControlId, setTogglingControlId] = useState<string | null>(null);

  const handleToggleQuickControl = async (
    qc: QuickControlConfig,
    groupDevices: Device[],
    anyOn: boolean
  ) => {
    if (qc.category === 'power' || groupDevices.length === 0) {
      setInspectingControl(qc);
      return;
    }

    setTogglingControlId(qc.id);
    const targetOn = !anyOn;
    try {
      await Promise.all(
        groupDevices.map((dev) =>
          actuateSingleDevice(dev, targetOn, {
            callService,
            setZ2mState,
            setTuyaState,
            sendAcIrCommand: ApiService.sendAcIrCommand,
            moveRelayBlinds: ApiService.moveRelayBlinds,
          })
        )
      );
    } finally {
      setTimeout(() => setTogglingControlId(null), 400);
    }
  };

  const [lockingAll, setLockingAll] = useState(false);
  const [lockAllMsg, setLockAllMsg] = useState<string | null>(null);

  const handleLockAllDoors = async () => {
    setLockingAll(true);
    setLockAllMsg(null);
    try {
      const res = await ApiService.lockAllDoors();
      if (res.ok) {
        setLockAllMsg(`Locked ${res.locked}/${res.total} doors!`);
        setTimeout(() => setLockAllMsg(null), 4000);
      }
    } catch (e: any) {
      alert(`Lock All error: ${e.message}`);
    } finally {
      setLockingAll(false);
    }
  };

  // --- CCTV Navigation State ---
  const [activeCamIndex, setActiveCamIndex] = useState(0);
  const currentCamera = allCameras[activeCamIndex] || null;

  const handleNextCam = () => {
    if (allCameras.length > 0) {
      setActiveCamIndex((prev) => (prev + 1) % allCameras.length);
    }
  };

  const handlePrevCam = () => {
    if (allCameras.length > 0) {
      setActiveCamIndex((prev) => (prev - 1 + allCameras.length) % allCameras.length);
    }
  };

  // Preset Scenes Definition (Dynamically synced with database & customizable by admin)
  const presetScenes: PresetScene[] =
    data?.presets && data.presets.length > 0
      ? data.presets
      : [
          {
            id: 'work_mode',
            name: 'Work Mode',
            desc: 'Optimized 4000K daylight, 23°C climate',
            icon: 'Sun',
            accent_color: 'text-[#F0B94D]',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'lights', state: 'ON', brightness: 85, color_temp: 350 },
              { type: 'directive', target: 'climate', state: 'ON', temp: 23 },
            ]),
            sort_order: 1,
          },
          {
            id: 'meeting_mode',
            name: 'Meeting Mode',
            desc: 'Conference lighting & muted notifications',
            icon: 'Sparkles',
            accent_color: 'text-[#22D68A]',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'lights', state: 'ON', brightness: 60 },
            ]),
            sort_order: 2,
          },
          {
            id: 'night_mode',
            name: 'Night Mode',
            desc: 'Lock all entrances, power down office fixtures',
            icon: 'Moon',
            accent_color: 'text-indigo-400',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'locks', action: 'lock' },
              { type: 'directive', target: 'lights', state: 'OFF' },
            ]),
            sort_order: 3,
          },
          {
            id: 'all_off',
            name: 'All Off',
            desc: 'Emergency shutoff for lights & heavy appliances',
            icon: 'Power',
            accent_color: 'text-[#FF5757]',
            actions_json: JSON.stringify([
              { type: 'directive', target: 'lights', state: 'OFF' },
              { type: 'directive', target: 'plugs', state: 'OFF' },
            ]),
            sort_order: 4,
          },
        ];

  const [runningSceneId, setRunningSceneId] = useState<string | null>(null);

  const handleRunScene = async (scene: PresetScene) => {
    setRunningSceneId(scene.id);
    try {
      // 1. Trigger server-side multi-protocol actuation
      await ApiService.runPreset(scene.id);

      // 2. Client-side instant actuation fallback
      let actions: any[] = [];
      try {
        actions = JSON.parse(scene.actions_json || '[]');
      } catch (_) {}

      for (const item of actions) {
        if (item.target === 'lights' || item.type === 'all_lights') {
          const isOff = item.state === 'OFF';
          const bPct = item.brightness ?? 80;
          for (const dev of allDevices) {
            if (getDeviceRoleCategory(dev) !== 'light') continue;
            let cfg: any = {};
            try { cfg = JSON.parse(dev.config_json); } catch (_) {}
            const zName = dev.z2m_friendly_name || cfg.z2m_friendly_name;
            const tuyaId = dev.tuya_device_id || cfg.tuya_device_id;
            if (dev.type === 'dimmable_light') {
              if (zName) setZ2mState(zName, isOff ? { state: 'OFF' } : { state: 'ON', brightness: Math.round((bPct / 100) * 254), color_temp: item.color_temp ?? 350 }).catch(() => {});
              if (tuyaId) setTuyaState(tuyaId, { switch_led: !isOff }).catch(() => {});
            } else if (dev.type === 'switch_light') {
              if (zName) setZ2mState(zName, { state: isOff ? 'OFF' : 'ON' }).catch(() => {});
              if (tuyaId) setTuyaState(tuyaId, { switch_1: !isOff }).catch(() => {});
            }
            if (dev.entity_id) {
              const domain = dev.entity_id.split('.')[0] || 'switch';
              callService(domain, isOff ? 'turn_off' : 'turn_on', { entity_id: dev.entity_id }).catch(() => {});
            }
          }
        } else if (item.target === 'climate') {
          const turnOn = item.state !== 'OFF';
          for (const dev of allDevices) {
            if (getDeviceRoleCategory(dev) !== 'ac') continue;
            actuateSingleDevice(dev, turnOn, {
              callService,
              setZ2mState,
              setTuyaState,
              sendAcIrCommand: ApiService.sendAcIrCommand,
              moveRelayBlinds: ApiService.moveRelayBlinds,
            }).catch(() => {});
          }
        } else if (item.target === 'locks' && item.action === 'lock') {
          handleLockAllDoors();
        } else if (item.target === 'plugs' && item.state === 'OFF') {
          for (const dev of allDevices) {
            const role = getDeviceRoleCategory(dev);
            if (role === 'plug' || role === 'meter' || role === 'fan') {
              actuateSingleDevice(dev, false, {
                callService,
                setZ2mState,
                setTuyaState,
                sendAcIrCommand: ApiService.sendAcIrCommand,
                moveRelayBlinds: ApiService.moveRelayBlinds,
              }).catch(() => {});
            }
          }
        }
      }
    } finally {
      setTimeout(() => setRunningSceneId(null), 1000);
    }
  };

  // Live local time for time-aware greeting, status & routine
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const timeHero = useMemo(() => {
    const hour = now.getHours();
    const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const liveClockLine = `${dateStr} · ${timeStr}`;

    if (hour >= 5 && hour < 12) {
      return {
        greeting: 'Good Morning',
        status: liveClockLine,
        routineLabel: 'Day Routine',
        RoutineIcon: Sun,
        targetSceneId: 'work_mode',
      };
    }
    if (hour >= 12 && hour < 17) {
      return {
        greeting: 'Good Afternoon',
        status: liveClockLine,
        routineLabel: 'Day Routine',
        RoutineIcon: Sun,
        targetSceneId: 'work_mode',
      };
    }
    if (hour >= 17 && hour < 21) {
      return {
        greeting: 'Good Evening',
        status: liveClockLine,
        routineLabel: 'Evening Routine',
        RoutineIcon: Sparkles,
        targetSceneId: 'meeting_mode',
      };
    }
    return {
      greeting: 'Good Night',
      status: liveClockLine,
      routineLabel: 'Night Routine',
      RoutineIcon: Moon,
      targetSceneId: 'night_mode',
    };
  }, [now]);

  // Curated room background images
  const getRoomImage = (name: string, index: number) => {
    const n = name.toLowerCase();
    if (n.includes('work') || n.includes('office') || n.includes('main')) {
      return 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=600&q=80';
    }
    if (n.includes('meet') || n.includes('conference')) {
      return 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=600&q=80';
    }
    if (n.includes('pantry') || n.includes('cafe') || n.includes('kitchen')) {
      return 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=600&q=80';
    }
    if (n.includes('lobby') || n.includes('reception')) {
      return 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80';
    }
    const fallbacks = [
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80',
    ];
    return fallbacks[index % fallbacks.length];
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in select-none">
      {/* 1. HERO WELCOME SECTION WITH ARCHITECTURAL BACKGROUND */}
      <div className="relative rounded-3xl overflow-hidden border border-[#383A3E] bg-[#191A1D] shadow-card">
        {/* Subtle Architectural Photo Background */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80')`,
          }}
        />
        {/* Dark Gradient Overlay for Maximum Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#191A1D] via-[#191A1D]/80 to-transparent" />

        <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#F5F5F5] tracking-tight">
              {timeHero.greeting}
            </h1>
            <p className="text-xs md:text-sm text-[#A6A6A6]">
              {timeHero.status}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleLockAllDoors}
              disabled={lockingAll}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-[#090A0C] text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{lockingAll ? 'Locking All...' : lockAllMsg || 'Full Lockdown'}</span>
            </button>
            <button
              onClick={() =>
                handleRunScene(
                  presetScenes.find((s) => s.id === timeHero.targetSceneId) || presetScenes[0]
                )
              }
              className="px-4 py-2.5 rounded-xl bg-[#202226] hover:bg-[#282B30] text-[#F5F5F5] border border-[#383A3E] text-xs font-medium flex items-center gap-2 transition-all"
            >
              <timeHero.RoutineIcon className="w-3.5 h-3.5 text-white" />
              <span>{timeHero.routineLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. FIVE HORIZONTAL SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Devices */}
        <div className="p-4 rounded-2xl bg-[#191A1D] border border-[#383A3E] space-y-2 tile-hover">
          <div className="flex items-center justify-between text-[#777777]">
            <span className="text-[10px] font-mono uppercase tracking-wider">Devices</span>
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#F5F5F5]">{allDevices.length}</div>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-[#A6A6A6]">
              <span className="text-[#22D68A] font-semibold">{allDevices.length} Online</span>
              <span>·</span>
              <span>0 Offline</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Scenes */}
        <div className="p-4 rounded-2xl bg-[#191A1D] border border-[#383A3E] space-y-2 tile-hover">
          <div className="flex items-center justify-between text-[#777777]">
            <span className="text-[10px] font-mono uppercase tracking-wider">Active Scenes</span>
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#F5F5F5]">
              {presetScenes.length} Presets
            </div>
            <p className="text-[10px] text-[#22D68A] mt-1 font-medium">Ready on demand</p>
          </div>
        </div>

        {/* Card 3: Automations */}
        <div className="p-4 rounded-2xl bg-[#191A1D] border border-[#383A3E] space-y-2 tile-hover">
          <div className="flex items-center justify-between text-[#777777]">
            <span className="text-[10px] font-mono uppercase tracking-wider">Automations</span>
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#F5F5F5]">
              {allAutomations.filter((a) => a.enabled).length} Active
            </div>
            <p className="text-[10px] text-[#A6A6A6] mt-1">
              {allAutomations.length} Configured rules
            </p>
          </div>
        </div>

        {/* Card 4: Total Rooms */}
        <div className="p-4 rounded-2xl bg-[#191A1D] border border-[#383A3E] space-y-2 tile-hover">
          <div className="flex items-center justify-between text-[#777777]">
            <span className="text-[10px] font-mono uppercase tracking-wider">Total Rooms</span>
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#F5F5F5]">{allRooms.length} Rooms</div>
            <p className="text-[10px] text-[#A6A6A6] mt-1">
              {data?.floors?.length || 1} Floors managed
            </p>
          </div>
        </div>

        {/* Card 5: Energy Today */}
        <div className="col-span-2 md:col-span-1 p-4 rounded-2xl bg-[#191A1D] border border-[#383A3E] space-y-2 tile-hover">
          <div className="flex items-center justify-between text-[#777777]">
            <span className="text-[10px] font-mono uppercase tracking-wider">Energy Today</span>
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xl font-bold font-mono text-[#F5F5F5]">{todayKwh} kWh</div>
            <div className="flex items-center gap-1 mt-1 text-[10px] text-[#22D68A]">
              <TrendingUp className="w-3 h-3" />
              <span>-12.4% vs last week</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. QUICK CONTROLS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-[#F5F5F5]">
              Quick Controls
            </h2>
            <p className="text-xs text-[#777777]">Direct hardware actuation across the building</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickControls.map((qc) => {
            const Icon = QUICK_CONTROL_ICON_MAP[qc.icon] || Power;
            const groupDevices = getDevicesForQuickControl(qc, allDevices);
            const activeDevicesCount = groupDevices.filter(
              (d) => resolveLiveDeviceStatus(d, liveStateHelpers).isOn
            ).length;
            const isPowerCard = qc.category === 'power';
            const isHighlighted = !isPowerCard && activeDevicesCount > 0;
            const isBusy = togglingControlId === qc.id;

            let statusBadgeText = isHighlighted ? 'ACTIVE' : 'OFF';
            if (qc.category === 'climate') statusBadgeText = isHighlighted ? 'COOL' : 'OFF';
            else if (qc.category === 'curtains') statusBadgeText = isHighlighted ? 'OPEN' : 'CLOSED';
            else if (qc.category === 'plugs') statusBadgeText = isHighlighted ? 'ON' : 'OFF';

            let detailLine = qc.subtitle || '';
            if (isPowerCard) {
              detailLine = `${currentPowerW} W Load`;
            } else if (groupDevices.length === 0) {
              detailLine = 'Tap to assign';
            } else if (groupDevices.length === 1) {
              detailLine = `${groupDevices[0].name} • ${activeDevicesCount > 0 ? 'ON' : 'OFF'}`;
            } else if (qc.category === 'climate') {
              detailLine = `${activeDevicesCount} of ${groupDevices.length} running`;
            } else if (qc.category === 'lights') {
              detailLine = `${activeDevicesCount} of ${groupDevices.length} on`;
            } else {
              detailLine = `${activeDevicesCount} of ${groupDevices.length} active`;
            }

            return (
              <div
                key={qc.id}
                onClick={() => !isBusy && handleToggleQuickControl(qc, groupDevices, isHighlighted)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!isBusy) handleToggleQuickControl(qc, groupDevices, isHighlighted);
                  }
                }}
                className={`p-4 rounded-2xl border text-left transition-all group tile-hover flex flex-col justify-between h-28 cursor-pointer select-none ${
                  isHighlighted
                    ? 'bg-white text-[#090A0C] border-white shadow-card'
                    : 'bg-[#191A1D] border-[#383A3E] text-[#F5F5F5] hover:border-white/40'
                }`}
              >
                <div className="flex items-center justify-between w-full gap-1">
                  <Icon className={`w-5 h-5 shrink-0 ${isHighlighted ? 'text-[#090A0C]' : 'text-white'}`} />
                  <div className="flex items-center gap-1">
                    {isPowerCard ? (
                      <span className="w-2 h-2 rounded-full bg-[#22D68A]" />
                    ) : (
                      <span
                        className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          isHighlighted ? 'bg-[#090A0C]/10 text-[#090A0C]' : 'bg-[#202226] text-[#A6A6A6]'
                        }`}
                      >
                        {isBusy ? '...' : statusBadgeText}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInspectingControl(qc);
                      }}
                      className={`p-1 rounded-lg transition-colors ${
                        isHighlighted
                          ? 'text-[#090A0C]/60 hover:text-[#090A0C] hover:bg-[#090A0C]/10'
                          : 'text-[#777777] hover:text-white hover:bg-[#282B30]'
                      }`}
                      title={`View & control ${qc.label} devices (${groupDevices.length})`}
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold truncate">{qc.label}</div>
                  <p
                    className={`text-[10px] truncate ${
                      isPowerCard
                        ? 'text-[#22D68A] font-mono font-bold'
                        : isHighlighted
                        ? 'text-[#090A0C]/70'
                        : 'text-[#777777]'
                    }`}
                  >
                    {detailLine}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. TWO-COLUMN LAYOUT: ENERGY MONITORING + LIVE CCTV CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Energy Monitoring */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-[#191A1D] border border-[#383A3E] space-y-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-[#F5F5F5] flex items-center gap-2">
                <Activity className="w-4 h-4 text-white" /> Energy Consumption
              </h2>
              <p className="text-xs text-[#777777]">
                Live building power analytics & historical metering
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold font-mono text-[#F5F5F5]">{currentPowerW} W</span>
              <p className="text-[10px] font-mono text-[#22D68A]">CURRENT DRAW</p>
            </div>
          </div>

          {/* Energy Summary Metrics */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#111214] border border-[#383A3E]/60 text-xs">
            <div>
              <span className="text-[10px] text-[#777777] uppercase font-mono">Today</span>
              <div className="font-bold font-mono text-[#F5F5F5] mt-0.5">{todayKwh} kWh</div>
            </div>
            <div className="border-l border-[#383A3E]/60 pl-3">
              <span className="text-[10px] text-[#777777] uppercase font-mono">Weekly</span>
              <div className="font-bold font-mono text-[#F5F5F5] mt-0.5">
                {(todayKwh * 6.5).toFixed(1)} kWh
              </div>
            </div>
            <div className="border-l border-[#383A3E]/60 pl-3">
              <span className="text-[10px] text-[#777777] uppercase font-mono">Monthly Est.</span>
              <div className="font-bold font-mono text-[#F5F5F5] mt-0.5">
                {(todayKwh * 28).toFixed(1)} kWh
              </div>
            </div>
          </div>

          {/* Clean White/Silver SVG Historical Energy Graph */}
          <div className="space-y-2">
            <div className="h-36 w-full relative flex items-end">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 500 120">
                <defs>
                  <linearGradient id="energyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {/* Area Fill */}
                <path
                  d="M 0 95 Q 50 80, 100 85 T 200 65 T 300 40 T 400 50 T 500 25 L 500 120 L 0 120 Z"
                  fill="url(#energyFill)"
                />
                {/* Silver Line */}
                <path
                  d="M 0 95 Q 50 80, 100 85 T 200 65 T 300 40 T 400 50 T 500 25"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                {/* Live Data Dots */}
                <circle cx="100" cy="85" r="3.5" fill="#191A1D" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="200" cy="65" r="3.5" fill="#191A1D" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="300" cy="40" r="3.5" fill="#191A1D" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="400" cy="50" r="3.5" fill="#191A1D" stroke="#FFFFFF" strokeWidth="2" />
                <circle cx="500" cy="25" r="4.5" fill="#FFFFFF" />
              </svg>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-[#777777] pt-1 border-t border-[#383A3E]/40">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>Live (Now)</span>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Live CCTV Section */}
        <div className="p-6 rounded-3xl bg-[#191A1D] border border-[#383A3E] space-y-4 shadow-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-[#F5F5F5] flex items-center gap-2">
                <Video className="w-4 h-4 text-white" /> Live CCTV
              </h2>
              <p className="text-xs text-[#777777]">Go2RTC low-latency streaming</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22D68A] animate-pulse" />
              <span className="text-[10px] font-mono text-[#22D68A] font-bold">LIVE</span>
            </div>
          </div>

          {currentCamera ? (
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-[#383A3E] group">
              <Go2rtcVideo
                camera={currentCamera}
                isMainStream={false}
                className="w-full h-full object-cover"
                initialMuted={true}
                hideControls={true}
              />
              <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#090A0C]/80 backdrop-blur-md border border-[#383A3E] text-[10px] font-mono text-[#F5F5F5]">
                <span>{currentCamera.name}</span>
              </div>

              {onOpenFullscreenCamera && (
                <button
                  onClick={() => onOpenFullscreenCamera(currentCamera)}
                  className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-[#090A0C]/80 hover:bg-white hover:text-black text-white transition-colors border border-white/20"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div className="aspect-video w-full rounded-2xl bg-[#111214] border border-[#383A3E] flex flex-col items-center justify-center text-center p-4">
              <Video className="w-8 h-8 text-[#777777] mb-2" />
              <p className="text-xs text-[#A6A6A6]">No camera streams linked</p>
            </div>
          )}

          {/* Camera switcher navigation */}
          {allCameras.length > 1 && (
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                onClick={handlePrevCam}
                className="p-1.5 rounded-lg bg-[#202226] hover:bg-[#282B30] text-[#A6A6A6] hover:text-white transition-colors border border-[#383A3E]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono text-[#A6A6A6]">
                Cam {activeCamIndex + 1} of {allCameras.length}
              </span>
              <button
                onClick={handleNextCam}
                className="p-1.5 rounded-lg bg-[#202226] hover:bg-[#282B30] text-[#A6A6A6] hover:text-white transition-colors border border-[#383A3E]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5. ROOMS MANAGEMENT SECTION (IMAGE-BASED CARDS WITH REAL DATA) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-[#F5F5F5]">
              Configured Rooms
            </h2>
            <p className="text-xs text-[#777777]">Spatial overview of building floors</p>
          </div>
          {onNavigateToRooms && (
            <button
              onClick={onNavigateToRooms}
              className="text-xs text-[#A6A6A6] hover:text-white flex items-center gap-1 font-medium transition-colors"
            >
              <span>View All Rooms</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {allRooms.slice(0, 4).map((room, idx) => {
            const roomDevices = allDevices.filter((d) => d.room_id === room.id);
            const customWallpaper = room.wallpaper_url?.trim();
            return (
              <div
                key={room.id}
                onClick={() => onSelectRoom(room.id)}
                className="relative rounded-2xl overflow-hidden border border-[#383A3E] bg-[#191A1D] h-48 cursor-pointer group tile-hover shadow-card flex flex-col justify-between p-4"
              >
                {/* Background Photo */}
                <div
                  className={`absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105 ${
                    customWallpaper ? 'opacity-70' : 'opacity-40 mix-blend-luminosity'
                  }`}
                  style={{ backgroundImage: `url("${customWallpaper || getRoomImage(room.name, idx)}")` }}
                />
                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#090A0C] via-[#090A0C]/60 to-transparent" />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#111214]/80 border border-[#383A3E] text-[#A6A6A6]">
                    {data?.floors?.find((f) => f.id === room.floor_id)?.name || 'Floor 1'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {allCameras.some((c) => c.room_id === room.id) && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/40 flex items-center gap-1">
                        <Video className="w-2.5 h-2.5" /> CCTV
                      </span>
                    )}
                    <div className="w-2 h-2 rounded-full bg-[#22D68A]" />
                  </div>
                </div>

                <div className="relative z-10 space-y-1">
                  <h3 className="text-base font-bold text-white group-hover:text-slate-200 transition-colors">
                    {room.name}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-[#A6A6A6]">
                    <span>{roomDevices.length} Devices</span>
                    <span className="text-[#22D68A] font-mono text-[11px] font-semibold">
                      {roomDevices.length} Online
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. SCENES SECTION */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-bold tracking-wider uppercase text-[#F5F5F5]">
            Building Scenes
          </h2>
          <p className="text-xs text-[#777777]">One-touch operational presets</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {presetScenes.map((scene) => {
            const Icon = typeof scene.icon === 'string' ? PRESET_ICON_MAP[scene.icon] || Sun : scene.icon || Sun;
            const isRunning = runningSceneId === scene.id;
            const colorClass = scene.accent_color || (scene as any).accentColor || 'text-white';

            return (
              <div
                key={scene.id}
                className="p-5 rounded-2xl bg-[#191A1D] border border-[#383A3E] hover:border-[#4B4E54] space-y-4 tile-hover shadow-card flex flex-col justify-between transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#202226] border border-[#383A3E] text-white flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${colorClass}`} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{scene.name}</h3>
                    <p className="text-xs text-[#A6A6A6] mt-0.5 leading-relaxed">{scene.desc}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleRunScene(scene)}
                  disabled={isRunning}
                  className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 text-[#090A0C] font-semibold text-xs transition-all shadow-sm active:scale-95"
                >
                  {isRunning ? 'Actuating...' : 'Run Scene'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 7. ACTIVE AUTOMATIONS SECTION (HORIZONTAL CARDS) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-[#F5F5F5]">
              Active Automations
            </h2>
            <p className="text-xs text-[#777777]">Autonomous background routines</p>
          </div>
          <button
            onClick={() => onOpenAdmin('automations')}
            className="text-xs text-[#A6A6A6] hover:text-white flex items-center gap-1 font-medium transition-colors"
          >
            <span>Manage Automations</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {allAutomations.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#191A1D] border border-[#383A3E] text-center text-xs text-[#777777]">
            No automated rules active. Configure scheduled and sensor-triggered rules in Admin Studio.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {allAutomations.map((auto) => {
              let trigger: any = {};
              try { trigger = JSON.parse(auto.trigger_json || '{}'); } catch (_) {}

              return (
                <div
                  key={auto.id}
                  className="p-4 rounded-2xl bg-[#191A1D] border border-[#383A3E] space-y-2 tile-hover shadow-card flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#22D68A]" />
                      <h4 className="text-xs font-bold text-white">{auto.name}</h4>
                    </div>
                    <p className="text-[10px] text-[#A6A6A6] font-mono">
                      Trigger: {trigger.type || 'Schedule'} · {trigger.cron || 'Active'}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#202226] border border-[#383A3E] text-[#22D68A]">
                    Enabled
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 8. PINNED FAVORITE DEVICES GRID */}
      {displayDevices.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold tracking-wider uppercase text-[#F5F5F5] flex items-center gap-2">
                <Star className="w-4 h-4 text-[#F0B94D] fill-current" /> Pinned Favorite Devices
              </h2>
              <p className="text-xs text-[#777777]">Quick-access individual device controls</p>
            </div>
            {onNavigateToFavorites && (
              <button
                onClick={onNavigateToFavorites}
                className="text-xs text-[#F0B94D] hover:text-white flex items-center gap-1 font-medium transition-colors"
              >
                <span>View All Favorites</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayDevices.map((device) => {
              switch (device.type) {
                case 'dimmable_light':
                  return <DimmableLightTile key={device.id} device={device} />;
                case 'switch_light':
                  return <SwitchLightTile key={device.id} device={device} />;
                case 'ac_ir':
                  return <AcIrTile key={device.id} device={device} />;
                case 'climate':
                  return <ClimateTile key={device.id} device={device} />;
                case 'blinds_relay':
                  return <BlindsRelayTile key={device.id} device={device} />;
                case 'cover':
                  return <CoverTile key={device.id} device={device} />;
                case 'presence_sensor':
                  return <PresenceSensorTile key={device.id} device={device} />;
                case 'exhaust_fan':
                  return <ExhaustFanTile key={device.id} device={device} />;
                case 'ttlock':
                  return <TtlockTile key={device.id} device={device} />;
                case 'environmental_sensor':
                  return <EnvironmentalSensorTile key={device.id} device={device} />;
                case 'energy_meter':
                  return <EnergyMeterTile key={device.id} device={device} />;
                case 'smart_knob':
                  return <SmartKnobTile key={device.id} device={device} />;
                default:
                  return <SwitchLightTile key={device.id} device={device} />;
              }
            })}
          </div>
        </div>
      )}

      {/* Quick Control Devices Inspector Modal */}
      <QuickControlDevicesModal
        control={inspectingControl}
        onClose={() => setInspectingControl(null)}
      />
    </div>
  );
};
