"use client";
import React, { useState, useEffect } from "react";
import { db, Animal, KardexRecord } from "@/lib/db";
import { ShelterRecord } from "@/lib/realData";
import { GateraCat } from "@/lib/gateraData";
import { exportOriginalShelterExcel, exportGateraExcel } from "@/lib/excelGenerator";
import { importExcelFile } from "@/lib/excelImporter";
import {
  FileSpreadsheet,
  Download,
  Upload,
  PlusCircle,
  Search,
  Edit3,
  Trash2,
  Save,
  X,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Pill,
  UserCheck,
  Printer,
} from "lucide-react";
import { AssignAnimalModal, SelectedAnimalInfo } from "@/components/AssignAnimalModal";
import { CanilCardModal } from "./CanilCardModal";
import { StaffMember } from "@/lib/staff";

interface PlanillaEditorTabProps {
  currentUser?: StaffMember | null;
  canEdit?: boolean;
}

export const PlanillaEditorTab: React.FC<PlanillaEditorTabProps> = ({
  currentUser,
  canEdit = true,
}) => {
  const isExclusiveGatera = currentUser?.area === "gatera" && currentUser?.role !== "admin";
  const isExclusiveCaninos = currentUser?.area === "caninos" && currentUser?.role !== "admin";
  const defaultArea = isExclusiveGatera ? "gatera" : "caninos";

  const [selectedArea, setSelectedArea] = useState<"caninos" | "gatera">(defaultArea);
  const [records, setRecords] = useState<ShelterRecord[]>([]);
  const [gateraList, setGateraList] = useState<GateraCat[]>([]);
  const [activeSection, setActiveSection] = useState<string>("TODAS");
  const [gateraFilter, setGateraFilter] = useState<string>("TODOS");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (isExclusiveGatera) {
      setSelectedArea("gatera");
    } else if (isExclusiveCaninos) {
      setSelectedArea("caninos");
    }
  }, [currentUser?.area, isExclusiveGatera, isExclusiveCaninos]);
  const [editingRecord, setEditingRecord] = useState<ShelterRecord | null>(null);
  const [editingCat, setEditingCat] = useState<GateraCat | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedAnimalToAssign, setSelectedAnimalToAssign] = useState<SelectedAnimalInfo | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Ficha de Canil / Gatera Imprimible
  const [selectedCardAnimal, setSelectedCardAnimal] = useState<Animal | null>(null);
  const [selectedCardTreatments, setSelectedCardTreatments] = useState<KardexRecord[]>([]);
  const [selectedCardNotes, setSelectedCardNotes] = useState<string | undefined>(undefined);
  const [isCanilModalOpen, setIsCanilModalOpen] = useState(false);

  const handleOpenCanilCard = async (animal: Animal, notes?: string, medication?: string) => {
    setSelectedCardAnimal(animal);
    setSelectedCardNotes(notes);
    try {
      const kx = await db.kardex.where("microchip").equals(animal.microchip).toArray();
      if (kx && kx.length > 0) {
        setSelectedCardTreatments(kx);
      } else if (medication) {
        setSelectedCardTreatments([
          {
            microchip: animal.microchip,
            system: "GENERAL",
            treatment: medication,
            description: "Prescrito según planilla del albergue",
            startDate: new Date().toISOString().split("T")[0],
            endDate: "",
            status: "activo",
            prescribedBy: "Médico Veterinario",
            createdAt: new Date().toISOString(),
            dosisTotales: 7,
            dosisAplicadas: 0,
            dosisFaltantes: 7,
          },
        ]);
      } else {
        setSelectedCardTreatments([]);
      }
    } catch {
      setSelectedCardTreatments([]);
    }
    setIsCanilModalOpen(true);
  };

  // Formulario nuevo Caninos
  const [newSection, setNewSection] = useState<ShelterRecord["section"]>("TRIAJE");
  const [newUbicacion, setNewUbicacion] = useState("");
  const [newMicrochip, setNewMicrochip] = useState("");
  const [newDescripcion, setNewDescripcion] = useState("");
  const [newMedicacion, setNewMedicacion] = useState("");
  const [newFechaFinal, setNewFechaFinal] = useState("HNI");
  const [newTipo, setNewTipo] = useState("S");
  const [newSistema, setNewSistema] = useState("TEGUMEN");
  const [newPendientes, setNewPendientes] = useState("");
  const [newBravecto, setNewBravecto] = useState("");

  // Formulario nuevo Felino (Gatera)
  const [newCatUbicacion, setNewCatUbicacion] = useState("");
  const [newCatMicrochip, setNewCatMicrochip] = useState("");
  const [newCatHc, setNewCatHc] = useState("");
  const [newCatNombre, setNewCatNombre] = useState("");
  const [newCatRaza, setNewCatRaza] = useState("CRIOLLO");
  const [newCatColor, setNewCatColor] = useState("");
  const [newCatSexo, setNewCatSexo] = useState<"macho" | "hembra">("macho");
  const [newCatEdad, setNewCatEdad] = useState("ADULTO");
  const [newCatIsFeral, setNewCatIsFeral] = useState(false);
  const [newCatMedicacion, setNewCatMedicacion] = useState("");
  const [newCatSistema, setNewCatSistema] = useState("GENERAL");
  const [newCatPendientes, setNewCatPendientes] = useState("");
  const [newCatDesparasitante, setNewCatDesparasitante] = useState("");

  const loadRecords = async () => {
    const all = await db.shelterRecords.toArray();
    setRecords(all);
    const allCats = await db.gateraRecords.toArray();
    setGateraList(allCats);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setFeedback("⏳ Sincronizando e importando datos del archivo Excel...");

    try {
      const res = await importExcelFile(file);
      await loadRecords();
      if (res.success) {
        setFeedback(res.message);
        if (res.area === "gatera") {
          setSelectedArea("gatera");
        } else {
          setSelectedArea("caninos");
        }
      } else {
        setFeedback(`❌ Error al importar: ${res.message}`);
      }
    } catch (err: any) {
      setFeedback(`❌ Error al leer el archivo: ${err?.message || "Formato no válido"}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !editingRecord.id) return;
    await db.shelterRecords.update(editingRecord.id, editingRecord);

    // Cascada a db.animals
    const cleanChip = editingRecord.microchip.trim();
    const existingAnimal = await db.animals.where("microchip").equals(cleanChip).first();
    if (existingAnimal && existingAnimal.id) {
      await db.animals.update(existingAnimal.id, {
        location: editingRecord.ubicacion,
        breed: editingRecord.descripcion,
      });
    } else {
      await db.animals.add({
        microchip: cleanChip,
        shortChip: editingRecord.shortChip || cleanChip.slice(-7),
        name: editingRecord.descripcion.split("(")[1]?.replace(")", "") || editingRecord.descripcion,
        species: "perro",
        breed: editingRecord.descripcion,
        gender: "macho",
        location: editingRecord.ubicacion,
        status: "activo",
      });
    }

    setEditingRecord(null);
    setFeedback("✅ Registro de Canino actualizado y sincronizado en todo el sistema");
    loadRecords();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleSaveCatEdit = async () => {
    if (!editingCat || !editingCat.id) return;
    await db.gateraRecords.update(editingCat.id, editingCat);

    // Cascada a db.animals
    const cleanChip = editingCat.microchip.trim();
    const existingCatAnimal = await db.animals.where("microchip").equals(cleanChip).first();
    if (existingCatAnimal && existingCatAnimal.id) {
      await db.animals.update(existingCatAnimal.id, {
        name: editingCat.nombre,
        location: editingCat.ubicacion,
        breed: `${editingCat.raza} - ${editingCat.color}`,
        gender: editingCat.sexo,
        isFeral: editingCat.isFeral,
        hc: editingCat.hc,
      });
    } else {
      await db.animals.add({
        microchip: cleanChip,
        shortChip: editingCat.shortChip || cleanChip.slice(-7),
        name: editingCat.nombre,
        species: "gato",
        breed: `${editingCat.raza} - ${editingCat.color}`,
        gender: editingCat.sexo,
        location: editingCat.ubicacion,
        status: "activo",
        isFeral: editingCat.isFeral,
        hc: editingCat.hc,
      });
    }

    setEditingCat(null);
    setFeedback("✅ Ficha de Felino (Gatera) actualizada y sincronizada en todo el sistema");
    loadRecords();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleDelete = async (id?: number, microchip?: string) => {
    if (!id) return;
    if (confirm("¿Estás seguro de eliminar este registro de la planilla?")) {
      await db.shelterRecords.delete(id);
      if (microchip) {
        await db.animals.where("microchip").equals(microchip).delete();
      }
      setFeedback("🗑️ Registro de Canino eliminado del sistema");
      loadRecords();
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleDeleteCat = async (id?: number, microchip?: string) => {
    if (!id) return;
    if (confirm("¿Estás seguro de eliminar este felino de la planilla de Gatera?")) {
      await db.gateraRecords.delete(id);
      if (microchip) {
        await db.animals.where("microchip").equals(microchip).delete();
      }
      setFeedback("🗑️ Felino eliminado de Gatera y del sistema");
      loadRecords();
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleCreateNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMicrochip || !newDescripcion) return;

    const shortChip = newMicrochip.length > 7 ? newMicrochip.slice(-7) : newMicrochip;
    const cleanChip = newMicrochip.trim();

    await db.shelterRecords.add({
      section: newSection,
      ubicacion: newUbicacion.toUpperCase(),
      microchip: cleanChip,
      shortChip: shortChip.trim(),
      descripcion: newDescripcion,
      medicacion: newMedicacion,
      fechaFinal: newFechaFinal,
      tipo: newTipo,
      sistema: newSistema,
      pendientes: newPendientes,
      dosisBravecto: newBravecto,
    });

    // Cascada a db.animals
    await db.animals.put({
      microchip: cleanChip,
      shortChip: shortChip.trim(),
      name: newDescripcion.split("(")[1]?.replace(")", "") || newDescripcion,
      species: "perro",
      breed: newDescripcion,
      gender: "macho",
      location: newUbicacion.toUpperCase(),
      status: "activo",
    });

    setIsNewModalOpen(false);
    setFeedback("✨ Nuevo registro de Canino agregado y sincronizado exitosamente");
    loadRecords();
    setTimeout(() => setFeedback(null), 3000);

    // Resetear
    setNewMicrochip("");
    setNewDescripcion("");
    setNewMedicacion("");
    setNewPendientes("");
    setNewUbicacion("");
  };

  const handleCreateNewCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatMicrochip || !newCatNombre) return;

    const cleanChip = newCatMicrochip.trim();
    const shortChip = cleanChip.length > 7 ? cleanChip.slice(-7) : cleanChip;

    const newCatItem: GateraCat = {
      ubicacion: newCatUbicacion.trim().toUpperCase(),
      microchip: cleanChip,
      shortChip: shortChip.trim(),
      hc: newCatHc.trim(),
      nombre: newCatNombre.trim().toUpperCase(),
      raza: newCatRaza.trim().toUpperCase(),
      color: newCatColor.trim().toUpperCase(),
      sexo: newCatSexo,
      edad: newCatEdad.trim(),
      isFeral: newCatIsFeral,
      tipoIngreso: "RESGUARDO",
      condicionCorporal: "3/5",
      estadoSalud: "ESTABLE",
      fechaFinal: "HNI",
      tipo: "S",
      descripcion: `${newCatNombre.trim().toUpperCase()} (${newCatRaza.trim().toUpperCase()} - ${newCatColor.trim().toUpperCase()})`,
      medicacion: newCatMedicacion.trim(),
      sistema: newCatSistema.trim().toUpperCase(),
      pendientes: newCatPendientes.trim(),
      desparasitante: newCatDesparasitante.trim(),
    };

    await db.gateraRecords.add(newCatItem);

    // Cascada a db.animals
    await db.animals.put({
      microchip: cleanChip,
      shortChip: shortChip.trim(),
      name: newCatItem.nombre,
      species: "gato",
      breed: `${newCatItem.raza} - ${newCatItem.color}`,
      gender: newCatItem.sexo,
      location: newCatItem.ubicacion,
      status: "activo",
      isFeral: newCatItem.isFeral,
      hc: newCatItem.hc,
    });

    setIsNewCatModalOpen(false);
    setFeedback("🐱 Nuevo Felino registrado exitosamente en Gatera y sincronizado");
    loadRecords();
    setTimeout(() => setFeedback(null), 3000);

    // Resetear formulario
    setNewCatMicrochip("");
    setNewCatNombre("");
    setNewCatHc("");
    setNewCatColor("");
    setNewCatUbicacion("");
    setNewCatMedicacion("");
    setNewCatPendientes("");
    setNewCatIsFeral(false);
  };

  // Filtrado reactivo de Caninos
  const filteredRecords = records.filter((r) => {
    const matchSection =
      activeSection === "TODAS"
        ? true
        : activeSection === "FINALIZADOS"
        ? r.section.includes("FINALIZADO")
        : r.section === activeSection;

    const search = searchTerm.toLowerCase().trim();
    const matchSearch =
      !search ||
      r.microchip.toLowerCase().includes(search) ||
      (r.shortChip && r.shortChip.toLowerCase().includes(search)) ||
      r.ubicacion.toLowerCase().includes(search) ||
      r.descripcion.toLowerCase().includes(search) ||
      (r.medicacion && r.medicacion.toLowerCase().includes(search)) ||
      (r.pendientes && r.pendientes.toLowerCase().includes(search));

    return matchSection && matchSearch;
  });

  // Filtrado reactivo de Gatera
  const filteredCats = gateraList.filter((cat) => {
    const matchCatSection =
      gateraFilter === "TODOS"
        ? true
        : gateraFilter === "TTO_OCTUBRE"
        ? Boolean(cat.medicacion && cat.medicacion !== "Ninguno")
        : gateraFilter === "FERAL"
        ? cat.isFeral
        : gateraFilter === "CUARENTENA"
        ? cat.ubicacion.toUpperCase().includes("CUARENTENA")
        : gateraFilter === "MATERNAS"
        ? cat.ubicacion.toUpperCase().includes("MATERNA")
        : gateraFilter === "PATIOS"
        ? cat.ubicacion.toUpperCase().includes("PATIO")
        : true;

    const search = searchTerm.toLowerCase().trim();
    const matchSearch =
      !search ||
      cat.microchip.toLowerCase().includes(search) ||
      cat.shortChip.toLowerCase().includes(search) ||
      cat.hc.toLowerCase().includes(search) ||
      cat.ubicacion.toLowerCase().includes(search) ||
      cat.descripcion.toLowerCase().includes(search) ||
      cat.medicacion.toLowerCase().includes(search);

    return matchCatSection && matchSearch;
  });

  return (
    <div className="space-y-4 pb-24">
      {/* Selector de Planilla Caninos vs Gatera */}
      {currentUser?.role === "admin" || currentUser?.area === "ambas" || !currentUser ? (
        <div className="flex p-1 bg-slate-200 rounded-2xl gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setSelectedArea("caninos");
              setSearchTerm("");
            }}
            className={`w-1/2 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
              selectedArea === "caninos"
                ? "bg-white text-emerald-800 shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🐶 PLANILLA CANINOS ({records.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedArea("gatera");
              setSearchTerm("");
            }}
            className={`w-1/2 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
              selectedArea === "gatera"
                ? "bg-white text-purple-900 shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            🐱 PLANILLA GATERA ({gateraList.length})
          </button>
        </div>
      ) : (
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black shadow-sm ${
          selectedArea === "gatera"
            ? "bg-purple-50 border-purple-200 text-purple-900"
            : "bg-emerald-50 border-emerald-200 text-emerald-900"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-base">{selectedArea === "gatera" ? "🐱" : "🐶"}</span>
            <div>
              <span className="block leading-tight">
                {selectedArea === "gatera" ? "PLANILLA EXCLUSIVA: GATERA (FELINOS)" : "PLANILLA EXCLUSIVA: CANINOS"}
              </span>
              <span className="text-[10px] font-medium text-slate-500">
                Personal asignado a área {selectedArea.toUpperCase()}
              </span>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl ${
            selectedArea === "gatera" ? "bg-purple-200 text-purple-900" : "bg-emerald-200 text-emerald-900"
          }`}>
            {selectedArea === "gatera" ? `${gateraList.length} Felinos` : `${records.length} Caninos`}
          </span>
        </div>
      )}

      {/* 1. Header con métricas y botón de descarga según área */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet
                className={`w-6 h-6 ${selectedArea === "gatera" ? "text-purple-600" : "text-emerald-600"}`}
              />
              {selectedArea === "gatera" ? "Plan de Manejo GATERA" : "Planilla Caninos"}
            </h2>
            <p className="text-xs text-slate-500">
              {selectedArea === "gatera"
                ? `457 Felinos registrados del libro de Gatera. Maternidades, Cuarentenas y Tratamientos.`
                : `Planilla operativa de Caniles, Triaje, UCE y Medicación Noche.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Input oculto para subir Excel (.xlsx, .xls) */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-slate-900/20 active:scale-95 transition-all"
              title="Cargar archivo Excel original (Planilla Caninos o Plan Gatera) para sincronizar directamente"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>{isImporting ? "Sincronizando..." : "SUBIR / IMPORTAR EXCEL"}</span>
            </button>

            {selectedArea === "caninos" && canEdit && (
              <button
                type="button"
                onClick={() => setIsNewModalOpen(true)}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuevo Registro</span>
              </button>
            )}

            {selectedArea === "gatera" && canEdit && (
              <button
                type="button"
                onClick={() => setIsNewCatModalOpen(true)}
                className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/20 active:scale-95 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuevo Felino</span>
              </button>
            )}

            <button
              type="button"
              onClick={selectedArea === "gatera" ? exportGateraExcel : exportOriginalShelterExcel}
              className={`px-4 py-2.5 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg active:scale-95 transition-all ${
                selectedArea === "gatera"
                  ? "bg-purple-600 hover:bg-purple-700 shadow-purple-600/25"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
              }`}
            >
              <Download className="w-4 h-4" />
              <span>
                {selectedArea === "gatera"
                  ? "DESCARGAR EXCEL GATERA (.XLSX)"
                  : "DESCARGAR EXCEL ORIGINAL (.XLSX)"}
              </span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Buscador Rápido */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              selectedArea === "gatera"
                ? "Buscar felino por Microchip (ej. 3805649), HC (242755), Canil (CUARENTENA 1)..."
                : "Buscar por Microchip (ej. 3805740), Ubicación (TRIAGE 2), Nombre..."
            }
            className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        {/* Pestañas de Secciones según Área */}
        {selectedArea === "caninos" ? (
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {[
              { id: "TODAS", label: `Todas (${records.length})` },
              { id: "TRIAJE", label: `Triaje (${records.filter((r) => r.section === "TRIAJE").length})` },
              { id: "UCE", label: `UCE (${records.filter((r) => r.section === "UCE").length})` },
              { id: "NOCHE", label: `Noche (${records.filter((r) => r.section === "NOCHE").length})` },
              { id: "BRAVECTO", label: `Bravecto (${records.filter((r) => r.section === "BRAVECTO").length})` },
              { id: "LIMPIEZAS", label: `Limpiezas (${records.filter((r) => r.section === "LIMPIEZAS").length})` },
              { id: "BAÑOS", label: `Baños (${records.filter((r) => r.section === "BAÑOS").length})` },
              { id: "CDV", label: `CDV (+)` },
              { id: "FINALIZADOS", label: `Finalizados` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 ${
                  activeSection === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            {[
              { id: "TODOS", label: `Todos los Gatos (${gateraList.length})` },
              { id: "TTO_OCTUBRE", label: `Con Tratamiento (${gateraList.filter((c) => c.medicacion).length})` },
              { id: "FERAL", label: `⚠️ Ferales (${gateraList.filter((c) => c.isFeral).length})` },
              { id: "MATERNAS", label: `Maternidades` },
              { id: "CUARENTENA", label: `Cuarentenas` },
              { id: "PATIOS", label: `Patios Adopción` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGateraFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 ${
                  gateraFilter === tab.id
                    ? "bg-purple-900 text-white shadow-sm"
                    : "bg-purple-50 text-purple-800 hover:bg-purple-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Listado de Registros (CANINOS O GATERA) */}
      {selectedArea === "caninos" ? (
        <div className="space-y-2.5">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              No se encontraron registros de caninos con ese criterio.
            </div>
          ) : (
            filteredRecords.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-indigo-300 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-black text-[11px] rounded-lg">
                        {item.ubicacion || "SIN UBIC."}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{item.descripcion}</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                        {item.section}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-500 mt-1">
                      Chip: <strong>{item.shortChip || item.microchip}</strong>
                    </p>
                  </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenCanilCard(
                          {
                            microchip: item.microchip,
                            name: item.descripcion,
                            species: "perro",
                            location: item.ubicacion,
                            breed: item.section,
                            color: "",
                            notes: item.pendientes,
                          },
                          item.pendientes,
                          item.medicacion
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-[11px] border border-slate-300 transition-all active:scale-95 shadow-sm"
                      title="Imprimir Ficha de Canil & Código QR"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden sm:inline">Ficha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAnimalToAssign({
                          microchip: item.microchip,
                          name: item.descripcion,
                          location: item.ubicacion,
                          species: "perro",
                          medication: item.medicacion,
                          notes: item.pendientes,
                        });
                        setIsAssignModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-black text-[11px] border border-emerald-200 transition-all active:scale-95 shadow-sm"
                      title="Asignar perro a un operario o auxiliar"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Asignar</span>
                    </button>

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingRecord({ ...item })}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl"
                          title="Editar datos (Solo Veterinario/Admin)"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, item.microchip)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl"
                          title="Eliminar registro (Solo Veterinario/Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {item.medicacion && (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between text-slate-700">
                      <span className="font-bold text-slate-900">💊 Medicación:</span>
                      {item.sistema && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                          {item.sistema}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800">{item.medicacion}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* VISTA GATERA (461 FELINOS) */
        <div className="space-y-2.5">
          {filteredCats.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
              No se encontraron felinos en Gatera con ese criterio.
            </div>
          ) : (
            filteredCats.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-purple-300 transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-purple-100 border border-purple-200 text-purple-900 font-black text-xs rounded-lg">
                        {cat.ubicacion}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">{cat.descripcion}</span>
                      {cat.isFeral && (
                        <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200 animate-pulse">
                          ⚠️ FERAL
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs text-slate-500 mt-1">
                      <span>
                        Chip: <strong>{cat.shortChip || cat.microchip}</strong>
                      </span>
                      {cat.hc && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-700">
                          HC: {cat.hc}
                        </span>
                      )}
                      <span>Edad: {cat.edad || "N/D"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenCanilCard(
                          {
                            microchip: cat.microchip,
                            name: cat.nombre,
                            species: "gato",
                            location: cat.ubicacion,
                            breed: cat.raza || "Común",
                            color: cat.color || "",
                            notes: `HC: ${cat.hc}. ${cat.pendientes || ""}`,
                            isFeral: cat.isFeral,
                          },
                          `HC: ${cat.hc}. ${cat.pendientes || ""}`,
                          cat.medicacion
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-xl font-black text-[11px] border border-purple-200 transition-all active:scale-95 shadow-sm"
                      title="Imprimir Ficha de Gatera & Código QR"
                    >
                      <Printer className="w-3.5 h-3.5 text-purple-700" />
                      <span className="hidden sm:inline">Ficha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAnimalToAssign({
                          microchip: cat.microchip,
                          name: cat.nombre,
                          location: cat.ubicacion,
                          species: "gato",
                          isFeral: cat.isFeral,
                          medication: cat.medicacion,
                          notes: `HC: ${cat.hc}. ${cat.pendientes || ""}`,
                        });
                        setIsAssignModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 rounded-xl font-black text-[11px] border border-purple-200 transition-all active:scale-95 shadow-sm"
                      title="Asignar gato a un operario o auxiliar"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-purple-700" />
                      <span>Asignar</span>
                    </button>

                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingCat({ ...cat })}
                          className="p-2 text-purple-700 hover:bg-purple-50 rounded-xl shrink-0"
                          title="Editar felino (Solo Veterinario/Admin)"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCat(cat.id, cat.microchip)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl shrink-0"
                          title="Eliminar felino de Gatera (Solo Veterinario/Admin)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Tratamientos de Octubre */}
                {cat.medicacion && (
                  <div className="p-2.5 bg-purple-50/60 rounded-xl text-xs space-y-1 border border-purple-100">
                    <div className="flex items-center justify-between text-purple-900">
                      <span className="font-bold flex items-center gap-1">
                        <Pill className="w-3.5 h-3.5 text-purple-600" /> Tratamiento Gatera Octubre:
                      </span>
                      {cat.sistema && (
                        <span className="px-2 py-0.5 bg-purple-200 text-purple-800 rounded text-[10px] font-bold">
                          {cat.sistema}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900 font-medium">{cat.medicacion}</p>
                  </div>
                )}

                {/* Plan Sanitario Felino */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {cat.desparasitante && (
                      <span className="text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded">
                        Desparasit.: {cat.desparasitante}
                      </span>
                    )}
                    {cat.condicionCorporal && (
                      <span className="text-slate-600">Condición: {cat.condicionCorporal}</span>
                    )}
                  </div>
                  {cat.pendientes && (
                    <span className="text-slate-500 text-[10px]">{cat.pendientes}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Edición Gatera */}
      {editingCat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-base">Modificar Ficha de Felino (Gatera)</h3>
              <button
                onClick={() => setEditingCat(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CANIL / JAULA GATERA:</label>
                  <input
                    type="text"
                    value={editingCat.ubicacion}
                    onChange={(e) => setEditingCat({ ...editingCat, ubicacion: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">HISTORIA CLÍNICA (HC):</label>
                  <input
                    type="text"
                    value={editingCat.hc}
                    onChange={(e) => setEditingCat({ ...editingCat, hc: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MICROCHIP:</label>
                <input
                  type="text"
                  value={editingCat.microchip}
                  onChange={(e) => setEditingCat({ ...editingCat, microchip: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">DESCRIPCIÓN / COLOR:</label>
                <input
                  type="text"
                  value={editingCat.descripcion}
                  onChange={(e) => setEditingCat({ ...editingCat, descripcion: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">TRATAMIENTO DE OCTUBRE:</label>
                <textarea
                  rows={2}
                  value={editingCat.medicacion}
                  onChange={(e) => setEditingCat({ ...editingCat, medicacion: e.target.value })}
                  placeholder="Medicamentos felinos, puff, nebulización..."
                  className="w-full p-2.5 bg-slate-50 border rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                <input
                  type="checkbox"
                  id="catFeral"
                  checked={editingCat.isFeral}
                  onChange={(e) => setEditingCat({ ...editingCat, isFeral: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <label htmlFor="catFeral" className="font-bold text-red-900 cursor-pointer">
                  Marcar como Gato Feral / Reactivo (Requiere guantes de carnaza)
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCatEdit}
                  className="w-1/2 py-3 bg-purple-600 hover:bg-purple-700 font-bold rounded-xl text-white flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios en Gatera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edición Caninos */}
      {editingRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-base">Modificar Fila Caninos</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SECCIÓN:</label>
                  <select
                    value={editingRecord.section}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, section: e.target.value as any })
                    }
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="TRIAJE">TRIAJE</option>
                    <option value="UCE">UCE</option>
                    <option value="NOCHE">MEDICACIÓN NOCHE</option>
                    <option value="LIMPIEZAS">LIMPIEZAS</option>
                    <option value="BAÑOS">BAÑOS</option>
                    <option value="BRAVECTO">APLICAR BRAVECTO</option>
                    <option value="CDV">CDV (+)</option>
                    <option value="TRIAJE_FINALIZADO">TRIAJE FINALIZADO</option>
                    <option value="UCE_FINALIZADO">UCE FINALIZADO</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">UBICACIÓN:</label>
                  <input
                    type="text"
                    value={editingRecord.ubicacion}
                    onChange={(e) =>
                      setEditingRecord({ ...editingRecord, ubicacion: e.target.value })
                    }
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MICROCHIP:</label>
                <input
                  type="text"
                  value={editingRecord.microchip}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, microchip: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MEDICACIÓN:</label>
                <textarea
                  rows={2}
                  value={editingRecord.medicacion}
                  onChange={(e) =>
                    setEditingRecord({ ...editingRecord, medicacion: e.target.value })
                  }
                  className="w-full p-2.5 bg-slate-50 border rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl text-white flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Registro */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-base">Alimentar Nuevo Registro</h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNew} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">SECCIÓN:</label>
                  <select
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="TRIAJE">TRIAJE</option>
                    <option value="UCE">UCE</option>
                    <option value="NOCHE">MEDICACIÓN NOCHE</option>
                    <option value="LIMPIEZAS">LIMPIEZAS</option>
                    <option value="BAÑOS">BAÑOS</option>
                    <option value="BRAVECTO">APLICAR BRAVECTO</option>
                    <option value="CDV">CDV (+)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">UBICACIÓN:</label>
                  <input
                    type="text"
                    required
                    value={newUbicacion}
                    onChange={(e) => setNewUbicacion(e.target.value)}
                    placeholder="Ej: TRIAGE 2, UCE 14..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MICROCHIP:</label>
                <input
                  type="text"
                  required
                  value={newMicrochip}
                  onChange={(e) => setNewMicrochip(e.target.value)}
                  placeholder="Escanee con W91A o escriba 99100... / 3805..."
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">DESCRIPCIÓN:</label>
                <input
                  type="text"
                  required
                  value={newDescripcion}
                  onChange={(e) => setNewDescripcion(e.target.value)}
                  placeholder="Ej: MCA NEGRO X FUEGO (BOBBY)"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">MEDICACIÓN:</label>
                <textarea
                  rows={2}
                  value={newMedicacion}
                  onChange={(e) => setNewMedicacion(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border rounded-xl"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl text-white shadow-lg"
                >
                  Guardar en Planilla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nuevo Felino en Gatera */}
      {isNewCatModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <span>🐱</span> Registrar Nuevo Felino en Gatera
              </h3>
              <button
                onClick={() => setIsNewCatModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCat} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CANIL / JAULA / ÁREA:</label>
                  <input
                    type="text"
                    required
                    value={newCatUbicacion}
                    onChange={(e) => setNewCatUbicacion(e.target.value)}
                    placeholder="Ej: CUARENTENA 3, MATERNIDAD 2..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">HISTORIA CLÍNICA (HC):</label>
                  <input
                    type="text"
                    value={newCatHc}
                    onChange={(e) => setNewCatHc(e.target.value)}
                    placeholder="Ej: 242780"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">MICROCHIP:</label>
                  <input
                    type="text"
                    required
                    value={newCatMicrochip}
                    onChange={(e) => setNewCatMicrochip(e.target.value)}
                    placeholder="3805... o 991001..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">NOMBRE DEL FELINO:</label>
                  <input
                    type="text"
                    required
                    value={newCatNombre}
                    onChange={(e) => setNewCatNombre(e.target.value)}
                    placeholder="Ej: FELIX, MICHÍN, LUNA..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">RAZA:</label>
                  <input
                    type="text"
                    value={newCatRaza}
                    onChange={(e) => setNewCatRaza(e.target.value)}
                    placeholder="CRIOLLO"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">COLOR:</label>
                  <input
                    type="text"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    placeholder="ROMANO, NEGRO..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">SEXO:</label>
                  <select
                    value={newCatSexo}
                    onChange={(e) => setNewCatSexo(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="macho">Macho</option>
                    <option value="hembra">Hembra</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">TRATAMIENTO GATERA (PLAN OCTUBRE):</label>
                <textarea
                  rows={2}
                  value={newCatMedicacion}
                  onChange={(e) => setNewCatMedicacion(e.target.value)}
                  placeholder="Medicamento, dosis, horario o dejar en blanco si no tiene..."
                  className="w-full p-2.5 bg-slate-50 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">DESPARASITANTE / PLAN SANITARIO:</label>
                  <input
                    type="text"
                    value={newCatDesparasitante}
                    onChange={(e) => setNewCatDesparasitante(e.target.value)}
                    placeholder="Ej: TOTAL F, REVOLUTION..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">PENDIENTES / OBSERVACIONES:</label>
                  <input
                    type="text"
                    value={newCatPendientes}
                    onChange={(e) => setNewCatPendientes(e.target.value)}
                    placeholder="Observaciones de ingreso..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
                <input
                  type="checkbox"
                  id="newCatFeral"
                  checked={newCatIsFeral}
                  onChange={(e) => setNewCatIsFeral(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded"
                />
                <label htmlFor="newCatFeral" className="font-bold text-red-900 cursor-pointer">
                  Marcar como Gato Feral / Reactivo (Requiere guantes de carnaza y manejo cauteloso)
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewCatModalOpen(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-xl text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-purple-600 hover:bg-purple-700 font-bold rounded-xl text-white shadow-lg"
                >
                  Guardar en Gatera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Asignar Animal a Operario / Auxiliar */}
      <AssignAnimalModal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        initialAnimal={selectedAnimalToAssign}
        userArea={selectedArea}
        onSuccess={(task) => {
          setFeedback(`🐾 ¡${task.animalName} asignado exitosamente a ${task.assignedTo}!`);
          setTimeout(() => setFeedback(null), 3000);
        }}
      />

      {/* Modal de Ficha Médica de Canil & Código QR Imprimible */}
      {selectedCardAnimal && (
        <CanilCardModal
          isOpen={isCanilModalOpen}
          onClose={() => setIsCanilModalOpen(false)}
          animal={selectedCardAnimal}
          treatments={selectedCardTreatments}
          location={selectedCardAnimal.location}
          notes={selectedCardNotes}
        />
      )}
    </div>
  );
};
