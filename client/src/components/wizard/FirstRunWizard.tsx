import React, { useState } from 'react';
import {
  Building2,
  User,
  Wifi,
  Video,
  KeyRound,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useBootstrap } from '../../context/BootstrapContext';

interface FirstRunWizardProps {
  onComplete: () => void;
}

export const FirstRunWizard: React.FC<FirstRunWizardProps> = ({ onComplete }) => {
  const { register, login, user, setSetupCompletedStatus } = useAuth();
  const { refreshBootstrap } = useBootstrap();

  const [step, setStep] = useState(() => (user ? 2 : 1));
  const totalSteps = 6;

  // Step 1: Admin Account
  const [adminName, setAdminName] = useState('Admin');
  const [adminEmail, setAdminEmail] = useState('admin@dominatee.local');
  const [adminPass, setAdminPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [adminRegistered, setAdminRegistered] = useState(false);

  // Step 2: Home Assistant
  const [hubName, setHubName] = useState('Primary Building Hub');
  const [localUrl, setLocalUrl] = useState('http://192.168.1.100:8123');
  const [cloudUrl, setCloudUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [testingHa, setTestingHa] = useState(false);
  const [haTestResult, setHaTestResult] = useState<any>(null);
  const [savedHubId, setSavedHubId] = useState<string | null>(null);

  // Step 3: Go2RTC
  const [go2rtcUrl, setGo2rtcUrl] = useState('http://192.168.1.50:1984');
  const [camName, setCamName] = useState('Main Reception Camera');
  const [streamId, setStreamId] = useState('cam1');
  const [rtspSubUrl, setRtspSubUrl] = useState('');

  // Step 4: TTLock & HR
  const [ttlockClientId, setTtlockClientId] = useState('');
  const [ttlockClientSecret, setTtlockClientSecret] = useState('');
  const [ttlockUsername, setTtlockUsername] = useState('');
  const [ttlockPassword, setTtlockPassword] = useState('');
  const [hrBaseUrl, setHrBaseUrl] = useState('');
  const [hrToken, setHrToken] = useState('');

  // Step 5: Import Areas
  const [importingAreas, setImportingAreas] = useState(false);
  const [importResult, setImportResult] = useState<{ rooms: number; devices: number } | null>(null);

  // Step 6: HomeKey
  const [homeKey, setHomeKey] = useState('');
  const [homeKeyPreview, setHomeKeyPreview] = useState('');
  const [requireHomeKey, setRequireHomeKey] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Error messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-advance if already authenticated
  React.useEffect(() => {
    if (user) {
      setStep((prev) => (prev === 1 ? 2 : prev));
    }
  }, [user]);

  // Step 1: Submit Admin
  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await register(adminName, adminEmail, adminPass);
      setAdminRegistered(true);
      setStep(2);
    } catch (err: any) {
      if (err.message && err.message.toLowerCase().includes('already exists')) {
        try {
          await login(adminEmail, adminPass);
          setAdminRegistered(true);
          setStep(2);
          return;
        } catch (loginErr: any) {
          setErrorMsg('An account with this email exists. Please enter the correct password to log in, or continue if already signed in.');
          return;
        }
      }
      setErrorMsg(err.message || 'Failed to create admin user');
    }
  };

  // Step 2: Test & Save HA Hub
  const handleTestHa = async () => {
    setErrorMsg(null);
    setTestingHa(true);
    setHaTestResult(null);
    try {
      const res = await ApiService.testHaConnection({ local_url: localUrl.trim(), access_token: haToken.trim() });
      setHaTestResult(res);
      if (!res.ok) {
        setErrorMsg(res.error || 'Connection failed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect');
    } finally {
      setTestingHa(false);
    }
  };

  const handleSaveHaHub = async () => {
    setErrorMsg(null);
    try {
      const res = await ApiService.addHub({
        name: hubName.trim(),
        local_url: localUrl.trim(),
        cloud_url: (cloudUrl || '').trim(),
        access_token: haToken.trim(),
      });
      setSavedHubId(res.id);
      setStep(3);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Step 3: Save Go2RTC
  const handleSaveGo2rtc = async () => {
    setErrorMsg(null);
    try {
      await ApiService.updateConfig({ go2rtc_base_url: go2rtcUrl });
      if (streamId) {
        await ApiService.addCamera({
          name: camName,
          stream_id: streamId,
          rtsp_sub_url: rtspSubUrl || null,
        });
      }
      setStep(4);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Step 4: Save TTLock & HR
  const handleSaveIntegrations = async () => {
    setErrorMsg(null);
    try {
      await ApiService.updateConfig({
        ttlock_client_id: ttlockClientId,
        ttlock_client_secret: ttlockClientSecret,
        ttlock_username: ttlockUsername,
        ttlock_password: ttlockPassword,
        hr_base_url: hrBaseUrl,
        hr_auth_token: hrToken,
      });
      setStep(5);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Step 5: 1-Click Auto Import
  const handleAutoImport = async () => {
    if (!savedHubId) return;
    setImportingAreas(true);
    setErrorMsg(null);
    try {
      const res = await ApiService.autoImportHaAreas(savedHubId);
      setImportResult({ rooms: res.importedRooms, devices: res.importedDevices });
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setImportingAreas(false);
    }
  };

  // Step 6: Generate HomeKey & Complete
  const handleGenerateHomeKey = async () => {
    try {
      const res = await ApiService.generateHomeKey(requireHomeKey);
      setHomeKey(res.homeKey);
      setHomeKeyPreview(res.preview);
    } catch (_) {}
  };

  const handleFinishSetup = async () => {
    setFinishing(true);
    try {
      await ApiService.updateConfig({
        setup_completed: 1 as any,
        require_home_key: requireHomeKey ? (1 as any) : (0 as any),
      });
      setSetupCompletedStatus(true);
      await refreshBootstrap();
      onComplete();
    } catch (err: any) {
      setErrorMsg(err.message);
      setFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d16] overflow-y-auto">
      {/* Background glow lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse-subtle" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl glass-panel rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl z-10 animate-in fade-in">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-brand-600 flex items-center justify-center text-slate-950 shadow-glow">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-wide">DOMINATEE Smart Building OS</h2>
              <p className="text-xs text-cyan-400 font-mono">100% User-Configurable Setup Wizard (Step {step} of {totalSteps})</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-300">
            {Math.round((step / totalSteps) * 100)}% Complete
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Admin Account */}
        {step === 1 && (
          <div className="space-y-4">
            {user && (
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">Signed in as {user.name}</p>
                  <p className="text-[11px] text-cyan-300 font-mono">{user.email} ({user.role})</p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-1.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow-glow hover:opacity-90"
                >
                  Continue to Step 2 <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <form onSubmit={handleRegisterAdmin} className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Create Local Administrator Account</h3>
              <p className="text-xs text-slate-400">
                This account is stored strictly in your local SQLite database with zero third-party cloud auth.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Administrator Full Name</label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Admin Email Address</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Master Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  placeholder="Enter strong password"
                  className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white font-mono pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wider shadow-glow hover:opacity-95 flex items-center gap-2"
              >
                Create Admin & Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
          </div>
        )}

        {/* STEP 2: Home Assistant */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Connect Primary Home Assistant Hub</h3>
              <p className="text-xs text-slate-400">
                Input your local Home Assistant IP address and Long-Lived Access Token.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hub Name</label>
              <input
                type="text"
                value={hubName}
                onChange={(e) => setHubName(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Local LAN URL</label>
                <input
                  type="text"
                  required
                  placeholder="http://192.168.1.100:8123"
                  value={localUrl}
                  onChange={(e) => setLocalUrl(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Cloud / Tunnel URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://ha.myoffice.com"
                  value={cloudUrl}
                  onChange={(e) => setCloudUrl(e.target.value)}
                  className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Long-Lived Access Token</label>
              <input
                type="password"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={haToken}
                onChange={(e) => setHaToken(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleTestHa}
                disabled={testingHa || !localUrl || !haToken}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-cyan-400 text-xs font-bold flex items-center gap-2 border border-white/10"
              >
                {testingHa ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                Test Live Connection
              </button>

              {haTestResult && haTestResult.ok && (
                <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Connected to {haTestResult.haVersion} ({haTestResult.totalEntities} entities)
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleSaveHaHub}
                disabled={!localUrl || !haToken}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wider shadow-glow hover:opacity-95 flex items-center gap-2 disabled:opacity-50"
              >
                Save Hub & Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Go2RTC CCTV */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Configure Go2RTC Camera Server</h3>
              <p className="text-xs text-slate-400">
                Zero-delay WebRTC & MSE camera streams gateway.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Go2RTC Base URL</label>
              <input
                type="text"
                placeholder="http://192.168.1.50:1984"
                value={go2rtcUrl}
                onChange={(e) => setGo2rtcUrl(e.target.value)}
                className="w-full glass-input rounded-xl px-3 py-2 text-sm text-white font-mono"
              />
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Initial Camera (Optional)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400">Camera Name</label>
                  <input
                    type="text"
                    value={camName}
                    onChange={(e) => setCamName(e.target.value)}
                    className="w-full glass-input rounded-lg px-2.5 py-1 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400">Go2RTC Stream ID</label>
                  <input
                    type="text"
                    value={streamId}
                    onChange={(e) => setStreamId(e.target.value)}
                    className="w-full glass-input rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400">RTSP Stream URL</label>
                <input
                  type="text"
                  placeholder="rtsp://admin:pass@192.168.1.200:554/live/ch0"
                  value={rtspSubUrl}
                  onChange={(e) => setRtspSubUrl(e.target.value)}
                  className="w-full glass-input rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button onClick={() => setStep(2)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleSaveGo2rtc}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wider shadow-glow flex items-center gap-2"
              >
                Save CCTV & Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: TTLock & HR Biometrics (Optional) */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">TTLock Smart Doors & HR Biometrics</h3>
              <p className="text-xs text-slate-400">
                You can configure these now or manage them anytime later in Admin Studio.
              </p>
            </div>

            {/* TTLock */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-2">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">TTLock Cloud Credentials</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Client ID"
                  value={ttlockClientId}
                  onChange={(e) => setTtlockClientId(e.target.value)}
                  className="glass-input rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <input
                  type="password"
                  placeholder="Client Secret"
                  value={ttlockClientSecret}
                  onChange={(e) => setTtlockClientSecret(e.target.value)}
                  className="glass-input rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={ttlockUsername}
                  onChange={(e) => setTtlockUsername(e.target.value)}
                  className="glass-input rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <input
                  type="password"
                  placeholder="Password (Auto-hashed to MD5)"
                  value={ttlockPassword}
                  onChange={(e) => setTtlockPassword(e.target.value)}
                  className="glass-input rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            {/* HR Server */}
            <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-2">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">ZKTeco / HR Biometric Server</h4>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="HR Server URL (e.g. http://192.168.1.60:8080)"
                  value={hrBaseUrl}
                  onChange={(e) => setHrBaseUrl(e.target.value)}
                  className="glass-input rounded-lg px-2.5 py-1 text-xs text-white"
                />
                <input
                  type="password"
                  placeholder="HR Auth Token"
                  value={hrToken}
                  onChange={(e) => setHrToken(e.target.value)}
                  className="glass-input rounded-lg px-2.5 py-1 text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between">
              <button onClick={() => setStep(3)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleSaveIntegrations}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wider shadow-glow flex items-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: 1-Click Auto-Import from HA Areas */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Floors, Rooms & Device Mapping</h3>
              <p className="text-xs text-slate-400">
                You can automatically scan your Home Assistant instance and import all areas as rooms, or configure them manually.
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-950/40 to-brand-950/40 border border-cyan-500/30 rounded-2xl p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto shadow-glow">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">1-Click Auto-Import from Home Assistant</h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto mt-1">
                  Our discovery scanner will query your HA hub and automatically create rooms for all areas, mapping your lights, switches, climates, covers, and sensors into live interactive tiles!
                </p>
              </div>

              <button
                onClick={handleAutoImport}
                disabled={importingAreas || !savedHubId}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-extrabold text-xs tracking-wider shadow-glow hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2"
              >
                {importingAreas ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Run 1-Click Area & Device Import
              </button>

              {importResult && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-mono flex items-center justify-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4" />
                  Successfully imported {importResult.rooms} rooms and {importResult.devices} devices!
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-between">
              <button onClick={() => setStep(4)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => {
                  handleGenerateHomeKey();
                  setStep(6);
                }}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-brand-500 text-slate-950 font-bold text-xs tracking-wider shadow-glow flex items-center gap-2"
              >
                Proceed to Security & Launch <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: HomeKey & Launch */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Security Gate & Launch Dashboard</h3>
              <p className="text-xs text-slate-400">
                Shareable HomeKey gate and finalization.
              </p>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white block">Generate HomeKey</span>
                  <span className="text-[11px] text-slate-400">Unique fingerprint combining your hub URLs</span>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateHomeKey}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 text-cyan-400 text-xs font-semibold flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Re-Generate
                </button>
              </div>

              {homeKey && (
                <div className="p-2.5 rounded-lg bg-black/60 font-mono text-xs text-cyan-300 border border-cyan-800/40 break-all">
                  {homeKey}
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="reqKey"
                  checked={requireHomeKey}
                  onChange={(e) => setRequireHomeKey(e.target.checked)}
                  className="rounded bg-slate-800 border-white/20 text-cyan-400 focus:ring-0"
                />
                <label htmlFor="reqKey" className="text-xs text-slate-300 select-none">
                  Require new mobile devices on LAN to enter HomeKey on first visit
                </label>
              </div>
            </div>

            <div className="pt-6 flex justify-between">
              <button onClick={() => setStep(5)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                type="button"
                onClick={handleFinishSetup}
                disabled={finishing}
                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-400 to-brand-500 text-slate-950 font-extrabold text-sm tracking-wider shadow-glow hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                {finishing ? (
                  <span className="animate-spin">⟳ Finalizing...</span>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" /> Launch DOMINATEE OS
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
