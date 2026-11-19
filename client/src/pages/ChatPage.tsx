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
  Camera as CameraIcon,
  Video,
  Maximize2,
  Compass,
  X,
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { ApiService } from '../services/api';
import { Go2rtcVideo } from '../components/cctv/Go2rtcVideo';
import { DomflyCharacter, DomflyState } from '../components/companion/DomflyCharacter';
import type { Device, Z2mDevice, Camera } from '../types';

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
  cameraCard?: {
    camera: Camera;
    actionText?: string;
  };
}

interface ChatPageProps {
  onSelectRoom: (roomId: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onOpenFullscreenCamera?: (camera: Camera) => void;
  isFloating?: boolean;
  onClose?: () => void;
  onStateChange?: (state: DomflyState) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({
  onSelectRoom,
  onNavigateToTab,
  onOpenFullscreenCamera,
  isFloating = false,
  onClose,
  onStateChange,
}) => {
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
  const cameras = data?.cameras || [];

  const [language, setLanguage] = useState<'en-IN' | 'ml-IN'>('en-IN');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [micPermissionState, setMicPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [isLocalhost, setIsLocalhost] = useState(true);
  const [companionState, setCompanionState] = useState<DomflyState>('idle');

  const updateCompanionState = (st: DomflyState) => {
    setCompanionState(st);
    onStateChange?.(st);
  };

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
        updateCompanionState('listening');
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
        updateCompanionState('idle');
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
      updateCompanionState('idle');
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
    try {
      window.speechSynthesis.cancel();
      // Clean markdown characters and symbols for natural, fluent TTS pronunciation
      const cleanText = text
        .replace(/[*#_`~]/g, '')
        .replace(/[•\-\–]/g, ', ')
        .replace(/\n+/g, '. ')
        .trim();

      const utterance = new SpeechSynthesisUtterance(cleanText);
      const isMl = language === 'ml-IN' || /[\u0D00-\u0D7F]/.test(cleanText);
      const voices = window.speechSynthesis.getVoices();

      if (isMl) {
        // Look for native Malayalam TTS voice first (Google മലയാളം, Edge Malayalam, etc.)
        const mlVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith('ml') ||
            v.name.toLowerCase().includes('malayalam')
        );
        if (mlVoice) {
          utterance.voice = mlVoice;
          utterance.lang = mlVoice.lang;
        } else {
          // Fallback to Indian English or regional voice that pronounces Indian phonetics smoothly
          const inVoice = voices.find(
            (v) =>
              v.lang.toLowerCase().includes('en-in') ||
              v.lang.toLowerCase().includes('hi-in') ||
              v.name.toLowerCase().includes('india')
          );
          if (inVoice) {
            utterance.voice = inVoice;
            utterance.lang = inVoice.lang;
          } else {
            utterance.lang = 'en-IN';
          }
        }
      } else {
        utterance.lang = 'en-IN';
        const inVoice = voices.find((v) => v.lang.toLowerCase().includes('en-in'));
        if (inVoice) utterance.voice = inVoice;
      }

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        updateCompanionState('speaking');
      };
      utterance.onend = () => {
        updateCompanionState('idle');
      };
      utterance.onerror = () => {
        updateCompanionState('idle');
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[speak] error:', err);
    }
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
      if (targetLockId && !String(targetLockId).startsWith('dev_')) {
        try {
          const res = await ApiService.unlockTtlock(targetLockId);
          return res.ok;
        } catch (_) {
          return false;
        }
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
  const getDeviceTelemetry = (dev: Device, isMl = false): { text: string; detail?: string } => {
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

      if (isMl) {
        let out = `${dev.name} നിലവിൽ ${st === 'OFF' ? 'ഓഫ് ആണ്' : 'പ്രവർത്തിക്കുന്നു'}.`;
        if (p) out += ` ആക്ടീവ് പവർ: ${p}.`;
        if (v) out += ` വോൾട്ടേജ്: ${v}.`;
        if (c) out += ` കറന്റ്: ${c}.`;
        if (e) out += ` ആകെ ഊർജ്ജ ഉപഭോഗം: ${e}.`;
        return { text: out, detail: `${p || 'Active'} • ${v || ''} • ${e || ''}`.trim() };
      }

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

      if (isMl) {
        let out = `${dev.name} റീഡിംഗ്:`;
        if (temp) out += ` താപനില ${temp},`;
        if (hum) out += ` അന്തരീക്ഷ ഈർപ്പം ${hum},`;
        if (co2) out += ` കാർബൺ ഡയോക്സൈഡ് (CO2) ${co2} (${Number(zState?.co2) < 800 ? 'നല്ല നിലവാരം' : 'കൂടുതൽ'}),`;
        if (voc) out += ` VOC ഇൻഡക്സ് ${voc}.`;
        return { text: out, detail: `${temp || ''} • ${hum || ''} • CO2: ${co2 || ''}`.trim() };
      }

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
        text: isMl
          ? `${dev.name} ബാറ്ററി ചാർജ് ${zState.battery}% ആണ്.`
          : `${dev.name} battery is at ${zState.battery}%. Last trigger: ${zState.action || 'standby'}.`,
        detail: `Battery: ${zState.battery}%`,
      };
    }

    // Multi-gang switch
    if (endpoint && zState?.[`state_${endpoint}`]) {
      const st = String(zState[`state_${endpoint}`]);
      return {
        text: isMl ? `${dev.name} നിലവിൽ ${st === 'ON' ? 'ഓൺ ആണ്' : 'ഓഫ് ആണ്'}.` : `${dev.name} is currently ${st}.`,
        detail: st,
      };
    }

    // Switch or Light
    if (zState?.state) {
      return {
        text: isMl ? `${dev.name} നിലവിൽ ${zState.state === 'ON' ? 'ഓൺ ആണ്' : 'ഓഫ് ആണ്'}.` : `${dev.name} is currently ${zState.state}.`,
        detail: zState.state,
      };
    }
    if (tState?.switch_1 !== undefined) {
      const st = tState.switch_1 ? 'ON' : 'OFF';
      return {
        text: isMl ? `${dev.name} നിലവിൽ ${st === 'ON' ? 'ഓൺ ആണ്' : 'ഓഫ് ആണ്'}.` : `${dev.name} is currently ${st}.`,
        detail: st,
      };
    }

    return {
      text: isMl ? `${dev.name} പൂർണ്ണമായും ഓൺലൈൻ ആണ്.` : `${dev.name} is online and operational.`,
      detail: 'Online',
    };
  };

  // -------------------------------------------------------------
  // Intelligent Natural Language Processing Engine (Malayalam, Manglish & English)
  // -------------------------------------------------------------
  const processCommand = async (
    rawInput: string
  ): Promise<{ reply: string; action?: string; deviceCard?: any; cameraCard?: { camera: Camera; actionText?: string } }> => {
    const input = rawInput.toLowerCase().trim();

    // 1. Language & Script Detection (Malayalam Unicode, Manglish Transliteration, or Active Toggle)
    const isMalayalamScript = /[\u0D00-\u0D7F]/.test(rawInput);
    const manglishPatterns = /\b(aakku|aakkoo|aakkuka|cheyyu|cheyyuka|thurakku|thurakkoo|thurakkuka|kaanikku|kaanikkoo|kaanikkuka|kaanam|kaanatte|keduthu|keduthoo|keduthuka|nirthu|nirthuka|nokku|nokkoo|nokkanam|nokkuka|choodu|chood|thanuppu|thanuppikku|entha|enthaanu|ethra|ethraya|ethrayanu|und|undu|undoo|engane|vaathil|vathil|poottu|poottuka|kadanju|pettannu|ellaam|ella|njan|ethi|vannu|irangi|pokunnu|current|velicham|kurakku|koottoo)\b/i;
    const isManglish = manglishPatterns.test(input);
    const isMalayalam = language === 'ml-IN' || isMalayalamScript || isManglish;

    // 2. Weather intent
    if (
      input.includes('weather') ||
      input.includes('forecast') ||
      input.includes('കാലാവസ്ഥ') ||
      input.includes('kaalaavastha') ||
      input.includes('mazha') ||
      input.includes('മഴ')
    ) {
      try {
        const w = await ApiService.fetchWeather();
        const temp = w.current?.temperature_2m ? Math.round(w.current.temperature_2m) : 29;
        const reply = isMalayalam
          ? `ഇപ്പോഴത്തെ കാലാവസ്ഥ: താപനില ${temp}°C ആണ്. ആകാശം തെളിഞ്ഞതാണ് (${w.label || 'ഓഫീസ് പരിസരം'}).`
          : `The current outdoor temperature is ${temp}°C at ${w.label || 'the building'}. Sky is clear.`;
        return { reply, action: isMalayalam ? 'കാലാവസ്ഥ പരിശോധിച്ചു' : 'Weather Checked' };
      } catch (_) {
        return { reply: isMalayalam ? 'പുറത്ത് 29°C താപനിലയിൽ നല്ല കാലാവസ്ഥയാണ്.' : 'Currently 29°C outside with pleasant weather.' };
      }
    }

    // 3. News / Building Health intent
    if (
      input.includes('news') ||
      input.includes('വാർത്ത') ||
      input.includes('building status') ||
      input.includes('system health') ||
      input.includes('ആരോഗ്യം')
    ) {
      try {
        const n = await ApiService.fetchNews();
        const first = n.news?.[0];
        const reply = first
          ? `${first.title}: ${first.summary}`
          : (isMalayalam
            ? 'ഓഫീസിലെ എല്ലാ സിഗ്ബീ കോർഡിനേറ്ററുകളും നെറ്റ്‌വർക്കുകളും യാതൊരു തകരാറും കൂടാതെ പ്രവർത്തിക്കുന്നു.'
            : 'All building sectors, Zigbee coordinators, and networks are operational with zero faults.');
        return { reply, action: isMalayalam ? 'സിസ്റ്റം നില പരിശോധിച്ചു' : 'Building Health Checked' };
      } catch (_) {
        return {
          reply: isMalayalam
            ? 'എല്ലാ കെട്ടിട സംവിധാനങ്ങളും 100% കാര്യക്ഷമതയോടെ പ്രവർത്തിക്കുന്നു.'
            : 'Building systems operating normally at 100% capacity.',
        };
      }
    }

    // 4. Quick Routine: Arrival ("I am here" / "njan ethi" / "ഞാൻ എത്തി")
    if (
      input.includes('i am here') ||
      input.includes('arrived') ||
      input.includes('ഞാൻ എത്തി') ||
      input.includes('njan ethi') ||
      input.includes('njan vannu') ||
      input.includes('officeil ethi') ||
      input.includes('good morning')
    ) {
      const entranceLights = devices.filter((d) => d.type === 'switch_light' || d.type === 'dimmable_light').slice(0, 4);
      for (const d of entranceLights) {
        await executeDeviceAction(d, 'on');
      }
      return {
        reply: isMalayalam
          ? 'സ്വാഗതം! പ്രധാന ഓഫീസ് ലൈറ്റുകൾ ഓൺ ചെയ്തു. ഒരു നല്ല ദിവസം ആശംസിക്കുന്നു!'
          : 'Welcome to the office! Main lights turned ON and systems are active. Have a productive day!',
        action: isMalayalam ? 'വരവ് ദിനചര്യ പൂർത്തിയാക്കി' : 'Arrival Routine Triggered',
      };
    }

    // 5. Quick Routine: Departure / All Off ("I am leaving" / "njan pokunnu" / "ellaam off aakku" / "എല്ലാ ലൈറ്റുകളും ഓഫ്")
    if (
      input.includes('turn off all lights') ||
      input.includes('all lights off') ||
      input.includes('turn off all') ||
      input.includes('turn off everything') ||
      input.includes('leaving') ||
      input.includes('goodbye') ||
      input.includes('good night') ||
      input.includes('ഞാൻ പോകുന്നു') ||
      input.includes('ഞാൻ ഇറങ്ങുന്നു') ||
      input.includes('എല്ലാ ലൈറ്റുകളും ഓഫ്') ||
      input.includes('എല്ലാം ഓഫാക്കുക') ||
      input.includes('എല്ലാം കെടുത്തുക') ||
      input.includes('njan pokunnu') ||
      input.includes('njan irangi') ||
      input.includes('ella lightum off') ||
      input.includes('ellaam off') ||
      input.includes('ellaam keduthu')
    ) {
      const lights = devices.filter((d) => d.type === 'switch_light' || d.type === 'dimmable_light');
      for (const d of lights) {
        await executeDeviceAction(d, 'off');
      }
      // Also turn off ACs
      const acs = devices.filter((d) => d.type === 'ac_ir' || d.type === 'climate');
      for (const ac of acs) {
        await executeDeviceAction(ac, 'off');
      }

      return {
        reply: isMalayalam
          ? `ശരി, എല്ലാ (${lights.length}) ലൈറ്റുകളും എസിയും ഓഫ് ചെയ്തിരിക്കുന്നു. സുരക്ഷിതമായി യാത്ര ചെയ്യുക!`
          : `Turned OFF all ${lights.length} lights and ACs across the building. Have a safe journey!`,
        action: isMalayalam ? 'എല്ലാ ലൈറ്റുകളും ഓഫ് ചെയ്തു' : 'All Lights & AC Turned OFF',
      };
    }

    // 6. Batch Routine: Turn on all lights
    if (
      input.includes('turn on all lights') ||
      input.includes('all lights on') ||
      input.includes('turn on all') ||
      input.includes('എല്ലാ ലൈറ്റുകളും ഓൺ') ||
      input.includes('എല്ലാം ഓൺ ചെയ്യുക') ||
      input.includes('ella lightum on') ||
      input.includes('ellaam on')
    ) {
      const lights = devices.filter((d) => d.type === 'switch_light' || d.type === 'dimmable_light');
      for (const d of lights) {
        await executeDeviceAction(d, 'on');
      }
      return {
        reply: isMalayalam
          ? `എല്ലാ (${lights.length}) ലൈറ്റുകളും വിജയകരമായി ഓൺ ചെയ്തു.`
          : `Turned ON all ${lights.length} lights and switches in the building.`,
        action: isMalayalam ? 'എല്ലാ ലൈറ്റുകളും ഓൺ ചെയ്തു' : 'All Lights Turned ON',
      };
    }

    // 7. Quick Routine: "I am sweating" / "Cool down" / "choodu edukkunnu" / "ചൂട്"
    if (
      input.includes('sweating') ||
      input.includes('hot') ||
      input.includes('ചൂട്') ||
      input.includes('തണുപ്പിക്കുക') ||
      input.includes('choodu') ||
      input.includes('chood') ||
      input.includes('thanuppikku')
    ) {
      const acDev = devices.find((d) => d.type === 'ac_ir' || d.type === 'climate' || d.name.toLowerCase().includes('ac'));
      if (acDev) {
        await executeDeviceAction(acDev, 'on', 20);
        return {
          reply: isMalayalam
            ? `${acDev.name} എസി 20°C ലേക്ക് താഴ്ത്തി തണുപ്പിച്ചു.`
            : `Set AC to 20°C in ${acDev.name} for maximum cooling.`,
          action: isMalayalam ? 'എസി 20°C ലേക്ക് ക്രമീകരിച്ചു' : 'AC Set to 20°C',
          deviceCard: { name: acDev.name, type: 'ac_ir', detail: '20°C Cool' },
        };
      }
    }

    // 8. Camera & CCTV Visuals / Navigation Intent
    const findCameraByTokens = (query: string): Camera | undefined => {
      const q = query.toLowerCase().trim();
      if (cameras.length === 0) return undefined;

      // 1. Direct exact or substring match on camera name or stream_id
      for (const c of cameras) {
        if (q.includes(c.name.toLowerCase()) || q.includes(c.stream_id.toLowerCase())) {
          return c;
        }
      }

      // 2. Semantic & keyword matching
      // Camera 1: qqq / tapo
      if (/\b(qqq|tapo)\b/i.test(q) || /ക്യു/i.test(q)) {
        const c = cameras.find((cam) => /\b(qqq|tapo)\b/i.test(cam.name) || cam.stream_id === 'cam1');
        if (c) return c;
      }
      // Camera 2: R&D Cam
      if (/\b(r&d|rd|r and d|research)\b/i.test(q) || /ആർ\s*(&|ആൻഡ്)\s*ഡി/i.test(q)) {
        const c = cameras.find((cam) => /r&d|rd|research/i.test(cam.name) || cam.stream_id === 'cam2');
        if (c) return c;
      }
      // Camera 6: Store Room
      if (/\b(store|store\s*room|storeroom)\b/i.test(q) || /സ്റ്റോർ/i.test(q)) {
        const c = cameras.find((cam) => /store/i.test(cam.name) || cam.stream_id === 'cam6');
        if (c) return c;
      }
      // Camera 3: Table Cam
      if (/\b(table|desk)\b/i.test(q) || /ടേബിൾ/i.test(q)) {
        const c = cameras.find((cam) => /table|desk/i.test(cam.name) || cam.stream_id === 'cam3');
        if (c) return c;
      }
      // Camera 4: Workspace
      if (/\bworkspace\b/i.test(q) || /വർക്ക്\s*സ്പേസ്/i.test(q)) {
        const c = cameras.find((cam) => /workspace/i.test(cam.name) || cam.stream_id === 'cam4');
        if (c) return c;
      }
      // Camera 5: Office
      if (/\boffice\b/i.test(q) || /ഓഫീസ്/i.test(q)) {
        const c = cameras.find((cam) => /office/i.test(cam.name) || cam.stream_id === 'cam5');
        if (c) return c;
      }

      // 3. Numeric tokens: "camera 1", "cam 1", "ക്യാമറ 1", "cam 6", etc.
      const numMatch = q.match(/(?:camera|cam|ക്യാമറ)\s*(\d+)/i);
      if (numMatch) {
        const num = numMatch[1];
        const c = cameras.find((cam) => cam.stream_id === `cam${num}` || cam.name.includes(num));
        if (c) return c;
      }

      return undefined;
    };

    const isCameraOrCctvQuery =
      /\b(camera|cctv|visual|visuals|stream|streams|feed|video|cam)\b/i.test(input) ||
      /ക്യാമറ|സിസിടിവി/i.test(input) ||
      /\b(see|show|view|open|goto|go to|display|watch|look at|kaanikku|kaanikkoo|kaanikkuka|kaanam|kaanatte|nokku|nokkanam)\b/i.test(input) ||
      /കാണിക്കുക|കാണിക്കൂ|തുറക്കുക|തുറക്കൂ|കാണണം|കാണട്ടെ|നോക്കുക/i.test(input);

    if (isCameraOrCctvQuery) {
      const targetedCamera = findCameraByTokens(input);

      if (targetedCamera) {
        const wantsFullscreen =
          /\b(fullscreen|full\s*screen|maximize|zoom|full|valuthaakku)\b/i.test(input) ||
          /വലുതാക്കുക|വലുതാക്കൂ/i.test(input) ||
          /\b(go\s*to|open|switch\s*to|thurakku)\b/i.test(input) ||
          /തുറക്കുക|തുറക്കൂ/i.test(input);

        if (wantsFullscreen && onOpenFullscreenCamera) {
          setTimeout(() => onOpenFullscreenCamera(targetedCamera), 300);
          return {
            reply: isMalayalam
              ? `${targetedCamera.name} ക്യാമറ ഫുൾസ്ക്രീൻ ആയി ലൈവ് സ്ട്രീം ചെയ്യുന്നു.`
              : `Opened ${targetedCamera.name} (${targetedCamera.stream_id}) in fullscreen view with live PTZ control.`,
            action: isMalayalam ? `ഫുൾസ്ക്രീൻ: ${targetedCamera.name}` : `Opened Fullscreen: ${targetedCamera.name}`,
            cameraCard: { camera: targetedCamera, actionText: 'Fullscreen Active' },
          };
        }

        return {
          reply: isMalayalam
            ? `ഇതാ ${targetedCamera.name} ക്യാമറയുടെ തത്സമയ (Live) വിഷ്വൽ സ്ട്രീം. ഫുൾസ്ക്രീൻ കാണാൻ താഴെ ക്ലിക്ക് ചെയ്യുക.`
            : `Here is the live visual feed for ${targetedCamera.name} (${targetedCamera.stream_id}). You can open fullscreen or view in CCTV Wall below.`,
          action: isMalayalam ? `വിഷ്വൽ: ${targetedCamera.name}` : `Visual: ${targetedCamera.name}`,
          cameraCard: { camera: targetedCamera },
        };
      }

      // General CCTV Wall navigation
      if (
        /\b(cctv|all\s*cameras|cameras|camera\s*wall|video\s*wall|all\s*visuals)\b/i.test(input) ||
        /സിസിടിവി|എല്ലാ\s*ക്യാമറകളും/i.test(input) ||
        input.includes('see visuals') ||
        input.includes('show cameras') ||
        input.includes('show cctv') ||
        input.includes('open cctv') ||
        input.includes('cctv kaanikku') ||
        input.includes('cctv thurakku')
      ) {
        if (onNavigateToTab) {
          setTimeout(() => onNavigateToTab('cctv'), 300);
        }
        return {
          reply: isMalayalam
            ? 'ലൈവ് സിസിടിവി വാളിലേക്ക് മാറുന്നു. എല്ലാ ക്യാമറകളും അവിടെ കാണാം.'
            : 'Navigating to the Live Go2RTC CCTV Wall with real-time zero-latency multi-camera streams.',
          action: isMalayalam ? 'സിസിടിവി വാൾ തുറന്നു' : 'Navigated to CCTV Wall',
        };
      }
    }

    // 9. Match Specific Individual Devices (Priority over general room commands)
    const findDeviceByTokens = (query: string): Device | undefined => {
      // 1. Exact or substring match on device name
      for (const d of devices) {
        if (query.includes(d.name.toLowerCase())) return d;
      }

      // 2. Specific switch number tokens (matches "switch 1", "switch 2", "switch 3", "gang 1", etc.)
      if (/\b(switch\s*1|switch1|switch\s*one)\b/i.test(query) || /സ്വിച്ച്\s*1|സ്വിച്ച്\s*ഒന്ന്/i.test(query) || /\bswitch\s*onnu\b/i.test(query)) {
        const found = devices.find((d) => /\b(switch\s*1|switch1)\b/i.test(d.name));
        if (found) return found;
      }
      if (/\b(switch\s*2|switch2|switch\s*two)\b/i.test(query) || /സ്വിച്ച്\s*2|സ്വിച്ച്\s*രണ്ട്/i.test(query) || /\bswitch\s*randu\b/i.test(query)) {
        const found = devices.find((d) => /\b(switch\s*2|switch2)\b/i.test(d.name));
        if (found) return found;
      }
      if (/\b(switch\s*3|switch3|switch\s*three)\b/i.test(query) || /സ്വിച്ച്\s*3|സ്വിച്ച്\s*മൂന്ന്/i.test(query) || /\bswitch\s*moonnu\b/i.test(query)) {
        const found = devices.find((d) => /\b(switch\s*3|switch3)\b/i.test(d.name));
        if (found) return found;
      }

      // 3. Energy meter / Breaker tokens
      if (
        /\b(energy|meter|power\s*meter|breaker|main\s*power|current)\b/i.test(query) ||
        /എനർജി\s*മീറ്റർ|ബ്രേക്കർ|വൈദ്യുതി|കറന്റ്|പവർ/i.test(query)
      ) {
        const found = devices.find((d) => d.type === 'energy_meter' || /\b(energy|meter|breaker)\b/i.test(d.name));
        if (found) return found;
      }

      // 4. Environmental sensor / Air quality tokens
      if (
        /\b(air\s*quality|air\s*sensor|co2|humidity|air\s*monitor|air\s*box)\b/i.test(query) ||
        /എയർ\s*ക്വാളിറ്റി|വായു|സെൻസർ/i.test(query)
      ) {
        const found = devices.find((d) => d.type === 'environmental_sensor' || /\b(air\s*quality|air\s*sensor|air\s*box)\b/i.test(d.name));
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
      if (/\b(kobe|dimmer)\b/i.test(query) || /ഡിമ്മർ/i.test(query)) {
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
      if (/\b(lock|door\s*lock|door|vaathil|vathil)\b/i.test(query) || /വാതിൽ|അൺലോക്ക്|പൂട്ടുക/i.test(query)) {
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
        /\b(status|check|reading|power|voltage|current|battery|how is|what is|engane|ethraya|ethrayanu|nokku|nokkoo|check cheyyu)\b/i.test(input) ||
        /നില|പരിശോധിക്കുക|എത്രയാണ്|നോക്കുക/i.test(input);

      if (isStatusQuery && !/\b(turn\s*on|turn\s*off|trip|dim|on aakku|off aakku)\b/i.test(input)) {
        const tel = getDeviceTelemetry(matchedDevice, isMalayalam);
        return {
          reply: tel.text,
          action: isMalayalam ? `${matchedDevice.name} പരിശോധിച്ചു` : `${matchedDevice.name} Status Checked`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: tel.detail },
        };
      }

      // 2. Dimming / Brightness
      const dimMatch = input.match(/(\d+)\s*%/);
      if (dimMatch && (input.includes('dim') || input.includes('brightness') || input.includes('set') || input.includes('ബ്രൈറ്റ്നസ്'))) {
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
      const tempMatch = input.match(/(?:to|temp|temperature|ആക്കുക|ആക്കൂ|aakku)\s*(\d{2})/);
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
        /\b(off|stop|disable|trip|disconnect|close|shut|off\s*aakku|off\s*aakkoo|off\s*cheyyu|keduthu|keduthoo|keduthuka|nirthu|nirthuka|kedaakku|adakku|adakkoo)\b/i.test(input) ||
        /ഓഫ്|കെടുത്തുക|നിർത്തുക|അടയ്ക്കുക|ട്രിപ്പ്/i.test(input);

      if (isOff) {
        const isCover = matchedDevice.type === 'blinds_relay' || matchedDevice.type === 'cover' || matchedDevice.name.toLowerCase().includes('curtain');
        await executeDeviceAction(matchedDevice, isCover ? 'close' : 'off');
        const verb = matchedDevice.type === 'energy_meter' || input.includes('trip')
          ? (isMalayalam ? 'ട്രിപ്പ് ചെയ്തു / ഓഫാക്കി' : 'Tripped / Turned OFF')
          : isCover
          ? (isMalayalam ? 'അടച്ചു' : 'Closed')
          : (isMalayalam ? 'ഓഫ് ചെയ്തു' : 'Turned OFF');
        return {
          reply: isMalayalam
            ? `${matchedDevice.name} വിജയകരമായി ${verb}.`
            : `${verb} ${matchedDevice.name}.`,
          action: `${verb} ${matchedDevice.name}`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: isCover ? 'Closed' : 'OFF' },
        };
      }

      // 5. Turn ON / Open / Unlock
      const isOn =
        /\b(on|start|enable|connect|open|unlock|active|on\s*aakku|on\s*aakkoo|on\s*cheyyu|idu|ittu|thurakku|thurakkoo|thurakkuka)\b/i.test(input) ||
        /ഓൺ|തുറക്കുക|തുറക്കൂ|അൺലോക്ക്|ഇടുക/i.test(input);

      if (isOn || input.includes(matchedDevice.name.toLowerCase())) {
        const isCover = matchedDevice.type === 'blinds_relay' || matchedDevice.type === 'cover' || matchedDevice.name.toLowerCase().includes('curtain');
        const isLock = matchedDevice.type === 'ttlock' || matchedDevice.name.toLowerCase().includes('lock') || input.includes('door') || input.includes('vaathil') || input.includes('വാതിൽ');
        const act = isLock ? 'unlock' : isCover ? 'open' : 'on';
        const success = await executeDeviceAction(matchedDevice, act);
        if (!success && isLock) {
          return {
            reply: isMalayalam
              ? `${matchedDevice.name} അൺലോക്ക് ചെയ്യാൻ സാധിച്ചില്ല. TTLock ആപ്പിൽ "Remote Unlock" ഓൺ ആണോ എന്നും G2 Gateway കണക്റ്റഡ് ആണോ എന്നും ഉറപ്പാക്കുക.`
              : `Could not unlock ${matchedDevice.name}. Please ensure "Remote Unlock" is enabled in the TTLock mobile app (under Lock Settings) and the G2 Gateway is online.`,
            action: isMalayalam ? 'അൺലോക്ക് പരാജയപ്പെട്ടു' : 'Unlock Failed',
          };
        }
        const verb = isLock
          ? (isMalayalam ? 'തുറന്നു (അൺലോക്ക് ചെയ്തു)' : 'Unlocked')
          : isCover
          ? (isMalayalam ? 'തുറന്നു' : 'Opened')
          : (isMalayalam ? 'ഓൺ ചെയ്തു' : 'Turned ON');
        return {
          reply: isMalayalam
            ? `${matchedDevice.name} വിജയകരമായി ${verb}.`
            : `${verb} ${matchedDevice.name}.`,
          action: `${verb} ${matchedDevice.name}`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: isLock ? 'Unlocked' : isCover ? 'Opened' : 'ON' },
        };
      }

      // 6. Toggle
      if (input.includes('toggle') || input.includes('മാറ്റുക') || input.includes('maattu')) {
        await executeDeviceAction(matchedDevice, 'toggle');
        return {
          reply: isMalayalam ? `${matchedDevice.name} മാറ്റി പ്രവർത്തിപ്പിച്ചു.` : `Toggled ${matchedDevice.name}.`,
          action: `Toggled ${matchedDevice.name}`,
          deviceCard: { name: matchedDevice.name, type: matchedDevice.type },
        };
      }

      // Default: Report telemetry
      const tel = getDeviceTelemetry(matchedDevice, isMalayalam);
      return {
        reply: tel.text,
        action: isMalayalam ? `${matchedDevice.name} പരിശോധിച്ചു` : `${matchedDevice.name} Checked`,
        deviceCard: { name: matchedDevice.name, type: matchedDevice.type, detail: tel.detail },
      };
    }

    // 10. Specific Room Commands ("turn on room 1", "turn off room 2", "റൂം 1 ലൈറ്റുകൾ ഓഫ് ചെയ്യുക", "room 1 engane undu")
    for (const r of rooms) {
      const rName = r.name.toLowerCase();
      const numMatch = rName.match(/\d+/);
      const roomNum = numMatch ? numMatch[0] : '';

      let matchesRoom = new RegExp(`\\b${rName}\\b`, 'i').test(input);
      if (!matchesRoom && roomNum) {
        matchesRoom = new RegExp(`\\broom\\s*${roomNum}\\b`, 'i').test(input) || new RegExp(`\\bറൂം\\s*${roomNum}\\b`, 'i').test(input);
      }
      if (!matchesRoom && r.slug && r.slug.length > 2) {
        matchesRoom = new RegExp(`\\b${r.slug}\\b`, 'i').test(input);
      }

      if (matchesRoom) {
        const roomDevs = devices.filter((d) => d.room_id === r.id);

        // Navigation
        if (/\b(show|go to|view|kaanikku|തുറക്കുക|കാണിക്കുക)\b/i.test(input)) {
          onSelectRoom(r.id);
          return {
            reply: isMalayalam ? `${r.name} തുറന്നിരിക്കുന്നു.` : `Navigating to ${r.name}.`,
            action: `Opened ${r.name}`,
          };
        }

        // Room Status
        if (/\b(status|check|reading|engane|nila|നില)\b/i.test(input)) {
          const summaries = roomDevs.map((d) => {
            const tel = getDeviceTelemetry(d, isMalayalam);
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

        if (/\b(off|stop|disable|off\s*aakku|keduthu|ഓഫ്)\b/i.test(input)) {
          for (const d of controllableDevs) {
            await executeDeviceAction(d, 'off');
          }
          return {
            reply: isMalayalam
              ? `${r.name}-ലെ എല്ലാ (${controllableDevs.length}) ഉപകരണങ്ങളും ഓഫ് ചെയ്തു.`
              : `Turned OFF all ${controllableDevs.length} switches and lights in ${r.name}.`,
            action: `Turned OFF devices in ${r.name}`,
          };
        }

        if (/\b(on|start|enable|on\s*aakku|ഓൺ)\b/i.test(input)) {
          for (const d of controllableDevs) {
            await executeDeviceAction(d, 'on');
          }
          return {
            reply: isMalayalam
              ? `${r.name}-ലെ എല്ലാ (${controllableDevs.length}) ഉപകരണങ്ങളും ഓൺ ചെയ്തു.`
              : `Turned ON all ${controllableDevs.length} switches and lights in ${r.name}.`,
            action: `Turned ON devices in ${r.name}`,
          };
        }
      }
    }

    // 11. Check Direct Unmapped Zigbee2MQTT Devices
    for (const zDev of z2mDevices) {
      if (zDev.type === 'Coordinator') continue;
      if (input.includes(zDev.friendly_name.toLowerCase())) {
        const isOff = input.includes('off') || input.includes('trip') || input.includes('ഓഫ്') || input.includes('keduthu');
        await setZ2mState(zDev.friendly_name, { state: isOff ? 'OFF' : 'ON' });
        return {
          reply: isMalayalam
            ? `${zDev.friendly_name} ${isOff ? 'ഓഫ് ചെയ്തു' : 'ഓൺ ചെയ്തു'}.`
            : `Turned ${isOff ? 'OFF' : 'ON'} Zigbee device "${zDev.friendly_name}".`,
          action: `Zigbee ${zDev.friendly_name} ${isOff ? 'OFF' : 'ON'}`,
        };
      }
    }

    // 12. Localized, Polite Intelligent Fallback
    return {
      reply: isMalayalam
        ? `ക്ഷമിക്കണം, എനിക്ക് പൂർണ്ണമായി മനസ്സിലായില്ല. നിങ്ങൾക്ക് "ക്യാമറ qqq കാണിക്കുക", "സ്റ്റോർ റൂം ക്യാമറ തുറക്കുക", "സിസിടിവി വാൾ", "സ്വിച്ച് 1 ഓൺ ചെയ്യുക", "എല്ലാ ലൈറ്റുകളും ഓഫ് ചെയ്യുക", "വാതിൽ തുറക്കുക", അല്ലെങ്കിൽ "എനർജി മീറ്റർ പരിശോധിക്കുക" എന്ന് പറയാം.`
        : `I've noted: "${rawInput}". Try asking: "See visuals of camera qqq", "Open Store Room camera", "Go to CCTV Wall", "Turn on Switch 1", "Unlock door", "Trip energy meter", or "Turn off all lights".`,
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
    updateCompanionState('processing');

    const { reply, action, deviceCard, cameraCard } = await processCommand(text);

    const botMsg: ChatMessage = {
      id: `bot_${Date.now()}`,
      sender: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionTaken: action,
      deviceCard,
      cameraCard,
    };

    setMessages((prev) => [...prev, botMsg]);
    if (action) {
      updateCompanionState('success');
      setTimeout(() => {
        speak(reply);
      }, 500);
    } else {
      speak(reply);
    }
  };

  handleSendMessageRef.current = handleSendMessage;

  return (
    <div
      className={
        isFloating
          ? "flex flex-col h-full space-y-2 p-3 select-none"
          : "flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto space-y-4 pb-20 animate-in fade-in"
      }
    >
      {/* 1. ASSISTANT HEADER */}
      {isFloating ? (
        /* Floating Compact Header */
        <div className="bg-[#191A1D] rounded-2xl p-2.5 border border-[#383A3E] flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center font-bold shadow-sm overflow-hidden p-0.5">
              <img src="/domfly_companion.png" alt="DOMFLY" className="w-full h-full object-contain pointer-events-none" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-[#F5F5F5] flex items-center gap-1.5">
                {assistantName} Assistant
                <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-white/10 text-white border border-white/20">
                  LOCAL
                </span>
              </h2>
              <p className="text-[9px] font-mono text-[#A6A6A6]">Universal Building AI</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === 'en-IN' ? 'ml-IN' : 'en-IN')}
              className="px-2 py-1 rounded-lg bg-[#111214] border border-[#383A3E] hover:border-white/40 text-[10px] font-mono font-semibold text-white flex items-center gap-1"
            >
              <Languages className="w-3 h-3" />
              {language === 'en-IN' ? 'EN' : 'ML'}
            </button>

            {/* Speech toggle */}
            <button
              onClick={() => setSpeechEnabled(!speechEnabled)}
              className={`p-1 rounded-lg border transition-colors ${
                speechEnabled
                  ? 'bg-white text-slate-950 border-white'
                  : 'bg-[#111214] text-[#777777] border-[#383A3E]'
              }`}
              title={speechEnabled ? 'Mute Voice' : 'Enable Voice'}
            >
              {speechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Expand to Full Page */}
            {onNavigateToTab && (
              <button
                onClick={() => onNavigateToTab('chat')}
                className="p-1 rounded-lg bg-[#111214] text-[#A6A6A6] hover:text-white border border-[#383A3E] hover:border-white/40 transition-colors"
                title="Expand to Full Page"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Close Floating Drawer */}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg bg-[#111214] text-[#A6A6A6] hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#383A3E] transition-colors"
                title="Close Assistant"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Full Assistant Page: Companion Hero Showcase with larger DOMFLY character */
        <div className="bg-[#191A1D] rounded-3xl p-5 border border-[#383A3E] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 shadow-card">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white text-slate-950 flex items-center justify-center font-bold shadow-sm">
                <Sparkles className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#F5F5F5] flex items-center gap-2">
                  {assistantName} Voice &amp; Device Assistant
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-white border border-white/20">
                    LOCAL FIRST
                  </span>
                </h2>
                <p className="text-[11px] font-mono text-[#A6A6A6]">
                  Universal Control: Zigbee • Tuya Wi-Fi • TTLock • AC IR • HA
                </p>
              </div>
            </div>

            <p className="text-xs text-[#A6A6A6] leading-relaxed max-w-xl">
              Meet DOMFLY, your friendly 3D AI companion. Speak or type to command smart lights, climate, locks, and view live camera feeds across your building.
            </p>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              {/* Mic Permission Status Button */}
              <button
                onClick={requestMicPermission}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all ${
                  micPermissionState === 'granted'
                    ? 'bg-[#22D68A]/10 text-[#22D68A] border-[#22D68A]/30'
                    : micPermissionState === 'denied'
                    ? 'bg-[#FF5757]/10 text-[#FF5757] border-[#FF5757]/30 animate-pulse'
                    : 'bg-[#F0B94D]/10 text-[#F0B94D] border-[#F0B94D]/30 hover:bg-[#F0B94D]/20'
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
                    <span className="w-2 h-2 rounded-full bg-[#22D68A] animate-pulse" />
                    <span className="hidden sm:inline">Mic Ready</span>
                  </>
                ) : micPermissionState === 'denied' ? (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-[#FF5757]" />
                    <span className="hidden sm:inline">Mic Blocked</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-3.5 h-3.5 text-[#F0B94D]" />
                    <span className="hidden sm:inline">Enable Mic</span>
                  </>
                )}
              </button>

              {/* Language Toggle */}
              <button
                onClick={() => setLanguage(language === 'en-IN' ? 'ml-IN' : 'en-IN')}
                className="px-2.5 py-1 rounded-xl bg-[#111214] border border-[#383A3E] hover:border-white/40 text-xs font-mono font-semibold text-white flex items-center gap-1.5 transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                {language === 'en-IN' ? 'English (en-IN)' : 'മലയാളം (ml-IN)'}
              </button>

              {/* Speech Audio Reply Toggle */}
              <button
                onClick={() => setSpeechEnabled(!speechEnabled)}
                className={`p-1.5 rounded-xl border transition-colors ${
                  speechEnabled
                    ? 'bg-white text-slate-950 border-white'
                    : 'bg-[#111214] text-[#777777] border-[#383A3E]'
                }`}
                title={speechEnabled ? 'Mute Voice' : 'Enable Voice'}
              >
                {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* SIZABLE DOMFLY CHARACTER IN NATURAL EMPTY AREA OF ASSISTANT PAGE */}
          <div className="shrink-0 flex items-center justify-center">
            <DomflyCharacter
              size="lg"
              state={companionState}
              interactive={true}
              showStatusBadge={false}
            />
          </div>
        </div>
      )}

      {/* Microphone Permission Prompt Banner */}
      {micPermissionState === 'prompt' && (
        <div className="bg-[#191A1D] border border-[#383A3E] rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-[#F5F5F5] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#111214] border border-[#383A3E] text-white flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <span className="font-bold text-[#F5F5F5] block">Microphone Voice Control for localhost</span>
              <span className="text-[11px] text-[#A6A6A6] block">Click "Allow Microphone" to grant voice control permissions for all users on this localhost link.</span>
            </div>
          </div>
          <button
            onClick={requestMicPermission}
            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs shadow-sm shrink-0 transition-colors"
          >
            Allow Microphone
          </button>
        </div>
      )}

      {/* Microphone Denied Notice */}
      {micPermissionState === 'denied' && (
        <div className="bg-[#191A1D] border border-[#FF5757]/40 rounded-2xl p-3 flex items-center gap-3 text-xs text-[#FF5757] shrink-0">
          <MicOff className="w-5 h-5 text-[#FF5757] shrink-0" />
          <div>
            <span className="font-bold block">Microphone is blocked in your browser</span>
            <span className="text-[11px] text-[#A6A6A6] block">
              To allow voice commands: click the <strong>tune/lock icon</strong> on the left side of <code>localhost:5173</code> in the address bar &rarr; set <strong>Microphone</strong> to <strong>Allow</strong> &rarr; reload the page.
            </span>
          </div>
        </div>
      )}

      {/* Notice if accessing via insecure HTTP on a remote device */}
      {window.location.protocol !== 'https:' && !isLocalhost && (
        <div className="bg-[#191A1D] border border-[#F0B94D]/40 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-[#F5F5F5] shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#F0B94D] shrink-0" />
            <span>
              <strong>Phone Voice Setup</strong>: Mobile browsers block microphone on HTTP. Tap to switch to the secure HTTPS link.
            </span>
          </div>
          <a
            href={`https://${window.location.hostname}:5174/assistant`}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold text-xs shadow-sm shrink-0 transition-colors"
          >
            Switch to HTTPS
          </a>
        </div>
      )}

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-[#111214] rounded-2xl border border-[#383A3E]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-white text-slate-950 rounded-br-none font-semibold'
                  : 'bg-[#191A1D] text-[#F5F5F5] border border-[#383A3E] rounded-bl-none space-y-2'
              }`}
            >
              <p>{msg.text}</p>

              {msg.actionTaken && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#111214] text-[10px] font-mono text-[#22D68A] border border-[#383A3E]">
                    <CheckCircle2 className="w-3 h-3 text-[#22D68A]" /> {msg.actionTaken}
                  </span>
                </div>
              )}

              {msg.deviceCard && (
                <div className="mt-2 p-2.5 bg-[#111214] rounded-xl border border-[#383A3E] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#202226] text-white flex items-center justify-center">
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
                      <span className="font-bold text-[#F5F5F5] text-xs block">{msg.deviceCard.name}</span>
                      {msg.deviceCard.detail && (
                        <span className="text-[10px] font-mono text-[#A6A6A6] block">{msg.deviceCard.detail}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {msg.cameraCard && (
                <div className="mt-2.5 p-3 bg-[#111214] rounded-2xl border border-[#383A3E] space-y-2.5 w-full min-w-[260px] sm:min-w-[340px] max-w-sm shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-[#202226] text-white flex items-center justify-center">
                        <CameraIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-[#F5F5F5] text-xs block">
                          {msg.cameraCard.camera.name}
                        </span>
                        <span className="text-[10px] font-mono text-[#22D68A] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22D68A] animate-pulse" />
                          {msg.cameraCard.camera.stream_id} • Live Feed
                        </span>
                      </div>
                    </div>
                    {msg.cameraCard.camera.ptz_enabled ? (
                      <span className="text-[10px] font-mono text-[#22D68A] bg-[#22D68A]/10 px-2 py-0.5 rounded-full border border-[#22D68A]/30 flex items-center gap-1">
                        <Compass className="w-3 h-3" /> PTZ
                      </span>
                    ) : null}
                  </div>

                  {/* Live Go2RTC Video Player */}
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-[#383A3E]">
                    <Go2rtcVideo
                      camera={msg.cameraCard.camera}
                      className="w-full h-full object-cover"
                      onFullscreen={() => onOpenFullscreenCamera?.(msg.cameraCard!.camera)}
                    />
                  </div>

                  {/* Action Navigation Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    {onOpenFullscreenCamera && (
                      <button
                        onClick={() => onOpenFullscreenCamera(msg.cameraCard!.camera)}
                        className="flex-1 py-1.5 px-3 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-slate-950" /> Fullscreen & PTZ
                      </button>
                    )}
                    {onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab('cctv')}
                        className="py-1.5 px-3 rounded-xl bg-[#202226] hover:bg-[#282a2e] text-[#F5F5F5] text-xs font-semibold flex items-center justify-center gap-1.5 border border-[#383A3E] transition-colors"
                      >
                        <Video className="w-3.5 h-3.5 text-white" /> CCTV Wall
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <span className="text-[9px] font-mono text-[#777777] mt-1 px-1">
              {msg.timestamp}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input & Mic Bar */}
      <div className="flex items-center gap-2 bg-[#191A1D] p-2 rounded-2xl border border-[#383A3E] shrink-0">
        <button
          onClick={toggleMic}
          className={`p-3 rounded-xl transition-all ${
            isListening
              ? 'bg-[#FF5757] text-white animate-pulse'
              : 'bg-[#111214] border border-[#383A3E] hover:border-white/40 text-white'
          }`}
          title={isListening ? 'Stop listening' : 'Start speaking'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          placeholder={
            isListening
              ? language === 'ml-IN'
                ? 'കേൾക്കുന്നു... സംസാരിക്കുക'
                : 'Listening...'
              : language === 'ml-IN'
              ? 'പറയുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക: "ക്യാമറ qqq കാണിക്കുക", "വാതിൽ തുറക്കുക", "സ്വിച്ച് 1 ഓൺ ചെയ്യുക"...'
              : 'Say or type: "See visuals of camera qqq", "light on aakku", "vaathil thurakku", "Turn on Switch 1"...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 bg-[#111214] border border-[#383A3E] rounded-xl px-4 py-2.5 text-xs text-[#F5F5F5] placeholder-[#777777] focus:border-white/50 focus:outline-none"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-3 rounded-xl bg-white hover:bg-neutral-200 text-slate-950 font-bold shadow-sm disabled:opacity-40 active:scale-95 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
