"use client";
import React, { useState, useRef, useEffect } from "react";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { Animal, KardexRecord, db, searchAnimalSmart } from "@/lib/db";
import { ShelterRecord } from "@/lib/realData";
import { GateraCat } from "@/lib/gateraData";
import {
  Scan,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Pill,
  Mic,
  Clock,
  Edit3,
  Calendar,
  Save,
  UserCheck,
  Layers,
  Printer,
  QrCode,
  ShieldAlert,
  PlusCircle,
  Stethoscope,
  X,
  Palette,
  Check,
  Camera,
  Trash2,
  ZoomIn,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { compressImageFile } from "@/lib/imageUtils";
import { VoiceModal } from "./VoiceModal";
import { AssignAnimalModal } from "./AssignAnimalModal";
import { BatchScannerModal } from "./BatchScannerModal";
import { CanilCardModal } from "./CanilCardModal";
import { RegisterNewAnimalModal } from "./RegisterNewAnimalModal";
import { PhotoCaptureModal } from "./PhotoCaptureModal";
import { ParsedClinicalIntent } from "@/lib/aiParser";
import { StaffMember } from "@/lib/staff";
import { OFFICIAL_GATERA_LOCATIONS, getAllGateraLocations, isDeceased } from "@/lib/gateraLocations";
import { OFFICIAL_GATERA_COLORS } from "@/lib/gateraColors";
import { recordAudit } from "@/lib/audit";

interface ScannerTabProps {
  initialChip?: string;
  onGoToPlanilla?: (chip: string) => void;
  currentUser?: StaffMember | null;
}

export const ScannerTab: React.FC<ScannerTabProps> = ({ initialChip = "", onGoToPlanilla, currentUser }) => {
  const [chipInput, setChipInput] = useState(initialChip);
  const [currentAnimal, setCurrentAnimal] = useState<Animal | null>(null);
  const [shelterEntries, setShelterEntries] = useState<ShelterRecord[]>([]);
  const [animalTreatments, setAnimalTreatments] = useState<KardexRecord[]>([]);
  const [censusConfirmed, setCensusConfirmed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isCanilCardOpen, setIsCanilCardOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [preselectedSpecies, setPreselectedSpecies] = useState<"perro" | "gato">("perro");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Edición rápida en campo
  const [isEditing, setIsEditing] = useState(false);
  const [editLocation, setEditLocation] = useState("");
  const [editMedication, setEditMedication] = useState("");
  const [editPendientes, setEditPendientes] = useState("");
  const [editColor, setEditColor] = useState("");
  const [isEditingColor, setIsEditingColor] = useState(false);
  const [locationsList, setLocationsList] = useState<string[]>(OFFICIAL_GATERA_LOCATIONS);

  // Estados para Instaurar y Editar Tratamientos Clínicos Directamente en Ficha
  const [isPrescribingTreatment, setIsPrescribingTreatment] = useState(false);
  const [editingTreatmentId, setEditingTreatmentId] = useState<number | null>(null);
  const [rxMedication, setRxMedication] = useState("");
  const [rxSystem, setRxSystem] = useState("TEGUMEN");
  const [rxDoses, setRxDoses] = useState<number>(7);
  const [rxFrequency, setRxFrequency] = useState("SID");
  const [rxPendientes, setRxPendientes] = useState("");

  // Estados para Fotografía del Felino
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const scannerPhotoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllGateraLocations().then((locs) => {
      if (locs && locs.length > 0) setLocationsList(locs);
    });
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  // Carga automática si viene desde un QR escaneado (?chip=...)
  useEffect(() => {
    if (initialChip && initialChip.trim()) {
      setChipInput(initialChip.trim());
      handleSearch(initialChip.trim());
    }
  }, [initialChip]);

  // Escuchar ráfagas del lector W91A Bluetooth HID
  useBarcodeScanner({
    onScan: (code) => {
      setChipInput(code);
      handleSearch(code);
      if (inputRef.current) {
        inputRef.current.value = code;
        inputRef.current.select();
      }
    },
    minLength: 6,
  });

  const handleSearch = async (query: string) => {
    const clean = query.trim();
    if (!clean) return;

    setCensusConfirmed(false);
    setFeedbackMessage(null);
    setIsEditing(false);

    // Búsqueda inteligente
    const found = await searchAnimalSmart(clean);

    if (found) {
      setCurrentAnimal(found);
      setNotFound(false);
      setEditLocation(found.location);

      if (found.species === "gato") {
        const catRecord = await db.gateraRecords
          .filter(
            (c) =>
              c.microchip === found.microchip ||
              (found.shortChip && c.shortChip === found.shortChip) ||
              c.microchip.endsWith(clean)
          )
          .first();

        if (catRecord) {
          if (!found.photoUrl && catRecord.photoUrl) {
            found.photoUrl = catRecord.photoUrl;
            setCurrentAnimal({ ...found, photoUrl: catRecord.photoUrl });
          }
        }

        // Si el felino no tiene foto en la base local, verificar en Supabase Cloud si otro dispositivo la subió
        if (!found.photoUrl && typeof window !== "undefined" && navigator.onLine) {
          import("@/lib/supabase").then(async ({ getSupabaseClient }) => {
            const client = getSupabaseClient();
            if (!client) return;
            const { data } = await client
              .from("animals")
              .select("photo_url, attributes")
              .eq("microchip", found.microchip)
              .maybeSingle();
            const remotePhoto = data?.photo_url || data?.attributes?.photoUrl;
            if (remotePhoto) {
              found.photoUrl = remotePhoto;
              setCurrentAnimal((prev) => (prev ? { ...prev, photoUrl: remotePhoto } : prev));
              if (found.id) db.animals.update(found.id, { photoUrl: remotePhoto }).catch(() => {});
              db.gateraRecords.where("microchip").equals(found.microchip).modify({ photoUrl: remotePhoto }).catch(() => {});
            }
          }).catch(() => {});
        }

        if (catRecord) {
          setShelterEntries([
            {
              ubicacion: catRecord.ubicacion,
              microchip: catRecord.microchip,
              shortChip: catRecord.shortChip,
              descripcion: `${catRecord.nombre} (${catRecord.raza} - ${catRecord.color})`,
              medicacion: catRecord.medicacion,
              section: "GATERA" as any,
              pendientes: `HC: ${catRecord.hc}. ${catRecord.pendientes || ""}`,
              sistema: catRecord.sistema,
            },
          ]);
          setEditMedication(catRecord.medicacion || "");
          setEditPendientes(catRecord.pendientes || "");
        } else {
          setShelterEntries([]);
          setEditMedication("");
          setEditPendientes("");
        }
      } else {
        // Cargar registros de la planilla real para caninos
        const allRecords = await db.shelterRecords.toArray();
        const matchingRecords = allRecords.filter(
          (r) =>
            r.microchip === found.microchip ||
            (found.shortChip && r.shortChip === found.shortChip) ||
            r.microchip.endsWith(clean)
        );

        setShelterEntries(matchingRecords);
        if (matchingRecords.length > 0) {
          setEditMedication(matchingRecords[0].medicacion || "");
          setEditPendientes(matchingRecords[0].pendientes || "");
        } else {
          setEditMedication("");
          setEditPendientes("");
        }
      }

      // Cargar tratamientos activos de Kardex
      const treats = await db.kardex.where("microchip").equals(found.microchip).toArray();
      setAnimalTreatments(treats);

      // Feedback háptico y Alerta Bioseguridad
      const isCDV =
        found.species === "perro" &&
        (found.notes?.toUpperCase().includes("CDV") ||
          found.breed?.toUpperCase().includes("CDV") ||
          found.name?.toUpperCase().includes("CDV"));
      const isCuarentena = found.location?.toUpperCase().includes("CUARENTENA");
      const isFeral = Boolean(found.isFeral);

      if (typeof window !== "undefined" && "vibrate" in navigator) {
        if (isCDV || isCuarentena || isFeral) {
          navigator.vibrate([250, 100, 250, 100, 450]);
        } else {
          navigator.vibrate([100, 50, 100]);
        }
      }
    } else {
      // Buscar si existe en gateraRecords o en shelterRecords
      const gateraMatch = await db.gateraRecords
        .filter(
          (c) =>
            c.microchip.includes(clean) ||
            (c.shortChip && c.shortChip.includes(clean)) ||
            c.hc === clean
        )
        .first();

      if (gateraMatch) {
        const tempAnimal: Animal = {
          microchip: gateraMatch.microchip,
          shortChip: gateraMatch.shortChip,
          name: gateraMatch.color ? `FELINO ${gateraMatch.color}` : gateraMatch.nombre,
          species: "gato",
          breed: gateraMatch.raza || "DPC",
          gender: gateraMatch.sexo,
          location: gateraMatch.ubicacion,
          status: "activo",
          hc: gateraMatch.hc,
          isFeral: gateraMatch.isFeral,
          color: gateraMatch.color,
        };
        setCurrentAnimal(tempAnimal);
        setShelterEntries([
          {
            ubicacion: gateraMatch.ubicacion,
            microchip: gateraMatch.microchip,
            shortChip: gateraMatch.shortChip,
            descripcion: `${tempAnimal.name} (${gateraMatch.raza})`,
            medicacion: gateraMatch.medicacion,
            section: "GATERA" as any,
            pendientes: `HC: ${gateraMatch.hc}. ${gateraMatch.pendientes || ""}`,
            sistema: gateraMatch.sistema,
            tipo: gateraMatch.tipo,
          },
        ]);
        const treats = await db.kardex.where("microchip").equals(gateraMatch.microchip).toArray();
        setAnimalTreatments(treats);
        setNotFound(false);
        setEditLocation(gateraMatch.ubicacion);
        setEditMedication(gateraMatch.medicacion || "");
        setEditPendientes(gateraMatch.pendientes || "");
      } else {
        const allRecords = await db.shelterRecords.toArray();
        const match = allRecords.find(
          (r) => r.microchip.includes(clean) || (r.shortChip && r.shortChip.includes(clean))
        );

        if (match) {
          const tempAnimal: Animal = {
            microchip: match.microchip,
            shortChip: match.shortChip,
            name: match.descripcion.split("(")[1]?.replace(")", "") || match.descripcion,
            species: "perro",
            breed: match.descripcion,
            gender: "macho",
            location: match.ubicacion,
            status: "activo",
          };
          setCurrentAnimal(tempAnimal);
          setShelterEntries([match]);
          setNotFound(false);
          setEditLocation(match.ubicacion);
          setEditMedication(match.medicacion || "");
          setEditPendientes(match.pendientes || "");
        } else {
          setCurrentAnimal(null);
          setShelterEntries([]);
          setNotFound(true);
          if (typeof window !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([300]);
          }
        }
      }
    }
  };

  const handleResetToNextScan = () => {
    setChipInput("");
    setCurrentAnimal(null);
    setNotFound(false);
    setCensusConfirmed(false);
    setFeedbackMessage("Lector W91A listo: escanee el siguiente microchip.");
    setIsEditing(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
  };

  const handleChipInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim().toUpperCase();

    // Detección inteligente de sobre-escaneo: si el usuario escanea un chip nuevo sin borrar el anterior,
    // el valor resultante supera 15 dígitos numéricos (ej: 991003003805302991003003806121).
    // Tomar automáticamente los últimos 15 dígitos del nuevo chip.
    if (val.length > 15 && /^\d+$/.test(val)) {
      val = val.slice(-15);
      if (inputRef.current) {
        inputRef.current.value = val;
      }
    }

    setChipInput(val);

    // Auto-búsqueda instantánea si se detecta un microchip ISO de 15 dígitos
    if (val.length === 15 && /^\d{15}$/.test(val)) {
      handleSearch(val);
      if (inputRef.current) {
        inputRef.current.select();
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let query = chipInput.trim().toUpperCase();
    if (query.length > 15 && /^\d+$/.test(query)) {
      query = query.slice(-15);
      setChipInput(query);
    }
    handleSearch(query);
  };

  const handleConfirmCensus = async () => {
    if (!currentAnimal) return;

    // REGLA CLÍNICA: Los felinos fallecidos están exentos del censo activo diario
    if (isDeceased(currentAnimal)) {
      setFeedbackMessage("🕊️ Este felino está registrado como FALLECIDO. Permanece archivado en el Control de Bajas y está descontado del censo activo.");
      return;
    }

    const nowIso = new Date().toISOString();
    const cleanChip = currentAnimal.microchip.trim().toUpperCase();
    const allCensus = await db.census.toArray();
    // Buscar coincidencia exacta o por sufijo/fragmento para evitar duplicar chips cortos
    const existing = allCensus.find(
      (c) => {
        const itemChip = c.microchip.trim().toUpperCase();
        return (
          itemChip === cleanChip ||
          (cleanChip.length >= 10 && cleanChip.endsWith(itemChip)) ||
          (itemChip.length >= 10 && itemChip.endsWith(cleanChip))
        );
      }
    );
    const area = currentAnimal.species === "gato" ? "gatera" : "caninos";
    const treatmentCount = shelterEntries.filter((e) => e.medicacion).length;

    if (existing?.id) {
      await db.census.update(existing.id, {
        microchip: cleanChip.length >= existing.microchip.length ? cleanChip : existing.microchip,
        animalName: currentAnimal.name || "Felino",
        species: currentAnimal.species || "gato",
        location: currentAnimal.location || "GATERA",
        scannedAt: nowIso,
        scannedBy: currentUser?.name || "Operario de Campo",
        treatmentCount,
        area,
        photoUrl: currentAnimal.photoUrl || existing.photoUrl,
      });

      // Eliminar cualquier otro registro residual con el mismo chip
      const leftovers = allCensus.filter(
        (c) => c.id !== existing.id && (c.microchip.trim().toUpperCase() === cleanChip || cleanChip.endsWith(c.microchip.trim().toUpperCase()))
      );
      for (const left of leftovers) {
        if (left.id) await db.census.delete(left.id);
      }
    } else {
      await db.census.add({
        microchip: cleanChip,
        animalName: currentAnimal.name || "Felino",
        species: currentAnimal.species || "gato",
        location: currentAnimal.location || "GATERA",
        scannedAt: nowIso,
        scannedBy: currentUser?.name || "Operario de Campo",
        treatmentCount,
        area,
        photoUrl: currentAnimal.photoUrl,
      });
    }

    const updatedAnimal: Animal = {
      ...currentAnimal,
      lastCensusDate: nowIso,
      updatedBy: currentUser?.name || "Personal CBA La Perla",
      updatedById: currentUser?.id || "anon_user",
      updatedAt: nowIso,
    };

    if (currentAnimal.id) {
      await db.animals.update(currentAnimal.id, {
        lastCensusDate: nowIso,
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      });
    }

    setCurrentAnimal(updatedAnimal);

    // Sincronizar inmediatamente a Supabase para visibilidad en PC y todos los móviles en tiempo real
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const { syncAnimalToSupabase } = await import("@/lib/supabase");
        syncAnimalToSupabase(updatedAnimal).catch(console.warn);
      } catch {}
    }

    recordAudit({
      action: "CENSO_CONFIRMADO",
      microchip: currentAnimal.microchip.trim(),
      animalName: currentAnimal.name,
      location: currentAnimal.location,
      details: `Censo verificado y confirmado en ${currentAnimal.location} por ${currentUser?.name || "Personal"}`,
      user: currentUser,
    }).catch(console.warn);

    setCensusConfirmed(true);
    setFeedbackMessage(`✅ Censo registrado: ${currentAnimal.name} verificado en ${currentAnimal.location}`);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200]);
    }
  };

  const handleSaveColor = async (newColorRaw?: string) => {
    if (!currentAnimal) return;

    const selectedColor = (newColorRaw !== undefined ? newColorRaw : editColor).trim().toUpperCase();
    if (!selectedColor) {
      setFeedbackMessage("Por favor especifica o selecciona un color.");
      return;
    }

    const cleanChip = currentAnimal.microchip.trim().toUpperCase();
    const last7 = cleanChip.slice(-7);
    const newName = `FELINO ${selectedColor}`;
    const nowIso = new Date().toISOString();

    // 1. Actualizar o insertar en db.animals
    let anim = currentAnimal.id ? await db.animals.get(currentAnimal.id) : null;
    if (!anim) {
      anim =
        (await db.animals.where("microchip").equals(cleanChip).first()) ||
        (await db.animals.where("shortChip").equals(cleanChip).first()) ||
        (await db.animals.filter((a) => a.microchip.endsWith(last7) || cleanChip.endsWith(a.microchip)).first());
    }

    if (anim?.id) {
      await db.animals.update(anim.id, {
        color: selectedColor,
        name: newName,
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      });
    } else {
      await db.animals.add({
        ...currentAnimal,
        microchip: cleanChip,
        color: selectedColor,
        name: newName,
        species: currentAnimal.species || "gato",
        breed: currentAnimal.breed || "DPC",
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      });
    }

    // 2. Actualizar o insertar en db.gateraRecords
    let catRecord = await db.gateraRecords.where("microchip").equals(cleanChip).first();
    if (!catRecord) {
      catRecord =
        (await db.gateraRecords.where("shortChip").equals(cleanChip).first()) ||
        (await db.gateraRecords.filter((g) => g.microchip.endsWith(last7) || cleanChip.endsWith(g.microchip)).first());
    }

    if (catRecord?.id) {
      await db.gateraRecords.update(catRecord.id, {
        color: selectedColor,
        nombre: newName,
        descripcion: `${newName} (${catRecord.raza || "DPC"} - ${selectedColor})`,
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      });
    } else if (currentAnimal.species === "gato") {
      const gEntry: GateraCat = {
        ubicacion: currentAnimal.location || "GATERA",
        microchip: cleanChip,
        shortChip: last7,
        nombre: newName,
        descripcion: `${newName} (DPC - ${selectedColor})`,
        medicacion: "Ninguno",
        pendientes: "",
        color: selectedColor,
        raza: currentAnimal.breed || "DPC",
        sexo: currentAnimal.gender === "hembra" ? "hembra" : "macho",
        sexoCode: currentAnimal.sexoCode || "MFA",
        grupoEdad: "adulto",
        hc: currentAnimal.hc || last7.slice(-5),
        isFeral: currentAnimal.isFeral || false,
        tipoIngreso: currentAnimal.tipoIngreso || "RES",
        edad: currentAnimal.edad || "24 MESES",
        fechaIngreso: nowIso.split("T")[0],
        condicionCorporal: currentAnimal.condicionCorporal || "RANGO 3.0/5",
        estadoSalud: currentAnimal.estadoSalud || "Saludable",
        observacionesMedicas: currentAnimal.observacionesMedicas || "",
        requiereSeguimiento: "NO",
        tipoSeguimiento: "NO REQUIERE",
        medicoVeterinario: currentAnimal.medicoVeterinario || "",
        status: "activo",
        sistema: "PREVENTIVO",
        fechaFinal: "HNI",
        tipo: "FS",
        desparasitante: "AL DÍA (FELINO)",
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      };
      await db.gateraRecords.add(gEntry);
    }

    // 3. Actualizar en db.census
    const censusRecs = await db.census.where("microchip").equals(cleanChip).toArray();
    for (const c of censusRecs) {
      if (c.id) await db.census.update(c.id, { animalName: newName });
    }

    // 4. Actualizar en db.shiftTasks
    const shiftTasks = await db.shiftTasks.where("microchip").equals(cleanChip).toArray();
    for (const t of shiftTasks) {
      if (t.id) await db.shiftTasks.update(t.id, { animalName: newName });
    }

    // 5. Actualizar estado local en componente
    const updatedAnimal: Animal = {
      ...currentAnimal,
      color: selectedColor,
      name: newName,
      updatedBy: currentUser?.name || "Personal CBA La Perla",
      updatedById: currentUser?.id || "anon_user",
      updatedAt: nowIso,
    };
    setCurrentAnimal(updatedAnimal);
    setEditColor(selectedColor);
    setIsEditingColor(false);

    recordAudit({
      action: "CAMBIO_COLOR",
      microchip: cleanChip,
      animalName: currentAnimal.name,
      location: currentAnimal.location,
      previousValue: currentAnimal.color,
      newValue: selectedColor,
      details: `Color oficial cambiado de "${currentAnimal.color || "DPC"}" a "${selectedColor}" por ${currentUser?.name || "Personal"}`,
      user: currentUser,
    }).catch(console.warn);

    // 6. Sincronizar en segundo plano a Supabase
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const { syncAnimalToSupabase } = await import("@/lib/supabase");
        syncAnimalToSupabase(updatedAnimal).catch(console.warn);
      } catch {}
    }

    setFeedbackMessage(`🎨 Color oficial actualizado a "${selectedColor}" con éxito.`);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const saveAnimalPhoto = async (base64: string) => {
    if (!currentAnimal) return;
    setIsUploadingPhoto(true);
    try {
      const cleanChip = currentAnimal.microchip.trim();
      const nowIso = new Date().toISOString();

      // 1. Actualizar db.animals
      if (currentAnimal.id) {
        await db.animals.update(currentAnimal.id, {
          photoUrl: base64,
          updatedBy: currentUser?.name || "Personal CBA La Perla",
          updatedById: currentUser?.id || "anon_user",
          updatedAt: nowIso,
        });
      } else {
        const anim = await db.animals.where("microchip").equals(cleanChip).first();
        if (anim?.id) {
          await db.animals.update(anim.id, {
            photoUrl: base64,
            updatedBy: currentUser?.name || "Personal CBA La Perla",
            updatedById: currentUser?.id || "anon_user",
            updatedAt: nowIso,
          });
        }
      }

      // 2. Actualizar db.gateraRecords
      const catRec = await db.gateraRecords.where("microchip").equals(cleanChip).first();
      if (catRec && catRec.id) {
        await db.gateraRecords.update(catRec.id, {
          photoUrl: base64,
          updatedBy: currentUser?.name || "Personal CBA La Perla",
          updatedById: currentUser?.id || "anon_user",
          updatedAt: nowIso,
        });
      }

      // 3. Actualizar db.census
      db.census.where("microchip").equals(cleanChip).modify({ photoUrl: base64 }).catch(() => {});
      if (cleanChip.length > 7) {
        db.census.where("microchip").equals(cleanChip.slice(-7)).modify({ photoUrl: base64 }).catch(() => {});
      }

      const updated = {
        ...currentAnimal,
        photoUrl: base64,
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      };
      setCurrentAnimal(updated);

      recordAudit({
        action: "FOTO_SUBIDA",
        microchip: cleanChip,
        animalName: currentAnimal.name,
        location: currentAnimal.location,
        details: `Fotografía del felino actualizada con cámara/archivo por ${currentUser?.name || "Personal"}`,
        user: currentUser,
      }).catch(console.warn);

      // 3. Sincronizar en Supabase
      if (typeof window !== "undefined" && navigator.onLine) {
        try {
          const { syncAnimalToSupabase } = await import("@/lib/supabase");
          syncAnimalToSupabase(updated).catch(console.warn);
        } catch {}
      }

      setFeedbackMessage("📸 Fotografía del felino capturada, guardada y sincronizada.");
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error("Error al procesar fotografía:", err);
      alert("No se pudo procesar la fotografía.");
    } finally {
      setIsUploadingPhoto(false);
      if (scannerPhotoInputRef.current) scannerPhotoInputRef.current.value = "";
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentAnimal) return;
    try {
      const base64 = await compressImageFile(file, 800, 0.75);
      await saveAnimalPhoto(base64);
    } catch (err) {
      console.error("Error al comprimir fotografía:", err);
      alert("No se pudo comprimir la fotografía.");
    }
  };

  const handleDeletePhoto = async () => {
    if (!currentAnimal) return;
    const confirmDelete = window.confirm("¿Seguro que deseas eliminar la fotografía de este felino?");
    if (!confirmDelete) return;

    setIsUploadingPhoto(true);
    try {
      const cleanChip = currentAnimal.microchip.trim();
      const nowIso = new Date().toISOString();

      // 1. Actualizar db.animals
      if (currentAnimal.id) {
        await db.animals.update(currentAnimal.id, {
          photoUrl: undefined,
          updatedBy: currentUser?.name || "Personal CBA La Perla",
          updatedById: currentUser?.id || "anon_user",
          updatedAt: nowIso,
        });
      } else {
        const anim = await db.animals.where("microchip").equals(cleanChip).first();
        if (anim?.id) {
          await db.animals.update(anim.id, {
            photoUrl: undefined,
            updatedBy: currentUser?.name || "Personal CBA La Perla",
            updatedById: currentUser?.id || "anon_user",
            updatedAt: nowIso,
          });
        }
      }

      // 2. Actualizar db.gateraRecords
      const catRec = await db.gateraRecords.where("microchip").equals(cleanChip).first();
      if (catRec && catRec.id) {
        await db.gateraRecords.update(catRec.id, {
          photoUrl: undefined,
          updatedBy: currentUser?.name || "Personal CBA La Perla",
          updatedById: currentUser?.id || "anon_user",
          updatedAt: nowIso,
        });
      }

      const updated = {
        ...currentAnimal,
        photoUrl: undefined,
        updatedBy: currentUser?.name || "Personal CBA La Perla",
        updatedById: currentUser?.id || "anon_user",
        updatedAt: nowIso,
      };
      setCurrentAnimal(updated);

      recordAudit({
        action: "FOTO_ELIMINADA",
        microchip: cleanChip,
        animalName: currentAnimal.name,
        location: currentAnimal.location,
        details: `Fotografía eliminada por ${currentUser?.name || "Personal"}`,
        user: currentUser,
      }).catch(console.warn);

      // 3. Sincronizar en Supabase (elimina en la nube pasando deletePhoto: true)
      if (typeof window !== "undefined" && navigator.onLine) {
        try {
          const { syncAnimalToSupabase } = await import("@/lib/supabase");
          syncAnimalToSupabase({ ...updated, deletePhoto: true }).catch(console.warn);
        } catch {}
      }

      setSelectedPhotoPreview(null);
      setFeedbackMessage("🗑️ Fotografía del felino eliminada correctamente.");
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err) {
      console.error("Error al eliminar fotografía:", err);
      alert("Error al eliminar la fotografía.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveQuickEdit = async () => {
    if (!currentAnimal) return;

    const cleanChip = currentAnimal.microchip.trim().toUpperCase();
    const last7 = cleanChip.slice(-7);
    const isFallecido = editLocation.toUpperCase().trim() === "FALLECIDO";
    const nowIso = new Date().toISOString();
    const previousLoc = currentAnimal.location || "GATERA";
    const selectedColor = editColor.trim().toUpperCase();

    // Actualizar ubicación, color y estado en db.animals
    const animalUpdatePayload: Partial<Animal> = {
      location: editLocation,
      status: isFallecido ? "fallecido" : (currentAnimal.status === "fallecido" ? "activo" : currentAnimal.status || "activo"),
      fechaFallecimiento: isFallecido ? nowIso : undefined,
      causaFallecimiento: isFallecido ? (editPendientes || "Baja registrada en campo") : undefined,
      ubicacionPrevia: isFallecido ? previousLoc : undefined,
      updatedBy: currentUser?.name || "Personal CBA La Perla",
      updatedById: currentUser?.id || "anon_user",
      updatedAt: nowIso,
    };

    if (selectedColor && currentAnimal.species === "gato") {
      animalUpdatePayload.color = selectedColor;
      animalUpdatePayload.name = `FELINO ${selectedColor}`;
    }

    // 1. Buscar y actualizar de forma tolerante en db.animals
    let anim = currentAnimal.id ? await db.animals.get(currentAnimal.id) : null;
    if (!anim) {
      anim =
        (await db.animals.where("microchip").equals(cleanChip).first()) ||
        (await db.animals.where("shortChip").equals(cleanChip).first()) ||
        (await db.animals.filter((a) => a.microchip.endsWith(last7) || cleanChip.endsWith(a.microchip)).first());
    }

    if (anim && anim.id) {
      await db.animals.update(anim.id, animalUpdatePayload);
    } else {
      await db.animals.add({
        ...currentAnimal,
        ...animalUpdatePayload,
        microchip: cleanChip,
        species: currentAnimal.species || "gato",
        breed: currentAnimal.breed || "DPC",
        name: (selectedColor && currentAnimal.species === "gato") ? `FELINO ${selectedColor}` : currentAnimal.name,
      });
    }

    setCurrentAnimal({
      ...currentAnimal,
      location: editLocation,
      status: isFallecido ? "fallecido" : "activo",
      color: selectedColor || currentAnimal.color,
      name: (selectedColor && currentAnimal.species === "gato") ? `FELINO ${selectedColor}` : currentAnimal.name,
      updatedBy: currentUser?.name || "Personal CBA La Perla",
      updatedById: currentUser?.id || "anon_user",
      updatedAt: nowIso,
    });

    if (isFallecido) {
      // Descontar inmediatamente del censo activo
      const cRec = await db.census.where("microchip").equals(cleanChip).first();
      if (cRec && cRec.id) await db.census.delete(cRec.id);

      // Eliminar tareas de turno
      const tasks = await db.shiftTasks.where("microchip").equals(cleanChip).toArray();
      for (const t of tasks) if (t.id) await db.shiftTasks.delete(t.id);
    } else {
      // Traslado / Reubicación: actualizar ubicación y nombre en censo y tareas de turno activas
      const cRec = await db.census.where("microchip").equals(cleanChip).first();
      if (cRec && cRec.id) {
        await db.census.update(cRec.id, {
          location: editLocation,
          animalName: selectedColor ? `FELINO ${selectedColor}` : undefined,
        });
      }
      const tasks = await db.shiftTasks.where("microchip").equals(cleanChip).toArray();
      for (const t of tasks) {
        if (t.id) {
          await db.shiftTasks.update(t.id, {
            location: editLocation,
            animalName: selectedColor ? `FELINO ${selectedColor}` : undefined,
          });
        }
      }
    }

    if (currentAnimal.species === "gato") {
      // 2. Buscar y actualizar de forma tolerante en db.gateraRecords
      let catRecord = await db.gateraRecords.where("microchip").equals(cleanChip).first();
      if (!catRecord) {
        catRecord =
          (await db.gateraRecords.where("shortChip").equals(cleanChip).first()) ||
          (await db.gateraRecords.filter((g) => g.microchip.endsWith(last7) || cleanChip.endsWith(g.microchip)).first());
      }

      if (catRecord && catRecord.id) {
        await db.gateraRecords.update(catRecord.id, {
          ubicacion: editLocation,
          status: isFallecido ? "fallecido" : "activo",
          fechaFallecimiento: isFallecido ? nowIso : undefined,
          causaFallecimiento: isFallecido ? (editPendientes || "Baja registrada en campo") : undefined,
          ubicacionPrevia: isFallecido ? previousLoc : undefined,
          medicacion: editMedication,
          pendientes: editPendientes,
          color: selectedColor || catRecord.color,
          nombre: selectedColor ? `FELINO ${selectedColor}` : catRecord.nombre,
          descripcion: selectedColor ? `FELINO ${selectedColor} (${catRecord.raza || "DPC"} - ${selectedColor})` : catRecord.descripcion,
          updatedBy: currentUser?.name || "Personal CBA La Perla",
          updatedById: currentUser?.id || "anon_user",
          updatedAt: nowIso,
        });
      } else {
        const gEntry: GateraCat = {
          ubicacion: editLocation,
          microchip: cleanChip,
          shortChip: last7,
          nombre: selectedColor ? `FELINO ${selectedColor}` : currentAnimal.name,
          descripcion: selectedColor ? `FELINO ${selectedColor} (${currentAnimal.breed || "DPC"} - ${selectedColor})` : currentAnimal.name,
          medicacion: editMedication || "Ninguno",
          pendientes: editPendientes || "",
          color: selectedColor || currentAnimal.color || "COMÚN",
          raza: currentAnimal.breed || "DPC",
          sexo: currentAnimal.gender === "hembra" ? "hembra" : "macho",
          sexoCode: currentAnimal.sexoCode || "MFA",
          grupoEdad: "adulto",
          hc: currentAnimal.hc || last7.slice(-5),
          isFeral: currentAnimal.isFeral || false,
          tipoIngreso: currentAnimal.tipoIngreso || "RES",
          edad: currentAnimal.edad || "24 MESES",
          fechaIngreso: nowIso.split("T")[0],
          condicionCorporal: currentAnimal.condicionCorporal || "RANGO 3.0/5",
          estadoSalud: currentAnimal.estadoSalud || "Saludable",
          observacionesMedicas: currentAnimal.observacionesMedicas || "",
          requiereSeguimiento: "NO",
          tipoSeguimiento: "NO REQUIERE",
          medicoVeterinario: currentAnimal.medicoVeterinario || "",
          status: isFallecido ? "fallecido" : "activo",
          sistema: "PREVENTIVO",
          fechaFinal: "HNI",
          tipo: "FS",
          desparasitante: "AL DÍA (FELINO)",
          updatedBy: currentUser?.name || "Personal CBA La Perla",
          updatedById: currentUser?.id || "anon_user",
          updatedAt: nowIso,
        };
        await db.gateraRecords.add(gEntry);
      }

      setShelterEntries([
        {
          ubicacion: editLocation,
          microchip: currentAnimal.microchip,
          shortChip: currentAnimal.shortChip || currentAnimal.microchip.slice(-7),
          descripcion: selectedColor ? `FELINO ${selectedColor}` : currentAnimal.name,
          medicacion: editMedication,
          section: "GATERA" as any,
          pendientes: editPendientes,
        },
      ]);
    } else {
      // Actualizar en db.shelterRecords (Caninos)
      const recordToUpdate = shelterEntries[0];
      if (recordToUpdate && recordToUpdate.id) {
        await db.shelterRecords.update(recordToUpdate.id, {
          ubicacion: editLocation,
          medicacion: editMedication,
          pendientes: editPendientes,
        });
        const updated = await db.shelterRecords.get(recordToUpdate.id);
        if (updated) setShelterEntries([updated]);
      } else {
        const dogRec = await db.shelterRecords.where("microchip").equals(cleanChip).first();
        if (dogRec && dogRec.id) {
          await db.shelterRecords.update(dogRec.id, {
            ubicacion: editLocation,
            medicacion: editMedication,
            pendientes: editPendientes,
          });
          const updated = await db.shelterRecords.get(dogRec.id);
          if (updated) setShelterEntries([updated]);
        }
      }
    }

    recordAudit({
      action: isFallecido ? "BAJA_FALLECIDO" : "CAMBIO_UBICACION",
      microchip: cleanChip,
      animalName: currentAnimal.name,
      location: editLocation,
      previousValue: previousLoc,
      newValue: editLocation,
      details: isFallecido
        ? `Felino registrado como FALLECIDO por ${currentUser?.name || "Personal"}`
        : `Traslado a ${editLocation} (Color: ${selectedColor || currentAnimal.color || "DPC"}) por ${currentUser?.name || "Personal"}`,
      user: currentUser,
    }).catch(console.warn);

    // Sincronizar en Supabase si está disponible
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const { syncAnimalToSupabase } = await import("@/lib/supabase");
        syncAnimalToSupabase({
          ...currentAnimal,
          microchip: cleanChip,
          location: editLocation,
          status: isFallecido ? "fallecido" : "activo",
          color: selectedColor || currentAnimal.color,
          name: (selectedColor && currentAnimal.species === "gato") ? `FELINO ${selectedColor}` : currentAnimal.name,
          updatedBy: currentUser?.name || "Personal CBA La Perla",
          updatedById: currentUser?.id || "anon_user",
          updatedAt: nowIso,
        }).catch(console.warn);
      } catch {}
    }

    // Emitir evento global de sincronización para que el resto de pestañas actualicen su vista
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cba_sync_update", { detail: { chip: cleanChip } }));
    }

    setIsEditing(false);
    setFeedbackMessage(
      isFallecido
        ? "🕊️ Felino registrado como FALLECIDO. Se conserva su historial clínico en el control oficial y se descuenta del censo activo."
        : "💾 Datos del animal actualizados y sincronizados en la planilla."
    );
  };

  const handleExtendTreatment = async (kardexId?: number, extraDays: number = 7) => {
    if (!kardexId) return;
    const t = await db.kardex.get(kardexId);
    if (!t) return;
    const newTotales = (t.dosisTotales || 7) + extraDays;
    const newFaltantes = (t.dosisFaltantes || 0) + extraDays;
    await db.kardex.update(kardexId, {
      dosisTotales: newTotales,
      dosisFaltantes: newFaltantes,
      status: "activo",
    });
    setFeedbackMessage(`🩺 Tratamiento extendido +${extraDays} dosis/días.`);
    if (currentAnimal) {
      const updated = await db.kardex.where("microchip").equals(currentAnimal.microchip).toArray();
      setAnimalTreatments(updated);
    }
  };

  const handleDischargeTreatment = async (kardexId?: number) => {
    if (!kardexId) return;
    await db.kardex.update(kardexId, {
      status: "finalizado",
      dosisFaltantes: 0,
    });
    setFeedbackMessage("🩺 Alta médica otorgada. Tratamiento culminado al 100%.");
    if (currentAnimal) {
      const updated = await db.kardex.where("microchip").equals(currentAnimal.microchip).toArray();
      setAnimalTreatments(updated);
    }
  };

  const handleOpenNewTreatment = () => {
    setIsPrescribingTreatment(true);
    setEditingTreatmentId(null);
    setRxMedication("");
    setRxSystem("TEGUMEN");
    setRxDoses(7);
    setRxFrequency("SID");
    setRxPendientes(currentAnimal?.notes || "");
  };

  const handleOpenEditTreatment = (treat: KardexRecord) => {
    setEditingTreatmentId(treat.id || 1);
    setIsPrescribingTreatment(false);
    setRxMedication(treat.treatment || "");
    setRxSystem(treat.system || "TEGUMEN");
    setRxDoses(treat.dosisTotales || 7);
    setRxFrequency(treat.tipo || "SID");
    setRxPendientes(treat.pendientes || "");
  };

  const handleOpenEditShelterEntry = () => {
    const entry = shelterEntries[0];
    setEditingTreatmentId(1);
    setIsPrescribingTreatment(false);
    setRxMedication(entry?.medicacion || "");
    setRxSystem(entry?.sistema || "TEGUMEN");
    setRxDoses(7);
    setRxFrequency(entry?.tipo || "SID");
    setRxPendientes(entry?.pendientes || "");
  };

  const handleSavePrescription = async (isEdit: boolean, existingKardexId?: number) => {
    if (!currentAnimal) return;
    const isVetOrAdmin = currentUser?.role === "veterinario" || currentUser?.role === "admin";
    if (!isVetOrAdmin) {
      setFeedbackMessage("⛔ Regla de Oro: Solo Médicos Veterinarios y Administradores tienen autorización para instaurar o editar tratamientos.");
      return;
    }
    if (!rxMedication.trim()) {
      alert("Por favor ingresa o selecciona la medicación prescrita.");
      return;
    }

    const cleanChip = currentAnimal.microchip.trim();
    const shortChip = currentAnimal.shortChip || cleanChip.slice(-7);
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split("T")[0];
    const totalDoses = rxDoses > 0 ? rxDoses : 7;
    const prescriber = currentUser ? currentUser.name : "Médico Veterinario Gatera";

    if (isEdit && existingKardexId) {
      const existing = await db.kardex.get(existingKardexId);
      const applied = existing?.dosisAplicadas || 0;
      const missing = Math.max(0, totalDoses - applied);

      await db.kardex.update(existingKardexId, {
        treatment: rxMedication.trim(),
        system: rxSystem,
        tipo: rxFrequency,
        pendientes: rxPendientes.trim(),
        dosisTotales: totalDoses,
        dosisFaltantes: missing,
        status: missing === 0 ? "finalizado" : "activo",
      });

      const task = await db.shiftTasks.where("kardexId").equals(existingKardexId).first();
      if (task?.id) {
        await db.shiftTasks.update(task.id, {
          medication: rxMedication.trim(),
          dosisTotales: totalDoses,
          dosisFaltantes: missing,
          notes: rxPendientes.trim(),
        });
      }

      setFeedbackMessage(`✅ Tratamiento actualizado con éxito para ${currentAnimal.name}`);
    } else {
      const newKardexId = await db.kardex.add({
        microchip: cleanChip,
        shortChip,
        system: rxSystem,
        treatment: rxMedication.trim(),
        description: `Gatera [${currentAnimal.location}]. HC: ${currentAnimal.hc || ""}. ${rxPendientes.trim()}`,
        startDate: todayDate,
        endDate: "HNI",
        status: "activo",
        prescribedBy: prescriber,
        createdAt: nowIso,
        tipo: rxFrequency,
        pendientes: rxPendientes.trim(),
        section: "GATERA_CENSO",
        area: "gatera",
        dosisTotales: totalDoses,
        dosisAplicadas: 0,
        dosisFaltantes: totalDoses,
      });

      await db.shiftTasks.add({
        microchip: cleanChip,
        animalName: currentAnimal.name,
        location: currentAnimal.location,
        species: "gato",
        laborType: "medicacion",
        shift: "mañana",
        isCompleted: false,
        medication: rxMedication.trim(),
        scheduledDate: todayDate,
        area: "gatera",
        kardexId: Number(newKardexId),
        dosisTotales: totalDoses,
        dosisAplicadas: 0,
        dosisFaltantes: totalDoses,
        isFeral: currentAnimal.isFeral,
        notes: rxPendientes.trim(),
      });

      setFeedbackMessage(`💊 Tratamiento instaurado con éxito para ${currentAnimal.name} (${totalDoses} dosis programadas)`);
    }

    const cat = await db.gateraRecords.where("microchip").equals(cleanChip).first();
    if (cat?.id) {
      await db.gateraRecords.update(cat.id, {
        medicacion: rxMedication.trim(),
        sistema: rxSystem,
        tipo: rxFrequency,
        pendientes: rxPendientes.trim(),
        requiereSeguimiento: "SI",
        tipoSeguimiento: "TRATAMIENTO",
      });
    }

    const anim = await db.animals.where("microchip").equals(cleanChip).first();
    if (anim?.id) {
      await db.animals.update(anim.id, {
        observacionesMedicas: rxPendientes.trim(),
        notes: `${rxMedication.trim()}. ${rxPendientes.trim()}`,
        requiereSeguimiento: "SI",
        tipoSeguimiento: "TRATAMIENTO",
      });
    }

    const updatedTreatments = await db.kardex.where("microchip").equals(cleanChip).toArray();
    setAnimalTreatments(updatedTreatments);
    setShelterEntries([
      {
        ubicacion: currentAnimal.location,
        microchip: cleanChip,
        shortChip,
        descripcion: currentAnimal.name,
        medicacion: rxMedication.trim(),
        section: "GATERA" as any,
        pendientes: rxPendientes.trim(),
        sistema: rxSystem,
        tipo: rxFrequency,
      },
    ]);

    recordAudit({
      action: isEdit ? "TRATAMIENTO_EDITADO" : "TRATAMIENTO_PRESCRITO",
      microchip: cleanChip,
      animalName: currentAnimal.name,
      location: currentAnimal.location,
      details: `${isEdit ? "Edición" : "Instauración"} de tratamiento: ${rxMedication.trim()} (${rxSystem}, ${totalDoses} dosis) por Dr. ${prescriber}`,
      user: currentUser,
    }).catch(console.warn);

    setIsPrescribingTreatment(false);
    setEditingTreatmentId(null);

    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const handleApplyVoiceIntent = async (intent: ParsedClinicalIntent) => {
    if (!currentAnimal) return;

    const targetLoc = intent.location || currentAnimal.location;
    const cleanChip = currentAnimal.microchip.trim();

    // Actualizar gateraRecords
    const catRecord = await db.gateraRecords.where("microchip").equals(cleanChip).first();
    if (catRecord && catRecord.id) {
      await db.gateraRecords.update(catRecord.id, {
        ubicacion: targetLoc,
        medicacion: intent.treatment || catRecord.medicacion,
        sistema: intent.system || catRecord.sistema,
        pendientes: intent.description || catRecord.pendientes,
        fechaFinal: intent.durationDays ? `+${intent.durationDays} días` : catRecord.fechaFinal,
      });
    }

    // Actualizar db.animals
    if (currentAnimal.id) {
      await db.animals.update(currentAnimal.id, {
        location: targetLoc,
        notes: intent.description ? `${currentAnimal.notes || ""}\n[VOZ IA]: ${intent.description}`.trim() : currentAnimal.notes,
      });
    }

    // Registrar en Kardex si tiene tratamiento
    if (intent.treatment) {
      const nowIso = new Date().toISOString();
      const duration = intent.durationDays || 7;
      await db.kardex.add({
        microchip: cleanChip,
        shortChip: currentAnimal.shortChip || cleanChip.slice(-7),
        system: intent.system || "PREVENTIVO",
        treatment: intent.treatment,
        description: intent.description || "Prescrito por Asistente de Voz IA",
        startDate: nowIso.split("T")[0],
        endDate: new Date(Date.now() + duration * 86400000).toISOString().split("T")[0],
        status: "activo",
        prescribedBy: currentUser?.name ? `Dr. ${currentUser.name} (IA)` : "Dra. Jenny Zapata Calle (IA)",
        createdAt: nowIso,
        area: "gatera",
        dosisTotales: duration,
        dosisAplicadas: 0,
        dosisFaltantes: duration,
      });
    }

    handleSearch(currentAnimal.microchip);
    setFeedbackMessage(`✨ Nota clínica de voz procesada por IA: "${intent.treatment || intent.description}"`);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* 1. Barra de Escaneo con W91A */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Lector W91A (Bluetooth HID) Listo
            </span>
          </div>
          <span className="text-[11px] font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200">
            Escaneo instantáneo
          </span>
        </div>

        <form onSubmit={handleManualSubmit} className="relative">
          <input
            ref={inputRef}
            data-chip-scanner="true"
            type="text"
            value={chipInput}
            onChange={handleChipInputChange}
            onFocus={(e) => e.target.select()}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            placeholder="Acerque el W91A al chip del animal..."
            autoFocus
            autoComplete="off"
            className="w-full text-xl sm:text-2xl font-mono tracking-wider text-center py-4 pl-12 pr-28 sm:pr-36 border-2 border-indigo-500 rounded-2xl bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-bold"
          />
          <Scan className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-600 w-6 h-6" />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {chipInput && (
              <button
                type="button"
                onClick={handleResetToNextScan}
                className="p-1.5 bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-700 rounded-xl transition-all active:scale-90"
                title="Borrar microchip y dejar listo para el siguiente felino"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsVoiceOpen(true)}
              className="p-2 bg-indigo-100 hover:bg-indigo-200 active:scale-95 text-indigo-700 rounded-xl transition-all flex items-center gap-1 text-xs font-bold shadow-xs"
              title="Dictar nota o indicación por Voz con IA"
            >
              <Mic className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Voz IA</span>
            </button>
            <button
              type="submit"
              className="px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all active:scale-95"
            >
              Buscar
            </button>
          </div>
        </form>

        {/* Indicador de compatibilidad de hardware real W91A */}
        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="flex items-center gap-1.5 font-bold text-slate-700">
            <Scan className="w-3.5 h-3.5 text-indigo-600" />
            Lector Sycreader W91A
          </span>
          <span className="font-mono text-[10px] text-slate-500">
            ISO 11784/11785 (15 dígitos) • Sufijos 7d • FDX-B / Hex
          </span>
        </div>

        {/* Botón de Descarga / Subida en Masa de Memoria W91A */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>¿Escaneaste en zonas sin señal con memoria W91A?</span>
          </div>
          <button
            type="button"
            onClick={() => setIsBatchOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 transition-all"
          >
            <Layers className="w-4 h-4 text-indigo-200" />
            <span>SUBIR MEMORIA W91A (HASTA 128 CHIPS)</span>
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-sm font-bold flex items-center justify-between animate-in fade-in">
          <span>{feedbackMessage}</span>
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 ml-2" />
        </div>
      )}

      {/* 2. Tarjeta del Animal Encontrado con Datos del Excel */}
      {currentAnimal && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200 space-y-4 animate-in slide-in-from-bottom-4 duration-200">
          {/* Barra de acción rápida: Siguiente Felino */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-purple-50 border border-purple-200 rounded-2xl">
            <span className="text-xs font-black text-purple-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
              Ficha activa: {currentAnimal.name} ({currentAnimal.shortChip || currentAnimal.microchip.slice(-7)})
            </span>
            <button
              type="button"
              onClick={handleResetToNextScan}
              className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all ml-auto"
              title="Limpiar y preparar el lector para el siguiente felino"
            >
              <RefreshCw className="w-3.5 h-3.5 text-purple-200" />
              <span>Escanear Siguiente Felino</span>
            </button>
          </div>

          {/* ALERTAS DE BIOSEGURIDAD CRÍTICA */}
          {(() => {
            const isCDV =
              currentAnimal.species === "perro" &&
              (currentAnimal.notes?.toUpperCase().includes("CDV") ||
                currentAnimal.breed?.toUpperCase().includes("CDV") ||
                shelterEntries.some((e) => e.section === "CDV"));
            const isCuarentena = currentAnimal.location?.toUpperCase().includes("CUARENTENA");
            const isFeral = Boolean(currentAnimal.isFeral);

            return (
              <div className="space-y-2">
                {isCDV && (
                  <div className="p-3.5 bg-red-100 border-2 border-red-600 rounded-2xl flex items-center gap-3 text-red-950 animate-bounce">
                    <ShieldAlert className="w-6 h-6 text-red-700 shrink-0" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        ☣️ BIOSEGURIDAD NIVEL 3: POSITIVO PARA DISTEMPER (CDV)
                      </span>
                      <span className="text-[11px] font-bold text-red-800">
                        Aislamiento estricto obligatorio. Prohibido contacto con otros caninos. Desinfección rigurosa.
                      </span>
                    </div>
                  </div>
                )}

                {isFeral && (
                  <div className="p-3.5 bg-red-50 border-2 border-red-500 rounded-2xl flex items-center gap-3 text-red-900 animate-pulse">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        ⚠️ ALERTA DE MANEJO: FELINO FERAL (REACTIVO)
                      </span>
                      <span className="text-[11px] text-red-700">
                        Obligatorio: utilizar guantes de carnaza y toalla de contención antes de abrir la jaula.
                      </span>
                    </div>
                  </div>
                )}

                {isCuarentena && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-500 rounded-2xl flex items-center gap-3 text-amber-950">
                    <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block">
                        🛑 ÁREA RESTRINGIDA DE CUARENTENA
                      </span>
                      <span className="text-[11px] text-amber-800">
                        En observación clínica preventiva. Prohibido traslado a patios sin autorización médica.
                      </span>
                    </div>
                  </div>
                )}

                {isDeceased(currentAnimal) && (
                  <div className="p-3.5 bg-slate-900 border-2 border-slate-700 rounded-2xl flex items-center gap-3 text-white animate-in fade-in">
                    <span className="text-2xl shrink-0">🕊️</span>
                    <div>
                      <span className="font-black text-xs uppercase tracking-wide block text-slate-100">
                        REGISTRO DE FELINO FALLECIDO (BAJA EN CENSO)
                      </span>
                      <span className="text-[11px] font-medium text-slate-300">
                        Este animal está descontado de la población activa del censo. Sus datos clínicos, microchip y causas de defunción permanecen guardados en el control oficial.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Encabezado Animal con Color Oficial Columna H */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-2xl font-black text-slate-900 leading-tight">
                  {currentAnimal.species === "gato"
                    ? (currentAnimal.color || currentAnimal.name)
                    : currentAnimal.name}
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    currentAnimal.species === "gato"
                      ? "bg-purple-100 text-purple-900 border border-purple-200"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {currentAnimal.species === "gato" ? "🐱 GATERA" : "🐶 CANINO"}
                </span>
                {currentAnimal.hc && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 text-slate-800">
                    HC: {currentAnimal.hc}
                  </span>
                )}
              </div>

              {/* Fila de Microchip, Raza y Color Oficial Destacado */}
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                <span className="text-xs font-mono text-slate-500 tracking-wider">
                  Chip: <strong>{currentAnimal.shortChip || currentAnimal.microchip}</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-700 font-semibold">
                  Raza: <strong>{currentAnimal.breed || "DPC"}</strong>
                </span>
                {(currentAnimal.color || currentAnimal.species === "gato") && (
                  <>
                    <span className="text-slate-300">•</span>
                    <div className="inline-flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-purple-900 bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 shadow-xs">
                        🎨 Color Oficial (Col. H): {currentAnimal.color || "DPC"}
                      </span>
                      {Boolean(currentUser) && !isEditingColor && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditColor(currentAnimal.color || "");
                            setIsEditingColor(true);
                          }}
                          className="text-[10px] font-black text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-50 border border-purple-300 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all shadow-xs active:scale-95"
                          title="Modificar color oficial del felino"
                        >
                          <Edit3 className="w-2.5 h-2.5" /> Editar Color
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Selector interactivo directo para modificar el color del felino */}
              {isEditingColor && currentAnimal.species === "gato" && (
                <div className="mt-2.5 p-3 bg-purple-50 border border-purple-300/80 rounded-2xl space-y-2.5 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-purple-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Palette className="w-4 h-4 text-purple-700" /> Modificar Color Oficial (Columna H)
                    </span>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-200/60 px-2 py-0.5 rounded-full">
                      {OFFICIAL_GATERA_COLORS.length} Colores Oficiales
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      list="scanner-colors-list"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value.toUpperCase())}
                      className="flex-1 p-2 text-xs font-black text-purple-950 bg-white border border-purple-300 rounded-xl uppercase tracking-wide focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      placeholder="Selecciona o escribe el color exacto..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveColor()}
                      className="px-3 py-2 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-xs shrink-0 flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" /> Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingColor(false)}
                      className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-700 text-xs font-bold rounded-xl transition-all shrink-0"
                    >
                      Cancelar
                    </button>
                  </div>

                  {/* Datalist con todos los colores oficiales del Excel */}
                  <datalist id="scanner-colors-list">
                    {OFFICIAL_GATERA_COLORS.map((col) => (
                      <option key={col} value={col} />
                    ))}
                  </datalist>

                  {/* Chips de Selección Rápida con los Colores Más Comunes */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-200/60">
                    <span className="text-[10px] font-bold text-purple-800 mr-1">Rápidos:</span>
                    {[
                      "TABBY PARDO",
                      "TABBY AMARILLO",
                      "NEGRO",
                      "BLANCO",
                      "BLANCO X NEGRO",
                      "TRICOLOR",
                      "CAREY",
                      "GRIS",
                      "TABBY PARDO X BLANCO",
                      "BLANCO X TABBY AMARILLO",
                      "TABBY AMARILLO X BLANCO",
                    ].map((quickCol) => (
                      <button
                        key={quickCol}
                        type="button"
                        onClick={() => handleSaveColor(quickCol)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all active:scale-95 border ${
                          editColor === quickCol
                            ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                            : "bg-white text-purple-900 border-purple-200 hover:bg-purple-100"
                        }`}
                      >
                        {quickCol}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {currentAnimal.species === "gato" && currentAnimal.retroviralStatus && currentAnimal.retroviralStatus !== "PENDIENTE" && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      currentAnimal.retroviralStatus === "DOBLE_POSITIVO"
                        ? "bg-rose-100 text-rose-900 border border-rose-300"
                        : currentAnimal.retroviralStatus === "VIF_POSITIVO"
                        ? "bg-purple-100 text-purple-900 border border-purple-300"
                        : currentAnimal.retroviralStatus === "FELV_POSITIVO"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : "bg-emerald-100 text-emerald-900 border border-emerald-300"
                    }`}
                  >
                    🧬 {currentAnimal.retroviralStatus === "DOBLE_POSITIVO"
                      ? "DOBLE POSITIVO (VIF+ / FeLV+)"
                      : currentAnimal.retroviralStatus === "VIF_POSITIVO"
                      ? "VIF+ (Inmunodeficiencia Felina)"
                      : currentAnimal.retroviralStatus === "FELV_POSITIVO"
                      ? "FeLV+ (Leucemia Felina)"
                      : "RETROVIRALES: NEGATIVO (VIF- / FeLV-)"}
                  </span>
                </div>
              )}

              {/* Trazabilidad de Auditoría por Usuario */}
              {(currentAnimal.createdBy || currentAnimal.updatedBy) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-medium bg-slate-50 p-2 rounded-xl border border-slate-100">
                  {currentAnimal.createdBy && (
                    <span className="flex items-center gap-1">
                      📝 <strong className="text-slate-700">Registrado por:</strong> {currentAnimal.createdBy}
                      {currentAnimal.createdAt && ` (${new Date(currentAnimal.createdAt).toLocaleDateString()})`}
                    </span>
                  )}
                  {currentAnimal.createdBy && currentAnimal.updatedBy && <span className="text-slate-300">•</span>}
                  {currentAnimal.updatedBy && (
                    <span className="flex items-center gap-1">
                      ✏️ <strong className="text-slate-700">Última edición:</strong> {currentAnimal.updatedBy}
                      {currentAnimal.updatedAt && ` (${new Date(currentAnimal.updatedAt).toLocaleDateString()})`}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Controles de Cabecera: Fotografía y Ubicación */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap justify-end">
              {/* Fotografía del Felino / Animal */}
              <div className="flex flex-col items-center">
                <input
                  ref={scannerPhotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
                {currentAnimal.photoUrl ? (
                  <div className="relative group">
                    <img
                      src={currentAnimal.photoUrl}
                      alt={currentAnimal.name}
                      onClick={() => setSelectedPhotoPreview(currentAnimal.photoUrl!)}
                      className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-2xl border-2 border-purple-400 shadow-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                      title="Toca para ver la foto en pantalla completa"
                    />
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPhotoPreview(currentAnimal.photoUrl!)}
                        className="p-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg border border-purple-200 transition-all text-[9px]"
                        title="Ver ampliada"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={() => setIsPhotoModalOpen(true)}
                        className="p-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg border border-purple-200 transition-all text-[9px]"
                        title="Tomar o cambiar fotografía"
                      >
                        <Camera className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={handleDeletePhoto}
                        className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all text-[9px]"
                        title="Eliminar fotografía"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isUploadingPhoto}
                    onClick={() => setIsPhotoModalOpen(true)}
                    className="w-16 h-16 sm:w-20 sm:h-20 border-2 border-dashed border-purple-300 hover:border-purple-500 bg-purple-50/70 hover:bg-purple-100/70 rounded-2xl flex flex-col items-center justify-center text-purple-900 transition-all p-1 shadow-xs active:scale-95"
                    title="Tomar foto con cámara o subir archivo"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
                    ) : (
                      <>
                        <Camera className="w-5 h-5 text-purple-700 mb-0.5" />
                        <span className="text-[9px] font-black leading-tight text-center">
                          + Foto
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Ubicación Actual */}
              <div className="px-3.5 sm:px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-2xl flex flex-col items-center shrink-0">
                <span className="text-[10px] font-bold text-indigo-600 uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> UBICACIÓN
                </span>
                <span className="text-sm sm:text-base font-black text-indigo-900 text-center">{currentAnimal.location}</span>
                {Boolean(currentUser) && !isEditing && (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="mt-1 text-[10px] font-black text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all active:scale-95 shadow-xs"
                    title="Cambiar de patio, canil o jaula (Traslado)"
                  >
                    <Edit3 className="w-2.5 h-2.5" /> Trasladar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* GESTIÓN CLÍNICA: INSTAURAR Y EDITAR TRATAMIENTO DIRECTAMENTE EN FICHA */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <Pill className="w-4 h-4 text-indigo-600" /> Prescripción y Tratamiento Médico
              </span>
              {(currentUser?.role === "veterinario" || currentUser?.role === "admin") && !isPrescribingTreatment && editingTreatmentId === null && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsVoiceOpen(true)}
                    className="px-2.5 py-1 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                    title="Dictar tratamiento médico con Asistente de Voz IA"
                  >
                    <Mic className="w-3.5 h-3.5 text-purple-200" />
                    <span>🎙️ Dictar con IA</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenNewTreatment}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs active:scale-95 transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>➕ Instaurar Tratamiento</span>
                  </button>
                </div>
              )}
            </div>

            {/* FORMULARIO INLINE PARA INSTAURAR O EDITAR TRATAMIENTO */}
            {(isPrescribingTreatment || editingTreatmentId !== null) && (
              <div className="p-4 bg-indigo-50/90 border-2 border-indigo-300 rounded-3xl space-y-3 animate-in zoom-in-95 shadow-sm text-xs">
                <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-indigo-600 text-white rounded-lg">
                      <Stethoscope className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-black text-indigo-950 text-sm">
                        {isPrescribingTreatment ? "Instaurar Nuevo Tratamiento Clínico" : "Editar Tratamiento Activo"}
                      </h4>
                      <p className="text-[11px] text-indigo-700 font-medium">
                        Prescripción oficial de Gatera • Sincronización en Kardex, Turnos y Planilla
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrescribingTreatment(false);
                      setEditingTreatmentId(null);
                    }}
                    className="p-1 hover:bg-indigo-200/60 rounded-lg text-indigo-800 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Medicación prescrita */}
                <div>
                  <label className="font-black text-slate-800 block mb-1">
                    Medicación Prescrita / Fármacos:
                  </label>
                  <input
                    type="text"
                    value={rxMedication}
                    onChange={(e) => setRxMedication(e.target.value)}
                    placeholder="Ej. AMOXISOL - MELOXICAM - EDO ATP..."
                    className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl font-bold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  {/* Pastillas rápidas de fármacos comunes */}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {["AMOXISOL", "EDO ATP", "INMULL", "ATRIBEN", "MELOXICAM", "ENROFLOXACINA", "METRONIDAZOL", "DOXICICLINA", "TRAMADOL", "KETOPROFENO"].map((drug) => (
                      <button
                        key={drug}
                        type="button"
                        onClick={() => {
                          if (rxMedication.includes(drug)) return;
                          setRxMedication(rxMedication ? `${rxMedication} - ${drug}` : drug);
                        }}
                        className="px-2 py-0.5 bg-white hover:bg-indigo-100 border border-indigo-200 rounded-md text-[10px] font-bold text-indigo-900 transition-all active:scale-95"
                      >
                        + {drug}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Sistema Afectado */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Sistema Clínico:</label>
                    <select
                      value={rxSystem}
                      onChange={(e) => setRxSystem(e.target.value)}
                      className="w-full p-2 bg-white border border-indigo-300 rounded-xl font-bold text-slate-800"
                    >
                      <option value="TEGUMEN">TEGUMEN (Piel / Heridas)</option>
                      <option value="RESPIRATORIO">RESPIRATORIO (Gripe / Tos)</option>
                      <option value="DIGESTIVO">DIGESTIVO (Gastroenteritis)</option>
                      <option value="MUSCULOESQUELÉTICO">MUSCULOESQUELÉTICO (Trauma)</option>
                      <option value="ÓTICO / OFTÁLMICO">ÓTICO / OFTÁLMICO</option>
                      <option value="URINARIO">URINARIO (FLUTD / Renal)</option>
                      <option value="NERVIOSO">NERVIOSO</option>
                      <option value="PLAN SANITARIO">PLAN SANITARIO</option>
                      <option value="GENERAL">GENERAL / OTRO</option>
                    </select>
                  </div>

                  {/* Frecuencia / Horario */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Frecuencia:</label>
                    <select
                      value={rxFrequency}
                      onChange={(e) => setRxFrequency(e.target.value)}
                      className="w-full p-2 bg-white border border-indigo-300 rounded-xl font-bold text-slate-800"
                    >
                      <option value="SID">SID (Cada 24 horas)</option>
                      <option value="BID">BID (Cada 12 horas)</option>
                      <option value="TID">TID (Cada 8 horas)</option>
                      <option value="CADA 48 HORAS">Cada 48 Horas</option>
                      <option value="DOSIS ÚNICA">Dosis Única</option>
                      <option value="S">S (Según evolución médica)</option>
                    </select>
                  </div>

                  {/* Dosis Totales */}
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Total de Dosis:</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={rxDoses}
                      onChange={(e) => setRxDoses(Number(e.target.value) || 1)}
                      className="w-full p-2 bg-white border border-indigo-300 rounded-xl font-black text-slate-800 text-center"
                    />
                  </div>
                </div>

                {/* Pendientes / Diagnóstico */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Diagnóstico Clínico / Pendientes:
                  </label>
                  <input
                    type="text"
                    value={rxPendientes}
                    onChange={(e) => setRxPendientes(e.target.value)}
                    placeholder="Ej. GINGIVITIS - HERIDA EN MIEMBRO POSTERIOR..."
                    className="w-full p-2.5 bg-white border border-indigo-300 rounded-xl text-slate-900"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrescribingTreatment(false);
                      setEditingTreatmentId(null);
                    }}
                    className="w-1/2 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSavePrescription(editingTreatmentId !== null, editingTreatmentId || undefined)}
                    className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black flex items-center justify-center gap-1.5 shadow-md transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>{editingTreatmentId !== null ? "Guardar Cambios" : "Instaurar Tratamiento"}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Listado de Tratamientos Existentes */}
            {shelterEntries.length > 0 && shelterEntries.some((e) => e.medicacion && e.medicacion !== "Ninguno") ? (
              shelterEntries.map((entry, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black uppercase tracking-wider text-indigo-700">
                      [{entry.section}] {entry.sistema ? `• ${entry.sistema}` : ""}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {entry.tipo && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">
                          {entry.tipo}
                        </span>
                      )}
                      {(currentUser?.role === "veterinario" || currentUser?.role === "admin") && (
                        <button
                          type="button"
                          onClick={() => {
                            const matchKardex = animalTreatments[idx] || animalTreatments[0];
                            if (matchKardex?.id) handleOpenEditTreatment(matchKardex);
                            else handleOpenEditShelterEntry();
                          }}
                          className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded text-[11px] font-black flex items-center gap-1 transition-all active:scale-95"
                          title="Editar este tratamiento"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {entry.medicacion && (
                    <div className="text-xs text-slate-900 bg-white p-3 rounded-xl border border-slate-100 font-medium">
                      <strong className="text-slate-800 block text-xs mb-0.5">💊 Medicación prescrita:</strong>
                      {entry.medicacion}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                    {entry.pendientes && (
                      <span className="text-red-700 font-bold bg-red-100 px-2.5 py-0.5 rounded-full">
                        Pendiente: {entry.pendientes}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              !isPrescribingTreatment && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="text-slate-500">
                    <span className="font-bold text-slate-700 block">Sin tratamiento activo registrado</span>
                    <span>Este felino no tiene medicación asignada actualmente.</span>
                  </div>
                  {(currentUser?.role === "veterinario" || currentUser?.role === "admin") && (
                    <button
                      type="button"
                      onClick={handleOpenNewTreatment}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl flex items-center gap-1.5 shadow-sm transition-all shrink-0"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>➕ Instaurar Tratamiento Ahora</span>
                    </button>
                  )}
                </div>
              )
            )}
          </div>

          {/* Desparasitación Felina Oficial (Revolution Plus / Feline Full Spot / Total FCG) */}
          <div className="p-4 bg-purple-50/80 border-2 border-purple-200 rounded-2xl space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-black text-purple-950 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                <Pill className="w-4 h-4 text-purple-600" /> Plan Sanitario & Desparasitación Felina
              </span>
              <span className="px-2.5 py-0.5 bg-purple-200 text-purple-900 rounded-full text-xs font-black">
                Revolution Plus / Full Spot
              </span>
            </div>
            <p className="text-xs text-purple-800">
              Protocolo Gatera CBA La Perla: Control endo/ectoparásitos felinos (Selamectina / Fipronil).
            </p>
            <button
              type="button"
              onClick={async () => {
                setFeedbackMessage(
                  `💊 Desparasitante felino (Revolution Plus) registrado con éxito para ${currentAnimal.name}`
                );
                if (typeof window !== "undefined" && "vibrate" in navigator) {
                  navigator.vibrate([150, 50, 150]);
                }
              }}
              className="w-full py-2.5 px-4 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <CheckCircle2 className="w-4 h-4" /> REGISTRAR APLICACIÓN DE DESPARASITANTE HOY
            </button>
          </div>

          {/* Modo de Edición Rápida en Campo (EXCLUSIVO MÉDICOS VETERINARIOS Y ADMIN) */}
          {Boolean(currentUser) && (
            isEditing ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3 text-xs animate-in fade-in">
                <h4 className="font-bold text-amber-900 uppercase">Modificar Datos de este Animal (Vet/Admin)</h4>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-slate-700">Mover a Nueva Ubicación (Columna B):</label>
                    <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                      {locationsList.length} Ubicaciones
                    </span>
                  </div>
                  <input
                    type="text"
                    list="scanner-locations-list"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-xl font-bold uppercase"
                    placeholder="Ej. CUARENTENA 1, UPH 11, HOSPITAL 2... (o escribe una nueva)"
                  />
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[10px] text-amber-700 font-medium">
                      💡 Elige de la lista o <strong>escribe una nueva</strong>.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditLocation("FALLECIDO");
                        if (!editPendientes) setEditPendientes("Felino fallecido en albergue");
                      }}
                      className="px-2 py-0.5 bg-slate-900 hover:bg-black text-rose-300 rounded-lg text-[10px] font-black shrink-0 transition-all"
                    >
                      🕊️ Marcar FALLECIDO
                    </button>
                  </div>
                  <datalist id="scanner-locations-list">
                    {locationsList.map((loc) => (
                      <option key={loc} value={loc} />
                    ))}
                  </datalist>
                </div>
                {currentAnimal.species === "gato" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold text-slate-700">Modificar Color Oficial (Columna H):</label>
                      <span className="text-[10px] text-purple-800 font-bold bg-purple-100 px-2 py-0.5 rounded-full">
                        {OFFICIAL_GATERA_COLORS.length} Colores Oficiales
                      </span>
                    </div>
                    <input
                      type="text"
                      list="scanner-colors-list"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value.toUpperCase())}
                      className="w-full p-2.5 bg-white border border-purple-300 rounded-xl font-bold uppercase text-purple-950"
                      placeholder="Ej. TABBY PARDO X BLANCO, CAREY, NEGRO..."
                    />
                  </div>
                )}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Modificar Medicación:</label>
                  <textarea
                    rows={2}
                    value={editMedication}
                    onChange={(e) => setEditMedication(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl"
                  />
                </div>
                {currentAnimal.species === "gato" && (
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                        <Camera className="w-4 h-4 text-purple-700" /> Fotografía del Felino:
                      </label>
                      <span className="text-[10px] text-purple-800 font-bold">
                        {currentAnimal.photoUrl ? "Foto actual cargada" : "Sin foto"}
                      </span>
                    </div>
                    {currentAnimal.photoUrl ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={currentAnimal.photoUrl}
                          alt="Foto actual"
                          className="w-12 h-12 object-cover rounded-xl border border-purple-300 shadow-xs shrink-0"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isUploadingPhoto}
                            onClick={() => setIsPhotoModalOpen(true)}
                            className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <Camera className="w-3 h-3" /> Tomar / Cambiar
                          </button>
                          <button
                            type="button"
                            disabled={isUploadingPhoto}
                            onClick={handleDeletePhoto}
                            className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Borrar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isUploadingPhoto}
                        onClick={() => setIsPhotoModalOpen(true)}
                        className="w-full py-2 px-3 border border-dashed border-purple-300 hover:border-purple-500 bg-white rounded-xl text-purple-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Camera className="w-4 h-4 text-purple-700" />
                        <span>📷 Tomar Foto con Cámara o Subir Archivo</span>
                      </button>
                    )}
                  </div>
                )}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Modificar Pendientes:</label>
                  <input
                    type="text"
                    value={editPendientes}
                    onChange={(e) => setEditPendientes(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="w-1/2 py-2.5 bg-slate-200 rounded-xl font-bold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveQuickEdit}
                    className="w-1/2 py-2.5 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-1 shadow-md"
                  >
                    <Save className="w-4 h-4" /> Guardar en Planilla
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Modificar o reubicar animal (Vet/Admin)
                </button>
              </div>
            )
          )}

          {/* 2.5 Semáforo Clínico de Tratamientos y Control de Vencimientos */}
          {animalTreatments.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                  <Pill className="w-4 h-4 text-indigo-600" /> Semáforo Clínico de Tratamientos
                </span>
                <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                  {animalTreatments.length} prescripciones
                </span>
              </div>

              <div className="space-y-2">
                {animalTreatments.map((t) => {
                  const isExpiredOrDone = t.status === "finalizado" || t.dosisFaltantes === 0;
                  const isUrgent = t.status === "activo" && t.dosisFaltantes === 1;

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                        isExpiredOrDone
                          ? "bg-red-50/70 border-red-200"
                          : isUrgent
                          ? "bg-amber-50 border-amber-300"
                          : "bg-white border-slate-200"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              isExpiredOrDone
                                ? "bg-red-500"
                                : isUrgent
                                ? "bg-amber-500 animate-pulse"
                                : "bg-emerald-500"
                            }`}
                          />
                          <span className="font-bold text-slate-900">{t.treatment}</span>
                          <span
                            className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                              isExpiredOrDone
                                ? "bg-red-200 text-red-900"
                                : isUrgent
                                ? "bg-amber-200 text-amber-950 font-black"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {isExpiredOrDone
                              ? "🔴 Culminado / Requiere Alta"
                              : isUrgent
                              ? "🟡 Última Dosis Hoy"
                              : "🟢 En Curso"}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          Dosis: <strong>{t.dosisAplicadas}</strong> / {t.dosisTotales} • Faltan:{" "}
                          <strong>{t.dosisFaltantes}</strong> • Vence: {t.endDate || "HNI"}
                        </span>
                      </div>

                      {(currentUser?.role === "veterinario" || currentUser?.role === "admin") && t.status === "activo" && (
                        <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                          <button
                            type="button"
                            onClick={() => handleExtendTreatment(t.id, 7)}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-lg font-black text-[10px] border border-indigo-200 active:scale-95"
                            title="Extender 7 días adicionales"
                          >
                            +7 Días
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDischargeTreatment(t.id)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-black text-[10px] border border-emerald-200 active:scale-95"
                            title="Culminar tratamiento y dar alta médica"
                          >
                            Dar Alta
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. BOTONES DE ACCIÓN RÁPIDA (Flujo ergonómico) */}
          <div className="space-y-2.5 pt-2">
            {/* Botón Principal: ASIGNAR ANIMAL */}
            <button
              type="button"
              onClick={() => setIsAssignModalOpen(true)}
              className="btn-touch w-full py-4 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-500 hover:to-indigo-600 text-white flex items-center justify-center gap-2.5 shadow-xl shadow-teal-700/25 active:scale-95 transition-all"
            >
              <UserCheck className="w-5 h-5 text-emerald-200" />
              <span>🐾 ASIGNAR ESTE ANIMAL A OPERARIO / AUXILIAR</span>
            </button>

            {/* Botón de Impresión de Ficha y QR de Canil */}
            <button
              type="button"
              onClick={() => setIsCanilCardOpen(true)}
              className="btn-touch w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-slate-900 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 text-white flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-950/20 active:scale-95 transition-all"
            >
              <Printer className="w-4 h-4 text-indigo-300" />
              <span>🖨️ IMPRIMIR FICHA DE CANIL & CÓDIGO QR</span>
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleConfirmCensus}
                disabled={censusConfirmed}
                className={`btn-touch w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                  censusConfirmed
                    ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25 active:scale-95"
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                {censusConfirmed ? "CENSO REGISTRADO" : "CONFIRMAR CENSO OK"}
              </button>

              <button
                type="button"
                onClick={() => setIsVoiceOpen(true)}
                className="btn-touch w-full py-3.5 px-4 rounded-2xl font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
              >
                <Mic className="w-5 h-5" />
                <span>DICTAR POR VOZ (IA)</span>
              </button>
            </div>

            {censusConfirmed && (
              <button
                type="button"
                onClick={handleResetToNextScan}
                className="btn-touch w-full py-4 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-800 hover:from-emerald-700 hover:to-teal-800 text-white flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 active:scale-95 transition-all animate-pulse"
              >
                <Scan className="w-5 h-5 text-emerald-200" />
                <span>LISTO PARA SIGUIENTE FELINO (W91A PREPARADO) ➔</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chip No Encontrado - Opción de Registro Completo en Base de Datos y Censo */}
      {notFound && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-amber-300 text-center space-y-4 animate-in fade-in zoom-in-95">
          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-3xl flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-3 py-1 rounded-full inline-block mb-1.5">
              MICROCHIP NO REGISTRADO EN EL CENSO
            </span>
            <h3 className="text-xl font-mono font-black text-slate-900 tracking-wider">
              {chipInput}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Este animal no figura en el censo ni en las planillas oficiales. Puedes registrarlo con todos sus datos clínicos, ubicación física y medicación.
            </p>
          </div>

          <div className="space-y-2.5 pt-1 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                setPreselectedSpecies("gato");
                setIsRegisterOpen(true);
              }}
              className="btn-touch w-full py-4 px-5 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-purple-700/25 active:scale-95 transition-all"
            >
              <PlusCircle className="w-5 h-5 text-purple-200" />
              <span>🐱 INGRESAR FELINO EN CENSO GATERA (24 COLUMNAS)</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal de Voz IA */}
      <VoiceModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        currentMicrochip={currentAnimal?.microchip}
        onApplyIntent={handleApplyVoiceIntent}
      />

      {/* Modal de Asignación de Animal a Operario / Auxiliar */}
      {currentAnimal && (
        <AssignAnimalModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          initialAnimal={{
            microchip: currentAnimal.microchip,
            name: currentAnimal.name,
            location: currentAnimal.location,
            species: "gato",
            isFeral: currentAnimal.isFeral,
            medication: shelterEntries[0]?.medicacion,
            notes: shelterEntries[0]?.pendientes,
          }}
          userArea="gatera"
          onSuccess={(task) => {
            setFeedbackMessage(`🐾 ${currentAnimal.name} asignado a ${task.assignedTo || "personal de Gatera"} para turno ${task.shift}`);
            if (typeof window !== "undefined" && "vibrate" in navigator) {
              navigator.vibrate([100, 50, 100]);
            }
          }}
        />
      )}

      {/* Modal de Subida en Masa de Memoria W91A */}
      <BatchScannerModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        currentUser={currentUser}
        onBatchProcessed={(stats) => {
          setFeedbackMessage(
            `⚡ Lote W91A completado: ${stats.total} leídos, ${stats.censused} censados, ${stats.medicated} medicaciones aplicadas.`
          );
        }}
      />

      {/* Modal de Ficha Médica de Canil & Código QR Imprimible */}
      {currentAnimal && (
        <CanilCardModal
          isOpen={isCanilCardOpen}
          onClose={() => setIsCanilCardOpen(false)}
          animal={currentAnimal}
          treatments={animalTreatments}
          location={currentAnimal.location}
          notes={shelterEntries[0]?.pendientes}
        />
      )}

      {/* Modal de Registro Completo de Animal Nuevo en Sistema y Censo */}
      <RegisterNewAnimalModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        initialMicrochip={chipInput}
        defaultArea="gatera"
        currentUser={currentUser}
        onAnimalRegistered={(animal) => {
          setNotFound(false);
          setFeedbackMessage(
            `✨ ¡${animal.name} (Felino) registrado y censado exitosamente en ${animal.location}!`
          );
          handleSearch(animal.microchip);
        }}
      />
      {/* Lightbox / Visualizador de Fotografía a Pantalla Completa */}
      {selectedPhotoPreview && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md p-4 flex flex-col items-center justify-center animate-in fade-in"
          onClick={() => setSelectedPhotoPreview(null)}
        >
          <div
            className="relative max-w-lg w-full bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col items-center space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐱</span>
                <div>
                  <h4 className="font-black text-sm text-slate-100">
                    {currentAnimal?.name || "Felino"} ({currentAnimal?.color || currentAnimal?.breed || "GATERA"})
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Chip: {currentAnimal?.shortChip || currentAnimal?.microchip} • Ubicación: {currentAnimal?.location}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPhotoPreview(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
                title="Cerrar visor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-full max-h-[65vh] flex items-center justify-center overflow-hidden rounded-2xl bg-black">
              <img
                src={selectedPhotoPreview}
                alt="Fotografía completa del felino"
                className="max-h-[65vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>

            <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
              <button
                type="button"
                disabled={isUploadingPhoto}
                onClick={() => {
                  setSelectedPhotoPreview(null);
                  setIsPhotoModalOpen(true);
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Camera className="w-4 h-4" /> Tomar / Cambiar Fotografía
              </button>
              <button
                type="button"
                disabled={isUploadingPhoto}
                onClick={handleDeletePhoto}
                className="px-3.5 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
              >
                <Trash2 className="w-4 h-4" /> Eliminar Fotografía
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dedicado de Cámara y Captura de Fotos para Felinos Existentes */}
      <PhotoCaptureModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        currentPhotoUrl={currentAnimal?.photoUrl}
        animalName={currentAnimal ? `${currentAnimal.name} (${currentAnimal.microchip})` : "Felino"}
        title="Fotografía del Felino"
        onPhotoCaptured={(base64) => {
          saveAnimalPhoto(base64);
        }}
        onPhotoDeleted={() => {
          handleDeletePhoto();
        }}
      />

      {/* Barra Flotante Inferior para Escaneo Rápido de Siguiente Felino */}
      {currentAnimal && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-md bg-slate-900/95 backdrop-blur-md text-white p-2.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3">
          <div className="min-w-0 pl-1">
            <span className="text-[10px] text-slate-400 block font-semibold">Listo para otro chip</span>
            <span className="text-xs font-black truncate block text-slate-100">{currentAnimal.name}</span>
          </div>
          <button
            type="button"
            onClick={handleResetToNextScan}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md transition-all shrink-0"
            title="Preparar el buscador para el siguiente chip"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-200" />
            <span>Escanear Siguiente</span>
          </button>
        </div>
      )}
    </div>
  );
};
