import React, { useState, useEffect } from 'react';
import {
  StoredInspectionRecord,
  getAllInspectionRecords,
  markRecordsAsSynced,
  clearAllRecords,
} from '../services/dbService';
import {
  Wifi,
  WifiOff,
  CloudUpload,
  Database,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  Trash2,
} from 'lucide-react';

interface OfflineSyncPanelProps {
  onRecordsUpdated?: () => void;
  lastSubmittedRecord?: StoredInspectionRecord | null;
}

export const OfflineSyncPanel: React.FC<OfflineSyncPanelProps> = ({
  onRecordsUpdated,
  lastSubmittedRecord,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [allRecords, setAllRecords] = useState<StoredInspectionRecord[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  // Monitor network online/offline status via native browser event
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch records from IndexedDB
  const refreshRecords = async () => {
    try {
      const records = await getAllInspectionRecords();
      setAllRecords(records);
      const pending = records.filter((r) => !r.synced).length;
      setPendingCount(pending);
      if (onRecordsUpdated) onRecordsUpdated();
    } catch (err) {
      console.warn('Error fetching IndexedDB records:', err);
    }
  };

  // Sync refresh on submission and once every 60 seconds (1 minute)
  useEffect(() => {
    refreshRecords();
    const interval = setInterval(() => {
      refreshRecords();
    }, 60000); // 60,000 ms (1 minute polling interval)

    return () => clearInterval(interval);
  }, [lastSubmittedRecord]);

  // Sync pending field records when back in range
  const handleSyncPending = async () => {
    const pending = allRecords.filter((r) => !r.synced);
    if (pending.length === 0) return;

    setIsSyncing(true);
    setSyncSuccessMsg(null);

    try {
      // Simulate remote API / RxDB replication push
      await new Promise((res) => setTimeout(res, 1200));

      const pendingIds = pending.map((r) => r.id);
      await markRecordsAsSynced(pendingIds);

      setSyncSuccessMsg(`Successfully synced ${pending.length} field inspection payload(s) to Central Server!`);
      await refreshRecords();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearDb = async () => {
    if (window.confirm('Are you sure you want to clear all local IndexedDB inspection logs?')) {
      await clearAllRecords();
      await refreshRecords();
    }
  };

  return (
    <div className="bg-slate-950/90 border-2 border-cyan-500/50 rounded-xl overflow-hidden shadow-2xl">
      {/* Header Summary Banner */}
      <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center gap-3">
          {/* Network Status Badge */}
          <div
            className={`p-2.5 rounded-xl border flex items-center justify-center ${
              isOnline
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400 animate-pulse'
            }`}
          >
            {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 font-mono">
                IndexedDB Field Storage & Remote Sync
              </h3>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                  isOnline
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                }`}
              >
                {isOnline ? 'Network In-Range' : 'Offline Field Mode'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Offline-first field entries saved locally in IndexedDB &bull; 1-min sync check & 1-click push.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Unsynced Pending Count Badge */}
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 text-xs font-mono font-bold animate-pulse">
              ⚡ {pendingCount} Pending Offline Record(s)
            </span>
          )}

          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSyncPending}
            disabled={pendingCount === 0 || isSyncing}
            className={`px-3.5 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-lg transition-all disabled:opacity-40 ${
              pendingCount > 0
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20 ring-2 ring-cyan-400/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                Syncing to Central Server...
              </>
            ) : (
              <>
                <CloudUpload className="w-4 h-4" />
                Sync Pending Field Entries ({pendingCount})
              </>
            )}
          </button>

          {/* Toggle Expand Drawer */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg transition-all"
            title="Toggle IndexedDB records table"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Sync Success Message Notice */}
      {syncSuccessMsg && (
        <div className="p-3 bg-emerald-950/60 border-b border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between font-mono">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {syncSuccessMsg}
          </span>
          <button
            type="button"
            onClick={() => setSyncSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-100 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Expanded Table Drawer of IndexedDB Local Records */}
      {isExpanded && (
        <div className="p-4 space-y-3 bg-slate-950/50">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300 font-sans font-semibold">
              <Database className="w-4 h-4 text-cyan-400" />
              IndexedDB Local Storage Log ({allRecords.length} Total Entries Saved)
            </span>

            {allRecords.length > 0 && (
              <button
                type="button"
                onClick={handleClearDb}
                className="text-rose-400 hover:text-rose-200 text-xs font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Local DB Logs
              </button>
            )}
          </div>

          {allRecords.length === 0 ? (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-900/80 rounded border border-slate-800">
              No field entries saved in local IndexedDB storage yet. Click <strong className="text-emerald-400 font-mono">Sign & Submit Inspection Payload</strong> on the form below to save a signed record into IndexedDB and test offline sync.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-60 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] sticky top-0">
                  <tr>
                    <th className="p-2.5">Asset ID</th>
                    <th className="p-2.5">Readiness</th>
                    <th className="p-2.5">Temp</th>
                    <th className="p-2.5">Vib</th>
                    <th className="p-2.5">Sync Status</th>
                    <th className="p-2.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {allRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="p-2.5 font-bold text-cyan-300">{r.payload.unit_id || 'N/A'}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.payload.status === 'PASS'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : r.payload.status === 'CRITICAL_FAIL'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {r.payload.status}
                        </span>
                      </td>
                      <td className="p-2.5">{r.payload.temperature_c ?? '-'} °C</td>
                      <td className="p-2.5">{r.payload.vibration_ips ?? '-'} ips</td>
                      <td className="p-2.5">
                        {r.synced ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-[10px] font-bold">
                            <Check className="w-3 h-3" /> SYNCED
                          </span>
                        ) : (
                          <span className="text-amber-400 flex items-center gap-1 text-[10px] font-bold">
                            <Clock className="w-3 h-3 animate-pulse" /> PENDING (FIELD)
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-400 text-[11px]">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
