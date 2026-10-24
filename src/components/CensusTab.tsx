"use client";
import React, { useState, useEffect } from "react";
import { db, CensusRecord, Animal, KardexRecord, resetDatabaseWithRealData } from "@/lib/db";
import { StaffMember } from "@/lib/staff";
import { FileSpreadsheet, Download, RefreshCw, CheckCircle2, Search, Database, ShieldCheck, Layers, PlusCircle } from "lucide-react";
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
    </div>
  );
};
