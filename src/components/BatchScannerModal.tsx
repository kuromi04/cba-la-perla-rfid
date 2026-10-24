"use client";
import React, { useState, useRef, useEffect } from "react";
import { db, searchAnimalSmart, Animal, KardexRecord } from "@/lib/db";
import { StaffMember } from "@/lib/staff";
import {
  X,
  Scan,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  FileSpreadsheet,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Search,
  Pill,
} from "lucide-react";
import * as XLSX from "xlsx";

interface BatchScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: StaffMember | null;
  onBatchProcessed?: (stats: { total: number; censused: number; medicated: number }) => void;
}

export interface MatchedBatchItem {
  rawChip: string;
  found: boolean;
  animal?: Animal;
  details?: {
    location?: string;
    section?: string;
    medication?: string;
    isFeral?: boolean;
    hc?: string;
    hasActiveTreatment?: boolean;
  };
}

export const BatchScannerModal: React.FC<BatchScannerModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onBatchProcessed,
}) => {
  const [activeInputMethod, setActiveInputMethod] = useState<"stream" | "paste" | "file">("stream");
  const [streamInput, setStreamInput] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [rawChipsList, setRawChipsList] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [matchedItems, setMatchedItems] = useState<MatchedBatchItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [batchLocation, setBatchLocation] = useState("");
  const [applyLocationChange, setApplyLocationChange] = useState(false);

  const streamInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus en el área de captura al abrir en modo stream
  useEffect(() => {
    if (isOpen && activeInputMethod === "stream") {
      setTimeout(() => {
        streamInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, activeInputMethod]);

  if (!isOpen) return null;

  // Extraer microchips de cualquier texto (separado por saltos de línea, comas, espacios)
  const extractChipsFromText = (text: string): string[] => {
    const rawTokens = text.split(/[\r\n,;\t ]+/);
    const validChips: string[] = [];

    rawTokens.forEach((token) => {
      const clean = token.trim().replace(/[^a-zA-Z0-9]/g, "");
      // Filtra tokens que tengan longitud válida de chip (sufijos de 6+ dígitos o chips completos de 15 dígitos)
      if (clean.length >= 6 && clean.length <= 16) {
        validChips.push(clean);
      }
    });

    return validChips;
  };

  // Manejar captura continua en ráfaga desde el lector W91A
  const handleStreamChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setStreamInput(text);
    const chips = extractChipsFromText(text);
    setRawChipsList(chips);
  };

  // Manejar carga de archivo de texto o CSV desde el lector USB
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || "");
      setPastedText(content);
      const chips = extractChipsFromText(content);
      setRawChipsList(chips);
      setActiveInputMethod("paste");
      setFeedback(`📁 Archivo cargado con ${chips.length} microchips encontrados.`);
    };
    reader.readAsText(file);
  };

  // Analizar y cruzar todos los chips contra IndexedDB
  const handleAnalyzeChips = async () => {
    let chipsToAnalyze = rawChipsList;

    if (activeInputMethod === "paste") {
      chipsToAnalyze = extractChipsFromText(pastedText);
      setRawChipsList(chipsToAnalyze);
    }

    if (chipsToAnalyze.length === 0) {
      setFeedback("⚠️ No se han detectado microchips válidos en la entrada.");
      return;
    }

    setIsProcessing(true);
    setFeedback("🔍 Cruzando registros con la base de datos de Caninos y Gatera...");

    try {
      const results: MatchedBatchItem[] = [];

      for (const rawChip of chipsToAnalyze) {
        const animal = await searchAnimalSmart(rawChip);

        if (animal) {
          // Obtener datos clínicos y de tratamiento
          let details: MatchedBatchItem["details"] = {
            location: animal.location,
            isFeral: animal.isFeral,
            hc: animal.hc,
          };

          if (animal.species === "gato") {
            const catRec = await db.gateraRecords
              .filter(
                (c) =>
                  c.microchip === animal.microchip ||
                  c.shortChip === animal.shortChip ||
                  Boolean(animal.hc && c.hc === animal.hc)
              )
              .first();

            if (catRec) {
              details.location = catRec.ubicacion;
              details.medication = catRec.medicacion;
              details.hasActiveTreatment = Boolean(catRec.medicacion && catRec.medicacion !== "Ninguno");
            }
          } else {
            const dogRec = await db.shelterRecords
              .where("microchip")
              .equals(animal.microchip)
              .first();

            if (dogRec) {
              details.location = dogRec.ubicacion;
              details.section = dogRec.section;
              details.medication = dogRec.medicacion;
              details.hasActiveTreatment = Boolean(dogRec.medicacion);
            }
          }

          results.push({
            rawChip,
            found: true,
            animal,
            details,
          });
        } else {
          results.push({
            rawChip,
            found: false,
          });
        }
      }

      setMatchedItems(results);
      setAnalysisDone(true);
      setFeedback(`✅ Análisis completado: ${results.length} microchips procesados.`);
    } catch (err: any) {
      setFeedback(`❌ Error durante el análisis: ${err?.message || "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Acción Masiva: Registrar Censo Masivo
  const handleBulkCensus = async () => {
    const validFound = matchedItems.filter((i) => i.found && i.animal);
    if (validFound.length === 0) {
      setFeedback("⚠️ No hay animales identificados para censar.");
      return;
    }

    setIsProcessing(true);
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || "Operario W91A (Censo Masivo)";

    for (const item of validFound) {
      const chip = item.animal!.microchip;
      const targetLoc = applyLocationChange && batchLocation ? batchLocation.trim().toUpperCase() : item.details?.location || item.animal!.location;
      const area = item.animal!.species === "gato" ? ("gatera" as const) : ("caninos" as const);
      const treatmentCount = item.details?.hasActiveTreatment ? 1 : 0;

      const existing = await db.census.where("microchip").equals(chip).first();
      if (existing?.id) {
        await db.census.update(existing.id, {
          animalName: item.animal!.name,
          species: item.animal!.species,
          location: targetLoc,
          scannedAt: nowIso,
          scannedBy: operatorName,
          treatmentCount,
          area,
        });
      } else {
        await db.census.add({
          microchip: chip,
          animalName: item.animal!.name,
          species: item.animal!.species,
          location: targetLoc,
          scannedAt: nowIso,
          scannedBy: operatorName,
          treatmentCount,
          area,
        });
      }

      if (item.animal!.id) {
        await db.animals.update(item.animal!.id, {
          lastCensusDate: nowIso,
          ...(applyLocationChange && batchLocation ? { location: targetLoc } : {}),
        });
      }

      if (applyLocationChange && batchLocation) {
        if (item.animal!.species === "gato") {
          const cat = await db.gateraRecords.where("microchip").equals(chip).first();
          if (cat?.id) await db.gateraRecords.update(cat.id, { ubicacion: targetLoc });
        } else {
          const dog = await db.shelterRecords.where("microchip").equals(chip).first();
          if (dog?.id) await db.shelterRecords.update(dog.id, { ubicacion: targetLoc });
        }
      }
    }

    setFeedback(`🎉 ¡Censo Masivo Registrado! Se verificaron ${validFound.length} animales exitosamente.`);
    setIsProcessing(false);

    if (onBatchProcessed) {
      onBatchProcessed({ total: matchedItems.length, censused: validFound.length, medicated: 0 });
    }
  };

  // 2. Acción Masiva: Aplicar Medicamentos Programados
  const handleBulkMedication = async () => {
    const withMed = matchedItems.filter((i) => i.found && i.animal && i.details?.hasActiveTreatment);
    if (withMed.length === 0) {
      setFeedback("ℹ️ Ninguno de los animales del lote tiene tratamientos médicos activos registrados.");
      return;
    }

    setIsProcessing(true);
    let appliedCount = 0;
    const operatorName = currentUser?.name || "Médico/Auxiliar W91A";
    const nowIso = new Date().toISOString();

    for (const item of withMed) {
      const chip = item.animal!.microchip;
      // Buscar kardex activo
      const kardex = await db.kardex.where("microchip").equals(chip).and((k) => k.status === "activo").first();

      if (kardex && kardex.id) {
        const newApplied = kardex.dosisAplicadas + 1;
        const newMissing = Math.max(0, kardex.dosisTotales - newApplied);
        const newStatus = newMissing === 0 ? "finalizado" : "activo";

        await db.kardex.update(kardex.id, {
          dosisAplicadas: newApplied,
          dosisFaltantes: newMissing,
          status: newStatus,
          ultimaAplicacion: nowIso,
          ultimoResponsable: operatorName,
        });

        // Registrar Log
        await db.administrationLogs.add({
          kardexId: kardex.id,
          microchip: chip,
          animalName: item.animal!.name,
          treatment: kardex.treatment,
          appliedAt: nowIso,
          appliedBy: operatorName,
          role: currentUser?.role || "veterinario",
          area: item.animal!.species === "gato" ? "gatera" : "caninos",
          dosisNumero: newApplied,
          faltantesRestantes: newMissing,
        });

        // Marcar tareas del turno
        const tasks = await db.shiftTasks.where("microchip").equals(chip).toArray();
        for (const t of tasks) {
          if (t.id && !t.isCompleted) {
            await db.shiftTasks.update(t.id, {
              isCompleted: true,
              completedAt: nowIso,
              completedBy: operatorName,
            });
          }
        }

        appliedCount++;
      }
    }

    setFeedback(`💉 Medicación en masa completada: se registraron y descontaron dosis para ${appliedCount} animales.`);
    setIsProcessing(false);

    if (onBatchProcessed) {
      onBatchProcessed({ total: matchedItems.length, censused: 0, medicated: appliedCount });
    }
  };

  // 3. Exportar Auditoría a Excel
  const handleExportAuditExcel = () => {
    if (matchedItems.length === 0) return;

    const exportRows = matchedItems.map((item, idx) => ({
      "N°": idx + 1,
      "MICROCHIP ESCANEADO": item.rawChip,
      "ESTADO": item.found ? "ENCONTRADO" : "NO REGISTRADO",
      "ESPECIE": item.found ? (item.animal?.species === "gato" ? "GATO" : "PERRO") : "N/D",
      "NOMBRE / DESCRIPCIÓN": item.found ? item.animal?.name : "DESCONOCIDO",
      "UBICACIÓN": item.found ? item.details?.location || item.animal?.location : "N/D",
      "HISTORIA CLÍNICA": item.details?.hc || "N/D",
      "ES FERAL": item.details?.isFeral ? "SI (FERAL)" : "NO",
      "TRATAMIENTO": item.details?.medication || "NINGUNO",
      "FECHA DESCARGA": new Date().toLocaleString(),
      "OPERARIO": currentUser?.name || "PERSONAL CBA LA PERLA",
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "LOTE_W91A_AUDITORIA");

    const fileName = `DESCARGA_W91A_${new Date().toISOString().slice(0, 10)}_TOTAL_${matchedItems.length}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Filtrado reactivo de la tabla de resultados
  const filteredItems = matchedItems.filter((i) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      i.rawChip.toLowerCase().includes(term) ||
      (i.animal?.name && i.animal.name.toLowerCase().includes(term)) ||
      (i.details?.location && i.details.location.toLowerCase().includes(term)) ||
      (i.details?.medication && i.details.medication.toLowerCase().includes(term))
    );
  });

  const totalScanned = matchedItems.length;
  const foundDogs = matchedItems.filter((i) => i.found && i.animal?.species === "perro").length;
  const foundCats = matchedItems.filter((i) => i.found && i.animal?.species === "gato").length;
  const unknownChips = matchedItems.filter((i) => !i.found).length;
  const feralCount = matchedItems.filter((i) => i.details?.isFeral).length;
  const withTreatmentCount = matchedItems.filter((i) => i.details?.hasActiveTreatment).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[92vh] flex flex-col animate-in zoom-in-95">
        
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight flex items-center gap-2">
                Subida en Masa de Memoria W91A
                <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full uppercase">
                  Hasta 128 chips
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Descarga de escaneos guardados en campo sin señal WiFi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback visual */}
        {feedback && (
          <div className="p-3 bg-slate-900 text-white rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in shrink-0">
            <span>{feedback}</span>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Paso 1: Selección de Método de Entrada si aún no se ha analizado */}
        {!analysisDone && (
          <div className="space-y-3 flex-1 overflow-y-auto">
            {/* Pestañas de método */}
            <div className="flex p-1 bg-slate-100 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setActiveInputMethod("stream")}
                className={`w-1/3 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                  activeInputMethod === "stream"
                    ? "bg-white text-indigo-700 shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Ráfaga W91A (HID)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInputMethod("paste")}
                className={`w-1/3 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                  activeInputMethod === "paste"
                    ? "bg-white text-indigo-700 shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span>📋 Pegar Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveInputMethod("file")}
                className={`w-1/3 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all ${
                  activeInputMethod === "file"
                    ? "bg-white text-indigo-700 shadow-md"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Archivo .TXT / .CSV</span>
              </button>
            </div>

            {/* Método 1: Ráfaga Directa Teclado W91A */}
            {activeInputMethod === "stream" && (
              <div className="space-y-2.5">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-xs space-y-1.5 text-indigo-950">
                  <p className="font-bold flex items-center gap-1.5">
                    <Scan className="w-4 h-4 text-indigo-600 shrink-0" />
                    Instrucciones de descarga desde el W91A:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-1">
                    <li>Conecta el W91A al computador o celular (Bluetooth o Cable USB).</li>
                    <li>Haz clic en el recuadro gris abajo.</li>
                    <li>
                      En el lector W91A selecciona <strong>"Data Upload"</strong> (o escanea el código de barras de envío de memoria).
                    </li>
                    <li>El lector tecleará todos los chips en ráfaga automáticamente.</li>
                  </ol>
                </div>

                <div className="relative">
                  <textarea
                    ref={streamInputRef}
                    rows={5}
                    value={streamInput}
                    onChange={handleStreamChange}
                    placeholder="Haz clic aquí y activa 'Data Upload' en el lector W91A para volcar los 100 chips..."
                    className="w-full p-4 font-mono text-sm bg-slate-50 border-2 border-dashed border-indigo-300 rounded-2xl focus:border-indigo-600 focus:bg-white focus:outline-none transition-all"
                  />
                  {rawChipsList.length > 0 && (
                    <div className="absolute top-2 right-2 px-3 py-1 bg-emerald-600 text-white font-black text-xs rounded-xl shadow-md animate-bounce">
                      ⚡ {rawChipsList.length} microchips capturados
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Método 2: Pegar texto libre */}
            {activeInputMethod === "paste" && (
              <div className="space-y-2">
                <label className="font-bold text-xs text-slate-700">
                  Pega la lista de microchips (uno por línea o separados por comas):
                </label>
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => {
                    setPastedText(e.target.value);
                    setRawChipsList(extractChipsFromText(e.target.value));
                  }}
                  placeholder="3805649&#10;991001006543210&#10;3805740..."
                  className="w-full p-3 font-mono text-xs bg-slate-50 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                  <span>Microchips detectados: {extractChipsFromText(pastedText).length}</span>
                  {pastedText && (
                    <button
                      type="button"
                      onClick={() => {
                        setPastedText("");
                        setRawChipsList([]);
                      }}
                      className="text-red-500 hover:underline"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Método 3: Subir archivo */}
            {activeInputMethod === "file" && (
              <div className="p-8 border-2 border-dashed border-slate-300 rounded-3xl text-center space-y-3 bg-slate-50 hover:bg-slate-100 transition-all">
                <Upload className="w-10 h-10 text-indigo-500 mx-auto animate-pulse" />
                <div>
                  <p className="font-black text-slate-800 text-sm">
                    Selecciona el archivo exportado por el lector W91A
                  </p>
                  <p className="text-xs text-slate-500">
                    Soporta archivos .txt o .csv (ej. RECORD.TXT o TAG.CSV)
                  </p>
                </div>
                <input
                  type="file"
                  accept=".txt, .csv"
                  onChange={handleFileUpload}
                  className="block mx-auto text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
                />
              </div>
            )}

            {/* Botón de Analizar */}
            <div className="pt-2">
              <button
                type="button"
                disabled={rawChipsList.length === 0 || isProcessing}
                onClick={handleAnalyzeChips}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95 transition-all"
              >
                <ArrowRight className="w-4 h-4" />
                <span>
                  {isProcessing
                    ? "Analizando..."
                    : `PROCESAR Y ANALIZAR ${rawChipsList.length} MICROCHIPS`}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Paso 2: Resultados del Análisis & Acciones Masivas */}
        {analysisDone && (
          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Métricas del Lote */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 bg-slate-100 rounded-2xl border">
                <span className="block text-[10px] uppercase font-bold text-slate-500">Total Leídos</span>
                <span className="text-lg font-black text-slate-900">{totalScanned}</span>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="block text-[10px] uppercase font-bold text-emerald-700">🐶 Caninos</span>
                <span className="text-lg font-black text-emerald-900">{foundDogs}</span>
              </div>
              <div className="p-2.5 bg-purple-50 rounded-2xl border border-purple-200">
                <span className="block text-[10px] uppercase font-bold text-purple-700">🐱 Gatera</span>
                <span className="text-lg font-black text-purple-900">{foundCats}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-2xl border border-amber-200">
                <span className="block text-[10px] uppercase font-bold text-amber-700">⚠️ No Registrados</span>
                <span className="text-lg font-black text-amber-900">{unknownChips}</span>
              </div>
            </div>

            {/* Alertas Ferales o Tratamientos */}
            {(feralCount > 0 || withTreatmentCount > 0) && (
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                {feralCount > 0 && (
                  <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-xl border border-red-200 flex items-center gap-1.5 animate-pulse">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    {feralCount} Felinos Ferales / Reactivos en el lote (Manejo Cauteloso)
                  </span>
                )}
                {withTreatmentCount > 0 && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-xl border border-blue-200 flex items-center gap-1.5">
                    <Pill className="w-3.5 h-3.5 text-blue-600" />
                    {withTreatmentCount} Animales con Medicación Activa hoy
                  </span>
                )}
              </div>
            )}

            {/* Opciones de Reubicación Masiva en Bloque */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyLocationChange}
                  onChange={(e) => setApplyLocationChange(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span>Mover/Reubicar en bloque a todos los animales identificados a una nueva área:</span>
              </label>
              {applyLocationChange && (
                <input
                  type="text"
                  value={batchLocation}
                  onChange={(e) => setBatchLocation(e.target.value)}
                  placeholder="Ej: PATIO ADOPCIONES 2, CANILES TRIAJE, CUARENTENA GATERA..."
                  className="w-full p-2 bg-white border rounded-xl font-bold text-slate-900"
                />
              )}
            </div>

            {/* Botones de Acción Masiva */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleBulkCensus}
                className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                title="Registra a todos los animales del lote como verificados en el censo con fecha y hora actual"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>CONFIRMAR CENSO ({foundDogs + foundCats})</span>
              </button>

              <button
                type="button"
                disabled={isProcessing || withTreatmentCount === 0}
                onClick={handleBulkMedication}
                className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                title="Descuenta y marca las dosis médicas para todos los animales del lote que tienen tratamiento activo"
              >
                <Pill className="w-4 h-4" />
                <span>APLICAR MEDICACIÓN ({withTreatmentCount})</span>
              </button>

              <button
                type="button"
                onClick={handleExportAuditExcel}
                className="py-3 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                title="Descarga un Excel con la auditoría completa de los microchips leídos"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>EXPORTAR REPORTE</span>
              </button>
            </div>

            {/* Buscador de la lista */}
            <div className="relative pt-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar por chip, nombre o ubicación..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border rounded-xl"
              />
            </div>

            {/* Tabla / Lista de Microchips Procesados */}
            <div className="border rounded-2xl overflow-hidden text-xs max-h-56 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold sticky top-0">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Microchip</th>
                    <th className="p-2">Animal</th>
                    <th className="p-2">Ubicación</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, index) => (
                    <tr
                      key={index}
                      className={item.found ? "hover:bg-slate-50" : "bg-red-50/50 text-red-900"}
                    >
                      <td className="p-2 font-mono text-[10px] text-slate-400">{index + 1}</td>
                      <td className="p-2 font-mono font-bold">{item.rawChip}</td>
                      <td className="p-2">
                        {item.found ? (
                          <div>
                            <span className="font-bold flex items-center gap-1">
                              {item.animal?.species === "gato" ? "🐱" : "🐶"} {item.animal?.name}
                            </span>
                            {item.details?.isFeral && (
                              <span className="text-[9px] font-black bg-red-100 text-red-800 px-1 rounded">
                                FERAL
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-600 font-bold">No Registrado</span>
                        )}
                      </td>
                      <td className="p-2">
                        {item.found ? item.details?.location || item.animal?.location : "-"}
                      </td>
                      <td className="p-2">
                        {item.details?.hasActiveTreatment ? (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                            Con Medicación
                          </span>
                        ) : item.found ? (
                          <span className="text-slate-500 text-[10px]">Sin tratamiento</span>
                        ) : (
                          <span className="text-amber-700 text-[10px] font-bold">Verificar</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botón para reiniciar lote */}
            <div className="flex justify-between items-center pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setAnalysisDone(false);
                  setRawChipsList([]);
                  setStreamInput("");
                  setPastedText("");
                  setMatchedItems([]);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cargar Otro Lote de Memoria</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
