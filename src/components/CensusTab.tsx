"use client";
import React, { useState, useEffect } from "react";
import { db, CensusRecord, Animal, KardexRecord, resetDatabaseWithRealData, purgeObsoleteGateraRecords, deduplicateDatabaseRecords } from "@/lib/db";
import { StaffMember, canDeleteRecords } from "@/lib/staff";
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  CheckCircle2,
  Search,
  Database,
  ShieldCheck,
  Layers,
  PlusCircle,
  ShieldAlert,
  Trash2,
  AlertTriangle,
  X,
  Sparkles,
  RotateCcw,
  HeartOff,
} from "lucide-react";
import * as XLSX from "xlsx";
import { exportGateraExcel, exportFallecidosExcel } from "@/lib/excelGenerator";
import { BatchScannerModal } from "./BatchScannerModal";
import { RegisterNewAnimalModal } from "./RegisterNewAnimalModal";

interface CensusTabProps {
  currentUser?: StaffMember | null;
}

export const CensusTab: React.FC<CensusTabProps> = ({ currentUser }) => {
  const [censusList, setCensusList] = useState<CensusRecord[]>([]);
  const [totalAnimals, setTotalAnimals] = useState<number>(0);
  const [totalDeceased, setTotalDeceased] = useState<number>(0);
  const [deceasedList, setDeceasedList] = useState<Animal[]>([]);
  const [viewMode, setViewMode] = useState<"censo" | "fallecidos">("censo");
  const [searchTerm, setSearchTerm] = useState("");
  const [deceasedSearch, setDeceasedSearch] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isRecordDeathOpen, setIsRecordDeathOpen] = useState(false);
  const [deathChip, setDeathChip] = useState("");
  const [deathCause, setDeathCause] = useState("");
  const [deathDate, setDeathDate] = useState(new Date().toISOString().split("T")[0]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);
  const [purgeStats, setPurgeStats] = useState<{
    totalCats: number;
    censusedCats: number;
    feralCats: number;
    obsoleteCats: number;
  }>({ totalCats: 0, censusedCats: 0, feralCats: 0, obsoleteCats: 0 });
  const [isPurging, setIsPurging] = useState(false);

  const openPurgeModal = async () => {
    const allCats = await db.gateraRecords.toArray();
    const allCensus = await db.census.where("area").equals("gatera").toArray();
    const censusedChips = new Set(allCensus.map((c) => c.microchip.trim()));

    let feralCount = 0;
    let censusedCount = 0;
    let obsoleteCount = 0;

    for (const cat of allCats) {
      const chip = cat.microchip.trim();
      const isFeral = Boolean(
        cat.isFeral ||
        (cat.pendientes && cat.pendientes.toUpperCase().includes("FERAL")) ||
        (cat.descripcion && cat.descripcion.toUpperCase().includes("FERAL"))
      );
      const isCensused = censusedChips.has(chip);

      if (isFeral) {
        feralCount++;
      } else if (isCensused) {
        censusedCount++;
      } else {
        obsoleteCount++;
      }
    }

    setPurgeStats({
      totalCats: allCats.length,
      censusedCats: censusedCount,
      feralCats: feralCount,
      obsoleteCats: obsoleteCount,
    });
    setIsPurgeModalOpen(true);
  };

  const handleExecutePurge = async () => {
    const isAuthorized = canDeleteRecords(currentUser?.role);
    if (!isAuthorized) {
      setSyncMessage("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para depurar o eliminar registros.");
      return;
    }

    setIsPurging(true);
    try {
      const result = await purgeObsoleteGateraRecords();
      await loadData();
      setIsPurgeModalOpen(false);
      setSyncMessage(
        `🎉 Censo de Gatera depurado: Se conservaron ${result.preservedCensused} felinos censados y ${result.preservedFeral} felinos ferales protegidos. Se eliminaron ${result.deletedCount} registros no vigentes.`
      );
    } catch (err) {
      console.error(err);
      setSyncMessage("Error al depurar los registros de Gatera.");
    } finally {
      setIsPurging(false);
      setTimeout(() => setSyncMessage(null), 6000);
    }
  };

  const loadData = async () => {
    // Purga y desduplicación automática silenciosa
    await deduplicateDatabaseRecords();

    let list = await db.census.orderBy("id").reverse().toArray();
    let animalsList = await db.animals.toArray();

    // Filtro exclusivo oficial: Albergue Felino (Gatera)
    const gateraAnimals = animalsList.filter((a) => a.species === "gato");

    // REGLA OFICIAL: Los felinos fallecidos se descuentan de la población activa del censo
    const activeAnimals = gateraAnimals.filter(
      (a) =>
        a.location?.toUpperCase().trim() !== "FALLECIDO" &&
        a.status?.toLowerCase().trim() !== "fallecido"
    );
    const deceasedAnimals = gateraAnimals.filter(
      (a) =>
        a.location?.toUpperCase().trim() === "FALLECIDO" ||
        a.status?.toLowerCase().trim() === "fallecido"
    );

    // Lecturas activas del censo (excluyendo fallecidos)
    list = list.filter(
      (c) =>
        (c.area === "gatera" || !c.area) &&
        c.location?.toUpperCase().trim() !== "FALLECIDO"
    );

    setCensusList(list);
    setDeceasedList(deceasedAnimals);
    setTotalAnimals(activeAnimals.length);
    setTotalDeceased(deceasedAnimals.length);
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.area]);

  const handleCleanDuplicatesAndDemo = async () => {
    setIsSyncing(true);
    setSyncMessage("Limpiando datos demo de prueba y desduplicando microchips en el censo...");
    try {
      const stats = await deduplicateDatabaseRecords();
      await loadData();
      setSyncMessage(
        `🧹 Limpieza completada: ${stats.demoRemoved} registros demo y ${stats.censusRemoved} duplicados eliminados del censo.`
      );
    } catch (err) {
      console.error(err);
      setSyncMessage("Error al limpiar registros.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleDeleteCensusRecord = async (record: CensusRecord) => {
    const isAuthorized = currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true;
    if (!isAuthorized) {
      setSyncMessage("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para eliminar registros del censo.");
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }

    if (confirm(`¿Eliminar al animal ${record.animalName} (Chip: ${record.microchip}) del registro de censo?`)) {
      if (record.id) {
        await db.census.delete(record.id);
        await loadData();
        setSyncMessage(`🗑️ Registro de censo eliminado: ${record.animalName} (${record.microchip})`);
        setTimeout(() => setSyncMessage(null), 4000);
      }
    }
  };

  const handleClearTodayCensus = async () => {
    const isAuthorized = currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true;
    if (!isAuthorized) {
      setSyncMessage("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores pueden reiniciar el censo.");
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }

    if (!confirm("⚠️ ¿Deseas vaciar todas las lecturas del censo actual para iniciar una nueva jornada de escaneo 100% limpia? (Los datos reales de animales y gatera no se borrarán).")) {
      return;
    }

    // Vaciar lecturas del censo de Gatera
    const gateraCensus = await db.census.where("area").equals("gatera").toArray();
    for (const c of gateraCensus) if (c.id) await db.census.delete(c.id);

    await loadData();
    setSyncMessage("✨ Censo vaciado con éxito. Listo para comenzar la nueva ronda de lecturas.");
    setTimeout(() => setSyncMessage(null), 4000);
  };

  const handleSyncRealData = async () => {
    setIsSyncing(true);
    setSyncMessage("Verificando y sincronizando datos oficiales de Gatera (439 felinos)...");
    try {
      await resetDatabaseWithRealData();
      await loadData();
      if (typeof window !== "undefined" && navigator.onLine) {
        try {
          const { syncAllLocalToSupabase } = await import("@/lib/supabase");
          syncAllLocalToSupabase().catch(console.warn);
        } catch {}
      }
      setSyncMessage("✅ ¡Base de datos sincronizada con éxito! Todos los felinos cargados con sus colores oficiales.");
    } catch (e: any) {
      console.error("Error en sincronización:", e);
      setSyncMessage(`Error durante la sincronización: ${e?.message || e}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleExportExcel = async () => {
    setIsSyncing(true);
    setSyncMessage("Generando archivo Excel oficial de GATERA con las 24 columnas maestras...");
    try {
      await exportGateraExcel();
      setSyncMessage("✅ Excel maestro de Gatera exportado con éxito (CENSO 24 columnas, PLAN TTO, PLAN SANITARIO y FALLECIDOS).");
    } catch (err: any) {
      console.error(err);
      setSyncMessage("Error al exportar archivo Excel maestro de Gatera.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleExportFallecidos = async () => {
    setIsSyncing(true);
    setSyncMessage("Generando reporte oficial de Control de Felinos Fallecidos (.xlsx)...");
    try {
      await exportFallecidosExcel();
      setSyncMessage("✅ Reporte de Felinos Fallecidos exportado con éxito.");
    } catch (err: any) {
      console.error(err);
      setSyncMessage("Error al exportar archivo de fallecidos.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  };

  const handleRecordDeath = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanChip = deathChip.trim();
    if (!cleanChip) return;

    const isAuthorized = currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true;
    if (!isAuthorized) {
      setSyncMessage("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para registrar defunciones.");
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }

    const animal = await db.animals.where("microchip").equals(cleanChip).first();
    const gateraRec = await db.gateraRecords.where("microchip").equals(cleanChip).first();

    const previousLocation = animal?.location || gateraRec?.ubicacion || "GATERA";
    const nowIso = new Date().toISOString();

    if (animal && animal.id) {
      await db.animals.update(animal.id, {
        location: "FALLECIDO",
        status: "fallecido",
        fechaFallecimiento: deathDate || nowIso.split("T")[0],
        causaFallecimiento: deathCause.trim() || "Causa no especificada",
        ubicacionPrevia: previousLocation,
      });
    }

    if (gateraRec && gateraRec.id) {
      await db.gateraRecords.update(gateraRec.id, {
        ubicacion: "FALLECIDO",
        status: "fallecido",
        fechaFallecimiento: deathDate || nowIso.split("T")[0],
        causaFallecimiento: deathCause.trim() || "Causa no especificada",
        ubicacionPrevia: previousLocation,
      });
    }

    // Descontar inmediatamente de db.census
    const censusEntry = await db.census.where("microchip").equals(cleanChip).first();
    if (censusEntry && censusEntry.id) {
      await db.census.delete(censusEntry.id);
    }

    // Eliminar tareas pendientes de turno para este microchip
    const tasks = await db.shiftTasks.where("microchip").equals(cleanChip).toArray();
    for (const t of tasks) {
      if (t.id) await db.shiftTasks.delete(t.id);
    }

    // Sincronizar en segundo plano con Supabase si está online
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const { syncAnimalToSupabase } = await import("@/lib/supabase");
        if (animal) {
          syncAnimalToSupabase({
            ...animal,
            location: "FALLECIDO",
            status: "fallecido",
          }).catch(console.warn);
        }
      } catch {}
    }

    setDeathChip("");
    setDeathCause("");
    setIsRecordDeathOpen(false);
    await loadData();
    setSyncMessage(`🕊️ Defunción registrada: Felino ${animal?.name || cleanChip} descontado del censo activo y registrado en Control de Fallecidos.`);
    setTimeout(() => setSyncMessage(null), 5000);
  };

  const handleReactivateAnimal = async (animal: Animal) => {
    const isAuthorized = currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true;
    if (!isAuthorized) {
      setSyncMessage("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para reactivar animales.");
      setTimeout(() => setSyncMessage(null), 4000);
      return;
    }

    if (!confirm(`¿Reactivar al felino ${animal.name} (${animal.microchip}) en el censo activo de Gatera?`)) return;

    const restoreLocation = animal.ubicacionPrevia || "CUARENTENA 1";
    if (animal.id) {
      await db.animals.update(animal.id, {
        location: restoreLocation,
        status: "activo",
        fechaFallecimiento: undefined,
        causaFallecimiento: undefined,
      });
    }

    const gateraRec = await db.gateraRecords.where("microchip").equals(animal.microchip).first();
    if (gateraRec && gateraRec.id) {
      await db.gateraRecords.update(gateraRec.id, {
        ubicacion: restoreLocation,
        status: "activo",
        fechaFallecimiento: undefined,
        causaFallecimiento: undefined,
      });
    }

    await loadData();
    setSyncMessage(`✅ Felino ${animal.name} reactivado exitosamente en ${restoreLocation}.`);
    setTimeout(() => setSyncMessage(null), 4000);
  };

  const filteredCensus = censusList.filter(
    (c) =>
      c.animalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.microchip.includes(searchTerm) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDeceased = deceasedList.filter(
    (a) =>
      a.name.toLowerCase().includes(deceasedSearch.toLowerCase()) ||
      a.microchip.includes(deceasedSearch) ||
      (a.hc && a.hc.toLowerCase().includes(deceasedSearch.toLowerCase())) ||
      (a.ubicacionPrevia && a.ubicacionPrevia.toLowerCase().includes(deceasedSearch.toLowerCase())) ||
      (a.causaFallecimiento && a.causaFallecimiento.toLowerCase().includes(deceasedSearch.toLowerCase()))
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Banner de Área Exclusiva GATERA */}
      <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between text-xs font-black text-purple-900 shadow-sm">
        <span className="flex items-center gap-2">
          <span>🐱</span>
          <span>CENSO & AUDITORÍA OFICIAL: GATERA (ALBERGUE FELINO)</span>
        </span>
        <span className="text-[10px] font-bold bg-purple-200 text-purple-950 px-2 py-0.5 rounded-lg">
          {totalAnimals} Felinos
        </span>
      </div>

      {/* Selector de Pestañas: Censo Activo vs Control de Fallecidos */}
      <div className="flex p-1.5 bg-slate-200/80 rounded-2xl gap-1.5 text-xs font-black shadow-inner">
        <button
          type="button"
          onClick={() => setViewMode("censo")}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
            viewMode === "censo"
              ? "bg-white text-purple-950 shadow-md scale-[1.01]"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🐱 Felinos Activos en Censo</span>
          <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[11px] font-black">
            {totalAnimals}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode("fallecidos")}
          className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
            viewMode === "fallecidos"
              ? "bg-slate-900 text-white shadow-md scale-[1.01]"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>🕊️ Control de Fallecidos</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 text-[11px] font-black border border-slate-700">
            {totalDeceased}
          </span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* VISTA 1: CENSO ACTIVO DE GATERA (DESCONTANDO FALLECIDOS) */}
      {/* ============================================================== */}
      {viewMode === "censo" && (
        <>
          {/* Resumen Métricas */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Censo & Auditoría CBA La Perla</h2>
                <p className="text-xs text-slate-500">
                  Población activa en Gatera:{" "}
                  <strong className="text-purple-900 font-black">{totalAnimals.toLocaleString()} felinos</strong>
                  {totalDeceased > 0 && (
                    <span className="ml-2 text-slate-400 font-normal">
                      ({totalDeceased} fallecidos descontados)
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
                >
                  <PlusCircle className="w-4 h-4 text-emerald-200" />
                  <span>Registrar Animal Nuevo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBatchOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
                >
                  <Layers className="w-4 h-4 text-indigo-200" />
                  <span>Censo Masivo (Memoria W91A)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-slate-900/25 active:scale-95 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Exportar (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCleanDuplicatesAndDemo}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-600/25 active:scale-95 transition-all"
                  title="Eliminar datos de prueba demo y unificar chips duplicados"
                >
                  <Sparkles className="w-4 h-4 text-amber-100" />
                  <span>Limpiar Demos y Duplicados</span>
                </button>

                {(currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true) && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsRecordDeathOpen(true)}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-slate-100 rounded-2xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 transition-all border border-slate-700"
                      title="Registrar el fallecimiento de un felino para descontarlo del censo activo"
                    >
                      <HeartOff className="w-4 h-4 text-rose-400" />
                      <span>Registrar Defunción (Vet/Admin)</span>
                    </button>

                    <button
                      type="button"
                      onClick={openPurgeModal}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-600/25 active:scale-95 transition-all"
                      title="Depurar registros de Gatera que no se hayan actualizado en el censo, preservando 100% los felinos ferales (Solo Médicos y Admin)"
                    >
                      <Trash2 className="w-4 h-4 text-rose-200" />
                      <span>Depurar Gatera (Vet/Admin)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClearTodayCensus}
                      className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-slate-700/25 active:scale-95 transition-all"
                      title="Vaciar las lecturas del censo actual para iniciar una jornada limpia desde cero"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-300" />
                      <span>Reiniciar Censo (Vet/Admin)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tarjetas de estadísticas */}
            <div className="grid grid-cols-3 gap-2 text-center pt-2">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-indigo-700 block">Escaneados Hoy</span>
                <span className="text-2xl font-black text-indigo-900">{censusList.length}</span>
                <span className="text-[9px] text-indigo-500 block">verificados W91A</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-emerald-700 block">Con Tratamiento</span>
                <span className="text-2xl font-black text-emerald-900">
                  {censusList.filter((c) => c.treatmentCount > 0).length}
                </span>
                <span className="text-[9px] text-emerald-500 block">en seguimiento</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-slate-700 block">Población Activa</span>
                <span className="text-2xl font-black text-slate-900">{totalAnimals.toLocaleString()}</span>
                <span className="text-[9px] text-slate-500 block">excluye fallecidos</span>
              </div>
            </div>

            {/* Sincronización de Base de Datos Real */}
            <div className="pt-2 border-t flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Garantía de datos 100% reales (Sin muestras demo)
              </span>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleSyncRealData}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-emerald-400" : ""}`} />
                <span>{isSyncing ? "Sincronizando..." : "Sincronizar Archivos"}</span>
              </button>
            </div>

            {syncMessage && (
              <p className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-1.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{syncMessage}</span>
              </p>
            )}
          </div>

          {/* Buscador en Censo */}
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar en el registro de censo por chip, nombre o canil..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            {/* Listado de animales verificados en campo */}
            <div className="space-y-2">
              {filteredCensus.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No hay lecturas registradas aún hoy con el W91A.
                </div>
              ) : (
                filteredCensus.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-200 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-slate-900">{item.animalName}</strong>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                          {item.location}
                        </span>
                        {item.retroviralStatus && item.retroviralStatus !== "PENDIENTE" && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                              item.retroviralStatus === "VIF_POSITIVO"
                                ? "bg-purple-100 text-purple-900 border border-purple-300"
                                : item.retroviralStatus === "FELV_POSITIVO"
                                ? "bg-amber-100 text-amber-900 border border-amber-300"
                                : item.retroviralStatus === "DOBLE_POSITIVO"
                                ? "bg-rose-100 text-rose-900 border border-rose-300 font-extrabold"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {item.retroviralStatus === "VIF_POSITIVO"
                              ? "VIF+"
                              : item.retroviralStatus === "FELV_POSITIVO"
                              ? "FeLV+"
                              : item.retroviralStatus === "DOBLE_POSITIVO"
                              ? "DOBLE+"
                              : "VIF-/FeLV-"}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                        Chip: {item.microchip} • Verificado por: {item.scannedBy}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          {new Date(item.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {item.treatmentCount > 0 && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded">
                            {item.treatmentCount} Tratamientos
                          </span>
                        )}
                      </div>
                      {(currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCensusRecord(item)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                          title="Eliminar este registro del censo (Solo Médicos y Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ============================================================== */}
      {/* VISTA 2: CONTROL DE FELINOS FALLECIDOS (DATOS PRESERVADOS) */}
      {/* ============================================================== */}
      {viewMode === "fallecidos" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">
                    Control de Felinos Fallecidos
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-900 text-white">
                    {totalDeceased} Registrados
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Descontados del censo activo de la jornada diaria • Los datos clínicos, microchips y causas de defunción se conservan de forma permanente para auditoría y control de sanidad animal.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleExportFallecidos}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-slate-900/25 active:scale-95 transition-all"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Exportar Reporte (.xlsx)</span>
                </button>

                {(currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true) && (
                  <button
                    type="button"
                    onClick={() => setIsRecordDeathOpen(true)}
                    className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-700/25 active:scale-95 transition-all"
                  >
                    <HeartOff className="w-4 h-4 text-rose-200" />
                    <span>➕ Registrar Defunción</span>
                  </button>
                )}
              </div>
            </div>

            {/* Buscador de Fallecidos */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={deceasedSearch}
                onChange={(e) => setDeceasedSearch(e.target.value)}
                placeholder="Buscar fallecido por chip, HC, nombre, color o causa..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500 font-medium"
              />
            </div>

            {/* Listado de Felinos Fallecidos */}
            <div className="space-y-3 pt-1">
              {filteredDeceased.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <span className="text-3xl block">🕊️</span>
                  <h4 className="font-bold text-slate-700 text-sm">
                    {deceasedSearch ? "No se encontraron coincidencias" : "No hay felinos registrados como fallecidos"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Cuando un felino fallece, al asignarle la ubicación o estado <strong>FALLECIDO</strong> se descontará automáticamente del censo diario y sus registros permanecerán aquí guardados.
                  </p>
                </div>
              ) : (
                filteredDeceased.map((cat) => (
                  <div
                    key={cat.id || cat.microchip}
                    className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-2 hover:bg-white transition-all text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-slate-900 text-sm">
                          {cat.name || "S/N"}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono font-bold text-[10px]">
                          CHIP: {cat.microchip}
                        </span>
                        {cat.hc && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 font-bold text-[10px]">
                            HC: {cat.hc}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black text-[10px] border border-rose-200">
                          🕊️ FALLECIDO
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>
                          Fecha deceso:{" "}
                          <strong className="text-slate-800 font-bold">
                            {cat.fechaFallecimiento ? cat.fechaFallecimiento.split("T")[0] : "No registrada"}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 pt-1">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Raza / Sexo:</span>
                        <strong className="text-slate-800">{cat.breed || "DPC"}</strong> ({cat.gender || "Felino"})
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Color (Columna H):</span>
                        <strong className="text-slate-800">{cat.color || "No especificado"}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Última Ubicación:</span>
                        <strong className="text-indigo-900 font-bold">{cat.ubicacionPrevia || "GATERA"}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Médico Responsable:</span>
                        <strong className="text-slate-800">{cat.medicoVeterinario || "Dra. Jenny Zapata Calle"}</strong>
                      </div>
                    </div>

                    {cat.causaFallecimiento && (
                      <div className="p-2.5 bg-rose-50/70 border border-rose-200/70 rounded-xl text-[11px] text-rose-950">
                        <strong className="block text-rose-900 text-[10px] uppercase font-black mb-0.5">
                          Causa de defunción / Cuadro clínico:
                        </strong>
                        {cat.causaFallecimiento}
                      </div>
                    )}

                    {(currentUser ? (currentUser.role === "veterinario" || currentUser.role === "admin") : true) && (
                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleReactivateAnimal(cat)}
                          className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" /> Reactivar en censo activo si fue un error (Vet/Admin)
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para Registrar Defunción de Felino */}
      {isRecordDeathOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto border border-slate-200 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-slate-900 rounded-2xl text-white shadow-md">
                  <HeartOff className="w-6 h-6 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    Registrar Defunción / Baja
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Descuenta al felino del censo activo y conserva sus datos históricos
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordDeathOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordDeath} className="space-y-3.5 text-xs">
              <div>
                <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[11px]">
                  NÚMERO DE MICROCHIP DEL FELINO: <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deathChip}
                  onChange={(e) => setDeathChip(e.target.value.trim())}
                  placeholder="Ingresa o escanea el microchip de 15 dígitos..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase text-[11px]">
                  FECHA DE FALLECIMIENTO:
                </label>
                <input
                  type="date"
                  required
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 uppercase text-[11px]">
                  CAUSA DE DEFUNCIÓN / OBSERVACIONES CLÍNICAS:
                </label>
                <textarea
                  rows={3}
                  value={deathCause}
                  onChange={(e) => setDeathCause(e.target.value)}
                  placeholder="Ej: Falla renal crónica, choque séptico, paro cardiorrespiratorio..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-600"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-tight">
                ⚠️ Al confirmar la defunción, el felino será <strong>descontado de la población activa del censo y de los turnos de medicación</strong>, pero toda su ficha e historial clínico quedarán registrados para siempre en el control oficial.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecordDeathOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-slate-900 hover:bg-black text-white font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                >
                  <HeartOff className="w-4 h-4 text-rose-400" />
                  <span>Confirmar Defunción</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Censo Masivo desde Memoria W91A */}
      <BatchScannerModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        currentUser={currentUser}
        onBatchProcessed={() => {
          loadData();
        }}
      />

      {/* Modal para Registrar Animal Nuevo desde Censo */}
      <RegisterNewAnimalModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialMicrochip=""
        defaultArea="gatera"
        currentUser={currentUser}
        onAnimalRegistered={(animal) => {
          setSyncMessage(`✨ ¡${animal.name} (Felino) registrado y censado exitosamente en ${animal.location}!`);
          loadData();
          setTimeout(() => setSyncMessage(null), 4000);
        }}
      />

      {/* Modal de Depuración de Censo Gatera (Preserva Ferales) */}
      {isPurgeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto border border-slate-200 animate-in zoom-in-95">
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-600 rounded-2xl text-white shadow-md shadow-rose-600/30">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base leading-tight">
                    Depurar Gatera: Nuevo Censo
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Eliminar registros no actualizados preservando 100% felinos ferales
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPurgeModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tarjetas de Auditoría y Métricas */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Total en Gatera</span>
                <span className="text-2xl font-black text-slate-800">{purgeStats.totalCats}</span>
                <span className="text-[9px] text-slate-400 block">población anterior</span>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <span className="text-[10px] uppercase font-black text-amber-800 block">🛡️ Felinos Ferales</span>
                <span className="text-2xl font-black text-amber-900">{purgeStats.feralCats}</span>
                <span className="text-[9px] text-amber-700 font-bold block">100% INTOCABLES</span>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">Confirmados en Censo</span>
                <span className="text-2xl font-black text-emerald-900">{purgeStats.censusedCats}</span>
                <span className="text-[9px] text-emerald-600 font-bold block">permanecen activos</span>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl">
                <span className="text-[10px] uppercase font-bold text-rose-700 block">Obsoletos a Depurar</span>
                <span className="text-2xl font-black text-rose-900">{purgeStats.obsoleteCats}</span>
                <span className="text-[9px] text-rose-600 font-bold block">serán eliminados</span>
              </div>
            </div>

            {/* Alerta de Bioseguridad y Protección Feral */}
            <div className="p-3.5 bg-amber-50/80 border border-amber-300 rounded-2xl space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 font-black text-amber-950 uppercase tracking-wide text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Protocolo de Protección de Felinos Ferales:</span>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed">
                Los <strong>{purgeStats.feralCats} felinos ferales o reactivos NUNCA se eliminarán</strong>, independientemente de si fueron escaneados hoy o no. Su ficha, historial de manejo cauteloso y número de canil se preservan de manera inmutable.
              </p>
              <p className="text-[10px] text-slate-600 italic">
                * Solo se purgarán los gatos que no tengan registro en este nuevo censo y que no sean ferales.
              </p>
            </div>

            {/* Botones de Acción */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleExportExcel}
                className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Descargar Copia de Respaldo Excel Antes de Depurar</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPurgeModalOpen(false)}
                  disabled={isPurging}
                  className="w-1/3 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecutePurge}
                  disabled={isPurging || purgeStats.obsoleteCats === 0}
                  className="w-2/3 py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white font-black rounded-xl text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {isPurging
                      ? "DEPURANDO..."
                      : purgeStats.obsoleteCats === 0
                      ? "CENSO AL DÍA (0 PENDIENTES)"
                      : `DEPURAR ${purgeStats.obsoleteCats} NO ACTUALIZADOS`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
