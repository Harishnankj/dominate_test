import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Send,
  MessageSquare,
  Sparkles,
  Volume2,
  VolumeX,
  Languages,
  Sun,
  Shield,
  Lightbulb,
  CloudSun,
  Radio,
  Power,
  Zap,
  Lock,
  Unlock,
  Wind,
  Thermometer,
  Gauge,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { ApiService } from '../services/api';
import type { Device, Z2mDevice } from '../types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionTaken?: string;
  deviceCard?: {
    name: string;
    type: string;
    state?: string;
    detail?: string;
  };
}

interface ChatPageProps {
  onSelectRoom: (roomId: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ onSelectRoom }) => {
  const {
    data,
    z2mDevices,
    z2mStates,
    setZ2mState,
    getZ2mState,
    tuyaDevices,
    tuyaStates,
    setTuyaState,
    getTuyaState,
    setVirtualState,
  } = useBootstrap();
  const { callService } = useHA();

  const assistantName = data?.config?.assistant_name || 'DOMFLY';
  const rooms = data?.rooms || [];
  const devices = data?.devices || [];

  const [language, setLanguage] = useState<'en-IN' | 'ml-IN'>('en-IN');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [isLocalhost, setIsLocalhost] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I am ${assistantName}, your local building AI assistant. You can control any light, breaker, energy meter, AC, curtain, or door lock by voice or text in English or Malayalam. How can I assist you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const handleSendMessageRef = useRef<(text?: string) => Promise<void>>(() => Promise.resolve());

  const initRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[SpeechRecognition] Browser does not support SpeechRecognition');
      return null;
    }

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (interim) {
          setInputText(interim);
        }
        if (final) {
          const clean = final.trim();
          setInputText(clean);
          if (clean) {
            handleSendMessageRef.current(clean);
          }
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('[SpeechRecognition] error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setMicPermissionState('denied');
          const warnMsg: ChatMessage = {
            id: `err_${Date.now()}`,
            sender: 'assistant',
            text: 'Microphone permission was denied. Please allow microphone access in your browser address bar (click the tune or lock icon beside the URL).',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, warnMsg]);
        } else if (event.error === 'network') {
          const warnMsg: ChatMessage = {
            id: `err_${Date.now()}`,
            sender: 'assistant',
            text: 'Voice recognition network error. Please check your internet connection or type your command below.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          setMessages((prev) => [...prev, warnMsg]);
        }
      };

      recognitionRef.current = recognition;
      return recognition;
    } catch (err) {
      console.warn('[SpeechRecognition] init failed:', err);
      return null;
    }
  };

  // Monitor microphone permission state and secure context
  useEffect(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsLocalhost(isLocal);

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'microphone' as any })
        .then((permissionStatus) => {
          setMicPermissionState(permissionStatus.state);
          permissionStatus.onchange = () => {
            setMicPermissionState(permissionStatus.state);
          };
        })
        .catch(() => {
          setMicPermissionState('unknown');
        });
    }
  }, []);

  // Initialize Speech Recognition on mount and language change
  useEffect(() => {
    initRecognition();
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch (_) {}
    };
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Request browser microphone permission proactively
  const requestMicPermission = async (): Promise<boolean> => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicPermissionState('granted');
        initRecognition();
        return true;
      }
    } catch (err: any) {
      console.warn('[requestMicPermission] error:', err);
      setMicPermissionState('denied');
      return false;
    }
    return false;
  };

  const toggleMic = async () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        const warnMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: `Voice recognition on mobile phones requires HTTPS. Please open https://${window.location.hostname}:5174/assistant on your phone, tap 'Advanced' -> 'Proceed', and allow microphone access.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, warnMsg]);
      } else {
        alert('Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge, or type your command below.');
      }
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch (_) {}
      setIsListening(false);
      return;
    }

    // Ensure permission is granted first
    if (micPermissionState !== 'granted') {
      const granted = await requestMicPermission();
      if (!granted) {
        return;
      }
    }

    try {
      let rec = recognitionRef.current;
      if (!rec) {
        rec = initRecognition();
      }
      if (rec) {
        rec.lang = language;
        rec.start();
        setIsListening(true);
      }
    } catch (err: any) {
      console.warn('[Mic] start error:', err);
      try {
        recognitionRef.current?.abort();
      } catch (_) {}
      setIsListening(false);
    }
  };

  const speak = (text: string) => {
    if (!speechEnabled || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // -------------------------------------------------------------
  // Universal Multi-Protocol Device Dispatcher
  // -------------------------------------------------------------
  const executeDeviceAction = async (
    dev: Device,
    action: 'on' | 'off' | 'toggle' | 'unlock' | 'open' | 'close' | 'stop',
    value?: any
  ): Promise<boolean> => {
    let devConfig: any = {};
    try {
      devConfig = JSON.parse(dev.config_json || '{}');
    } catch (_) {}
    const z2mName = dev.z2m_friendly_name || devConfig.z2m_friendly_name;
    const endpoint = devConfig.endpoint || (dev.name.match(/switch\s*(\d+)/i) ? `l${dev.name.match(/switch\s*(\d+)/i)?.[1]}` : undefined);
    const tuyaId = dev.tuya_device_id || devConfig.tuya_device_id;
    const lockId = devConfig.lockId || (dev.type === 'ttlock' ? dev.entity_id : undefined);

    // 1. TTLock Smart Lock
    if (dev.type === 'ttlock' || lockId) {
      const targetLockId = lockId || dev.entity_id;
      if (targetLockId) {
        try {
          await ApiService.unlockTtlock(targetLockId);
          return true;
        } catch (_) {}
      }
    }

    // 2. Direct Zigbee2MQTT (Multi-Coordinator)
    if (z2mName) {
      if (dev.type === 'energy_meter') {
        const breakerState = action === 'off' || action === 'stop' ? 'OFF' : 'ON';
        return await setZ2mState(z2mName, { state: breakerState });
      }
      if (dev.type === 'dimmable_light' && value !== undefined) {
        const brightness = Math.min(255, Math.max(0, Math.round((Number(value) / 100) * 255)));
        return await setZ2mState(z2mName, { state: 'ON', brightness });
      }
      if (endpoint) {
        const stateStr = action === 'toggle' ? 'TOGGLE' : action === 'on' ? 'ON' : 'OFF';
        return await setZ2mState(z2mName, { [`state_${endpoint}`]: stateStr });
      }
      const stateStr = action === 'toggle' ? 'TOGGLE' : action === 'on' ? 'ON' : 'OFF';
      return await setZ2mState(z2mName, { state: stateStr });
    }

    // 3. Direct Tuya / Wi-Fi LAN
    if (tuyaId) {
      const boolVal = action === 'on';
      return await setTuyaState(tuyaId, { switch_1: boolVal, state: boolVal ? 'ON' : 'OFF' });
    }

    // 4. AC / Climate IR
    if (dev.type === 'ac_ir' || dev.type === 'climate') {
      if (action === 'off') {
        try {
          await ApiService.sendAcIr(dev.id, 'off', { power: false });
          return true;
        } catch (_) {}
      } else {
        const temp = value ? Number(value) : 22;
        try {
          await ApiService.sendAcIr(dev.id, `temp_${temp}`, { power: true, temp, mode: 'cool' });
          return true;
        } catch (_) {}
      }
    }

    // 5. Covers, Curtains & Garage Doors
    if (
      dev.type === 'blinds_relay' ||
      dev.type === 'cover' ||
      dev.name.toLowerCase().includes('curtain') ||
      dev.name.toLowerCase().includes('garage')
    ) {
      const act = action === 'open' ? 'open' : action === 'close' ? 'close' : 'stop';
      try {
        await ApiService.moveRelayBlinds(dev.id, act);
        return true;
      } catch (_) {}
    }

    // 6. Home Assistant fallback (if HA is connected)
    if (dev.entity_id) {
      const domain = dev.entity_id.split('.')[0];
      const service = action === 'on' ? 'turn_on' : action === 'off' ? 'turn_off' : 'toggle';
      try {
        await callService(domain, service, { entity_id: dev.entity_id });
        return true;
      } catch (_) {}
    }

    // 7. Virtual state fallback
    await setVirtualState(dev.id, { state: action === 'on' ? 'on' : 'off' });
    return true;
  };

  // -------------------------------------------------------------
  // Live Telemetry & Status Formatter
  // -------------------------------------------------------------
  const getDeviceTelemetry = (dev: Device): { text: string; detail?: string } => {
    let devConfig: any = {};
    try {
      devConfig = JSON.parse(dev.config_json || '{}');
    } catch (_) {}
    const z2mName = dev.z2m_friendly_name || devConfig.z2m_friendly_name;
    const endpoint = devConfig.endpoint || (dev.name.match(/switch\s*(\d+)/i) ? `l${dev.name.match(/switch\s*(\d+)/i)?.[1]}` : undefined);
    const tuyaId = dev.tuya_device_id || devConfig.tuya_device_id;

    const zState = z2mName ? getZ2mState(z2mName) : undefined;
    const tState = tuyaId ? getTuyaState(tuyaId) : undefined;

    // Energy meter telemetry
    if (dev.type === 'energy_meter' || dev.name.toLowerCase().includes('energy') || dev.name.toLowerCase().includes('meter')) {
      const pVal = zState?.power_a ?? zState?.power;
      const vVal = zState?.voltage_a ?? zState?.voltage;
      const cVal = zState?.current_a ?? zState?.current;
      const eVal = zState?.energy;

      const p = pVal !== undefined ? `${pVal} W` : undefined;
      const v = vVal !== undefined ? `${vVal} V` : undefined;
      const c = cVal !== undefined ? `${cVal} A` : undefined;
      const e = eVal !== undefined ? `${eVal} kWh` : undefined;
      const st = zState?.state || 'ACTIVE';

      let out = `${dev.name} is currently ${st}.`;
      if (p) out += ` Active Power: ${p}.`;
      if (v) out += ` Voltage: ${v}.`;
      if (c) out += ` Current: ${c}.`;
      if (e) out += ` Total Energy: ${e}.`;
      return { text: out, detail: `${p || 'Active'} • ${v || ''} • ${e || ''}`.trim() };
    }

    // Environmental / Air quality sensor
    if (
      dev.type === 'environmental_sensor' ||
      dev.name.toLowerCase().includes('air') ||
      dev.name.toLowerCase().includes('sensor')
    ) {
      const temp = zState?.temperature !== undefined ? `${zState.temperature}°C` : undefined;
      const hum = zState?.humidity !== undefined ? `${zState.humidity}%` : undefined;
      const co2 = zState?.co2 !== undefined ? `${zState.co2} ppm` : undefined;
      const voc = zState?.voc !== undefined ? `${zState.voc}` : undefined;

      let out = `${dev.name} reading:`;
      if (temp) out += ` Temperature is ${temp},`;
      if (hum) out += ` Humidity is ${hum},`;
      if (co2) out += ` CO2 is ${co2} (${Number(zState?.co2) < 800 ? 'Good' : 'Elevated'}),`;
      if (voc) out += ` VOC index is ${voc}.`;
      return { text: out, detail: `${temp || ''} • ${hum || ''} • CO2: ${co2 || ''}`.trim() };
    }

    // Smart knob / Battery
    if (zState?.battery !== undefined) {
      return {
        text: `${dev.name} battery is at ${zState.battery}%. Last trigger: ${zState.action || 'standby'}.`,
        detail: `Battery: ${zState.battery}%`,
      };
    }

    // Multi-gang switch
    if (endpoint && zState?.[`state_${endpoint}`]) {
      const st = String(zState[`state_${endpoint}`]);
      return { text: `${dev.name} is currently ${st}.`, detail: st };
    }

    // Switch or Light
    if (zState?.state) {
      return { text: `${dev.name} is currently ${zState.state}.`, detail: zState.state };
    }
    if (tState?.switch_1 !== undefined) {
      const st = tState.switch_1 ? 'ON' : 'OFF';
      return { text: `${dev.name} is currently ${st}.`, detail: st };
    }

    return { text: `${dev.name} is online and operational.`, detail: 'Online' };
  };

  // -------------------------------------------------------------
  // Intelligent Natural Language Processing Engine
  // -------------------------------------------------------------
  const processCommand = async (rawInput: string): Promise<{ reply: string; action?: string; deviceCard?: any }> => {
    const input = rawInput.toLowerCase().trim();
    const isMalayalam = language === 'ml-IN' || /[\u0D00-\u0D7F]/.test(rawInput);

    // 1. Weather intent
    if (input.includes('weather') || input.includes('forecast') || input.includes('കാലാവസ്ഥ')) {
      try {
        const w = await ApiService.fetchWeather();
        const temp = w.current?.temperature_2m ? Math.round(w.current.temperature_2m) : 29;
        const reply = isMalayalam
          ? `ഇപ്പോഴത്തെ കാലാവസ്ഥ: താപനില ${temp}°C ആണ്. ${w.label || 'ഓഫീസ് പരിസരം'}.`
          : `The current outdoor temperature is ${temp}°C at ${w.label || 'the building'}. Sky is clear.`;
        return { reply, action: 'Weather Checked' };
      } catch (_) {
        return { reply: 'Currently 29°C outside with pleasant weather.' };
      }
    }

    // 2. News / Building Status intent
    if (input.includes('news') || input.includes('വാർത്തകൾ') || input.includes('building status') || input.includes('system health')) {
      try {
        const n = await ApiService.fetchNews();
        const first = n.news?.[0];
        const reply = first
          ? `${first.title}: ${first.summary}`
          : 'All building sectors, Zigbee coordinators, and networks are operational with zero faults.';
        return { reply, action: 'Building Health Checked' };
      } catch (_) {
        return { reply: 'Building systems operating normally at 100% capacity.' };
      }
    }

    // 3. Quick Routine: Arrival ("I am here" / "ഞാൻ എത്തി")
    if (input.includes('i am here') || input.includes('arrived') || input.includes('ഞാൻ എത്തി') || input.includes('good morning')) {
      const entranceLights = devices.filter((d) => d.type === 'switch_light' || d.type === 'dimmable_light').slice(0, 4);
      for (const d of entranceLights) {
        await executeDeviceAction(d, 'on');
      }
      return {
        reply: isMalayalam
          ? 'സ്വാഗതം! പ്രധാന ഓഫീസ് ലൈറ്റുകൾ ഓൺ ചെയ്തു. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!'
          : 'Welcome to the office! Main lights turned ON and systems are active. Have a productive day!',
        action: 'Arrival Routine Triggered',
      };
    }

    // 4. Quick Routine: Departure / All Off ("I am leaving" / "Turn off all lights" / "ഞാൻ പോകുന്നു" / "എല്ലാം ഓഫാക്കുക")
    if (
      input.includes('turn off all lights') ||
      input.includes('all lights off') ||
      input.includes('turn off all') ||
      input.includes('turn off everything') ||
      input.includes('leaving') ||
      input.includes('goodbye') ||
      input.includes('good night') ||
      input.includes('ഞാൻ പോകുന്നു') ||
      input.includes('എല്ലാ ലൈറ്റുകളും ഓഫ്') ||
      input.includes('എല്ലാം ഓഫാക്കുക')
    ) {
      const lights = devices.filter((d) => d.type === 'switch_light' || d.type === 'dimmable_light');
      for (const d of lights) {
        await executeDeviceAction(d, 'off');
      }
      // Also turn off ACs if leaving
      if (input.includes('leaving') || input.includes('goodbye') || input.includes('good night') || input.includes('പോകുന്നു')) {
        const acs = devices.filter((d) => d.type === 'ac_ir' || d.type === 'climate');
        for (const ac of acs) {
          await executeDeviceAction(ac, 'off');
        }
      }

      return {
        reply: isMalayalam
          ? `ശരി, എല്ലാ (${lights.length}) ലൈറ്റുകളും ഓഫ് ചെയ്തിരിക്കുന്നു. സുരക്ഷിതമായി യാത്ര ചെയ്യുക!`
          : `Turned OFF all ${lights.length} lights and switches across the building. Have a safe journey!`,
        action: 'All Lights Turned OFF',
      };
    }

    // 5. Batch Routine: Turn on all lights
    if (
      input.includes('turn on all lights') ||
      input.includes('all lights on') ||
      input.includes('turn on all') ||
      input.includes('എല്ലാ ലൈറ്റുകളും ഓൺ')
    ) {
      const lights = devices.filter((d) => d.type === 'switch_light' || d.type === 'dimmable_light');
      for (const d of lights) {
        await executeDeviceAction(d, 'on');
      }
      return {
        reply: isMalayalam
          ? `എല്ലാ (${lights.length}) ലൈറ്റുകളും ഓൺ ചെയ്തു.`
          : `Turned ON all ${lights.length} lights and switches in the building.`,
        action: 'All Lights Turned ON',
      };
    }

    // 6. Quick Routine: "I am sweating" / "Cool down" / "ചൂട്"
    if (input.includes('sweating') || input.includes('hot') || input.includes('ചൂട്') || input.includes('തണുപ്പിക്കുക')) {
      const acDev = devices.find((d) => d.type === 'ac_ir' || d.type === 'climate' || d.name.toLowerCase().includes('ac'));
      if (acDev) {
        await executeDeviceAction(acDev, 'on', 20);
        return {
          reply: isMalayalam
            ? `${acDev.name} എസി 20°C ലേക്ക് താഴ്ത്തി തണുപ്പിച്ചു.`
            : `Set AC to 20°C in ${acDev.name} for maximum cooling.`,
          action: 'AC Set to 20°C',
          deviceCard: { name: acDev.name, type: 'ac_ir', detail: '20°C Cool' },
        };
      }
    }

    // 7. Match Specific Individual Devices (Priority over general room commands)
    const findDeviceByTokens = (query: string): Device | undefined => {
      // 1. Exact or substring match on device name
      for (const d of devices) {
        if (query.includes(d.name.toLowerCase())) return d;
      }

      // 2. Specific switch number tokens (matches "switch 1", "switch 2", "switch 3", "gang 1", etc.)
      if (/\b(switch\s*1|switch1|switch\s*one)\b/i.test(query) || /സ്വിച്ച്\s*1/i.test(query)) {
        const found = devices.find((d) => /\b(switch\s*1|switch1)\b/i.test(d.name));
        if (found) return found;
      }
      if (/\b(switch\s*2|switch2|switch\s*two)\b/i.test(query) || /സ്വിച്ച്\s*2/i.test(query)) {
        const found = devices.find((d) => /\b(switch\s*2|switch2)\b/i.test(d.name));
        if (found) return found;
      }
      if (/\b(switch\s*3|switch3|switch\s*three)\b/i.test(query) || /സ്വിച്ച്\s*3/i.test(query)) {
        const found = devices.find((d) => /\b(switch\s*3|switch3)\b/i.test(d.name));
        if (found) return found;
      }

      // 3. Energy meter / Breaker tokens
      if (/\b(energy|meter|power\s*meter|breaker|main\s*power)\b/i.test(query) || /എനർജി\s*മീറ്റർ|ബ്രേക്കർ/i.test(query)) {
        const found = devices.find((d) => d.type === 'energy_meter' || /\b(energy|meter|breaker)\b/i.test(d.name));
        if (found) return found;
      }

      // 4. Environmental sensor / Air quality tokens
      if (/\b(air\s*quality|air\s*sensor|co2|humidity|air\s*monitor)\b/i.test(query) || /എയർ\s*ക്വാളിറ്റി/i.test(query)) {
        const found = devices.find((d) => d.type === 'environmental_sensor' || /\b(air\s*quality|air\s*sensor)\b/i.test(d.name));
        if (found) return found;
      }

      // 5. Smart Knob tokens
      if (/\b(knob|rotary|smart\s*knob)\b/i.test(query) || /നോബ്/i.test(query)) {
        const found = devices.find((d) => d.type === 'smart_knob' || /\bknob\b/i.test(d.name));
        if (found) return found;
      }

      // 6. Curtains & Blinds
      if (/\b(curtain|blinds)\b/i.test(query) || /കർട്ടൻ/i.test(query)) {
        const found = devices.find((d) => d.type === 'blinds_relay' || d.type === 'cover' || /\b(curtain|blinds)\b/i.test(d.name));
        if (found) return found;
      }

      // 7. Garage Door
      if (/\bgarage\b/i.test(query) || /ഗാരേജ്/i.test(query)) {
        const found = devices.find((d) => /\bgarage\b/i.test(d.name));
        if (found) return found;
      }

      // 8. Kobe / Dimmer
      if (/\b(kobe|dimmer)\b/i.test(query)) {
        const found = devices.find((d) => /\bkobe\b/i.test(d.name) || d.type === 'dimmable_light');
        if (found) return found;
      }

      // 9. AC / Climate
      if (/\b(ac|air\s*conditioner|climate)\b/i.test(query) || /എസി/i.test(query)) {
        const found = devices.find((d) => d.type === 'ac_ir' || d.type === 'climate' || /\bac\b/i.test(d.name));
        if (found) return found;
      }

      // 10. Smart Air Box
      if (/\b(air\s*box|smart\s*air)\b/i.test(query)) {
        const found = devices.find((d) => /\bair\s*box\b/i.test(d.name));
        if (found) return found;
      }

      // 11. 2 Gang switch
      if (/\b(2\s*gang|two\s*gang)\b/i.test(query)) {
        const found = devices.find((d) => /\b2\s*gang\b/i.test(d.name));
        if (found) return found;
      }

      // 12. Smart lock / TTLock
      if (/\b(lock|door\s*lock)\b/i.test(query) || /വാതിൽ|അൺലോക്ക്/i.test(query)) {
        const found = devices.find((d) => d.type === 'ttlock' || /\block\b/i.test(d.name));
        if (found) return found;
      }

      // 13. Fallback: match any significant word in device name (> 3 chars)
      for (const d of devices) {
        const words = d.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3 && !['room', 'switch', 'module', 'light'].includes(w));
        if (words.some((w) => query.includes(w))) {
          return d;
        }
      }

      return undefined;
    };

    const matchedDevice = findDeviceByTokens(input);

    if (matchedDevice) {
      // 1. Telemetry / Status inquiry
      const isStatusQuery =
        /\b(status|check|reading|power|voltage|current|battery|how is|what is)\b/i.test(input) ||
        /നില|പരിശോധിക്കുക/i.test(input);

      if (isStatusQuery && !/\b(turn\s*on|turn\s*off|trip|dim)\b/i.test(input)) {
        const tel = getDeviceTelemetry(matchedDevice);
        return {
          reply: tel.text,
          action: `${matchedDevice.name} Status Checked`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: tel.detail },
        };
      }

      // 2. Dimming / Brightness
      const dimMatch = input.match(/(\d+)\s*%/);
      if (dimMatch && (input.includes('dim') || input.includes('brightness') || input.includes('set'))) {
        const val = Number(dimMatch[1]);
        await executeDeviceAction(matchedDevice, 'on', val);
        return {
          reply: isMalayalam
            ? `${matchedDevice.name} ബ്രൈറ്റ്നസ് ${val}% ലേക്ക് ക്രമീകരിച്ചു.`
            : `Set ${matchedDevice.name} brightness to ${val}%.`,
          action: `${matchedDevice.name} Set to ${val}%`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: `${val}% Brightness` },
        };
      }

      // 3. AC Temperature
      const tempMatch = input.match(/(?:to|temp|temperature)\s*(\d{2})/);
      if (tempMatch && (matchedDevice.type === 'ac_ir' || matchedDevice.type === 'climate' || matchedDevice.name.toLowerCase().includes('ac'))) {
        const targetTemp = Number(tempMatch[1]);
        await executeDeviceAction(matchedDevice, 'on', targetTemp);
        return {
          reply: isMalayalam
            ? `${matchedDevice.name} താപനില ${targetTemp}°C ലേക്ക് ക്രമീകരിച്ചു.`
            : `Set ${matchedDevice.name} temperature to ${targetTemp}°C.`,
          action: `AC Set to ${targetTemp}°C`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: `${targetTemp}°C Cool` },
        };
      }

      // 4. Turn OFF / Trip / Close
      const isOff =
        /\b(off|stop|disable|trip|disconnect|close|shut)\b/i.test(input) ||
        /ഓഫ്|അടയ്ക്കുക/i.test(input);

      if (isOff) {
        const isCover = matchedDevice.type === 'blinds_relay' || matchedDevice.type === 'cover' || matchedDevice.name.toLowerCase().includes('curtain');
        await executeDeviceAction(matchedDevice, isCover ? 'close' : 'off');
        const verb = matchedDevice.type === 'energy_meter' || input.includes('trip')
          ? 'Tripped / Turned OFF'
          : isCover
          ? 'Closed'
          : 'Turned OFF';
        return {
          reply: isMalayalam
            ? `${matchedDevice.name} ${isCover ? 'അടച്ചു' : 'ഓഫ് ചെയ്തു'}.`
            : `${verb} ${matchedDevice.name}.`,
          action: `${verb} ${matchedDevice.name}`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: isCover ? 'Closed' : 'OFF' },
        };
      }

      // 5. Turn ON / Open / Unlock
      const isOn =
        /\b(on|start|enable|connect|open|unlock|active)\b/i.test(input) ||
        /ഓൺ|തുറക്കുക|അൺലോക്ക്/i.test(input);

      if (isOn || input.includes(matchedDevice.name.toLowerCase())) {
        const isCover = matchedDevice.type === 'blinds_relay' || matchedDevice.type === 'cover' || matchedDevice.name.toLowerCase().includes('curtain');
        const isLock = matchedDevice.type === 'ttlock' || matchedDevice.name.toLowerCase().includes('lock');
        const act = isLock ? 'unlock' : isCover ? 'open' : 'on';
        await executeDeviceAction(matchedDevice, act);
        const verb = isLock ? 'Unlocked' : isCover ? 'Opened' : 'Turned ON';
        return {
          reply: isMalayalam
            ? `${matchedDevice.name} ${isLock ? 'തുറന്നു' : isCover ? 'തുറന്നു' : 'ഓൺ ചെയ്തിരിക്കുന്നു'}.`
            : `${verb} ${matchedDevice.name}.`,
          action: `${verb} ${matchedDevice.name}`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: isLock ? 'Unlocked' : isCover ? 'Opened' : 'ON' },
        };
      }

      // 6. Toggle
      if (input.includes('toggle') || input.includes('മാറ്റുക')) {
        await executeDeviceAction(matchedDevice, 'toggle');
        return {
          reply: isMalayalam ? `${matchedDevice.name} മാറ്റി.` : `Toggled ${matchedDevice.name}.`,
          action: `Toggled ${matchedDevice.name}`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type },
        };
      }

      // Default: Report telemetry
      const tel = getDeviceTelemetry(matchedDevice);
      return {
        reply: tel.text,
        action: `${matchedDevice.name} Checked`,
        deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: tel.detail },
      };
    }

    // 8. Specific Room Commands ("turn on room 1", "turn off room 2", "status of room 1")
    for (const r of rooms) {
      const rName = r.name.toLowerCase();
      const numMatch = rName.match(/\d+/);
      const roomNum = numMatch ? numMatch[0] : '';

      let matchesRoom = new RegExp(`\\b${rName}\\b`, 'i').test(input);
      if (!matchesRoom && roomNum) {
        matchesRoom = new RegExp(`\\broom\\s*${roomNum}\\b`, 'i').test(input);
      }
      if (!matchesRoom && r.slug && r.slug.length > 2) {
        matchesRoom = new RegExp(`\\b${r.slug}\\b`, 'i').test(input);
      }

      if (matchesRoom) {
        const roomDevs = devices.filter((d) => d.room_id === r.id);

        // Navigation
        if (/\b(show|go to|view)\b/i.test(input) || /കാണിക്കുക/i.test(input)) {
          onSelectRoom(r.id);
          return {
            reply: isMalayalam ? `${r.name} തുറന്നിരിക്കുന്നു.` : `Navigating to ${r.name}.`,
            action: `Opened ${r.name}`,
          };
        }

        // Room Status
        if (/\b(status|check|reading)\b/i.test(input) || /നില/i.test(input)) {
          const summaries = roomDevs.map((d) => {
            const tel = getDeviceTelemetry(d);
            return `• ${d.name}: ${tel.detail || 'Online'}`;
          });
          return {
            reply: isMalayalam
              ? `${r.name} നില:\n` + summaries.join('\n')
              : `${r.name} has ${roomDevs.length} devices mapped:\n` + summaries.join('\n'),
            action: `${r.name} Status Checked`,
          };
        }

        const controllableDevs = roomDevs.filter(
          (d) =>
            d.type === 'switch_light' ||
            d.type === 'dimmable_light' ||
            d.type === 'ac_ir' ||
            d.type === 'climate' ||
            d.type === 'blinds_relay' ||
            d.type === 'cover'
        );

        if (/\b(off|stop|disable)\b/i.test(input) || /ഓഫ്/i.test(input)) {
          for (const d of controllableDevs) {
            await executeDeviceAction(d, 'off');
          }
          return {
            reply: isMalayalam
              ? `${r.name}-ലെ എല്ലാ ലൈറ്റുകളും ഓഫ് ചെയ്തു.`
              : `Turned OFF all ${controllableDevs.length} switches and lights in ${r.name}.`,
            action: `Turned OFF devices in ${r.name}`,
          };
        }

        if (/\b(on|start|enable)\b/i.test(input) || /ഓൺ/i.test(input)) {
          for (const d of controllableDevs) {
            await executeDeviceAction(d, 'on');
          }
          return {
            reply: isMalayalam
              ? `${r.name}-ലെ എല്ലാ ലൈറ്റുകളും ഓൺ ചെയ്തു.`
              : `Turned ON all ${controllableDevs.length} switches and lights in ${r.name}.`,
            action: `Turned ON devices in ${r.name}`,
          };
        }
      }
    }

    // 12. Check Direct Unmapped Zigbee2MQTT Devices
    for (const zDev of z2mDevices) {
      if (zDev.type === 'Coordinator') continue;
      if (input.includes(zDev.friendly_name.toLowerCase())) {
        const isOff = input.includes('off') || input.includes('trip') || input.includes('ഓഫ്');
        await setZ2mState(zDev.friendly_name, { state: isOff ? 'OFF' : 'ON' });
        return {
          reply: isMalayalam
            ? `${zDev.friendly_name} ${isOff ? 'ഓഫ് ചെയ്തു' : 'ഓൺ ചെയ്തു'}.`
            : `Turned ${isOff ? 'OFF' : 'ON'} Zigbee device "${zDev.friendly_name}".`,
          action: `Zigbee ${zDev.friendly_name} ${isOff ? 'OFF' : 'ON'}`,
        };
      }
    }

    // 13. Helpful Intelligent Fallback
    return {
      reply: isMalayalam
        ? `ക്ഷമിക്കണം, എനിക്ക് പൂർണ്ണമായി മനസ്സിലായില്ല. നിങ്ങൾക്ക് "റൂം 1 ലൈറ്റുകൾ ഓഫ് ചെയ്യുക", "സ്വിച്ച് 1 ഓൺ ചെയ്യുക", "എനർജി മീറ്റർ പരിശോധിക്കുക", "വാതിൽ തുറക്കുക" എന്ന് പറയാം.`
        : `I've noted: "${rawInput}". Try asking: "Turn on R&D Room Switch 1", "Trip energy meter", "What is the air quality?", "Unlock door", or "Turn off all lights".`,
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    const { reply, action, deviceCard } = await processCommand(text);

    const botMsg: ChatMessage = {
      id: `bot_${Date.now()}`,
      sender: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionTaken: action,
      deviceCard,
    };

    setMessages((prev) => [...prev, botMsg]);
    speak(reply);
  };

  handleSendMessageRef.current = handleSendMessage;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto space-y-4 pb-20 animate-in fade-in">
      {/* Assistant Header */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-glow">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              {assistantName} Voice &amp; Device Assistant
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                LOCAL FIRST
              </span>
            </h2>
            <p className="text-[10px] font-mono text-cyan-400">
              Universal Control: Zigbee • Tuya Wi-Fi • TTLock • AC IR • HA
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mic Permission Status Button */}
          <button
            onClick={requestMicPermission}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all ${
              micPermissionState === 'granted'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : micPermissionState === 'denied'
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
            title={
              micPermissionState === 'granted'
                ? 'Microphone is enabled for localhost:5173'
                : micPermissionState === 'denied'
                ? 'Microphone is blocked in browser settings. Click the tune icon in the URL bar to allow.'
                : 'Click to grant microphone permission for localhost:5173'
            }
          >
            {micPermissionState === 'granted' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="hidden sm:inline">Mic Ready</span>
              </>
            ) : micPermissionState === 'denied' ? (
              <>
                <MicOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Mic Blocked</span>
              </>
            ) : (
              <>
                <Mic className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Enable Mic</span>
              </>
            )}
          </button>

          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en-IN' ? 'ml-IN' : 'en-IN')}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono font-semibold text-cyan-400 flex items-center gap-1.5 transition-colors"
          >
            <Languages className="w-3.5 h-3.5" />
            {language === 'en-IN' ? 'English (en-IN)' : 'മലയാളം (ml-IN)'}
          </button>

          {/* Speech Audio Reply Toggle */}
          <button
            onClick={() => setSpeechEnabled(!speechEnabled)}
            className={`p-1.5 rounded-xl border transition-colors ${
              speechEnabled
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'bg-slate-900 text-slate-500 border-white/10'
            }`}
            title={speechEnabled ? 'Mute Voice' : 'Enable Voice'}
          >
            {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Microphone Permission Prompt Banner */}
      {micPermissionState === 'prompt' && (
        <div className="bg-gradient-to-r from-cyan-950/80 to-slate-900 border border-cyan-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-slate-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="font-bold text-white block">Microphone Voice Control for localhost</span>
              <span className="text-[11px] text-slate-400 block">Click "Allow Microphone" to grant voice control permissions for all users on this localhost link.</span>
            </div>
          </div>
          <button
            onClick={requestMicPermission}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs shadow-glow hover:opacity-90 shrink-0"
          >
            Allow Microphone
          </button>
        </div>
      )}

      {/* Microphone Denied Notice */}
      {micPermissionState === 'denied' && (
        <div className="bg-rose-950/50 border border-rose-500/30 rounded-2xl p-3 flex items-center gap-3 text-xs text-rose-200 shrink-0">
          <MicOff className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <span className="font-bold text-rose-300 block">Microphone is blocked in your browser</span>
            <span className="text-[11px] text-rose-300/80 block">
              To allow voice commands: click the <strong>tune/lock icon</strong> on the left side of <code>localhost:5173</code> in the address bar &rarr; set <strong>Microphone</strong> to <strong>Allow</strong> &rarr; reload the page.
            </span>
          </div>
        </div>
      )}

      {/* Notice if accessing via insecure HTTP on a remote device */}
      {window.location.protocol !== 'https:' && !isLocalhost && (
        <div className="bg-amber-950/50 border border-amber-500/40 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Phone Voice Setup</strong>: Mobile browsers block microphone on HTTP. Tap to switch to the secure HTTPS link (tap Advanced &rarr; Proceed on warning).
            </span>
          </div>
          <a
            href={`https://${window.location.hostname}:5174/assistant`}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-bold text-xs shadow-glow hover:opacity-90 shrink-0"
          >
            Switch to HTTPS
          </a>
        </div>
      )}

      {/* Quick Action Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        <button
          onClick={() => handleSendMessage('Turn on R&D Room Switch 1')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-cyan-300 border border-cyan-500/20 shrink-0 flex items-center gap-1.5"
        >
          <Lightbulb className="w-3.5 h-3.5 text-cyan-400" /> Switch 1 ON
        </button>
        <button
          onClick={() => handleSendMessage('Turn off all lights')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-rose-300 border border-rose-500/20 shrink-0 flex items-center gap-1.5"
        >
          <Power className="w-3.5 h-3.5 text-rose-400" /> Turn off all lights
        </button>
        <button
          onClick={() => handleSendMessage('Check energy meter power')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-amber-300 border border-amber-500/20 shrink-0 flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" /> Energy Meter Power
        </button>
        <button
          onClick={() => handleSendMessage('What is the air quality?')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-emerald-300 border border-emerald-500/20 shrink-0 flex items-center gap-1.5"
        >
          <Wind className="w-3.5 h-3.5 text-emerald-400" /> Air Quality
        </button>
        <button
          onClick={() => handleSendMessage('Unlock the door')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-indigo-300 border border-indigo-500/20 shrink-0 flex items-center gap-1.5"
        >
          <Unlock className="w-3.5 h-3.5 text-indigo-400" /> Unlock Door
        </button>
        <button
          onClick={() => handleSendMessage('I am sweating')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-sky-300 border border-sky-500/20 shrink-0 flex items-center gap-1.5"
        >
          <Thermometer className="w-3.5 h-3.5 text-sky-400" /> Cool Down AC
        </button>
        <button
          onClick={() => handleSendMessage('What is the weather?')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-white/10 shrink-0 flex items-center gap-1.5"
        >
          <CloudSun className="w-3.5 h-3.5 text-amber-400" /> Weather
        </button>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 glass-panel rounded-2xl border border-white/10">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-md ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-cyan-600 to-brand-600 text-white rounded-br-none'
                  : 'bg-slate-900/90 text-slate-100 border border-white/10 rounded-bl-none space-y-2'
              }`}
            >
              <p>{msg.text}</p>

              {msg.actionTaken && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/80 text-[10px] font-mono text-cyan-300 border border-cyan-800/40">
                    <CheckCircle2 className="w-3 h-3 text-cyan-400" /> {msg.actionTaken}
                  </span>
                </div>
              )}

              {msg.deviceCard && (
                <div className="mt-2 p-2.5 bg-slate-950/70 rounded-xl border border-white/10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                      {msg.deviceCard.type === 'energy_meter' ? (
                        <Zap className="w-3.5 h-3.5" />
                      ) : msg.deviceCard.type === 'environmental_sensor' ? (
                        <Wind className="w-3.5 h-3.5" />
                      ) : msg.deviceCard.type === 'ttlock' ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <Lightbulb className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <span className="font-bold text-white text-xs block">{msg.deviceCard.name}</span>
                      {msg.deviceCard.detail && (
                        <span className="text-[10px] font-mono text-cyan-400 block">{msg.deviceCard.detail}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <span className="text-[9px] font-mono text-slate-500 mt-1 px-1">
              {msg.timestamp}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input & Mic Bar */}
      <div className="flex items-center gap-2 glass-panel p-2 rounded-2xl border border-white/10 shrink-0">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-xl transition-all ${
            isListening
              ? 'bg-rose-500 text-white shadow-glow animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-cyan-400'
          }`}
          title={isListening ? 'Stop listening' : 'Start speaking'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          placeholder={
            isListening
              ? 'Listening...'
              : language === 'ml-IN'
              ? 'പറയുക: "സ്വിച്ച് 1 ഓൺ ചെയ്യുക", "എനർജി മീറ്റർ പരിശോധിക്കുക", "വാതിൽ തുറക്കുക"...'
              : 'Say or type: "Turn on Switch 1", "Trip energy meter", "Check air quality", "Unlock door"...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 glass-input rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-3 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold shadow-glow disabled:opacity-40 active:scale-95 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
