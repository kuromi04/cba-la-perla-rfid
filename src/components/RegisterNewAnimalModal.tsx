"use client";
import React, { useState, useEffect, useRef } from "react";
import { db, Animal } from "@/lib/db";
import { GateraCat } from "@/lib/gateraData";
import { StaffMember, canEditAnimals } from "@/lib/staff";
import {
  X,
  PlusCircle,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  Pill,
  CheckCircle2,
  FileSpreadsheet,
  ArrowUp,
  Sparkles,
  Stethoscope,
  Scissors,
  Camera,
  Trash2,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { compressImageFile } from "@/lib/imageUtils";
import { recordAudit } from "@/lib/audit";
import { OFFICIAL_GATERA_LOCATIONS, getAllGateraLocations } from "@/lib/gateraLocations";
import { OFFICIAL_GATERA_COLORS, POPULAR_GATERA_COLORS } from "@/lib/gateraColors";

interface RegisterNewAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMicrochip: string;
  defaultArea?: "gatera";
  currentUser?: StaffMember | null;
  onAnimalRegistered: (animal: Animal) => void;
}

export const RegisterNewAnimalModal: React.FC<RegisterNewAnimalModalProps> = ({
  isOpen,
  onClose,
  initialMicrochip,
  currentUser,
  onAnimalRegistered,
}) => {
  const [microchip, setMicrochip] = useState(initialMicrochip);
  const [location, setLocation] = useState(""); // Columna B: Nº CANIL / JAULA
  const [hc, setHc] = useState(""); // Columna 3: HISTORIA CLINICA
  const [sexoCode, setSexoCode] = useState<"HFA" | "MFA" | "HFC" | "MFC">("MFA"); // Columna 4: A
  const [raza, setRaza] = useState("DPC"); // Columna 5: RAZA
  const [isFeral, setIsFeral] = useState(false); // Columna 6: FERALES (SI/NO)
  const [color, setColor] = useState(""); // Columna 7: COLOR
  const [tipoIngreso, setTipoIngreso] = useState("RES"); // Columna 8: TIPO DE INGRESO
  const [name, setName] = useState(""); // Nombre del felino (opcional)
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [edadMeses, setEdadMeses] = useState("24 MESES"); // Columna 10
  const [fechaIngreso, setFechaIngreso] = useState(() => new Date().toISOString().split("T")[0]); // Columna 11
  const [condicionCorporal, setCondicionCorporal] = useState("RANGO 3.0/5"); // Columna 12
  const [estadoSalud, setEstadoSalud] = useState("Saludable"); // Columna 13: Saludable, Regular, Delicado
  
  // Diagnóstico Retroviral Felino: VIF (Inmunodeficiencia) y FeLV (Leucemia)
  const [vifStatus, setVifStatus] = useState<"NEGATIVO" | "POSITIVO" | "PENDIENTE">("NEGATIVO");
  const [felvStatus, setFelvStatus] = useState<"NEGATIVO" | "POSITIVO" | "PENDIENTE">("NEGATIVO");
  const [hasTreatment, setHasTreatment] = useState(false);
  const [medicacion, setMedicacion] = useState("");
  const [observacionesMedicas, setObservacionesMedicas] = useState("");
  const [requiereSeguimiento, setRequiereSeguimiento] = useState<"SI" | "NO">("NO");
  const [tipoSeguimiento, setTipoSeguimiento] = useState("TRATAMIENTO");
  const [sistema, setSistema] = useState("PREVENTIVO");
  const [totalDoses, setTotalDoses] = useState(7);

  // Aseo & Bienestar (Columnas 19, 20, 21, 22)
  const [peluqueria, setPeluqueria] = useState("NO");
  const [corteUnas, setCorteUnas] = useState("NO");
  const [limpiezaOidos, setLimpiezaOidos] = useState("NO");

  // Médico Veterinario (Columna 23)
  const [medicoVeterinario, setMedicoVeterinario] = useState(
    currentUser?.name ? `Dr. ${currentUser.name}` : "Dra. Jenny Zapata Calle"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fotografía del Felino
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [allLocations, setAllLocations] = useState<string[]>(OFFICIAL_GATERA_LOCATIONS);
  const [selectedLocCategory, setSelectedLocCategory] = useState<string>("CUARENTENA");

  useEffect(() => {
    if (initialMicrochip) {
      const chip = initialMicrochip.trim();
      setMicrochip(chip);
      db.animals.where("microchip").equals(chip).first().then((ex) => {
        if (ex?.photoUrl) {
          setPhotoUrl(ex.photoUrl);
        }
      });
    }
  }, [initialMicrochip]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsCompressingPhoto(true);
    try {
      const compressedBase64 = await compressImageFile(file, 800, 0.75);
      setPhotoUrl(compressedBase64);
    } catch (err) {
      console.error("Error al procesar fotografía:", err);
      alert("No se pudo procesar la imagen seleccionada.");
    } finally {
      setIsCompressingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl("");
    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  useEffect(() => {
    if (isOpen) {
      getAllGateraLocations().then((locs) => {
        if (locs && locs.length > 0) {
          setAllLocations(locs);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanChip = microchip.trim();
    if (!cleanChip) {
      setErrorMessage("El número de microchip es obligatorio.");
      scrollToTop();
      return;
    }
    if (!location.trim()) {
      setErrorMessage("Por favor ingresa la ubicación o Nº Canil/Jaula (Columna B de la Hoja de Censo).");
      scrollToTop();
      return;
    }
    const isAuthorized = currentUser ? canEditAnimals(currentUser.role) : false;

    // REGLA DE ORO: Si el animal ya existe, SOLO médicos y admin pueden editarlo o cambiar sus datos
    const existingAnimal = await db.animals.where("microchip").equals(cleanChip).first();
    if (existingAnimal && !isAuthorized) {
      setErrorMessage(
        `⛔ Regla de Oro: El microchip ${cleanChip} ya está registrado en el sistema a nombre de ${existingAnimal.name || "S/N"} (${existingAnimal.location}). Solo Médicos Veterinarios y Administradores pueden modificar animales existentes.`
      );
      scrollToTop();
      return;
    }

    // REGLA DE ORO: Solo médicos y admin pueden prescribir medicaciones
    if (hasTreatment && medicacion.trim() && !isAuthorized) {
      setErrorMessage(
        `⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para prescribir tratamientos y medicaciones.`
      );
      scrollToTop();
      return;
    }

    setIsSubmitting(true);

    try {
      const shortChip = cleanChip.length > 7 ? cleanChip.slice(-7) : cleanChip;
      const formattedName = name.trim() ? name.trim().toUpperCase() : "S/N";
      const formattedLocation = location.trim().toUpperCase();
      const formattedRaza = raza.trim().toUpperCase() || "DPC";
      const formattedColor = color.trim().toUpperCase() || "COMÚN";
      const formattedHc = hc.trim() ? hc.trim().toUpperCase() : shortChip.slice(-5);
      const isFemale = sexoCode.startsWith("H");
      const isAdult = sexoCode.endsWith("A");
      const gender = isFemale ? "hembra" : "macho";
      const nowIso = new Date().toISOString();

      const computedRetro: "NEGATIVO" | "VIF_POSITIVO" | "FELV_POSITIVO" | "DOBLE_POSITIVO" | "PENDIENTE" =
        vifStatus === "POSITIVO" && felvStatus === "POSITIVO"
          ? "DOBLE_POSITIVO"
          : vifStatus === "POSITIVO"
          ? "VIF_POSITIVO"
          : felvStatus === "POSITIVO"
          ? "FELV_POSITIVO"
          : (vifStatus === "PENDIENTE" || felvStatus === "PENDIENTE")
          ? "PENDIENTE"
          : "NEGATIVO";

      const retroviralTag =
        computedRetro === "DOBLE_POSITIVO"
          ? "[⚠️ DOBLE POSITIVO: VIF+ FeLV+]"
          : computedRetro === "VIF_POSITIVO"
          ? "[🩸 VIF+ POSITIVO (Inmunodeficiencia)]"
          : computedRetro === "FELV_POSITIVO"
          ? "[🩸 FeLV+ POSITIVO (Leucemia)]"
          : computedRetro === "PENDIENTE"
          ? "[⏳ SEROLOGÍA PENDIENTE]"
          : "[🛡️ VIF- FeLV- NEGATIVO]";

      const compiledNotes = [
        retroviralTag,
        observacionesMedicas.trim(),
        hasTreatment ? `Tratamiento: ${medicacion.trim()} (${sistema})` : "",
        isFeral ? "⚠️ MANEJO FERAL / GUANTES OBLIGATORIOS" : "",
      ]
        .filter(Boolean)
        .join(" | ");

      // 1. Guardar o Actualizar en tabla central: db.animals
      const finalAnimal: Animal = {
        id: existingAnimal?.id,
        microchip: cleanChip,
        shortChip,
        name: formattedName !== "S/N" ? formattedName : (existingAnimal?.name || "S/N"),
        species: "gato",
        breed: `${formattedRaza} - ${formattedColor}`,
        gender,
        location: formattedLocation,
        status: formattedLocation === "FALLECIDO" ? "fallecido" : (estadoSalud.toLowerCase().includes("delicado") ? "cuarentena" : "activo"),
        fechaFallecimiento: formattedLocation === "FALLECIDO" ? nowIso : undefined,
        causaFallecimiento: formattedLocation === "FALLECIDO" ? (compiledNotes || "Reportado como fallecido en registro") : undefined,
        ubicacionPrevia: formattedLocation === "FALLECIDO" ? (existingAnimal?.location || "GATERA") : undefined,
        hc: formattedHc,
        isFeral,
        color: formattedColor,
        tipoIngreso,
        notes: compiledNotes || existingAnimal?.notes || undefined,
        lastCensusDate: nowIso,
        sexoCode,
        condicionCorporal,
        observacionesMedicas: compiledNotes,
        tipoSeguimiento: hasTreatment || requiereSeguimiento === "SI" ? tipoSeguimiento : undefined,
        medicoVeterinario,
        retroviralStatus: computedRetro,
        vifStatus,
        felvStatus,
        photoUrl: photoUrl || existingAnimal?.photoUrl || undefined,
        createdBy: existingAnimal?.createdBy || currentUser?.name || "Personal CBA La Perla",
        createdById: existingAnimal?.createdById || currentUser?.id || "anon_user",
        createdAt: existingAnimal?.createdAt || nowIso,
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      };

      if (existingAnimal?.id) {
        await db.animals.update(existingAnimal.id, finalAnimal);
      } else {
        const newId = await db.animals.add(finalAnimal);
        finalAnimal.id = newId;
      }

      // 2. Guardar o Actualizar en la Planilla Maestra de Gatera (24 columnas)
      const existingGatera = await db.gateraRecords.where("microchip").equals(cleanChip).first();
      const gateraEntry: GateraCat = {
        id: existingGatera?.id,
        ubicacion: formattedLocation, // Columna B
        status: formattedLocation === "FALLECIDO" ? "fallecido" : "activo",
        fechaFallecimiento: formattedLocation === "FALLECIDO" ? nowIso : undefined,
        causaFallecimiento: formattedLocation === "FALLECIDO" ? (compiledNotes || "Reportado como fallecido en registro") : undefined,
        ubicacionPrevia: formattedLocation === "FALLECIDO" ? (existingGatera?.ubicacion || existingAnimal?.location || "GATERA") : undefined,
        microchip: cleanChip,
        shortChip,
        hc: formattedHc,
        sexoCode,
        sexo: gender,
        grupoEdad: isAdult ? "adulto" : "cachorro",
        raza: formattedRaza,
        isFeral,
        color: formattedColor,
        tipoIngreso,
        fechaNacimiento: fechaNacimiento || undefined,
        edad: edadMeses || "24 MESES",
        fechaIngreso: fechaIngreso || nowIso.split("T")[0],
        condicionCorporal,
        estadoSalud,
        medicacion: hasTreatment ? medicacion.trim() : "Ninguno",
        observacionesMedicas: compiledNotes,
        requiereSeguimiento: hasTreatment || requiereSeguimiento === "SI" ? "SI" : "NO",
        tipoSeguimiento: hasTreatment || requiereSeguimiento === "SI" ? tipoSeguimiento : "NO REQUIERE",
        fechaSeguimiento: hasTreatment ? nowIso.split("T")[0] : undefined,
        peluqueria,
        corteUnas,
        limpiezaOidos,
        fechaAseo: (peluqueria === "SI" || corteUnas === "SI" || limpiezaOidos === "SI") ? nowIso.split("T")[0] : undefined,
        medicoVeterinario,
        nombre: formattedName,
        descripcion: `${formattedName} (${formattedRaza} - ${formattedColor})`,
        pendientes: compiledNotes || "INGRESO NUEVO GATERA",
        sistema: hasTreatment ? sistema : "PREVENTIVO",
        fechaFinal: hasTreatment ? `+${totalDoses} días` : "HNI",
        tipo: "FS",
        desparasitante: "AL DÍA (FELINO)",
        photoUrl: photoUrl || existingGatera?.photoUrl || existingAnimal?.photoUrl || undefined,
        createdBy: existingGatera?.createdBy || currentUser?.name || "Personal CBA La Perla",
        createdById: existingGatera?.createdById || currentUser?.id || "anon_user",
        createdAt: existingGatera?.createdAt || nowIso,
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      };

      if (existingGatera?.id) {
        await db.gateraRecords.update(existingGatera.id, gateraEntry);
      } else {
        await db.gateraRecords.add(gateraEntry);
      }

      // 3. Registrar o Actualizar en el Censo Automático
      const allCensus = await db.census.toArray();
      const existingCensus = allCensus.find((c) => {
        const itemChip = c.microchip.trim().toUpperCase();
        return (
          itemChip === cleanChip ||
          (cleanChip.length >= 10 && cleanChip.endsWith(itemChip)) ||
          (itemChip.length >= 10 && itemChip.endsWith(cleanChip))
        );
      });

      const censusPayload = {
        microchip: cleanChip,
        animalName: formattedName,
        species: "gato" as const,
        location: formattedLocation,
        scannedAt: nowIso,
        scannedBy: currentUser?.name || "Operario Gatera",
        treatmentCount: hasTreatment ? 1 : 0,
        area: "gatera" as const,
        hc: formattedHc,
        sexoCode,
        raza: formattedRaza,
        isFeral,
        color: formattedColor,
        tipoIngreso,
        edad: edadMeses,
        condicionCorporal,
        estadoSalud,
        medicacion: hasTreatment ? medicacion.trim() : undefined,
        observacionesMedicas: compiledNotes,
        requiereSeguimiento: hasTreatment || requiereSeguimiento === "SI" ? "SI" : "NO",
        tipoSeguimiento,
        peluqueria,
        corteUnas,
        limpiezaOidos,
        medicoVeterinario,
        retroviralStatus: computedRetro,
        vifStatus,
        felvStatus,
      };

      if (formattedLocation === "FALLECIDO") {
        // REGLA: Los felinos fallecidos se descuentan del censo activo inmediatamente
        if (existingCensus?.id) {
          await db.census.delete(existingCensus.id);
        }
      } else {
        if (existingCensus?.id) {
          await db.census.update(existingCensus.id, censusPayload);
          // Depurar duplicados residuales
          const leftovers = allCensus.filter(
            (c) => c.id !== existingCensus.id && (c.microchip.trim().toUpperCase() === cleanChip || cleanChip.endsWith(c.microchip.trim().toUpperCase()))
          );
          for (const left of leftovers) {
            if (left.id) await db.census.delete(left.id);
          }
        } else {
          await db.census.add(censusPayload);
        }
      }

      // 4. Si tiene tratamiento activo prescrito por Médico/Admin, registrarlo en el Kardex
      if (hasTreatment && medicacion.trim()) {
        const kardexId = await db.kardex.add({
          microchip: cleanChip,
          shortChip,
          system: sistema,
          treatment: medicacion.trim(),
          description: compiledNotes || "Prescripción al ingreso en Gatera",
          startDate: nowIso.split("T")[0],
          endDate: new Date(Date.now() + totalDoses * 86400000).toISOString().split("T")[0],
          status: "activo",
          prescribedBy: medicoVeterinario,
          createdAt: nowIso,
          area: "gatera",
          dosisTotales: Number(totalDoses) || 7,
          dosisAplicadas: 0,
          dosisFaltantes: Number(totalDoses) || 7,
        });

        // Crear tarea de turno para que los auxiliares/operarios puedan administrarlo hoy
        if (formattedLocation !== "FALLECIDO") {
          await db.shiftTasks.add({
            microchip: cleanChip,
            animalName: finalAnimal.name,
            location: formattedLocation,
            species: "gato",
            laborType: "medicacion",
            shift: "mañana",
            isCompleted: false,
            medication: medicacion.trim(),
            scheduledDate: nowIso.split("T")[0],
            area: "gatera",
            kardexId: Number(kardexId),
            dosisTotales: Number(totalDoses) || 7,
            dosisAplicadas: 0,
            dosisFaltantes: Number(totalDoses) || 7,
            isFeral,
            notes: compiledNotes || "Prescripción de ingreso",
          });
        }
      }

      // Sincronizar inmediatamente a la nube Supabase si hay conexión
      if (typeof window !== "undefined" && navigator.onLine) {
        try {
          const { syncAnimalToSupabase } = await import("@/lib/supabase");
          syncAnimalToSupabase(finalAnimal).catch((e) =>
            console.warn("Error syncAnimalToSupabase en registro:", e)
          );
        } catch (e) {
          console.warn("Error al importar supabase en registro:", e);
        }
      }

      // Feedback háptico
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([30, 50, 30]);
      }

      // Registrar log de auditoría con autor y fecha exacta
      await recordAudit({
        action: existingAnimal?.id ? "MODIFICACION_ANIMAL" : "REGISTRO_ANIMAL",
        microchip: cleanChip,
        animalName: formattedName,
        location: formattedLocation,
        details: existingAnimal?.id
          ? `Ficha actualizada en ${formattedLocation} (${formattedColor}) por ${currentUser?.name || "Personal"}`
          : `Nuevo ingreso felino registrado en ${formattedLocation} (${formattedColor}) por ${currentUser?.name || "Personal"}`,
        user: currentUser,
      });

      onAnimalRegistered(finalAnimal);
      onClose();
    } catch (err: any) {
      console.error("Error al registrar felino:", err);
      setErrorMessage(`Error al guardar: ${err?.message || "Error desconocido en base de datos"}`);
      scrollToTop();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm p-2 sm:p-4 flex items-center justify-center overscroll-contain">
      {/* DATALISTS DINÁMICOS PARA AUTOCOMPLETADO RÁPIDO */}
      <datalist id="locations-list">
        {allLocations.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>

      <datalist id="colors-list">
        {OFFICIAL_GATERA_COLORS.map((col) => (
          <option key={col} value={col} />
        ))}
      </datalist>

      <datalist id="vets-list">
        <option value="Dra. Jenny Zapata Calle" />
        <option value="Dr. Juan Carlos Arango" />
        <option value="Dra. Marcela Restrepo" />
        <option value="Dr. Carlos Gómez" />
      </datalist>

      <datalist id="felinos-meds-list">
        <option value="REVOLUTION PLUS (SELAMECTINA)" />
        <option value="FELINE FULL SPOT" />
        <option value="CONVENIA (CEFOVECINA)" />
        <option value="DOXI 100MG C/24H" />
        <option value="COLIRIO CIPROFLOXACINA C/8H" />
        <option value="CAT BALANCE SUPL. NUTRICIONAL" />
        <option value="MELOXICAM FELINO 0.1MG/KG" />
        <option value="ENROFLOXACINA 50MG" />
      </datalist>

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-auto flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        
        {/* Cabecera Fija del Modal */}
        <div className="p-4 bg-purple-950 text-white flex items-center justify-between border-b border-purple-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base leading-tight">
                  Nuevo Felino en Censo GATERA
                </h3>
                <span className="px-2 py-0.5 bg-purple-800 text-purple-200 rounded-md text-[10px] font-black">
                  24 COLUMNAS
                </span>
              </div>
              <p className="text-[11px] text-purple-300">
                Se registrará en el Censo Maestro de GATERA y la base de datos oficial
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-purple-300 hover:text-white rounded-xl hover:bg-purple-900 transition-all"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario con Scroll Suave */}
        <div
          ref={scrollContainerRef}
          className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1 overscroll-contain pb-6"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-2xl flex items-center gap-2 font-bold animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Microchip */}
          <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl">
            <label className="font-black text-purple-950 block mb-1 text-[11px] uppercase tracking-wider">
              NÚMERO DE MICROCHIP (LEÍDO CON W91A O MANUAL): <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={microchip}
              onChange={(e) => setMicrochip(e.target.value)}
              placeholder="Ej: 991003003806096 o 3806096"
              className="w-full p-2.5 font-mono text-sm font-black text-purple-950 bg-white border border-purple-300 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-xs"
            />
          </div>

          {/* 2. Columna B: Nº CANIL / JAULA / UBICACIÓN GATERA */}
          <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-black text-indigo-950 block text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-600" />
                UBICACIÓN EN GATERA (Nº CANIL / JAULA - COLUMNA B): <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                {allLocations.length} Ubicaciones
              </span>
            </div>
            
            <input
              type="text"
              required
              list="locations-list"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ej: CUARENTENA 1, UPH 11, HOSPITAL 5, MATERNAS 13... (o escribe una nueva)"
              className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl font-bold uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />

            {/* Aviso de Nueva Ubicación Libre */}
            <p className="text-[10px] text-indigo-700 font-medium leading-tight">
              💡 Puedes seleccionar cualquiera de la lista o <strong>escribir una ubicación totalmente nueva</strong> (ej. CUARENTENA 20, UPH 33). El sistema la registrará y guardará automáticamente.
            </p>

            {/* Categorías Rápidas de Ubicación */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] text-slate-600 font-bold block uppercase tracking-wider">
                Selección Rápida por Sección Oficial:
              </span>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: "🛑 Cuarentenas", prefix: "CUARENTENA" },
                  { label: "🩺 UPH", prefix: "UPH" },
                  { label: "🏥 Hospital", prefix: "HOSPITAL" },
                  { label: "🍼 Maternas", prefix: "MATERN" },
                  { label: "🌳 Patios", prefix: "PATIO" },
                  { label: "⚠️ Ferales", prefix: "FERAL" },
                  { label: "🧪 VIF/FeLV", prefix: "VIF" },
                  { label: "📦 Jaulas", prefix: "JAULA" },
                  { label: "🕊️ Fallecidos", prefix: "FALLECIDO" },
                ].map((cat) => (
                  <button
                    key={cat.prefix}
                    type="button"
                    onClick={() => {
                      setSelectedLocCategory(cat.prefix);
                      if (cat.prefix === "FALLECIDO") {
                        setLocation("FALLECIDO");
                      }
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all ${
                      selectedLocCategory === cat.prefix
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Botones de ubicaciones filtradas por categoría */}
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1.5 bg-white/70 rounded-xl border border-indigo-100">
                {allLocations
                  .filter((loc) => {
                    const up = loc.toUpperCase();
                    if (selectedLocCategory === "FALLECIDO") {
                      return up.includes("FALLECIDO");
                    }
                    if (selectedLocCategory === "VIF") {
                      return up.includes("VIF") || up.includes("VILEF") || up.includes("FELV") || up.includes("LEUCEMIA") || up.includes("POSITIVO");
                    }
                    if (selectedLocCategory === "FERAL") {
                      return up.includes("FERAL");
                    }
                    if (selectedLocCategory === "PATIO") {
                      return up.includes("PATIO") && !up.includes("FERAL") && !up.includes("VIF") && !up.includes("LEUCEMIA");
                    }
                    return up.includes(selectedLocCategory);
                  })
                  .slice(0, 30)
                  .map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setLocation(sug)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                        location === sug
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-800 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300"
                      }`}
                    >
                      {sug}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Fotografía del Felino */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between mb-2">
              <label className="font-black text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-purple-600" />
                Fotografía del Felino (Opcional):
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                {photoUrl ? "Foto adjuntada" : "Sin foto"}
              </span>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {photoUrl ? (
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-xl border border-purple-200">
                <img
                  src={photoUrl}
                  alt="Foto del felino"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-xl border border-purple-300 shadow-xs shrink-0"
                />
                <div className="flex-1 space-y-1.5">
                  <p className="text-xs font-bold text-slate-800">Foto registrada</p>
                  <p className="text-[10px] text-slate-500">
                    Comprimida y lista para guardar offline en el dispositivo y sincronizar a la nube.
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      disabled={isCompressingPhoto}
                      onClick={() => photoInputRef.current?.click()}
                      className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                    >
                      <Camera className="w-3 h-3" /> Cambiar
                    </button>
                    <button
                      type="button"
                      disabled={isCompressingPhoto}
                      onClick={handleRemovePhoto}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                    >
                      <Trash2 className="w-3 h-3" /> Borrar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={isCompressingPhoto}
                onClick={() => photoInputRef.current?.click()}
                className="w-full p-3 border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/40 hover:bg-purple-50 rounded-xl flex items-center justify-center gap-2.5 text-purple-900 font-bold text-xs transition-all active:scale-[0.99]"
              >
                {isCompressingPhoto ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span>Optimizando fotografía...</span>
                  </>
                ) : (
                  <>
                    <div className="p-1.5 bg-purple-200/70 rounded-lg text-purple-800">
                      <Camera className="w-4 h-4" />
                    </div>
                    <span>📷 Tomar Foto con Cámara o Subir de Galería</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* 3. Historia Clínica (HC), Sexo Code (A) y Raza */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                HISTORIA CLÍNICA (HC):
              </label>
              <input
                type="text"
                value={hc}
                onChange={(e) => setHc(e.target.value)}
                placeholder="Ej: 24198"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="font-black text-purple-950 block mb-1 text-[10px] uppercase">
                CÓDIGO SEXO (COLUMNA A):
              </label>
              <select
                value={sexoCode}
                onChange={(e) => setSexoCode(e.target.value as any)}
                className="w-full p-2.5 bg-purple-50 border border-purple-300 rounded-xl font-black text-purple-950"
              >
                <option value="MFA">MFA (Macho Adulto)</option>
                <option value="HFA">HFA (Hembra Adulta)</option>
                <option value="MFC">MFC (Macho Cachorro)</option>
                <option value="HFC">HFC (Hembra Cachorra)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                RAZA:
              </label>
              <input
                type="text"
                value={raza}
                onChange={(e) => setRaza(e.target.value)}
                placeholder="DPC, DPL, Siamés..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold uppercase text-slate-900"
              />
            </div>
          </div>

          {/* 4. Nombre Opcional, Color y Tipo de Ingreso */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                NOMBRE FELINO: <span className="text-slate-400 font-normal">(Opcional)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Michi, Luna o S/N"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold uppercase"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 text-[10px] uppercase">
                  COLOR (COLUMNA H): <span className="text-purple-700 font-normal">89 Colores Oficiales</span>
                </label>
              </div>
              <input
                type="text"
                list="colors-list"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                placeholder="Ej: TABBY AMARILLO, NEGRO, CAREY..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-400"
              />
              {/* Pills rápidos de colores más frecuentes del Excel */}
              <div className="flex flex-wrap gap-1 mt-1 max-h-16 overflow-y-auto p-1 bg-slate-100 rounded-lg">
                {POPULAR_GATERA_COLORS.slice(0, 10).map((cName) => (
                  <button
                    key={cName}
                    type="button"
                    onClick={() => setColor(cName)}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all ${
                      color === cName
                        ? "bg-purple-700 text-white"
                        : "bg-white text-slate-700 border border-slate-200 hover:bg-purple-50"
                    }`}
                  >
                    {cName}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                TIPO INGRESO:
              </label>
              <select
                value={tipoIngreso}
                onChange={(e) => setTipoIngreso(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
              >
                <option value="RES">RES (Rescate)</option>
                <option value="APM">APM (Atención Médica)</option>
                <option value="INC">INC (Incautación)</option>
                <option value="E Y D">E Y D (Esterilizar y Devolver)</option>
              </select>
            </div>
          </div>

          {/* DIAGNÓSTICO RETROVIRAL FELINO: VIF / FeLV (Leucemia e Inmunodeficiencia) */}
          <div className="p-3.5 bg-gradient-to-br from-purple-50 via-indigo-50 to-pink-50 rounded-2xl border border-purple-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase text-purple-950 flex items-center gap-1.5">
                <span>🩸 SEROLOGÍA / RETROVIRUS FELINOS (VIF & FeLV)</span>
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                vifStatus === "POSITIVO" && felvStatus === "POSITIVO"
                  ? "bg-red-600 text-white border-red-700 animate-pulse"
                  : vifStatus === "POSITIVO"
                  ? "bg-amber-500 text-white border-amber-600"
                  : felvStatus === "POSITIVO"
                  ? "bg-orange-500 text-white border-orange-600"
                  : vifStatus === "PENDIENTE" || felvStatus === "PENDIENTE"
                  ? "bg-slate-200 text-slate-800 border-slate-300"
                  : "bg-emerald-600 text-white border-emerald-700"
              }`}>
                {vifStatus === "POSITIVO" && felvStatus === "POSITIVO"
                  ? "⚠️ DOBLE POSITIVO"
                  : vifStatus === "POSITIVO"
                  ? "VIF (+) POSITIVO"
                  : felvStatus === "POSITIVO"
                  ? "FeLV (+) LEUCEMIA"
                  : vifStatus === "PENDIENTE" || felvStatus === "PENDIENTE"
                  ? "⏳ PENDIENTE TEST"
                  : "🛡️ NEGATIVO (VIF- / FeLV-)"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Test VIF */}
              <div className="bg-white p-2.5 rounded-xl border border-purple-100 space-y-1">
                <label className="text-[10px] font-black text-slate-700 block uppercase">
                  VIF (Inmunodeficiencia Felina):
                </label>
                <div className="grid grid-cols-3 gap-1 font-bold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setVifStatus("NEGATIVO")}
                    className={`py-1.5 rounded-lg transition-all ${
                      vifStatus === "NEGATIVO"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Negativo (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVifStatus("POSITIVO")}
                    className={`py-1.5 rounded-lg transition-all ${
                      vifStatus === "POSITIVO"
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    VIF (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVifStatus("PENDIENTE")}
                    className={`py-1.5 rounded-lg transition-all ${
                      vifStatus === "PENDIENTE"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Pendiente
                  </button>
                </div>
              </div>

              {/* Test FeLV */}
              <div className="bg-white p-2.5 rounded-xl border border-purple-100 space-y-1">
                <label className="text-[10px] font-black text-slate-700 block uppercase">
                  FeLV (Leucemia Felina):
                </label>
                <div className="grid grid-cols-3 gap-1 font-bold text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFelvStatus("NEGATIVO")}
                    className={`py-1.5 rounded-lg transition-all ${
                      felvStatus === "NEGATIVO"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Negativo (-)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFelvStatus("POSITIVO")}
                    className={`py-1.5 rounded-lg transition-all ${
                      felvStatus === "POSITIVO"
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    FeLV (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFelvStatus("PENDIENTE")}
                    className={`py-1.5 rounded-lg transition-all ${
                      felvStatus === "PENDIENTE"
                        ? "bg-slate-800 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    Pendiente
                  </button>
                </div>
              </div>
            </div>

            {/* Sugerencia de Ubicación en Gatera según Resultado Retroviral */}
            <div className="text-[10px] text-purple-900 bg-white/70 p-2 rounded-xl border border-purple-200 flex items-center justify-between">
              <span>
                {vifStatus === "POSITIVO" && felvStatus === "POSITIVO"
                  ? "📍 Ubicación requerida: Sección DOBLE POSITIVO o Hospitalización aislada."
                  : vifStatus === "POSITIVO"
                  ? "📍 Ubicación requerida: Patios VIF (PATIO 1 VIF, PATIO 2-3 VIF) o JAULAS FIV."
                  : felvStatus === "POSITIVO"
                  ? "📍 Ubicación requerida: PATIO 7 LEUCEMIA + o JAULAS FELV."
                  : "📍 Ubicación sugerida: Cuarentenas, UPH, Patios Generales o Adopción."}
              </span>
            </div>
          </div>

          {/* 5. Condición Corporal, Estado de Salud y Edad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                CONDICIÓN CORPORAL:
              </label>
              <select
                value={condicionCorporal}
                onChange={(e) => setCondicionCorporal(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
              >
                <option value="RANGO 1.0/5">RANGO 1.0/5 (Muy Caquéctico)</option>
                <option value="RANGO 1.5/5">RANGO 1.5/5</option>
                <option value="RANGO 2.0/5">RANGO 2.0/5 (Delgado)</option>
                <option value="RANGO 2.5/5">RANGO 2.5/5</option>
                <option value="RANGO 3.0/5">RANGO 3.0/5 (Ideal / Óptimo)</option>
                <option value="RANGO 3.5/5">RANGO 3.5/5</option>
                <option value="RANGO 4.0/5">RANGO 4.0/5 (Sobrepeso)</option>
                <option value="RANGO 5.0/5">RANGO 5.0/5 (Obeso)</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                ESTADO CLÍNICO:
              </label>
              <select
                value={estadoSalud}
                onChange={(e) => setEstadoSalud(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
              >
                <option value="Saludable">Saludable</option>
                <option value="Regular">Regular</option>
                <option value="Delicado">Delicado</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                EDAD APROX MESES:
              </label>
              <input
                type="text"
                value={edadMeses}
                onChange={(e) => setEdadMeses(e.target.value)}
                placeholder="Ej: 24 MESES"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
              />
            </div>
          </div>

          {/* 6. Protocolo Bioseguridad FERAL (Alerta Amarilla/Roja) */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-1.5">
            <span className="font-black text-amber-950 block text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Manejo Etológico / Felino Feral (Columna 6 Censo):
            </span>
            <label className="flex items-center gap-2.5 p-2 bg-white rounded-xl border border-amber-200 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={isFeral}
                onChange={(e) => setIsFeral(e.target.checked)}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
              <span className="text-[11px] text-amber-900">
                ⚠️ ¿ES FELINO FERAL / REACTIVO? (Requiere contención con guantes de carnaza y toalla)
              </span>
            </label>
          </div>

          {/* 7. Tratamiento Inicial / Kardex Opcional */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-indigo-950 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-indigo-600" /> Tratamiento / Medicación Prescrita (Columna 14)
              </span>
              <button
                type="button"
                onClick={() => setHasTreatment(!hasTreatment)}
                className={`px-3 py-1 rounded-xl font-bold text-[11px] transition-all ${
                  hasTreatment ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-200 text-slate-700"
                }`}
              >
                {hasTreatment ? "SÍ (Prescribir)" : "NO"}
              </button>
            </div>

            {hasTreatment && (
              <div className="space-y-2.5 pt-1.5 border-t border-indigo-100 animate-in fade-in">
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                    FÁRMACO FELINO Y DOSIFICACIÓN:
                  </label>
                  <input
                    type="text"
                    list="felinos-meds-list"
                    value={medicacion}
                    onChange={(e) => setMedicacion(e.target.value)}
                    placeholder="Ej: Doxi 100mg 1/4 tab c/24h x 14 días"
                    className="w-full p-2 bg-white border border-indigo-200 rounded-xl font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                      SISTEMA CLÍNICO:
                    </label>
                    <select
                      value={sistema}
                      onChange={(e) => setSistema(e.target.value)}
                      className="w-full p-2 bg-white border border-indigo-200 rounded-xl font-medium"
                    >
                      <option value="PREVENTIVO">Preventivo / Resguardo</option>
                      <option value="OCULAR">Ocular / Oftálmico</option>
                      <option value="RESPIRATORIO">Respiratorio (Calicivirus/Rino)</option>
                      <option value="DERMATOLOGICO">Dermatológico</option>
                      <option value="GASTROINTESTINAL">Gastrointestinal</option>
                      <option value="TEGUMEN">Tegumentario</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                      DÍAS / DOSIS TOTALES:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={totalDoses}
                      onChange={(e) => setTotalDoses(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-indigo-200 rounded-xl font-mono text-center font-bold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 8. Observaciones Médicas & Seguimiento (Columnas 15, 16, 17) */}
          <div className="space-y-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                OBSERVACIONES MÉDICAS (COLUMNA 15):
              </label>
              <textarea
                rows={2}
                value={observacionesMedicas}
                onChange={(e) => setObservacionesMedicas(e.target.value)}
                placeholder="Ej: Secreción nasal leve, buen apetito, mucosas rosadas..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                  REQUIERE SEGUIMIENTO:
                </label>
                <select
                  value={requiereSeguimiento}
                  onChange={(e) => setRequiereSeguimiento(e.target.value as any)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="NO">NO</option>
                  <option value="SI">SI</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                  TIPO SEGUIMIENTO:
                </label>
                <select
                  value={tipoSeguimiento}
                  onChange={(e) => setTipoSeguimiento(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl font-bold"
                >
                  <option value="TRATAMIENTO">TRATAMIENTO</option>
                  <option value="MÉDICO">MÉDICO</option>
                  <option value="NUTRICIONAL">NUTRICIONAL</option>
                  <option value="COMPORTAMENTAL">COMPORTAMENTAL</option>
                </select>
              </div>
            </div>
          </div>

          {/* 9. Aseo y Bienestar Felino (Columnas 19, 20, 21) */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <span className="font-bold text-slate-700 block text-[10px] uppercase flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-slate-500" /> Aseo & Bienestar Felino Realizado al Ingreso:
            </span>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 font-medium text-[11px]">
                <input
                  type="checkbox"
                  checked={peluqueria === "SI"}
                  onChange={(e) => setPeluqueria(e.target.checked ? "SI" : "NO")}
                />
                <span>Peluquería</span>
              </label>
              <label className="flex items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 font-medium text-[11px]">
                <input
                  type="checkbox"
                  checked={corteUnas === "SI"}
                  onChange={(e) => setCorteUnas(e.target.checked ? "SI" : "NO")}
                />
                <span>Corte Uñas</span>
              </label>
              <label className="flex items-center gap-1.5 p-2 bg-white rounded-xl border border-slate-200 font-medium text-[11px]">
                <input
                  type="checkbox"
                  checked={limpiezaOidos === "SI"}
                  onChange={(e) => setLimpiezaOidos(e.target.checked ? "SI" : "NO")}
                />
                <span>Aseo Ótico</span>
              </label>
            </div>
          </div>

          {/* 10. Médico Veterinario Responsable (Columna 23) */}
          <div>
            <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5 text-purple-600" /> MÉDICO VETERINARIO RESPONSABLE (COLUMNA 23):
            </label>
            <input
              type="text"
              list="vets-list"
              value={medicoVeterinario}
              onChange={(e) => setMedicoVeterinario(e.target.value)}
              placeholder="Dra. Jenny Zapata Calle"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
            />
          </div>

          {/* Botón interior de retorno rápido arriba si el usuario bajó */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={scrollToTop}
              className="text-[11px] font-bold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1 p-1 rounded-lg"
            >
              <ArrowUp className="w-3.5 h-3.5" /> Volver al inicio del formulario
            </button>
          </div>
        </div>

        {/* Barra de Acciones FIJA / STICKY en la parte inferior */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 border-t border-slate-200 shadow-2xl z-30 shrink-0 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold rounded-2xl text-xs transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-2/3 py-3.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-purple-700/25 flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? "GUARDANDO..." : "GUARDAR EN CENSO GATERA"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
