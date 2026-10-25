"use client";
import React, { useState, useEffect } from "react";
import { initializeDatabaseIfEmpty, deduplicateDatabaseRecords, syncAnimalsBidirectional, db } from "@/lib/db";
import { ScannerTab } from "@/components/ScannerTab";
import { PlanillaEditorTab } from "@/components/PlanillaEditorTab";
import { KardexTab } from "@/components/KardexTab";
import { CensusTab } from "@/components/CensusTab";
import { TurnosTab } from "@/components/TurnosTab";
import { MagicLinkModal } from "@/components/MagicLinkModal";
import { LoginModal } from "@/components/LoginModal";
import { SupabaseModal } from "@/components/SupabaseModal";
import { AdminDashboardModal } from "@/components/AdminDashboardModal";
import { PresenceModal } from "@/components/PresenceModal";
import { AlcaldiaMedellinLogo, LaPerlaLogo, DeveloperCredit } from "@/components/OfficialLogos";
import { StaffMember, getAllStaff, getFieldStaff, canEditAnimals, registerStaffMember } from "@/lib/staff";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  Scan,
  TableProperties,
  ClipboardList,
  FileSpreadsheet,
  CheckSquare,
  Wifi,
  WifiOff,
  Link2,
  UserCheck,
  XCircle,
  ChevronDown,
  ArrowUp,
  Cloud,
  Shield,
  Users,
  Smartphone,
  Laptop,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import {
  isSupabaseConfigured,
  syncAllLocalToSupabase,
  recordStaffPresence,
  saveSupabaseCredentials,
  startPresenceMonitoring,
  setupRealtimeDatabaseSync,
  getConnectedStaff,
  ConnectedStaff,
  getHumanReadableDevice,
} from "@/lib/supabase";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"scanner" | "turnos" | "planilla" | "kardex" | "census">("scanner");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [activeCatsCount, setActiveCatsCount] = useState<number>(439);
  
  // Usuario activo en sesión (obtenido dinámicamente)
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [isMagicModalOpen, setIsMagicModalOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState<boolean>(false);
  const [connectedStaff, setConnectedStaff] = useState<ConnectedStaff[]>([]);
  const [isPresenceModalOpen, setIsPresenceModalOpen] = useState<boolean>(false);
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const [scannedChipParam, setScannedChipParam] = useState<string>("");
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const windowOffset = window.scrollY || document.documentElement.scrollTop;
      const containerOffset = contentRef.current?.scrollTop || 0;
      if (windowOffset > 180 || containerOffset > 180) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    const container = contentRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (container) {
        container.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const refreshActiveCatsCount = async () => {
    try {
      const count = await db.animals
        .filter(
          (a) =>
            a.species === "gato" &&
            a.location?.toUpperCase().trim() !== "FALLECIDO" &&
            a.status?.toLowerCase().trim() !== "fallecido"
        )
        .count();
      if (count > 0) setActiveCatsCount(count);
    } catch {}
  };

  useEffect(() => {
    // 1. Cargar datos 100% reales de los archivos Excel en IndexedDB y garantizar cero duplicados
    initializeDatabaseIfEmpty()
      .then(() => deduplicateDatabaseRecords())
      .then(() => refreshActiveCatsCount())
      .then(() => {
        if (navigator.onLine && isSupabaseConfigured()) {
          syncAnimalsBidirectional()
            .then(() => refreshActiveCatsCount())
            .catch(console.error);
        }
      })
      .catch(console.error);

    // 2. Detección de sesión y personal registrado dinámicamente
    const initSession = async () => {
      const staff = await getFieldStaff();

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const sbUrl = params.get("sb_url");
        const sbKey = params.get("sb_key");
        if (sbUrl && sbKey) {
          try {
            saveSupabaseCredentials(decodeURIComponent(sbUrl), decodeURIComponent(sbKey));
          } catch (e) {
            console.warn("Auto-save Supabase credentials from magic link failed:", e);
          }
        }

        const token = params.get("token");
        const userId = params.get("user");

        const chipParam = params.get("chip");
        if (chipParam) {
          setScannedChipParam(chipParam);
          setActiveTab("scanner");
        }

        if (token || userId) {
          let found = staff.find((s) => s.token === token || s.id === userId);
          if (!found) {
            const nameParam = params.get("name");
            const roleParam = params.get("role") as any;
            if (nameParam) {
              try {
                found = await registerStaffMember({
                  name: decodeURIComponent(nameParam),
                  role: roleParam || "operario",
                  area: "gatera",
                });
              } catch (e) {
                console.warn("Auto-register staff from magic link failed:", e);
              }
            }
          }
          if (found) {
            setCurrentUser(found);
            try {
              localStorage.setItem("cba_laperla_active_user", found.id);
            } catch {}
            if (!chipParam) setActiveTab("turnos");
            return;
          }
        } else {
          // Recuperar última sesión guardada si existe (ignorando sesiones antiguas de admin)
          const savedUserId = localStorage.getItem("cba_laperla_active_user");
          if (savedUserId && !savedUserId.toLowerCase().includes("admin")) {
            const found = staff.find((s) => s.id === savedUserId);
            if (found) {
              setCurrentUser(found);
              return;
            }
          }
        }
      }

      if (staff.length > 0) {
        setCurrentUser(staff[0]);
      } else {
        // Si no hay ningún empleado registrado, abrir automáticamente el modal de registro
        setIsLoginModalOpen(true);
      }
    };

    initSession();

    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      syncAnimalsBidirectional().then(() => refreshActiveCatsCount()).catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const staffTimer = setInterval(() => {
      if (navigator.onLine) {
        getFieldStaff().catch(() => {});
        syncAnimalsBidirectional().then(() => refreshActiveCatsCount()).catch(() => {});
      } else {
        refreshActiveCatsCount().catch(() => {});
      }
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(staffTimer);
    };
  }, []);

  // Transmitir presencia activa en tiempo real (Heartbeat 15s) y escuchar cambios en tiempo real
  useEffect(() => {
    // 1. Monitoreo de presencia en vivo de profesionales (móvil y PC)
    const stopPresence = startPresenceMonitoring(currentUser, (staff) => {
      setConnectedStaff(staff);
    });

    // 2. Suscripción a cambios en tiempo real desde Supabase (WebSocket)
    const stopRealtimeSync = setupRealtimeDatabaseSync((entity, data) => {
      if (entity === "animal") {
        setRealtimeToast(
          `🔄 Sincronizado en tiempo real: ${data.name || data.microchip} en ${data.location}`
        );
        refreshActiveCatsCount();
        setTimeout(() => setRealtimeToast(null), 4500);
      } else if (entity === "task") {
        setRealtimeToast(`📋 Tarea de turno actualizada desde otro dispositivo`);
        setTimeout(() => setRealtimeToast(null), 3500);
      }
    });

    // 3. Escuchar evento de actualización de presencia local
    const handlePresenceEvent = () => {
      getConnectedStaff().then((staff) => setConnectedStaff(staff)).catch(() => {});
    };
    const handleActiveUserUpdated = (e: any) => {
      if (e.detail) {
        setCurrentUser(e.detail);
      }
    };
    const handleActiveUserDeleted = async () => {
      const remaining = await getFieldStaff();
      if (remaining.length > 0) {
        handleSelectUser(remaining[0]);
      } else {
        setCurrentUser(null);
        setIsLoginModalOpen(true);
      }
    };

    window.addEventListener("cba_presence_update", handlePresenceEvent);
    window.addEventListener("cba_active_user_updated", handleActiveUserUpdated);
    window.addEventListener("cba_active_user_deleted", handleActiveUserDeleted);

    return () => {
      stopPresence();
      stopRealtimeSync();
      window.removeEventListener("cba_presence_update", handlePresenceEvent);
      window.removeEventListener("cba_active_user_updated", handleActiveUserUpdated);
      window.removeEventListener("cba_active_user_deleted", handleActiveUserDeleted);
    };
  }, [currentUser]);

  const handleSelectUser = (user: StaffMember) => {
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("cba_laperla_active_user", user.id);
    }
    recordStaffPresence(user);
  };

  const handleSelectWorkerSession = (member: StaffMember) => {
    handleSelectUser(member);
    setActiveTab("turnos");
  };

  const isVetOrAdmin = currentUser ? canEditAnimals(currentUser.role) : false;

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-slate-100 text-slate-900 flex flex-col max-w-xl mx-auto shadow-2xl relative">
      {/* 1. Header Oficial: Alcaldía de Medellín & CBA La Perla */}
      <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 text-white p-3.5 shadow-xl space-y-2.5">
        
        {/* Fila 1: Logotipos Oficiales */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <AlcaldiaMedellinLogo className="h-7" />
          <LaPerlaLogo className="h-7" />
        </div>

        {/* Fila 2: Usuario en Sesión (Médico / Operario) y Botones de Acción */}
        <div className="flex items-center justify-between gap-2">
          {/* Botón Selector de Usuario Activo */}
          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-2xl border transition-all active:scale-95 text-left shadow-xs ${
              isVetOrAdmin
                ? "bg-slate-900/90 border-emerald-500/50 hover:bg-slate-800/90 hover:border-emerald-400"
                : "bg-slate-900/90 border-amber-500/50 hover:bg-slate-800/90 hover:border-amber-400"
            }`}
            title="Cambiar usuario o médico veterinario activo"
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-[10px] shrink-0 shadow-xs ${
                currentUser ? currentUser.avatarColor : "bg-indigo-600 text-white"
              }`}
            >
              {currentUser ? (
                currentUser.role === "veterinario"
                  ? "DR"
                  : currentUser.role === "auxiliar"
                  ? "AUX"
                  : "OP"
              ) : (
                "➕"
              )}
            </div>

            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span className="font-black text-xs text-white leading-tight">
                  {currentUser ? currentUser.name : "Registrar Personal"}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </div>
              <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">
                {currentUser ? `${currentUser.role} • ${currentUser.area.toUpperCase()}` : "CBA LA PERLA"}
              </span>
            </div>
          </button>

          {/* Acciones Rápidas */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón Presencia en Vivo: Profesionales Conectados (Móvil & PC) */}
            <button
              type="button"
              onClick={() => setIsPresenceModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/50 px-2.5 py-1.5 rounded-xl text-[11px] font-black shadow-xs active:scale-95 transition-all"
              title="Ver profesionales conectados en tiempo real desde PC o Móvil"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>{connectedStaff.filter((s) => s.isOnlineNow).length || (currentUser ? 1 : 0)}</span>
              <span className="hidden sm:inline">en línea</span>
            </button>

            {/* Botón Panel de Administración & Auditoría */}
            <button
              type="button"
              onClick={() => setIsAdminDashboardOpen(true)}
              className="flex items-center gap-1 bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-600 hover:to-indigo-700 text-white text-[11px] font-black px-2.5 py-1.5 rounded-xl shadow-sm border border-purple-400/40 active:scale-95 transition-all"
              title="Panel de Administración, Auditoría y Control de Personal"
            >
              <Shield className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden xs:inline">Admin</span>
            </button>

            {/* Botón Link Mágico */}
            <button
              type="button"
              onClick={() => setIsMagicModalOpen(true)}
              className="flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-[11px] font-black px-2.5 py-1.5 rounded-xl shadow-sm border border-indigo-400/40 active:scale-95 transition-all"
              title="Generar Link Mágico para Auxiliares y Operarios"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Link Mágico</span>
            </button>

            {/* Botón Estado y Configuración Supabase Cloud */}
            <button
              type="button"
              onClick={() => setIsSupabaseModalOpen(true)}
              className={`p-1.5 px-2 rounded-xl border flex items-center gap-1 text-[10px] font-bold active:scale-95 transition-all ${
                isSupabaseConfigured()
                  ? "bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30 animate-pulse"
              }`}
              title={
                isSupabaseConfigured()
                  ? "Supabase Configurado: Clic para ver estado y sincronizar personal"
                  : "⚠️ Supabase Desconectado: Clic para conectar y ver a los empleados registrados"
              }
            >
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden xs:inline">
                {isSupabaseConfigured() ? "Nube" : "Conectar"}
              </span>
            </button>

            {/* Estado de Red */}
            <span
              className={`p-1.5 rounded-xl border flex items-center justify-center ${
                isOnline
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border-amber-500/30"
              }`}
              title={isOnline ? "Conexión Online activa" : "Modo Offline (IndexedDB local)"}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </span>
          </div>
        </div>

        {/* Fila 3: Sub-barra de Población Activa 100% Real adaptada a GATERA */}
        <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            Sistema Oficial Exclusivo:
          </span>
          <div className="flex gap-2 text-[11px] font-bold">
            <span className="bg-purple-950/80 text-purple-300 border border-purple-700/60 px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-ping"></span>
              🐱 Gatera CBA La Perla ({activeCatsCount} Felinos Activos • Censo Dinámico)
            </span>
          </div>
        </div>

        {/* Banner Informativo Modo Campo (Offline) */}
        {!isOnline && (
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-200 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-1.5">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Modo Campo (Sin WiFi): Todos los escaneos y registros se guardan localmente.</span>
            </div>
            <span className="text-[9px] bg-amber-400/30 text-amber-100 px-1.5 py-0.5 rounded font-black uppercase">
              100% Offline
            </span>
          </div>
        )}
      </header>

      {/* 2. Contenido Dinámico según Pestaña */}
      <div ref={contentRef} className="flex-1 p-3.5 pb-36 overflow-y-auto">
        {activeTab === "scanner" && (
          <ScannerTab
            initialChip={scannedChipParam}
            onGoToPlanilla={() => setActiveTab("planilla")}
            currentUser={currentUser}
          />
        )}
        {activeTab === "turnos" && (
          <TurnosTab
            currentStaffName={currentUser?.name || ""}
            currentRole={currentUser?.role || "veterinario"}
            currentArea={currentUser?.area || "gatera"}
          />
        )}
        {activeTab === "planilla" && (
          <PlanillaEditorTab
            currentUser={currentUser}
            canEdit={isVetOrAdmin}
          />
        )}
        {activeTab === "kardex" && (
          <KardexTab
            currentUser={currentUser}
          />
        )}
        {activeTab === "census" && (
          <CensusTab
            currentUser={currentUser}
          />
        )}

        {/* Crédito de Desarrollador */}
        <DeveloperCredit />
      </div>

      {/* Botón Flotante "Volver Arriba" (Responsive Mobile & Desktop) */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 sm:right-[max(1rem,calc(50%-270px))] z-30 p-3 bg-slate-900/90 hover:bg-slate-900 text-white rounded-full shadow-2xl border-2 border-emerald-500/80 active:scale-90 transition-all duration-300 flex items-center justify-center gap-1.5 text-xs font-black backdrop-blur-md animate-in fade-in zoom-in-90"
          title="Volver al inicio"
          aria-label="Volver arriba"
        >
          <ArrowUp className="w-5 h-5 text-emerald-400" />
          <span className="text-[10px] uppercase tracking-wider pr-1 hidden xs:inline">Subir</span>
        </button>
      )}

      {/* Modal de Identificación / Inicio de Sesión de Médicos y Personal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
        onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
      />

      {/* Modal de Dashboard de Administración y Auditoría */}
      <AdminDashboardModal
        isOpen={isAdminDashboardOpen}
        onClose={() => setIsAdminDashboardOpen(false)}
      />

      {/* Modal Generador de Links Mágicos */}
      <MagicLinkModal
        isOpen={isMagicModalOpen}
        onClose={() => setIsMagicModalOpen(false)}
        onSelectWorkerSession={handleSelectWorkerSession}
      />

      {/* Modal de Configuración y Diagnóstico de Supabase Cloud */}
      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onConfigChanged={async () => {
          const list = await getFieldStaff();
          if (list.length > 0 && !currentUser) {
            setCurrentUser(list[0]);
          }
        }}
      />

      {/* Modal de Presencia de Personal en Vivo & Multi-Dispositivo */}
      <PresenceModal
        isOpen={isPresenceModalOpen}
        onClose={() => setIsPresenceModalOpen(false)}
        connectedStaff={connectedStaff}
        currentUser={currentUser}
        onForceSync={async () => {
          await syncAnimalsBidirectional();
          await refreshActiveCatsCount();
          const updatedStaff = await getConnectedStaff();
          setConnectedStaff(updatedStaff);
        }}
      />

      {/* Toast Flotante de Sincronización en Tiempo Real */}
      {realtimeToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90%] bg-slate-900/95 text-emerald-300 border border-emerald-500/50 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="flex-1 truncate">{realtimeToast}</span>
        </div>
      )}

      {/* 3. Barra de Navegación Inferior Flotante ("Glass Dock") */}
      <nav className="fixed bottom-3 left-3 right-3 max-w-lg mx-auto bg-slate-950/90 backdrop-blur-2xl border border-slate-800/90 rounded-3xl p-1.5 px-3 flex justify-between items-center z-30 shadow-2xl shadow-black/60">
        <button
          type="button"
          onClick={() => setActiveTab("scanner")}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-95 ${
            activeTab === "scanner"
              ? "text-emerald-400 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-200"
          }`}
        >
          <div
            className={`p-2 rounded-2xl transition-all ${
              activeTab === "scanner"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/50"
                : "hover:bg-slate-800/70"
            }`}
          >
            <Scan className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Escanear</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("turnos")}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-95 ${
            activeTab === "turnos"
              ? "text-indigo-400 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-200"
          }`}
        >
          <div
            className={`p-2 rounded-2xl transition-all ${
              activeTab === "turnos"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40 ring-2 ring-indigo-400/50"
                : "hover:bg-slate-800/70"
            }`}
          >
            <CheckSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Turnos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("planilla")}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-95 ${
            activeTab === "planilla"
              ? "text-emerald-400 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-200"
          }`}
        >
          <div
            className={`p-2 rounded-2xl transition-all ${
              activeTab === "planilla"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/50"
                : "hover:bg-slate-800/70"
            }`}
          >
            <TableProperties className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Planilla</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kardex")}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-95 ${
            activeTab === "kardex"
              ? "text-emerald-400 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-200"
          }`}
        >
          <div
            className={`p-2 rounded-2xl transition-all ${
              activeTab === "kardex"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/50"
                : "hover:bg-slate-800/70"
            }`}
          >
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Kardex</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("census")}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-2xl transition-all duration-200 active:scale-95 ${
            activeTab === "census"
              ? "text-emerald-400 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-200"
          }`}
        >
          <div
            className={`p-2 rounded-2xl transition-all ${
              activeTab === "census"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 ring-2 ring-emerald-400/50"
                : "hover:bg-slate-800/70"
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-wide">Censo</span>
        </button>
      </nav>
    </main>
    </ErrorBoundary>
  );
}
