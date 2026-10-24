"use client";
import React, { useState, useEffect } from "react";
import {
  db,
  ShiftTask,
  generateTodayShiftTasks,
  applyDoseToTreatment,
  revertDoseFromTreatment,
  resetDatabaseWithRealData,
} from "@/lib/db";
import { getAllStaff, StaffMember } from "@/lib/staff";
import { AssignAnimalModal, SelectedAnimalInfo } from "@/components/AssignAnimalModal";
import {
  CheckCircle2,
  Clock,
  Pill,
  ShowerHead,
  Wind,
  Sparkles,
  MapPin,
  AlertTriangle,
  Printer,
  Filter,
  CheckSquare,
  Square,
  User,
  ShieldCheck,
  Check,
  PlusCircle,
  UserCheck,
  Award,
  RefreshCw,
} from "lucide-react";

interface TurnosTabProps {
  currentStaffName?: string;
  currentRole?: "operario" | "auxiliar" | "veterinario" | "admin";
  currentArea?: "gatera";
}

export const TurnosTab: React.FC<TurnosTabProps> = ({
  currentStaffName = "",
  currentRole = "veterinario",
  currentArea = "gatera",
}) => {
  const isExclusiveGatera = true;
  const isExclusiveCaninos = false;
  const defaultArea = "gatera";

  const [tasks, setTasks] = useState<ShiftTask[]>([]);
  const [turnosArea, setTurnosArea] = useState<"caninos" | "gatera">("gatera");
  const [activeShift, setActiveShift] = useState<"todos" | "mañana" | "tarde" | "noche">("todos");
  const [activeLabor, setActiveLabor] = useState<string>("todas");
  const [staffFilter, setStaffFilter] = useState<string>(currentStaffName || "todos");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [animalToAssign, setAnimalToAssign] = useState<SelectedAnimalInfo | null>(null);

  const loadTasks = async () => {
    const list = await generateTodayShiftTasks();
    setTasks(list);
  };

  const loadStaff = async () => {
    const list = await getAllStaff();
    setStaffList(list);
  };

  useEffect(() => {
    loadTasks();
    loadStaff();
  }, []);

  // Mantener sincronizada el área exclusiva del usuario activo
  useEffect(() => {
    if (isExclusiveGatera) {
      setTurnosArea("gatera");
    } else if (isExclusiveCaninos) {
      setTurnosArea("caninos");
    }
  }, [currentArea, isExclusiveGatera, isExclusiveCaninos]);

  const handleToggleTask = async (task: ShiftTask) => {
    if (!task.id) return;
    const newStatus = !task.isCompleted;
    const worker = currentStaffName || "Personal CBA";

    let doseMsg = "";
    if (newStatus) {
      // Si tiene kardexId vinculado o es medicación/bravecto, descontamos la dosis
      if (task.kardexId) {
        const res = await applyDoseToTreatment(task.kardexId, worker, currentRole);
        if (res) {
          if (res.isCulminated) {
            doseMsg = ` • 🏆 ¡Tratamiento culminado al 100%!`;
          } else {
            doseMsg = ` • (Dosis ${res.updated.dosisAplicadas}/${res.updated.dosisTotales} - Faltan ${res.updated.dosisFaltantes})`;
          }
        }
      }
    } else {
      if (task.kardexId) {
        await revertDoseFromTreatment(task.kardexId, worker);
      }
    }

    await db.shiftTasks.update(task.id, {
      isCompleted: newStatus,
      completedAt: newStatus ? new Date().toISOString() : undefined,
      completedBy: newStatus ? worker : undefined,
      dosisAplicadas: newStatus ? (task.dosisAplicadas || 0) + 1 : Math.max(0, (task.dosisAplicadas || 1) - 1),
      dosisFaltantes: newStatus ? Math.max(0, (task.dosisFaltantes || 1) - 1) : (task.dosisFaltantes || 0) + 1,
    });

    if (newStatus && typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    setFeedback(
      newStatus
        ? `✅ Labor completada: ${task.animalName} (${task.location})${doseMsg}`
        : `Labor marcada como pendiente`
    );
    setTimeout(() => setFeedback(null), 3500);
    loadTasks();
  };

  const handleResetData = async () => {
    if (!window.confirm("¿Deseas sincronizar y garantizar que la base de datos tenga únicamente los datos reales de los archivos Excel?")) {
      return;
    }
    setIsResetting(true);
    await resetDatabaseWithRealData();
    await loadTasks();
    setIsResetting(false);
    setFeedback("🧹 Base de datos restablecida con 100% datos reales de los archivos.");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleReassign = async (taskId?: number, newAssignee?: string) => {
    if (!taskId || !newAssignee) return;
    await db.shiftTasks.update(taskId, { assignedTo: newAssignee });
    setFeedback(`👨‍⚕️ Reasignado a: ${newAssignee}`);
    setTimeout(() => setFeedback(null), 2500);
    loadTasks();
  };

  const handlePrintDailyReport = () => {
    window.print();
  };

  const filteredTasks = tasks.filter((t) => {
    const matchArea = t.area === turnosArea;
    const matchShift = activeShift === "todos" || t.shift === activeShift;
    const matchLabor = activeLabor === "todas" || t.laborType === activeLabor;
    const matchStaff =
      staffFilter === "todos" ||
      (t.assignedTo && t.assignedTo.toLowerCase().includes(staffFilter.toLowerCase()));

    return matchArea && matchShift && matchLabor && matchStaff;
  });

  const areaTasks = tasks.filter((t) => t.area === turnosArea);
  const completedCount = areaTasks.filter((t) => t.isCompleted).length;
  const progressPercent = areaTasks.length > 0 ? Math.round((completedCount / areaTasks.length) * 100) : 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Banner Superior Exclusivo GATERA */}
      <div className="p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black shadow-sm bg-purple-50 border-purple-200 text-purple-900">
        <div className="flex items-center gap-2">
          <span className="text-base">🐱</span>
          <div>
            <span className="block leading-tight">
              MÓDULO OFICIAL DE TURNOS: GATERA (FELINOS)
            </span>
            <span className="text-[10px] font-medium text-slate-500">
              Personal asignado exclusivamente a GATERA
            </span>
          </div>
        </div>
        <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-purple-200 text-purple-900">
          {areaTasks.length} Labores Activas
        </span>
      </div>

      {/* 1. Header con Progreso y Opciones de Despacho */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Clock
                className={`w-6 h-6 ${turnosArea === "gatera" ? "text-purple-600" : "text-emerald-600"}`}
              />
              {turnosArea === "gatera" ? "Despacho GATERA" : "Despacho CANINOS"}
            </h2>
            <p className="text-xs text-slate-500">
              Checklist y cumplimiento de tareas prescritas por el Médico Veterinario.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(currentRole === "veterinario" || currentRole === "admin") && (
              <button
                type="button"
                onClick={handleResetData}
                disabled={isResetting}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-300 transition-all"
                title="Limpiar datos demo y recargar 100% de archivos Excel"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin text-indigo-600" : ""}`} />
                <span className="hidden sm:inline">Limpiar Muestras</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrintDailyReport}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>IMPRIMIR</span>
            </button>
          </div>
        </div>

        {/* Dashboard de Cumplimiento & Faltantes del Turno */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-emerald-700 block">Cumplidas Hoy</span>
            <span className="text-lg font-black text-emerald-900">{completedCount}</span>
            <span className="text-[9px] text-emerald-600 block">labores OK</span>
          </div>

          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-amber-700 block">Faltantes</span>
            <span className="text-lg font-black text-amber-900">{areaTasks.length - completedCount}</span>
            <span className="text-[9px] text-amber-600 block">pendientes turno</span>
          </div>

          <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-2xl">
            <span className="text-[10px] font-black uppercase text-purple-700 block">Efectividad</span>
            <span className="text-lg font-black text-purple-900">{progressPercent}%</span>
            <span className="text-[9px] text-purple-600 block">del total</span>
          </div>
        </div>

        {/* Botón Principal para el Médico Veterinario: ASIGNAR ANIMAL */}
        {(currentRole === "veterinario" || currentRole === "admin") && (
          <button
            type="button"
            onClick={() => {
              setAnimalToAssign(null);
              setIsAssignModalOpen(true);
            }}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-500 hover:to-indigo-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all"
          >
            <PlusCircle className="w-5 h-5 text-emerald-200" />
            <span>🐾 ASIGNAR ANIMAL A OPERARIO / AUXILIAR</span>
          </button>
        )}

        {/* Mensaje de Operario en Sesión Mágica si aplica */}
        {currentStaffName && (
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs text-indigo-900 font-bold">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" /> Sesión Mágica Activa: {currentStaffName}
            </span>
            <button
              onClick={() => setStaffFilter(currentStaffName)}
              className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px]"
            >
              Ver Solo Mis Labores
            </button>
          </div>
        )}

        {/* Barra de Progreso del Área Activa */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Cumplimiento {turnosArea.toUpperCase()}:</span>
            <span
              className={`font-mono text-sm ${
                turnosArea === "gatera" ? "text-purple-700 font-black" : "text-emerald-700 font-black"
              }`}
            >
              {completedCount} / {areaTasks.length} labores ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 shadow-sm ${
                turnosArea === "gatera" ? "bg-purple-600" : "bg-emerald-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {feedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Selector de Turnos (Mañana / Tarde / Noche) */}
        <div className="flex p-1 bg-slate-100 rounded-2xl gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveShift("todos")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeShift === "todos" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Todos ({areaTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveShift("mañana")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeShift === "mañana" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500"
            }`}
          >
            ☀️ Mañana ({areaTasks.filter((t) => t.shift === "mañana").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveShift("tarde")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeShift === "tarde" ? "bg-white text-orange-700 shadow-sm" : "text-slate-500"
            }`}
          >
            🌤️ Tarde ({areaTasks.filter((t) => t.shift === "tarde").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveShift("noche")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeShift === "noche" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
            }`}
          >
            🌙 Noche ({areaTasks.filter((t) => t.shift === "noche").length})
          </button>
        </div>

        {/* Filtro por Trabajador Asignado */}
        <div className="flex items-center gap-2 pt-1 text-xs">
          <span className="text-[11px] font-bold text-slate-500 shrink-0">Asignado a:</span>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none"
          >
            <option value="todos">Todos los Trabajadores de Gatera</option>
            {staffList.map((st) => (
              <option key={st.id} value={st.name}>
                {st.name} ({st.role.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Lista de Tareas con Botón Táctil Gigante (56px) */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            No hay tareas pendientes en este turno con los filtros seleccionados.
          </div>
        ) : (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className={`p-4 rounded-3xl border transition-all flex items-start justify-between gap-3 shadow-sm select-none ${
                task.isCompleted
                  ? "bg-slate-50 border-emerald-200 opacity-60"
                  : "bg-white border-slate-200 hover:border-indigo-300"
              }`}
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black flex items-center gap-1 ${
                      task.area === "gatera"
                        ? "bg-purple-100 text-purple-900 border border-purple-200"
                        : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                    }`}
                  >
                    <MapPin className="w-3 h-3" /> {task.location}
                  </span>
                  <span className="font-bold text-slate-900 text-sm">{task.animalName}</span>
                </div>

                {task.isFeral && (
                  <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200 animate-pulse">
                    ⚠️ Felino Feral (Guantes obligatorios)
                  </span>
                )}

                {/* Labor a realizar */}
                <div className="p-2.5 bg-slate-50 rounded-xl text-xs font-semibold text-slate-800 space-y-1">
                  <span className="text-slate-500 uppercase text-[10px] font-bold block">
                    Labor asignada:
                  </span>
                  <p className="text-slate-900 font-bold">{task.medication}</p>

                  {task.dosisTotales && (
                    <div className="mt-1 flex items-center justify-between text-[10px] font-bold bg-white p-1.5 rounded-lg border border-slate-200">
                      <span className="text-slate-700">
                        Dosis: <strong>{task.dosisAplicadas || 0}</strong> de <strong>{task.dosisTotales}</strong>
                      </span>
                      <span className={task.dosisFaltantes === 0 ? "text-emerald-700 font-black" : "text-amber-800"}>
                        {task.dosisFaltantes === 0 ? "🏆 Culminado" : `Faltan: ${task.dosisFaltantes}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Reasignación por el Veterinario */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Asignado:</span>
                    {currentRole === "veterinario" || currentRole === "admin" ? (
                      <select
                        value={task.assignedTo || "Sin Asignar"}
                        onChange={(e) => handleReassign(task.id, e.target.value)}
                        className="bg-white border border-slate-300 text-slate-900 font-bold px-1.5 py-0.5 rounded-md text-[11px]"
                      >
                        <option value="Sin Asignar">Sin Asignar</option>
                        {staffList.map((st) => (
                          <option key={st.id} value={st.name}>
                            {st.name} ({st.role.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <strong className="text-slate-800">{task.assignedTo || "Sin asignar"}</strong>
                    )}
                  </div>

                  {task.isCompleted && task.completedAt && (
                    <div className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Administrado a las{" "}
                      {new Date(task.completedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Checkbox táctil grande (56px de altura) */}
              <button
                type="button"
                onClick={() => handleToggleTask(task)}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                  task.isCompleted
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-95"
                    : "bg-slate-100 text-slate-400 border-2 border-slate-300 hover:border-emerald-500"
                }`}
              >
                {task.isCompleted ? <CheckSquare className="w-7 h-7" /> : <Square className="w-7 h-7" />}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal para Asignar Animal a Operario / Auxiliar */}
      <AssignAnimalModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        initialAnimal={animalToAssign}
        userArea={turnosArea}
        onSuccess={() => {
          loadTasks();
          setFeedback("🐾 Animal asignado con éxito al turno");
          setTimeout(() => setFeedback(null), 3000);
        }}
      />
    </div>
  );
};
