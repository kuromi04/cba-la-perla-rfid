"use client";
import React, { useState, useRef, useEffect } from "react";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { Animal, KardexRecord, db, searchAnimalSmart } from "@/lib/db";
import { ShelterRecord } from "@/lib/realData";
import {
  Scan,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Pill,
  Mic,
  Clock,
  Edit3,
  Calendar,
  Save,
  UserCheck,
  Layers,
  Printer,
  QrCode,
  ShieldAlert,
  PlusCircle,
} from "lucide-react";
import { VoiceModal } from "./VoiceModal";
import { AssignAnimalModal } from "./AssignAnimalModal";
import { BatchScannerModal } from "./BatchScannerModal";
import { CanilCardModal } from "./CanilCardModal";
import { RegisterNewAnimalModal } from "./RegisterNewAnimalModal";
import { ParsedClinicalIntent } from "@/lib/aiParser";
import { StaffMember } from "@/lib/staff";

interface ScannerTabProps {
  initialChip?: string;
  onGoToPlanilla?: (chip: string) => void;
  currentUser?: StaffMember | null;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({ initialChip = "", onGoToPlanilla, currentUser }) => {
  const [chipInput, setChipInput] = useState(initialChip);
  const [currentAnimal, setCurrentAnimal] = useState<Animal | null>(null);
  const [shelterEntries, setShelterEntries] = useState<ShelterRecord[]>([]);
  const [animalTreatments, setAnimalTreatments] = useState<KardexRecord[]>([]);
  const [censusConfirmed, setCensusConfirmed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isCanilCardOpen, setIsCanilCardOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [preselectedSpecies, setPreselectedSpecies] = useState<"perro" | "gato">("perro");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Edición rápida en campo
  const [isEditing, setIsEditing] = useState(false);
  const [editLocation, setEditLocation] = useState("");
  const [editMedication, setEditMedication] = useState("");
  const [editPendientes, setEditPendientes] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Carga automática si viene desde un QR escaneado (?chip=...)
  useEffect(() => {
    if (initialChip && initialChip.trim()) {
      setChipInput(initialChip.trim());
      handleSearch(initialChip.trim());
    }
  }, [initialChip]);

  // Escuchar ráfagas del lector W91A Bluetooth HID
  useBarcodeScanner({
    onScan: (code) => {
      setChipInput(code);
      handleSearch(code);
    },
    minLength: 6, // Admite chips cortos como 3805740 o completos de 15 dígitos
  });

  const handleSearch = async (query: string) => {
    const clean = query.trim();
    if (!clean) return;

    setCensusConfirmed(false);
    setFeedbackMessage(null);
    setIsEditing(false);

    // Búsqueda inteligente
    const found = await searchAnimalSmart(clean);

    if (found) {
      setCurrentAnimal(found);
      setNotFound(false);
      setEditLocation(found.location);

      if (found.species === "gato") {
        const catRecord = await db.gateraRecords
          .filter(
            (c) =>
              c.microchip === found.microchip ||
              (found.shortChip && c.shortChip === found.shortChip) ||
              c.microchip.endsWith(clean)
          )
          .first();

        if (catRecord) {
          setShelterEntries([
            {
              ubicacion: catRecord.ubicacion,
              microchip: catRecord.microchip,
              shortChip: catRecord.shortChip,
              descripcion: `${catRecord.nombre} (${catRecord.raza} - ${catRecord.color})`,
              medicacion: catRecord.medicacion,
              section: "GATERA" as any,
              pendientes: `HC: ${catRecord.hc}. ${catRecord.pendientes || ""}`,
              sistema: catRecord.sistema,
            },
          ]);
          setEditMedication(catRecord.medicacion || "");
          setEditPendientes(catRecord.pendientes || "");
        } else {
          setShelterEntries([]);
          setEditMedication("");
          setEditPendientes("");
        }
      } else {
        // Cargar registros de la planilla real para caninos
        const allRecords = await db.shelterRecords.toArray();
        const matchingRecords = allRecords.filter(
          (r) =>
            r.microchip === found.microchip ||
            (found.shortChip && r.shortChip === found.shortChip) ||
            r.microchip.endsWith(clean)
        );

        setShelterEntries(matchingRecords);
        if (matchingRecords.length > 0) {
          setEditMedication(matchingRecords[0].medicacion || "");
          setEditPendientes(matchingRecords[0].pendientes || "");
        } else {
          setEditMedication("");
          setEditPendientes("");
        }
      }

      // Cargar tratamientos activos de Kardex
      const treats = await db.kardex.where("microchip").equals(found.microchip).toArray();
      setAnimalTreatments(treats);

      // Feedback háptico y Alerta Bioseguridad
      const isCDV =
        found.species === "perro" &&
        (found.notes?.toUpperCase().includes("CDV") ||
          found.breed?.toUpperCase().includes("CDV") ||
          found.name?.toUpperCase().includes("CDV"));
      const isCuarentena = found.location?.toUpperCase().includes("CUARENTENA");
      const isFeral = Boolean(found.isFeral);

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        if (isCDV || isCuarentena || isFeral) {
          navigator.vibrate([250, 100, 250, 100, 450]);
        } else {
          navigator.vibrate([100, 50, 100]);
        }
      }
    } else {
      // Buscar si existe en gateraRecords o en shelterRecords
      const gateraMatch = await db.gateraRecords
        .filter(
          (c) =>
            c.microchip.includes(clean) ||
            (c.shortChip && c.shortChip.includes(clean)) ||
            c.hc === clean
        )
        .first();

      if (gateraMatch) {
        const tempAnimal: Animal = {
          microchip: gateraMatch.microchip,
          shortChip: gateraMatch.shortChip,
          name: gateraMatch.nombre,
          species: "gato",
          breed: `${gateraMatch.raza} - ${gateraMatch.color}`,
          gender: gateraMatch.sexo,
          location: gateraMatch.ubicacion,
          status: "activo",
          hc: gateraMatch.hc,
          isFeral: gateraMatch.isFeral,
        };
        setCurrentAnimal(tempAnimal);
        setShelterEntries([
          {
            ubicacion: gateraMatch.ubicacion,
            microchip: gateraMatch.microchip,
            shortChip: gateraMatch.shortChip,
            descripcion: `${gateraMatch.nombre} (${gateraMatch.raza})`,
            medicacion: gateraMatch.medicacion,
            section: "GATERA" as any,
            pendientes: `HC: ${gateraMatch.hc}. ${gateraMatch.pendientes || ""}`,
            sistema: gateraMatch.sistema,
          },
        ]);
        setNotFound(false);
        setEditLocation(gateraMatch.ubicacion);
        setEditMedication(gateraMatch.medicacion || "");
        setEditPendientes(gateraMatch.pendientes || "");
      } else {
        const allRecords = await db.shelterRecords.toArray();
        const match = allRecords.find(
          (r) => r.microchip.includes(clean) || (r.shortChip && r.shortChip.includes(clean))
        );

        if (match) {
          const tempAnimal: Animal = {
            microchip: match.microchip,
            shortChip: match.shortChip,
            name: match.descripcion.split("(")[1]?.replace(")", "") || match.descripcion,
            species: "perro",
            breed: match.descripcion,
            gender: "macho",
            location: match.ubicacion,
            status: "activo",
          };
          setCurrentAnimal(tempAnimal);
          setShelterEntries([match]);
          setNotFound(false);
          setEditLocation(match.ubicacion);
          setEditMedication(match.medicacion || "");
          setEditPendientes(match.pendientes || "");
        } else {
          setCurrentAnimal(null);
          setShelterEntries([]);
          setNotFound(true);
          if (typeof window !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([300]);
          }
        }
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(chipInput);
  };

  const handleConfirmCensus = async () => {
    if (!currentAnimal) return;
    const nowIso = new Date().toISOString();
    const cleanChip = currentAnimal.microchip.trim().toUpperCase();
    const allCensus = await db.census.toArray();
    // Buscar coincidencia exacta o por sufijo/fragmento para evitar duplicar chips cortos
    const existing = allCensus.find(
      (c) => {
        const itemChip = c.microchip.trim().toUpperCase();
        return (
          itemChip === cleanChip ||
          (cleanChip.length >= 10 && cleanChip.endsWith(itemChip)) ||
          (itemChip.length >= 10 && itemChip.endsWith(cleanChip))
        );
      }
    );
    const area = currentAnimal.species === "gato" ? "gatera" : "caninos";
    const treatmentCount = shelterEntries.filter((e) => e.medicacion).length;

    if (existing?.id) {
      await db.census.update(existing.id, {
        microchip: cleanChip.length >= existing.microchip.length ? cleanChip : existing.microchip,
        animalName: currentAnimal.name,
        species: currentAnimal.species,
        location: currentAnimal.location,
        scannedAt: nowIso,
        scannedBy: currentUser?.name || "Operario de Campo",
        treatmentCount,
        area,
      });

      // Eliminar cualquier otro registro residual con el mismo chip
      const leftovers = allCensus.filter(
        (c) => c.id !== existing.id && (c.microchip.trim().toUpperCase() === cleanChip || cleanChip.endsWith(c.microchip.trim().toUpperCase()))
      );
      for (const left of leftovers) {
        if (left.id) await db.census.delete(left.id);
      }
    } else {
      await db.census.add({
        microchip: cleanChip,
        animalName: currentAnimal.name,
        species: currentAnimal.species,
        location: currentAnimal.location,
        scannedAt: nowIso,
        scannedBy: currentUser?.name || "Operario de Campo",
        treatmentCount,
        area,
      });
    }

    if (currentAnimal.id) {
      await db.animals.update(currentAnimal.id, { lastCensusDate: nowIso });
    }

    setCensusConfirmed(true);
    setFeedbackMessage(`✅ Censo registrado: ${currentAnimal.name} verificado en ${currentAnimal.location}`);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200]);
    }
  };

  const handleSaveQuickEdit = async () => {
    if (!currentAnimal) return;

    const isVetOrAdmin = currentUser?.role === "veterinario" || currentUser?.role === "admin";
    if (!isVetOrAdmin) {
      setFeedbackMessage("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para modificar o reubicar animales.");
      return;
    }

    const cleanChip = currentAnimal.microchip.trim();

    // Actualizar ubicación en db.animals
    if (currentAnimal.id) {
      await db.animals.update(currentAnimal.id, { location: editLocation });
    } else {
      const anim = await db.animals.where("microchip").equals(cleanChip).first();
      if (anim && anim.id) {
        await db.animals.update(anim.id, { location: editLocation });
      }
    }
    setCurrentAnimal({ ...currentAnimal, location: editLocation });

    if (currentAnimal.species === "gato") {
      // Actualizar en db.gateraRecords
      const catRecord = await db.gateraRecords.where("microchip").equals(cleanChip).first();
      if (catRecord && catRecord.id) {
        await db.gateraRecords.update(catRecord.id, {
          ubicacion: editLocation,
          medicacion: editMedication,
          pendientes: editPendientes,
        });
      }
      setShelterEntries([
        {
          ubicacion: editLocation,
          microchip: currentAnimal.microchip,
          shortChip: currentAnimal.shortChip || currentAnimal.microchip.slice(-7),
          descripcion: currentAnimal.name,
          medicacion: editMedication,
          section: "GATERA" as any,
          pendientes: editPendientes,
        },
      ]);
    } else {
      // Actualizar en db.shelterRecords (Caninos)
      const recordToUpdate = shelterEntries[0];
      if (recordToUpdate && recordToUpdate.id) {
        await db.shelterRecords.update(recordToUpdate.id, {
          ubicacion: editLocation,
          medicacion: editMedication,
          pendientes: editPendientes,
        });
        const updated = await db.shelterRecords.get(recordToUpdate.id);
        if (updated) setShelterEntries([updated]);
      } else {
        const dogRec = await db.shelterRecords.where("microchip").equals(cleanChip).first();
        if (dogRec && dogRec.id) {
          await db.shelterRecords.update(dogRec.id, {
            ubicacion: editLocation,
            medicacion: editMedication,
            pendientes: editPendientes,
          });
          const updated = await db.shelterRecords.get(dogRec.id);
          if (updated) setShelterEntries([updated]);
        }
      }
    }

    setIsEditing(false);
    setFeedbackMessage("💾 Datos del animal actualizados y sincronizados en la planilla.");
  };

  const handleExtendTreatment = async (kardexId?: number, extraDays: number = 7) => {
    if (!kardexId) return;
    const t = await db.kardex.get(kardexId);
    if (!t) return;
    const newTotales = (t.dosisTotales || 7) + extraDays;
    const newFaltantes = (t.dosisFaltantes || 0) + extraDays;
    await db.kardex.update(kardexId, {
      dosisTotales: newTotales,
      dosisFaltantes: newFaltantes,
      status: "activo",
    });
    setFeedbackMessage(`🩺 Tratamiento extendido +${extraDays} dosis/días.`);
    if (currentAnimal) {
      const updated = await db.kardex.where("microchip").equals(currentAnimal.microchip).toArray();
      setAnimalTreatments(updated);
    }
  };

  const handleDischargeTreatment = async (kardexId?: number) => {
    if (!kardexId) return;
    await db.kardex.update(kardexId, {
      status: "finalizado",
      dosisFaltantes: 0,
    });
    setFeedbackMessage("🩺 Alta médica otorgada. Tratamiento culminado al 100%.");
    if (currentAnimal) {
      const updated = await db.kardex.where("microchip").equals(currentAnimal.microchip).toArray();
      setAnimalTreatments(updated);
    }
  };

  const handleApplyVoiceIntent = async (intent: ParsedClinicalIntent) => {
    if (!currentAnimal) return;

    const targetLoc = intent.location || currentAnimal.location;
    const cleanChip = currentAnimal.microchip.trim();

    // Actualizar gateraRecords
    const catRecord = await db.gateraRecords.where("microchip").equals(cleanChip).first();
    if (catRecord && catRecord.id) {
      await db.gateraRecords.update(catRecord.id, {
        ubicacion: targetLoc,
        medicacion: intent.treatment || catRecord.medicacion,
        sistema: intent.system || catRecord.sistema,
        pendientes: intent.description || catRecord.pendientes,
        fechaFinal: intent.durationDays ? `+${intent.durationDays} días` : catRecord.fechaFinal,
      });
    }

    // Actualizar db.animals
    if (currentAnimal.id) {
      await db.animals.update(currentAnimal.id, {
        location: targetLoc,
        notes: intent.description ? `${currentAnimal.notes || ""}\n[VOZ IA]: ${intent.description}`.trim() : currentAnimal.notes,
      });
    }

    // Registrar en Kardex si tiene tratamiento
    if (intent.treatment) {
      const nowIso = new Date().toISOString();
      const duration = intent.durationDays || 7;
      await db.kardex.add({
        microchip: cleanChip,
        shortChip: currentAnimal.shortChip || cleanChip.slice(-7),
        system: intent.system || "PREVENTIVO",
        treatment: intent.treatment,
        description: intent.description || "Prescrito por Asistente de Voz IA",
        startDate: nowIso.split("T")[0],
        endDate: new Date(Date.now() + duration * 86400000).toISOString().split("T")[0],
        status: "activo",
        prescribedBy: currentUser?.name ? `Dr. ${currentUser.name} (IA)` : "Dra. Jenny Zapata Calle (IA)",
        createdAt: nowIso,
        area: "gatera",
        dosisTotales: duration,
        dosisAplicadas: 0,
        dosisFaltantes: duration,
      });
    }

    handleSearch(currentAnimal.microchip);
    setFeedbackMessage(`✨ Nota clínica de voz procesada por IA: "${intent.treatment || intent.description}"`);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Barra de Escaneo con W91A */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Lector W91A (Bluetooth HID) Listo
            </span>
          </div>
          <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
            Escaneo instantáneo
          </span>
        </div>

        <form onSubmit={handleManualSubmit} className="relative">
          <input
            ref={inputRef}
            data-chip-scanner="true"
            type="text"
            value={chipInput}
            onChange={(e) => setChipInput(e.target.value)}
            placeholder="Acerque el W91A al chip del animal..."
            autoFocus
            autoComplete="off"
            className="w-full text-xl sm:text-2xl font-mono tracking-wider text-center py-4 px-12 border-2 border-indigo-500 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-bold"
          />
          <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600 w-6 h-6" />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
          >
            Buscar
          </button>
        </form>

        {/* Indicador de compatibilidad de hardware real W91A */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <Scan className="w-3.5 h-3.5 text-indigo-600" />
            Lector Sycreader W91A
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            ISO 11784/11785 (15 dígitos) • Sufijos 7d • FDX-B / Hex
          </span>
        </div>

        {/* Botón de Descarga / Subida en Masa de Memoria W91A */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>¿Escaneaste en zonas sin señal con memoria W91A?</span>
          </div>
          <button
            type="button"
            onClick={() => setIsBatchOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Layers className="w-4 h-4 text-indigo-200" />
            <span>SUBIR MEMORIA W91A (HASTA 128 CHIPS)</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-sm font-bold flex items-center justify-between animate-in fade-in">
          <span>{feedbackMessage}</span>
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 ml-2" />
        </div>
      )}

      {/* 2. Tarjeta del Animal Encontrado con Datos del Excel */}
      {currentAnimal && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
          {/* ALERTAS DE BIOSEGURIDAD CRÍTICA */}
          {(() => {
            const isCDV =
              currentAnimal.species === "perro" &&
              (currentAnimal.notes?.toUpperCase().includes("CDV") ||
                currentAnimal.breed?.toUpperCase().includes("CDV") ||
                shelterEntries.some((e) => e.section === "CDV"));
            const isCuarentena = currentAnimal.location?.toUpperCase().includes("CUARENTENA");
            const isFeral = Boolean(currentAnimal.isFeral);

            return (
              <div className="space-y-2">
                {isCDV && (
                  <div className="p-3.5 bg-red-100 border-2 border-red-600 rounded-2xl flex items-center gap-3 text-red-950 animate-bounce">
                    <ShieldAlert className="w-6 h-6 text-red-700 shrink-0" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        ☣️ BIOSEGURIDAD NIVEL 3: POSITIVO PARA DISTEMPER (CDV)
                      </span>
                      <span className="text-[11px] font-bold text-red-800">
                        Aislamiento estricto obligatorio. Prohibido contacto con otros caninos. Desinfección rigurosa.
                      </span>
                    </div>
                  </div>
                )}

                {isFeral && (
                  <div className="p-3.5 bg-red-50 border-2 border-red-500 rounded-2xl flex items-center gap-3 text-red-900 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        ⚠️ ALERTA DE MANEJO: FELINO FERAL (REACTIVO)
                      </span>
                      <span className="text-[11px] text-red-700">
                        Obligatorio: utilizar guantes de carnaza y toalla de contención antes de abrir la jaula.
                      </span>
                    </div>
                  </div>
                )}

                {isCuarentena && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-500 rounded-2xl flex items-center gap-3 text-amber-950">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        🛑 ÁREA RESTRINGIDA DE CUARENTENA
                      </span>
                      <span className="text-[11px] text-amber-800">
                        En observación clínica preventiva. Prohibido traslado a patios sin autorización médica.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Encabezado Animal */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-slate-900">{currentAnimal.name}</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    currentAnimal.species === "gato"
                      ? "bg-purple-100 text-purple-900 border border-purple-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {currentAnimal.species === "gato" ? "🐱 GATERA" : "🐶 CANINO"}
                </span>
                {currentAnimal.hc && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                    HC: {currentAnimal.hc}
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-500 mt-0.5 tracking-wider">
                Chip: <strong>{currentAnimal.shortChip || currentAnimal.microchip}</strong>
              </p>
              <p className="text-xs text-slate-700 font-medium mt-1">{currentAnimal.breed}</p>
            </div>

            {/* Ubicación Actual */}
            <div className="px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col items-center shrink-0">
              <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1">
                <MapPin className="w-3 h-3" /> UBICACIÓN
              </span>
              <span className="text-base font-black text-indigo-900 text-center">{currentAnimal.location}</span>
            </div>
          </div>

          {/* Información Clínica de la Planilla Real */}
          <div className="space-y-2">
            {shelterEntries.length > 0 ? (
              shelterEntries.map((entry, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black uppercase tracking-wider text-indigo-700">
                      [{entry.section}] {entry.sistema ? `• ${entry.sistema}` : ""}
                    </span>
                    {entry.tipo && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                        Frecuencia: {entry.tipo}
                      </span>
                    )}
                  </div>

                  {entry.medicacion && (
                    <div className="text-xs text-slate-900 bg-white p-3 rounded-xl border border-slate-100 font-medium">
                      <strong className="text-slate-800 block text-xs mb-0.5">💊 Medicación prescrita:</strong>
                      {entry.medicacion}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                    {entry.fechaFinal && (
                      <span>
                        Fecha Fin: <strong>{entry.fechaFinal}</strong>
                      </span>
                    )}
                    {entry.dosisBravecto && (
                      <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded">
                        Bravecto Dosis: {entry.dosisBravecto}
                      </span>
                    )}
                    {entry.pendientes && (
                      <span className="text-red-700 font-bold bg-red-100 px-2.5 py-0.5 rounded-full">
                        Pendiente: {entry.pendientes}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 bg-slate-50 rounded-2xl text-xs text-slate-500">
                Sin medicación activa registrada en la planilla.
              </div>
            )}
          </div>

          {/* Desparasitación Felina Oficial (Revolution Plus / Feline Full Spot / Total FCG) */}
          <div className="p-4 bg-purple-50/80 border-2 border-purple-200 rounded-2xl space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-black text-purple-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                <Pill className="w-4 h-4 text-purple-600" /> Plan Sanitario & Desparasitación Felina
              </span>
              <span className="px-2.5 py-0.5 bg-purple-200 text-purple-900 rounded-full text-xs font-black">
                Revolution Plus / Full Spot
              </span>
            </div>
            <p className="text-xs text-purple-800">
              Protocolo Gatera CBA La Perla: Control endo/ectoparásitos felinos (Selamectina / Fipronil).
            </p>
            <button
              type="button"
              onClick={async () => {
                setFeedbackMessage(
                  `💊 Desparasitante felino (Revolution Plus) registrado con éxito para ${currentAnimal.name}`
                );
                if (typeof window !== "undefined" && "vibrate" in navigator) {
                  navigator.vibrate([150, 50, 150]);
                }
              }}
              className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> REGISTRAR APLICACIÓN DE DESPARASITANTE HOY
            </button>
          </div>

          {/* Modo de Edición Rápida en Campo (EXCLUSIVO MÉDICOS VETERINARIOS Y ADMIN) */}
          {(currentUser?.role === "veterinario" || currentUser?.role === "admin") && (
            isEditing ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 text-xs animate-in fade-in">
                <h4 className="font-bold text-amber-900 uppercase">Modificar Datos de este Animal (Vet/Admin)</h4>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mover a Nueva Ubicación:</label>
                  <input
                    type="text"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Modificar Medicación:</label>
                  <textarea
                    rows={2}
                    value={editMedication}
                    onChange={(e) => setEditMedication(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Modificar Pendientes:</label>
                  <input
                    type="text"
                    value={editPendientes}
                    onChange={(e) => setEditPendientes(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="w-1/2 py-2.5 bg-slate-200 rounded-xl font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveQuickEdit}
                    className="w-1/2 py-2.5 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 shadow-md"
                  >
                    <Save className="w-4 h-4" /> Guardar en Planilla
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Modificar o reubicar animal (Vet/Admin)
                </button>
              </div>
            )
          )}

          {/* 2.5 Semáforo Clínico de Tratamientos y Control de Vencimientos */}
          {animalTreatments.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-indigo-600" /> Semáforo Clínico de Tratamientos
                </span>
                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                  {animalTreatments.length} prescripciones
                </span>
              </div>

              <div className="space-y-2">
                {animalTreatments.map((t) => {
                  const isExpiredOrDone = t.status === "finalizado" || t.dosisFaltantes === 0;
                  const isUrgent = t.status === "activo" && t.dosisFaltantes === 1;

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                        isExpiredOrDone
                          ? "bg-red-50/70 border-red-200"
                          : isUrgent
                          ? "bg-amber-50 border-amber-300"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isExpiredOrDone
                                ? "bg-red-500"
                                : isUrgent
                                ? "bg-amber-500 animate-pulse"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span className="font-bold text-slate-900">{t.treatment}</span>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                              isExpiredOrDone
                                ? "bg-red-200 text-red-900"
                                : isUrgent
                                ? "bg-amber-200 text-amber-950 font-black"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isExpiredOrDone
                              ? "🔴 Culminado / Requiere Alta"
                              : isUrgent
                              ? "🟡 Última Dosis Hoy"
                              : "🟢 En Curso"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Dosis: <strong>{t.dosisAplicadas}</strong> / {t.dosisTotales} • Faltan:{" "}
                          <strong>{t.dosisFaltantes}</strong> • Vence: {t.endDate || "HNI"}
                        </span>
                      </div>

                      {(currentUser?.role === "veterinario" || currentUser?.role === "admin") && t.status === "activo" && (
                        <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleExtendTreatment(t.id, 7)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg font-black text-[10px] border border-indigo-200 active:scale-95"
                            title="Extender 7 días adicionales"
                          >
                            +7 Días
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDischargeTreatment(t.id)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-black text-[10px] border border-emerald-200 active:scale-95"
                            title="Culminar tratamiento y dar alta médica"
                          >
                            Dar Alta
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. BOTONES DE ACCIÓN RÁPIDA (Flujo ergonómico) */}
          <div className="space-y-2.5 pt-2">
            {/* Botón Principal: ASIGNAR ANIMAL */}
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="btn-touch w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-500 hover:to-indigo-600 text-white flex items-center justify-center gap-2.5 shadow-xl shadow-teal-700/25 active:scale-95 transition-all"
            >
              <UserCheck className="w-5 h-5 text-emerald-200" />
              <span>🐾 ASIGNAR ESTE ANIMAL A OPERARIO / AUXILIAR</span>
            </button>

            {/* Botón de Impresión de Ficha y QR de Canil */}
            <button
              type="button"
              onClick={() => setIsCanilCardOpen(true)}
              className="btn-touch w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-950/20 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4 text-indigo-300" />
              <span>🖨️ IMPRIMIR FICHA DE CANIL & CÓDIGO QR</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleConfirmCensus}
                disabled={censusConfirmed}
                className={`btn-touch w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                  censusConfirmed
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-95"
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                {censusConfirmed ? "CENSO REGISTRADO" : "CONFIRMAR CENSO OK"}
              </button>

              <button
                type="button"
                onClick={() => setIsVoiceOpen(true)}
                className="btn-touch w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
              >
                <Mic className="w-5 h-5" />
                <span>DICTAR POR VOZ (IA)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chip No Encontrado - Opción de Registro Completo en Base de Datos y Censo */}
      {notFound && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-amber-300 text-center space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-3xl flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full inline-block mb-1.5">
              MICROCHIP NO REGISTRADO EN EL CENSO
            </span>
            <h3 className="text-xl font-mono font-black text-slate-900 tracking-wider">
              {chipInput}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Este animal no figura en el censo ni en las planillas oficiales. Puedes registrarlo con todos sus datos clínicos, ubicación física y medicación.
            </p>
          </div>

          <div className="space-y-2.5 pt-1 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                setPreselectedSpecies("gato");
                setIsRegisterOpen(true);
              }}
              className="btn-touch w-full py-4 px-5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-purple-700/25 active:scale-95 transition-all"
            >
              <PlusCircle className="w-5 h-5 text-purple-200" />
              <span>🐱 INGRESAR FELINO EN CENSO GATERA (24 COLUMNAS)</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Voz IA */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        currentMicrochip={currentAnimal?.microchip}
        onApplyIntent={handleApplyVoiceIntent}
      />

      {/* Modal de Asignación de Animal a Operario / Auxiliar */}
      {currentAnimal && (
        <AssignAnimalModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          initialAnimal={{
            microchip: currentAnimal.microchip,
            name: currentAnimal.name,
            location: currentAnimal.location,
            species: currentAnimal.species === "gato" ? "gato" : "perro",
            isFeral: currentAnimal.isFeral,
            medication: shelterEntries[0]?.medicacion,
            notes: shelterEntries[0]?.pendientes,
          }}
          userArea={currentUser?.area || (currentAnimal.species === "gato" ? "gatera" : "caninos")}
          onSuccess={(task) => {
            setFeedbackMessage(`🐾 ${currentAnimal.name} asignado a ${task.assignedTo} para turno ${task.shift}`);
            if (typeof window !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate([100, 50, 100]);
            }
          }}
        />
      )}

      {/* Modal de Subida en Masa de Memoria W91A */}
      <BatchScannerModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        currentUser={currentUser}
        onBatchProcessed={(stats) => {
          setFeedbackMessage(
            `⚡ Lote W91A completado: ${stats.total} leídos, ${stats.censused} censados, ${stats.medicated} medicaciones aplicadas.`
          );
        }}
      />

      {/* Modal de Ficha Médica de Canil & Código QR Imprimible */}
      {currentAnimal && (
        <CanilCardModal
          isOpen={isCanilCardOpen}
          onClose={() => setIsCanilCardOpen(false)}
          animal={currentAnimal}
          treatments={animalTreatments}
          location={currentAnimal.location}
          notes={shelterEntries[0]?.pendientes}
        />
      )}

      {/* Modal de Registro Completo de Animal Nuevo en Sistema y Censo */}
      <RegisterNewAnimalModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialMicrochip={chipInput}
        defaultArea={preselectedSpecies === "gato" ? "gatera" : "caninos"}
        currentUser={currentUser}
        onAnimalRegistered={(animal) => {
          setNotFound(false);
          setFeedbackMessage(
            `✨ ¡${animal.name} (${animal.species === "gato" ? "Felino" : "Canino"}) registrado y censado exitosamente en ${animal.location}!`
          );
          handleSearch(animal.microchip);
        }}
      />
    </div>
  );
};
