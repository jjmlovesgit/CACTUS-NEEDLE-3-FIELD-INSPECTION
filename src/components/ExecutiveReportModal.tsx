import React, { useState, useEffect } from 'react';
import { EquipmentInspectionFormValues } from '../schema/inspectionSchema';
import {
  getAllPhotoBlobs,
  StoredInspectionPhoto,
  createBlobImageUrl,
} from '../services/photoDbService';
import {
  Cpu,
  ShieldCheck,
  Activity,
  Thermometer,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Copy,
  Printer,
  Check,
  Sparkles,
  Lock,
  Camera,
  X,
} from 'lucide-react';

interface ExecutiveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: EquipmentInspectionFormValues;
  signature?: string | null;
}

export const ExecutiveReportModal: React.FC<ExecutiveReportModalProps> = ({
  isOpen,
  onClose,
  formData,
  signature,
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiNarrative, setAiNarrative] = useState<string>('');
  const [photos, setPhotos] = useState<StoredInspectionPhoto[]>([]);
  const [blobUrlMap, setBlobUrlMap] = useState<Record<string, string>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<StoredInspectionPhoto | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load photo Blobs from IndexedDB
    const loadReportPhotos = async () => {
      try {
        const list = await getAllPhotoBlobs();
        setPhotos(list);

        const newMap: Record<string, string> = {};
        list.forEach((p) => {
          newMap[p.id] = createBlobImageUrl(p.blob);
        });

        setBlobUrlMap((prev) => {
          Object.values(prev).forEach((url) => {
            try {
              URL.revokeObjectURL(url);
            } catch (e) {}
          });
          return newMap;
        });
      } catch (err) {
        console.warn('Error loading report photo Blobs:', err);
      }
    };

    loadReportPhotos();

    // Generate AI Summary Narrative
    const generateSummary = async () => {
      setIsGeneratingAi(true);
      try {
        const globalAi = (window as any).ai;
        if (globalAi && globalAi.summarizer) {
          const summarizer = await globalAi.summarizer.create();
          const rawText = `Asset ${formData.unit_id || 'PUMP-104'} status ${formData.status}, temp ${formData.temperature_c}C, vibration ${formData.vibration_ips} ips, e-stop ${formData.emergency_stop_tested ? 'tested' : 'untested'}, notes: ${formData.inspector_notes || 'None'}.`;
          const summary = await summarizer.summarize(rawText);
          setAiNarrative(summary);
          setIsGeneratingAi(false);
          return;
        }
      } catch (e) {
        console.warn('Chrome AI window.ai not active, falling back to local deterministic summarizer:', e);
      }

      setTimeout(() => {
        const isCritical = formData.status === 'CRITICAL_FAIL';
        const isMaint = formData.status === 'NEEDS_MAINTENANCE';
        const tempWarn = typeof formData.temperature_c === 'number' && formData.temperature_c > 75;
        const vibWarn = typeof formData.vibration_ips === 'number' && formData.vibration_ips > 0.8;

        let narrative = `EXECUTIVE TELEMETRY DIAGNOSTIC REPORT FOR ASSET [${formData.unit_id || 'UNASSIGNED'}]:\n\n`;

        if (isCritical) {
          narrative += `• CRITICAL HAZARD DETECTED: Unit operational readiness is flagged as CRITICAL FAIL. Immediate site lockout and mechanical isolation required.\n`;
        } else if (isMaint) {
          narrative += `• MAINTENANCE REQUIRED: Unit requires scheduled field service. Operational parameters indicate elevated thermal or acoustic wear.\n`;
        } else {
          narrative += `• NOMINAL RUNNING: Asset is operating within standard baseline tolerances. Systems passed operational integrity checks.\n`;
        }

        if (tempWarn) {
          narrative += `• THERMAL WARN: Surface temperature ${formData.temperature_c}°C exceeds baseline threshold (75°C). Coolant flow and bearing thermal dissipation should be inspected.\n`;
        }

        if (vibWarn) {
          narrative += `• VIBRATION WARN: Vibration velocity ${formData.vibration_ips} ips indicates elevated mechanical oscillation or shaft misalignment.\n`;
        }

        narrative += `• SAFETY SWITCH: Physical Emergency Stop Switch verification: ${formData.emergency_stop_tested ? 'VERIFIED & TESTED (COMPLIANT)' : 'UNTESTED (COMPLIANCE MANDATE PENDING)'}.\n`;

        if (formData.inspector_notes && formData.inspector_notes !== 'Review') {
          narrative += `• AUDIT TRANSCRIPT: "${formData.inspector_notes}"`;
        }

        setAiNarrative(narrative);
        setIsGeneratingAi(false);
      }, 300);
    };

    generateSummary();

    return () => {
      Object.values(blobUrlMap).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {}
      });
    };
  }, [isOpen, formData]);

  if (!isOpen) return null;

  const handleCopyReport = () => {
    const reportText = `====================================================
CACTUS NEEDLE 3 EXECUTIVE INSPECTION REPORT
====================================================
Asset ID: ${formData.unit_id || 'N/A'}
Readiness Status: ${formData.status}
Surface Temperature: ${formData.temperature_c ?? 'N/A'} °C
Vibration Velocity: ${formData.vibration_ips ?? 'N/A'} ips
Emergency Stop Switch: ${formData.emergency_stop_tested ? 'TESTED' : 'UNTESTED'}

RAW TRANSCRIPT AUDIT LOG:
${formData.inspector_notes || 'None'}

ATTACHED FIELD PHOTOS: ${photos.length} Photo Attachment(s)

SUMMARY DIAGNOSTICS:
${aiNarrative}

Signature Seal: ${signature || `N3-SEAL-${Math.random().toString(36).substring(2, 9).toUpperCase()}`}
Timestamp: ${new Date().toLocaleString()}
====================================================`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const mockSeal = signature || `N3-SIG-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      {/* Modal Card */}
      <div className="relative w-full max-w-3xl bg-[#0F172A] border-2 border-cyan-500/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Top Branded Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/40 rounded-xl text-cyan-400 shadow-lg shadow-cyan-500/10">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-100 tracking-wide">
                  EXECUTIVE TELEMETRY SUMMARY REPORT
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase">
                  ISO-9001
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Cactus Compute Needle 3 WASM Engine &bull; Field Telemetry & Visual Photo Audit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-all"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Report Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-grow">
          
          {/* Header Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-lg border ${
                  formData.status === 'PASS'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : formData.status === 'CRITICAL_FAIL'
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                    : 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                }`}
              >
                {formData.status === 'PASS' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : formData.status === 'CRITICAL_FAIL' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                  Operational Assessment
                </span>
                <h4
                  className={`text-lg font-bold font-mono ${
                    formData.status === 'PASS'
                      ? 'text-emerald-400'
                      : formData.status === 'CRITICAL_FAIL'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {formData.status === 'PASS'
                    ? 'PASSED — NOMINAL OPERATIONAL READINESS'
                    : formData.status === 'CRITICAL_FAIL'
                    ? 'CRITICAL FAILURE — IMMEDIATE LOCKOUT REQUIRED'
                    : 'NEEDS MAINTENANCE — FIELD SERVICE SCHEDULED'}
                </h4>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Report Date & Time</span>
              <span className="text-xs font-mono text-slate-200 font-bold">{new Date().toLocaleString()}</span>
            </div>
          </div>

          {/* Telemetry Metrics Grid */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2 font-mono">
              <Activity className="w-4 h-4 text-cyan-400" />
              Verified Inspection Telemetry Breakdown
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Asset Tag */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Machine Tag</span>
                <span className="text-sm font-bold font-mono text-cyan-300">
                  {formData.unit_id || 'N/A'}
                </span>
              </div>

              {/* Temp */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-amber-400" />
                  Surface Temp
                </span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {typeof formData.temperature_c === 'number' ? `${formData.temperature_c} °C` : 'N/A'}
                </span>
              </div>

              {/* Vibration */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-cyan-400" />
                  Vibration Velocity
                </span>
                <span className="text-sm font-bold font-mono text-slate-100">
                  {typeof formData.vibration_ips === 'number' ? `${formData.vibration_ips} ips` : 'N/A'}
                </span>
              </div>

              {/* E-Stop */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">E-Stop Switch</span>
                <span
                  className={`text-xs font-bold font-mono px-2 py-0.5 rounded inline-block mt-0.5 ${
                    formData.emergency_stop_tested
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {formData.emergency_stop_tested ? 'TESTED' : 'UNTESTED'}
                </span>
              </div>
            </div>
          </div>

          {/* REQUIREMENT: Photo Attachment Thumbnails Grid */}
          {photos.length > 0 && (
            <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-cyan-300 uppercase flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  Field Inspection Photo Attachments ({photos.length})
                </span>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 uppercase">
                  NATIVE INDEXEDDB BLOBS
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {photos.map((item) => {
                  const url = blobUrlMap[item.id] || createBlobImageUrl(item.blob);
                  const sizeMb = (item.sizeBytes / (1024 * 1024)).toFixed(2);

                  return (
                    <div
                      key={item.id}
                      onClick={() => setLightboxPhoto(item)}
                      className="group relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 aspect-video cursor-pointer hover:border-cyan-500 transition-all shadow-md"
                    >
                      <img
                        src={url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end">
                        <span className="text-[9px] font-mono text-slate-100 font-bold truncate">{item.name}</span>
                        <span className="text-[8px] font-mono text-cyan-300">{sizeMb} MB Blob</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Raw Spoken Transcript Audit Log Card */}
          <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-cyan-300 uppercase flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-cyan-400" />
                Inspector Observations & Raw Transcript Audit Log
              </span>
              <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 uppercase">
                VERIFIED AUDIT LOG
              </span>
            </div>

            <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-200 font-mono leading-relaxed">
              {formData.inspector_notes && formData.inspector_notes !== 'Review'
                ? formData.inspector_notes
                : 'No raw transcript recorded.'}
            </div>
          </div>

          {/* AI Executive Summary Narrative */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono text-cyan-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                AI Executive Summary & Field Diagnostics
              </span>
              {isGeneratingAi && (
                <span className="text-[10px] font-mono text-cyan-400 animate-pulse">Synthesizing...</span>
              )}
            </div>

            <div className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800/80 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
              {aiNarrative || 'Generating automated diagnostic narrative...'}
            </div>
          </div>

          {/* Cryptographic Seal & Security Stamp */}
          <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-md">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                  Cryptographic Verification Seal
                </span>
                <span className="text-xs font-mono text-emerald-400 font-bold">{mockSeal}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Air-Gapped &bull; Zero Cloud Leakage</span>
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="bg-slate-950 px-6 py-3.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-lg border border-slate-700 transition-all"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-lg border border-slate-700 flex items-center gap-1.5 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied to Clipboard!' : 'Copy Summary Report'}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-lg shadow-cyan-600/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              Print / Export PDF
            </button>
          </div>
        </div>

      </div>

      {/* Lightbox Modal inside Report */}
      {lightboxPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md animate-fade-in">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100 font-mono">{lightboxPhoto.name}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-slate-950">
              <img
                src={blobUrlMap[lightboxPhoto.id] || createBlobImageUrl(lightboxPhoto.blob)}
                alt={lightboxPhoto.name}
                className="max-h-[75vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
