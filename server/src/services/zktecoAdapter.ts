export interface PunchLog {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  timestamp: string;
  type: 'IN' | 'OUT';
  deviceSn: string;
}

export class ZKTecoAdapter {
  /**
   * Fetch attendance logs from remote server or demo adapter
   */
  static async getAttendance(
    baseUrl: string,
    authToken: string,
    excludedIds: string[] = []
  ): Promise<PunchLog[]> {
    if (baseUrl) {
      try {
        const cleanUrl = baseUrl.replace(/\/+$/, '');
        const res = await fetch(`${cleanUrl}/api/attendance/logs`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (res.ok) {
          const logs = (await res.json()) as any[];
          return logs
            .map((item, idx) => ({
              id: item.id || `punch_${idx}`,
              employeeId: String(item.employeeId || item.userId || item.pin || '100'),
              employeeName: item.employeeName || item.name || 'Staff Member',
              department: item.department || 'Operations',
              timestamp: item.timestamp || new Date().toISOString(),
              type: ((item.type || 'IN').toUpperCase() === 'OUT' ? 'OUT' : 'IN') as 'IN' | 'OUT',
              deviceSn: item.deviceSn || 'ZKTeco-Main',
            }))
            .filter((p) => !excludedIds.includes(p.employeeId));
        }
      } catch (err) {
        console.warn('[ZKTeco] Fetch failed, returning local/demo logs:', err);
      }
    }

    // Default rich sample logs for testing / preview
    const today = new Date().toISOString().split('T')[0];
    const sampleLogs: PunchLog[] = [
      { id: '1', employeeId: 'EMP001', employeeName: 'Hari Nair', department: 'Executive', timestamp: `${today}T08:55:12`, type: 'IN', deviceSn: 'ZK-RECEPT-01' },
      { id: '2', employeeId: 'EMP002', employeeName: 'Rahul Verma', department: 'Engineering', timestamp: `${today}T09:02:44`, type: 'IN', deviceSn: 'ZK-RECEPT-01' },
      { id: '3', employeeId: 'EMP003', employeeName: 'Aishwarya K.', department: 'Product Design', timestamp: `${today}T09:14:02`, type: 'IN', deviceSn: 'ZK-RECEPT-01' },
      { id: '4', employeeId: 'EMP004', employeeName: 'Devan Menon', department: 'Operations', timestamp: `${today}T09:25:31`, type: 'IN', deviceSn: 'ZK-RECEPT-01' },
      { id: '5', employeeId: 'EMP005', employeeName: 'Sneha Patel', department: 'Finance', timestamp: `${today}T09:30:10`, type: 'IN', deviceSn: 'ZK-RECEPT-01' },
      { id: '6', employeeId: 'EMP002', employeeName: 'Rahul Verma', department: 'Engineering', timestamp: `${today}T13:05:18`, type: 'OUT', deviceSn: 'ZK-RECEPT-01' },
      { id: '7', employeeId: 'EMP002', employeeName: 'Rahul Verma', department: 'Engineering', timestamp: `${today}T13:48:50`, type: 'IN', deviceSn: 'ZK-RECEPT-01' },
    ];

    return sampleLogs.filter((p) => !excludedIds.includes(p.employeeId));
  }

  /**
   * Parse CSV or JSON batch upload data
   */
  static parseUploadBatch(content: string, type: 'csv' | 'json'): PunchLog[] {
    if (type === 'json') {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    }

    // Parse CSV: ID, Name, Department, Timestamp, Type
    const lines = content.trim().split('\n');
    const logs: PunchLog[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.toLowerCase().startsWith('employeeid') || line.toLowerCase().startsWith('id')) continue;
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length >= 4) {
        logs.push({
          id: `csv_${i}`,
          employeeId: parts[0],
          employeeName: parts[1] || 'Employee',
          department: parts[2] || 'General',
          timestamp: parts[3] || new Date().toISOString(),
          type: parts[4] && parts[4].toUpperCase().includes('OUT') ? 'OUT' : 'IN',
          deviceSn: parts[5] || 'MANUAL-IMPORT',
        });
      }
    }
    return logs;
  }
}
