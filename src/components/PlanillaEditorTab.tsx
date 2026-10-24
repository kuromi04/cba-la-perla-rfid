"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { db, Animal, KardexRecord } from "@/lib/db";
import { GateraCat } from "@/lib/gateraData";
import { exportGateraExcel } from "@/lib/excelGenerator";
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
  ShieldAlert,
  Sparkles,
  Stethoscope,
  Scissors,
  Eye,
  Calendar,
} from "lucide-react";
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
  const [gateraList, setGateraList] = useState<GateraCat[]>([]);
  const [gateraFilter, setGateraFilter] = useState<string>("TODOS");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCat, setEditingCat] = useState<GateraCat | null>(null);
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ficha de Canil / Gatera Imprimible
  const [selectedCardAnimal, setSelectedCardAnimal] = useState<Animal | null>(null);
  const [selectedCardTreatments, setSelectedCardTreatments] = useState<KardexRecord[]>([]);
  const [selectedCardNotes, setSelectedCardNotes] = useState<string | undefined>(undefined);
  const [isCanilModalOpen, setIsCanilModalOpen] = useState(false);

  // Estado del Formulario Nuevo Felino (Todos los 24 campos de la hoja CENSO)
  const [newCat, setNewCat] = useState<Partial<GateraCat>>({
    ubicacion: "CUARENTENA 1",
    microchip: "",
    hc: "",
    sexoCode: "HFA",
    sexo: "hembra",
    grupoEdad: "adulto",
    raza: "DPC",
    isFeral: false,
    color: "",
    tipoIngreso: "RES",
    fechaNacimiento: "",
    edad: "1 año",
    fechaIngreso: new Date().toISOString().split("T")[0],
    condicionCorporal: "RANGO 2.0/5",
    estadoSalud: "Saludable",
    medicacion: "",
    observacionesMedicas: "",
    requiereSeguimiento: "NO",
    tipoSeguimiento: "NO APLICA",
    fechaSeguimiento: "",
    peluqueria: "",
    corteUnas: "",
    limpiezaOidos: "",
    fechaAseo: "",
    medicoVeterinario: "Dra. Jenny Zapata Calle",
    desparasitante: "REVOLUTION / TOTAL FCG",
  });

  const loadRecords = async () => {
    const allCats = await db.gateraRecords.toArray();
    setGateraList(allCats);
  };

  useEffect(() => {
    loadRecords();
  }, []);

  // Catálogos dinámicos basados en la base de datos real para autocompletado inteligente
  const uniqueLocations = useMemo(() => {
    return Array.from(new Set(gateraList.map((c) => c.ubicacion).filter(Boolean))).sort();
  }, [gateraList]);

  const uniqueColors = useMemo(() => {
    return Array.from(new Set(gateraList.map((c) => c.color).filter(Boolean))).sort();
  }, [gateraList]);

  const uniqueDiagnoses = useMemo(() => {
    return Array.from(new Set(gateraList.map((c) => c.observacionesMedicas).filter(Boolean))).sort();
  }, [gateraList]);

  const uniqueTreatments = useMemo(() => {
    return Array.from(new Set(gateraList.map((c) => c.medicacion).filter((m) => m && m !== "Ninguno"))).sort();
  }, [gateraList]);

  const uniqueVets = useMemo(() => {
    return Array.from(new Set(gateraList.map((c) => c.medicoVeterinario).filter(Boolean))).sort();
  }, [gateraList]);

  const handleOpenCanilCard = async (cat: GateraCat) => {
    const animal: Animal = {
      microchip: cat.microchip,
      shortChip: cat.shortChip,
      name: cat.nombre,
      species: "gato",
      breed: `${cat.raza} - ${cat.color}`,
      gender: cat.sexo,
      location: cat.ubicacion,
      status: "activo",
      isFeral: cat.isFeral,
      hc: cat.hc,
      notes: `${cat.pendientes || ""}. ${cat.observacionesMedicas || ""}`,
    };
    setSelectedCardAnimal(animal);
    setSelectedCardNotes(cat.observacionesMedicas || cat.pendientes);
    try {
      const kx = await db.kardex.where("microchip").equals(cat.microchip).toArray();
      if (kx && kx.length > 0) {
        setSelectedCardTreatments(kx);
      } else if (cat.medicacion && cat.medicacion !== "Ninguno") {
        setSelectedCardTreatments([
          {
            microchip: cat.microchip,
            system: cat.sistema || "GENERAL",
            treatment: cat.medicacion,
            description: `Prescrito según censo de Gatera [${cat.ubicacion}]. ${cat.observacionesMedicas || ""}`,
            startDate: cat.fechaIngreso || new Date().toISOString().split("T")[0],
            endDate: "HNI",
            status: "activo",
            prescribedBy: cat.medicoVeterinario || "Dra. Jenny Zapata Calle",
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setFeedback("⏳ Sincronizando e importando datos del archivo Excel maestro de Gatera...");

    try {
      const res = await importExcelFile(file);
      await loadRecords();
      if (res.success) {
        setFeedback(res.message);
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

  const handleSaveCatEdit = async () => {
    if (!canEdit) {
      setFeedback("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para modificar registros.");
      return;
    }
    if (!editingCat || !editingCat.id) return;

    const cleanChip = editingCat.microchip.trim().toUpperCase();
    const isHembra = editingCat.sexoCode ? editingCat.sexoCode.startsWith("H") : editingCat.sexo === "hembra";
    const isAdulto = editingCat.sexoCode ? editingCat.sexoCode.includes("A") : true;

    const updatedCat: GateraCat = {
      ...editingCat,
      microchip: cleanChip,
      sexo: isHembra ? "hembra" : "macho",
      grupoEdad: isAdulto ? "adulto" : "cachorro",
      nombre: editingCat.color ? `Gato ${editingCat.color.split(" ")[0]} ${editingCat.ubicacion}` : `Felino ${editingCat.ubicacion}`,
      descripcion: `${editingCat.sexoCode} ${editingCat.color} (${editingCat.raza})`,
    };

    await db.gateraRecords.update(editingCat.id, updatedCat);

    // Cascada y sincronización en db.animals
    const existingCatAnimal = await db.animals.where("microchip").equals(cleanChip).first();
    if (existingCatAnimal && existingCatAnimal.id) {
      await db.animals.update(existingCatAnimal.id, {
        name: updatedCat.nombre,
        location: updatedCat.ubicacion,
        breed: updatedCat.raza || "DPC",
        gender: updatedCat.sexo,
        sexoCode: updatedCat.sexoCode,
        grupoEdad: updatedCat.grupoEdad,
        isFeral: updatedCat.isFeral,
        hc: updatedCat.hc,
        color: updatedCat.color,
        condicionCorporal: updatedCat.condicionCorporal,
        estadoSalud: updatedCat.estadoSalud,
        observacionesMedicas: updatedCat.observacionesMedicas,
        requiereSeguimiento: updatedCat.requiereSeguimiento,
        tipoSeguimiento: updatedCat.tipoSeguimiento,
        fechaSeguimiento: updatedCat.fechaSeguimiento,
        peluqueria: updatedCat.peluqueria,
        corteUnas: updatedCat.corteUnas,
        limpiezaOidos: updatedCat.limpiezaOidos,
        fechaAseo: updatedCat.fechaAseo,
        medicoVeterinario: updatedCat.medicoVeterinario,
        notes: `${updatedCat.pendientes || ""}. HC: ${updatedCat.hc || ""}`,
      });
    } else {
      await db.animals.add({
        microchip: cleanChip,
        shortChip: updatedCat.shortChip || cleanChip.slice(-7),
        name: updatedCat.nombre,
        species: "gato",
        breed: updatedCat.raza || "DPC",
        gender: updatedCat.sexo,
        sexoCode: updatedCat.sexoCode,
        grupoEdad: updatedCat.grupoEdad,
        location: updatedCat.ubicacion,
        status: "activo",
        isFeral: updatedCat.isFeral,
        hc: updatedCat.hc,
        color: updatedCat.color,
        condicionCorporal: updatedCat.condicionCorporal,
        estadoSalud: updatedCat.estadoSalud,
        observacionesMedicas: updatedCat.observacionesMedicas,
        requiereSeguimiento: updatedCat.requiereSeguimiento,
        tipoSeguimiento: updatedCat.tipoSeguimiento,
        fechaSeguimiento: updatedCat.fechaSeguimiento,
        peluqueria: updatedCat.peluqueria,
        corteUnas: updatedCat.corteUnas,
        limpiezaOidos: updatedCat.limpiezaOidos,
        fechaAseo: updatedCat.fechaAseo,
        medicoVeterinario: updatedCat.medicoVeterinario,
        notes: `${updatedCat.pendientes || ""}. HC: ${updatedCat.hc || ""}`,
      });
    }

    // Sincronizar en Kardex si tiene tratamiento
    if (updatedCat.medicacion && updatedCat.medicacion !== "Ninguno") {
      const existingKardex = await db.kardex.where("microchip").equals(cleanChip).first();
      if (existingKardex?.id) {
        await db.kardex.update(existingKardex.id, {
          treatment: updatedCat.medicacion,
          description: `Gatera [${updatedCat.ubicacion}]. HC: ${updatedCat.hc} ${updatedCat.isFeral ? "⚠️ FERAL" : ""}. ${updatedCat.observacionesMedicas || ""}`,
          prescribedBy: updatedCat.medicoVeterinario || existingKardex.prescribedBy,
        });
      }
    }

    setEditingCat(null);
    setFeedback("✅ Ficha maestra de Felino actualizada y sincronizada en todo el sistema");
    loadRecords();
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleDeleteCat = async (id?: number, microchip?: string) => {
    if (!canEdit) {
      setFeedback("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para eliminar registros.");
      return;
    }
    if (!id) return;
    if (confirm("¿Estás seguro de eliminar este felino de la planilla maestra de Gatera?")) {
      await db.gateraRecords.delete(id);
      if (microchip) {
        await db.animals.where("microchip").equals(microchip).delete();
        await db.kardex.where("microchip").equals(microchip).delete();
        await db.census.where("microchip").equals(microchip).delete();
      }
      setFeedback("🗑️ Felino eliminado de Gatera y de la base de datos");
      loadRecords();
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleCreateNewCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setFeedback("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para dar de alta felinos.");
      return;
    }
    if (!newCat.microchip || !newCat.ubicacion) {
      setFeedback("⚠️ Debes ingresar al menos el Microchip y la Ubicación (Canil / Patio).");
      return;
    }

    const cleanChip = newCat.microchip.trim().toUpperCase();
    const shortChip = cleanChip.length > 7 ? cleanChip.slice(-7) : cleanChip;

    // REGLA DE ORO: Validar unicidad estricta de microchip
    const existing = await db.animals.where("microchip").equals(cleanChip).first();
    if (existing) {
      setFeedback(`⛔ Regla de Oro: El microchip ${cleanChip} ya existe a nombre de ${existing.name || "S/N"}. No se permiten duplicados.`);
      return;
    }

    const isHembra = newCat.sexoCode ? newCat.sexoCode.startsWith("H") : newCat.sexo === "hembra";
    const isAdulto = newCat.sexoCode ? newCat.sexoCode.includes("A") : true;
    const catName = newCat.color ? `Gato ${newCat.color.split(" ")[0]} ${newCat.ubicacion}` : `Felino ${newCat.ubicacion}`;

    const catToInsert: GateraCat = {
      nroAnimal: String(gateraList.length + 1),
      ubicacion: newCat.ubicacion || "GATERA GENERAL",
      microchip: cleanChip,
      shortChip,
      hc: newCat.hc || shortChip.slice(-5),
      sexoCode: newCat.sexoCode || "HFA",
      sexo: isHembra ? "hembra" : "macho",
      grupoEdad: isAdulto ? "adulto" : "cachorro",
      raza: newCat.raza || "DPC",
      isFeral: Boolean(newCat.isFeral),
      color: newCat.color || "SIN ESPECIFICAR",
      tipoIngreso: newCat.tipoIngreso || "RES",
      fechaNacimiento: newCat.fechaNacimiento || "",
      edad: newCat.edad || "1 año",
      fechaIngreso: newCat.fechaIngreso || new Date().toISOString().split("T")[0],
      condicionCorporal: newCat.condicionCorporal || "RANGO 2.0/5",
      estadoSalud: newCat.estadoSalud || "Saludable",
      medicacion: newCat.medicacion || "Ninguno",
      observacionesMedicas: newCat.observacionesMedicas || "",
      requiereSeguimiento: newCat.requiereSeguimiento || (newCat.observacionesMedicas ? "SI" : "NO"),
      tipoSeguimiento: newCat.tipoSeguimiento || "TRATAMIENTO",
      fechaSeguimiento: newCat.fechaSeguimiento || "",
      peluqueria: newCat.peluqueria || "",
      corteUnas: newCat.corteUnas || "",
      limpiezaOidos: newCat.limpiezaOidos || "",
      fechaAseo: newCat.fechaAseo || "",
      medicoVeterinario: newCat.medicoVeterinario || "Dra. Jenny Zapata Calle",
      nombre: catName,
      descripcion: `${newCat.sexoCode || "HFA"} ${newCat.color || ""} (${newCat.raza || "DPC"})`,
      pendientes: newCat.isFeral ? "⚠️ MANEJO FERAL / GUANTES" : (newCat.observacionesMedicas || "INGRESO NUEVO"),
      sistema: newCat.medicacion?.toLowerCase().includes("respi") ? "RESPI" : "TEGUMEN",
      fechaFinal: "HNI",
      tipo: "S",
      desparasitante: newCat.desparasitante || "REVOLUTION / TOTAL FCG",
    };

    await db.gateraRecords.add(catToInsert);

    // Agregar en db.animals
    await db.animals.add({
      nroAnimal: catToInsert.nroAnimal,
      microchip: cleanChip,
      shortChip,
      name: catToInsert.nombre,
      species: "gato",
      breed: catToInsert.raza,
      gender: catToInsert.sexo,
      sexoCode: catToInsert.sexoCode,
      grupoEdad: catToInsert.grupoEdad,
      location: catToInsert.ubicacion,
      status: "activo",
      isFeral: catToInsert.isFeral,
      hc: catToInsert.hc,
      color: catToInsert.color,
      tipoIngreso: catToInsert.tipoIngreso,
      fechaNacimiento: catToInsert.fechaNacimiento,
      edad: catToInsert.edad,
      fechaIngreso: catToInsert.fechaIngreso,
      condicionCorporal: catToInsert.condicionCorporal,
      estadoSalud: catToInsert.estadoSalud,
      observacionesMedicas: catToInsert.observacionesMedicas,
      requiereSeguimiento: catToInsert.requiereSeguimiento,
      tipoSeguimiento: catToInsert.tipoSeguimiento,
      fechaSeguimiento: catToInsert.fechaSeguimiento,
      peluqueria: catToInsert.peluqueria,
      corteUnas: catToInsert.corteUnas,
      limpiezaOidos: catToInsert.limpiezaOidos,
      fechaAseo: catToInsert.fechaAseo,
      medicoVeterinario: catToInsert.medicoVeterinario,
      notes: `${catToInsert.pendientes}. HC: ${catToInsert.hc}`,
    });

    // Agregar tratamiento si corresponde
    if (catToInsert.medicacion && catToInsert.medicacion !== "Ninguno") {
      await db.kardex.add({
        microchip: cleanChip,
        shortChip,
        system: catToInsert.sistema,
        treatment: catToInsert.medicacion,
        description: `Gatera [${catToInsert.ubicacion}]. HC: ${catToInsert.hc} ${catToInsert.isFeral ? "⚠️ FERAL" : ""}. ${catToInsert.observacionesMedicas}`,
        startDate: catToInsert.fechaIngreso || new Date().toISOString().split("T")[0],
        endDate: "HNI",
        status: "activo",
        prescribedBy: catToInsert.medicoVeterinario,
        createdAt: new Date().toISOString(),
        tipo: "S",
        pendientes: catToInsert.pendientes,
        section: "GATERA_CENSO",
        area: "gatera",
        dosisTotales: 7,
        dosisAplicadas: 0,
        dosisFaltantes: 7,
      });
    }

    setIsNewCatModalOpen(false);
    setFeedback(`✨ Felino registrado exitosamente con chip ${cleanChip} en ${catToInsert.ubicacion}`);
    loadRecords();
    setTimeout(() => setFeedback(null), 3500);
  };

  // Filtrado de felinos en tiempo real
  const filteredCats = gateraList.filter((cat) => {
    // 1. Filtro por categoría rápida
    if (gateraFilter === "TTO_OCTUBRE" && (!cat.medicacion || cat.medicacion === "Ninguno")) return false;
    if (gateraFilter === "FERAL" && !cat.isFeral) return false;
    if (gateraFilter === "MATERNAS" && !cat.ubicacion.toUpperCase().includes("MATERNA")) return false;
    if (gateraFilter === "CUARENTENA" && !cat.ubicacion.toUpperCase().includes("CUARENTENA")) return false;
    if (gateraFilter === "PATIOS" && !cat.ubicacion.toUpperCase().includes("PATIO")) return false;
    if (gateraFilter === "HOSPITAL" && !cat.ubicacion.toUpperCase().includes("HOSPITAL")) return false;

    // 2. Filtro por término de búsqueda
    if (searchTerm) {
      const q = searchTerm.toUpperCase().trim();
      const matchChip = cat.microchip.toUpperCase().includes(q) || (cat.shortChip && cat.shortChip.toUpperCase().includes(q));
      const matchHc = cat.hc && cat.hc.toUpperCase().includes(q);
      const matchUbic = cat.ubicacion && cat.ubicacion.toUpperCase().includes(q);
      const matchNombre = cat.nombre && cat.nombre.toUpperCase().includes(q);
      const matchObs = cat.observacionesMedicas && cat.observacionesMedicas.toUpperCase().includes(q);
      const matchMed = cat.medicacion && cat.medicacion.toUpperCase().includes(q);
      return matchChip || matchHc || matchUbic || matchNombre || matchObs || matchMed;
    }

    return true;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Datalists dinámicos para autocompletado y ahorro de tiempo */}
      <datalist id="locations-list">
        {uniqueLocations.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>
      <datalist id="colors-list">
        {uniqueColors.map((col) => (
          <option key={col} value={col} />
        ))}
      </datalist>
      <datalist id="diagnoses-list">
        {uniqueDiagnoses.map((diag) => (
          <option key={diag} value={diag} />
        ))}
      </datalist>
      <datalist id="medications-list">
        {uniqueTreatments.map((med) => (
          <option key={med} value={med} />
        ))}
      </datalist>
      <datalist id="vets-list">
        {uniqueVets.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>

      {/* Banner de Identificación del Módulo */}
      <div className="p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black shadow-sm bg-purple-50 border-purple-200 text-purple-950">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🐱</span>
          <div>
            <span className="block leading-tight text-sm font-black">
              PLANILLA MAESTRA DE GATERA (HOJA CENSO OFICIAL)
            </span>
            <span className="text-[10px] font-medium text-purple-700">
              Copia fiel del archivo maestro CBA La Perla • 24 Columnas Integradas
            </span>
          </div>
        </div>
        <span className="text-xs font-black px-3 py-1 rounded-xl bg-purple-200 text-purple-950">
          {gateraList.length} Felinos
        </span>
      </div>

      {/* 1. Header con métricas, importación y exportación */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-purple-600" />
              Plan de Manejo y Censo GATERA
            </h2>
            <p className="text-xs text-slate-500">
              {gateraList.length} Felinos registrados. Cuarentenas 1-8, Patios VIF, Maternidades, Hospital y Tratamientos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Input oculto para subir Excel (.xlsx) */}
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
              className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-slate-900/20 active:scale-95 transition-all"
              title="Cargar archivo Excel original de Gatera para actualizar datos"
            >
              <Upload className="w-4 h-4 text-emerald-400" />
              <span>{isImporting ? "Sincronizando..." : "IMPORTAR EXCEL"}</span>
            </button>

            {canEdit && (
              <button
                type="button"
                onClick={() => setIsNewCatModalOpen(true)}
                className="px-3.5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-purple-600/25 active:scale-95 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuevo Felino</span>
              </button>
            )}

            <button
              type="button"
              onClick={exportGateraExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>DESCARGAR EXCEL GATERA (24 COLS)</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Buscador Rápido con Autocompletado */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Microchip (ej. 3806020), HC (242755), Ubicación (CUARENTENA 1, PATIO 1), Diagnóstico..."
            className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
          />
        </div>

        {/* Pestañas de Filtros Rápidos */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: "TODOS", label: `Todos los Gatos (${gateraList.length})` },
            { id: "TTO_OCTUBRE", label: `Con Tratamiento (${gateraList.filter((c) => c.medicacion && c.medicacion !== "Ninguno").length})` },
            { id: "FERAL", label: `⚠️ Ferales (${gateraList.filter((c) => c.isFeral).length})` },
            { id: "CUARENTENA", label: `Cuarentenas (${gateraList.filter((c) => c.ubicacion.toUpperCase().includes("CUARENTENA")).length})` },
            { id: "PATIOS", label: `Patios VIF / Adopción` },
            { id: "MATERNAS", label: `Maternidades` },
            { id: "HOSPITAL", label: `Hospital Reactivo` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setGateraFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-black whitespace-nowrap transition-all shrink-0 ${
                gateraFilter === tab.id
                  ? "bg-purple-900 text-white shadow-sm"
                  : "bg-purple-50 text-purple-900 hover:bg-purple-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Listado de Felinos con Todas las Columnas del Censo */}
      <div className="space-y-3">
        {filteredCats.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            No se encontraron felinos que coincidan con el criterio seleccionado.
          </div>
        ) : (
          filteredCats.map((cat) => (
            <div
              key={cat.id || cat.microchip}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-purple-300 transition-all space-y-2.5"
            >
              {/* Fila Principal: Ubicación, Nombre, Feral y Acciones */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2.5 py-0.5 bg-purple-100 border border-purple-200 text-purple-900 font-black text-[11px] rounded-lg">
                      📍 {cat.ubicacion || "SIN ASIGNAR"}
                    </span>
                    <strong className="text-slate-900 text-xs font-black">{cat.nombre}</strong>
                    {cat.isFeral && (
                      <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-md flex items-center gap-1 shadow-sm animate-pulse">
                        ⚠️ FERAL / GUANTES
                      </span>
                    )}
                    {cat.sexoCode && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-black rounded">
                        {cat.sexoCode}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 font-mono mt-1">
                    <span>MC: <strong className="text-slate-800">{cat.microchip}</strong></span>
                    <span>HC: <strong className="text-indigo-700">{cat.hc || "N/A"}</strong></span>
                    <span>Raza: {cat.raza}</span>
                    <span>Color: {cat.color}</span>
                    <span>Edad: {cat.edad}</span>
                  </div>
                </div>

                {/* Botones de Acción */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenCanilCard(cat)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all"
                    title="Imprimir Ficha Clínica de Gatera"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingCat({ ...cat })}
                        className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg transition-all"
                        title="Modificar los 24 campos de la hoja de censo"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCat(cat.id, cat.microchip)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition-all"
                        title="Eliminar registro de Gatera"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Fila Clínica: Condición Corporal, Estado, Diagnóstico */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1 border-t border-slate-100">
                <div className="p-1.5 bg-slate-50 rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Condición Corporal:</span>
                  <span className="font-bold text-slate-800">{cat.condicionCorporal || "RANGO 2.0/5"}</span>
                </div>
                <div className="p-1.5 bg-slate-50 rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Estado de Salud:</span>
                  <span className={`font-black ${cat.estadoSalud === "Delicado" ? "text-rose-600" : cat.estadoSalud === "Regular" ? "text-amber-600" : "text-emerald-700"}`}>
                    {cat.estadoSalud || "Saludable"}
                  </span>
                </div>
                <div className="col-span-2 p-1.5 bg-slate-50 rounded-lg">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Diagnóstico / Observaciones:</span>
                  <span className="font-medium text-slate-800 truncate block" title={cat.observacionesMedicas}>
                    {cat.observacionesMedicas || "Sin observaciones pendientes"}
                  </span>
                </div>
              </div>

              {/* Tratamiento Activo */}
              {cat.medicacion && cat.medicacion !== "Ninguno" && (
                <div className="p-2.5 bg-purple-50/70 rounded-xl text-xs space-y-1 border border-purple-100">
                  <div className="flex items-center justify-between text-purple-900">
                    <span className="font-black flex items-center gap-1">
                      <Pill className="w-3.5 h-3.5 text-purple-600" /> Tratamiento de Gatera:
                    </span>
                    {cat.sistema && (
                      <span className="px-2 py-0.5 bg-purple-200 text-purple-900 rounded text-[10px] font-black">
                        {cat.sistema}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-900 font-bold">{cat.medicacion}</p>
                </div>
              )}

              {/* Pie de Ficha: Seguimiento, Aseo y Médico */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  {cat.requiereSeguimiento === "SI" && (
                    <span className="text-indigo-800 font-black bg-indigo-50 px-2 py-0.5 rounded">
                      📋 Seguimiento: {cat.tipoSeguimiento || "TRATAMIENTO"}
                    </span>
                  )}
                  {cat.limpiezaOidos && (
                    <span className="text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded">
                      👂 Limpieza Oídos: {cat.limpiezaOidos}
                    </span>
                  )}
                </div>
                <span className="font-bold text-slate-700">
                  🩺 {cat.medicoVeterinario || "Dra. Jenny Zapata Calle"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL 1: MODIFICAR FICHA COMPLETA (24 CAMPOS DEL CENSO MAESTRO) */}
      {editingCat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto border border-slate-200 animate-in zoom-in-95">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base leading-tight">
                  Modificar Ficha Maestra de Gatera (24 Columnas)
                </h3>
                <p className="text-xs text-slate-500">
                  Edición directa de campos, condición clínica y plan de tratamiento
                </p>
              </div>
              <button
                onClick={() => setEditingCat(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
              {/* Sección 1: Identificación y Ubicación */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nº CANIL (Ubicación Gatera):
                  </label>
                  <input
                    type="text"
                    list="locations-list"
                    value={editingCat.ubicacion}
                    onChange={(e) => setEditingCat({ ...editingCat, ubicacion: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-slate-900"
                    placeholder="Ej. CUARENTENA 1"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    MICROCHIP (MC):
                  </label>
                  <input
                    type="text"
                    value={editingCat.microchip}
                    onChange={(e) => setEditingCat({ ...editingCat, microchip: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    HISTORIA CLÍNICA (HC):
                  </label>
                  <input
                    type="text"
                    value={editingCat.hc || ""}
                    onChange={(e) => setEditingCat({ ...editingCat, hc: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono"
                    placeholder="Ej. 242755"
                  />
                </div>
              </div>

              {/* Sección 2: Sexo, Raza, Color y Feral */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">A (SEXO/GRUPO):</label>
                  <select
                    value={editingCat.sexoCode || "HFA"}
                    onChange={(e) => setEditingCat({ ...editingCat, sexoCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="HFA">HFA (Hembra Adulta)</option>
                    <option value="MFA">MFA (Macho Adulto)</option>
                    <option value="HFC">HFC (Hembra Cachorra)</option>
                    <option value="MFC">MFC (Macho Cachorro)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">RAZA:</label>
                  <select
                    value={editingCat.raza || "DPC"}
                    onChange={(e) => setEditingCat({ ...editingCat, raza: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="DPC">DPC (Pelo Corto)</option>
                    <option value="DPL">DPL (Pelo Largo)</option>
                    <option value="FELINO">FELINO GENERAL</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">COLOR:</label>
                  <input
                    type="text"
                    list="colors-list"
                    value={editingCat.color || ""}
                    onChange={(e) => setEditingCat({ ...editingCat, color: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                    placeholder="Ej. BLANCO X NEGRO"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">TIPO DE INGRESO:</label>
                  <select
                    value={editingCat.tipoIngreso || "RES"}
                    onChange={(e) => setEditingCat({ ...editingCat, tipoIngreso: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="RES">RES (Resguardo)</option>
                    <option value="APM">APM (Atención Médica)</option>
                    <option value="INC">INC (Inclusión Social)</option>
                    <option value="E Y D">E Y D</option>
                  </select>
                </div>
              </div>

              {/* Switch de Gato Feral */}
              <div className="flex items-center justify-between p-3 bg-rose-50 rounded-2xl border border-rose-200">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <div>
                    <span className="font-black text-rose-950 block text-xs">
                      Condición Feral / Manejo con Guantes
                    </span>
                    <span className="text-[10px] text-rose-700 font-medium">
                      Indica si el gato es reactivo y requiere guantes de carnaza obligatorios
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCat({ ...editingCat, isFeral: !editingCat.isFeral })}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                    editingCat.isFeral
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {editingCat.isFeral ? "⚠️ ES FERAL (SI)" : "MANSO (NO)"}
                </button>
              </div>

              {/* Sección 3: Fechas, Edad, Condición y Estado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">EDAD APROXIMADA:</label>
                  <input
                    type="text"
                    value={editingCat.edad || ""}
                    onChange={(e) => setEditingCat({ ...editingCat, edad: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl"
                    placeholder="Ej. 2 años y 0 meses"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">CONDICIÓN CORPORAL:</label>
                  <select
                    value={editingCat.condicionCorporal || "RANGO 2.0/5"}
                    onChange={(e) => setEditingCat({ ...editingCat, condicionCorporal: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="RANGO 1.0/5">RANGO 1.0/5 (Muy bajo)</option>
                    <option value="RANGO 1.5/5">RANGO 1.5/5</option>
                    <option value="RANGO 2.0/5">RANGO 2.0/5 (Delgado)</option>
                    <option value="RANGO 2.5/5">RANGO 2.5/5</option>
                    <option value="RANGO 3.0/5">RANGO 3.0/5 (Ideal)</option>
                    <option value="RANGO 3.5/5">RANGO 3.5/5</option>
                    <option value="RANGO 4.0/5">RANGO 4.0/5 (Sobrepeso)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">ESTADO DE SALUD:</label>
                  <select
                    value={editingCat.estadoSalud || "Saludable"}
                    onChange={(e) => setEditingCat({ ...editingCat, estadoSalud: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="Saludable">Saludable</option>
                    <option value="Regular">Regular</option>
                    <option value="Delicado">Delicado</option>
                  </select>
                </div>
              </div>

              {/* Sección 4: Tratamiento y Observaciones Médicas */}
              <div className="space-y-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    TRATAMIENTO MÉDICO (Medicación activa):
                  </label>
                  <input
                    type="text"
                    list="medications-list"
                    value={editingCat.medicacion || ""}
                    onChange={(e) => setEditingCat({ ...editingCat, medicacion: e.target.value })}
                    placeholder="Ej. GOTAS OFTÁLMICAS - CAT BALANCE + ENGYSTOL"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    OBSERVACIONES MÉDICAS (Diagnóstico / Cuadro clínico):
                  </label>
                  <input
                    type="text"
                    list="diagnoses-list"
                    value={editingCat.observacionesMedicas || ""}
                    onChange={(e) => setEditingCat({ ...editingCat, observacionesMedicas: e.target.value })}
                    placeholder="Ej. GINGIVOESTOMATITIS, LESIÓN OCULAR, DERMATITIS POR ÁCAROS..."
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Sección 5: Seguimiento y Médico */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">REQUIERE SEGUIMIENTO:</label>
                  <select
                    value={editingCat.requiereSeguimiento || "NO"}
                    onChange={(e) => setEditingCat({ ...editingCat, requiereSeguimiento: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="SI">SI</option>
                    <option value="NO">NO</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">TIPO DE SEGUIMIENTO:</label>
                  <select
                    value={editingCat.tipoSeguimiento || "TRATAMIENTO"}
                    onChange={(e) => setEditingCat({ ...editingCat, tipoSeguimiento: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="TRATAMIENTO">TRATAMIENTO</option>
                    <option value="OBSERVACIÓN">OBSERVACIÓN</option>
                    <option value="ODONTOLOGÍA">ODONTOLOGÍA</option>
                    <option value="VALORACIÓN">VALORACIÓN</option>
                    <option value="NO APLICA">NO APLICA</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">MÉDICO VETERINARIO:</label>
                  <input
                    type="text"
                    list="vets-list"
                    value={editingCat.medicoVeterinario || "Dra. Jenny Zapata Calle"}
                    onChange={(e) => setEditingCat({ ...editingCat, medicoVeterinario: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
              </div>

              {/* Botones de Guardar */}
              <div className="flex gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingCat(null)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-2xl text-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCatEdit}
                  className="w-1/2 py-3 bg-purple-600 hover:bg-purple-700 active:scale-95 font-black rounded-2xl text-white flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
                >
                  <Save className="w-4 h-4" /> Guardar Cambios en Gatera
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CREAR NUEVO FELINO (24 CAMPOS CON AYUDA DINÁMICA) */}
      {isNewCatModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in">
          <form
            onSubmit={handleCreateNewCat}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto border border-slate-200 animate-in zoom-in-95"
          >
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-black text-slate-900 text-base leading-tight">
                  Registrar Nuevo Felino en Gatera (Censo Maestro)
                </h3>
                <p className="text-xs text-slate-500">
                  Ingreso oficial con validación estricta de microchip y campos dinámicos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewCatModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs max-h-[75vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Nº CANIL (Ubicación Gatera) *:
                  </label>
                  <input
                    type="text"
                    required
                    list="locations-list"
                    value={newCat.ubicacion || ""}
                    onChange={(e) => setNewCat({ ...newCat, ubicacion: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-slate-900"
                    placeholder="Ej. CUARENTENA 1"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    MICROCHIP (MC) *:
                  </label>
                  <input
                    type="text"
                    required
                    value={newCat.microchip || ""}
                    onChange={(e) => setNewCat({ ...newCat, microchip: e.target.value })}
                    placeholder="Código de 15 dígitos"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    HISTORIA CLÍNICA (HC):
                  </label>
                  <input
                    type="text"
                    value={newCat.hc || ""}
                    onChange={(e) => setNewCat({ ...newCat, hc: e.target.value })}
                    placeholder="Ej. 243550"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">A (SEXO/GRUPO):</label>
                  <select
                    value={newCat.sexoCode || "HFA"}
                    onChange={(e) => setNewCat({ ...newCat, sexoCode: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="HFA">HFA (Hembra Adulta)</option>
                    <option value="MFA">MFA (Macho Adulto)</option>
                    <option value="HFC">HFC (Hembra Cachorra)</option>
                    <option value="MFC">MFC (Macho Cachorro)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">RAZA:</label>
                  <select
                    value={newCat.raza || "DPC"}
                    onChange={(e) => setNewCat({ ...newCat, raza: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="DPC">DPC (Pelo Corto)</option>
                    <option value="DPL">DPL (Pelo Largo)</option>
                    <option value="FELINO">FELINO</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">COLOR:</label>
                  <input
                    type="text"
                    list="colors-list"
                    value={newCat.color || ""}
                    onChange={(e) => setNewCat({ ...newCat, color: e.target.value })}
                    placeholder="Ej. TABBY AMARILLO"
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">TIPO DE INGRESO:</label>
                  <select
                    value={newCat.tipoIngreso || "RES"}
                    onChange={(e) => setNewCat({ ...newCat, tipoIngreso: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="RES">RES (Resguardo)</option>
                    <option value="APM">APM (Atención Médica)</option>
                    <option value="INC">INC (Inclusión)</option>
                    <option value="E Y D">E Y D</option>
                  </select>
                </div>
              </div>

              {/* Botón rápido Feral */}
              <div className="flex items-center justify-between p-3 bg-rose-50 rounded-2xl border border-rose-200">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                  <div>
                    <span className="font-black text-rose-950 block text-xs">
                      ¿Es Gato Feral / Reactivo?
                    </span>
                    <span className="text-[10px] text-rose-700 font-medium">
                      Exige advertencia de uso obligatorio de guantes en campo
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setNewCat({ ...newCat, isFeral: !newCat.isFeral })}
                  className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${
                    newCat.isFeral
                      ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {newCat.isFeral ? "⚠️ ES FERAL (SI)" : "MANSO (NO)"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">CONDICIÓN CORPORAL:</label>
                  <select
                    value={newCat.condicionCorporal || "RANGO 2.0/5"}
                    onChange={(e) => setNewCat({ ...newCat, condicionCorporal: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="RANGO 1.0/5">RANGO 1.0/5</option>
                    <option value="RANGO 1.5/5">RANGO 1.5/5</option>
                    <option value="RANGO 2.0/5">RANGO 2.0/5 (Delgado)</option>
                    <option value="RANGO 2.5/5">RANGO 2.5/5</option>
                    <option value="RANGO 3.0/5">RANGO 3.0/5 (Ideal)</option>
                    <option value="RANGO 3.5/5">RANGO 3.5/5</option>
                    <option value="RANGO 4.0/5">RANGO 4.0/5</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">ESTADO DE SALUD:</label>
                  <select
                    value={newCat.estadoSalud || "Saludable"}
                    onChange={(e) => setNewCat({ ...newCat, estadoSalud: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="Saludable">Saludable</option>
                    <option value="Regular">Regular</option>
                    <option value="Delicado">Delicado</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">MÉDICO VETERINARIO:</label>
                  <input
                    type="text"
                    list="vets-list"
                    value={newCat.medicoVeterinario || "Dra. Jenny Zapata Calle"}
                    onChange={(e) => setNewCat({ ...newCat, medicoVeterinario: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  TRATAMIENTO MÉDICO (Opcional):
                </label>
                <input
                  type="text"
                  list="medications-list"
                  value={newCat.medicacion || ""}
                  onChange={(e) => setNewCat({ ...newCat, medicacion: e.target.value })}
                  placeholder="Ej. GOTAS OFTÁLMICAS + CAT BALANCE"
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  DIAGNÓSTICO / OBSERVACIONES MÉDICAS:
                </label>
                <input
                  type="text"
                  list="diagnoses-list"
                  value={newCat.observacionesMedicas || ""}
                  onChange={(e) => setNewCat({ ...newCat, observacionesMedicas: e.target.value })}
                  placeholder="Ej. Lesión ocular traumática, Gingivoestomatitis..."
                  className="w-full p-2.5 bg-slate-50 border rounded-xl font-medium"
                />
              </div>

              <div className="flex gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewCatModalOpen(false)}
                  className="w-1/2 py-3 bg-slate-100 hover:bg-slate-200 font-bold rounded-2xl text-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 font-black rounded-2xl text-white flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/30 transition-all"
                >
                  <PlusCircle className="w-4 h-4" /> Dar de Alta Felino
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Ficha Imprimible de Canil/Gatera */}
      {isCanilModalOpen && selectedCardAnimal && (
        <CanilCardModal
          isOpen={isCanilModalOpen}
          onClose={() => setIsCanilModalOpen(false)}
          animal={selectedCardAnimal}
          treatments={selectedCardTreatments}
          notes={selectedCardNotes}
        />
      )}
    </div>
  );
};
