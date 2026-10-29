import React, { useState, useEffect } from 'react';
import { UserCheck, Clock, Upload, Plus, CheckCircle2, User, Building, LogIn, LogOut } from 'lucide-react';
import { ApiService } from '../services/api';

export const AttendancePanel: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Punch State
  const [empId, setEmpId] = useState('');
  const [empName, setEmpName] = useState('');
  const [department, setDepartment] = useState('Operations');
  const [punching, setPunching] = useState(false);
  const [punchSuccess, setPunchSuccess] = useState(false);

  const loadAttendance = async () => {
    try {
      const res = await ApiService.fetchAttendance();
      setLogs(res.logs || []);
    } catch (err) {
      console.warn('[Attendance] Load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const handleManualPunch = async (type: 'IN' | 'OUT') => {
    if (!empId || !empName) {
      alert('Please enter Employee ID and Name');
      return;
    }

    setPunching(true);
    try {
      await ApiService.punchAttendance({
        employeeId: empId,
        employeeName: empName,
        department,
        type,
      });
      setPunchSuccess(true);
      setTimeout(() => setPunchSuccess(false), 3000);
      await loadAttendance();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPunching(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await ApiService.uploadAttendanceBatch(text, 'csv');
      alert(`Imported ${res.importedCount} attendance logs`);
      await loadAttendance();
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto animate-in fade-in">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-glow">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Biometric Attendance & Access Logs</h2>
            <p className="text-xs text-slate-400">ZKTeco Biometrics & Web Kiosk Verification</p>
          </div>
        </div>

        <label className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-white/10 flex items-center gap-1.5 cursor-pointer">
          <Upload className="w-3.5 h-3.5 text-cyan-400" /> Import Biometric CSV
          <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
        </label>
      </div>

      {/* Manual Kiosk Punch Form */}
      <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-3">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Web Kiosk Quick Punch
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Employee / Staff ID (e.g. EMP001)"
            value={empId}
            onChange={(e) => setEmpId(e.target.value)}
            className="glass-input rounded-xl px-3 py-2 text-xs text-white font-mono"
          />
          <input
            type="text"
            placeholder="Full Name"
            value={empName}
            onChange={(e) => setEmpName(e.target.value)}
            className="glass-input rounded-xl px-3 py-2 text-xs text-white"
          />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="glass-input rounded-xl px-3 py-2 text-xs text-white"
          >
            <option value="Executive" className="bg-slate-900">Executive</option>
            <option value="Engineering" className="bg-slate-900">Engineering</option>
            <option value="Operations" className="bg-slate-900">Operations</option>
            <option value="Product Design" className="bg-slate-900">Product Design</option>
            <option value="Finance" className="bg-slate-900">Finance</option>
          </select>
        </div>

        <div className="flex items-center justify-between pt-2">
          {punchSuccess && (
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" /> Punch logged successfully!
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => handleManualPunch('IN')}
              disabled={punching}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-glow-emerald flex items-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5" /> Punch IN
            </button>
            <button
              onClick={() => handleManualPunch('OUT')}
              disabled={punching}
              className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Punch OUT
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Logs Table */}
      <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Today's Biometric Log Stream ({logs.length} Punches)
          </h3>
          <button onClick={loadAttendance} className="text-xs text-cyan-400 hover:text-cyan-300">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[10px] font-mono uppercase text-slate-400 border-b border-white/5">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Gateway</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 font-semibold text-white">
                    {log.employeeName}
                    <span className="block text-[10px] font-mono text-cyan-400">{log.employeeId}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{log.department}</td>
                  <td className="px-4 py-3 font-mono text-slate-300">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        log.type === 'IN'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {log.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-500">{log.deviceSn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
