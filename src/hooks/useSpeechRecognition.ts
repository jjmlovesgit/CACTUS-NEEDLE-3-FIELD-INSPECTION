import { useState, useEffect, useRef, useCallback } from 'react';

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export interface UseSpeechRecognitionOptions {
  onPauseOrStop?: (finalTranscript: string) => void;
  pauseThresholdMs?: number; // default 1200ms
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  setTranscript: (text: string) => void;
  error: string | null;
  isSupported: boolean;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { onPauseOrStop, pauseThresholdMs = 1200 } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscriptState] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fullTranscriptRef = useRef('');
  const onPauseOrStopRef = useRef(onPauseOrStop);

  useEffect(() => {
    onPauseOrStopRef.current = onPauseOrStop;
  }, [onPauseOrStop]);

  // Initialize SpeechRecognition instance
  useEffect(() => {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setError('Browser does not support Web Speech API (window.SpeechRecognition).');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false; // Auto-stop after phrase completion
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Prioritize local on-device speech processing if supported by Chrome
    if ('processLocally' in recognition) {
      try {
        (recognition as any).processLocally = true;
      } catch (e) {
        console.warn('Could not set processLocally on SpeechRecognition:', e);
      }
    }

    recognition.onresult = (event: any) => {
      let finalAcc = '';
      let interimAcc = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalAcc += text + ' ';
        } else {
          interimAcc += text;
        }
      }

      if (finalAcc) {
        fullTranscriptRef.current = (fullTranscriptRef.current + ' ' + finalAcc).trim();
        setTranscriptState(fullTranscriptRef.current);
      }
      setInterimTranscript(interimAcc);

      // Clear existing pause timer and set a new debounce timer for speaker pause
      if (pauseTimerRef.current) {
        clearTimeout(pauseTimerRef.current);
      }

      pauseTimerRef.current = setTimeout(() => {
        const currentFull = (fullTranscriptRef.current + ' ' + interimAcc).trim();
        if (currentFull && onPauseOrStopRef.current) {
          console.log('[SpeechRecognition] Pause detected. Auto-stopping microphone & running intent extraction...');
          // Auto-stop microphone when speech completes
          if (recognitionRef.current) {
            try {
              recognitionRef.current.stop();
            } catch (e) {}
          }
          setIsListening(false);
          onPauseOrStopRef.current(currentFull);
        }
      }, pauseThresholdMs);
    };

    recognition.onerror = (event: any) => {
      console.warn('[SpeechRecognition] Error:', event.error);
      if (event.error !== 'no-speech') {
        setError(`Speech recognition error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Trigger callback with accumulated text when speech ends
      if (fullTranscriptRef.current && onPauseOrStopRef.current) {
        onPauseOrStopRef.current(fullTranscriptRef.current);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, [pauseThresholdMs]);

  const startListening = useCallback(() => {
    setError(null);
    fullTranscriptRef.current = '';
    setTranscriptState('');
    setInterimTranscript('');
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err: any) {
        console.warn('Speech recognition start failed:', err);
        setError(err.message || 'Could not start speech recognition');
      }
    } else {
      // Mock listening for browsers without speech API
      setIsListening(true);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);

    if (fullTranscriptRef.current && onPauseOrStopRef.current) {
      onPauseOrStopRef.current(fullTranscriptRef.current);
    }
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    fullTranscriptRef.current = '';
    setTranscriptState('');
    setInterimTranscript('');
  }, []);

  const setTranscript = useCallback((text: string) => {
    fullTranscriptRef.current = text;
    setTranscriptState(text);
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
    error,
    isSupported,
  };
}
