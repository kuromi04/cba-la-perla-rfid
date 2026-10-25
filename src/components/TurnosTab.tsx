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
import { getFieldStaff, StaffMember, MASTER_ADMIN } from "@/lib/staff";
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
  Users,
  Activity,
  Wifi,
  Cloud,
} from "lucide-react";
import {
  ConnectedStaff,
  getConnectedStaff,
  fetchShiftTasksFromSupabase,
  syncShiftTaskToSupabase,
  syncAllTasksToSupabase,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { SupabaseModal } from "@/components/SupabaseModal";

interface TurnosTabProps {
  currentStaffName?: string;
  currentRole?: "operario" | "auxiliar" | "veterinario" | "admin";
  currentArea?: "gatera";
}

export const TurnosTab: React.FC<TurnosTabProps> = ({
  currentStaffName = "",
  currentRole = "veterinario",
}) => {
  const [tasks, setTasks] = useState<ShiftTask[]>([]);
  const [activeShift, setActiveShift] = useState<"todos" | "mañana" | "tarde" | "noche">("todos");
  const [activeLabor, setActiveLabor] = useState<string>("todas");
  const [staffFilter, setStaffFilter] = useState<string>(
    currentRole === "admin" || (currentStaffName && currentStaffName.toLowerCase().includes("admin"))
      ? "todos"
      : (currentStaffName || "todos")
  );
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [connectedStaff, setConnectedStaff] = useState<ConnectedStaff[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [staffDirectoryView, setStaffDirectoryView] = useState<"todos" | "en_linea">("todos");
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isRefreshingStaff, setIsRefreshingStaff] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [animalToAssign, setAnimalToAssign] = useState<SelectedAnimalInfo | null>(null);

  const loadTasks = async (silent: boolean = false) => {
    if (!silent) setIsSyncingCloud(true);
    let list = await generateTodayShiftTasks();

    // Sincronizar en tiempo real con Supabase
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const cloudTasks = await fetchShiftTasksFromSupabase();
        if (cloudTasks && cloudTasks.length > 0) {
          // Unir estados de la nube a la base de datos local
          for (const ct of cloudTasks) {
            const local = list.find(
              (lt) => lt.microchip === ct.microchip && lt.medication === ct.medication
            );
            if (local && local.id) {
              if (local.isCompleted !== ct.isCompleted) {
                await db.shiftTasks.update(local.id, {
                  isCompleted: ct.isCompleted,
                  completedAt: ct.completedAt,
                  completedBy: ct.completedBy,
                  dosisAplicadas: ct.dosisAplicadas,
                  dosisFaltantes: ct.dosisFaltantes,
                });
                local.isCompleted = ct.isCompleted;
                local.completedAt = ct.completedAt;
                local.completedBy = ct.completedBy;
                local.dosisAplicadas = ct.dosisAplicadas;
                local.dosisFaltantes = ct.dosisFaltantes;
              }
            }
          }
        } else if (list.length > 0) {
          // Primera subida de tareas locales a Supabase
          syncAllTasksToSupabase(list).catch(console.warn);
        }
      } catch (err) {
        console.warn("Supabase tasks sync non-blocking error:", err);
      }
    }

    // Sanitizar y liberar cualquier tarea asignada antiguamente a usuarios administradores
    for (const lt of list) {
      if (lt.assignedTo && (lt.assignedTo.toLowerCase().includes("admin") || lt.assignedTo.toLowerCase().includes("camilo"))) {
        lt.assignedTo = undefined;
        lt.assignedRole = undefined;
        if (lt.id) {
          db.shiftTasks.update(lt.id, { assignedTo: undefined, assignedRole: undefined }).catch(() => {});
        }
      }
    }

    setTasks([...list]);
    if (!silent) setIsSyncingCloud(false);
  };

  const loadStaffAndPresence = async () => {
    // Cargar EXCLUSIVAMENTE personal operativo de campo (excluye cuentas de administrador)
    const list = await getFieldStaff();
    setStaffList(list);

    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const connected = await getConnectedStaff();
        // Filtrar administradores para no mostrarlos en la cuadrícula de personal de campo
        const fieldConnected = connected.filter(
          (c) =>
            c.role !== "admin" &&
            c.staff_id !== MASTER_ADMIN.id &&
            !c.staff_name.toLowerCase().includes("admin") &&
            !c.staff_name.toLowerCase().includes("camilo")
        );
        setConnectedStaff(fieldConnected);
      } catch (err) {
        console.warn("Connected staff fetch error:", err);
      }
    }
  };

  useEffect(() => {
    loadTasks();
    loadStaffAndPresence();

    const handleSync = () => {
      loadTasks(true);
      loadStaffAndPresence();
    };
    const handlePresence = () => {
      loadStaffAndPresence();
    };

    window.addEventListener("cba_sync_update", handleSync);
    window.addEventListener("cba_presence_update", handlePresence);

    // Polling en segundo plano cada 12 segundos para supervisión en vivo sin recargar
    const timer = setInterval(() => {
      loadTasks(true);
      loadStaffAndPresence();
    }, 12000);

    return () => {
      window.removeEventListener("cba_sync_update", handleSync);
      window.removeEventListener("cba_presence_update", handlePresence);
      clearInterval(timer);
    };
  }, []);

  const handleToggleTask = async (task: ShiftTask) => {
    if (!task.id) return;
    const newStatus = !task.isCompleted;
    const worker = currentStaffName || "Personal Gatera";

    let doseMsg = "";
    if (newStatus) {
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

    const updatedTaskData = {
      isCompleted: newStatus,
      completedAt: newStatus ? new Date().toISOString() : undefined,
      completedBy: newStatus ? worker : undefined,
      dosisAplicadas: newStatus
        ? (task.dosisAplicadas || 0) + 1
        : Math.max(0, (task.dosisAplicadas || 1) - 1),
      dosisFaltantes: newStatus
        ? Math.max(0, (task.dosisFaltantes || 1) - 1)
        : (task.dosisFaltantes || 0) + 1,
    };

    await db.shiftTasks.update(task.id, updatedTaskData);

    // Sincronizar actualización inmediatamente a Supabase
    if (typeof window !== "undefined" && navigator.onLine) {
      syncShiftTaskToSupabase({
        ...task,
        ...updatedTaskData,
      }).catch(console.warn);
    }

    if (newStatus && typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    setFeedback(
      newStatus
        ? `✅ Labor completada: ${task.animalName} (${task.location})${doseMsg}`
        : `Labor marcada como pendiente`
    );
    setTimeout(() => setFeedback(null), 3500);
    loadTasks(true);
  };

  const handleResetData = async () => {
    if (
      !window.confirm(
        "¿Deseas restablecer y sincronizar el censo de Gatera garantizando 100% de datos oficiales?"
      )
    ) {
      return;
    }
    setIsResetting(true);
    await resetDatabaseWithRealData();
    await loadTasks();
    setIsResetting(false);
    setFeedback("🧹 Censo y tareas de Gatera restablecidas exitosamente.");
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleReassign = async (taskId?: number, newAssignee?: string) => {
    if (!taskId || !newAssignee) return;
    await db.shiftTasks.update(taskId, { assignedTo: newAssignee });
    const targetTask = tasks.find((t) => t.id === taskId);
    if (targetTask && typeof window !== "undefined" && navigator.onLine) {
      syncShiftTaskToSupabase({ ...targetTask, assignedTo: newAssignee }).catch(console.warn);
    }
    setFeedback(`👨‍⚕️ Reasignado a: ${newAssignee}`);
    setTimeout(() => setFeedback(null), 2500);
    loadTasks(true);
  };

  const handlePrintDailyReport = () => {
    window.print();
  };

  // Filtrado 100% exclusivo de GATERA con protección contra valores nulos
  const filterNorm = (staffFilter || "todos").trim().toLowerCase();
  const filteredTasks = tasks.filter((t) => {
    const matchShift = activeShift === "todos" || t.shift === activeShift;
    const matchLabor = activeLabor === "todas" || t.laborType === activeLabor;
    const matchStaff =
      filterNorm === "todos" ||
      (Boolean(t.assignedTo) && t.assignedTo!.toLowerCase().includes(filterNorm)) ||
      (Boolean(t.completedBy) && t.completedBy!.toLowerCase().includes(filterNorm));

    return matchShift && matchLabor && matchStaff;
  });

  const completedCount = tasks.filter((t) => t.isCompleted).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Banner Superior Exclusivo GATERA */}
      <div className="p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black shadow-sm bg-purple-50 border-purple-200 text-purple-900">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐱</span>
          <div>
            <span className="block leading-tight text-sm">
              MÓDULO OFICIAL DE TURNOS: GATERA (461 FELINOS)
            </span>
            <span className="text-[10px] font-medium text-slate-600 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
              Centro de Bienestar Animal La Perla • Supervisión Clínica Exclusiva
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-purple-200 text-purple-900 flex items-center gap-1">
            <Activity className="w-3 h-3 text-purple-700 animate-pulse" />
            {tasks.length} Labores Activas
          </span>
        </div>
      </div>

      {/* 1. PANEL EN VIVO: PERSONAL REGISTRADO, CONECTADO Y SUPERVISIÓN */}
      <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 rounded-xl text-purple-800">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <span>PERSONAL DE GATERA (SUPERVISIÓN & ASIGNACIÓN)</span>
                {connectedStaff.length > 0 && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-slate-500">
                Supervisión de personal registrado y conectado para asignación de turnos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {/* Botón Supabase */}
            <button
              type="button"
              onClick={() => setIsSupabaseModalOpen(true)}
              className={`px-2 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 border transition-all ${
                isSupabaseConfigured()
                  ? "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                  : "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse"
              }`}
              title="Configurar y probar base de datos Supabase"
            >
              <Cloud className="w-3 h-3 text-blue-600" />
              <span>{isSupabaseConfigured() ? "Supabase Nube" : "Conectar Nube"}</span>
            </button>

            {/* Botón Refrescar */}
            <button
              type="button"
              onClick={async () => {
                setIsRefreshingStaff(true);
                await loadStaffAndPresence();
                await loadTasks(true);
                setIsRefreshingStaff(false);
              }}
              disabled={isRefreshingStaff}
              className="p-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all"
              title="Recargar personal desde Supabase y Dexie"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshingStaff ? "animate-spin" : ""}`} />
              <span>Refrescar</span>
            </button>
          </div>
        </div>

        {/* Pestañas de Vista: Todos los Registrados vs Conectados Ahora */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setStaffDirectoryView("todos")}
            className={`flex-1 py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all ${
              staffDirectoryView === "todos"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Todos los Registrados ({staffList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setStaffDirectoryView("en_linea")}
            className={`flex-1 py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all ${
              staffDirectoryView === "en_linea"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Conectados en Vivo ({connectedStaff.length})</span>
          </button>
        </div>

        {/* CONTENIDO SEGÚN PESTAÑA */}
        {staffDirectoryView === "en_linea" ? (
          connectedStaff.length === 0 ? (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs space-y-1">
              <p className="font-bold text-slate-700">No hay otros empleados con sesión activa en este instante.</p>
              <p className="text-[11px] text-slate-500">
                💡 Puedes cambiar a la pestaña <strong>"Todos los Registrados ({staffList.length})"</strong> para asignar tareas a cualquier miembro del personal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {connectedStaff.map((st) => {
                if (!st || !st.staff_name) return null;
                const sName = (st.staff_name || "").toLowerCase();
                const workerTasks = tasks.filter(
                  (t) =>
                    (Boolean(t.assignedTo) && t.assignedTo!.toLowerCase().includes(sName)) ||
                    (Boolean(t.completedBy) && t.completedBy!.toLowerCase().includes(sName))
                );
                const workerDone = workerTasks.filter((t) => t.isCompleted).length;
                const isSelected = (staffFilter || "").toLowerCase() === sName;

                return (
                  <div
                    key={st.staff_id || st.staff_name}
                    onClick={() => setStaffFilter(isSelected ? "todos" : st.staff_name)}
                    className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                      isSelected
                        ? "bg-purple-50 border-purple-400 shadow-sm ring-2 ring-purple-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center font-black text-xs">
                          {st.role === "veterinario"
                            ? "DR"
                            : st.role === "auxiliar"
                            ? "AUX"
                            : "OP"}
                        </div>
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
                      </div>

                      <div>
                        <span className="font-black text-slate-900 block leading-tight">
                          {st.staff_name}
                        </span>
                        <span className="text-[10px] text-slate-500 capitalize">
                          {st.role} • {st.isOnlineNow ? "Activo ahora" : "Reciente"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs font-black text-purple-900 block">
                        {workerDone}/{workerTasks.length}
                      </span>
                      <span className="text-[9px] text-slate-500 font-bold">
                        {isSelected ? "Filtro activo" : "Ver labores"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* VISTA: TODOS LOS REGISTRADOS */
          staffList.length === 0 ? (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs space-y-1">
              <p className="font-bold text-slate-700">No se encontraron empleados registrados aún.</p>
              <p className="text-[11px] text-slate-500">
                Toca en "Registrar Personal" en el menú superior o pulsa "Refrescar" para sincronizar desde Supabase.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {staffList.map((st) => {
                const sName = st.name.toLowerCase();
                const isOnline = connectedStaff.some(
                  (c) =>
                    c.staff_id === st.id ||
                    (c.staff_name && c.staff_name.toLowerCase() === sName)
                );
                const workerTasks = tasks.filter(
                  (t) =>
                    (Boolean(t.assignedTo) && t.assignedTo!.toLowerCase().includes(sName)) ||
                    (Boolean(t.completedBy) && t.completedBy!.toLowerCase().includes(sName))
                );
                const workerDone = workerTasks.filter((t) => t.isCompleted).length;
                const isSelected = (staffFilter || "").toLowerCase() === sName;

                return (
                  <div
                    key={st.id}
                    className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between text-xs ${
                      isSelected
                        ? "bg-purple-50 border-purple-400 shadow-sm ring-2 ring-purple-300"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div
                      onClick={() => setStaffFilter(isSelected ? "todos" : st.name)}
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                    >
                      <div className="relative shrink-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white ${
                            st.avatarColor || "bg-slate-800"
                          }`}
                        >
                          {st.role === "veterinario"
                            ? "DR"
                            : st.role === "auxiliar"
                            ? "AUX"
                            : "OP"}
                        </div>
                        <span
                          className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                            isOnline ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          title={isOnline ? "En línea ahora" : "Desconectado"}
                        ></span>
                      </div>

                      <div className="truncate min-w-0">
                        <span className="font-black text-slate-900 block leading-tight truncate">
                          {st.name}
                        </span>
                        <span className="text-[10px] text-slate-500 capitalize block truncate">
                          {st.role} • {isOnline ? "🟢 En línea" : "⚪ Desconectado"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <div
                        onClick={() => setStaffFilter(isSelected ? "todos" : st.name)}
                        className="text-right cursor-pointer"
                      >
                        <span className="font-mono text-xs font-black text-purple-900 block">
                          {workerDone}/{workerTasks.length}
                        </span>
                        <span className="text-[9px] text-slate-500 font-bold block">
                          {isSelected ? "Activo" : "Ver"}
                        </span>
                      </div>

                      {(currentRole === "veterinario" || currentRole === "admin") && (
                        <button
                          type="button"
                          onClick={() => {
                            setAnimalToAssign(null);
                            setIsAssignModalOpen(true);
                          }}
                          className="p-1 px-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-[10px] rounded-lg transition-all"
                          title={`Asignar labor a ${st.name}`}
                        >
                          + Asignar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* 2. Header con Progreso de Gatera y Opciones de Despacho */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-6 h-6 text-purple-600" />
              <span>Despacho de Turno GATERA</span>
            </h2>
            <p className="text-xs text-slate-500">
              Checklist y cumplimiento de tareas clínicas prescritas por Médicos Veterinarios.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(currentRole === "veterinario" || currentRole === "admin") && (
              <button
                type="button"
                onClick={handleResetData}
                disabled={isResetting}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-300 transition-all"
                title="Limpiar datos demo y sincronizar 100% de archivos oficiales"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? "animate-spin text-purple-600" : ""}`} />
                <span className="hidden sm:inline">Restablecer Censo</span>
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
          <div className="p-3 bg-gradient-to-b from-emerald-50 to-white border border-emerald-200/80 rounded-2xl shadow-xs">
            <span className="text-[10px] font-black uppercase text-emerald-700 block">Cumplidas Hoy</span>
            <span className="text-xl font-black text-emerald-950 font-mono">{completedCount}</span>
            <span className="text-[9px] text-emerald-600 font-bold block">labores OK</span>
          </div>

          <div className="p-3 bg-gradient-to-b from-amber-50 to-white border border-amber-200/80 rounded-2xl shadow-xs">
            <span className="text-[10px] font-black uppercase text-amber-700 block">Faltantes</span>
            <span className="text-xl font-black text-amber-950 font-mono">{tasks.length - completedCount}</span>
            <span className="text-[9px] text-amber-600 font-bold block">pendientes turno</span>
          </div>

          <div className="p-3 bg-gradient-to-b from-purple-50 to-white border border-purple-200/80 rounded-2xl shadow-xs">
            <span className="text-[10px] font-black uppercase text-purple-700 block">Efectividad</span>
            <span className="text-xl font-black text-purple-950 font-mono">{progressPercent}%</span>
            <span className="text-[9px] text-purple-600 font-bold block">del total</span>
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
            className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-700 via-indigo-700 to-emerald-700 hover:from-purple-600 hover:to-emerald-600 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-purple-700/25 active:scale-95 transition-all"
          >
            <PlusCircle className="w-5 h-5 text-purple-200" />
            <span>🐾 ASIGNAR ANIMAL DE GATERA A OPERARIO / AUXILIAR</span>
          </button>
        )}

        {/* Barra de Progreso de Gatera */}
        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Cumplimiento Total GATERA:</span>
            <span className="font-mono text-sm text-purple-700 font-black">
              {completedCount} / {tasks.length} labores ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full rounded-full transition-all duration-500 shadow-sm bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500"
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
            Todos ({tasks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveShift("mañana")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeShift === "mañana" ? "bg-white text-amber-700 shadow-sm" : "text-slate-500"
            }`}
          >
            ☀️ Mañana ({tasks.filter((t) => t.shift === "mañana").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveShift("tarde")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeShift === "tarde" ? "bg-white text-orange-700 shadow-sm" : "text-slate-500"
            }`}
          >
            🌤️ Tarde ({tasks.filter((t) => t.shift === "tarde").length})
          </button>
          <button
            type="button"
            onClick={() => setActiveShift("noche")}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeShift === "noche" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"
            }`}
          >
            🌙 Noche ({tasks.filter((t) => t.shift === "noche").length})
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

      {/* 3. Lista de Tareas con Botón Táctil Gigante (56px) */}
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
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black flex items-center gap-1 bg-purple-100 text-purple-900 border border-purple-200">
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

                {/* Reasignación por el Veterinario y Auditoría */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-600" />
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
                      <CheckCircle2 className="w-3.5 h-3.5" /> Dosis aplicada por: {task.completedBy || "Personal de Turno"}
                      {(() => {
                        try {
                          const d = new Date(task.completedAt);
                          if (!isNaN(d.getTime())) {
                            return ` a las ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
                          }
                        } catch {
                          // ignore formatting errors
                        }
                        return "";
                      })()}
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
        userArea="gatera"
        onSuccess={() => {
          loadTasks();
          loadStaffAndPresence();
          setFeedback("🐾 Felino asignado con éxito al turno de Gatera");
          setTimeout(() => setFeedback(null), 3000);
        }}
      />

      {/* Modal de Supabase Cloud */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigChanged={() => {
          loadStaffAndPresence();
          loadTasks(true);
        }}
      />
    </div>
  );
};
