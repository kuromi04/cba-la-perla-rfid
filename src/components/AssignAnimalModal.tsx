"use client";
import React, { useState, useEffect } from "react";
import { db, ShiftTask, Animal } from "@/lib/db";
import { StaffMember, getAllStaff } from "@/lib/staff";
import {
  X,
  Search,
  UserCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Pill,
  ShowerHead,
  Sparkles,
  AlertTriangle,
  MapPin,
  Check,
  Wind,
  PlusCircle,
  FileSpreadsheet,
} from "lucide-react";

export interface SelectedAnimalInfo {
  microchip: string;
  name: string;
  location: string;
  species: "perro" | "gato";
  isFeral?: boolean;
  medication?: string;
  notes?: string;
}

interface AssignAnimalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAnimal?: SelectedAnimalInfo | null;
  onSuccess?: (task: ShiftTask) => void;
  userArea?: "gatera";
}

export const AssignAnimalModal: React.FC<AssignAnimalModalProps> = ({
  isOpen,
  onClose,
  initialAnimal,
  onSuccess,
  userArea = "gatera",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SelectedAnimalInfo[]>([]);
  const [selectedAnimal, setSelectedAnimal] = useState<SelectedAnimalInfo | null>(null);
  
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [assignedStaff, setAssignedStaff] = useState<StaffMember | null>(null);
  const [shift, setShift] = useState<"mañana" | "tarde" | "noche">("mañana");
  const [laborType, setLaborType] = useState<"medicacion" | "limpieza" | "baño" | "nebulizacion" | "desparasitacion">("medicacion");
  const [instruction, setInstruction] = useState("");
  const [customNotes, setCustomNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Inicializar cuando se abre con un animal preseleccionado y cargar personal
  useEffect(() => {
    if (isOpen) {
      getAllStaff().then((list) => {
        setStaffList(list);
        const filteredWorkers = list.filter((s) => s.role !== "veterinario");

        if (initialAnimal) {
          setSelectedAnimal(initialAnimal);
          setInstruction(initialAnimal.medication || initialAnimal.notes || "Administrar tratamiento según planilla");
          const match = filteredWorkers[0] || null;
          setAssignedStaff(match);
        } else {
          setSelectedAnimal(null);
          setInstruction("");
          if (filteredWorkers.length > 0) setAssignedStaff(filteredWorkers[0]);
        }
      });
      setSearchTerm("");
      setSearchResults([]);
      setSuccessFeedback(null);
    }
  }, [isOpen, initialAnimal, userArea]);

  // Búsqueda en vivo de felinos en la base de datos de GATERA
  useEffect(() => {
    const q = searchTerm.trim().toLowerCase();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const results: SelectedAnimalInfo[] = [];

      // Buscar exclusivamente en Felinos (gateraRecords)
      const cats = await db.gateraRecords
        .filter((c) =>
          Boolean(
            c.microchip.toLowerCase().includes(q) ||
            c.nombre.toLowerCase().includes(q) ||
            c.ubicacion.toLowerCase().includes(q) ||
            c.hc.toLowerCase().includes(q) ||
            (c.shortChip && c.shortChip.toLowerCase().includes(q))
          )
        )
        .limit(15)
        .toArray();

      cats.forEach((c) => {
        results.push({
          microchip: c.microchip,
          name: c.nombre,
          location: c.ubicacion,
          species: "gato",
          isFeral: c.isFeral,
          medication: c.medicacion,
          notes: `HC: ${c.hc}. ${c.pendientes || ""}`,
        });
      });

      setSearchResults(results);
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!isOpen) return null;

  const handleSelectAnimal = (animal: SelectedAnimalInfo) => {
    setSelectedAnimal(animal);
    setSearchTerm("");
    setSearchResults([]);

    if (animal.medication && animal.medication !== "Ninguno") {
      setInstruction(animal.medication);
    } else {
      setInstruction("Atención y seguimiento en turno");
    }

    // Auto-sugerir personal apropiado
    const match = staffList.find((s) => s.role !== "veterinario") || staffList[0] || null;
    if (match) setAssignedStaff(match);
  };

  const handleSaveAssignment = async () => {
    if (!selectedAnimal) return;
    setIsSaving(true);

    try {
      const finalInstruction = instruction || "Labor asignada por Médico Veterinario";

      const newTask: ShiftTask = {
        animalName: selectedAnimal.name,
        species: "gato",
        microchip: selectedAnimal.microchip,
        location: selectedAnimal.location,
        medication: finalInstruction,
        shift: shift,
        laborType: laborType,
        isCompleted: false,
        isFeral: selectedAnimal.isFeral,
        notes: customNotes ? `${customNotes} | ${selectedAnimal.notes || ""}` : selectedAnimal.notes,
        area: "gatera",
        assignedTo: assignedStaff ? assignedStaff.name : undefined,
        assignedRole: assignedStaff ? (assignedStaff.role as any) : undefined,
      };

      const id = await db.shiftTasks.add(newTask);
      newTask.id = id;

      // Sincronizar en tiempo real con Supabase
      if (typeof window !== "undefined" && navigator.onLine) {
        import("@/lib/supabase").then(({ syncShiftTaskToSupabase }) => {
          syncShiftTaskToSupabase(newTask).catch(console.warn);
        });
      }

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

      setSuccessFeedback(`✅ ¡${selectedAnimal.name} asignado con éxito${assignedStaff ? ` a ${assignedStaff.name}` : ""}!`);

      setTimeout(() => {
        setIsSaving(false);
        if (onSuccess) onSuccess(newTask);
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-5 space-y-4 my-auto animate-in zoom-in-95 max-h-[92vh] overflow-y-auto border border-slate-200">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 rounded-2xl text-emerald-800">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base leading-tight">
                ASIGNAR ANIMAL A TURNO
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Centro de Bienestar Animal La Perla • Delegación de Labores
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Éxito al guardar */}
        {successFeedback && (
          <div className="p-4 bg-emerald-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg animate-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5" />
            <span>{successFeedback}</span>
          </div>
        )}

        {/* PASO 1: SELECCIONAR O CAMBIAR ANIMAL */}
        <div className="space-y-2">
          <label className="text-xs font-black uppercase text-slate-700 flex items-center justify-between">
            <span>1. Animal de La Perla a Asignar:</span>
            {selectedAnimal && (
              <button
                type="button"
                onClick={() => setSelectedAnimal(null)}
                className="text-[10px] text-indigo-600 font-bold hover:underline"
              >
                Cambiar de animal
              </button>
            )}
          </label>

          {selectedAnimal ? (
            /* Tarjeta del Animal Seleccionado */
            <div className={`p-3.5 rounded-2xl border-2 flex items-start justify-between gap-3 ${
              selectedAnimal.species === "gato"
                ? "bg-purple-50/80 border-purple-300"
                : "bg-emerald-50/80 border-emerald-300"
            }`}>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {selectedAnimal.species === "gato" ? "🐱" : "🐶"}
                  </span>
                  <strong className="text-slate-900 text-sm font-black">
                    {selectedAnimal.name}
                  </strong>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                    {selectedAnimal.species === "gato" ? "Felino (Gatera)" : "Canino"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                  <span className="flex items-center gap-1 font-bold text-slate-900">
                    <MapPin className="w-3 h-3 text-indigo-600" /> {selectedAnimal.location}
                  </span>
                  <span className="font-mono text-[10px] bg-slate-200/80 px-1.5 py-0.5 rounded">
                    Chip: {selectedAnimal.microchip}
                  </span>
                </div>

                {selectedAnimal.isFeral && (
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                    ⚠️ Felino Feral (Manejo con guantes y toalla)
                  </span>
                )}

                {selectedAnimal.medication && (
                  <p className="text-[11px] text-slate-700 bg-white/80 p-2 rounded-xl border border-slate-200/80">
                    💊 <strong>Prescripción actual:</strong> {selectedAnimal.medication}
                  </p>
                )}
              </div>

              <div className="p-1 bg-emerald-600 text-white rounded-full shrink-0">
                <Check className="w-4 h-4" />
              </div>
            </div>
          ) : (
            /* Buscador de Animal */
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por Nombre, Chip o Canil/Jaula (ej: 'Pintas', '007', 'UCE 04')..."
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              {/* Lista de Resultados de Búsqueda */}
              {searchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 bg-slate-50 rounded-2xl border border-slate-200">
                  {searchResults.map((animal, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectAnimal(animal)}
                      className="p-2.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl cursor-pointer flex items-center justify-between text-xs transition-all shadow-sm"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span>{animal.species === "gato" ? "🐱" : "🐶"}</span>
                          <span className="font-black text-slate-900">{animal.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({animal.location})</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          Chip: {animal.microchip}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">
                        Seleccionar
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {searchTerm.length >= 2 && searchResults.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-3 bg-slate-50 rounded-2xl">
                  No se encontraron animales con ese criterio de búsqueda.
                </p>
              )}
            </div>
          )}
        </div>

        {/* PASO 2: SELECCIONAR TRABAJADOR (AUXILIAR U OPERARIO) */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-700 block">
            2. Asignar a Auxiliar u Operario:
          </label>
          {staffList.filter((s) => s.role !== "veterinario").length === 0 ? (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 text-center">
              No hay auxiliares u operarios registrados para Gatera. Puedes registrar nuevo personal desde el menú superior o continuar asignando sin operario asignado.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {staffList.filter((s) => s.role !== "veterinario").map((staff) => (
                <div
                  key={staff.id}
                  onClick={() => setAssignedStaff(staff)}
                  className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                    assignedStaff?.id === staff.id
                      ? "bg-indigo-600 text-white border-indigo-700 shadow-md scale-[1.02]"
                      : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-xs">{staff.name}</span>
                    {assignedStaff?.id === staff.id && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-[10px]">
                    <span
                      className={`px-1.5 py-0.5 rounded font-black uppercase text-[9px] ${
                        assignedStaff?.id === staff.id
                          ? "bg-white/20 text-white"
                          : staff.role === "auxiliar"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-emerald-100 text-emerald-900"
                      }`}
                    >
                      {staff.role}
                    </span>
                    <span className={assignedStaff?.id === staff.id ? "text-indigo-200" : "text-slate-400"}>
                      • {staff.area.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PASO 3: TIPO DE LABOR & TURNO */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase text-slate-700 block">
              3. Tipo de Labor:
            </label>
            <select
              value={laborType}
              onChange={(e) => setLaborType(e.target.value as any)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="medicacion">💊 Medicación / Tratamiento</option>
              <option value="limpieza">🩹 Curación de Herida</option>
              <option value="baño">🚿 Baño Medicado</option>
              <option value="desparasitacion">🧴 Desparasitación Felina (Pipeta / Revolution)</option>
              <option value="nebulizacion">🌬️ Nebulización / Inhalación</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-black uppercase text-slate-700 block">
              Turno de Cumplimiento:
            </label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value as any)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="mañana">☀️ Mañana</option>
              <option value="tarde">🌤️ Tarde</option>
              <option value="noche">🌙 Noche</option>
            </select>
          </div>
        </div>

        {/* PASO 4: INSTRUCCIÓN CLÍNICA DEL MÉDICO VETERINARIO */}
        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase text-slate-700 block">
            4. Prescripción o Indicación Médica:
          </label>
          <textarea
            rows={2}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Instrucciones para el auxiliar/operario (medicamento, dosis, zona a tratar)..."
            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          {/* Plantillas Rápidas de Prescripción */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setInstruction("Administrar tratamiento y dosis según planilla")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-bold"
            >
              + Según Planilla
            </button>
            <button
              type="button"
              onClick={() => setInstruction("Baño medicado shampoo clorhexidina 3% y secado")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-bold"
            >
              + Baño Medicado
            </button>
            <button
              type="button"
              onClick={() => setInstruction("Curación tópica de herida con antiséptico")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-bold"
            >
              + Curación
            </button>
            <button
              type="button"
              onClick={() => setInstruction("Dosis de tableta Bravecto según peso del animal")}
              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-lg font-bold"
            >
              + Bravecto
            </button>
            {selectedAnimal?.isFeral && (
              <button
                type="button"
                onClick={() => setInstruction((prev) => `${prev} [USAR GUANTES Y TOALLA DE CONTENCIÓN]`)}
                className="text-[10px] bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded-lg font-black"
              >
                + Alerta Feral
              </button>
            )}
          </div>
        </div>

        {/* Observaciones Extra */}
        <div>
          <input
            type="text"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="Observaciones adicionales opcionales (ej: 'Revisar vendaje', 'Canil 14')..."
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
          />
        </div>

        {/* BOTÓN DE ACCIÓN FINAL */}
        <div className="pt-2">
          <button
            type="button"
            disabled={!selectedAnimal || isSaving}
            onClick={handleSaveAssignment}
            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
              !selectedAnimal || isSaving
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30 active:scale-95"
            }`}
          >
            <UserCheck className="w-5 h-5" />
            <span>
              {isSaving
                ? "Guardando Asignación..."
                : selectedAnimal
                ? `CONFIRMAR ASIGNACIÓN${assignedStaff ? ` A ${assignedStaff.name.toUpperCase()}` : ""}`
                : "SELECCIONA UN ANIMAL PRIMERO"}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
};
