"use client";
import React, { useState, useRef, useEffect } from "react";
import { Camera, Image as ImageIcon, X, Check, RefreshCw, Trash2, AlertTriangle, SwitchCamera, Sparkles } from "lucide-react";
import { compressImageFile, compressCanvasToBase64 } from "@/lib/imageUtils";

interface PhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (base64: string) => void;
  onPhotoDeleted?: () => void;
  currentPhotoUrl?: string;
  title?: string;
  animalName?: string;
}

export const PhotoCaptureModal: React.FC<PhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  onPhotoDeleted,
  currentPhotoUrl,
  title = "Fotografía del Felino",
  animalName,
}) => {
  const [mode, setMode] = useState<"menu" | "live_camera" | "preview">("menu");
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [hasCameraSupport, setHasCameraSupport] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  // Detener la cámara al desmontar o cerrar
  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
      setMode("menu");
      setPreviewBase64(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Iniciar la cámara en vivo cuando el modo es 'live_camera'
  useEffect(() => {
    if (mode === "live_camera" && isOpen) {
      let isMounted = true;
      const startCamera = async () => {
        stopLiveCamera();
        setErrorMessage(null);
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setHasCameraSupport(false);
            throw new Error("Tu navegador no soporta cámara en vivo WebRTC. Usa la opción 'Cámara del Dispositivo'.");
          }

          const constraints: MediaStreamConstraints = {
            video: {
              facingMode: { ideal: cameraFacing },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          };

          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!isMounted) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }

          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(console.warn);
          }
        } catch (err: any) {
          console.warn("Error starting live camera:", err);
          setErrorMessage(
            err?.message ||
              "No se pudo acceder a la cámara en vivo. Puedes pulsar 'Cámara del Dispositivo' para abrir tu app de cámara nativa."
          );
        }
      };

      startCamera();

      return () => {
        isMounted = false;
        stopLiveCamera();
      };
    }
  }, [mode, cameraFacing, isOpen]);

  if (!isOpen) return null;

  // Tomar instantánea de la cámara en vivo
  const handleSnapLivePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo iniciar el canvas");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const compressed = compressCanvasToBase64(canvas, 800, 0.75);

      stopLiveCamera();
      setPreviewBase64(compressed);
      setMode("preview");
    } catch (e: any) {
      console.error("Error snapping live photo:", e);
      setErrorMessage("Error al capturar la imagen. Intenta con la Cámara Nativa.");
    }
  };

  // Procesar imagen desde input nativo de archivo o cámara
  const handleNativeFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const base64 = await compressImageFile(file, 800, 0.75);
      setPreviewBase64(base64);
      setMode("preview");
    } catch (err: any) {
      console.error("Error al procesar archivo:", err);
      setErrorMessage("Error al procesar la fotografía seleccionada.");
    } finally {
      setIsProcessing(false);
      e.target.value = "";
    }
  };

  // Confirmar y guardar la foto
  const handleConfirmPhoto = () => {
    if (!previewBase64) return;
    onPhotoCaptured(previewBase64);
    onClose();
  };

  // Alternar entre cámara trasera y delantera
  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"));
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md p-3 sm:p-4 flex items-center justify-center animate-in fade-in">
      {/* Inputs ocultos para Cámara Nativa y Galería */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleNativeFileInput}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleNativeFileInput}
      />

      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Encabezado */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-700/80 flex items-center justify-center">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm">{title}</h3>
              <p className="text-[10px] text-purple-300 font-medium">
                {animalName ? `Paciente: ${animalName}` : "CBA La Perla • Control de Pacientes"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-all"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de error si ocurre */}
        {errorMessage && (
          <div className="p-3 bg-red-50 border-b border-red-200 text-red-900 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CONTENIDO SEGÚN MODO */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* MODO 1: MENÚ DE OPCIONES */}
          {mode === "menu" && (
            <div className="space-y-4">
              {/* Foto actual si existe */}
              {currentPhotoUrl && (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center gap-3">
                  <img
                    src={currentPhotoUrl}
                    alt="Foto actual"
                    className="w-16 h-16 object-cover rounded-xl border border-purple-300 shadow-sm shrink-0"
                  />
                  <div className="flex-1">
                    <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider block">
                      Fotografía Actual
                    </span>
                    <p className="text-xs font-bold text-slate-800">Foto registrada en la ficha</p>
                    <span className="text-[10px] text-slate-500">Puedes tomar una nueva o eliminarla</span>
                  </div>
                  {onPhotoDeleted && (
                    <button
                      type="button"
                      onClick={() => {
                        onPhotoDeleted();
                        onClose();
                      }}
                      className="p-2 text-rose-600 hover:bg-rose-100 rounded-xl transition-all"
                      title="Eliminar foto actual"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Botón Principal: TOMAR FOTO CON CÁMARA EN VIVO */}
              <button
                type="button"
                onClick={() => setMode("live_camera")}
                className="btn-touch w-full p-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-purple-700/25 active:scale-95 transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <span className="block text-sm font-black">📸 TOMAR FOTO CON CÁMARA</span>
                  <span className="block text-[11px] text-purple-200 font-normal">
                    Abre el visor en vivo para encuadrar y disparar al felino
                  </span>
                </div>
              </button>

              {/* Botón 2: ABRIR CÁMARA NATIVA DEL DISPOSITIVO */}
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="w-full p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center gap-3 shadow-md active:scale-95 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <span className="block text-xs font-black">CÁMARA NATIVA DE TU MÓVIL</span>
                  <span className="block text-[10px] text-slate-400 font-normal">
                    Lanza la aplicación de cámara predeterminada de Android / iOS
                  </span>
                </div>
              </button>

              {/* Botón 3: SUBIR DESDE GALERÍA / ARCHIVOS */}
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="w-full p-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-bold text-xs flex items-center gap-3 border border-slate-300 active:scale-95 transition-all text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-xs">
                  <ImageIcon className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <span className="block text-xs font-black">ELEGIR DE GALERÍA O ARCHIVOS</span>
                  <span className="block text-[10px] text-slate-500 font-normal">
                    Selecciona una foto ya guardada en tu dispositivo
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* MODO 2: VISOR DE CÁMARA EN VIVO */}
          {mode === "live_camera" && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-4/3 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-cover"
                />

                {/* Guía visual de encuadre felino */}
                <div className="absolute inset-4 border-2 border-dashed border-white/50 rounded-2xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] bg-black/60 text-white/90 px-2.5 py-1 rounded-full font-bold">
                    Centra el rostro o cuerpo del felino
                  </span>
                </div>

                {/* Botón alternar cámara frontal / trasera */}
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-xl backdrop-blur-md transition-all active:scale-90"
                  title="Cambiar de cámara"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>

              {/* Controles del Disparador */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopLiveCamera();
                    setMode("menu");
                  }}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  Volver
                </button>

                {/* Botón Disparador Central */}
                <button
                  type="button"
                  onClick={handleSnapLivePhoto}
                  className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 p-1 shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center mx-auto"
                  title="Disparar foto"
                >
                  <div className="w-13 h-13 rounded-full bg-white border-2 border-purple-300 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-purple-700" />
                  </div>
                </button>

                {/* Fallback a cámara nativa */}
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold transition-all"
                  title="Usar app nativa"
                >
                  App Nativa
                </button>
              </div>
            </div>
          )}

          {/* MODO 3: VISTA PREVIA Y CONFIRMACIÓN */}
          {mode === "preview" && previewBase64 && (
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden border-2 border-purple-300 bg-slate-900 shadow-lg aspect-4/3 flex items-center justify-center">
                <img
                  src={previewBase64}
                  alt="Vista previa"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2 text-xs text-purple-900 font-bold">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Fotografía comprimida y lista para guardar en la ficha clínica.</span>
              </div>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewBase64(null);
                    setMode("live_camera");
                  }}
                  className="w-1/2 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Repetir Foto</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmPhoto}
                  className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>USAR ESTA FOTO</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
