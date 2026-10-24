"use client";
import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Sparkles, Check, X, AlertCircle, ShieldAlert, Sparkle } from "lucide-react";
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

    // Inicializar Web Speech Recognition si está disponible en el navegador (Chrome, Android, Edge, etc.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "es-CO"; // Español de Colombia

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
          let currentText = "";
          for (let i = 0; i < event.results.length; i++) {
            currentText += event.results[i][0].transcript + " ";
          }
          const cleaned = currentText.trim();
          setTranscript(cleaned);
          if (cleaned.length > 3) {
            setParsed(parseClinicalVoice(cleaned, currentMicrochip));
          }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
          console.error("Speech error:", event);
          if (event.error !== "no-speech") {
            setErrorMsg("Micrófono: " + event.error + ". También puedes escribir la nota abajo.");
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
      } catch (e) {
        console.error("Error al iniciar SpeechRecognition:", e);
      }
    } else {
      setErrorMsg("Navegador sin Web Speech API nativa. Puedes escribir directamente la nota de voz abajo y la IA la interpretará.");
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [isOpen, currentMicrochip]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
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
          // Si ya estaba activo, reiniciar
          try {
            recognitionRef.current.stop();
            setTimeout(() => {
              recognitionRef.current.start();
              setIsRecording(true);
            }, 200);
          } catch (err) {
            console.error(err);
          }
        }
      } else {
        // Fallback demostrativo con un caso real de Gatera
        setIsRecording(true);
        setTimeout(() => {
          const sample = "Gotas oftálmicas y Cat Balance por 7 días en Cuarentena 1, felino feral con guantes";
          setTranscript(sample);
          setIsRecording(false);
          setParsed(parseClinicalVoice(sample, currentMicrochip));
        }, 1800);
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

  const applySample = (sample: string) => {
    setTranscript(sample);
    setParsed(parseClinicalVoice(sample, currentMicrochip));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black leading-tight">Asistente de Voz IA (Gatera)</h3>
              <p className="text-[11px] text-emerald-300">Prescripción y notas clínicas por voz</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-xs text-slate-600 text-center">
            Pulsa el micrófono y dicta la indicación para el felino. Ej:
            <br />
            <em className="text-emerald-700 font-bold">
              &quot;Gotas oftálmicas y Cat Balance por 7 días en Cuarentena 1&quot;
            </em>
          </p>

          {/* Botón Central de Micrófono */}
          <div className="flex flex-col items-center justify-center py-2">
            <button
              type="button"
              onClick={toggleRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
                isRecording
                  ? "bg-rose-500 text-white animate-pulse ring-8 ring-rose-100 scale-105 shadow-rose-500/50"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-100 shadow-emerald-600/30 active:scale-95"
              }`}
            >
              {isRecording ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
            </button>
            <span className="mt-3 text-xs font-black uppercase tracking-wider text-slate-600">
              {isRecording ? "🔴 Escuchando... Toca para detener" : "🎙️ Toca para hablar"}
            </span>
          </div>

          {/* Ejemplos rápidos para ahorrar tiempo */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-black uppercase text-slate-400 block text-center">
              Atajos rápidos con 1 toque:
            </span>
            <div className="flex flex-wrap gap-1.5 justify-center">
              <button
                type="button"
                onClick={() => applySample("Gotas oftálmicas y Cat Balance en Cuarentena 1 por 7 días")}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-[11px] font-semibold text-slate-700 hover:text-emerald-800 rounded-lg border border-slate-200 transition-all"
              >
                👁️ Gotas oftálmicas (Cuarentena 1)
              </button>
              <button
                type="button"
                onClick={() => applySample("Revolution y limpieza de oídos en Patio 1 Adopciones VIF")}
                className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-[11px] font-semibold text-slate-700 hover:text-emerald-800 rounded-lg border border-slate-200 transition-all"
              >
                🦟 Revolution + Oídos (Patio VIF)
              </button>
              <button
                type="button"
                onClick={() => applySample("Doxi 100 y Solubron por 10 días, felino feral con guantes en Cuarentena 3")}
                className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-[11px] font-semibold text-slate-700 hover:text-rose-800 rounded-lg border border-slate-200 transition-all"
              >
                ⚠️ Doxi 100 Feral (Cuarentena 3)
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Campo de Transcripción / Entrada Manual */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">
              Texto de la indicación médica:
            </label>
            <textarea
              rows={2}
              value={transcript}
              onChange={(e) => handleManualParse(e.target.value)}
              placeholder="O escribe aquí directamente el tratamiento clínico..."
              className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none font-medium text-slate-800"
            />
          </div>

          {/* Resultado Clasificado por la IA */}
          {parsed && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950 uppercase">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> Interpretación Inteligente
                </span>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full text-[10px] font-black">
                  Confianza {Math.round(parsed.confidence * 100)}%
                </span>
              </div>

              {parsed.isFeral && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-900 font-black flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>⚠️ ALERTA DE MANEJO: Felino Feral / Uso obligatorio de guantes</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-white rounded-lg border border-emerald-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">SISTEMA</span>
                  <span className="font-bold text-slate-800">{parsed.system}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-emerald-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">TRATAMIENTO</span>
                  <span className="font-bold text-slate-800 truncate block" title={parsed.treatment}>
                    {parsed.treatment}
                  </span>
                </div>
                {parsed.location && (
                  <div className="p-2 bg-white rounded-lg border border-emerald-100">
                    <span className="text-slate-400 block text-[10px] font-semibold">UBICACIÓN</span>
                    <span className="font-bold text-slate-800">{parsed.location}</span>
                  </div>
                )}
                <div className="p-2 bg-white rounded-lg border border-emerald-100">
                  <span className="text-slate-400 block text-[10px] font-semibold">DURACIÓN</span>
                  <span className="font-bold text-slate-800">{parsed.durationDays} días</span>
                </div>
                {parsed.serviciosAseo?.limpiezaOidos && (
                  <div className="col-span-2 p-2 bg-blue-50 rounded-lg border border-blue-200 text-blue-900 font-bold">
                    👂 Incluye Limpieza de Oídos y Aseo Otológico
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onApplyIntent(parsed);
                  onClose();
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 text-xs transition-all"
              >
                <Check className="w-4 h-4" /> Aplicar Prescripción con IA
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
