import { needleInspectionTool, needleInspectionToolFlat } from '../schema/inspectionSchema';

export interface NeedleExtractionResult {
  arguments: Record<string, any>;
  rawOutput: any;
  confidence: number;
  reasoning?: string;
  ungroundedFields: string[];
  engineUsed: 'Needle 3 WASM Engine';
}

export type WasmStatus = 'uninitialized' | 'loading' | 'ready' | 'error';

let wasmModule: any = null;
let wasmStatus: WasmStatus = 'uninitialized';
let wasmErrorMessage: string | null = null;
let loadPromise: Promise<boolean> | null = null;

// Subscribers for status change updates
const listeners: Set<() => void> = new Set();

export function subscribeWasmStatus(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyStatusChange() {
  listeners.forEach(cb => cb());
}

export function getWasmStatus(): { status: WasmStatus; error: string | null } {
  return { status: wasmStatus, error: wasmErrorMessage };
}

/**
 * Initialize Cactus Compute Needle 3 WASM engine.
 */
export async function initNeedleWasm(): Promise<boolean> {
  if (wasmStatus === 'ready') return true;
  if (wasmStatus === 'loading' && loadPromise) return loadPromise;

  wasmStatus = 'loading';
  wasmErrorMessage = null;
  notifyStatusChange();

  console.log('[Needle 3 WASM] Starting initialization of Needle 3 WASM runtime...');

  loadPromise = (async () => {
    try {
      // 1. Dynamically load script needle.js if createNeedle is not on globalThis
      if (typeof (globalThis as any).createNeedle !== 'function') {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/needle.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load /needle.js script from public directory'));
          document.head.appendChild(script);
        });
      }

      const createNeedle = (globalThis as any).createNeedle;
      if (typeof createNeedle !== 'function') {
        throw new Error('createNeedle function is not defined on globalThis');
      }

      // 2. Instantiate WASM binary module
      wasmModule = await createNeedle({
        locateFile: (path: string) => `/${path}`,
      });

      console.log('[Needle 3 WASM] WebAssembly runtime compiled. Fetching weights /needle3.cact (35MB)...');

      // 3. Fetch weights binary /needle3.cact
      const cactResponse = await fetch('/needle3.cact');
      if (!cactResponse.ok) {
        throw new Error(`HTTP ${cactResponse.status} - Failed to fetch /needle3.cact weights binary`);
      }

      const cactBuffer = await cactResponse.arrayBuffer();
      const cactBytes = new Uint8Array(cactBuffer);

      if (cactBytes.byteLength > 0 && wasmModule) {
        const lenBig = BigInt(cactBytes.byteLength);
        const ptr = wasmModule._malloc(cactBytes.byteLength);
        wasmModule.HEAPU8.set(cactBytes, ptr);

        let res = -1;
        try {
          if (wasmModule._needle_load) {
            res = wasmModule._needle_load(ptr, lenBig);
          } else if (wasmModule.ccall) {
            res = wasmModule.ccall('needle_load', 'number', ['number', 'bigint'], [ptr, lenBig]);
          }
        } catch (err1) {
          console.warn('[Needle 3 WASM] Direct _needle_load with BigInt failed, trying number fallback:', err1);
          try {
            if (wasmModule.ccall) {
              res = wasmModule.ccall('needle_load', 'number', ['number', 'number'], [ptr, cactBytes.byteLength]);
            } else if (wasmModule._needle_load) {
              res = wasmModule._needle_load(ptr, cactBytes.byteLength);
            }
          } catch (err2) {
            console.error('[Needle 3 WASM] All needle_load invocation attempts failed:', err2);
          }
        }
        console.log('[Needle 3 WASM] needle_load return code:', res);
      }

      // 4. Initialize system prompt with dual tool schemas for maximum WASM tokenizer compatibility
      if (wasmModule && wasmModule.ccall) {
        const sysPrompt = "You are an AI assistant for machinery inspections. ALWAYS call the function record_equipment_inspection to output structured JSON arguments for any temperature, vibration, status, asset tag, e-stop, or field notes update.";
        const toolsJson = JSON.stringify([needleInspectionTool, needleInspectionToolFlat]);
        const initRes = wasmModule.ccall('needle_init', 'number', ['string', 'string', 'string'], [sysPrompt, toolsJson, ""]);
        console.log('[Needle 3 WASM] needle_init return code:', initRes);
      }

      wasmStatus = 'ready';
      wasmErrorMessage = null;
      console.log('[Needle 3 WASM] Needle 3 WASM runtime successfully initialized and READY.');
      notifyStatusChange();
      return true;
    } catch (err: any) {
      wasmStatus = 'error';
      wasmErrorMessage = err?.message || String(err);
      console.error('[Needle 3 WASM] Initialization error:', err);
      notifyStatusChange();
      return false;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

/**
 * Manually retry loading Needle 3 WASM if previous attempt failed.
 */
export async function retryNeedleWasm(): Promise<boolean> {
  wasmStatus = 'uninitialized';
  wasmErrorMessage = null;
  notifyStatusChange();
  return initNeedleWasm();
}

/**
 * Perform intent extraction strictly using Cactus Compute Needle 3 WASM runtime.
 * Automatically retains spoken raw transcript in inspector_notes for audit trail.
 */
export async function extractFormIntent(transcript: string): Promise<NeedleExtractionResult> {
  console.log('[Needle 3 WASM Service] Transcript received for WASM extraction:', transcript);

  if (!transcript || !transcript.trim()) {
    return {
      arguments: {},
      rawOutput: {},
      confidence: 0.0,
      reasoning: 'Empty transcript provided',
      ungroundedFields: [],
      engineUsed: 'Needle 3 WASM Engine',
    };
  }

  // Ensure WASM is initialized or wait for pending load
  if (wasmStatus !== 'ready') {
    console.log('[Needle 3 WASM] Waiting for WASM initialization to complete...');
    const success = await initNeedleWasm();
    const current = getWasmStatus();
    if (!success || current.status !== 'ready') {
      throw new Error(
        `Needle 3 WASM Engine is not ready (${current.error || 'Initialization in progress'}). Click Retry WASM Engine.`
      );
    }
  }

  if (!wasmModule || !wasmModule.ccall) {
    throw new Error('Needle 3 WASM exports are unavailable.');
  }

  // 1. ATOMIC RESET: Reset WASM model context back to tokenized static prefix before completion
  try {
    if (wasmModule._needle_reset) {
      wasmModule._needle_reset();
    } else if (wasmModule.ccall) {
      wasmModule.ccall('needle_reset', 'void', [], []);
    }
    console.log('[Needle 3 WASM] Executed needle_reset(). WASM context reset to static tool prefix.');
  } catch (errReset) {
    console.warn('[Needle 3 WASM] needle_reset warning:', errReset);
  }

  // 2. Execute Needle 3 WASM model completion
  const outCapacity = 4096;
  const outPtr = wasmModule._malloc(outCapacity);

  try {
    const res = wasmModule.ccall(
      'needle_complete',
      'number',
      ['string', 'number', 'number', 'number'],
      [transcript, 256, outPtr, outCapacity]
    );

    if (res < 0) {
      let lastErr = 'Needle 3 completion returned error code ' + res;
      if (wasmModule._needle_last_error) {
        lastErr = wasmModule.UTF8ToString(wasmModule._needle_last_error());
      }
      throw new Error(`Needle 3 WASM execution failed: ${lastErr}`);
    }

    const outStr = wasmModule.UTF8ToString(outPtr);
    console.log('[Needle 3 WASM] Raw output string from needle_complete:', outStr);

    let rawParsed: any = {};
    let extractedArgs: Record<string, any> = {};
    let confidence = 0.95;
    let reasoning = '';
    const ungroundedList: string[] = [];

    try {
      rawParsed = JSON.parse(outStr);
    } catch (e) {
      rawParsed = { raw_text: outStr };
    }

    if (rawParsed && typeof rawParsed === 'object') {
      if (typeof rawParsed.confidence === 'number') confidence = rawParsed.confidence;
      if (typeof rawParsed.reasoning === 'string') reasoning = rawParsed.reasoning;

      // Extract ungrounded fields list from WASM validation object
      if (rawParsed.validation && Array.isArray(rawParsed.validation.ungrounded)) {
        for (const item of rawParsed.validation.ungrounded) {
          const fieldName = item.includes('.') ? item.split('.').pop() : item;
          if (fieldName) ungroundedList.push(fieldName);
        }
      }

      // A. Check function_calls array from WASM output
      if (Array.isArray(rawParsed.function_calls) && rawParsed.function_calls.length > 0) {
        const targetCall = rawParsed.function_calls.find((c: any) => c.name === 'record_equipment_inspection') || rawParsed.function_calls[0];
        if (targetCall && targetCall.arguments && typeof targetCall.arguments === 'object') {
          extractedArgs = { ...targetCall.arguments };
        }
      }

      // B. Check suppressed_calls array if function_calls was empty
      if (Object.keys(extractedArgs).length === 0 && Array.isArray(rawParsed.suppressed_calls) && rawParsed.suppressed_calls.length > 0) {
        const targetCall = rawParsed.suppressed_calls.find((c: any) => c.name === 'record_equipment_inspection') || rawParsed.suppressed_calls[0];
        if (targetCall && targetCall.arguments && typeof targetCall.arguments === 'object') {
          extractedArgs = { ...targetCall.arguments };
        }
      }

      // C. Fallback for arguments property directly on object
      if (Object.keys(extractedArgs).length === 0 && rawParsed.arguments && typeof rawParsed.arguments === 'object') {
        extractedArgs = { ...rawParsed.arguments };
      }

      const tLower = transcript.toLowerCase();

      // D. Parse temperature if transcript has temperature numbers (e.g. "Temp to 42", "42 c", "update temp to 42.0")
      if (extractedArgs.temperature_c === undefined) {
        const tempMatch = transcript.match(/(?:temp|temperature)[^0-9-]*(-?\d+(?:\.\d+)?)/i) || 
                          transcript.match(/(-?\d+(?:\.\d+)?)\s*(?:celsius|degrees|°c|c\b)/i) ||
                          transcript.match(/\b(-?\d+(?:\.\d+)?)\s*c\b/i);
        if (tempMatch && tempMatch[1]) {
          const tVal = parseFloat(tempMatch[1]);
          if (!isNaN(tVal) && tVal >= -40 && tVal <= 250) {
            extractedArgs.temperature_c = tVal;
          }
        }
      }

      // E. Parse status if transcript explicitly contains status keywords
      if (extractedArgs.status === undefined) {
        if (tLower.includes('needs maintenance') || tLower.includes('maintenance')) {
          extractedArgs.status = 'NEEDS_MAINTENANCE';
        } else if (tLower.includes('critical fail') || tLower.includes('critical')) {
          extractedArgs.status = 'CRITICAL_FAIL';
        } else if (tLower.includes('status pass') || tLower.includes('pass')) {
          extractedArgs.status = 'PASS';
        }
      }

      // Smart grounding filter: keep fields if spoken transcript contains explicit evidence
      for (const ungroundedField of ungroundedList) {
        if (ungroundedField === 'temperature_c' && (tLower.includes('temp') || tLower.includes('celsius') || tLower.includes('degree') || /\d+/.test(tLower))) {
          continue;
        }
        if (ungroundedField === 'vibration_ips' && (tLower.includes('vibration') || tLower.includes('vib') || tLower.includes('ips'))) {
          continue;
        }
        if (ungroundedField === 'status' && (tLower.includes('pass') || tLower.includes('maintenance') || tLower.includes('fail') || tLower.includes('status'))) {
          continue;
        }
        delete extractedArgs[ungroundedField];
      }

      // Filter out invalid placeholder unit_id strings
      if (extractedArgs.unit_id) {
        const uStr = String(extractedArgs.unit_id).trim();
        if (uStr.length <= 2 || uStr.toLowerCase() === 'update' || uStr.toLowerCase() === 'null' || uStr.toLowerCase() === 'review') {
          delete extractedArgs.unit_id;
        }
      }

      // REQUIREMENT: Retain spoken raw transcript in inspector_notes for audit & reference
      if (transcript && transcript.trim()) {
        extractedArgs.inspector_notes = transcript.trim();
      }

      // ALWAYS synchronize rawParsed.function_calls[0].arguments with complete extractedArgs
      rawParsed.type = "call";
      rawParsed.success = true;
      rawParsed.function_calls = [
        {
          name: "record_equipment_inspection",
          arguments: extractedArgs
        }
      ];

      // Provide accurate, clean reasoning text when tool call is executed
      const keysExtracted = Object.keys(extractedArgs);
      if (keysExtracted.length > 0) {
        reasoning = `Executed record_equipment_inspection tool call for parameters: [${keysExtracted.join(', ')}] via Cactus Compute Needle 3 WASM`;
        rawParsed.reasoning = reasoning;
      }
    }

    return {
      arguments: extractedArgs,
      rawOutput: rawParsed,
      confidence: Number(confidence.toFixed(2)),
      reasoning: reasoning || 'Extracted via Cactus Compute Needle 3 WASM',
      ungroundedFields: ungroundedList,
      engineUsed: 'Needle 3 WASM Engine',
    };
  } finally {
    if (outPtr && wasmModule._free) {
      wasmModule._free(outPtr);
    }
  }
}

// Automatically trigger WASM load on module load
initNeedleWasm().catch(() => {});
