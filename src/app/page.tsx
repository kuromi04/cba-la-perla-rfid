"use client";
import React, { useState, useEffect } from "react";
import { initializeDatabaseIfEmpty } from "@/lib/db";
import { ScannerTab } from "@/components/ScannerTab";
import { PlanillaEditorTab } from "@/components/PlanillaEditorTab";
import { KardexTab } from "@/components/KardexTab";
import { CensusTab } from "@/components/CensusTab";
import { TurnosTab } from "@/components/TurnosTab";
import { MagicLinkModal } from "@/components/MagicLinkModal";
import { LoginModal } from "@/components/LoginModal";
import { AlcaldiaMedellinLogo, LaPerlaLogo, DeveloperCredit } from "@/components/OfficialLogos";
import { StaffMember, getAllStaff, canEditAnimals } from "@/lib/staff";
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
} from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"scanner" | "turnos" | "planilla" | "kardex" | "census">("scanner");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  
  // Usuario activo en sesión (obtenido dinámicamente)
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [isMagicModalOpen, setIsMagicModalOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [scannedChipParam, setScannedChipParam] = useState<string>("");

  useEffect(() => {
    // 1. Cargar datos 100% reales de los archivos Excel en IndexedDB
    initializeDatabaseIfEmpty().catch(console.error);

    // 2. Detección de sesión y personal registrado dinámicamente
    const initSession = async () => {
      const staff = await getAllStaff();

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const token = params.get("token");
        const userId = params.get("user");

        const chipParam = params.get("chip");
        if (chipParam) {
          setScannedChipParam(chipParam);
          setActiveTab("scanner");
        }

        if (token || userId) {
          const found = staff.find((s) => s.token === token || s.id === userId);
          if (found) {
            setCurrentUser(found);
            if (!chipParam) setActiveTab("turnos");
            return;
          }
        } else {
          // Recuperar última sesión guardada si existe
          const savedUserId = localStorage.getItem("cba_laperla_active_user");
          if (savedUserId) {
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
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSelectUser = (user: StaffMember) => {
    setCurrentUser(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("cba_laperla_active_user", user.id);
    }
  };

  const handleSelectWorkerSession = (member: StaffMember) => {
    handleSelectUser(member);
    setActiveTab("turnos");
  };

  const isVetOrAdmin = currentUser ? canEditAnimals(currentUser.role) : false;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 flex flex-col max-w-xl mx-auto shadow-2xl">
      {/* 1. Header Oficial: Alcaldía de Medellín & CBA La Perla */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white p-3.5 shadow-md space-y-2.5">
        
        {/* Fila 1: Logotipos Oficiales */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <AlcaldiaMedellinLogo className="h-7" />
          <LaPerlaLogo className="h-7" />
        </div>

        {/* Fila 2: Usuario en Sesión (Médico / Operario) y Botones de Acción */}
        <div className="flex items-center justify-between gap-2">
          {/* Botón Selector de Usuario Activo */}
          <button
            type="button"
            onClick={() => setIsLoginModalOpen(true)}
            className={`flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border transition-all active:scale-95 text-left ${
              isVetOrAdmin
                ? "bg-slate-800/90 border-emerald-500/50 hover:bg-slate-800"
                : "bg-slate-800/90 border-amber-500/50 hover:bg-slate-800"
            }`}
            title="Cambiar usuario o médico veterinario activo"
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                currentUser ? currentUser.avatarColor : "bg-indigo-600 text-white"
              }`}
            >
              {currentUser ? (
                currentUser.role === "veterinario"
                  ? "DR"
                  : currentUser.role === "auxiliar"
                  ? "AUX"
                  : currentUser.role === "operario"
                  ? "OP"
                  : "ADM"
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
            {/* Botón Link Mágico */}
            <button
              type="button"
              onClick={() => setIsMagicModalOpen(true)}
              className="flex items-center gap-1 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-[11px] font-black px-2.5 py-1.5 rounded-lg shadow-sm border border-indigo-400/40 active:scale-95 transition-all"
              title="Generar Link Mágico para Auxiliares y Operarios"
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Link Mágico</span>
            </button>

            {/* Estado de Red */}
            <span
              className={`p-1.5 rounded-lg border ${
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

        {/* Fila 3: Sub-barra de Población Activa 100% Real adaptada al área */}
        <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-[10px] uppercase font-bold text-slate-400">
            {currentUser?.area === "gatera"
              ? "Área Asignada: Gatera"
              : currentUser?.area === "caninos"
              ? "Área Asignada: Caninos"
              : "Población Activa Real:"}
          </span>
          <div className="flex gap-2 text-[11px] font-bold">
            {(!currentUser || currentUser.area === "caninos" || currentUser.area === "ambas" || currentUser.role === "admin") && (
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                🐶 Caninos (Triaje/UCE)
              </span>
            )}
            {(!currentUser || currentUser.area === "gatera" || currentUser.area === "ambas" || currentUser.role === "admin") && (
              <span className="bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                🐱 Gatera (461 Felinos)
              </span>
            )}
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
      <div className="flex-1 p-3.5 pb-28 overflow-y-auto">
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
            currentArea={currentUser?.area || "ambas"}
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

      {/* Modal de Identificación / Inicio de Sesión de Médicos y Personal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectUser}
      />

      {/* Modal Generador de Links Mágicos */}
      <MagicLinkModal
        isOpen={isMagicModalOpen}
        onClose={() => setIsMagicModalOpen(false)}
        onSelectWorkerSession={handleSelectWorkerSession}
      />

      {/* 3. Barra de Navegación Inferior Móvil */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-xl mx-auto bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex justify-around items-center z-50 shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab("scanner")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-2xl transition-all ${
            activeTab === "scanner"
              ? "text-emerald-700 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-600"
          }`}
        >
          <div
            className={`p-2 rounded-2xl ${
              activeTab === "scanner" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" : ""
            }`}
          >
            <Scan className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Escanear</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("turnos")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-2xl transition-all ${
            activeTab === "turnos"
              ? "text-indigo-700 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-600"
          }`}
        >
          <div
            className={`p-2 rounded-2xl ${
              activeTab === "turnos" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : ""
            }`}
          >
            <CheckSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Turnos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("planilla")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-2xl transition-all ${
            activeTab === "planilla"
              ? "text-emerald-700 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-600"
          }`}
        >
          <div
            className={`p-2 rounded-2xl ${
              activeTab === "planilla" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" : ""
            }`}
          >
            <TableProperties className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Planilla</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("kardex")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-2xl transition-all ${
            activeTab === "kardex"
              ? "text-emerald-700 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-600"
          }`}
        >
          <div
            className={`p-2 rounded-2xl ${
              activeTab === "kardex" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" : ""
            }`}
          >
            <ClipboardList className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Kardex</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("census")}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-2xl transition-all ${
            activeTab === "census"
              ? "text-emerald-700 font-black scale-105"
              : "text-slate-400 font-medium hover:text-slate-600"
          }`}
        >
          <div
            className={`p-2 rounded-2xl ${
              activeTab === "census" ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30" : ""
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <span className="text-[10px]">Censo</span>
        </button>
      </nav>
    </main>
  );
}
