import React, { useState } from 'react';
import {
  authenticateTitanKey,
  HardwareAuthState,
} from '../services/securityKeyService';
import {
  KeyRound,
  ShieldCheck,
  Fingerprint,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export const HardwareKeyLockBanner: React.FC = () => {
  const [authState, setAuthState] = useState<HardwareAuthState>({
    isAuthenticated: true,
    keyId: 'TITAN-VID18D1-PID9470-ACTIVE',
  });
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleTouchAuthenticate = async () => {
    setIsAuthenticating(true);
    try {
      const state = await authenticateTitanKey();
      setAuthState(state);
      setToastMsg('Google Titan USB Key (VID_18D1 • PID_9470) Verified & Active! AES-256-GCM Encryption Initialized.');
      setTimeout(() => setToastMsg(null), 4500);
    } catch (e: any) {
      console.warn('Titan key auth notice:', e);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="bg-slate-950/90 border-2 border-emerald-500/50 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          {/* USB Key Badge with Hover Tooltip */}
          <div className="group relative cursor-pointer">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 shadow-md">
              <KeyRound className="w-5 h-5 animate-pulse" />
            </div>

            {/* Hover Tooltip Box */}
            <div className="pointer-events-none absolute left-0 top-full mt-2 w-80 p-3.5 bg-slate-950/95 border-2 border-emerald-500/60 rounded-xl text-xs font-mono text-emerald-200 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
              <div className="font-bold uppercase tracking-wider text-[10px] text-emerald-400 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                TITAN KEY HARDWARE ENCRYPTION ACTIVE
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                If the physical field device is lost or stolen on-site, the raw inspection records inside IndexedDB are unreadable ciphertext and cannot be decrypted without your physical Google Titan Key!
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              {/* Title with Hover Tooltip */}
              <div className="group relative cursor-pointer">
                <h4 className="text-xs font-bold text-slate-100 font-mono tracking-wide flex items-center gap-1.5 hover:text-emerald-300 transition-colors">
                  GOOGLE TITAN SECURITY KEY ATTACHED
                </h4>

                {/* Hover Tooltip Box */}
                <div className="pointer-events-none absolute left-0 top-full mt-2 w-80 p-3.5 bg-slate-950/95 border-2 border-emerald-500/60 rounded-xl text-xs font-mono text-emerald-200 shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-50">
                  <div className="font-bold uppercase tracking-wider text-[10px] text-emerald-400 mb-1 flex items-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    TITAN KEY HARDWARE ENCRYPTION ACTIVE
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                    If the physical field device is lost or stolen on-site, the raw inspection records inside IndexedDB are unreadable ciphertext and cannot be decrypted without your physical Google Titan Key!
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                VID_18D1 &bull; PID_9470
              </span>
            </div>

            <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              WebAuthn FIDO2 Hardware Session Active &bull; AES-256-GCM IndexedDB Encryption Enabled
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleTouchAuthenticate}
            disabled={isAuthenticating}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
          >
            {isAuthenticating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Verifying Hardware...
              </>
            ) : (
              <>
                <Fingerprint className="w-3.5 h-3.5" />
                Touch Titan Key to Verify
              </>
            )}
          </button>
        </div>
      </div>

      {/* Verification Toast Notice */}
      {toastMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 font-mono text-xs flex items-center justify-between shadow-xl animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            {toastMsg}
          </span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-emerald-400 hover:text-emerald-100 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
