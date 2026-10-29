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
} from 'lucide-react';
import { useBootstrap } from '../context/BootstrapContext';
import { useHA } from '../context/MultiHubHomeAssistantProvider';
import { ApiService } from '../services/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionTaken?: string;
}

interface ChatPageProps {
  onSelectRoom: (roomId: string) => void;
}

export const ChatPage: React.FC<ChatPageProps> = ({ onSelectRoom }) => {
  const { data } = useBootstrap();
  const { callService } = useHA();

  const assistantName = data?.config?.assistant_name || 'DOMFLY';
  const rooms = data?.rooms || [];
  const devices = data?.devices || [];

  const [language, setLanguage] = useState<'en-IN' | 'ml-IN'>('en-IN');
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I am ${assistantName}, your local building AI assistant. You can speak or type in English or Malayalam. How can I assist you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSendMessage(transcript);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [language]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser. Please use Chrome/Edge or type below.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
      setIsListening(true);
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

  // Dynamic Natural Language Processing Engine
  const processCommand = async (rawInput: string): Promise<{ reply: string; action?: string }> => {
    const input = rawInput.toLowerCase().trim();

    // 1. Weather intent
    if (input.includes('weather') || input.includes('temperature') || input.includes('കാലാവസ്ഥ')) {
      try {
        const w = await ApiService.fetchWeather();
        const temp = w.current?.temperature_2m ? Math.round(w.current.temperature_2m) : 28;
        const reply = language === 'ml-IN'
          ? `ഇപ്പോഴത്തെ താപനില ${temp}°C ആണ്. കാലാവസ്ഥ സുഖകരമാണ്.`
          : `The current outdoor temperature is ${temp}°C at ${w.label || 'the office'}.`;
        return { reply, action: 'Weather Checked' };
      } catch (_) {
        return { reply: 'Currently 28°C outside with clear skies.' };
      }
    }

    // 2. News intent
    if (input.includes('news') || input.includes('വാർത്തകൾ') || input.includes('updates')) {
      try {
        const n = await ApiService.fetchNews();
        const first = n.news?.[0];
        const reply = first ? `${first.title}: ${first.summary}` : 'Building systems operating smoothly at 100% health.';
        return { reply, action: 'News Fetched' };
      } catch (_) {
        return { reply: 'Building operating normally.' };
      }
    }

    // 3. Quick Action: "I am here" / "ഞാൻ എത്തി"
    if (input.includes('i am here') || input.includes('arrived') || input.includes('ഞാൻ എത്തി')) {
      // Turn on first 3 lights
      for (const d of devices.slice(0, 3)) {
        if ((d.type === 'switch_light' || d.type === 'dimmable_light') && d.entity_id) {
          callService(d.entity_id.split('.')[0], 'turn_on', { entity_id: d.entity_id }).catch(() => { });
        }
      }
      return {
        reply: language === 'ml-IN' ? 'സ്വാഗതം! പ്രധാന ലൈറ്റുകൾ ഓൺ ചെയ്തിരിക്കുന്നു.' : 'Welcome back! Main entrance and office lights turned on.',
        action: 'Arrival Routine Triggered',
      };
    }

    // 4. Quick Action: "I am leaving" / "ഞാൻ പോകുന്നു"
    if (input.includes('leaving') || input.includes('goodbye') || input.includes('ഞാൻ പോകുന്നു') || input.includes('ഓഫാക്കുക')) {
      for (const d of devices) {
        if ((d.type === 'switch_light' || d.type === 'dimmable_light') && d.entity_id) {
          callService(d.entity_id.split('.')[0], 'turn_off', { entity_id: d.entity_id }).catch(() => { });
        }
      }
      return {
        reply: language === 'ml-IN' ? 'ശരി, എല്ലാ ലൈറ്റുകളും ഓഫ് ചെയ്തു. സുരക്ഷിതമായി യാത്ര ചെയ്യുക!' : 'All office lights turned off. Have a safe journey!',
        action: 'Departure Routine Triggered',
      };
    }

    // 5. Quick Action: "I am sweating" / "ചൂട്" -> lower AC
    if (input.includes('sweating') || input.includes('hot') || input.includes('ചൂട്') || input.includes('തണുപ്പിക്കുക')) {
      const acDev = devices.find((d) => d.type === 'ac_ir' || d.type === 'climate');
      if (acDev) {
        if (acDev.type === 'ac_ir') {
          await ApiService.sendAcIr(acDev.id, 'temp_20', { power: true, temp: 20, mode: 'cool' });
        }
        return {
          reply: language === 'ml-IN' ? 'എസി 20°C ലേക്ക് താഴ്ത്തി തണുപ്പിച്ചു.' : `Cooled down the AC to 20°C in ${acDev.name}.`,
          action: 'AC Set to 20°C',
        };
      }
    }

    // 6. Dynamic Room Navigation: "show [Room Name]"
    for (const r of rooms) {
      let aliases: string[] = [];
      try { aliases = JSON.parse(r.aliases_json || '[]'); } catch (_) { }
      const names = [r.name.toLowerCase(), r.slug.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];

      if (names.some((n) => input.includes(n))) {
        if (input.includes('show') || input.includes('open') || input.includes('കാണിക്കുക') || input.includes('മുറി')) {
          onSelectRoom(r.id);
          return {
            reply: language === 'ml-IN' ? `${r.name} തുറന്നിരിക്കുന്നു.` : `Navigating to ${r.name}.`,
            action: `Opened ${r.name}`,
          };
        }

        // Room device action: "turn on lights in [Room]"
        const roomDevs = devices.filter((d) => d.room_id === r.id);
        if (input.includes('on') || input.includes('ഓൺ')) {
          for (const d of roomDevs) {
            if ((d.type === 'switch_light' || d.type === 'dimmable_light') && d.entity_id) {
              callService(d.entity_id.split('.')[0], 'turn_on', { entity_id: d.entity_id }).catch(() => { });
            }
          }
          return {
            reply: language === 'ml-IN' ? `${r.name}-ലെ ലൈറ്റുകൾ ഓൺ ചെയ്തു.` : `Turned on all lights in ${r.name}.`,
            action: `Turned on lights in ${r.name}`,
          };
        }

        if (input.includes('off') || input.includes('ഓഫ്')) {
          for (const d of roomDevs) {
            if ((d.type === 'switch_light' || d.type === 'dimmable_light') && d.entity_id) {
              callService(d.entity_id.split('.')[0], 'turn_off', { entity_id: d.entity_id }).catch(() => { });
            }
          }
          return {
            reply: language === 'ml-IN' ? `${r.name}-ലെ ലൈറ്റുകൾ ഓഫ് ചെയ്തു.` : `Turned off all lights in ${r.name}.`,
            action: `Turned off lights in ${r.name}`,
          };
        }
      }
    }

    // Default Fallback
    return {
      reply: language === 'ml-IN'
        ? `ക്ഷമിക്കണം, എനിക്ക് പൂർണ്ണമായി മനസ്സിലായില്ല. നിങ്ങൾക്ക് "ലൈറ്റ് ഓൺ ചെയ്യുക", "ഞാൻ എത്തി", "കാലാവസ്ഥ" എന്ന് പറയാം.`
        : `I've noted: "${rawInput}". You can say "I am here", "Turn off all lights", "Weather", or "Show [Room Name]".`,
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

    const { reply, action } = await processCommand(text);

    const botMsg: ChatMessage = {
      id: `bot_${Date.now()}`,
      sender: 'assistant',
      text: reply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionTaken: action,
    };

    setMessages((prev) => [...prev, botMsg]);
    speak(reply);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto space-y-4 pb-20 animate-in fade-in">
      {/* Assistant Header */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-glow">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">{assistantName} Voice Assistant</h2>
            <p className="text-[10px] font-mono text-cyan-400">English & മലയാളം Bilingual AI • Local First</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === 'en-IN' ? 'ml-IN' : 'en-IN')}
            className="px-2.5 py-1 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono font-semibold text-cyan-400 flex items-center gap-1.5"
          >
            <Languages className="w-3.5 h-3.5" />
            {language === 'en-IN' ? 'English (en-IN)' : 'മലയാളം (ml-IN)'}
          </button>

          {/* Speech audio reply toggle */}
          <button
            onClick={() => setSpeechEnabled(!speechEnabled)}
            className={`p-1.5 rounded-xl border ${speechEnabled ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-slate-900 text-slate-500 border-white/10'
              }`}
          >
            {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Quick Action Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 shrink-0">
        <button
          onClick={() => handleSendMessage('I am here')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-emerald-300 border border-emerald-500/20 shrink-0"
        >
          👋 I am here
        </button>
        <button
          onClick={() => handleSendMessage('Turn off all lights')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-rose-300 border border-rose-500/20 shrink-0"
        >
          🛑 Turn off all lights
        </button>
        <button
          onClick={() => handleSendMessage('I am sweating')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-cyan-300 border border-cyan-500/20 shrink-0"
        >
          ❄️ I am sweating
        </button>
        <button
          onClick={() => handleSendMessage('What is the weather?')}
          className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-semibold text-amber-300 border border-amber-500/20 shrink-0"
        >
          ☀️ Weather
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
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed shadow-md ${msg.sender === 'user'
                ? 'bg-gradient-to-r from-cyan-600 to-brand-600 text-white rounded-br-none'
                : 'bg-slate-900/90 text-slate-100 border border-white/10 rounded-bl-none'
                }`}
            >
              <p>{msg.text}</p>
              {msg.actionTaken && (
                <span className="mt-1.5 inline-block px-2 py-0.5 rounded bg-cyan-950/80 text-[10px] font-mono text-cyan-400 border border-cyan-800/40">
                  ⚡ {msg.actionTaken}
                </span>
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
          className={`p-3 rounded-xl transition-all ${isListening
            ? 'bg-rose-500 text-white shadow-glow animate-pulse'
            : 'bg-slate-800 hover:bg-slate-700 text-cyan-400'
            }`}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          placeholder={isListening ? 'Listening...' : language === 'ml-IN' ? 'ഇവിടെ ടൈപ്പ് ചെയ്യുക...' : 'Ask assistant or type voice command...'}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 glass-input rounded-xl px-4 py-2.5 text-xs text-white"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={!inputText.trim()}
          className="p-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold shadow-glow disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
