import React, { useState } from 'react';
import {
  Server,
  Layers,
  Video,
  KeyRound,
  Sparkles,
  Wand2,
  Download,
  Upload,
  Settings,
  Plus,
  Trash2,
  Edit,
  Wifi,
  RefreshCw,
  CheckCircle2,
  Lock,
  Cpu,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  ListFilter,
  Search,
  X,
  ChevronRight,
  Building2,
  Briefcase,
  Users,
  Monitor,
  Coffee,
  Shield,
  Compass,
  Clock,
  Play,
  Radio,
  ToggleLeft,
  ToggleRight,
  Power,
} from 'lucide-react';
import { useBootstrap } from '../../context/BootstrapContext';
import { ApiService } from '../../services/api';
import { DeviceMappingModal } from './DeviceMappingModal';
import { IrCodeEditorModal } from './IrCodeEditorModal';
import type { Device, DeviceType, Floor, Room, HaHub, IrProfile, Camera, Automation } from '../../types';

export type AdminStudioTabType =
  | 'hubs'
  | 'z2m'
  | 'floors'
  | 'cameras'
  | 'ttlock'
  | 'ir'
  | 'automations'
  | 'backup'
  | 'settings';

interface AdminStudioPageProps {
  onClose: () => void;
  initialTab?: AdminStudioTabType;
}

export const AdminStudioPage: React.FC<AdminStudioPageProps> = ({ onClose, initialTab = 'hubs' }) => {
  const { data, refreshBootstrap } = useBootstrap();

  const [activeTab, setActiveTab] = useState<AdminStudioTabType>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Hub Manager State
  const [editingHub, setEditingHub] = useState<Partial<HaHub> | null>(null);
  const [testingHubId, setTestingHubId] = useState<string | null>(null);
  const [hubTestResult, setHubTestResult] = useState<any>(null);

  // Floor & Room Manager State
  const [selectedFloorId, setSelectedFloorId] = useState<string>(data?.floors[0]?.id || '');
  const [editingFloor, setEditingFloor] = useState<Partial<Floor> | null>(null);
  const [editingRoom, setEditingRoom] = useState<Partial<Room> | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(data?.rooms[0]?.id || '');

  // Discovered Entities Browser State
  const [browsingHub, setBrowsingHub] = useState<HaHub | null>(null);
  const [discoveredEntities, setDiscoveredEntities] = useState<any[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [entityFilter, setEntityFilter] = useState<'all' | 'light' | 'switch' | 'sensor' | 'other'>('all');
  const [entitySearch, setEntitySearch] = useState('');

  // Auto-select floor if not selected or current one doesn't exist
  React.useEffect(() => {
    if (data?.floors?.length && (!selectedFloorId || !data.floors.some((f) => f.id === selectedFloorId))) {
      setSelectedFloorId(data.floors[0].id);
    }
  }, [data?.floors, selectedFloorId]);

  // Auto-select room in selected floor
  React.useEffect(() => {
    const floorRooms = (data?.rooms || []).filter((r) => r.floor_id === selectedFloorId);
    if (floorRooms.length && (!selectedRoomId || !floorRooms.some((r) => r.id === selectedRoomId))) {
      setSelectedRoomId(floorRooms[0].id);
    }
  }, [data?.rooms, selectedFloorId, selectedRoomId]);

  const handleOpenEntityBrowser = async (hub: HaHub) => {
    setBrowsingHub(hub);
    setLoadingEntities(true);
    setDiscoveredEntities([]);
    try {
      const res = await ApiService.discoverHaEntities(hub.id);
      setDiscoveredEntities(res.entities || []);
    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setLoadingEntities(false);
    }
  };

  // Device Mapping Modal
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  // IR Editor Modal
  const [irModalOpen, setIrModalOpen] = useState(false);
  const [editingIrProfile, setEditingIrProfile] = useState<IrProfile | null>(null);

  // Camera Modal
  const [editingCamera, setEditingCamera] = useState<Partial<Camera> | null>(null);

  // TTLock Test
  const [syncingTtlock, setSyncingTtlock] = useState(false);
  const [ttlockResult, setTtlockResult] = useState<any>(null);

  // Building Settings
  const [buildingName, setBuildingName] = useState(data?.config?.building_name || 'Smart Office');
  const [assistantName, setAssistantName] = useState(data?.config?.assistant_name || 'DOMFLY');
  const [weatherLat, setWeatherLat] = useState(data?.config?.weather_lat || 10.1906);
  const [weatherLon, setWeatherLon] = useState(data?.config?.weather_lon || 76.3879);
  const [weatherLabel, setWeatherLabel] = useState(data?.config?.weather_label || 'HQ Office');
  const [go2rtcBaseUrl, setGo2rtcBaseUrl] = useState(data?.config?.go2rtc_base_url || 'http://127.0.0.1:1984');
  const [requireHomeKey, setRequireHomeKey] = useState(data?.config?.require_home_key === 1);

  // Zigbee2MQTT State
  const [z2mBrokerUrl, setZ2mBrokerUrl] = useState(data?.config?.mqtt_broker_url || 'mqtt://127.0.0.1:1883');
  const [z2mUsername, setZ2mUsername] = useState(data?.config?.mqtt_username || '');
  const [z2mPassword, setZ2mPassword] = useState('');
  const [z2mBaseTopic, setZ2mBaseTopic] = useState(data?.config?.mqtt_base_topic || 'zigbee2mqtt');
  const [z2mEnabled, setZ2mEnabled] = useState(data?.config?.mqtt_enabled === 1);
  const [z2mStatusData, setZ2mStatusData] = useState<import('../../types').Z2mStatus | null>(null);
  const [z2mDevicesList, setZ2mDevicesList] = useState<import('../../types').Z2mDevice[]>([]);
  const [loadingZ2m, setLoadingZ2m] = useState(false);
  const [savingZ2mConfig, setSavingZ2mConfig] = useState(false);
  const [permitJoinTimer, setPermitJoinTimer] = useState<number>(0);
  const [autoImportingZ2m, setAutoImportingZ2m] = useState(false);

  const fetchZ2mInfo = React.useCallback(async () => {
    setLoadingZ2m(true);
    try {
      const [statusRes, devicesRes] = await Promise.all([
        ApiService.getZ2mStatus().catch(() => null),
        ApiService.getZ2mDevices().catch(() => null),
      ]);
      if (statusRes?.ok) {
        setZ2mStatusData(statusRes.status);
        if (statusRes.status.brokerUrl) setZ2mBrokerUrl(statusRes.status.brokerUrl);
        if (statusRes.status.baseTopic) setZ2mBaseTopic(statusRes.status.baseTopic);
        setZ2mEnabled(statusRes.status.enabled);
      }
      if (devicesRes?.ok) {
        setZ2mDevicesList(devicesRes.devices || []);
      }
    } catch (_) {}
    setLoadingZ2m(false);
  }, []);

  React.useEffect(() => {
    if (activeTab === 'z2m') {
      fetchZ2mInfo();
    }
  }, [activeTab, fetchZ2mInfo]);

  React.useEffect(() => {
    let interval: any = null;
    if (permitJoinTimer > 0) {
      interval = setInterval(() => {
        setPermitJoinTimer((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [permitJoinTimer]);

  const handleSaveZ2mConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingZ2mConfig(true);
    try {
      const res = await ApiService.updateZ2mConfig({
        enabled: z2mEnabled,
        brokerUrl: z2mBrokerUrl.trim(),
        username: z2mUsername.trim(),
        password: z2mPassword ? z2mPassword : undefined,
        baseTopic: z2mBaseTopic.trim(),
      });
      if (res.ok) {
        setZ2mStatusData(res.status);
        showStatus('Zigbee2MQTT configuration saved');
        await refreshBootstrap();
        fetchZ2mInfo();
      } else {
        showStatus('Failed to update Zigbee2MQTT settings', true);
      }
    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setSavingZ2mConfig(false);
    }
  };

  const handleTogglePermitJoin = async () => {
    try {
      const nextTime = permitJoinTimer > 0 ? 0 : 254;
      const res = await ApiService.setZ2mPermitJoin(nextTime);
      if (res.ok) {
        setPermitJoinTimer(nextTime);
        showStatus(nextTime > 0 ? 'Zigbee pairing mode active for 254s' : 'Pairing mode stopped');
      }
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleAutoImportZ2m = async () => {
    setAutoImportingZ2m(true);
    try {
      const res = await ApiService.autoImportZ2mDevices();
      if (res.ok) {
        showStatus(`Imported ${res.imported} new Zigbee devices into rooms`);
        await refreshBootstrap();
        fetchZ2mInfo();
      } else {
        showStatus('Auto-import completed with no new devices');
      }
    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setAutoImportingZ2m(false);
    }
  };

  const handleTestZ2mToggle = async (friendlyName: string) => {
    try {
      await ApiService.setZ2mDeviceState(friendlyName, { state: 'TOGGLE' });
      showStatus(`Toggled ${friendlyName}`);
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  // Automations Studio State
  const [editingAutomation, setEditingAutomation] = useState<Partial<Automation> | null>(null);
  const [autoName, setAutoName] = useState('');
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [autoTriggerType, setAutoTriggerType] = useState<'time' | 'manual' | 'presence'>('time');
  const [autoTriggerTime, setAutoTriggerTime] = useState('09:00');
  const [autoTriggerDays, setAutoTriggerDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [autoTriggerDeviceId, setAutoTriggerDeviceId] = useState('');
  const [autoSteps, setAutoSteps] = useState<Array<{ device_id: string; action: string; delay_ms?: number }>>([]);
  const [runningAutoId, setRunningAutoId] = useState<string | null>(null);
  const [savingAutomation, setSavingAutomation] = useState(false);

  const handleNewAutomation = () => {
    const defaultDevId = data?.devices?.[0]?.id || '';
    setEditingAutomation({});
    setAutoName('');
    setAutoEnabled(true);
    setAutoTriggerType('time');
    setAutoTriggerTime('09:00');
    setAutoTriggerDays([1, 2, 3, 4, 5]);
    const presenceDev = data?.devices?.find((d) => d.type === 'presence_sensor');
    setAutoTriggerDeviceId(presenceDev ? presenceDev.id : defaultDevId);
    setAutoSteps(defaultDevId ? [{ device_id: defaultDevId, action: 'turn_on' }] : []);
  };

  const handleEditAutomation = (auto: Automation) => {
    setEditingAutomation(auto);
    setAutoName(auto.name);
    setAutoEnabled(auto.enabled === 1);

    let tr: any = {};
    try {
      tr = JSON.parse(auto.trigger_json || '{}');
    } catch (_) {}

    if (tr.type === 'time') {
      setAutoTriggerType('time');
      setAutoTriggerTime(tr.time || '09:00');
      setAutoTriggerDays(Array.isArray(tr.days) ? tr.days : [1, 2, 3, 4, 5]);
    } else if (tr.type === 'presence') {
      setAutoTriggerType('presence');
      setAutoTriggerDeviceId(tr.device_id || (data?.devices?.[0]?.id || ''));
    } else {
      setAutoTriggerType('manual');
    }

    let parsedSteps: any[] = [];
    try {
      parsedSteps = JSON.parse(auto.steps_json || auto.actions_json || '[]');
    } catch (_) {}

    if (Array.isArray(parsedSteps) && parsedSteps.length > 0) {
      setAutoSteps(parsedSteps);
    } else {
      const defaultDevId = data?.devices?.[0]?.id || '';
      setAutoSteps(defaultDevId ? [{ device_id: defaultDevId, action: 'turn_on' }] : []);
    }
  };

  const handleSaveAutomation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!autoName.trim()) {
      showStatus('Please enter an automation name', true);
      return;
    }
    if (autoSteps.length === 0) {
      showStatus('Please add at least one action step', true);
      return;
    }

    const trigger =
      autoTriggerType === 'time'
        ? { type: 'time', time: autoTriggerTime, days: autoTriggerDays }
        : autoTriggerType === 'presence'
        ? { type: 'presence', device_id: autoTriggerDeviceId, state: 'on' }
        : { type: 'manual' };

    const payload = {
      name: autoName.trim(),
      enabled: autoEnabled ? 1 : 0,
      trigger,
      actions: autoSteps,
      steps: autoSteps,
    };

    setSavingAutomation(true);
    try {
      if (editingAutomation?.id) {
        const res = await ApiService.updateAutomation(editingAutomation.id, payload);
        if (res.ok) {
          showStatus(`Automation "${autoName}" updated successfully`);
        } else {
          showStatus('Failed to update automation', true);
        }
      } else {
        const res = await ApiService.addAutomation(payload);
        if (res.ok) {
          showStatus(`Automation "${autoName}" created successfully`);
        } else {
          showStatus('Failed to create automation', true);
        }
      }
      setEditingAutomation(null);
      await refreshBootstrap();
    } catch (err: any) {
      showStatus(`Error saving automation: ${err.message}`, true);
    } finally {
      setSavingAutomation(false);
    }
  };

  const handleToggleAutomation = async (auto: Automation) => {
    try {
      const nextState = auto.enabled === 1 ? 0 : 1;
      const res = await ApiService.updateAutomation(auto.id, { enabled: nextState });
      if (res.ok) {
        showStatus(`Automation "${auto.name}" ${nextState ? 'enabled' : 'disabled'}`);
        await refreshBootstrap();
      }
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleDeleteAutomation = async (auto: Automation) => {
    if (!confirm(`Are you sure you want to delete automation "${auto.name}"?`)) return;
    try {
      const res = await ApiService.deleteAutomation(auto.id);
      if (res.ok) {
        showStatus(`Deleted automation "${auto.name}"`);
        if (editingAutomation?.id === auto.id) {
          setEditingAutomation(null);
        }
        await refreshBootstrap();
      } else {
        showStatus('Failed to delete automation', true);
      }
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleRunAutomation = async (autoId: string) => {
    setRunningAutoId(autoId);
    try {
      const res = await ApiService.runAutomation(autoId);
      if (res.ok) {
        showStatus('Automation executed successfully');
        await refreshBootstrap();
      } else {
        showStatus('Automation execution failed', true);
      }
    } catch (err: any) {
      showStatus(`Execution error: ${err.message}`, true);
    } finally {
      setRunningAutoId(null);
    }
  };

  const getActionOptionsForDevice = (deviceId: string) => {
    const dev = (data?.devices || []).find((d) => d.id === deviceId);
    if (!dev) {
      return [
        { value: 'turn_on', label: 'Turn ON' },
        { value: 'turn_off', label: 'Turn OFF' },
      ];
    }
    switch (dev.type) {
      case 'blinds_relay':
      case 'cover':
        return [
          { value: 'open', label: 'Open' },
          { value: 'close', label: 'Close' },
          { value: 'stop', label: 'Stop' },
        ];
      case 'ttlock':
        return [{ value: 'unlock', label: 'Unlock Door' }];
      case 'dimmable_light':
      case 'switch_light':
      case 'exhaust_fan':
        return [
          { value: 'turn_on', label: 'Turn ON' },
          { value: 'turn_off', label: 'Turn OFF' },
          { value: 'toggle', label: 'Toggle' },
        ];
      case 'ac_ir':
      case 'climate':
        return [
          { value: 'turn_on', label: 'Turn ON' },
          { value: 'turn_off', label: 'Turn OFF' },
        ];
      default:
        return [
          { value: 'turn_on', label: 'Turn ON' },
          { value: 'turn_off', label: 'Turn OFF' },
        ];
    }
  };

  // HomeKey Preview
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const showStatus = (text: string, error = false) => {
    setStatusMsg({ text, error });
    setTimeout(() => setStatusMsg(null), 4000);
  };

  // 1. Hub Operations
  const [testingFormHub, setTestingFormHub] = useState(false);

  const handleTestHub = async (hub: HaHub) => {
    setTestingHubId(hub.id);
    setHubTestResult(null);
    try {
      const res = await ApiService.testHaConnection({
        hub_id: hub.id,
        local_url: hub.local_url,
        access_token: hub.access_token,
      });
      setHubTestResult(res);
      showStatus(res.ok ? `Connected to ${res.haVersion} with ${res.totalEntities} entities` : `Failed: ${res.error}`, !res.ok);
    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setTestingHubId(null);
    }
  };

  const handleTestFormHub = async () => {
    if (!editingHub?.local_url) {
      showStatus('Please enter a Local LAN URL first', true);
      return;
    }
    setTestingFormHub(true);
    try {
      const res = await ApiService.testHaConnection({
        hub_id: editingHub.id,
        local_url: editingHub.local_url.trim(),
        access_token: editingHub.access_token?.trim(),
      });
      showStatus(res.ok ? `Connected! HA version ${res.haVersion} (${res.totalEntities} entities found)` : `Connection failed: ${res.error}`, !res.ok);
    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setTestingFormHub(false);
    }
  };

  const handleSaveHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHub?.name || !editingHub?.local_url) return;

    try {
      if (editingHub.id) {
        await ApiService.updateHub(editingHub.id, editingHub);
        showStatus('Hub updated successfully');
      } else {
        await ApiService.addHub({
          name: editingHub.name!,
          local_url: editingHub.local_url!,
          cloud_url: editingHub.cloud_url,
          access_token: editingHub.access_token || '',
        });
        showStatus('Hub added successfully');
      }
      setEditingHub(null);
      await refreshBootstrap();
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleDeleteHub = async (id: string) => {
    if (!confirm('Are you sure you want to remove this hub?')) return;
    try {
      await ApiService.deleteHub(id);
      await refreshBootstrap();
      showStatus('Hub removed');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleAutoImportFromHub = async (hubId: string) => {
    try {
      const res = await ApiService.autoImportHaAreas(hubId);
      await refreshBootstrap();
      showStatus(`Imported ${res.importedRooms} rooms & ${res.importedDevices} devices!`);
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleGenerateHomeKey = async () => {
    try {
      const res = await ApiService.generateHomeKey(requireHomeKey);
      setGeneratedKey(res.homeKey);
      showStatus('HomeKey generated & saved');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  // 2. Floor & Room Operations
  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFloor?.name?.trim()) return;
    try {
      if (editingFloor.id) {
        await ApiService.updateFloor(editingFloor.id, editingFloor);
      } else {
        const res = await ApiService.addFloor(editingFloor);
        if (res.id) setSelectedFloorId(res.id);
      }
      setEditingFloor(null);
      await refreshBootstrap();
      showStatus('Floor saved successfully');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleDeleteFloor = async (id: string) => {
    if (!confirm('Delete floor and all rooms within it?')) return;
    try {
      await ApiService.deleteFloor(id);
      await refreshBootstrap();
      if (selectedFloorId === id) {
        const remaining = (data?.floors || []).filter((f) => f.id !== id);
        setSelectedFloorId(remaining[0]?.id || '');
      }
      showStatus('Floor deleted');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom?.name?.trim()) return;
    try {
      const targetFloorId = editingRoom.floor_id || selectedFloorId;
      let savedId = editingRoom.id;
      if (editingRoom.id) {
        await ApiService.updateRoom(editingRoom.id, { ...editingRoom, floor_id: targetFloorId });
      } else {
        const res = await ApiService.addRoom({ ...editingRoom, floor_id: targetFloorId });
        if (res.id) savedId = res.id;
      }
      setEditingRoom(null);
      await refreshBootstrap();
      if (savedId) {
        setSelectedRoomId(savedId);
      }
      showStatus('Room saved successfully');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!confirm('Delete this room and its devices?')) return;
    try {
      await ApiService.deleteRoom(id);
      await refreshBootstrap();
      if (selectedRoomId === id) {
        const remaining = (data?.rooms || []).filter((r) => r.id !== id && r.floor_id === selectedFloorId);
        setSelectedRoomId(remaining[0]?.id || '');
      }
      showStatus('Room deleted');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  // Device save handler
  const handleSaveDevice = async (device: Partial<Device>) => {
    try {
      if (device.id) {
        await ApiService.updateDevice(device.id, device);
      } else {
        await ApiService.addDevice(device);
      }
      await refreshBootstrap();
      showStatus('Device saved');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Remove this device tile?')) return;
    try {
      await ApiService.deleteDevice(id);
      await refreshBootstrap();
      showStatus('Device removed');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  // Camera save handler
  const handleSaveCamera = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCamera?.name?.trim() || !editingCamera?.stream_id?.trim()) return;
    try {
      if (editingCamera.id) {
        await ApiService.updateCamera(editingCamera.id, editingCamera);
      } else {
        await ApiService.addCamera(editingCamera);
      }
      setEditingCamera(null);
      await refreshBootstrap();
      showStatus('Camera saved successfully');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleDeleteCamera = async (id: string) => {
    if (!confirm('Remove this camera?')) return;
    try {
      await ApiService.deleteCamera(id);
      await refreshBootstrap();
      showStatus('Camera removed');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  // 3. TTLock Sync
  const handleSyncTtlock = async () => {
    setSyncingTtlock(true);
    setTtlockResult(null);
    try {
      const res = await ApiService.testTtlock({});
      setTtlockResult(res);
      await refreshBootstrap();
      showStatus(res.ok ? `Synced ${res.totalLocks} locks` : res.error, !res.ok);
    } catch (err: any) {
      showStatus(err.message, true);
    } finally {
      setSyncingTtlock(false);
    }
  };

  // 4. Save Building Settings
  const handleSaveSettings = async () => {
    try {
      await ApiService.updateConfig({
        building_name: buildingName,
        assistant_name: assistantName,
        weather_lat: weatherLat,
        weather_lon: weatherLon,
        weather_label: weatherLabel,
        go2rtc_base_url: go2rtcBaseUrl,
        require_home_key: requireHomeKey ? 1 : 0,
      });
      await refreshBootstrap();
      showStatus('Settings updated');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  // 5. Config Export & Import
  const handleExportConfig = async () => {
    try {
      const data = await ApiService.exportConfig();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dominatee_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Backup JSON downloaded');
    } catch (err: any) {
      showStatus(err.message, true);
    }
  };

  const handleImportConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await ApiService.importConfig(json);
      await refreshBootstrap();
      showStatus('Configuration restored successfully!');
    } catch (err: any) {
      showStatus(`Import failed: ${err.message}`, true);
    }
  };

  const currentFloorRooms = (data?.rooms || []).filter((r) => r.floor_id === selectedFloorId);
  const currentRoomDevices = (data?.devices || []).filter((d) => d.room_id === selectedRoomId);
  const activeFloor = (data?.floors || []).find((f) => f.id === selectedFloorId) || (data?.floors || [])[0];
  const activeRoom = (data?.rooms || []).find((r) => r.id === selectedRoomId);

  return (
    <div className="fixed inset-0 z-50 bg-[#090d16] flex flex-col overflow-hidden text-slate-100">
      {/* Top Studio Navbar */}
      <div className="glass-panel border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-brand-600 flex items-center justify-center text-slate-950 shadow-glow">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-wide">Live Admin Studio</h2>
            <p className="text-xs text-cyan-400 font-mono">Zero Hardcoding • Live SQLite Reconfiguration</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {statusMsg && (
            <span
              className={`text-xs px-3 py-1 rounded-lg border font-mono animate-in fade-in ${
                statusMsg.error
                  ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              }`}
            >
              {statusMsg.text}
            </span>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Exit Studio
          </button>
        </div>
      </div>

      {/* Main Container with Sidebar Tabs */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <div className="w-64 glass-panel border-r border-white/10 p-3 space-y-1 overflow-y-auto hidden md:block">
          {[
            { id: 'hubs', label: 'Home Assistant Hubs', icon: Server },
            { id: 'z2m', label: 'Zigbee2MQTT (Direct)', icon: Radio },
            { id: 'floors', label: 'Floors & Rooms & Devices', icon: Layers },
            { id: 'cameras', label: 'CCTV & Go2RTC', icon: Video },
            { id: 'ttlock', label: 'TTLock & HR Biometrics', icon: Lock },
            { id: 'ir', label: 'IR Profiles & Learner', icon: Sparkles },
            { id: 'automations', label: 'Automations & Cron', icon: Wand2 },
            { id: 'backup', label: 'Backup & Restore', icon: Download },
            { id: 'settings', label: 'Building Settings', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow font-bold'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="flex-1 p-6 overflow-y-auto max-w-6xl">
          {/* TAB 1: Home Assistant Hubs */}
          {activeTab === 'hubs' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Home Assistant Hubs</h3>
                  <p className="text-xs text-slate-400">
                    Connect multiple local and cloud HA instances dynamically.
                  </p>
                </div>
                <button
                  onClick={() => setEditingHub({ name: 'Secondary Hub', local_url: 'http://192.168.1.101:8123', enabled: 1 })}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wide shadow-glow flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Add HA Hub
                </button>
              </div>

              {/* Next Steps Guidance Banner */}
              <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-white mb-1">Hub Connected! Next Step to List Devices:</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Home Assistant entities are populated into rooms and dashboard tiles in two easy ways:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="text-[11px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
                      <strong>Option 1:</strong> Click <strong>1-Click Import Areas</strong> below to auto-create rooms and map all lights, switches, climates & sensors automatically.
                    </span>
                    <span className="text-[11px] text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                      <strong>Option 2:</strong> Click <strong>Discovered Entities</strong> to search live entities and assign them to rooms individually.
                    </span>
                  </div>
                </div>
              </div>

              {/* Hub Cards */}
              <div className="grid grid-cols-1 gap-4">
                {(data?.hubs || []).map((hub) => (
                  <div key={hub.id} className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{hub.name}</h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${hub.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                          {hub.enabled ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <p className="text-xs font-mono text-cyan-400 mt-1">{hub.local_url}</p>
                      {hub.cloud_url && <p className="text-[11px] font-mono text-slate-400">{hub.cloud_url}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTestHub(hub)}
                        disabled={testingHubId === hub.id}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 flex items-center gap-1.5"
                      >
                        {testingHubId === hub.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                        Test Connection
                      </button>

                      <button
                        onClick={() => handleOpenEntityBrowser(hub)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30"
                      >
                        <ListFilter className="w-3.5 h-3.5" /> Discovered Entities
                      </button>

                      <button
                        onClick={() => handleAutoImportFromHub(hub.id)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-cyan-500/30"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> 1-Click Import Areas
                      </button>

                      <button
                        onClick={() => setEditingHub(hub)}
                        className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteHub(hub.id)}
                        className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add / Edit Hub Form */}
              {editingHub && (
                <form onSubmit={handleSaveHub} className="glass-panel p-5 rounded-2xl border border-cyan-500/30 space-y-3">
                  <h4 className="text-sm font-bold text-white">{editingHub.id ? 'Edit Hub' : 'Add New Hub'}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="Hub Name"
                      value={editingHub.name || ''}
                      onChange={(e) => setEditingHub({ ...editingHub, name: e.target.value })}
                      className="glass-input rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Local LAN URL (http://192.168.1.100:8123)"
                      value={editingHub.local_url || ''}
                      onChange={(e) => setEditingHub({ ...editingHub, local_url: e.target.value })}
                      className="glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Cloud URL (Optional)"
                      value={editingHub.cloud_url || ''}
                      onChange={(e) => setEditingHub({ ...editingHub, cloud_url: e.target.value })}
                      className="glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                    <input
                      type="password"
                      placeholder="Long-Lived Access Token"
                      value={editingHub.access_token || ''}
                      onChange={(e) => setEditingHub({ ...editingHub, access_token: e.target.value })}
                      className="glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={testingFormHub || !editingHub.local_url}
                      onClick={handleTestFormHub}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 flex items-center gap-1.5 border border-white/10 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {testingFormHub ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                      Test Credentials
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingHub(null)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs shadow-glow hover:opacity-90"
                      >
                        Save Hub
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* HomeKey Generator Tool */}
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-cyan-400" /> HomeKey Generator & Gate
                    </h4>
                    <p className="text-xs text-slate-400">
                      Encodes your hub URLs into a shareable HomeKey for fast client device provisioning.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateHomeKey}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Generate HomeKey
                  </button>
                </div>

                {generatedKey && (
                  <div className="p-3 rounded-xl bg-black/60 font-mono text-xs text-cyan-300 border border-cyan-800/40 flex items-center justify-between">
                    <span className="truncate pr-4">{generatedKey}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedKey);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                    >
                      {copiedKey ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: Zigbee2MQTT Direct Connection */}
          {activeTab === 'z2m' && (
            <div className="space-y-6">
              {/* Top Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Radio className="w-5 h-5 text-cyan-400" /> Zigbee2MQTT & Direct MQTT Hub
                  </h3>
                  <p className="text-xs text-slate-400">
                    Direct local coordinator control with zero Home Assistant dependency & automatic failover
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleTogglePermitJoin}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                      permitJoinTimer > 0
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30'
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    {permitJoinTimer > 0 ? `Pairing Active (${permitJoinTimer}s)` : 'Enable Pairing (254s)'}
                  </button>

                  <button
                    onClick={handleAutoImportZ2m}
                    disabled={autoImportingZ2m || z2mDevicesList.length === 0}
                    className="px-3.5 py-2 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-300 text-xs font-bold border border-cyan-500/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {autoImportingZ2m ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    1-Click Auto-Import Devices
                  </button>

                  <button
                    onClick={fetchZ2mInfo}
                    disabled={loadingZ2m}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Refresh Z2M Status & Devices"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingZ2m ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Status Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">MQTT Broker</span>
                    <span className="text-xs font-mono font-bold text-white mt-0.5 block truncate max-w-[170px]">
                      {z2mBrokerUrl}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase ${
                      z2mStatusData?.connected
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-glow-emerald'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {z2mStatusData?.connected ? 'CONNECTED' : 'OFFLINE'}
                  </span>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Bridge Status</span>
                    <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                      Topic: {z2mBaseTopic}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase ${
                      z2mStatusData?.bridgeState === 'online'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border border-white/5'
                    }`}
                  >
                    {z2mStatusData?.bridgeState === 'online' ? 'BRIDGE ONLINE' : (z2mStatusData?.bridgeState || 'UNKNOWN')}
                  </span>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Discovered Devices</span>
                    <span className="text-xs font-mono font-bold text-white mt-0.5 block">
                      {z2mDevicesList.filter((d) => d.type !== 'Coordinator').length} End Devices / Routers
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {z2mDevicesList.length} TOTAL
                  </span>
                </div>
              </div>

              {/* MQTT Broker Settings Form */}
              <form onSubmit={handleSaveZ2mConfig} className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" /> MQTT Broker Connection Settings
                  </h4>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                    <input
                      type="checkbox"
                      checked={z2mEnabled}
                      onChange={(e) => setZ2mEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-white/20 focus:ring-cyan-500"
                    />
                    <span>Enable Zigbee2MQTT</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Broker URL (e.g. mqtt://127.0.0.1:1883)
                    </label>
                    <input
                      type="text"
                      required
                      value={z2mBrokerUrl}
                      onChange={(e) => setZ2mBrokerUrl(e.target.value)}
                      placeholder="mqtt://127.0.0.1:1883"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Base Topic (default: zigbee2mqtt)
                    </label>
                    <input
                      type="text"
                      required
                      value={z2mBaseTopic}
                      onChange={(e) => setZ2mBaseTopic(e.target.value)}
                      placeholder="zigbee2mqtt"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Username (Optional)
                    </label>
                    <input
                      type="text"
                      value={z2mUsername}
                      onChange={(e) => setZ2mUsername(e.target.value)}
                      placeholder="mosquitto_user"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Password (Optional)
                    </label>
                    <input
                      type="password"
                      value={z2mPassword}
                      onChange={(e) => setZ2mPassword(e.target.value)}
                      placeholder="Leave blank to keep"
                      className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-slate-400">
                    If Home Assistant goes down, devices mapped with Zigbee2MQTT will continue working instantly over MQTT.
                  </p>
                  <button
                    type="submit"
                    disabled={savingZ2mConfig}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 transition-all shrink-0"
                  >
                    {savingZ2mConfig ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                    Save & Reconnect
                  </button>
                </div>
              </form>

              {/* Discovered Zigbee Devices */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" /> Discovered Zigbee Devices ({z2mDevicesList.length})
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Auto-synchronized from <code className="text-cyan-400">{z2mBaseTopic}/bridge/devices</code>
                  </span>
                </div>

                {z2mDevicesList.length === 0 ? (
                  <div className="glass-panel p-8 rounded-2xl border border-dashed border-white/10 text-center space-y-3">
                    <Radio className="w-10 h-10 text-cyan-400/40 mx-auto" />
                    <h5 className="text-sm font-bold text-white">No Zigbee Devices Discovered Yet</h5>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      Make sure your MQTT broker (e.g. Mosquitto on port 1883) and Zigbee2MQTT are running. Once connected, all paired Zigbee devices will appear here automatically.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {z2mDevicesList.map((dev) => {
                      const isCoordinator = dev.type === 'Coordinator';
                      const isMapped = (data?.devices || []).some(
                        (d) => d.z2m_friendly_name === dev.friendly_name || d.name === dev.friendly_name
                      );

                      return (
                        <div
                          key={dev.ieee_address}
                          className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col justify-between gap-3 hover:border-white/20 transition-all"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h5 className="font-bold text-sm text-white flex items-center gap-2">
                                  {dev.friendly_name}
                                  {isCoordinator && (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      COORDINATOR
                                    </span>
                                  )}
                                  {isMapped && (
                                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                      MAPPED IN ROOM
                                    </span>
                                  )}
                                </h5>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  {dev.ieee_address} • {dev.definition?.vendor || 'Generic'} {dev.definition?.model || ''}
                                </p>
                              </div>

                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-white/5">
                                {dev.type}
                              </span>
                            </div>

                            {dev.definition?.description && (
                              <p className="text-[11px] text-slate-300 mt-2 line-clamp-1">
                                {dev.definition.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mt-2.5">
                              {dev.power_source && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-white/5">
                                  Power: {dev.power_source}
                                </span>
                              )}
                              {dev.linkquality !== undefined && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-emerald-400 border border-white/5">
                                  LQI: {dev.linkquality}
                                </span>
                              )}
                            </div>
                          </div>

                          {!isCoordinator && (
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
                              <button
                                type="button"
                                onClick={() => handleTestZ2mToggle(dev.friendly_name)}
                                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                              >
                                <Power className="w-3.5 h-3.5" /> Test Toggle
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  // Open Device Mapping Modal prefilled
                                  const targetRoom = data?.rooms?.[0];
                                  setEditingDevice({
                                    id: '',
                                    room_id: targetRoom?.id || '',
                                    type: dev.definition?.exposes?.some((e: any) => e.type === 'light') ? 'dimmable_light' : 'switch_light',
                                    name: dev.friendly_name,
                                    z2m_friendly_name: dev.friendly_name,
                                    config_json: JSON.stringify({
                                      z2m_friendly_name: dev.friendly_name,
                                      z2m_ieee: dev.ieee_address,
                                      vendor: dev.definition?.vendor,
                                      model: dev.definition?.model,
                                    }),
                                    show_on_default_dashboard: 1,
                                    sort_order: 0,
                                  } as Device);
                                  setDeviceModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors"
                              >
                                {isMapped ? 'Edit Room Mapping' : 'Assign to Room'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Floors, Rooms & Device Mapping */}
          {activeTab === 'floors' && (
            <div className="space-y-6">
              {/* Floor Selector & Management Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                  {(data?.floors || []).map((floor) => {
                    const isSelected = selectedFloorId === floor.id;
                    return (
                      <div
                        key={floor.id}
                        className={`group flex items-center rounded-xl p-1 transition-all ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 shadow-glow font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-white/5'
                        }`}
                      >
                        <button
                          onClick={() => setSelectedFloorId(floor.id)}
                          className="px-3 py-1.5 text-xs font-bold"
                        >
                          {floor.name}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFloor(floor);
                          }}
                          className={`p-1 rounded-lg transition-opacity ${
                            isSelected
                              ? 'text-slate-950/70 hover:text-slate-950'
                              : 'text-slate-500 hover:text-white'
                          }`}
                          title="Edit Floor"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        {(data?.floors || []).length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFloor(floor.id);
                            }}
                            className={`p-1 rounded-lg transition-opacity ${
                              isSelected
                                ? 'text-slate-950/70 hover:text-rose-950'
                                : 'text-slate-500 hover:text-rose-400'
                            }`}
                            title="Delete Floor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setEditingFloor({ name: '', icon: 'Building2', accent_color: 'primary-400' })}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-cyan-400 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 shrink-0 border border-white/5 shadow-sm active:scale-95 transition-all"
                    title="Add New Floor"
                  >
                    <Plus className="w-4 h-4" /> Add Floor
                  </button>
                </div>

                {activeFloor && (
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <span className="text-xs text-slate-400">
                      Active: <strong className="text-white">{activeFloor.name}</strong>
                    </span>
                    <button
                      onClick={() => setEditingFloor(activeFloor)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold flex items-center gap-1 border border-white/10"
                    >
                      <Edit className="w-3 h-3" /> Edit Floor Details
                    </button>
                  </div>
                )}
              </div>

              {/* Rooms in Selected Floor */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-cyan-400" />
                      Rooms in {activeFloor?.name || 'Selected Floor'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {currentFloorRooms.length} {currentFloorRooms.length === 1 ? 'room' : 'rooms'} configured
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {data?.hubs && data.hubs.length > 0 && (
                      <button
                        onClick={() => handleAutoImportFromHub(data.hubs[0].id)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 border border-indigo-500/30 transition-all active:scale-95"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> 1-Click Import from HA
                      </button>
                    )}
                    <button
                      onClick={() =>
                        setEditingRoom({
                          name: '',
                          floor_id: selectedFloorId,
                          icon: 'Briefcase',
                          accent_color: 'primary-400',
                          is_meeting_room: 0,
                        })
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-glow active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Room
                    </button>
                  </div>
                </div>

                {currentFloorRooms.length === 0 ? (
                  <div className="p-8 rounded-2xl glass-panel border border-dashed border-white/15 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
                      <Layers className="w-6 h-6" />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-white">No rooms on this floor yet</h5>
                      <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                        Add rooms like "Conference Room", "CEO Office", or "Main Lobby" to start mapping your smart devices.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        onClick={() =>
                          setEditingRoom({
                            name: '',
                            floor_id: selectedFloorId,
                            icon: 'Briefcase',
                            accent_color: 'primary-400',
                            is_meeting_room: 0,
                          })
                        }
                        className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-glow active:scale-95 transition-all"
                      >
                        <Plus className="w-4 h-4" /> Add First Room
                      </button>
                      {data?.hubs && data.hubs.length > 0 && (
                        <button
                          onClick={() => handleAutoImportFromHub(data.hubs[0].id)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold inline-flex items-center gap-1.5 border border-indigo-500/30"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> 1-Click Import Areas
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {currentFloorRooms.map((room) => {
                      const isSelected = selectedRoomId === room.id;
                      const devCount = (data?.devices || []).filter((d) => d.room_id === room.id).length;
                      return (
                        <div
                          key={room.id}
                          onClick={() => setSelectedRoomId(room.id)}
                          className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                            isSelected
                              ? 'glass-panel-glow border-cyan-500/60 shadow-glow bg-cyan-500/10'
                              : 'glass-panel border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-sm text-white truncate pr-2">{room.name}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingRoom(room);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                                title="Edit Room"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRoom(room.id);
                                }}
                                className="p-1 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                title="Delete Room"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 text-[11px]">
                            <span className="font-mono text-cyan-400">
                              {devCount} {devCount === 1 ? 'device' : 'devices'} mapped
                            </span>
                            {room.is_meeting_room === 1 && (
                              <span className="px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30 font-medium text-[10px]">
                                Meeting Room
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Devices in Selected Room */}
              {selectedRoomId ? (
                <div className="pt-6 border-t border-white/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-white flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-cyan-400" />
                        Devices in "{activeRoom?.name || 'Selected Room'}"
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">Mapped controls & entities for this room</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingDevice(null);
                        setDeviceModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wider shadow-glow flex items-center gap-1.5 active:scale-95 transition-all self-start sm:self-auto"
                    >
                      <Plus className="w-4 h-4" /> Add Device
                    </button>
                  </div>

                  {currentRoomDevices.length === 0 ? (
                    <div className="p-6 rounded-2xl glass-panel border border-dashed border-white/10 text-center space-y-2">
                      <p className="text-xs text-slate-400">No devices mapped in this room yet.</p>
                      <button
                        onClick={() => {
                          setEditingDevice(null);
                          setDeviceModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" /> Map First Device
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {currentRoomDevices.map((dev) => (
                        <div
                          key={dev.id}
                          className="glass-panel p-3.5 rounded-xl border border-white/10 hover:border-white/20 flex items-center justify-between transition-all"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-bold text-xs text-white block truncate">{dev.name}</span>
                            <span className="text-[10px] font-mono text-cyan-400 uppercase">{dev.type}</span>
                            {dev.entity_id && (
                              <span className="text-[9px] font-mono text-slate-400 block truncate max-w-[170px]">
                                {dev.entity_id}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => {
                                setEditingDevice(dev);
                                setDeviceModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                              title="Edit Device"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDevice(dev.id)}
                              className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                              title="Delete Device"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : currentFloorRooms.length > 0 ? (
                <div className="pt-6 border-t border-white/10 text-center py-6 text-xs text-slate-400">
                  Select a room above to view and manage its mapped devices.
                </div>
              ) : null}
            </div>
          )}

          {/* TAB 3: CCTV & Go2RTC */}
          {activeTab === 'cameras' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-cyan-400" />
                    Go2RTC CCTV Cameras
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>Connect RTSP IP cameras and manage WebRTC stream IDs ({data?.cameras?.length || 0} configured)</span>
                    <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/50 px-2 py-0.5 rounded-md">
                      Gateway: {data?.config?.go2rtc_base_url || 'http://127.0.0.1:1984'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingCamera({
                      name: '',
                      stream_id: `cam${(data?.cameras || []).length + 1}`,
                      full_stream_id: `cam${(data?.cameras || []).length + 1}F`,
                      rtsp_sub_url: '',
                      rtsp_main_url: '',
                      search_tags: '',
                      sort_order: (data?.cameras || []).length,
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 active:scale-95 transition-all self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" /> Add Camera
                </button>
              </div>

              {(data?.cameras || []).length === 0 ? (
                <div className="p-8 rounded-2xl glass-panel border border-dashed border-white/15 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/20">
                    <Video className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-white">No cameras configured yet</h5>
                    <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                      Add RTSP cameras from Hikvision, Dahua, CP Plus, Reolink, or Uniview. Go2RTC converts them into instant, zero-latency WebRTC streams.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setEditingCamera({
                        name: '',
                        stream_id: 'cam1',
                        full_stream_id: 'cam1F',
                        rtsp_sub_url: '',
                        rtsp_main_url: '',
                        search_tags: '',
                        sort_order: 0,
                      })
                    }
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-glow active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add First Camera
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(data?.cameras || []).map((cam) => {
                    const assignedFloor = (data?.floors || []).find((f) => f.id === cam.floor_id);
                    const assignedRoom = (data?.rooms || []).find((r) => r.id === cam.room_id);

                    return (
                      <div
                        key={cam.id}
                        className="glass-panel p-4 rounded-2xl border border-white/10 hover:border-white/20 flex items-start justify-between gap-3 transition-all"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm truncate">{cam.name}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              {cam.stream_id}
                            </span>
                            {cam.full_stream_id && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300">
                                HD: {cam.full_stream_id}
                              </span>
                            )}
                            {cam.ptz_enabled !== 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                PTZ
                              </span>
                            )}
                          </div>

                          {(assignedFloor || assignedRoom) && (
                            <p className="text-[11px] text-slate-400">
                              Location: <span className="text-slate-300">{assignedFloor?.name || ''}</span>
                              {assignedRoom && <span> &bull; {assignedRoom.name}</span>}
                            </p>
                          )}

                          {cam.rtsp_sub_url ? (
                            <p className="text-[10px] font-mono text-slate-400 truncate max-w-sm">
                              Sub: <span className="text-slate-300">{cam.rtsp_sub_url}</span>
                            </p>
                          ) : (
                            <p className="text-[10px] font-mono text-amber-400/80">
                              Direct stream ID without local RTSP URL
                            </p>
                          )}

                          {cam.rtsp_main_url && (
                            <p className="text-[10px] font-mono text-slate-400 truncate max-w-sm">
                              Main HD: <span className="text-slate-300">{cam.rtsp_main_url}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setEditingCamera(cam)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                            title="Edit Camera"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCamera(cam.id)}
                            className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                            title="Delete Camera"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TTLock & HR */}
          {activeTab === 'ttlock' && (
            <div className="space-y-6">
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white">TTLock Smart Door Gateway</h3>
                    <p className="text-xs text-slate-400">Connect to TTLock Open API and pull all registered doors</p>
                  </div>
                  <button
                    onClick={handleSyncTtlock}
                    disabled={syncingTtlock}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5"
                  >
                    {syncingTtlock ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Connect & Sync Locks
                  </button>
                </div>

                {ttlockResult?.locks && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase">Synced Locks ({ttlockResult.totalLocks})</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {ttlockResult.locks.map((lk: any) => (
                        <div key={lk.lockId} className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-xs text-white">{lk.lockName}</span>
                            <span className="text-[10px] font-mono text-cyan-400 block">ID: {lk.lockId}</span>
                          </div>
                          <span className="text-xs font-mono text-emerald-400">{lk.electricQuantity}% Battery</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: IR Profiles */}
          {activeTab === 'ir' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Base64 AC IR Command Profiles</h3>
                  <p className="text-xs text-slate-400">Zigbee2MQTT Base64 command maps for air conditioners</p>
                </div>
                <button
                  onClick={() => {
                    setEditingIrProfile(null);
                    setIrModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Create Profile
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(data?.ir_profiles || []).map((prof) => (
                  <div key={prof.id} className="glass-panel p-4 rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{prof.name}</h4>
                      <p className="text-xs font-mono text-cyan-400">{prof.brand || 'Universal'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingIrProfile(prof);
                        setIrModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold"
                    >
                      Open Learner
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: Automations */}
          {activeTab === 'automations' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-cyan-400" /> Automations & Scheduled Scenes
                  </h3>
                  <p className="text-xs text-slate-400">
                    Configure triggers, cron schedules, occupancy events, and multi-device action macros in Admin Studio
                  </p>
                </div>
                <button
                  onClick={handleNewAutomation}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Automation
                </button>
              </div>

              {/* Add / Edit Automation Form */}
              {editingAutomation && (
                <form
                  onSubmit={handleSaveAutomation}
                  className="glass-panel p-6 rounded-2xl border border-cyan-500/40 space-y-5 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      {editingAutomation.id ? 'Edit Automation / Scene' : 'Create New Automation / Scene'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingAutomation(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Automation / Scene Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Morning AC & Light Pre-cool"
                        value={autoName}
                        onChange={(e) => setAutoName(e.target.value)}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-5">
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-300">
                        <input
                          type="checkbox"
                          checked={autoEnabled}
                          onChange={(e) => setAutoEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-cyan-500 bg-slate-900 border-white/20 focus:ring-cyan-500"
                        />
                        <span>Enable Scheduler (Active)</span>
                      </label>
                    </div>
                  </div>

                  {/* Trigger Configuration */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-3">
                    <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">
                      Trigger Type
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setAutoTriggerType('time')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          autoTriggerType === 'time'
                            ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold shadow-glow'
                            : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold mb-1">
                          <Clock className="w-4 h-4 text-cyan-400" /> Scheduled Time
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Runs automatically at a specific time (cron)
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAutoTriggerType('presence')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          autoTriggerType === 'presence'
                            ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold shadow-glow'
                            : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold mb-1">
                          <Radio className="w-4 h-4 text-emerald-400" /> Occupancy / Sensor
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Triggers when presence or motion is detected
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAutoTriggerType('manual')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          autoTriggerType === 'manual'
                            ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold shadow-glow'
                            : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-bold mb-1">
                          <Wand2 className="w-4 h-4 text-indigo-400" /> Manual Scene Only
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          Triggered on-demand from the dashboard
                        </p>
                      </button>
                    </div>

                    {autoTriggerType === 'time' && (
                      <div className="pt-2 space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Scheduled Time (24-hour format)
                          </label>
                          <input
                            type="time"
                            value={autoTriggerTime}
                            onChange={(e) => setAutoTriggerTime(e.target.value)}
                            className="glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                            Active Days of the Week
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { day: 1, label: 'Mon' },
                              { day: 2, label: 'Tue' },
                              { day: 3, label: 'Wed' },
                              { day: 4, label: 'Thu' },
                              { day: 5, label: 'Fri' },
                              { day: 6, label: 'Sat' },
                              { day: 0, label: 'Sun' },
                            ].map((d) => {
                              const isSelected = autoTriggerDays.includes(d.day);
                              return (
                                <button
                                  key={d.day}
                                  type="button"
                                  onClick={() => {
                                    if (autoTriggerDays.includes(d.day)) {
                                      if (autoTriggerDays.length > 1) {
                                        setAutoTriggerDays(autoTriggerDays.filter((x) => x !== d.day));
                                      }
                                    } else {
                                      setAutoTriggerDays([...autoTriggerDays, d.day].sort());
                                    }
                                  }}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    isSelected
                                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                                      : 'bg-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {autoTriggerType === 'presence' && (
                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Triggering Occupancy / Presence Sensor
                        </label>
                        <select
                          value={autoTriggerDeviceId}
                          onChange={(e) => setAutoTriggerDeviceId(e.target.value)}
                          className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                        >
                          {(data?.devices || [])
                            .filter((d) => d.type === 'presence_sensor' || d.type.includes('sensor'))
                            .map((d) => {
                              const room = (data?.rooms || []).find((r) => r.id === d.room_id);
                              return (
                                <option key={d.id} value={d.id} className="bg-slate-900">
                                  {room ? `${room.name} • ` : ''}{d.name} ({d.entity_id || d.type})
                                </option>
                              );
                            })}
                          {(data?.devices || []).length === 0 && (
                            <option value="" className="bg-slate-900">No sensors discovered</option>
                          )}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Action Steps */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                        Action Steps ({autoSteps.length})
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const firstDevId = (data?.devices || [])[0]?.id || '';
                          setAutoSteps([...autoSteps, { device_id: firstDevId, action: 'turn_on' }]);
                        }}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Step
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {autoSteps.map((st, idx) => (
                        <div
                          key={idx}
                          className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 bg-slate-900/80 p-3 rounded-xl border border-white/5"
                        >
                          <span className="text-xs font-mono text-slate-500 font-bold w-5 shrink-0 text-center">
                            {idx + 1}
                          </span>

                          <select
                            value={st.device_id}
                            onChange={(e) => {
                              const next = [...autoSteps];
                              next[idx].device_id = e.target.value;
                              const availableActions = getActionOptionsForDevice(e.target.value);
                              if (availableActions.length > 0 && !availableActions.some((a) => a.value === next[idx].action)) {
                                next[idx].action = availableActions[0].value;
                              }
                              setAutoSteps(next);
                            }}
                            className="flex-1 min-w-[200px] glass-input rounded-lg px-2.5 py-1.5 text-xs text-white"
                          >
                            {(data?.devices || []).map((d) => {
                              const room = (data?.rooms || []).find((r) => r.id === d.room_id);
                              return (
                                <option key={d.id} value={d.id} className="bg-slate-900">
                                  {room ? `${room.name} • ` : ''}{d.name} ({d.type})
                                </option>
                              );
                            })}
                          </select>

                          <select
                            value={st.action}
                            onChange={(e) => {
                              const next = [...autoSteps];
                              next[idx].action = e.target.value;
                              setAutoSteps(next);
                            }}
                            className="w-36 glass-input rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                          >
                            {getActionOptionsForDevice(st.device_id).map((opt) => (
                              <option key={opt.value} value={opt.value} className="bg-slate-900">
                                {opt.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => setAutoSteps(autoSteps.filter((_, i) => i !== idx))}
                            className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      {autoSteps.length === 0 && (
                        <p className="text-xs text-slate-500 italic p-3 text-center border border-dashed border-white/10 rounded-xl">
                          No steps added yet. Click &quot;Add Step&quot; above to add device actions.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Form Action Buttons */}
                  <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditingAutomation(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingAutomation}
                      className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5 transition-all"
                    >
                      {savingAutomation ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                      {editingAutomation.id ? 'Save Changes' : 'Create Automation'}
                    </button>
                  </div>
                </form>
              )}

              {/* Automations List */}
              <div className="space-y-3">
                {(data?.automations || []).length === 0 ? (
                  <div className="glass-panel p-8 rounded-2xl border border-dashed border-white/10 text-center space-y-3">
                    <Wand2 className="w-10 h-10 text-cyan-400/50 mx-auto" />
                    <h4 className="text-sm font-bold text-white">No Automations Configured</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Automate lighting schedules, AC pre-cooling, sensor-driven occupancy routines, or manual multi-device scenes.
                    </p>
                    <button
                      onClick={handleNewAutomation}
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-glow inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" /> Create Your First Automation
                    </button>
                  </div>
                ) : (
                  (data?.automations || []).map((auto) => {
                    let tr: any = {};
                    try { tr = JSON.parse(auto.trigger_json || '{}'); } catch (_) {}
                    let stepCount = 0;
                    try {
                      const st = JSON.parse(auto.steps_json || auto.actions_json || '[]');
                      stepCount = Array.isArray(st) ? st.length : 0;
                    } catch (_) {}

                    const isRunning = runningAutoId === auto.id;

                    return (
                      <div
                        key={auto.id}
                        className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/20 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <h4 className="font-bold text-white text-sm">{auto.name}</h4>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                auto.enabled
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-slate-800 text-slate-500 border border-white/5'
                              }`}
                            >
                              {auto.enabled ? 'ACTIVE' : 'DISABLED'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-white/5 flex items-center gap-1">
                              {tr.type === 'time' ? (
                                <>
                                  <Clock className="w-3 h-3" /> Daily at {tr.time}
                                </>
                              ) : tr.type === 'presence' ? (
                                <>
                                  <Radio className="w-3 h-3 text-emerald-400" /> Sensor Trigger
                                </>
                              ) : (
                                <>
                                  <Wand2 className="w-3 h-3 text-indigo-400" /> Manual Scene
                                </>
                              )}
                            </span>

                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-white/5">
                              {stepCount} {stepCount === 1 ? 'Action Step' : 'Action Steps'}
                            </span>

                            <span className="text-[11px] text-slate-400 font-mono">
                              {auto.last_run_at
                                ? `Last run: ${new Date(auto.last_run_at).toLocaleTimeString()}`
                                : 'Never executed'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRunAutomation(auto.id)}
                            disabled={isRunning}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                          >
                            {isRunning ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                            {isRunning ? 'Running...' : 'Run Test'}
                          </button>

                          <button
                            onClick={() => handleToggleAutomation(auto)}
                            title={auto.enabled ? 'Disable automation' : 'Enable automation'}
                            className={`p-2 rounded-lg transition-colors ${
                              auto.enabled
                                ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {auto.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleEditAutomation(auto)}
                            title="Edit automation"
                            className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteAutomation(auto)}
                            title="Delete automation"
                            className="p-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 7: Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white">1-Click JSON Backup & Restore</h3>
              <p className="text-xs text-slate-400">
                Export your entire SQLite database configuration to a single portable JSON file, or clone an existing office setup.
              </p>

              <div className="flex items-center gap-4 pt-2">
                <button
                  onClick={handleExportConfig}
                  className="px-5 py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Export Configuration (.json)
                </button>

                <label className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/10 flex items-center gap-2 cursor-pointer">
                  <Upload className="w-4 h-4 text-cyan-400" /> Import Configuration (.json)
                  <input type="file" accept=".json" onChange={handleImportConfig} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* TAB 8: Settings */}
          {activeTab === 'settings' && (
            <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-white">General Building Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Building / Facility Name</label>
                  <input
                    type="text"
                    value={buildingName}
                    onChange={(e) => setBuildingName(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">AI Assistant Name</label>
                  <input
                    type="text"
                    value={assistantName}
                    onChange={(e) => setAssistantName(e.target.value)}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Latitude</label>
                  <input
                    type="number"
                    value={weatherLat}
                    onChange={(e) => setWeatherLat(Number(e.target.value))}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Longitude</label>
                  <input
                    type="number"
                    value={weatherLon}
                    onChange={(e) => setWeatherLon(Number(e.target.value))}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Go2RTC Server Gateway URL (Zero-latency WebRTC / RTSP)
                  </label>
                  <input
                    type="text"
                    value={go2rtcBaseUrl}
                    onChange={(e) => setGo2rtcBaseUrl(e.target.value)}
                    placeholder="http://127.0.0.1:1984"
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    URL of the Go2RTC server instance (e.g. <code className="text-cyan-300">http://127.0.0.1:1984</code> or LAN IP <code className="text-cyan-300">http://192.168.1.50:1984</code>).
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="reqHk"
                  checked={requireHomeKey}
                  onChange={(e) => setRequireHomeKey(e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-cyan-400"
                />
                <label htmlFor="reqHk" className="text-xs text-slate-300">
                  Require HomeKey Security Gate on New Devices
                </label>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleSaveSettings}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          )}



        </div>
      </div>

      {/* Floor Modal */}
      {editingFloor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md glass-panel rounded-2xl border border-white/20 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  {editingFloor.id ? 'Edit Floor' : 'Add New Floor'}
                </h3>
              </div>
              <button
                onClick={() => setEditingFloor(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFloor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Floor Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ground Floor, 1st Floor, Executive Floor"
                  value={editingFloor.name || ''}
                  onChange={(e) =>
                    setEditingFloor({
                      ...editingFloor,
                      name: e.target.value,
                      slug: editingFloor.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    })
                  }
                  className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Slug / Zone Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. ground-floor, executive-floor"
                  value={editingFloor.slug || ''}
                  onChange={(e) => setEditingFloor({ ...editingFloor, slug: e.target.value })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-cyan-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Icon
                  </label>
                  <select
                    value={editingFloor.icon || 'Building2'}
                    onChange={(e) => setEditingFloor({ ...editingFloor, icon: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Building2" className="bg-slate-900">Building2 (Office)</option>
                    <option value="Layers" className="bg-slate-900">Layers (Floor)</option>
                    <option value="Briefcase" className="bg-slate-900">Briefcase (Corporate)</option>
                    <option value="Home" className="bg-slate-900">Home (Residential)</option>
                    <option value="Sparkles" className="bg-slate-900">Sparkles (VIP / Executive)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Accent Color
                  </label>
                  <select
                    value={editingFloor.accent_color || 'primary-400'}
                    onChange={(e) => setEditingFloor({ ...editingFloor, accent_color: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="primary-400" className="bg-slate-900">Cyan / Brand</option>
                    <option value="emerald-400" className="bg-slate-900">Emerald Green</option>
                    <option value="indigo-400" className="bg-slate-900">Indigo / Violet</option>
                    <option value="amber-400" className="bg-slate-900">Amber / Gold</option>
                    <option value="rose-400" className="bg-slate-900">Rose / Crimson</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={editingFloor.sort_order ?? 0}
                  onChange={(e) => setEditingFloor({ ...editingFloor, sort_order: Number(e.target.value) })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingFloor(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow hover:opacity-90 active:scale-95 transition-all"
                >
                  Save Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Room Modal */}
      {editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md glass-panel rounded-2xl border border-white/20 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  {editingRoom.id ? 'Edit Room' : 'Add New Room'}
                </h3>
              </div>
              <button
                onClick={() => setEditingRoom(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Room Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Conference Room A, CEO Office, Pantry"
                  value={editingRoom.name || ''}
                  onChange={(e) =>
                    setEditingRoom({
                      ...editingRoom,
                      name: e.target.value,
                      slug: editingRoom.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    })
                  }
                  className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Floor Assignment <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={editingRoom.floor_id || selectedFloorId}
                    onChange={(e) => setEditingRoom({ ...editingRoom, floor_id: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                    required
                  >
                    {(data?.floors || []).map((fl) => (
                      <option key={fl.id} value={fl.id} className="bg-slate-900">
                        {fl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    HA Hub Link
                  </label>
                  <select
                    value={editingRoom.ha_hub_id || ''}
                    onChange={(e) => setEditingRoom({ ...editingRoom, ha_hub_id: e.target.value || null })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="" className="bg-slate-900">Primary / Auto</option>
                    {(data?.hubs || []).map((h) => (
                      <option key={h.id} value={h.id} className="bg-slate-900">
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Slug / Zone Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. conference-room-a, ceo-office"
                  value={editingRoom.slug || ''}
                  onChange={(e) => setEditingRoom({ ...editingRoom, slug: e.target.value })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-cyan-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Icon
                  </label>
                  <select
                    value={editingRoom.icon || 'Briefcase'}
                    onChange={(e) => setEditingRoom({ ...editingRoom, icon: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Briefcase" className="bg-slate-900">Briefcase (Office)</option>
                    <option value="Users" className="bg-slate-900">Users (Meeting/Conf)</option>
                    <option value="Monitor" className="bg-slate-900">Monitor (Workstation)</option>
                    <option value="Coffee" className="bg-slate-900">Coffee (Pantry / Break)</option>
                    <option value="Lock" className="bg-slate-900">Lock (Server / Secure)</option>
                    <option value="Shield" className="bg-slate-900">Shield (Reception / Guard)</option>
                    <option value="Layers" className="bg-slate-900">Layers (General)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Accent Color
                  </label>
                  <select
                    value={editingRoom.accent_color || 'primary-400'}
                    onChange={(e) => setEditingRoom({ ...editingRoom, accent_color: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="primary-400" className="bg-slate-900">Cyan / Brand</option>
                    <option value="emerald-400" className="bg-slate-900">Emerald Green</option>
                    <option value="indigo-400" className="bg-slate-900">Indigo / Violet</option>
                    <option value="amber-400" className="bg-slate-900">Amber / Gold</option>
                    <option value="rose-400" className="bg-slate-900">Rose / Crimson</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isMeetingRoom"
                  checked={editingRoom.is_meeting_room === 1}
                  onChange={(e) =>
                    setEditingRoom({
                      ...editingRoom,
                      is_meeting_room: e.target.checked ? 1 : 0,
                    })
                  }
                  className="rounded bg-slate-800 border-white/20 text-cyan-400 focus:ring-cyan-500"
                />
                <label htmlFor="isMeetingRoom" className="text-xs text-slate-300 font-medium cursor-pointer">
                  Conference / Meeting Room (Enables room booking & calendar displays)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow hover:opacity-90 active:scale-95 transition-all"
                >
                  Save Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {editingCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg glass-panel rounded-2xl border border-white/20 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Video className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  {editingCamera.id ? 'Edit CCTV Camera' : 'Add New CCTV Camera'}
                </h3>
              </div>
              <button
                onClick={() => setEditingCamera(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCamera} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Camera Friendly Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reception Desk, Main Lobby, Parking Area"
                  value={editingCamera.name || ''}
                  onChange={(e) => setEditingCamera({ ...editingCamera, name: e.target.value })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Stream ID (Low Latency / Multi-view) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. cam1, cam2"
                    value={editingCamera.stream_id || ''}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                      setEditingCamera({
                        ...editingCamera,
                        stream_id: val,
                        full_stream_id: editingCamera.full_stream_id || `${val}F`,
                      });
                    }}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-cyan-300"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Go2RTC stream identifier</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full HD Stream ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. cam1F, cam2F"
                    value={editingCamera.full_stream_id || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, full_stream_id: e.target.value })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-indigo-300"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Used for fullscreen view</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  RTSP Sub-Stream URL (Recommended for grid viewing)
                </label>
                <input
                  type="text"
                  placeholder="rtsp://admin:pass@192.168.0.100:554/Streaming/Channels/102"
                  value={editingCamera.rtsp_sub_url || ''}
                  onChange={(e) => setEditingCamera({ ...editingCamera, rtsp_sub_url: e.target.value })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Lower resolution stream (e.g. 640x360 / 720p) for smooth simultaneous multi-camera playback.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  RTSP Main HD Stream URL (Optional for 1080p/4K fullscreen)
                </label>
                <input
                  type="text"
                  placeholder="rtsp://admin:pass@192.168.0.100:554/Streaming/Channels/101"
                  value={editingCamera.rtsp_main_url || ''}
                  onChange={(e) => setEditingCamera({ ...editingCamera, rtsp_main_url: e.target.value })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign to Floor (Optional)
                  </label>
                  <select
                    value={editingCamera.floor_id || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, floor_id: e.target.value || null })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="" className="bg-slate-900">None / All Floors</option>
                    {(data?.floors || []).map((f) => (
                      <option key={f.id} value={f.id} className="bg-slate-900">
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Assign to Room (Optional)
                  </label>
                  <select
                    value={editingCamera.room_id || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, room_id: e.target.value || null })}
                    className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="" className="bg-slate-900">None</option>
                    {(data?.rooms || []).map((r) => (
                      <option key={r.id} value={r.id} className="bg-slate-900">
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Search Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. entrance, reception, lobby, gate"
                  value={editingCamera.search_tags || ''}
                  onChange={(e) => setEditingCamera({ ...editingCamera, search_tags: e.target.value })}
                  className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {/* ONVIF PTZ Controls Section */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">ONVIF Pan / Tilt (PTZ) Control</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingCamera.ptz_enabled !== 0}
                      onChange={(e) =>
                        setEditingCamera({ ...editingCamera, ptz_enabled: e.target.checked ? 1 : 0 })
                      }
                      className="rounded text-cyan-500 focus:ring-0"
                    />
                    <span className="text-xs text-slate-300 font-semibold">Enable Rotation</span>
                  </label>
                </div>

                {editingCamera.ptz_enabled !== 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-white/5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        ONVIF Service URL
                      </label>
                      <input
                        type="text"
                        placeholder="http://192.168.0.176:2020/onvif/device_service"
                        value={editingCamera.onvif_url || ''}
                        onChange={(e) => setEditingCamera({ ...editingCamera, onvif_url: e.target.value })}
                        className="w-full glass-input rounded-xl px-3 py-2 text-xs font-mono text-slate-200"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        Direct ONVIF port (e.g. port 2020 for Tapo, 80/8899 for Hikvision/Dahua).
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          ONVIF Username
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. bezlin, admin"
                          value={editingCamera.onvif_user || ''}
                          onChange={(e) => setEditingCamera({ ...editingCamera, onvif_user: e.target.value })}
                          className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          ONVIF Password
                        </label>
                        <input
                          type="password"
                          placeholder="Camera password"
                          value={editingCamera.onvif_pass || ''}
                          onChange={(e) => setEditingCamera({ ...editingCamera, onvif_pass: e.target.value })}
                          className="w-full glass-input rounded-xl px-3 py-2 text-xs text-white"
                        />
                      </div>
                    </div>

                    {editingCamera.id && (
                      <div className="pt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              showStatus('Testing PTZ rotation...');
                              await ApiService.ptzCamera(editingCamera.id!, { direction: 'right', speed: 0.3, durationMs: 400 });
                              setTimeout(async () => {
                                await ApiService.ptzCamera(editingCamera.id!, { direction: 'left', speed: 0.3, durationMs: 400 });
                              }, 600);
                              showStatus('PTZ Rotation Verified!');
                            } catch (err: any) {
                              showStatus(`PTZ test failed: ${err.message}`, true);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold hover:bg-cyan-500/30 transition-all flex items-center gap-1.5"
                        >
                          <Compass className="w-3.5 h-3.5" /> Test Rotation
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingCamera(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow hover:opacity-90 active:scale-95 transition-all"
                >
                  Save Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Device Mapping Modal */}
      <DeviceMappingModal
        isOpen={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        roomId={selectedRoomId}
        rooms={data?.rooms || []}
        hubs={data?.hubs || []}
        irProfiles={data?.ir_profiles || []}
        onSave={handleSaveDevice}
        initialDevice={editingDevice}
        onOpenIrEditor={() => {
          setDeviceModalOpen(false);
          setIrModalOpen(true);
        }}
      />

      {/* IR Profile Editor Modal */}
      <IrCodeEditorModal
        isOpen={irModalOpen}
        onClose={() => setIrModalOpen(false)}
        hubs={data?.hubs || []}
        initialProfile={editingIrProfile}
        onSaved={refreshBootstrap}
      />

      {/* Discovered Entities Browser Modal */}
      {browsingHub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[85vh] glass-panel rounded-3xl p-6 border border-white/20 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ListFilter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Discovered Entities from {browsingHub.name}
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-mono">
                      {discoveredEntities.length} Total
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">{browsingHub.local_url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleAutoImportFromHub(browsingHub.id);
                    setBrowsingHub(null);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" /> 1-Click Import All
                </button>
                <button
                  onClick={() => setBrowsingHub(null)}
                  className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="py-3 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'light', 'switch', 'sensor', 'other'] as const).map((cat) => {
                  const count = discoveredEntities.filter((e) => {
                    if (cat === 'all') return true;
                    if (cat === 'other') return !['light', 'switch', 'sensor'].includes(e.domain);
                    return e.domain === cat;
                  }).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setEntityFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                        entityFilter === cat
                          ? 'bg-cyan-500 text-slate-950 shadow-glow'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search entity_id or name..."
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white font-mono placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Entities List */}
            <div className="flex-1 overflow-y-auto py-2 space-y-1.5">
              {loadingEntities ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" /> Scanning Home Assistant entities...
                </div>
              ) : discoveredEntities.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No entities discovered on this hub yet. Make sure HA URL and token are correct.
                </div>
              ) : (
                discoveredEntities
                  .filter((ent) => {
                    if (entityFilter !== 'all') {
                      if (entityFilter === 'other' && ['light', 'switch', 'sensor'].includes(ent.domain)) return false;
                      if (entityFilter !== 'other' && ent.domain !== entityFilter) return false;
                    }
                    if (entitySearch.trim()) {
                      const q = entitySearch.toLowerCase();
                      return (
                        ent.entity_id.toLowerCase().includes(q) ||
                        (ent.friendly_name || '').toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .slice(0, 150)
                  .map((ent) => (
                    <div
                      key={ent.entity_id}
                      className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white truncate">{ent.friendly_name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 shrink-0">
                            {ent.domain}
                          </span>
                          {ent.area_name && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0">
                              {ent.area_name}
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[11px] text-cyan-400/80 truncate mt-0.5">{ent.entity_id}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-slate-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                          {ent.state}
                        </span>
                        {ent.is_mapped ? (
                          <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[11px] font-bold border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Mapped
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              let devType: DeviceType = 'switch_light';
                              if (ent.domain === 'light') devType = 'dimmable_light';
                              else if (ent.domain === 'climate') devType = 'climate';
                              else if (ent.domain === 'cover') devType = 'cover';
                              else if (ent.domain === 'binary_sensor' && (ent.entity_id.includes('presence') || ent.entity_id.includes('occupancy'))) devType = 'presence_sensor';
                              else if (ent.domain === 'fan') devType = 'exhaust_fan';

                              setEditingDevice({
                                id: '',
                                room_id: selectedRoomId || data?.rooms[0]?.id || '',
                                ha_hub_id: browsingHub.id,
                                type: devType,
                                name: ent.friendly_name || ent.entity_id,
                                subtitle: ent.domain,
                                entity_id: ent.entity_id,
                                config_json: '{}',
                                show_on_default_dashboard: 1,
                                sort_order: 0,
                              });
                              setBrowsingHub(null);
                              setDeviceModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-300 text-[11px] font-semibold flex items-center gap-1 border border-cyan-500/30"
                          >
                            <Plus className="w-3 h-3" /> Map to Room
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
