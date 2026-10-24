"use client";
import React, { useState, useEffect, useRef } from "react";
import { db, Animal } from "@/lib/db";
import { StaffMember } from "@/lib/staff";
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
} from "lucide-react";

interface RegisterNewAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMicrochip: string;
  defaultArea?: "caninos" | "gatera" | "ambas";
  currentUser?: StaffMember | null;
  onAnimalRegistered: (animal: Animal) => void;
}

export const RegisterNewAnimalModal: React.FC<RegisterNewAnimalModalProps> = ({
  isOpen,
  onClose,
  initialMicrochip,
  defaultArea = "ambas",
  currentUser,
  onAnimalRegistered,
}) => {
  const initialSpecies =
    defaultArea === "gatera" || currentUser?.area === "gatera" ? "gato" : "perro";

  const [species, setSpecies] = useState<"perro" | "gato">(initialSpecies);
  const [microchip, setMicrochip] = useState(initialMicrochip);
  const [name, setName] = useState("");
  const [location, setLocation] = useState(""); // Columna B del Censo: Nº CANIL / JAULA
  const [hc, setHc] = useState("");
  const [breed, setBreed] = useState(initialSpecies === "gato" ? "Común Europeo" : "Mestizo");
  const [color, setColor] = useState("");
  const [gender, setGender] = useState<"Macho" | "Hembra">("Macho");
  const [age, setAge] = useState("Adulto");
  const [status, setStatus] = useState("activo");

  // Bioseguridad
  const [isCDV, setIsCDV] = useState(false);
  const [isFeral, setIsFeral] = useState(false);
  const [isCuarentena, setIsCuarentena] = useState(false);

  // Tratamiento opcional al ingreso
  const [hasTreatment, setHasTreatment] = useState(false);
  const [medication, setMedication] = useState("");
  const [system, setSystem] = useState("PREVENTIVO");
  const [totalDoses, setTotalDoses] = useState(7);

  // Desparasitación: BRAVECTO ES EXCLUSIVO DE CANINOS
  const [bravectoCanino, setBravectoCanino] = useState("1 dosis (Bravecto)");

  // Observaciones
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMicrochip) {
      setMicrochip(initialMicrochip.trim());
    }
  }, [initialMicrochip]);

  useEffect(() => {
    if (species === "gato") {
      if (breed === "Mestizo") setBreed("Común Europeo");
      setIsCDV(false); // CDV es exclusivo de caninos
    } else if (species === "perro") {
      if (breed === "Común Europeo") setBreed("Mestizo");
    }
  }, [species]);

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
    if (!name.trim()) {
      setErrorMessage("Por favor ingresa el nombre o identificación del animal.");
      scrollToTop();
      return;
    }
    if (!location.trim()) {
      setErrorMessage("Por favor ingresa el Nº Canil o Ubicación (Columna B de la Hoja de Censo).");
      scrollToTop();
      return;
    }

    setIsSubmitting(true);

    try {
      const shortChip = cleanChip.length > 7 ? cleanChip.slice(-7) : cleanChip;
      const formattedName = name.trim().toUpperCase();
      const formattedLocation = location.trim().toUpperCase(); // Columna B Censo
      const formattedBreed = breed.trim().toUpperCase() || (species === "gato" ? "COMÚN" : "MESTIZO");
      const formattedColor = color.trim().toUpperCase() || "ESTÁNDAR";
      const formattedHc = hc.trim().toUpperCase();
      const nowIso = new Date().toISOString();

      let compiledNotes = notes.trim();
      if (isCDV && species === "perro") {
        compiledNotes = `[CDV POSITIVO] ${compiledNotes}`.trim();
      }
      if (isCuarentena) {
        compiledNotes = `[CUARENTENA] ${compiledNotes}`.trim();
      }
      if (isFeral) {
        compiledNotes = `[ANIMAL FERAL] ${compiledNotes}`.trim();
      }

      // 1. Guardar en tabla central: db.animals
      const newAnimal: Animal = {
        microchip: cleanChip,
        shortChip,
        name: formattedName,
        species,
        breed: `${formattedBreed} - ${formattedColor}`,
        gender: gender.toLowerCase(),
        location: formattedLocation,
        status: isCuarentena ? "cuarentena" : status,
        hc: formattedHc || undefined,
        isFeral,
        color: formattedColor,
        notes: compiledNotes || undefined,
        lastCensusDate: nowIso,
      };

      await db.animals.put(newAnimal);

      // 2. Guardar en la Planilla correspondiente según su ubicación y especie
      if (species === "perro") {
        // En Caninos, determinar la sección por CDV o ubicación
        let caninoSection = "TRIAJE";
        if (isCDV) {
          caninoSection = "CDV";
        } else if (formattedLocation.includes("UCE")) {
          caninoSection = "UCE";
        } else if (formattedLocation.includes("NOCHE")) {
          caninoSection = "NOCHE";
        }

        await db.shelterRecords.add({
          section: caninoSection as any,
          ubicacion: formattedLocation, // Columna B (Nº Canil)
          microchip: cleanChip,
          shortChip,
          descripcion: `${formattedName} (${formattedBreed} - ${formattedColor})`,
          medicacion: hasTreatment ? medication.trim() : "",
          fechaFinal: hasTreatment ? `+${totalDoses} días` : "HNI",
          tipo: "S",
          sistema: hasTreatment ? system : "PREVENTIVO",
          pendientes: compiledNotes || "INGRESO NUEVO CANIL",
          // BRAVECTO EXCLUSIVO DE CANINOS
          dosisBravecto: bravectoCanino.trim() || undefined,
        });
      } else {
        // En Felinos (Gatera), Bravecto NUNCA se asigna
        await db.gateraRecords.add({
          ubicacion: formattedLocation, // Columna B (Nº Canil / Jaula)
          microchip: cleanChip,
          shortChip,
          hc: formattedHc || shortChip.slice(-5),
          nombre: formattedName,
          raza: formattedBreed,
          color: formattedColor,
          sexo: (gender.toLowerCase() === "hembra" ? "hembra" : "macho") as "macho" | "hembra",
          edad: age,
          isFeral,
          tipoIngreso: "RESGUARDO",
          condicionCorporal: "3/5",
          estadoSalud: isCuarentena ? "CUARENTENA" : "ESTABLE",
          fechaFinal: hasTreatment ? `+${totalDoses} días` : "HNI",
          tipo: "S",
          descripcion: `${formattedName} (${formattedBreed} - ${formattedColor})`,
          medicacion: hasTreatment ? medication.trim() : "",
          sistema: hasTreatment ? system : "GENERAL",
          pendientes: compiledNotes || "INGRESO NUEVO GATERA",
          desparasitante: "AL DÍA (FELINO)", // No Bravecto para gatos
        });
      }

      // 3. Registrar Censo Automático del Nuevo Ingreso
      await db.census.add({
        microchip: cleanChip,
        animalName: formattedName,
        species,
        location: formattedLocation,
        scannedAt: nowIso,
        scannedBy: currentUser?.name || "Operario de Campo",
        treatmentCount: hasTreatment ? 1 : 0,
        area: species === "gato" ? "gatera" : "caninos",
      });

      // 4. Si tiene tratamiento activo, registrarlo en el Kardex Clínico
      if (hasTreatment && medication.trim()) {
        const vetName = currentUser?.name || "Médico Veterinario";
        await db.kardex.add({
          microchip: cleanChip,
          shortChip,
          system,
          treatment: medication.trim(),
          description: compiledNotes || "Prescripción al ingreso",
          startDate: nowIso.split("T")[0],
          endDate: new Date(Date.now() + totalDoses * 86400000).toISOString().split("T")[0],
          status: "activo",
          prescribedBy: vetName,
          createdAt: nowIso,
          area: species === "gato" ? "gatera" : "caninos",
          dosisTotales: Number(totalDoses) || 7,
          dosisAplicadas: 0,
          dosisFaltantes: Number(totalDoses) || 7,
        });
      }

      // Feedback háptico
      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 150]);
      }

      onAnimalRegistered(newAnimal);
      onClose();
    } catch (err: any) {
      console.error("Error al registrar nuevo animal:", err);
      setErrorMessage(`Error al guardar: ${err?.message || "Error desconocido en base de datos"}`);
      scrollToTop();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-2.5 sm:p-4 flex items-center justify-center overscroll-contain">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 my-auto flex flex-col max-h-[90vh]">
        
        {/* Cabecera Fija del Modal */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                Registrar Animal Nuevo en Sistema
              </h3>
              <p className="text-[11px] text-slate-400">
                Se registrará en el Censo, en su Planilla oficial y en la base de datos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all"
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

          {/* 1. UBICACIÓN EN CENSO: Caninos vs Gatera */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
            <label className="font-black text-slate-800 uppercase tracking-wider block text-[11px]">
              UBICACIÓN GENERAL EN CENSO:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSpecies("perro")}
                className={`py-3 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                  species === "perro"
                    ? "bg-emerald-50 border-emerald-600 text-emerald-950 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="text-xl">🐶</span>
                <span className="leading-tight">CANINOS (Albergue)</span>
              </button>
              <button
                type="button"
                onClick={() => setSpecies("gato")}
                className={`py-3 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 border-2 transition-all ${
                  species === "gato"
                    ? "bg-purple-50 border-purple-600 text-purple-950 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="text-xl">🐱</span>
                <span className="leading-tight">GATERA (Felinos)</span>
              </button>
            </div>
          </div>

          {/* 2. Microchip */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <label className="font-bold text-slate-600 block mb-1 text-[10px] uppercase tracking-wider">
              NÚMERO DE MICROCHIP (LEÍDO CON W91A O MANUAL):
            </label>
            <input
              type="text"
              required
              value={microchip}
              onChange={(e) => setMicrochip(e.target.value)}
              placeholder="Ej: 991003003806096 o 3806096"
              className="w-full p-2.5 font-mono text-sm font-black text-slate-900 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 3. UBICACIÓN ESPECÍFICA (Nº CANIL / JAULA / COLUMNA B DE CENSO) */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-black text-indigo-950 block text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-600" />
                UBICACIÓN ESPECÍFICA (Nº CANIL / JAULA - COLUMNA B CENSO): <span className="text-red-500">*</span>
              </label>
            </div>
            
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={species === "gato" ? "Ej: CUARENTENA 1, CUARENTENA 2, MATERNIDAD 1..." : "Ej: CANIL 14, CANIL 2, PATIO 1, UCE 2, TRIAJE..."}
              className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl font-bold uppercase text-slate-900 focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />

            {/* Sugerencias Rápidas de Columna B según Área */}
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-indigo-700 font-bold">Rápido:</span>
              {(species === "perro"
                ? ["CANIL 1", "CANIL 2", "CANIL 3", "PATIO 1", "PATIO 2", "TRIAJE", "UCE", "CUARENTENA"]
                : ["CUARENTENA 1", "CUARENTENA 2", "CUARENTENA 3", "MATERNIDAD 1", "MATERNIDAD 2", "PATIO GATERA"]
              ).map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setLocation(sug)}
                  className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-lg text-[10px] font-bold transition-all shadow-2xs"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Nombre y Datos Físicos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-black text-slate-800 block mb-1 text-[11px]">
                NOMBRE DEL ANIMAL: <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Max, Luna, Pelusa..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold uppercase focus:bg-white"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                HISTORIA CLÍNICA (HC):
              </label>
              <input
                type="text"
                value={hc}
                onChange={(e) => setHc(e.target.value)}
                placeholder="Ej: 24198"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>
          </div>

          {/* 5. Sexo, Edad y Raza */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                SEXO:
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
              >
                <option value="Macho">Macho</option>
                <option value="Hembra">Hembra</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                EDAD:
              </label>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Ej: Adulto"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                ESTADO:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-emerald-800"
              >
                <option value="activo">Activo</option>
                <option value="observacion">Observación</option>
                <option value="cuarentena">Cuarentena</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                RAZA / MESTIZAJE:
              </label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder={species === "gato" ? "Ej: Común Europeo, Siamés" : "Ej: Mestizo, Criollo, Pitbull"}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
                COLOR / SEÑAS:
              </label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Ej: Negro y blanco, Atigrado, Café"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
              />
            </div>
          </div>

          {/* 6. Protocolo de Bioseguridad */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
            <span className="font-black text-amber-950 block text-[11px] uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Bioseguridad & Manejo Cauteloso:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {species === "perro" && (
                <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-amber-200 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isCDV}
                    onChange={(e) => setIsCDV(e.target.checked)}
                    className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                  />
                  <span className="text-[11px] text-red-700">☣️ Distemper CDV (+)</span>
                </label>
              )}
              <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-amber-200 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={isFeral}
                  onChange={(e) => setIsFeral(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-[11px]">⚠️ Feral / Reactivo</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-amber-200 cursor-pointer font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={isCuarentena}
                  onChange={(e) => setIsCuarentena(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                />
                <span className="text-[11px]">🛑 Cuarentena</span>
              </label>
            </div>
          </div>

          {/* 7. DESPARASITACIÓN BRAVECTO (SOLO PARA CANINOS) */}
          {species === "perro" && (
            <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl space-y-1.5 animate-in fade-in">
              <label className="font-black text-amber-950 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-amber-600" /> Desparasitación Bravecto (Exclusivo Caninos):
              </label>
              <input
                type="text"
                value={bravectoCanino}
                onChange={(e) => setBravectoCanino(e.target.value)}
                placeholder="Ej: 1 dosis (Bravecto 20-40kg) o Al Día"
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-bold text-amber-950 focus:ring-2 focus:ring-amber-500"
              />
              <span className="text-[10px] text-amber-700 block font-medium">
                * Bravecto tiene vigencia de 90 días y solo aplica para la población canina.
              </span>
            </div>
          )}

          {/* 8. Tratamiento Inicial / Kardex Opcional */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-indigo-950 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-indigo-600" /> ¿Tiene Medicación Prescrita al Ingreso?
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
              <div className="space-y-2 pt-1 border-t border-indigo-100 animate-in fade-in">
                <div>
                  <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                    MEDICAMENTO Y DOSIFICACIÓN:
                  </label>
                  <input
                    type="text"
                    value={medication}
                    onChange={(e) => setMedication(e.target.value)}
                    placeholder="Ej: Amoxicilina 250mg c/12h con alimento"
                    className="w-full p-2 bg-white border border-indigo-200 rounded-xl font-medium"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                      SISTEMA CLÍNICO:
                    </label>
                    <select
                      value={system}
                      onChange={(e) => setSystem(e.target.value)}
                      className="w-full p-2 bg-white border border-indigo-200 rounded-xl font-medium"
                    >
                      <option value="PREVENTIVO">Preventivo / Resguardo</option>
                      <option value="DERMATOLOGICO">Dermatológico</option>
                      <option value="GASTROINTESTINAL">Gastrointestinal</option>
                      <option value="RESPIRATORIO">Respiratorio</option>
                      <option value="OFTALMOLOGICO">Oftalmológico</option>
                      <option value="TRAUMATOLOGICO">Traumatológico</option>
                      <option value="TEGUMEN">Tegumentario</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-0.5 text-[10px]">
                      TOTAL DE DOSIS:
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

          {/* 9. Observaciones */}
          <div>
            <label className="font-bold text-slate-700 block mb-1 text-[10px] uppercase">
              OBSERVACIONES CLÍNICAS / DIETA / NOTAS DE INGRESO:
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Rescatado en Comuna 13. Presenta baja condición corporal, dieta blanda..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium"
            />
          </div>

          {/* Botón interior de retorno rápido arriba si el usuario bajó */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={scrollToTop}
              className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1 p-1 rounded-lg"
            >
              <ArrowUp className="w-3.5 h-3.5" /> Volver al inicio del formulario
            </button>
          </div>
        </div>

        {/* Barra de Acciones FIJA / STICKY en la parte inferior */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 border-t border-slate-200 shadow-xl z-20 shrink-0 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-1/3 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-2/3 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSubmitting ? "GUARDANDO..." : "GUARDAR Y SUMAR AL CENSO"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
