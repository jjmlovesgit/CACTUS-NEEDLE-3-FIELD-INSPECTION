import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  EquipmentInspectionSchema,
  EquipmentInspectionFormValues,
} from '../schema/inspectionSchema';
import { PhotoUploadManager } from './PhotoUploadManager';
import { AssetLookupModal } from './AssetLookupModal';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Thermometer,
  Gauge,
  CheckSquare,
  Square,
  FileText,
  Send,
  RotateCcw,
  Layers,
  Sparkles,
  History,
} from 'lucide-react';

interface InspectionFormProps {
  extractedArguments?: Record<string, any> | null;
  resetKey?: number;
  onSubmitSuccess: (data: EquipmentInspectionFormValues) => void;
  onOpenExecutiveReport?: (currentData: EquipmentInspectionFormValues) => void;
}

export const InspectionForm: React.FC<InspectionFormProps> = ({
  extractedArguments,
  resetKey,
  onSubmitSuccess,
  onOpenExecutiveReport,
}) => {
  // Initial default: review required for blank form
  const [reviewFields, setReviewFields] = useState<Record<string, boolean>>({
    unit_id: true,
    temperature_c: true,
    vibration_ips: true,
    inspector_notes: true,
    emergency_stop_tested: true,
  });

  const [safetyWarningAlert, setSafetyWarningAlert] = useState<boolean>(false);
  const [mergeMode, setMergeMode] = useState<boolean>(true); // Persistent incremental STT updates enabled
  const [isAssetLookupOpen, setIsAssetLookupOpen] = useState<boolean>(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EquipmentInspectionFormValues>({
    resolver: zodResolver(EquipmentInspectionSchema),
    defaultValues: {
      unit_id: 'Review',
      status: 'PASS',
      temperature_c: '' as any,
      vibration_ips: '' as any,
      emergency_stop_tested: false, // Deselected by default
      inspector_notes: 'Review',
    },
  });

  const currentStatus = watch('status');
  const emergencyStopTested = watch('emergency_stop_tested');
  const watchUnitId = watch('unit_id');
  const watchTemp = watch('temperature_c');
  const watchVib = watch('vibration_ips');
  const watchNotes = watch('inspector_notes');

  const hasValidAssetId = Boolean(
    watchUnitId &&
    watchUnitId.trim().length > 0 &&
    watchUnitId.toLowerCase() !== 'update' &&
    watchUnitId.toLowerCase() !== 'review' &&
    watchUnitId.trim().length > 1
  );

  const isReviewActive = Object.keys(reviewFields).length > 0;

  // Clear safety warning when emergency stop switch is toggled to true
  useEffect(() => {
    if (emergencyStopTested) {
      setSafetyWarningAlert(false);
      setReviewFields((prev) => {
        const copy = { ...prev };
        delete copy.emergency_stop_tested;
        return copy;
      });
    }
  }, [emergencyStopTested]);

  // Clear specific review flag when user interacts with field
  useEffect(() => {
    if (watchUnitId && watchUnitId !== 'Review' && watchUnitId.trim().length > 1 && reviewFields.unit_id) {
      setReviewFields((prev) => {
        const copy = { ...prev };
        delete copy.unit_id;
        return copy;
      });
    }
  }, [watchUnitId, reviewFields.unit_id]);

  useEffect(() => {
    if (typeof watchTemp === 'number' && !isNaN(watchTemp) && reviewFields.temperature_c) {
      setReviewFields((prev) => {
        const copy = { ...prev };
        delete copy.temperature_c;
        return copy;
      });
    }
  }, [watchTemp, reviewFields.temperature_c]);

  useEffect(() => {
    if (typeof watchVib === 'number' && !isNaN(watchVib) && reviewFields.vibration_ips) {
      setReviewFields((prev) => {
        const copy = { ...prev };
        delete copy.vibration_ips;
        return copy;
      });
    }
  }, [watchVib, reviewFields.vibration_ips]);

  useEffect(() => {
    if (watchNotes && watchNotes !== 'Review' && reviewFields.inspector_notes) {
      setReviewFields((prev) => {
        const copy = { ...prev };
        delete copy.inspector_notes;
        return copy;
      });
    }
  }, [watchNotes, reviewFields.inspector_notes]);

  // Always reset form and wipe previous values whenever resetKey is triggered
  useEffect(() => {
    if (resetKey !== undefined && resetKey > 0) {
      setSafetyWarningAlert(false);
      setReviewFields({
        unit_id: true,
        temperature_c: true,
        vibration_ips: true,
        inspector_notes: true,
        emergency_stop_tested: true,
      });
      reset({
        unit_id: 'Review',
        status: 'PASS',
        temperature_c: '' as any,
        vibration_ips: '' as any,
        emergency_stop_tested: false,
        inspector_notes: 'Review',
      });
    }
  }, [resetKey, reset]);

  // Incremental auto-population & field merging when new WASM parameters arrive
  useEffect(() => {
    if (!extractedArguments || Object.keys(extractedArguments).length === 0) return;

    const currentValues = getValues();
    const newFieldsToReview: Record<string, boolean> = { ...reviewFields };

    // 1. Asset ID (unit_id)
    let finalUnitId = currentValues.unit_id;
    if (extractedArguments.unit_id !== undefined && extractedArguments.unit_id !== null) {
      const raw = String(extractedArguments.unit_id).trim();
      if (raw && raw.length > 1 && raw.toLowerCase() !== 'update' && raw.toLowerCase() !== 'null' && raw.toLowerCase() !== 'review') {
        finalUnitId = raw;
        delete newFieldsToReview.unit_id;
      }
    }
    if (!finalUnitId || finalUnitId === 'Review') {
      finalUnitId = 'Review';
      newFieldsToReview.unit_id = true;
    } else {
      delete newFieldsToReview.unit_id;
    }

    // 2. Status
    let finalStatus = currentValues.status;
    if (extractedArguments.status && ['PASS', 'NEEDS_MAINTENANCE', 'CRITICAL_FAIL'].includes(extractedArguments.status)) {
      finalStatus = extractedArguments.status;
      delete newFieldsToReview.status;
    }

    // 3. Surface Temperature (°C)
    let finalTemp = currentValues.temperature_c;
    if (typeof extractedArguments.temperature_c === 'number' && !isNaN(extractedArguments.temperature_c)) {
      finalTemp = extractedArguments.temperature_c;
      delete newFieldsToReview.temperature_c;
    } else if (typeof finalTemp === 'number' && !isNaN(finalTemp)) {
      delete newFieldsToReview.temperature_c;
    } else {
      newFieldsToReview.temperature_c = true;
    }

    // 4. Vibration Velocity (ips)
    let finalVib = currentValues.vibration_ips;
    if (typeof extractedArguments.vibration_ips === 'number' && !isNaN(extractedArguments.vibration_ips)) {
      finalVib = extractedArguments.vibration_ips;
      delete newFieldsToReview.vibration_ips;
    } else if (typeof finalVib === 'number' && !isNaN(finalVib)) {
      delete newFieldsToReview.vibration_ips;
    } else {
      newFieldsToReview.vibration_ips = true;
    }

    // 5. Emergency Stop Switch
    let finalEstop = currentValues.emergency_stop_tested;
    if (typeof extractedArguments.emergency_stop_tested === 'boolean') {
      finalEstop = extractedArguments.emergency_stop_tested;
      if (finalEstop) delete newFieldsToReview.emergency_stop_tested;
      else newFieldsToReview.emergency_stop_tested = true;
    }

    // 6. Inspector Observations & Notes (Raw Transcript Retained for Audit)
    let finalNotes = currentValues.inspector_notes;
    if (extractedArguments.inspector_notes !== undefined && extractedArguments.inspector_notes !== null) {
      const notesStr = String(extractedArguments.inspector_notes).trim();
      if (notesStr && notesStr.toLowerCase() !== 'null' && notesStr.toLowerCase() !== 'review') {
        if (!finalNotes || finalNotes === 'Review') {
          finalNotes = notesStr;
        } else if (!finalNotes.includes(notesStr)) {
          finalNotes = `${finalNotes} | ${notesStr}`;
        }
        delete newFieldsToReview.inspector_notes;
      }
    }
    if (!finalNotes || finalNotes === 'Review') {
      finalNotes = 'Review';
      newFieldsToReview.inspector_notes = true;
    } else {
      delete newFieldsToReview.inspector_notes;
    }

    setReviewFields(newFieldsToReview);

    // Atomically merge and reset form values
    reset({
      unit_id: finalUnitId,
      status: finalStatus,
      temperature_c: finalTemp,
      vibration_ips: finalVib,
      emergency_stop_tested: finalEstop,
      inspector_notes: finalNotes,
    });
  }, [extractedArguments, getValues, reset]);

  const onFormSubmit = (data: EquipmentInspectionFormValues) => {
    // Mandate physical Emergency Stop Switch testing before sign-off
    if (!data.emergency_stop_tested) {
      setSafetyWarningAlert(true);
      return;
    }
    setSafetyWarningAlert(false);
    onSubmitSuccess(data);
  };

  const handleManualClear = () => {
    setSafetyWarningAlert(false);
    setReviewFields({
      unit_id: true,
      temperature_c: true,
      vibration_ips: true,
      inspector_notes: true,
      emergency_stop_tested: true,
    });
    reset({
      unit_id: 'Review',
      status: 'PASS',
      temperature_c: '' as any,
      vibration_ips: '' as any,
      emergency_stop_tested: false,
      inspector_notes: 'Review',
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Equipment Inspection Telemetry
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Default values set to 'Review'. Mandated E-Stop verification required for sign-off.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Executive Report Modal Trigger Button */}
            {onOpenExecutiveReport && (
              <button
                type="button"
                onClick={() => onOpenExecutiveReport(getValues())}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 flex items-center gap-1.5 shadow-lg shadow-cyan-500/10 transition-all"
                title="View Branded Executive Telemetry Report & AI Summary"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Executive Report
              </button>
            )}

            {/* Persistent Merge Mode Toggle */}
            <button
              type="button"
              onClick={() => setMergeMode(!mergeMode)}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                mergeMode
                  ? 'bg-slate-900 text-slate-300 border-slate-700'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
              title={mergeMode ? 'Persistent Field Merge Active' : 'Overwrite Mode Active'}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              {mergeMode ? 'Merge ON' : 'Merge OFF'}
            </button>

            {/* Clear Form Button */}
            <button
              type="button"
              onClick={handleManualClear}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-all"
              title="Clear all form fields to Review defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear Form
            </button>
          </div>
        </div>

        {/* REQUIREMENT: Red Critical Safety Violation Alert */}
        {safetyWarningAlert && (
          <div className="p-4 bg-rose-950/70 border-2 border-rose-500 rounded-xl text-rose-200 text-xs space-y-2.5 shadow-2xl animate-bounce-short">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-rose-300 font-mono text-xs uppercase tracking-wider">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
                CRITICAL SAFETY COMPLIANCE VIOLATION — E-STOP TEST REQUIRED
              </span>
              <button
                type="button"
                onClick={() => setSafetyWarningAlert(false)}
                className="text-rose-400 hover:text-rose-100 p-1 text-xs font-bold"
                aria-label="Dismiss safety alert"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-200 text-xs leading-relaxed font-sans">
              Physical Emergency Stop Switch verification is <strong className="text-rose-400 underline uppercase tracking-wider">mandatory</strong> for safety compliance before sign-off. Please test the switch and toggle to <strong className="text-emerald-300">TESTED</strong>.
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setValue('emergency_stop_tested', true, { shouldValidate: true });
                  setSafetyWarningAlert(false);
                }}
                className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
              >
                <CheckSquare className="w-4 h-4" />
                Mark Physical E-Stop Switch as TESTED Now
              </button>
            </div>
          </div>
        )}

        {/* REQUIREMENT: Screen Pop Alert for Review Needed */}
        {isReviewActive && !safetyWarningAlert && (
          <div className="p-4 bg-amber-950/50 border-2 border-amber-500/80 rounded-xl text-amber-200 text-xs space-y-2.5 shadow-2xl transition-all">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2 text-amber-300 font-mono text-xs uppercase tracking-wider">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-400 shrink-0 animate-pulse" />
                TELEMETRY REVIEW NEEDED — {Object.keys(reviewFields).length} FIELD(S) MARKED FOR REVIEW
              </span>
              <button
                type="button"
                onClick={() => setReviewFields({})}
                className="text-amber-400 hover:text-amber-100 p-1 text-xs font-bold"
                aria-label="Dismiss review alert"
              >
                ✕
              </button>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Dictate missing updates or inspect and correct fields marked <span className="text-amber-400 font-mono font-bold px-1 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded">"Review"</span> before sign-off.
            </p>

            {reviewFields.unit_id && (
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-500/20">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Quick Select Asset Tag:</span>
                {['PUMP-104', 'GEN-12', 'COMP-01', 'TURB-05', 'HEAT-22'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setValue('unit_id', tag, { shouldValidate: true, shouldDirty: true });
                      setReviewFields((prev) => {
                        const copy = { ...prev };
                        delete copy.unit_id;
                        return copy;
                      });
                    }}
                    className="px-2.5 py-1 rounded bg-slate-950 hover:bg-cyan-950 text-cyan-300 border border-slate-700 hover:border-cyan-500 text-xs font-mono font-bold transition-all shadow"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Unit ID Input Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>Asset ID / Machine Tag <span className="text-rose-500">*</span></span>
                <button
                  type="button"
                  onClick={() => setIsAssetLookupOpen(true)}
                  className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition-all"
                  title="Lookup past inspection telemetry records for this Asset Tag"
                >
                  <History className="w-3 h-3 text-cyan-400" />
                  View Past Logs
                </button>
              </span>
              {reviewFields.unit_id && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-mono font-bold animate-pulse">
                  REVIEW REQUIRED
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. PUMP-104 or GEN-12"
                {...register('unit_id')}
                className={`w-full bg-slate-900/90 border ${
                  reviewFields.unit_id
                    ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-950/20 text-amber-200 font-mono font-bold'
                    : errors.unit_id
                    ? 'border-rose-500/80 focus:ring-rose-500'
                    : 'border-slate-700/80 focus:border-cyan-500'
                } rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-all`}
              />
            </div>
            {errors.unit_id && (
              <p className="text-xs text-rose-400 font-medium">{errors.unit_id.message}</p>
            )}
          </div>

          {/* Operational Status */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>Operational Readiness <span className="text-rose-500">*</span></span>
              {reviewFields.status && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-mono font-bold animate-pulse">
                  REVIEW REQUIRED
                </span>
              )}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setValue('status', 'PASS', { shouldValidate: true });
                  setReviewFields((prev) => {
                    const copy = { ...prev };
                    delete copy.status;
                    return copy;
                  });
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                  currentStatus === 'PASS'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                PASS
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('status', 'NEEDS_MAINTENANCE', { shouldValidate: true });
                  setReviewFields((prev) => {
                    const copy = { ...prev };
                    delete copy.status;
                    return copy;
                  });
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                  currentStatus === 'NEEDS_MAINTENANCE'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                MAINT.
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue('status', 'CRITICAL_FAIL', { shouldValidate: true });
                  setReviewFields((prev) => {
                    const copy = { ...prev };
                    delete copy.status;
                    return copy;
                  });
                }}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                  currentStatus === 'CRITICAL_FAIL'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-lg shadow-rose-500/10'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                FAIL
              </button>
            </div>
            {errors.status && (
              <p className="text-xs text-rose-400 font-medium">{errors.status.message}</p>
            )}
          </div>

          {/* Temperature (°C) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                Surface Temp (°C)
              </span>
              {reviewFields.temperature_c ? (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-mono font-bold animate-pulse">
                  REVIEW REQUIRED
                </span>
              ) : (
                <span className="text-slate-500 text-[10px] lowercase">-40 to 250 °C</span>
              )}
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 78.5"
              {...register('temperature_c', { valueAsNumber: true })}
              className={`w-full bg-slate-900/90 border ${
                reviewFields.temperature_c
                  ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-950/20'
                  : errors.temperature_c
                  ? 'border-rose-500/80'
                  : 'border-slate-700/80 focus:border-cyan-500'
              } rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-all`}
            />
            {errors.temperature_c && (
              <p className="text-xs text-rose-400 font-medium">{errors.temperature_c.message}</p>
            )}
          </div>

          {/* Vibration (ips) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                Vibration Velocity (ips)
              </span>
              {reviewFields.vibration_ips ? (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-mono font-bold animate-pulse">
                  REVIEW REQUIRED
                </span>
              ) : (
                <span className="text-slate-500 text-[10px] lowercase">0.0 to 5.0 ips</span>
              )}
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 0.35"
              {...register('vibration_ips', { valueAsNumber: true })}
              className={`w-full bg-slate-900/90 border ${
                reviewFields.vibration_ips
                  ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-950/20'
                  : errors.vibration_ips
                  ? 'border-rose-500/80'
                  : 'border-slate-700/80 focus:border-cyan-500'
              } rounded-lg px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 transition-all`}
            />
            {errors.vibration_ips && (
              <p className="text-xs text-rose-400 font-medium">{errors.vibration_ips.message}</p>
            )}
          </div>
        </div>

        {/* Emergency Stop Toggle (Deselected by default) */}
        <div className={`p-3.5 bg-slate-900/60 border rounded-lg flex items-center justify-between transition-all ${
          safetyWarningAlert
            ? 'border-rose-500 ring-4 ring-rose-500/40 bg-rose-950/30 text-rose-200 animate-pulse'
            : reviewFields.emergency_stop_tested
            ? 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-950/20'
            : 'border-slate-800/80'
        }`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const nextVal = !emergencyStopTested;
                setValue('emergency_stop_tested', nextVal, { shouldValidate: true });
                if (nextVal) {
                  setSafetyWarningAlert(false);
                  setReviewFields((prev) => {
                    const copy = { ...prev };
                    delete copy.emergency_stop_tested;
                    return copy;
                  });
                }
              }}
              className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${
                emergencyStopTested
                  ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                  : 'border-slate-700 bg-slate-950 text-transparent'
              }`}
            >
              {emergencyStopTested ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-2">
                <label
                  onClick={() => {
                    const nextVal = !emergencyStopTested;
                    setValue('emergency_stop_tested', nextVal, { shouldValidate: true });
                    if (nextVal) {
                      setSafetyWarningAlert(false);
                      setReviewFields((prev) => {
                        const copy = { ...prev };
                        delete copy.emergency_stop_tested;
                        return copy;
                      });
                    }
                  }}
                  className="text-sm font-medium text-slate-200 cursor-pointer select-none"
                >
                  Physical Emergency Stop Switch Tested
                </label>
                {safetyWarningAlert ? (
                  <span className="px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-500/60 text-[10px] font-mono font-bold animate-pulse">
                    E-STOP TEST REQUIRED
                  </span>
                ) : reviewFields.emergency_stop_tested ? (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-mono font-bold animate-pulse">
                    REVIEW REQUIRED
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                Required for safety compliance verification before sign-off. Must be toggled to TESTED.
              </p>
            </div>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded font-semibold tracking-wide ${
              emergencyStopTested ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {emergencyStopTested ? 'TESTED' : 'UNTESTED'}
          </span>
        </div>

        {/* Inspector Observations & Raw Transcript Audit Log */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              Inspector Observations & Raw Transcript Audit Trail
            </span>
            {reviewFields.inspector_notes && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] font-mono font-bold animate-pulse">
                REVIEW REQUIRED
              </span>
            )}
          </label>
          <textarea
            rows={3}
            placeholder="Spoken raw transcript audit trail will be retained here..."
            {...register('inspector_notes')}
            className={`w-full bg-slate-900/90 border ${
              reviewFields.inspector_notes
                ? 'border-amber-500 ring-2 ring-amber-500/40 bg-amber-950/20 text-amber-200 font-mono'
                : 'border-slate-700/80 focus:border-cyan-500 font-mono text-slate-200'
            } rounded-lg p-3 text-sm transition-all`}
          />
          {errors.inspector_notes && (
            <p className="text-xs text-rose-400 font-medium">{errors.inspector_notes.message}</p>
          )}
        </div>

        {/* Field Inspection Photo Attachments (Native IndexedDB Blob Storage) */}
        <PhotoUploadManager inspectionId={watchUnitId} />

        {/* Form Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full font-bold py-3.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-xl transition-all disabled:opacity-50 ${
              safetyWarningAlert
                ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-slate-950 shadow-rose-600/30 ring-2 ring-rose-500'
                : hasValidAssetId && !isReviewActive && emergencyStopTested
                ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 shadow-emerald-500/25 ring-2 ring-emerald-400/40'
                : 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 shadow-amber-500/25 ring-2 ring-amber-400/40'
            }`}
          >
            {safetyWarningAlert ? (
              <>
                <ShieldAlert className="w-4 h-4 text-slate-950 animate-pulse" />
                Sign & Submit Blocked — E-Stop Switch Test Required (Click to Fix)
              </>
            ) : hasValidAssetId && !isReviewActive && emergencyStopTested ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                Sign & Submit Inspection Payload (Telemetry Verified)
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 text-slate-950 animate-pulse" />
                Sign & Submit Inspection Payload ({!emergencyStopTested ? 'E-Stop Test Required' : isReviewActive ? 'Review Needed' : 'Asset ID Required'})
              </>
            )}
          </button>
        </div>
      </form>

      {/* Asset Inspection History Lookup Modal */}
      <AssetLookupModal
        isOpen={isAssetLookupOpen}
        onClose={() => setIsAssetLookupOpen(false)}
        initialAssetId={watchUnitId && watchUnitId !== 'Review' ? watchUnitId : 'PUMP-104'}
      />
    </>
  );
};
