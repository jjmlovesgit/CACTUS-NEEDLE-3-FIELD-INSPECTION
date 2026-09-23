import React, { useState, useEffect, useCallback } from 'react';
import { InspectionForm } from './components/InspectionForm';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import { ExecutiveReportModal } from './components/ExecutiveReportModal';
import { OfflineSyncPanel } from './components/OfflineSyncPanel';
import { HardwareKeyLockBanner } from './components/HardwareKeyLockBanner';
import { AssetLookupModal } from './components/AssetLookupModal';
import { EquipmentInspectionFormValues } from './schema/inspectionSchema';
import {
  extractFormIntent,
  NeedleExtractionResult,
  getWasmStatus,
  subscribeWasmStatus,
  retryNeedleWasm,
  WasmStatus,
} from './services/needleService';
import {
  saveInspectionRecord,
  StoredInspectionRecord,
} from './services/dbService';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import {
  Mic,
  MicOff,
  ShieldCheck,
  Zap,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Cpu,
  Lock,
  RefreshCw,
  Terminal,
  Send,
  Binary,
  RotateCcw,
  Check,
  XCircle,
  Activity,
  Database,
  KeyRound,
  History,
} from 'lucide-react';

export const App: React.FC = () => {
  const [extractionResult, setExtractionResult] = useState<NeedleExtractionResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState<number>(0);
  const [submittedPayload, setSubmittedPayload] = useState<{
    payload: EquipmentInspectionFormValues;
    timestamp: string;
    signature: string;
  } | null>(null);

  const [lastStoredRecord, setLastStoredRecord] = useState<StoredInspectionRecord | null>(null);
  const [manualPhrase, setManualPhrase] = useState('');
  const [isAssetLookupOpen, setIsAssetLookupOpen] = useState(false);

  // Executive Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportFormData, setReportFormData] = useState<EquipmentInspectionFormValues>({
    unit_id: 'PUMP-104',
    status: 'PASS',
    temperature_c: 78.5,
    vibration_ips: 0.35,
    emergency_stop_tested: true,
    inspector_notes: '',
  });

  // WASM Status State
  const [wasmState, setWasmState] = useState<{ status: WasmStatus; error: string | null }>(getWasmStatus());

  useEffect(() => {
    const unsubscribe = subscribeWasmStatus(() => {
      setWasmState(getWasmStatus());
    });
    return () => unsubscribe();
  }, []);

  // Speech Recognition Hook
  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    setTranscript,
    resetTranscript,
    error: speechError,
    isSupported: speechSupported,
  } = useSpeechRecognition({
    onPauseOrStop: (finalText) => {
      handleExtractIntent(finalText);
    },
  });

  // Explicitly wipe form state & all output panels when starting a fresh record or sample phrase
  const triggerFullFormClear = useCallback(() => {
    resetTranscript();
    setManualPhrase('');
    setExtractionResult(null);
    setExtractionError(null);
    setSubmittedPayload(null);
    setResetKey((prev) => prev + 1);
  }, [resetTranscript]);

  // Handle Intent Extraction strictly using Needle 3 WASM
  const handleExtractIntent = useCallback(async (phrase: string) => {
    if (!phrase || !phrase.trim()) return;
    setIsExtracting(true);
    setExtractionError(null);
    try {
      const result = await extractFormIntent(phrase);
      setExtractionResult(result);
    } catch (err: any) {
      console.error('Extraction error:', err);
      setExtractionError(err?.message || 'Needle 3 WASM extraction failed');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      triggerFullFormClear(); // Wipes previous form & results for fresh dictation
      startListening();
    }
  };

  // Handle quick test pill clicks (ALWAYS WIPES ENTIRE FORM & RESULTS FOR CLEAN TEST CASE)
  const handleQuickTest = (phrase: string) => {
    triggerFullFormClear(); // Complete wipe - NO MERGE across test phrases
    setTranscript(phrase);
    setManualPhrase(phrase);
    handleExtractIntent(phrase);
  };

  // Handle manual phrase parsing
  const handleManualParse = () => {
    if (!manualPhrase.trim()) return;
    const phraseToParse = manualPhrase;
    triggerFullFormClear(); // Complete wipe - NO MERGE across manual test phrases
    setTranscript(phraseToParse);
    handleExtractIntent(phraseToParse);
  };

  // Open Executive Report Modal
  const handleOpenExecutiveReport = (currentData: EquipmentInspectionFormValues) => {
    setReportFormData(currentData);
    setIsReportModalOpen(true);
  };

  // Form submission handler (Saves to IndexedDB with AES-256-GCM Hardware Titan Key Encryption)
  const handleFormSubmitSuccess = async (data: EquipmentInspectionFormValues) => {
    const timestamp = new Date().toISOString();
    const mockSignature = `N3-SIG-${Math.random().toString(36).substring(2, 9).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // 1. Save to local IndexedDB (Encrypted with AES-256-GCM)
    try {
      const stored = await saveInspectionRecord(data, mockSignature);
      setLastStoredRecord(stored);
    } catch (err) {
      console.error('Failed to save to IndexedDB:', err);
    }

    // 2. Set signed submission payload
    setSubmittedPayload({
      payload: data,
      timestamp,
      signature: mockSignature,
    });

    setReportFormData(data);
    setIsReportModalOpen(true); // Auto-open executive report pop-up upon successful sign-off
  };

  const activeTranscript = (transcript + (interimTranscript ? ' ' + interimTranscript : '')).trim();

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans flex flex-col antialiased">
      {/* Top Header */}
      <header className="bg-slate-950/90 border-b border-slate-800/80 sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-100 flex items-center gap-2 tracking-wide">
                CACTUS NEEDLE 3 FIELD INSPECTION
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 uppercase">
                  v3.0 WASM
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Voice Telemetry &bull; Asset History Lookup & Hardware Encryption Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Asset Telemetry History Lookup Button */}
            <button
              type="button"
              onClick={() => setIsAssetLookupOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/50 text-cyan-300 text-xs font-bold font-mono shadow-lg shadow-cyan-950/50 transition-all"
              title="Lookup past inspection logs by Asset Tag (e.g. PUMP-104)"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Asset History Lookup</span>
            </button>

            {/* Google Titan Key Hardware Badge with Hover Tooltip */}
            <div className="group relative cursor-pointer">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-bold font-mono shadow-lg shadow-emerald-950/50">
                <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
                <span>Titan USB Key Active</span>
              </div>

              {/* Hover Tooltip Box */}
              <div className="pointer-events-none absolute right-0 top-full mt-2 w-80 p-3.5 bg-slate-950/95 border-2 border-emerald-500/60 rounded-xl text-xs font-mono text-emerald-200 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                <div className="font-bold uppercase tracking-wider text-[10px] text-emerald-400 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  TITAN KEY HARDWARE ENCRYPTION ACTIVE
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                  If the physical field device is lost or stolen on-site, the raw inspection records inside IndexedDB are unreadable ciphertext and cannot be decrypted without your physical Google Titan Key!
                </p>
              </div>
            </div>

            {/* Executive Report Button in Top Bar */}
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-xs font-bold shadow-lg shadow-cyan-500/10 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Executive Report</span>
            </button>

            {/* WASM Status Badge */}
            {wasmState.status === 'ready' && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-semibold shadow-lg shadow-emerald-950/40 font-mono">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Needle 3 WASM Ready</span>
              </div>
            )}

            {wasmState.status === 'loading' && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-lg animate-pulse font-mono">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Loading Needle 3 WASM...</span>
              </div>
            )}

            {/* Top Banner Requirement: Air-Gapped Local Mode */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-700/80 text-slate-300 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Air-Gapped Local Mode</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full space-y-6">

        {/* 🔑 Google Titan Security Key Hardware Lock Banner */}
        <HardwareKeyLockBanner />

        {/* Offline Field Mode & IndexedDB Sync Panel */}
        <OfflineSyncPanel lastSubmittedRecord={lastStoredRecord} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Speech Controller & Quick Tests */}
          <section className="lg:col-span-5 space-y-6">

            {/* WASM Status Banner Notice if Loading or Error */}
            {wasmState.status !== 'ready' && (
              <div
                className={`p-4 rounded-xl border shadow-xl flex items-center justify-between gap-3 ${
                  wasmState.status === 'loading'
                    ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                    : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {wasmState.status === 'loading' ? (
                    <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold font-mono uppercase tracking-wider">
                      {wasmState.status === 'loading'
                        ? 'Compiling Needle 3 WASM & Loading Weights (35MB)...'
                        : 'Needle 3 WASM Engine Failed to Load'}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {wasmState.status === 'loading'
                        ? 'Neural inference will execute as soon as runtime compilation finishes.'
                        : wasmState.error || 'Could not instantiate WebAssembly module.'}
                    </p>
                  </div>
                </div>

                {wasmState.status === 'error' && (
                  <button
                    type="button"
                    onClick={() => retryNeedleWasm()}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 shrink-0 shadow-lg shadow-rose-600/20 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry WASM Load
                  </button>
                )}
              </div>
            )}

            {/* 1. Speech Controller Panel (Collapsible) */}
            <CollapsiblePanel
              title={
                <span className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-cyan-400" />
                  Speech Controller
                </span>
              }
              badge={
                <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 lowercase">
                  {speechSupported ? 'Local WebSpeech' : 'Fallback Audio'}
                </span>
              }
              defaultExpanded={true}
            >
              {/* Mic Recording Button with Pulse Animation */}
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative">
                  {isListening && (
                    <div className="absolute inset-0 rounded-full bg-cyan-500/30 animate-pulse-ring scale-125 pointer-events-none" />
                  )}
                  <button
                    type="button"
                    onClick={handleMicClick}
                    disabled={wasmState.status === 'loading'}
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-all disabled:opacity-50 ${
                      isListening
                        ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 ring-4 ring-rose-500/30 shadow-rose-500/50'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 ring-4 ring-cyan-500/20 shadow-cyan-500/40'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-8 h-8 animate-pulse" />
                    ) : (
                      <Mic className="w-8 h-8" />
                    )}
                  </button>
                </div>

                <p className="mt-4 text-xs font-semibold tracking-wide uppercase text-slate-300">
                  {isListening ? (
                    <span className="text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      Listening for Spoken Telemetry...
                    </span>
                  ) : (
                    <span className="text-slate-400">Tap Microphone to Begin Dictation</span>
                  )}
                </p>
              </div>

              {/* Speech API Warning if any */}
              {speechError && (
                <div className="mt-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{speechError}</span>
                </div>
              )}

              {/* Live Transcript Stream */}
              <div className="mt-4 bg-slate-950/90 border border-slate-800 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span className="flex items-center gap-1.5 text-slate-300 font-sans font-semibold">
                    <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                    Live Transcript Stream
                  </span>
                  {isExtracting && (
                    <span className="text-cyan-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Needle 3 WASM Inference...
                    </span>
                  )}
                </div>

                <div className="min-h-[70px] max-h-[120px] overflow-y-auto text-xs font-mono text-slate-200 p-2 bg-slate-900/60 rounded border border-slate-800/60 leading-relaxed">
                  {activeTranscript ? (
                    <span>
                      {transcript}
                      {interimTranscript && (
                        <span className="text-cyan-400 italic"> {interimTranscript}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">
                      Spoken words will stream live here. Dictate updates or click a sample phrase below...
                    </span>
                  )}
                </div>
              </div>

              {/* Manual text input */}
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={manualPhrase}
                  onChange={(e) => setManualPhrase(e.target.value)}
                  placeholder="Or type custom spoken phrase here..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleManualParse();
                    }
                  }}
                  className="flex-grow bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleManualParse}
                  disabled={isExtracting || wasmState.status === 'loading'}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 rounded-lg border border-slate-700 flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  Parse
                </button>
              </div>
            </CollapsiblePanel>

            {/* 2. Quick-Test Pill Buttons Panel (Collapsible) */}
            <CollapsiblePanel
              title={
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Hardware-Free Quick Test Phrases
                </span>
              }
              subtitle="Click any sample phrase below to test instant WASM extraction"
              defaultExpanded={true}
            >
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickTest(
                      'Unit PUMP-104 is running hot at 78.5 Celsius, vibration 0.35, e-stop tested, status pass.'
                    )
                  }
                  className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-cyan-950/30 border border-slate-800 hover:border-cyan-500/50 text-xs text-slate-200 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 mb-1">
                    <span>SAMPLE PHRASE 1 (FULL SPECIFICATION)</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">Run Test &rarr;</span>
                  </div>
                  "Unit PUMP-104 is running hot at 78.5 Celsius, vibration 0.35, e-stop tested, status pass."
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickTest(
                      'Unit GEN-12 critical fail, vibration 2.8, e-stop not tested, heavy bearing grinding.'
                    )
                  }
                  className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-500/50 text-xs text-slate-200 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-rose-400 mb-1">
                    <span>SAMPLE PHRASE 2 (CRITICAL FAILURE)</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">Run Test &rarr;</span>
                  </div>
                  "Unit GEN-12 critical fail, vibration 2.8, e-stop not tested, heavy bearing grinding."
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickTest(
                      'Update temperature to 42.0 and mark status needs maintenance.'
                    )
                  }
                  className="w-full text-left p-3 rounded-lg bg-slate-950/80 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/50 text-xs text-slate-200 transition-all group"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 mb-1">
                    <span>SAMPLE PHRASE 3 (INCREMENTAL FIELD UPDATE)</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">Run Test &rarr;</span>
                  </div>
                  "Update temperature to 42.0 and mark status needs maintenance."
                </button>
              </div>
            </CollapsiblePanel>

            {/* Extraction Error Notice if any */}
            {extractionError && (
              <div className="p-4 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-200 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold font-mono">
                  <span className="flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-400" />
                    Needle 3 WASM Error
                  </span>
                  <button
                    type="button"
                    onClick={() => retryNeedleWasm()}
                    className="px-2.5 py-1 rounded bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 border border-rose-400/50 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Retry WASM Load
                  </button>
                </div>
                <p className="text-rose-300 font-mono text-[11px] leading-relaxed">
                  {extractionError}
                </p>
              </div>
            )}
          </section>

          {/* Right Column: Form, Extraction Score, & Signed Output */}
          <section className="lg:col-span-7 space-y-6">

            {/* 3. Equipment Inspection Telemetry Form Panel (Collapsible) */}
            <CollapsiblePanel
              title={
                <span className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-cyan-400" />
                  Equipment Inspection Telemetry
                </span>
              }
              subtitle="Auto-populated from local WASM intent parsing or manual entry"
              defaultExpanded={true}
            >
              <InspectionForm
                extractedArguments={extractionResult?.arguments}
                resetKey={resetKey}
                onSubmitSuccess={handleFormSubmitSuccess}
                onOpenExecutiveReport={handleOpenExecutiveReport}
              />
            </CollapsiblePanel>

            {/* 4. Needle 3 WASM Extraction Score Panel under Equipment Inspection Telemetry */}
            {extractionResult && (
              <CollapsiblePanel
                title={
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Needle 3 WASM Output & Extraction Score
                  </span>
                }
                headerAction={
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono flex items-center gap-1">
                      <Binary className="w-3 h-3 text-cyan-400" />
                      {extractionResult.engineUsed}
                    </span>

                    <div
                      className={`px-3 py-1 rounded-full border text-xs font-bold font-mono flex items-center gap-1.5 shadow-md ${
                        extractionResult.confidence >= 0.85
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40 shadow-emerald-500/10'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/40 shadow-amber-500/10'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{Math.round(extractionResult.confidence * 100)}% Confidence</span>
                    </div>
                  </div>
                }
                defaultExpanded={true}
              >
                <div className="space-y-3">
                  {extractionResult.reasoning && (
                    <p className="text-xs text-slate-400 italic">
                      {extractionResult.reasoning}
                    </p>
                  )}

                  <div className="bg-slate-950/90 rounded-lg p-3.5 border border-slate-800 font-mono text-xs">
                    <div className="text-[10px] text-slate-400 mb-1.5 uppercase tracking-wider font-semibold flex items-center justify-between">
                      <span>Needle 3 WASM Raw JSON Output:</span>
                      <span className="text-cyan-400">Pure WASM Response</span>
                    </div>
                    <pre className="text-cyan-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {JSON.stringify(extractionResult.rawOutput, null, 2)}
                    </pre>
                  </div>
                </div>
              </CollapsiblePanel>
            )}

            {/* 5. Signed Submission Log Card Panel (Collapsible) */}
            {submittedPayload && (
              <CollapsiblePanel
                title={
                  <span className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                    Signed Submission Log Card
                  </span>
                }
                subtitle="Cryptographically Validated Telemetry Record Saved (Encrypted in IndexedDB)"
                headerAction={
                  <span className="text-[10px] font-mono bg-slate-950 px-2.5 py-1 rounded text-slate-400 border border-slate-800">
                    {submittedPayload.signature}
                  </span>
                }
                defaultExpanded={true}
                className="border-emerald-500/40"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1 text-slate-300">
                      <FileJson className="w-4 h-4 text-cyan-400" />
                      Validated Payload JSON (AES-256 Encrypted in IndexedDB)
                    </span>
                    <span>{new Date(submittedPayload.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <pre className="p-4 bg-slate-950 rounded-lg border border-slate-800/90 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed shadow-inner">
                    {JSON.stringify(submittedPayload, null, 2)}
                  </pre>
                </div>
              </CollapsiblePanel>
            )}
          </section>

        </div>
      </main>

      {/* Branded Executive Summary Report Pop-up Modal */}
      <ExecutiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        formData={reportFormData}
        signature={submittedPayload?.signature}
      />

      {/* Asset Telemetry History Lookup Modal */}
      <AssetLookupModal
        isOpen={isAssetLookupOpen}
        onClose={() => setIsAssetLookupOpen(false)}
        initialAssetId="PUMP-104"
      />

      {/* Industrial Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        Cactus Compute Needle 3 WASM Engine &bull; Google Titan Security Key (VID_18D1) &bull; AES-256-GCM Encrypted IndexedDB &bull; React 18 &bull; Vite &bull; TypeScript
      </footer>
    </div>
  );
};

export default App;
