"use client";
import React, { useState, useEffect } from "react";
import { StaffMember, getAllStaff, getFieldStaff, updateStaffPin, deleteStaffMember, verifyAdminKey, MASTER_ADMIN } from "@/lib/staff";
import { getAuditLogs, getAuditStatsByUser, UserAuditStat } from "@/lib/audit";
import { AuditLogEntry, db, syncAnimalsBidirectional } from "@/lib/db";
import { isSupabaseConfigured, syncAllLocalToSupabase } from "@/lib/supabase";
import {
  ShieldAlert,
  Users,
  FileSpreadsheet,
  Activity,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Trash2,
  X,
  Clock,
  UserCheck,
  Stethoscope,
  Filter,
  Download,
  Database,
  ArrowRight,
} from "lucide-react";

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminAuthenticated?: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"stats" | "audit" | "staff" | "sync">("stats");
  const [userStats, setUserStats] = useState<UserAuditStat[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Filtros de Auditoría
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("TODAS");
  const [filterUser, setFilterUser] = useState<string>("TODOS");

  // Estado para reset de PIN
  const [resetPinUserId, setResetPinUserId] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState("");

  const refreshAllData = async () => {
    setLoading(true);
    try {
      const [stats, logs, staff] = await Promise.all([
        getAuditStatsByUser(),
        getAuditLogs(300),
        getFieldStaff(),
      ]);
      setUserStats(stats);
      setAuditLogs(logs);
      setStaffList(staff);
    } catch (err) {
      console.warn("Error cargando datos del dashboard de admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedAuth = sessionStorage.getItem("cba_admin_auth");
      if (savedAuth === "true") {
        setIsAuthenticated(true);
        refreshAllData();
      } else {
        setIsAuthenticated(false);
        setAdminPin("");
        setAuthError(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminKey(adminPin)) {
      setIsAuthenticated(true);
      sessionStorage.setItem("cba_admin_auth", "true");
      setAuthError(null);
      refreshAllData();
    } else {
      setAuthError("Clave o PIN maestro de Administrador incorrecto.");
    }
  };

  const handleLogoutAdmin = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("cba_admin_auth");
    setAdminPin("");
  };

  const handleResetPin = async (userId: string) => {
    if (!newPinValue.trim() || newPinValue.trim().length < 4) {
      alert("El PIN debe tener al menos 4 dígitos numéricos.");
      return;
    }
    const success = await updateStaffPin(userId, newPinValue.trim());
    if (success) {
      setFeedback("✅ PIN actualizado con éxito.");
      setResetPinUserId(null);
      setNewPinValue("");
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3000);
    } else {
      alert("No se pudo actualizar el PIN.");
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el acceso a ${name}?`)) return;
    await deleteStaffMember(id);
    setFeedback(`🗑️ Usuario ${name} eliminado.`);
    await refreshAllData();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleForceFullSync = async () => {
    setLoading(true);
    try {
      const res = await syncAnimalsBidirectional();
      setFeedback(`☁️ Sincronización completada: ⬇️ ${res.pulled} descargados, ⬆️ ${res.pushed} subidos a Supabase.`);
      await refreshAllData();
    } catch (e: any) {
      setFeedback(`⚠️ Error al sincronizar: ${e?.message || "Fallo de conexión"}`);
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      searchQuery === "" ||
      log.microchip.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.animalName && log.animalName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchAction = filterAction === "TODAS" || log.action === filterAction;
    const matchUser = filterUser === "TODOS" || log.userId === filterUser || log.userName === filterUser;

    return matchSearch && matchAction && matchUser;
  });

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md p-2 sm:p-4 flex items-center justify-center animate-in fade-in">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-200 flex flex-col max-h-[92dvh] sm:max-h-[88vh]">
        
        {/* Cabecera del Dashboard */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/30 text-purple-300 rounded-xl border border-purple-500/40">
              <ShieldAlert className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base leading-tight">
                  Panel de Administración y Control
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-900 text-purple-200 border border-purple-700">
                  Exclusivo Dirección
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Trazabilidad por usuario, auditoría en tiempo real y seguridad de sesiones
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogoutAdmin}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-700"
              >
                Cerrar Sesión Admin
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        {!isAuthenticated ? (
          /* PANTALLA DE ACCESO PROTEGIDO */
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-purple-100 text-purple-800 flex items-center justify-center border-2 border-purple-200 shadow-sm">
              <Lock className="w-8 h-8 text-purple-700" />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                Acceso Exclusivo de Administrador
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Para garantizar la privacidad e integridad de los datos, ingresa la clave maestra de dirección de CBA La Perla.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3 pt-2">
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="Ingresa PIN o Clave Maestra"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-center font-mono font-black text-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-700/25 transition-all"
              >
                <span>Desbloquear Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* PANEL DESBLOQUEADO CON PESTAÑAS */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Feedback Message */}
            {feedback && (
              <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between px-4 animate-in fade-in shrink-0">
                <span>{feedback}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            )}

            {/* Pestañas de Navegación del Dashboard */}
            <div className="flex border-b border-slate-200 bg-slate-50 p-2 gap-1.5 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("stats")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "stats"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Registros por Usuario ({userStats.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "audit"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Auditoría en Tiempo Real ({auditLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("staff")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "staff"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Gestión de Personal ({staffList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("sync")}
                className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "sync"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Control Base de Datos</span>
              </button>

              <div className="ml-auto flex items-center">
                <button
                  type="button"
                  onClick={refreshAllData}
                  disabled={loading}
                  className="p-2 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all"
                  title="Actualizar datos"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* CONTENIDO DE PESTAÑA */}
            <div className="flex-1 p-4 overflow-y-auto">
              
              {/* PESTAÑA 1: REGISTROS POR USUARIO */}
              {activeTab === "stats" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">
                        Desglose de Actividad por Funcionario
                      </h4>
                      <p className="text-xs text-slate-500">
                        Total de animales registrados, modificados y tratamientos instaurados por cada médico y auxiliar.
                      </p>
                    </div>
                  </div>

                  {userStats.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                      <p className="text-xs text-slate-500">
                        Aún no se registran actividades en esta sesión. Los nuevos ingresos y cambios en campo se contabilizarán automáticamente aquí.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {userStats.map((u) => (
                        <div
                          key={u.userId}
                          className="p-4 bg-slate-50 hover:bg-purple-50/40 border border-slate-200 rounded-2xl space-y-3 transition-all shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                                {u.userRole === "veterinario"
                                  ? "DR"
                                  : u.userRole === "auxiliar"
                                  ? "AUX"
                                  : "OP"}
                              </div>
                              <div>
                                <span className="font-black text-slate-900 text-xs block leading-tight">
                                  {u.userName}
                                </span>
                                <span className="text-[10px] text-purple-700 font-bold uppercase">
                                  {u.userRole}
                                </span>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">
                              Última: {new Date(u.lastActive).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
                            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-xs font-black text-purple-900 block">{u.registeredCount}</span>
                              <span className="text-[9px] text-slate-500 font-bold block uppercase">Nuevos</span>
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-xs font-black text-indigo-900 block">{u.modifiedCount}</span>
                              <span className="text-[9px] text-slate-500 font-bold block uppercase">Ediciones</span>
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-xs font-black text-emerald-900 block">{u.treatmentCount}</span>
                              <span className="text-[9px] text-slate-500 font-bold block uppercase">Meds/Rx</span>
                            </div>
                            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                              <span className="text-xs font-black text-blue-900 block">{u.censusCount}</span>
                              <span className="text-[9px] text-slate-500 font-bold block uppercase">Censos</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PESTAÑA 2: AUDITORÍA EN TIEMPO REAL */}
              {activeTab === "audit" && (
                <div className="space-y-3">
                  {/* Barra de Filtros */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por chip, nombre o detalle..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <select
                      value={filterAction}
                      onChange={(e) => setFilterAction(e.target.value)}
                      className="p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="TODAS">Todas las Acciones</option>
                      <option value="REGISTRO_ANIMAL">Nuevos Registros</option>
                      <option value="CAMBIO_UBICACION">Traslados de Canil</option>
                      <option value="CAMBIO_COLOR">Modificación de Color</option>
                      <option value="FOTO_SUBIDA">Fotos Subidas</option>
                      <option value="FOTO_ELIMINADA">Fotos Eliminadas</option>
                      <option value="TRATAMIENTO_PRESCRITO">Tratamientos Prescritos</option>
                      <option value="CENSO_CONFIRMADO">Censos Confirmados</option>
                      <option value="BAJA_FALLECIDO">Bajas por Defunción</option>
                    </select>

                    <select
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                      className="p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="TODOS">Todos los Usuarios</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tabla / Lista de Auditoría */}
                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No se encontraron registros con los filtros seleccionados.
                      </div>
                    ) : (
                      filteredLogs.map((log, idx) => (
                        <div
                          key={log.id || idx}
                          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] text-slate-400">
                                {new Date(log.timestamp).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-200">
                                {log.action.replace(/_/g, " ")}
                              </span>
                              <span className="font-mono font-bold text-slate-700">
                                Chip: {log.microchip}
                              </span>
                            </div>
                            <p className="text-slate-800 font-medium">{log.details}</p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 block text-xs">
                              {log.userName}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              {log.userRole}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* PESTAÑA 3: GESTIÓN DE PERSONAL Y PINS */}
              {activeTab === "staff" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      Personal de Campo y Control de Acceso
                    </h4>
                    <p className="text-xs text-slate-500">
                      Configura el PIN personal para cada empleado y evita que se suplante la identidad en campo.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {staffList.map((staff) => (
                      <div
                        key={staff.id}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-xs ${staff.avatarColor}`}>
                            {staff.role === "veterinario" ? "DR" : staff.role === "auxiliar" ? "AUX" : "OP"}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-xs block leading-tight">
                              {staff.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {staff.role.toUpperCase()} • {staff.email || "Sin correo"} • PIN: {staff.pin ? "••••" : "⚠️ Sin PIN (Acceso Libre)"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {resetPinUserId === staff.id ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in">
                              <input
                                type="password"
                                maxLength={6}
                                value={newPinValue}
                                onChange={(e) => setNewPinValue(e.target.value)}
                                placeholder="Nuevo PIN (4-6)"
                                className="w-24 p-1.5 text-xs text-center border border-purple-300 rounded-lg font-mono font-bold bg-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleResetPin(staff.id)}
                                className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetPinUserId(null);
                                  setNewPinValue("");
                                }}
                                className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setResetPinUserId(staff.id);
                                setNewPinValue("");
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>{staff.pin ? "Cambiar PIN" : "Asignar PIN"}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(staff.id, staff.name)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PESTAÑA 4: CONTROL BASE DE DATOS Y SINCRONIZACIÓN */}
              {activeTab === "sync" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-purple-700" />
                      Estado de Conexión Nube Supabase
                    </h4>
                    <p className="text-xs text-slate-600">
                      {isSupabaseConfigured()
                        ? "✅ Conexión con Supabase configurada y lista para sincronización en tiempo real."
                        : "⚠️ Supabase no está configurado o está en modo offline local."}
                    </p>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleForceFullSync}
                      className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 transition-all"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                      <span>Forzar Sincronización Total Bidireccional</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
