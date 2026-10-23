"use client";
import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sparkles, Check, X, AlertCircle } from "lucide-react";
import { parseClinicalVoice, ParsedClinicalIntent } from "@/lib/aiParser";

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMicrochip?: string;
  onApplyIntent: (intent: ParsedClinicalIntent) => void;
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  currentMicrochip,
  onApplyIntent,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed] = useState<ParsedClinicalIntent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setTranscript("");
      setParsed(null);
      setIsRecording(false);
      setErrorMsg(null);
      return;
    }

    // Inicializar Web Speech Recognition si está disponible
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "es-ES";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let currentText = "";
        for (let i = 0; i < event.results.length; i++) {
          currentText += event.results[i][0].transcript + " ";
        }
        setTranscript(currentText.trim());
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (event: any) => {
        console.error("Speech error:", event);
        if (event.error !== "no-speech") {
          setErrorMsg("Micrófono: " + event.error);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      setErrorMsg("Tu navegador no soporta Web Speech API directa. Puedes escribir el texto abajo.");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [isOpen]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      if (transcript) {
        const result = parseClinicalVoice(transcript, currentMicrochip);
        setParsed(result);
      }
    } else {
      setTranscript("");
      setParsed(null);
      setErrorMsg(null);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        // Fallback simulador para testing
        setIsRecording(true);
        setTimeout(() => {
          const sample = "Herida en pata delantera derecha, aplicar curación con clorhexidina por 5 días en canil 4";
          setTranscript(sample);
          setIsRecording(false);
          setParsed(parseClinicalVoice(sample, currentMicrochip));
        }, 2500);
      }
    }
  };

  const handleManualParse = (text: string) => {
    setTranscript(text);
    if (text.trim().length > 3) {
      setParsed(parseClinicalVoice(text, currentMicrochip));
    } else {
      setParsed(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
            <h3 className="text-lg font-bold">Asistente de Voz Clínico (IA)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 text-center">
            Pulsa el micrófono y di la indicación médica. Ej:
            <br />
            <em className="text-indigo-600 font-medium">
              &quot;Curación con clorhexidina en canil 4 por 5 días&quot;
            </em>
          </p>

          {/* Botón Central de Micrófono */}
          <div className="flex flex-col items-center justify-center py-2">
            <button
              type="button"
              onClick={toggleRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse ring-8 ring-red-100 scale-105"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white ring-4 ring-indigo-100"
              }`}
            >
              {isRecording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </button>
            <span className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isRecording ? "Escuchando... Toca para detener" : "Toca para hablar"}
            </span>
          </div>

          {errorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Campo de Transcripción / Entrada Manual */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Transcripción de voz:
            </label>
            <textarea
              rows={2}
              value={transcript}
              onChange={(e) => handleManualParse(e.target.value)}
              placeholder="O escribe aquí el tratamiento directamente..."
              className="w-full p-3 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          {/* Resultado Clasificado por la IA */}
          {parsed && (
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900 uppercase">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Clasificación sugerida
                </span>
                <span className="px-2 py-0.5 bg-indigo-200 text-indigo-800 rounded-full text-[10px]">
                  Confianza {Math.round(parsed.confidence * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">SISTEMA</span>
                  <span className="font-bold text-slate-800">{parsed.system}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">TRATAMIENTO</span>
                  <span className="font-bold text-slate-800 truncate block">{parsed.treatment}</span>
                </div>
                {parsed.dosisBravecto && (
                  <div className="p-2 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-amber-800 block text-[10px] font-semibold">DOSIS BRAVECTO</span>
                    <span className="font-bold text-amber-900">{parsed.dosisBravecto} tableta/pipeta</span>
                  </div>
                )}
                {parsed.location && (
                  <div className="p-2 bg-white rounded-lg border border-indigo-100">
                    <span className="text-slate-400 block text-[10px] font-semibold">UBICACIÓN</span>
                    <span className="font-bold text-slate-800">{parsed.location}</span>
                  </div>
                )}
                <div className="p-2 bg-white rounded-lg border border-indigo-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">DURACIÓN</span>
                  <span className="font-bold text-slate-800">{parsed.durationDays} días</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onApplyIntent(parsed);
                  onClose();
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 text-sm"
              >
                <Check className="w-4 h-4" /> Aplicar al Kardex Directamente
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
