"use client";
import React, { useState, useRef, useEffect } from "react";
import { db, searchAnimalSmart, Animal } from "@/lib/db";
import { StaffMember, isVetOrAdmin, canEditAnimals } from "@/lib/staff";
import { RegisterNewAnimalModal } from "./RegisterNewAnimalModal";
import { getAllGateraLocations } from "@/lib/gateraLocations";
import { GateraCat } from "@/lib/gateraData";
import {
  X,
  Scan,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Cpu,
  Search,
  Pill,
  Edit3,
  Plus,
  Save,
  CheckSquare,
  Square,
  Sparkles,
  ShieldCheck,
  MapPin,
  FileSpreadsheet,
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
  const [filterType, setFilterType] = useState<"all" | "unregistered" | "registered" | "feral">("all");

  // Ubicaciones dinámicas oficiales de Gatera
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);

  // Selección múltiple para acciones en lote
  const [selectedChips, setSelectedChips] = useState<Set<string>>(new Set());

  // Acción masiva de reubicación
  const [batchLocation, setBatchLocation] = useState("");
  const [applyLocationChange, setApplyLocationChange] = useState(false);

  // Acción masiva de creación para chips no registrados
  const [bulkCreateLocation, setBulkCreateLocation] = useState("");
  const [bulkCreateIsFeral, setBulkCreateIsFeral] = useState(false);

  // Modal de Ficha Oficial Completa (24 columnas)
  const [fullRegisterChip, setFullRegisterChip] = useState<string | null>(null);
  const [isFullRegisterOpen, setIsFullRegisterOpen] = useState(false);

  // Modal / Drawer de Edición Rápida (para modificar existente o registrar nuevo directo)
  const [quickEditItem, setQuickEditItem] = useState<MatchedBatchItem | null>(null);
  const [quickEditForm, setQuickEditForm] = useState({
    name: "",
    location: "",
    isFeral: false,
    hc: "",
    medication: "",
  });

  const streamInputRef = useRef<HTMLTextAreaElement>(null);
  const canModify = isVetOrAdmin(currentUser?.role);

  // Cargar catálogo de ubicaciones oficiales al abrir
  useEffect(() => {
    if (isOpen) {
      getAllGateraLocations().then(setAvailableLocations).catch(console.error);
    }
  }, [isOpen]);

  // Auto-focus en el área de captura al abrir en modo stream
  useEffect(() => {
    if (isOpen && activeInputMethod === "stream") {
      setTimeout(() => {
        streamInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, activeInputMethod]);

  if (!isOpen) return null;

  // Extraer microchips de cualquier texto
  const extractChipsFromText = (text: string): string[] => {
    const rawTokens = text.split(/[\r\n,;\t ]+/);
    const validChips: string[] = [];

    rawTokens.forEach((token) => {
      const clean = token.trim().replace(/[^a-zA-Z0-9]/g, "");
      if (clean.length >= 6 && clean.length <= 16) {
        validChips.push(clean);
      }
    });

    return validChips;
  };

  const handleStreamChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setStreamInput(text);
    const chips = extractChipsFromText(text);
    setRawChipsList(chips);
  };

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
    setFeedback("🔍 Cruzando registros con la base de datos de Gatera y Censo...");

    try {
      const results: MatchedBatchItem[] = [];

      for (const rawChip of chipsToAnalyze) {
        const animal = await searchAnimalSmart(rawChip);

        if (animal) {
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
      setSelectedChips(new Set());
      setFeedback(`✅ Análisis completado: ${results.length} microchips procesados.`);
    } catch (err: any) {
      setFeedback(`❌ Error durante el análisis: ${err?.message || "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Abrir modal de Ficha Completa oficial de 24 columnas para un chip
  const handleOpenFullRegister = (chip: string) => {
    if (!canModify) {
      setFeedback("⚠️ Regla de Oro: Solo Médicos Veterinarios o el Administrador pueden crear fichas.");
      return;
    }
    setFullRegisterChip(chip);
    setIsFullRegisterOpen(true);
  };

  // Callback cuando se registra la ficha completa desde el modal oficial
  const handleAnimalRegisteredFromModal = (animal: Animal) => {
    setMatchedItems((prev) =>
      prev.map((it) => {
        const matches =
          it.rawChip === animal.microchip ||
          (animal.microchip && animal.microchip.endsWith(it.rawChip)) ||
          (it.animal?.id && it.animal.id === animal.id);

        if (matches) {
          return {
            ...it,
            found: true,
            animal,
            details: {
              location: animal.location,
              isFeral: animal.isFeral,
              hc: animal.hc,
              medication: animal.observacionesMedicas?.includes("Tratamiento") ? animal.observacionesMedicas : "Ninguno",
              hasActiveTreatment: Boolean(animal.observacionesMedicas?.includes("Tratamiento")),
            },
          };
        }
        return it;
      })
    );

    setIsFullRegisterOpen(false);
    setFullRegisterChip(null);
    setFeedback(`🎉 ¡Ficha de ${animal.name || animal.microchip} guardada e incorporada al censo y lote!`);
  };

  // Abrir Quick Edit / Registro Rápido
  const handleOpenQuickEdit = (item: MatchedBatchItem) => {
    if (!canModify) {
      setFeedback("⚠️ Regla de Oro: Solo Médicos Veterinarios o el Administrador pueden editar o registrar fichas.");
      return;
    }

    setQuickEditItem(item);
    setQuickEditForm({
      name: item.animal?.name || "",
      location: item.details?.location || item.animal?.location || "CUARENTENA 1",
      isFeral: Boolean(item.details?.isFeral || item.animal?.isFeral),
      hc: item.details?.hc || item.animal?.hc || "",
      medication: item.details?.medication || "",
    });
  };

  // Guardar Quick Edit (Actualiza si existe, o crea si no existía)
  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEditItem) return;

    if (!canModify) {
      setFeedback("⚠️ Permiso denegado: Solo Médicos Veterinarios o el Administrador pueden realizar cambios.");
      return;
    }

    setIsProcessing(true);
    const nowIso = new Date().toISOString();
    const chip = quickEditItem.rawChip;
    const loc = quickEditForm.location.trim().toUpperCase() || "CUARENTENA 1";
    const catName = quickEditForm.name.trim() || `Felino Chip ${chip.slice(-4)}`;
    const hcVal = quickEditForm.hc.trim() || `HC-${chip.slice(-6)}`;
    const medVal = quickEditForm.medication.trim() || "Ninguno";
    const hasMed = medVal !== "Ninguno" && medVal !== "";

    try {
      if (quickEditItem.found && quickEditItem.animal) {
        // ACTUALIZAR ANIMAL EXISTENTE
        const animalId = quickEditItem.animal.id;
        if (animalId) {
          await db.animals.update(animalId, {
            name: catName,
            location: loc,
            isFeral: quickEditForm.isFeral,
            hc: hcVal,
            notes: hasMed ? `Tratamiento: ${medVal}` : quickEditItem.animal.notes,
            observacionesMedicas: hasMed ? `Tratamiento: ${medVal}` : quickEditItem.animal.observacionesMedicas,
          });
        }

        // Actualizar registro en Gatera si es gato
        if (quickEditItem.animal.species === "gato") {
          const gCat = await db.gateraRecords
            .filter(
              (c) =>
                c.microchip === chip ||
                c.shortChip === chip ||
                Boolean(quickEditItem.animal?.hc && c.hc === quickEditItem.animal.hc)
            )
            .first();

          if (gCat?.id) {
            await db.gateraRecords.update(gCat.id, {
              nombre: catName,
              ubicacion: loc,
              isFeral: quickEditForm.isFeral,
              hc: hcVal,
              medicacion: medVal,
            });
          }
        }

        // Actualizar en Censo si existe
        const cRec = await db.census.where("microchip").equals(chip).first();
        if (cRec?.id) {
          await db.census.update(cRec.id, {
            animalName: catName,
            location: loc,
            isFeral: quickEditForm.isFeral,
            hc: hcVal,
            medicacion: hasMed ? medVal : undefined,
          });
        }

        // Actualizar en el estado local del lote
        setMatchedItems((prev) =>
          prev.map((it) =>
            it.rawChip === chip
              ? {
                  ...it,
                  animal: {
                    ...it.animal!,
                    name: catName,
                    location: loc,
                    isFeral: quickEditForm.isFeral,
                    hc: hcVal,
                  },
                  details: {
                    ...it.details,
                    location: loc,
                    isFeral: quickEditForm.isFeral,
                    hc: hcVal,
                    medication: medVal,
                    hasActiveTreatment: hasMed,
                  },
                }
              : it
          )
        );

        setFeedback(`✅ Animal ${catName} (${chip}) actualizado correctamente.`);
      } else {
        // CREAR REGISTRO NUEVO CON SU FICHA
        const shortChip = chip.length >= 7 ? chip.slice(-7) : chip;

        const newAnimal: Animal = {
          microchip: chip,
          shortChip,
          name: catName,
          species: "gato",
          breed: "DPC",
          location: loc,
          isFeral: quickEditForm.isFeral,
          hc: hcVal,
          notes: hasMed ? `Tratamiento: ${medVal}` : "Registrado en Lote W91A",
          observacionesMedicas: hasMed ? `Tratamiento: ${medVal}` : "INGRESO LOTE W91A",
          gender: "macho",
          sexoCode: "MFA",
          grupoEdad: "adulto",
          color: "COMUN",
          tipoIngreso: "RES",
          edad: "24 MESES",
          condicionCorporal: "RANGO 3.0/5",
          estadoSalud: "Saludable",
          medicoVeterinario: currentUser?.name || "DR. LA PERLA",
          lastCensusDate: nowIso,
        };

        const newAnimalId = await db.animals.add(newAnimal);
        newAnimal.id = Number(newAnimalId);

        // Crear Ficha Oficial en Gatera (24 columnas)
        const gateraEntry: GateraCat = {
          nroAnimal: String(Date.now()).slice(-4),
          ubicacion: loc,
          microchip: chip,
          shortChip,
          hc: hcVal,
          sexoCode: "MFA",
          sexo: "macho",
          grupoEdad: "adulto",
          raza: "DPC",
          isFeral: quickEditForm.isFeral,
          color: "COMUN",
          tipoIngreso: "RES",
          edad: "24 MESES",
          fechaIngreso: nowIso.split("T")[0],
          condicionCorporal: "RANGO 3.0/5",
          estadoSalud: "Saludable",
          medicacion: medVal,
          observacionesMedicas: hasMed ? `Tratamiento: ${medVal}` : "INGRESO LOTE W91A",
          requiereSeguimiento: hasMed ? "SI" : "NO",
          tipoSeguimiento: hasMed ? "TRATAMIENTO" : "NO REQUIERE",
          medicoVeterinario: currentUser?.name || "DR. LA PERLA",
          nombre: catName,
          descripcion: `${catName} (DPC)`,
          pendientes: "VERIFICADO EN LOTE",
          sistema: hasMed ? "SISTÉMICO" : "PREVENTIVO",
          fechaFinal: "HNI",
          tipo: "FS",
          desparasitante: "AL DÍA (FELINO)",
        };

        await db.gateraRecords.add(gateraEntry);

        // Añadir a Censo
        await db.census.add({
          microchip: chip,
          animalName: catName,
          species: "gato",
          location: loc,
          scannedAt: nowIso,
          scannedBy: currentUser?.name || "Médico CBA La Perla",
          treatmentCount: hasMed ? 1 : 0,
          area: "gatera",
          hc: hcVal,
          isFeral: quickEditForm.isFeral,
          medicacion: hasMed ? medVal : undefined,
        });

        // Actualizar ítem en el lote a 'found: true'
        setMatchedItems((prev) =>
          prev.map((it) =>
            it.rawChip === chip
              ? {
                  ...it,
                  found: true,
                  animal: newAnimal,
                  details: {
                    location: loc,
                    isFeral: quickEditForm.isFeral,
                    hc: hcVal,
                    medication: medVal,
                    hasActiveTreatment: hasMed,
                  },
                }
              : it
          )
        );

        setFeedback(`🎉 ¡Ficha creada exitosamente para ${catName} e ingresada al Censo!`);
      }

      setQuickEditItem(null);
    } catch (err: any) {
      setFeedback(`❌ Error al guardar registro: ${err?.message || "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Creación masiva para todos los no registrados seleccionados
  const handleBulkCreateUnregistered = async () => {
    if (!canModify) {
      setFeedback("⚠️ Regla de Oro: Solo Médicos Veterinarios o el Administrador pueden crear fichas.");
      return;
    }

    const unregSelected = matchedItems.filter((i) => !i.found && selectedChips.has(i.rawChip));
    if (unregSelected.length === 0) {
      setFeedback("⚠️ Selecciona al menos un microchip no registrado.");
      return;
    }

    const targetLoc = bulkCreateLocation.trim().toUpperCase() || "CUARENTENA 1";
    setIsProcessing(true);
    const nowIso = new Date().toISOString();
    let createdCount = 0;

    try {
      for (const item of unregSelected) {
        const chip = item.rawChip;
        const shortChip = chip.length >= 7 ? chip.slice(-7) : chip;
        const catName = `Felino ${chip.slice(-4)}`;
        const hcVal = `HC-${chip.slice(-6)}`;

        const newAnimal: Animal = {
          microchip: chip,
          shortChip,
          name: catName,
          species: "gato",
          breed: "DPC",
          location: targetLoc,
          isFeral: bulkCreateIsFeral,
          hc: hcVal,
          notes: "Ingreso Masivo W91A",
          observacionesMedicas: "INGRESO MASIVO LOTE W91A",
          gender: "macho",
          sexoCode: "MFA",
          grupoEdad: "adulto",
          color: "COMUN",
          tipoIngreso: "RES",
          edad: "24 MESES",
          condicionCorporal: "RANGO 3.0/5",
          estadoSalud: "Saludable",
          medicoVeterinario: currentUser?.name || "DR. LA PERLA",
          lastCensusDate: nowIso,
        };

        const newAnimalId = await db.animals.add(newAnimal);
        newAnimal.id = Number(newAnimalId);

        const gateraEntry: GateraCat = {
          nroAnimal: String(Date.now()).slice(-4),
          ubicacion: targetLoc,
          microchip: chip,
          shortChip,
          hc: hcVal,
          sexoCode: "MFA",
          sexo: "macho",
          grupoEdad: "adulto",
          raza: "DPC",
          isFeral: bulkCreateIsFeral,
          color: "COMUN",
          tipoIngreso: "RES",
          edad: "24 MESES",
          fechaIngreso: nowIso.split("T")[0],
          condicionCorporal: "RANGO 3.0/5",
          estadoSalud: "Saludable",
          medicacion: "Ninguno",
          observacionesMedicas: "INGRESO MASIVO LOTE W91A",
          requiereSeguimiento: "NO",
          tipoSeguimiento: "NO REQUIERE",
          medicoVeterinario: currentUser?.name || "DR. LA PERLA",
          nombre: catName,
          descripcion: `${catName} (DPC)`,
          pendientes: "LOTE PROCESADO",
          sistema: "PREVENTIVO",
          fechaFinal: "HNI",
          tipo: "FS",
          desparasitante: "AL DÍA (FELINO)",
        };

        await db.gateraRecords.add(gateraEntry);

        await db.census.add({
          microchip: chip,
          animalName: catName,
          species: "gato",
          location: targetLoc,
          scannedAt: nowIso,
          scannedBy: currentUser?.name || "Médico CBA La Perla",
          treatmentCount: 0,
          area: "gatera",
          hc: hcVal,
          isFeral: bulkCreateIsFeral,
        });

        createdCount++;
      }

      // Actualizar todos los seleccionados en el lote
      setMatchedItems((prev) =>
        prev.map((it) => {
          if (!it.found && selectedChips.has(it.rawChip)) {
            const shortChip = it.rawChip.length >= 7 ? it.rawChip.slice(-7) : it.rawChip;
            return {
              ...it,
              found: true,
              animal: {
                microchip: it.rawChip,
                shortChip,
                name: `Felino ${it.rawChip.slice(-4)}`,
                species: "gato",
                breed: "DPC",
                location: targetLoc,
                isFeral: bulkCreateIsFeral,
                hc: `HC-${it.rawChip.slice(-6)}`,
                notes: "Ingreso Masivo W91A",
                gender: "macho",
              },
              details: {
                location: targetLoc,
                isFeral: bulkCreateIsFeral,
                hc: `HC-${it.rawChip.slice(-6)}`,
                medication: "Ninguno",
                hasActiveTreatment: false,
              },
            };
          }
          return it;
        })
      );

      setSelectedChips(new Set());
      setFeedback(`🎉 ¡Se crearon ${createdCount} fichas oficiales en ${targetLoc} e ingresaron al censo!`);
    } catch (err: any) {
      setFeedback(`❌ Error al crear registros en lote: ${err?.message || "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reubicar masivamente los seleccionados
  const handleBulkRelocateSelected = async () => {
    if (!canModify) {
      setFeedback("⚠️ Regla de Oro: Solo Médicos Veterinarios o el Administrador pueden reubicar animales.");
      return;
    }

    if (!batchLocation.trim()) {
      setFeedback("⚠️ Escribe o selecciona la nueva ubicación.");
      return;
    }

    const targetLoc = batchLocation.trim().toUpperCase();
    const toRelocate = matchedItems.filter((i) => i.found && i.animal && selectedChips.has(i.rawChip));
    if (toRelocate.length === 0) {
      setFeedback("⚠️ Selecciona animales registrados para reubicar.");
      return;
    }

    setIsProcessing(true);
    let count = 0;

    try {
      for (const item of toRelocate) {
        const chip = item.rawChip;
        if (item.animal?.id) {
          await db.animals.update(item.animal.id, { location: targetLoc });
        }

        if (item.animal?.species === "gato") {
          const cat = await db.gateraRecords.where("microchip").equals(chip).first();
          if (cat?.id) await db.gateraRecords.update(cat.id, { ubicacion: targetLoc });
        }

        const censusItem = await db.census.where("microchip").equals(chip).first();
        if (censusItem?.id) await db.census.update(censusItem.id, { location: targetLoc });

        count++;
      }

      setMatchedItems((prev) =>
        prev.map((it) => {
          if (it.found && selectedChips.has(it.rawChip)) {
            return {
              ...it,
              animal: it.animal ? { ...it.animal, location: targetLoc } : undefined,
              details: it.details ? { ...it.details, location: targetLoc } : undefined,
            };
          }
          return it;
        })
      );

      setFeedback(`📍 ¡${count} animales reubicados exitosamente a ${targetLoc}!`);
    } catch (err: any) {
      setFeedback(`❌ Error al reubicar: ${err?.message || "Error desconocido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 1. Censo Masivo de los encontrados
  const handleBulkCensus = async () => {
    const validFound = matchedItems.filter((i) => i.found && i.animal);
    if (validFound.length === 0) {
      setFeedback("⚠️ No hay animales identificados para censar. Ingresa primero sus fichas.");
      return;
    }

    setIsProcessing(true);
    const nowIso = new Date().toISOString();
    const operatorName = currentUser?.name || "Operario W91A (Censo Masivo)";

    for (const item of validFound) {
      const chip = item.animal!.microchip;
      const targetLoc = applyLocationChange && batchLocation ? batchLocation.trim().toUpperCase() : item.details?.location || item.animal!.location;
      const area = "gatera" as const;
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
        }
      }
    }

    setFeedback(`🎉 ¡Censo Masivo Registrado! Se verificaron ${validFound.length} animales exitosamente.`);
    setIsProcessing(false);

    if (onBatchProcessed) {
      onBatchProcessed({ total: matchedItems.length, censused: validFound.length, medicated: 0 });
    }
  };

  // 2. Aplicar Medicamentos Programados
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

        await db.administrationLogs.add({
          kardexId: kardex.id,
          microchip: chip,
          animalName: item.animal!.name,
          treatment: kardex.treatment,
          appliedAt: nowIso,
          appliedBy: operatorName,
          role: currentUser?.role || "veterinario",
          area: "gatera",
          dosisNumero: newApplied,
          faltantesRestantes: newMissing,
        });

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
      "ESTADO": item.found ? "ENCONTRADO / REGISTRADO" : "NO REGISTRADO",
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

  // Manejo de Selección Múltiple
  const toggleSelectChip = (chip: string) => {
    const next = new Set(selectedChips);
    if (next.has(chip)) next.delete(chip);
    else next.add(chip);
    setSelectedChips(next);
  };

  const selectAllFiltered = () => {
    if (selectedChips.size === filteredItems.length) {
      setSelectedChips(new Set());
    } else {
      setSelectedChips(new Set(filteredItems.map((i) => i.rawChip)));
    }
  };

  // Filtrado reactivo de la tabla de resultados
  const filteredItems = matchedItems.filter((i) => {
    // Filtro por tipo
    if (filterType === "unregistered" && i.found) return false;
    if (filterType === "registered" && !i.found) return false;
    if (filterType === "feral" && !i.details?.isFeral) return false;

    // Filtro por texto
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
  const foundCats = matchedItems.filter((i) => i.found && i.animal?.species === "gato").length;
  const foundDogs = matchedItems.filter((i) => i.found && i.animal?.species === "perro").length;
  const unknownChips = matchedItems.filter((i) => !i.found).length;
  const feralCount = matchedItems.filter((i) => i.details?.isFeral).length;
  const withTreatmentCount = matchedItems.filter((i) => i.details?.hasActiveTreatment).length;
  const selectedUnregisteredCount = matchedItems.filter((i) => !i.found && selectedChips.has(i.rawChip)).length;

  return (
    <>
      {/* Datalist dinámico con más de 100 ubicaciones oficiales de Gatera */}
      <datalist id="batch-gatera-locations">
        {availableLocations.map((loc) => (
          <option key={loc} value={loc} />
        ))}
      </datalist>

      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
        <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl p-4 sm:p-6 space-y-4 max-h-[94vh] flex flex-col animate-in zoom-in-95 border border-slate-200">
          
          {/* Encabezado */}
          <div className="flex items-center justify-between border-b pb-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight flex items-center gap-2">
                  Subida y Gestión en Lote W91A
                  <span className="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full uppercase">
                    Memoria / CSV / Ráfaga
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Captura masiva, registro de fichas, edición individual y actualización de censo
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
            <div className="p-3 bg-slate-900 text-white rounded-2xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in shrink-0 shadow-md">
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
                        En el lector W91A selecciona <strong>"Data Upload"</strong>.
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
                      placeholder="Haz clic aquí y activa 'Data Upload' en el lector W91A para volcar los chips guardados..."
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
                    placeholder="991003003806020&#10;991003003805649&#10;3805740..."
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
                      ? "Analizando Base de Datos..."
                      : `PROCESAR Y ANALIZAR ${rawChipsList.length} MICROCHIPS`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Paso 2: Resultados del Análisis, Edición & Acciones Masivas */}
          {analysisDone && (
            <div className="space-y-4 flex-1 overflow-y-auto">
              {/* Métricas del Lote */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2.5 bg-slate-100 rounded-2xl border">
                  <span className="block text-[10px] uppercase font-bold text-slate-500">Total Leídos</span>
                  <span className="text-lg font-black text-slate-900">{totalScanned}</span>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-2xl border border-purple-200">
                  <span className="block text-[10px] uppercase font-bold text-purple-700">🐱 Gatera</span>
                  <span className="text-lg font-black text-purple-900">{foundCats}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <span className="block text-[10px] uppercase font-bold text-emerald-700">💊 Tratamientos</span>
                  <span className="text-lg font-black text-emerald-900">{withTreatmentCount}</span>
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
                      {feralCount} Felinos Ferales / Reactivos en el lote
                    </span>
                  )}
                  {withTreatmentCount > 0 && (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-xl border border-blue-200 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-blue-600" />
                      {withTreatmentCount} Animales con Medicación Activa
                    </span>
                  )}
                </div>
              )}

              {/* CAJA DE HERRAMIENTAS EN LOTE PARA CHIPS SELECCIONADOS */}
              {selectedChips.size > 0 && (
                <div className="p-3.5 bg-indigo-50 border-2 border-indigo-200 rounded-2xl space-y-3 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between font-bold text-indigo-950">
                    <span className="flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                      {selectedChips.size} Microchip(s) seleccionados
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedChips(new Set())}
                      className="text-[11px] text-indigo-600 hover:underline"
                    >
                      Deseleccionar todos
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* Crear masivamente no registrados */}
                    {selectedUnregisteredCount > 0 && (
                      <div className="p-2.5 bg-white rounded-xl border border-indigo-100 space-y-2">
                        <span className="block font-bold text-slate-800 text-[11px]">
                          ⚡ Crear Fichas Gatera para {selectedUnregisteredCount} No Registrados:
                        </span>
                        <input
                          type="text"
                          list="batch-gatera-locations"
                          value={bulkCreateLocation}
                          onChange={(e) => setBulkCreateLocation(e.target.value)}
                          placeholder="Ubicación (ej: CUARENTENA 12, UPH 1...)"
                          className="w-full p-1.5 bg-slate-50 border rounded-lg text-xs font-bold"
                        />
                        <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer font-bold">
                          <input
                            type="checkbox"
                            checked={bulkCreateIsFeral}
                            onChange={(e) => setBulkCreateIsFeral(e.target.checked)}
                            className="rounded text-indigo-600"
                          />
                          <span>¿Marcar como Ferales / Reactivos?</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleBulkCreateUnregistered}
                          disabled={isProcessing}
                          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>CREAR {selectedUnregisteredCount} FICHAS EN GATERA</span>
                        </button>
                      </div>
                    )}

                    {/* Reubicar seleccionados */}
                    <div className="p-2.5 bg-white rounded-xl border border-indigo-100 space-y-2">
                      <span className="block font-bold text-slate-800 text-[11px]">
                        📍 Reubicar Seleccionados a Nueva Área:
                      </span>
                      <input
                        type="text"
                        list="batch-gatera-locations"
                        value={batchLocation}
                        onChange={(e) => setBatchLocation(e.target.value)}
                        placeholder="Nueva Ubicación..."
                        className="w-full p-1.5 bg-slate-50 border rounded-lg text-xs font-bold"
                      />
                      <button
                        type="button"
                        onClick={handleBulkRelocateSelected}
                        disabled={isProcessing || !batchLocation.trim()}
                        className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black rounded-lg text-[11px] flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all"
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                        <span>REUBICAR SELECCIONADOS</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Botones de Acción Masiva Principales */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleBulkCensus}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                  title="Registra a todos los identificados como verificados en el censo con fecha y hora actual"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFIRMAR CENSO ({foundDogs + foundCats})</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing || withTreatmentCount === 0}
                  onClick={handleBulkMedication}
                  className="py-3 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                  title="Descuenta y marca las dosis médicas para todos los animales con tratamiento activo"
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

              {/* Buscador y Filtros de la Tabla */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
                  <div className="relative w-full sm:w-1/2">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filtrar por chip, nombre o ubicación..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border rounded-xl"
                    />
                  </div>

                  {/* Filtros por pestaña rápida */}
                  <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setFilterType("all")}
                      className={`px-2.5 py-1 rounded-xl transition-all ${
                        filterType === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      Todos ({matchedItems.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("unregistered")}
                      className={`px-2.5 py-1 rounded-xl transition-all ${
                        filterType === "unregistered" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                      }`}
                    >
                      ⚠️ No Registrados ({unknownChips})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType("registered")}
                      className={`px-2.5 py-1 rounded-xl transition-all ${
                        filterType === "registered" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      }`}
                    >
                      ✅ Registrados ({foundCats + foundDogs})
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                  <button
                    type="button"
                    onClick={selectAllFiltered}
                    className="flex items-center gap-1.5 text-indigo-600 hover:underline"
                  >
                    {selectedChips.size === filteredItems.length && filteredItems.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                    <span>Seleccionar todos los visibles ({filteredItems.length})</span>
                  </button>
                  <span>Mostrando {filteredItems.length} registros</span>
                </div>
              </div>

              {/* Tabla Interactiva de Microchips con Edición y Creación Individual */}
              <div className="border rounded-2xl overflow-hidden text-xs max-h-72 overflow-y-auto shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold sticky top-0 z-10 shadow-xs">
                    <tr>
                      <th className="p-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedChips.size === filteredItems.length && filteredItems.length > 0}
                          onChange={selectAllFiltered}
                          className="rounded text-indigo-600"
                        />
                      </th>
                      <th className="p-2">#</th>
                      <th className="p-2">Microchip</th>
                      <th className="p-2">Animal / Ficha</th>
                      <th className="p-2">Ubicación</th>
                      <th className="p-2 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, index) => {
                      const isSelected = selectedChips.has(item.rawChip);
                      return (
                        <tr
                          key={item.rawChip + "_" + index}
                          className={`transition-colors ${
                            isSelected
                              ? "bg-indigo-50/80"
                              : item.found
                              ? "hover:bg-slate-50"
                              : "bg-amber-50/40 hover:bg-amber-50/70"
                          }`}
                        >
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectChip(item.rawChip)}
                              className="rounded text-indigo-600 cursor-pointer"
                            />
                          </td>
                          <td className="p-2 font-mono text-[10px] text-slate-400">{index + 1}</td>
                          <td className="p-2 font-mono font-bold text-slate-900">
                            {item.rawChip}
                          </td>
                          <td className="p-2">
                            {item.found ? (
                              <div>
                                <span className="font-bold flex items-center gap-1 text-slate-900">
                                  {item.animal?.species === "gato" ? "🐱" : "🐶"} {item.animal?.name || "Sin nombre"}
                                </span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {item.details?.isFeral && (
                                    <span className="text-[9px] font-black bg-red-100 text-red-800 px-1 rounded">
                                      FERAL
                                    </span>
                                  )}
                                  {item.details?.hc && (
                                    <span className="text-[9px] font-mono bg-slate-100 text-slate-600 px-1 rounded">
                                      {item.details.hc}
                                    </span>
                                  )}
                                  {item.details?.hasActiveTreatment && (
                                    <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1 rounded">
                                      Tratamiento
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md text-[10px]">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                No Registrado
                              </span>
                            )}
                          </td>
                          <td className="p-2 font-bold text-slate-700">
                            {item.found ? (
                              item.details?.location || item.animal?.location || "-"
                            ) : (
                              <span className="text-slate-400 italic">Pendiente</span>
                            )}
                          </td>
                          <td className="p-2 text-right">
                            {item.found ? (
                              <button
                                type="button"
                                onClick={() => handleOpenQuickEdit(item)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded-lg font-bold text-[11px] inline-flex items-center gap-1 transition-colors border shadow-xs"
                                title="Modificar ubicación, nombre o datos de este registro"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Modificar</span>
                              </button>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickEdit(item)}
                                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-xs"
                                  title="Crear ficha rápida con ubicación directa"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Crear Rápido</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenFullRegister(item.rawChip)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] inline-flex items-center gap-1 shadow-xs"
                                  title="Abrir formulario oficial completo de 24 columnas"
                                >
                                  <FileSpreadsheet className="w-3 h-3" />
                                  <span>Ficha Oficial</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botón para reiniciar lote */}
              <div className="flex justify-between items-center pt-2 border-t text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAnalysisDone(false);
                    setRawChipsList([]);
                    setStreamInput("");
                    setPastedText("");
                    setMatchedItems([]);
                    setSelectedChips(new Set());
                  }}
                  className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cargar Otro Lote de Memoria</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl"
                >
                  Cerrar Ventana
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL OFICIAL DE 24 COLUMNAS PARA CHIP NUEVO */}
      {isFullRegisterOpen && fullRegisterChip && (
        <RegisterNewAnimalModal
          isOpen={isFullRegisterOpen}
          onClose={() => {
            setIsFullRegisterOpen(false);
            setFullRegisterChip(null);
          }}
          initialMicrochip={fullRegisterChip}
          defaultArea="gatera"
          currentUser={currentUser}
          onAnimalRegistered={handleAnimalRegisteredFromModal}
        />
      )}

      {/* MODAL / DRAWER DE EDICIÓN RÁPIDA (MODIFICAR O CREAR) */}
      {quickEditItem && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                  {quickEditItem.found ? <Edit3 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">
                    {quickEditItem.found ? "Modificar Ficha Animal" : "Crear Ficha Rápida en Gatera"}
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500">
                    Chip: {quickEditItem.rawChip}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickEditItem(null)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  UBICACIÓN / CANIL / JAULA (COLUMNA B):
                </label>
                <input
                  type="text"
                  required
                  list="batch-gatera-locations"
                  value={quickEditForm.location}
                  onChange={(e) => setQuickEditForm({ ...quickEditForm, location: e.target.value })}
                  placeholder="Ej: CUARENTENA 12, UPH 5, HOSPITAL 2..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  NOMBRE DEL ANIMAL (OPCIONAL):
                </label>
                <input
                  type="text"
                  value={quickEditForm.name}
                  onChange={(e) => setQuickEditForm({ ...quickEditForm, name: e.target.value })}
                  placeholder="Ej: Michi, Pelusa, Sin Nombre..."
                  className="w-full p-2 bg-slate-50 border rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">HISTORIA CLÍNICA (HC):</label>
                  <input
                    type="text"
                    value={quickEditForm.hc}
                    onChange={(e) => setQuickEditForm({ ...quickEditForm, hc: e.target.value })}
                    placeholder="Ej: 242755"
                    className="w-full p-2 bg-slate-50 border rounded-xl font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">¿ES FERAL / REACTIVO?</label>
                  <select
                    value={quickEditForm.isFeral ? "SI" : "NO"}
                    onChange={(e) =>
                      setQuickEditForm({ ...quickEditForm, isFeral: e.target.value === "SI" })
                    }
                    className="w-full p-2 bg-slate-50 border rounded-xl font-bold"
                  >
                    <option value="NO">NO (Dócil / Manipulable)</option>
                    <option value="SI">SI (Feral / Manejo Cauteloso)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">TRATAMIENTO O MEDICACIÓN:</label>
                <input
                  type="text"
                  value={quickEditForm.medication}
                  onChange={(e) => setQuickEditForm({ ...quickEditForm, medication: e.target.value })}
                  placeholder="Ej: Amoxicilina 50mg, Doxiciclina, Ninguno..."
                  className="w-full p-2 bg-slate-50 border rounded-xl"
                />
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setQuickEditItem(null)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>{isProcessing ? "Guardando..." : "GUARDAR DATOS"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
