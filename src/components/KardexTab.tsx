"use client";
import React, { useState, useEffect } from "react";
import { KardexRecord, db, Animal, applyDoseToTreatment } from "@/lib/db";
import { StaffMember } from "@/lib/staff";
import {
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Calendar,
  User,
  Sparkles,
  Pill,
  AlertCircle,
  TrendingUp,
  Award,
  RotateCcw,
  Printer,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { VoiceModal } from "./VoiceModal";
import { CanilCardModal } from "./CanilCardModal";
import { ParsedClinicalIntent } from "@/lib/aiParser";

interface KardexTabProps {
  initialChip?: string;
  currentUser?: StaffMember | null;
}

export const KardexTab: React.FC<KardexTabProps> = ({ initialChip = "", currentUser }) => {
  const [chipFilter, setChipFilter] = useState(initialChip);
  const [systemFilter, setSystemFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "EN_CURSO" | "ULTIMA_DOSIS" | "CULMINADOS">("TODOS");
  const [treatments, setTreatments] = useState<KardexRecord[]>([]);
  const [animalsMap, setAnimalsMap] = useState<Record<string, Animal>>({});
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Ficha de Canil & QR
  const [selectedAnimalForCard, setSelectedAnimalForCard] = useState<Animal | null>(null);
  const [selectedTreatmentsForCard, setSelectedTreatmentsForCard] = useState<KardexRecord[]>([]);
  const [isCanilCardOpen, setIsCanilCardOpen] = useState(false);

  // Formulario nuevo tratamiento
  const [newChip, setNewChip] = useState(initialChip);
  const [newSystem, setNewSystem] = useState("DERMATOLOGICO");
  const [newTreatment, setNewTreatment] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTotalDoses, setNewTotalDoses] = useState(7);
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newEndDate, setNewEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );

  const loadData = async () => {
    let query = db.kardex.orderBy("id").reverse();
    const all = await query.toArray();

    // Cargar mapa de animales
    const allAnimals = await db.animals.toArray();
    const map: Record<string, Animal> = {};
    allAnimals.forEach((a) => {
      map[a.microchip] = a;
    });
    setAnimalsMap(map);

    let filtered = all;
    // Si el usuario pertenece exclusivamente a gatera o caninos, filtrar por su área
    if (currentUser?.area === "gatera" && currentUser?.role !== "admin") {
      filtered = filtered.filter((t) => map[t.microchip]?.species === "gato" || t.area === "gatera");
    } else if (currentUser?.area === "caninos" && currentUser?.role !== "admin") {
      filtered = filtered.filter((t) => map[t.microchip]?.species === "perro" || t.area === "caninos");
    }

    if (chipFilter.trim()) {
      filtered = filtered.filter((t) => t.microchip.includes(chipFilter.trim()));
    }
    if (systemFilter !== "TODOS") {
      filtered = filtered.filter((t) => t.system === systemFilter);
    }
    if (statusFilter === "EN_CURSO") {
      filtered = filtered.filter((t) => t.status === "activo" && (t.dosisFaltantes ?? 7) > 1);
    } else if (statusFilter === "ULTIMA_DOSIS") {
      filtered = filtered.filter((t) => t.status === "activo" && t.dosisFaltantes === 1);
    } else if (statusFilter === "CULMINADOS") {
      filtered = filtered.filter((t) => t.status === "finalizado" || t.dosisFaltantes === 0);
    }
    setTreatments(filtered);
  };

  useEffect(() => {
    loadData();
  }, [chipFilter, systemFilter, statusFilter, currentUser?.area]);

  // Métricas de Cumplimiento y Semáforo Clínico
  const countEnCurso = treatments.filter((t) => t.status === "activo" && (t.dosisFaltantes ?? 7) > 1).length;
  const countUltimaDosis = treatments.filter((t) => t.status === "activo" && t.dosisFaltantes === 1).length;
  const countCulminados = treatments.filter((t) => t.status === "finalizado" || t.dosisFaltantes === 0).length;
  const totalDosisFaltantes = treatments.reduce((acc, t) => acc + (t.status === "activo" ? (t.dosisFaltantes || 0) : 0), 0);
  const totalDosisAplicadas = treatments.reduce((acc, t) => acc + (t.dosisAplicadas || 0), 0);

  const handleCreateTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChip || !newTreatment) return;

    const totalDoses = Number(newTotalDoses) || 7;
    const vetName = currentUser ? currentUser.name : "Dr. Andrés Mendoza (Vet)";

    await db.kardex.add({
      microchip: newChip.trim(),
      system: newSystem,
      treatment: newTreatment,
      description: newDesc,
      startDate: newStartDate,
      endDate: newEndDate,
      status: "activo",
      prescribedBy: vetName,
      createdAt: new Date().toISOString(),
      dosisTotales: totalDoses,
      dosisAplicadas: 0,
      dosisFaltantes: totalDoses,
    });

    setIsNewOpen(false);
    setNewTreatment("");
    setNewDesc("");
    setFeedback(`✨ Prescripción creada con ${totalDoses} dosis programadas.`);
    setTimeout(() => setFeedback(null), 3500);
    loadData();
  };

  // Descontar una dosis (Cumplimiento de 1 dosis)
  const handleApplyDose = async (kardexId?: number) => {
    if (!kardexId) return;
    const workerName = currentUser ? currentUser.name : "Médico Veterinario";
    const workerRole = currentUser ? currentUser.role : "veterinario";

    const res = await applyDoseToTreatment(kardexId, workerName, workerRole);
    if (res) {
      if (res.isCulminated) {
        setFeedback(`🏆 ¡TRATAMIENTO CULMINADO! Se aplicaron todas las ${res.updated.dosisTotales} dosis programadas.`);
      } else {
        setFeedback(`💉 Dosis aplicada por ${workerName}. Faltan ${res.updated.dosisFaltantes} dosis para culminar.`);
      }
      setTimeout(() => setFeedback(null), 3500);
      loadData();
    }
  };

  // Extender tratamiento (+7 días / +7 dosis)
  const handleExtendTreatment = async (id?: number) => {
    if (!id) return;
    const item = await db.kardex.get(id);
    if (!item) return;

    const currentEndDate = item.endDate ? new Date(item.endDate) : new Date();
    const newEnd = new Date(currentEndDate.getTime() + 7 * 86400000).toISOString().split("T")[0];
    const newTotales = (item.dosisTotales || 7) + 7;
    const newFaltantes = (item.dosisFaltantes || 0) + 7;

    await db.kardex.update(id, {
      endDate: newEnd,
      dosisTotales: newTotales,
      dosisFaltantes: newFaltantes,
      status: "activo",
    });

    setFeedback(`➕ Tratamiento extendido +7 días (+7 dosis adicionales).`);
    setTimeout(() => setFeedback(null), 3500);
    loadData();
  };

  // Dar Alta Médica directa
  const handleDischargeTreatment = async (id?: number) => {
    if (!id) return;
    const item = await db.kardex.get(id);
    if (!item) return;

    await db.kardex.update(id, {
      status: "finalizado",
      dosisAplicadas: item.dosisTotales,
      dosisFaltantes: 0,
      ultimaAplicacion: new Date().toISOString(),
      ultimoResponsable: currentUser?.name ? `${currentUser.name} (Alta Médica)` : "Médico Veterinario (Alta)",
    });

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([150, 50, 150]);
    }

    setFeedback(`🏥 ALTA MÉDICA CONCEDIDA: Tratamiento culminado y archivado.`);
    setTimeout(() => setFeedback(null), 3500);
    loadData();
  };

  // Abrir Ficha Imprimible de Canil
  const handleOpenCardModal = async (animal: Animal, initialTreatment?: KardexRecord) => {
    setSelectedAnimalForCard(animal);
    try {
      const kx = await db.kardex.where("microchip").equals(animal.microchip).toArray();
      setSelectedTreatmentsForCard(kx && kx.length > 0 ? kx : initialTreatment ? [initialTreatment] : []);
    } catch {
      setSelectedTreatmentsForCard(initialTreatment ? [initialTreatment] : []);
    }
    setIsCanilCardOpen(true);
  };

  const handleVoiceIntent = (intent: ParsedClinicalIntent) => {
    setNewSystem(intent.system);
    setNewTreatment(intent.treatment);
    setNewDesc(intent.description);
    if (intent.microchip) setNewChip(intent.microchip);
    setNewStartDate(new Date().toISOString().split("T")[0]);
    setNewEndDate(new Date(Date.now() + intent.durationDays * 86400000).toISOString().split("T")[0]);
    setNewTotalDoses(intent.durationDays || 7);
    setIsNewOpen(true);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Banner de Área Exclusiva */}
      {currentUser?.area === "gatera" && currentUser?.role !== "admin" && (
        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between text-xs font-black text-purple-900 shadow-sm">
          <span className="flex items-center gap-2">
            <span>🐱</span>
            <span>KARDEX CLÍNICO: GATERA (FELINOS)</span>
          </span>
          <span className="text-[10px] font-bold bg-purple-200 text-purple-950 px-2 py-0.5 rounded-lg">
            {treatments.length} Tratamientos Activos
          </span>
        </div>
      )}
      {currentUser?.area === "caninos" && currentUser?.role !== "admin" && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs font-black text-emerald-900 shadow-sm">
          <span className="flex items-center gap-2">
            <span>🐶</span>
            <span>KARDEX CLÍNICO: CANINOS</span>
          </span>
          <span className="text-[10px] font-bold bg-emerald-200 text-emerald-950 px-2 py-0.5 rounded-lg">
            {treatments.length} Tratamientos Activos
          </span>
        </div>
      )}

      {/* 1. Header & Acciones Rápidas */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Pill className="w-6 h-6 text-emerald-600" />
              Kardex & Cumplimiento Médico
            </h2>
            <p className="text-xs text-slate-500">
              Control de programaciones, dosis aplicadas y faltantes en albergue.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              className="p-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-2xl flex items-center gap-1.5 text-xs font-bold"
              title="Dictar por voz"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Voz IA</span>
            </button>
            <button
              type="button"
              onClick={() => setIsNewOpen(true)}
              className="px-4 py-3 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl flex items-center gap-2 text-xs font-black shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Prescribir</span>
            </button>
          </div>
        </div>

        {/* Dashboard de Cumplimiento & Semáforo Clínico */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-center">
            <span className="text-[10px] font-black uppercase text-slate-500 block">Dosis Aplicadas</span>
            <span className="text-xl font-black text-slate-800">{totalDosisAplicadas}</span>
            <span className="text-[9px] text-slate-400 block">cumplidas</span>
          </div>

          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-2xl text-center">
            <span className="text-[10px] font-black uppercase text-blue-700 block">Dosis Faltantes</span>
            <span className="text-xl font-black text-blue-900">{totalDosisFaltantes}</span>
            <span className="text-[9px] text-blue-500 block">por administrar</span>
          </div>

          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
            <span className="text-[10px] font-black uppercase text-emerald-700 block">🟢 En Curso</span>
            <span className="text-xl font-black text-emerald-900">{countEnCurso}</span>
            <span className="text-[9px] text-emerald-600 block">&gt; 1 dosis</span>
          </div>

          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-center">
            <span className="text-[10px] font-black uppercase text-amber-700 block">🟡 Última Dosis</span>
            <span className="text-xl font-black text-amber-900">{countUltimaDosis}</span>
            <span className="text-[9px] text-amber-600 block">vence hoy</span>
          </div>

          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-center col-span-2 sm:col-span-1">
            <span className="text-[10px] font-black uppercase text-rose-700 block">🔴 Culminados</span>
            <span className="text-xl font-black text-rose-900">{countCulminados}</span>
            <span className="text-[9px] text-rose-600 block">requiere alta</span>
          </div>
        </div>

        {feedback && (
          <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 text-emerald-950 rounded-2xl text-xs font-black flex items-center gap-2 animate-in fade-in shadow-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Filtros de Estado & Sistema con Semáforo Clínico */}
        <div className="space-y-2">
          {/* Tabs Semáforo Clínico */}
          <div className="flex p-1 bg-slate-100 rounded-2xl gap-1 text-xs font-bold overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setStatusFilter("TODOS")}
              className={`flex-1 min-w-[70px] py-2 rounded-xl transition-all ${
                statusFilter === "TODOS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              Todos ({treatments.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("EN_CURSO")}
              className={`flex-1 min-w-[100px] py-2 rounded-xl transition-all ${
                statusFilter === "EN_CURSO" ? "bg-emerald-600 text-white shadow-sm font-black" : "text-slate-600"
              }`}
            >
              🟢 En Curso ({countEnCurso})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ULTIMA_DOSIS")}
              className={`flex-1 min-w-[110px] py-2 rounded-xl transition-all ${
                statusFilter === "ULTIMA_DOSIS" ? "bg-amber-500 text-white shadow-sm font-black" : "text-slate-600"
              }`}
            >
              🟡 Última Dosis ({countUltimaDosis})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("CULMINADOS")}
              className={`flex-1 min-w-[110px] py-2 rounded-xl transition-all ${
                statusFilter === "CULMINADOS" ? "bg-rose-600 text-white shadow-sm font-black" : "text-slate-600"
              }`}
            >
              🔴 Culminados ({countCulminados})
            </button>
          </div>

          {/* Buscador y Sistema */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={chipFilter}
                onChange={(e) => setChipFilter(e.target.value)}
                placeholder="Buscar por Microchip..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={systemFilter}
                onChange={(e) => setSystemFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="TODOS">Todos los Sistemas</option>
                <option value="DERMATOLOGICO">Dermatológico</option>
                <option value="GASTROINTESTINAL">Gastrointestinal</option>
                <option value="RESPIRATORIO">Respiratorio</option>
                <option value="OFTALMOLOGICO">Oftalmológico</option>
                <option value="TRAUMATOLOGICO">Traumatológico</option>
                <option value="TEGUMEN">Tegumentario</option>
                <option value="PREVENTIVO">Preventivo</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nuevo Tratamiento */}
      {isNewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-lg">Prescribir Programación de Medicamento</h3>
              <button
                onClick={() => setIsNewOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTreatment} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">MICROCHIP DEL ANIMAL:</label>
                <input
                  type="text"
                  required
                  value={newChip}
                  onChange={(e) => setNewChip(e.target.value)}
                  placeholder="Ej: 991003003806096 / 3805..."
                  className="w-full p-3 font-mono bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SISTEMA CLÍNICO:</label>
                  <select
                    value={newSystem}
                    onChange={(e) => setNewSystem(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="DERMATOLOGICO">Dermatológico</option>
                    <option value="GASTROINTESTINAL">Gastrointestinal</option>
                    <option value="RESPIRATORIO">Respiratorio</option>
                    <option value="OFTALMOLOGICO">Oftalmológico</option>
                    <option value="TRAUMATOLOGICO">Traumatológico</option>
                    <option value="TEGUMEN">Tegumentario</option>
                    <option value="PREVENTIVO">Preventivo</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">TOTAL DE DOSIS PROGRAMADAS:</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={newTotalDoses}
                    onChange={(e) => setNewTotalDoses(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MEDICAMENTO Y DOSIS:</label>
                <input
                  type="text"
                  required
                  value={newTreatment}
                  onChange={(e) => setNewTreatment(e.target.value)}
                  placeholder="Ej: Amoxicilina + Ácido Clavulánico 250mg c/12h"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">INDICACIONES Y PENDIENTES:</label>
                <textarea
                  rows={2}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Vía de administración, recomendaciones especiales, etc."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">FECHA INICIO:</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">FECHA FINAL ESTIMADA:</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-700 font-black rounded-xl text-white shadow-lg shadow-emerald-600/30"
                >
                  Guardar Programación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de Fichas de Tratamientos con Cumplimiento & Faltantes */}
      <div className="space-y-3">
        {treatments.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400">
            No hay tratamientos registrados con estos filtros.
          </div>
        ) : (
          treatments.map((t) => {
            const animal = animalsMap[t.microchip];
            const isCulminated = t.status === "finalizado" || (t.dosisFaltantes === 0 && (t.dosisAplicadas || 0) > 0);
            const isUltimaDosis = !isCulminated && t.dosisFaltantes === 1;
            const isEnCurso = !isCulminated && !isUltimaDosis;

            const totales = t.dosisTotales || 7;
            const aplicadas = t.dosisAplicadas || 0;
            const faltantes = Math.max(0, totales - aplicadas);
            const percent = Math.min(100, Math.round((aplicadas / totales) * 100));

            const animalObject: Animal = animal || {
              microchip: t.microchip,
              name: "Animal CBA",
              species: "perro",
              location: "CBA La Perla",
              breed: t.system,
            };

            return (
              <div
                key={t.id}
                className={`rounded-3xl p-5 shadow-sm border-2 transition-all space-y-3.5 ${
                  isCulminated
                    ? "bg-rose-50/30 border-rose-200"
                    : isUltimaDosis
                    ? "bg-amber-50/30 border-amber-300"
                    : "bg-white border-slate-200 hover:border-indigo-300"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900">
                        {animal ? animal.name : "Animal CBA"}
                      </span>
                      {animal && (
                        <span className="text-[10px] uppercase font-black bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-lg">
                          {animal.location}
                        </span>
                      )}
                      {/* Semáforo Clínico */}
                      {isCulminated ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300">
                          🔴 CULMINADO (REQUIERE ALTA)
                        </span>
                      ) : isUltimaDosis ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                          🟡 ÚLTIMA DOSIS HOY
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300">
                          🟢 EN CURSO
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-xs text-slate-400 mt-0.5">
                      Chip: <strong>{t.shortChip || t.microchip}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCardModal(animalObject, t)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 border border-slate-200"
                      title="Imprimir Ficha de Canil & Código QR"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden sm:inline">Ficha Canil</span>
                    </button>
                    <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-slate-100 text-slate-700 uppercase">
                      {t.system}
                    </span>
                  </div>
                </div>

                {/* Medicación */}
                <div className="p-3 bg-slate-50 rounded-2xl text-xs space-y-1 border border-slate-100">
                  <p className="font-black text-slate-900 text-sm">{t.treatment}</p>
                  {t.description && <p className="text-slate-600">{t.description}</p>}
                </div>

                {/* Barra de Progreso de Dosis: Cumplimiento vs Faltantes */}
                <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-700">
                      Progreso: <strong>{aplicadas}</strong> de <strong>{totales}</strong> dosis aplicadas
                    </span>
                    <span
                      className={`font-mono ${
                        isCulminated ? "text-rose-700 font-black" : isUltimaDosis ? "text-amber-700 font-black" : "text-emerald-700"
                      }`}
                    >
                      {percent}% ({faltantes === 0 ? "Completado" : `Faltan ${faltantes}`})
                    </span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCulminated
                          ? "bg-rose-600"
                          : isUltimaDosis
                          ? "bg-amber-500"
                          : "bg-emerald-600"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>
                      {t.ultimoResponsable ? `Última aplicación por: ${t.ultimoResponsable}` : "Pendiente primera aplicación"}
                    </span>
                    {t.ultimaAplicacion && (
                      <span>
                        {new Date(t.ultimaAplicacion).toLocaleDateString()} {new Date(t.ultimaAplicacion).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Acciones Clínicas y de Cumplimiento */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Fin: <strong>{t.endDate}</strong></span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!isCulminated && (
                      <button
                        type="button"
                        onClick={() => handleApplyDose(t.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-md shadow-emerald-600/20 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aplicar Dosis (-1)</span>
                      </button>
                    )}

                    {/* Acciones Veterinarias */}
                    <button
                      type="button"
                      onClick={() => handleExtendTreatment(t.id)}
                      className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-black border border-blue-200 transition-all"
                      title="Extender 7 días y sumar 7 dosis al tratamiento"
                    >
                      +7 Días (+7 dosis)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDischargeTreatment(t.id)}
                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl text-xs font-black border border-rose-200 transition-all"
                      title="Dar alta médica formal al animal y archivar tratamiento"
                    >
                      Dar Alta Médica
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de Voz IA */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onApplyIntent={handleVoiceIntent}
      />

      {/* Modal de Ficha Médica de Canil & Código QR */}
      {selectedAnimalForCard && (
        <CanilCardModal
          isOpen={isCanilCardOpen}
          onClose={() => setIsCanilCardOpen(false)}
          animal={selectedAnimalForCard}
          treatments={selectedTreatmentsForCard}
          location={selectedAnimalForCard.location}
          notes={selectedTreatmentsForCard[0]?.description}
        />
      )}
    </div>
  );
};
