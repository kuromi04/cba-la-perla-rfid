"use client";
import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Animal, KardexRecord } from "@/lib/db";
import { AlcaldiaMedellinLogo, LaPerlaLogo } from "./OfficialLogos";
import {
  X,
  Printer,
  QrCode,
  ShieldAlert,
  AlertTriangle,
  Pill,
  MapPin,
  Calendar,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface CanilCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  animal: Animal | null;
  treatments?: KardexRecord[];
  notes?: string;
  location?: string;
}

export const CanilCardModal: React.FC<CanilCardModalProps> = ({
  isOpen,
  onClose,
  animal,
  treatments = [],
  notes,
  location,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (animal?.microchip) {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const targetUrl = `${baseUrl}/?chip=${encodeURIComponent(animal.microchip)}`;

      QRCode.toDataURL(targetUrl, {
        width: 250,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
        errorCorrectionLevel: "M",
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error("Error generando QR:", err));
    }
  }, [animal?.microchip]);

  if (!isOpen || !animal) return null;

  const effectiveLocation = location || animal.location || "SIN UBICACIÓN";
  const activeTreatments = treatments.filter((t) => t.status === "activo");

  // Detección de Bioseguridad y Alertas Críticas
  const isCDV =
    animal.species === "perro" &&
    (animal.notes?.toUpperCase().includes("CDV") ||
      animal.notes?.toUpperCase().includes("DISTEMPER") ||
      animal.notes?.toUpperCase().includes("MOQUILLO") ||
      animal.breed?.toUpperCase().includes("CDV"));

  const isCuarentena = effectiveLocation.toUpperCase().includes("CUARENTENA");
  const isFeral = Boolean(animal.isFeral);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
      {/* Botones Flotantes Superiores en Pantalla (Ocultos al Imprimir) */}
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[95vh] flex flex-col animate-in zoom-in-95">
        
        {/* Barra de Acciones del Modal */}
        <div className="flex items-center justify-between border-b pb-3 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                Ficha Oficial de Canil & Código QR
              </h2>
              <p className="text-xs text-slate-500">
                Formato oficial de reja/jaula para el Centro de Bienestar Animal La Perla
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>IMPRIMIR FICHA (CARTA / MEDIA CARTA)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DE IMPRESIÓN (DISEÑO LIMPIO TAMAÑO CARTA/MEDIA CARTA) */}
        <div
          ref={printRef}
          className="print-area bg-white border-2 border-slate-900 rounded-3xl p-6 sm:p-8 space-y-5 overflow-y-auto print:border-2 print:border-black print:p-6 print:m-0 print:w-full print:rounded-none"
        >
          {/* 1. Encabezado Oficial con Logos */}
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3">
              <AlcaldiaMedellinLogo className="h-9 sm:h-11" />
              <div className="border-l-2 border-slate-300 pl-3">
                <span className="block font-black text-xs sm:text-sm text-slate-900 tracking-tight leading-tight">
                  CENTRO DE BIENESTAR ANIMAL LA PERLA
                </span>
                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider block">
                  Subsecretaría de Protección y Bienestar Animal
                </span>
              </div>
            </div>
            <LaPerlaLogo className="h-9 sm:h-11" />
          </div>

          {/* 2. Banner de Ubicación y Especie */}
          <div className="flex items-center justify-between bg-slate-900 text-white p-3.5 rounded-2xl print:bg-black print:text-white">
            <div className="flex items-center gap-2">
              <span className="text-xl">{animal.species === "gato" ? "🐱" : "🐶"}</span>
              <div>
                <span className="text-[10px] font-bold text-slate-300 uppercase block tracking-wider">
                  CANIL / JAULA / ÁREA DE ALBERGUE
                </span>
                <span className="text-lg sm:text-xl font-black tracking-wide leading-tight">
                  {effectiveLocation}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-300 uppercase block tracking-wider">
                ESPECIE
              </span>
              <span className="text-sm font-black uppercase">
                {animal.species === "gato" ? "FELINO (GATERA)" : "CANINO (ALBERGUE)"}
              </span>
            </div>
          </div>

          {/* 3. Alertas de Bioseguridad Crítica (Si Aplica) */}
          {(isCDV || isCuarentena || isFeral || (animal.species === "gato" && animal.retroviralStatus)) && (
            <div className="space-y-1.5">
              {animal.species === "gato" && animal.retroviralStatus && animal.retroviralStatus !== "PENDIENTE" && (
                <div
                  className={`p-2.5 border-2 rounded-2xl flex items-center gap-2 font-black text-xs print:border-black ${
                    animal.retroviralStatus === "DOBLE_POSITIVO"
                      ? "bg-red-100 border-red-600 text-red-950"
                      : animal.retroviralStatus === "VIF_POSITIVO"
                      ? "bg-purple-100 border-purple-500 text-purple-950"
                      : animal.retroviralStatus === "FELV_POSITIVO"
                      ? "bg-amber-100 border-amber-600 text-amber-950"
                      : "bg-emerald-50 border-emerald-500 text-emerald-950"
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    {animal.retroviralStatus === "DOBLE_POSITIVO"
                      ? "🧬 BIOSEGURIDAD: DOBLE POSITIVO (VIF+ / FeLV+) - Aislamiento Estricto"
                      : animal.retroviralStatus === "VIF_POSITIVO"
                      ? "🧬 SEROLOGÍA FELINA: POSITIVO A VIF (Inmunodeficiencia Felina +)"
                      : animal.retroviralStatus === "FELV_POSITIVO"
                      ? "🧬 SEROLOGÍA FELINA: POSITIVO A FeLV (Leucemia Felina +)"
                      : "🧬 SEROLOGÍA FELINA: NEGATIVO (VIF- / FeLV-)"}
                  </span>
                </div>
              )}
              {isCDV && (
                <div className="p-3 bg-red-100 border-2 border-red-600 text-red-950 rounded-2xl flex items-center gap-2.5 font-black text-xs print:border-black print:text-black">
                  <ShieldAlert className="w-5 h-5 text-red-700 shrink-0" />
                  <div>
                    <span className="block text-sm">☣️ BIOSEGURIDAD NIVEL 3: POSITIVO PARA DISTEMPER (CDV)</span>
                    <span className="text-[11px] font-bold text-red-800">
                      AISLAMIENTO ESTRICTO. Prohibido contacto con otros caninos. Desinfección obligatoria de calzado y manos.
                    </span>
                  </div>
                </div>
              )}
              {isFeral && (
                <div className="p-2.5 bg-red-50 border-2 border-red-500 text-red-900 rounded-2xl flex items-center gap-2 font-black text-xs print:border-black">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>
                    ⚠️ ANIMAL FERAL / REACTIVO: Manejo cauteloso obligatorio. Usar guantes de carnaza y toalla.
                  </span>
                </div>
              )}
              {isCuarentena && (
                <div className="p-2.5 bg-amber-50 border-2 border-amber-500 text-amber-950 rounded-2xl flex items-center gap-2 font-black text-xs print:border-black">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    🛑 ÁREA RESTRINGIDA DE CUARENTENA: Prohibido traslado sin autorización médica veterinaria previa.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 4. Bloque Principal: Datos del Animal + Código QR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            
            {/* Columna Izquierda (2/3): Datos Clínicos */}
            <div className="sm:col-span-2 space-y-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  NOMBRE / IDENTIFICACIÓN
                </span>
                <h3 className="text-2xl font-black text-slate-900 leading-tight">
                  {animal.name}
                </h3>
                <p className="text-xs text-slate-600 font-medium">{animal.breed || "Mestizo"}</p>
              </div>

              {/* Caja Destacada de Microchip y HC */}
              <div className="p-3 bg-slate-100 rounded-2xl border-2 border-slate-300 space-y-1 print:border-black">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
                  NÚMERO DE MICROCHIP (RFID ISO 11784/85):
                </span>
                <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-wider block">
                  {animal.microchip}
                </span>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-700 pt-1 border-t border-slate-200">
                  <span>Chip Corto: <strong>{animal.shortChip || animal.microchip.slice(-7)}</strong></span>
                  {animal.hc && <span>Historia Clínica (HC): <strong>{animal.hc}</strong></span>}
                </div>
              </div>

              {/* Rasgos Físicos */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2 bg-slate-50 border rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Sexo</span>
                  <span className="font-black text-slate-800 capitalize">{animal.gender || "N/D"}</span>
                </div>
                <div className="p-2 bg-slate-50 border rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Color</span>
                  <span className="font-black text-slate-800 truncate block">
                    {animal.color || animal.breed?.split("-")[1] || "Estándar"}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 border rounded-xl">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Estado</span>
                  <span className="font-black text-emerald-800 uppercase">{animal.status || "ACTIVO"}</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha (1/3): Fotografía + Código QR Oficial */}
            <div className="flex flex-col items-center justify-center p-3 bg-slate-50 border-2 border-slate-200 rounded-3xl text-center space-y-1.5 print:border-black">
              {animal.photoUrl && (
                <img
                  src={animal.photoUrl}
                  alt={`Foto de ${animal.name}`}
                  className="w-24 h-24 object-cover rounded-2xl shadow-xs border-2 border-slate-300 mb-1"
                />
              )}
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR de ${animal.name}`}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-xl shadow-sm border border-slate-200 print:shadow-none"
                />
              ) : (
                <div className="w-32 h-32 bg-slate-200 animate-pulse rounded-xl" />
              )}
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-slate-900 flex items-center justify-center gap-1">
                  <QrCode className="w-3 h-3 text-indigo-600" /> EXPEDIENTE DIGITAL
                </span>
                <span className="text-[9px] text-slate-500 block leading-tight">
                  Escanee con la cámara de cualquier celular para ver la ficha en tiempo real
                </span>
              </div>
            </div>
          </div>

          {/* 5. Plan Médico / Tratamientos Activos */}
          <div className="space-y-2 border-t-2 border-slate-200 pt-3">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-indigo-600" /> PLAN TERAPÉUTICO Y MEDICACIÓN ACTIVA
            </span>

            {activeTreatments.length === 0 ? (
              <div className="p-3 bg-slate-50 border rounded-xl text-xs text-slate-500 italic">
                Sin medicamentos programados actualmente. Animal bajo observación rutinaria.
              </div>
            ) : (
              <div className="space-y-1.5">
                {activeTreatments.map((t, idx) => (
                  <div
                    key={t.id || idx}
                    className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-black text-slate-900 block text-sm">{t.treatment}</span>
                      <span className="text-[11px] text-slate-600">{t.description || `Sistema: ${t.system}`}</span>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <span className="font-black text-indigo-900 block">
                        Dosis: {t.dosisAplicadas || 0} / {t.dosisTotales || 7}
                      </span>
                      <span className="text-[10px] text-slate-500">Fin est.: {t.endDate || "HNI"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. Notas de Manejo y Dieta */}
          {notes && (
            <div className="p-3 bg-slate-50 border rounded-xl text-xs space-y-1">
              <span className="font-bold text-slate-700 block uppercase text-[10px]">
                Observaciones de Manejo / Dieta:
              </span>
              <p className="text-slate-800">{notes}</p>
            </div>
          )}

          {/* 7. Pie de Página de Validación Oficial con Firma */}
          <div className="pt-4 border-t-2 border-slate-900 grid grid-cols-2 gap-6 text-[10px] text-slate-600">
            <div>
              <span className="block font-bold text-slate-800">FECHA DE EMISIÓN DE FICHA:</span>
              <span>{new Date().toLocaleDateString()} • {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <span className="block text-[9px] text-slate-400 mt-1">
                Generado por Sistema PWA CBA La Perla • Kuromi04
              </span>
            </div>

            <div className="text-right flex flex-col justify-end">
              <div className="w-48 border-b border-slate-400 ml-auto mb-1" />
              <span className="font-bold text-slate-800 block">FIRMA MÉDICO VETERINARIO</span>
              <span className="text-[9px] text-slate-500">M.P. Secretaría de Salud / Comvezcol</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
