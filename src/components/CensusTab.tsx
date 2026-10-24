"use client";
import React, { useState, useEffect } from "react";
import { db, CensusRecord, Animal, KardexRecord, resetDatabaseWithRealData, purgeObsoleteGateraRecords } from "@/lib/db";
import { StaffMember } from "@/lib/staff";
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
} from "lucide-react";
import * as XLSX from "xlsx";
import { BatchScannerModal } from "./BatchScannerModal";
import { RegisterNewAnimalModal } from "./RegisterNewAnimalModal";

interface CensusTabProps {
  currentUser?: StaffMember | null;
}

export const CensusTab: React.FC<CensusTabProps> = ({ currentUser }) => {
  const [censusList, setCensusList] = useState<CensusRecord[]>([]);
  const [totalAnimals, setTotalAnimals] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
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
    let list = await db.census.orderBy("id").reverse().toArray();
    let animalsList = await db.animals.toArray();

    if (currentUser?.area === "gatera" && currentUser?.role !== "admin") {
      animalsList = animalsList.filter((a) => a.species === "gato");
      list = list.filter((c) => c.area === "gatera" || !c.area);
    } else if (currentUser?.area === "caninos" && currentUser?.role !== "admin") {
      animalsList = animalsList.filter((a) => a.species === "perro");
      list = list.filter((c) => c.area === "caninos" || !c.area);
    }

    setCensusList(list);
    setTotalAnimals(animalsList.length);
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.area]);

  const handleSyncRealData = async () => {
    setIsSyncing(true);
    setSyncMessage("Verificando y sincronizando datos reales de los archivos Excel...");
    try {
      await resetDatabaseWithRealData();
      await loadData();
      setSyncMessage("¡Base de datos sincronizada con éxito! Todos los animales son 100% reales.");
    } catch (e) {
      console.error(e);
      setSyncMessage("Error durante la sincronización.");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 4000);
    }
  };

  const handleExportExcel = async () => {
    // Obtener todos los animales reales (filtrados por área si aplica)
    let allAnimals = await db.animals.toArray();
    if (currentUser?.area === "gatera" && currentUser?.role !== "admin") {
      allAnimals = allAnimals.filter((a) => a.species === "gato");
    } else if (currentUser?.area === "caninos" && currentUser?.role !== "admin") {
      allAnimals = allAnimals.filter((a) => a.species === "perro");
    }

    const allTreatments = await db.kardex.where("status").equals("activo").toArray();

    // Crear mapa de tratamientos por microchip
    const treatmentsMap: Record<string, KardexRecord> = {};
    allTreatments.forEach((t) => {
      treatmentsMap[t.microchip] = t;
    });

    // Formato oficial del Centro de Bienestar Animal La Perla
    const rows = allAnimals.map((animal) => {
      const activeTreat = treatmentsMap[animal.microchip];

      return {
        ALBERGUE: "CBA LA PERLA",
        UBICACION: animal.location || "SIN ASIGNAR",
        MICROCHIP: animal.microchip,
        ESPECIE: animal.species.toUpperCase(),
        DESCRIPCION: `${animal.name} (${animal.breed || "Mestizo"})`,
        HISTORIA_CLINICA: animal.hc || "N/A",
        CONDICION_FERAL: animal.isFeral ? "SI (FERAL)" : "NO",
        SISTEMA_MEDICO: activeTreat?.system || "NINGUNO",
        TRATAMIENTO_ACTIVO: activeTreat?.treatment || "SIN TRATAMIENTO",
        DOSIS_PROGRAMADAS: activeTreat?.dosisTotales || "N/A",
        DOSIS_CUMPLIDAS: activeTreat?.dosisAplicadas || 0,
        DOSIS_FALTANTES: activeTreat?.dosisFaltantes || 0,
        FECHA_INICIO: activeTreat?.startDate || "",
        FECHA_FIN: activeTreat?.endDate || "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Ajustar anchos de columnas
    worksheet["!cols"] = [
      { wch: 15 }, // ALBERGUE
      { wch: 18 }, // UBICACION
      { wch: 22 }, // MICROCHIP
      { wch: 10 }, // ESPECIE
      { wch: 32 }, // DESCRIPCION
      { wch: 18 }, // HC
      { wch: 16 }, // FERAL
      { wch: 20 }, // SISTEMA
      { wch: 32 }, // TRATAMIENTO
      { wch: 18 }, // DOSIS PROGRAMADAS
      { wch: 16 }, // DOSIS CUMPLIDAS
      { wch: 16 }, // DOSIS FALTANTES
      { wch: 14 }, // INICIO
      { wch: 14 }, // FIN
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = currentUser?.area === "gatera" ? "Censo_Gatera" : currentUser?.area === "caninos" ? "Censo_Caninos" : "Censo_General";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const today = new Date().toISOString().split("T")[0];
    const prefix = currentUser?.area === "gatera" ? "Censo_Gatera" : currentUser?.area === "caninos" ? "Censo_Caninos" : "Censo_Oficial_CBA_La_Perla";
    XLSX.writeFile(workbook, `${prefix}_${today}.xlsx`);
  };

  const filteredCensus = censusList.filter(
    (c) =>
      c.animalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.microchip.includes(searchTerm) ||
      c.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Banner de Área Exclusiva */}
      {currentUser?.area === "gatera" && currentUser?.role !== "admin" && (
        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between text-xs font-black text-purple-900 shadow-sm">
          <span className="flex items-center gap-2">
            <span>🐱</span>
            <span>CENSO & AUDITORÍA: GATERA (FELINOS)</span>
          </span>
          <span className="text-[10px] font-bold bg-purple-200 text-purple-950 px-2 py-0.5 rounded-lg">
            {totalAnimals} Felinos
          </span>
        </div>
      )}
      {currentUser?.area === "caninos" && currentUser?.role !== "admin" && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-900 shadow-sm">
          <span className="flex items-center gap-2">
            <span>🐶</span>
            <span>CENSO & AUDITORÍA: CANINOS</span>
          </span>
          <span className="text-[10px] font-bold bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-lg">
            {totalAnimals} Caninos
          </span>
        </div>
      )}

      {/* Resumen Métricas */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900">Censo & Auditoría CBA La Perla</h2>
            <p className="text-xs text-slate-500">
              Población real cargada de archivos:{" "}
              <strong className="text-slate-800">{totalAnimals.toLocaleString()} animales</strong>
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

            {(!currentUser || currentUser.area === "gatera" || currentUser.role === "admin") && (
              <button
                type="button"
                onClick={openPurgeModal}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-rose-600/25 active:scale-95 transition-all"
                title="Depurar registros de Gatera que no se hayan actualizado en el censo, preservando 100% los felinos ferales"
              >
                <Trash2 className="w-4 h-4 text-rose-200" />
                <span>Depurar Gatera (Nuevo Censo)</span>
              </button>
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
            <span className="text-[10px] uppercase font-black text-slate-700 block">Población Total</span>
            <span className="text-2xl font-black text-slate-900">{totalAnimals.toLocaleString()}</span>
            <span className="text-[9px] text-slate-500 block">100% real albergue</span>
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
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900">{item.animalName}</strong>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      {item.location}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 block mt-0.5">
                    Chip: {item.microchip} • Verificado por: {item.scannedBy}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-emerald-700 font-bold block">
                    {new Date(item.scannedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {item.treatmentCount > 0 && (
                    <span className="text-[9px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded">
                      {item.treatmentCount} Tratamientos
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

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
        defaultArea={currentUser?.area || "ambas"}
        currentUser={currentUser}
        onAnimalRegistered={(animal) => {
          setSyncMessage(`✨ ¡${animal.name} (${animal.species === "gato" ? "Felino" : "Canino"}) registrado y censado exitosamente en ${animal.location}!`);
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
