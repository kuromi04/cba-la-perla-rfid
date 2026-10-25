"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  StaffMember,
  getAllStaff,
  getFieldStaff,
  updateStaffPin,
  updateStaffMember,
  deleteStaffMember,
  registerStaffMember,
  verifyAdminKey,
  MASTER_ADMIN,
} from "@/lib/staff";
import { getAuditLogs, getAuditStatsByUser, UserAuditStat, recordAudit } from "@/lib/audit";
import { AuditLogEntry, db, Animal, KardexRecord, ShiftTask, syncAnimalsBidirectional } from "@/lib/db";
import { isSupabaseConfigured, syncAnimalToSupabase, deleteAnimalFromSupabase } from "@/lib/supabase";
import { computeEdaAnalysis, exportEdaExcelReport, EdaSummary } from "@/lib/edaAnalysis";
import { OFFICIAL_GATERA_LOCATIONS, getAllGateraLocations } from "@/lib/gateraLocations";
import { OFFICIAL_GATERA_COLORS } from "@/lib/gateraColors";
import {
  ShieldAlert,
  Users,
  FileSpreadsheet,
  Activity,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Search,
  RefreshCw,
  Trash2,
  X,
  Clock,
  UserCheck,
  Stethoscope,
  Filter,
  Download,
  Database,
  ArrowRight,
  BarChart3,
  PieChart,
  PlusCircle,
  Edit3,
  Save,
  FileDown,
  Upload,
  Layers,
  Pill,
  Calendar,
  MapPin,
  Printer,
  HeartPulse,
  Eye,
  Check,
} from "lucide-react";

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdminAuthenticated?: () => void;
  onOpenRegisterNewAnimal?: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  onOpenRegisterNewAnimal,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // Pestañas del Dashboard
  const [activeTab, setActiveTab] = useState<
    "eda" | "animals" | "kardex" | "shifts" | "stats" | "audit" | "staff" | "system"
  >("eda");

  // Datos del Dashboard
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [edaSummary, setEdaSummary] = useState<EdaSummary | null>(null);
  const [userStats, setUserStats] = useState<UserAuditStat[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [animalsList, setAnimalsList] = useState<Animal[]>([]);
  const [kardexList, setKardexList] = useState<KardexRecord[]>([]);
  const [shiftTasksList, setShiftTasksList] = useState<ShiftTask[]>([]);
  const [locationsList, setLocationsList] = useState<string[]>(OFFICIAL_GATERA_LOCATIONS);

  // Estados de Búsqueda y Filtros
  const [animalSearch, setAnimalSearch] = useState("");
  const [animalFilterLocation, setAnimalFilterLocation] = useState("TODAS");
  const [kardexSearch, setKardexSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState("TODOS");
  const [searchAuditQuery, setSearchAuditQuery] = useState("");
  const [filterAction, setFilterAction] = useState<string>("TODAS");
  const [filterUser, setFilterUser] = useState<string>("TODOS");

  // Modales y Formularios Inline de Administración
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [editingKardex, setEditingKardex] = useState<KardexRecord | null>(null);
  const [isNewKardexOpen, setIsNewKardexOpen] = useState(false);
  const [isNewStaffOpen, setIsNewStaffOpen] = useState(false);
  const [isNewShiftOpen, setIsNewShiftOpen] = useState(false);

  // Formularios de Creación
  const [newStaffForm, setNewStaffForm] = useState({
    name: "",
    role: "auxiliar" as "veterinario" | "auxiliar" | "operario",
    email: "",
    pin: "",
    specialty: "",
  });

  const [newKardexForm, setNewKardexForm] = useState({
    microchip: "",
    treatment: "",
    system: "TEGUMEN",
    dosisTotales: 7,
    notes: "",
    prescribedBy: "Dra. Jenny Zapata Calle",
  });

  const [newShiftForm, setNewShiftForm] = useState({
    microchip: "",
    animalName: "",
    location: "CUARENTENA 1",
    laborType: "medicacion" as "medicacion" | "limpieza" | "baño" | "nebulizacion",
    shift: "mañana" as "mañana" | "tarde" | "noche",
    assignedTo: "",
    medication: "",
    notes: "",
  });

  // Estado para reset y edición de personal
  const [resetPinUserId, setResetPinUserId] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState("");
  const [editingStaffMember, setEditingStaffMember] = useState<StaffMember | null>(null);
  const [editStaffForm, setEditStaffForm] = useState({
    name: "",
    role: "veterinario" as "veterinario" | "auxiliar" | "operario",
    specialty: "",
    email: "",
    phone: "",
    pin: "",
  });

  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  const refreshAllData = async () => {
    setLoading(true);
    try {
      const [
        eda,
        stats,
        logs,
        staff,
        allAnimals,
        allKardex,
        allShifts,
        allLocations,
      ] = await Promise.all([
        computeEdaAnalysis(),
        getAuditStatsByUser(),
        getAuditLogs(300),
        getFieldStaff(),
        db.animals.toArray(),
        db.kardex.reverse().toArray(),
        db.shiftTasks.reverse().toArray(),
        getAllGateraLocations(),
      ]);

      setEdaSummary(eda);
      setUserStats(stats);
      setAuditLogs(logs);
      setStaffList(staff);
      setAnimalsList(allAnimals);
      setKardexList(allKardex);
      setShiftTasksList(allShifts);
      setLocationsList(allLocations);
    } catch (err) {
      console.warn("Error cargando datos del dashboard de admin:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const savedAuth = sessionStorage.getItem("cba_admin_auth");
      if (savedAuth === "true") {
        setIsAuthenticated(true);
        refreshAllData();
      } else {
        setIsAuthenticated(false);
        setAdminPin("");
        setAuthError(null);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyAdminKey(adminPin)) {
      setIsAuthenticated(true);
      sessionStorage.setItem("cba_admin_auth", "true");
      setAuthError(null);
      refreshAllData();
    } else {
      setAuthError("Clave o PIN maestro de Administrador incorrecto.");
    }
  };

  const handleLogoutAdmin = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("cba_admin_auth");
    setAdminPin("");
  };

  // --- ACCIONES DE EXPORTACIÓN EDA ---
  const handleExportEdaExcel = async () => {
    if (!edaSummary) return;
    setLoading(true);
    try {
      await exportEdaExcelReport(edaSummary);
      setFeedback("📊 Informe EDA oficial generado y descargado con éxito.");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err) {
      console.error("Error al exportar EDA:", err);
      alert("No se pudo generar el archivo de informe EDA.");
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD DE ANIMALES ---
  const handleSaveAnimalEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnimal || !editingAnimal.id) return;
    setLoading(true);
    try {
      const chip = editingAnimal.microchip.trim().toUpperCase();
      const nowIso = new Date().toISOString();
      const updatedData: Animal = {
        ...editingAnimal,
        microchip: chip,
        location: editingAnimal.location.trim().toUpperCase(),
        updatedAt: nowIso,
        updatedBy: "Administrador Maestro",
        updatedById: MASTER_ADMIN.id,
      };

      await db.animals.update(editingAnimal.id, updatedData);

      // Actualizar en db.gateraRecords
      const catRec = await db.gateraRecords.where("microchip").equals(chip).first();
      if (catRec && catRec.id) {
        await db.gateraRecords.update(catRec.id, {
          ubicacion: updatedData.location,
          color: updatedData.color || "",
          raza: updatedData.breed || "DPC",
          sexoCode: updatedData.sexoCode || "MFA",
          condicionCorporal: updatedData.condicionCorporal || "",
          estadoSalud: updatedData.estadoSalud || "",
          medicacion: updatedData.notes || "",
          observacionesMedicas: updatedData.observacionesMedicas || "",
          medicoVeterinario: updatedData.medicoVeterinario || "",
        });
      }

      await recordAudit({
        action: "MODIFICACION_ANIMAL",
        microchip: chip,
        animalName: updatedData.name,
        location: updatedData.location,
        details: `Parámetros modificados desde Dashboard de Administración`,
        user: MASTER_ADMIN,
      });

      if (typeof window !== "undefined" && navigator.onLine) {
        syncAnimalToSupabase(updatedData).catch(console.warn);
      }

      setFeedback(`✅ Animal ${chip} actualizado con éxito.`);
      setEditingAnimal(null);
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error al actualizar animal: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDeceased = async (animal: Animal) => {
    const confirmDecease = window.confirm(
      `¿Confirmas el registro de baja por defunción para el felino ${animal.name} (${animal.microchip})?\nSe descontará del censo activo y se registrará en la hoja MUERTES.`
    );
    if (!confirmDecease) return;

    const cause = window.prompt("Ingresa la causa de defunción / diagnóstico final:", "Paro cardiorrespiratorio / Shock") || "Defunción";

    setLoading(true);
    try {
      const chip = animal.microchip.trim().toUpperCase();
      const nowIso = new Date().toISOString();
      const today = nowIso.split("T")[0];

      if (animal.id) {
        await db.animals.update(animal.id, {
          location: "FALLECIDO",
          status: "fallecido",
          fechaFallecimiento: today,
          causaFallecimiento: cause,
          ubicacionPrevia: animal.location,
          updatedAt: nowIso,
          updatedBy: "Administrador Maestro",
        });
      }

      const catRec = await db.gateraRecords.where("microchip").equals(chip).first();
      if (catRec && catRec.id) {
        await db.gateraRecords.update(catRec.id, {
          ubicacion: "FALLECIDO",
          status: "fallecido",
          fechaFallecimiento: today,
          causaFallecimiento: cause,
          ubicacionPrevia: catRec.ubicacion,
          updatedAt: nowIso,
        });
      }

      // Eliminar de censo activo
      const censusEntries = await db.census.where("microchip").equals(chip).toArray();
      for (const ce of censusEntries) {
        if (ce.id) await db.census.delete(ce.id);
      }

      await recordAudit({
        action: "BAJA_FALLECIDO",
        microchip: chip,
        animalName: animal.name,
        location: "FALLECIDO",
        details: `Baja por defunción registrada por Admin. Causa: ${cause}`,
        user: MASTER_ADMIN,
      });

      setFeedback(`🕊️ Felino ${chip} registrado en MUERTES y retirado del censo.`);
      setEditingAnimal(null);
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      alert(`Error al registrar defunción: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnimalStrict = async (animal: Animal) => {
    const confirmStrict = window.prompt(
      `⚠️ ATENCIÓN: Esta acción eliminará permanentemente al animal de la base de datos y de la nube.\nEscribe "ELIMINAR" para confirmar el borrado de ${animal.microchip}:`
    );
    if (confirmStrict !== "ELIMINAR") return;

    setLoading(true);
    try {
      const chip = animal.microchip.trim().toUpperCase();

      if (animal.id) await db.animals.delete(animal.id);
      const catRec = await db.gateraRecords.where("microchip").equals(chip).first();
      if (catRec?.id) await db.gateraRecords.delete(catRec.id);

      // Limpiar Kardex y tareas asociadas
      const kards = await db.kardex.where("microchip").equals(chip).toArray();
      for (const k of kards) {
        if (k.id) await db.kardex.delete(k.id);
      }
      const tasks = await db.shiftTasks.where("microchip").equals(chip).toArray();
      for (const t of tasks) {
        if (t.id) await db.shiftTasks.delete(t.id);
      }

      // Eliminar de Supabase
      if (typeof window !== "undefined" && navigator.onLine) {
        deleteAnimalFromSupabase(chip).catch(console.warn);
      }

      await recordAudit({
        action: "MODIFICACION_ANIMAL",
        microchip: chip,
        animalName: animal.name,
        location: animal.location,
        details: `Eliminación permanente ejecutada desde Dashboard de Administración`,
        user: MASTER_ADMIN,
      });

      setFeedback(`🗑️ Registro ${chip} eliminado permanentemente.`);
      setEditingAnimal(null);
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error al eliminar registro: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // --- CRUD DE KARDEX ---
  const handleCreateKardex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKardexForm.microchip.trim() || !newKardexForm.treatment.trim()) {
      alert("Por favor ingresa microchip y tratamiento.");
      return;
    }
    setLoading(true);
    try {
      const chip = newKardexForm.microchip.trim().toUpperCase();
      const nowIso = new Date().toISOString();
      const doses = Number(newKardexForm.dosisTotales) || 7;

      const animal = await db.animals.where("microchip").equals(chip).first();

      const kardexId = await db.kardex.add({
        microchip: chip,
        shortChip: chip.slice(-7),
        system: newKardexForm.system,
        treatment: newKardexForm.treatment.trim(),
        description: newKardexForm.notes || "Prescripción directa de administración",
        startDate: nowIso.split("T")[0],
        endDate: new Date(Date.now() + doses * 86400000).toISOString().split("T")[0],
        status: "activo",
        prescribedBy: newKardexForm.prescribedBy,
        createdAt: nowIso,
        area: "gatera",
        dosisTotales: doses,
        dosisAplicadas: 0,
        dosisFaltantes: doses,
      });

      // Crear tarea de turno inicial
      await db.shiftTasks.add({
        microchip: chip,
        animalName: animal?.name || "Felino GATERA",
        location: animal?.location || "GATERA",
        species: "gato",
        laborType: "medicacion",
        shift: "mañana",
        isCompleted: false,
        medication: newKardexForm.treatment.trim(),
        scheduledDate: nowIso.split("T")[0],
        area: "gatera",
        kardexId: Number(kardexId),
        dosisTotales: doses,
        dosisAplicadas: 0,
        dosisFaltantes: doses,
        notes: newKardexForm.notes || "Tratamiento instaurado por administración",
      });

      await recordAudit({
        action: "TRATAMIENTO_PRESCRITO",
        microchip: chip,
        animalName: animal?.name,
        location: animal?.location,
        details: `Prescripción instaurada: ${newKardexForm.treatment} (${doses} dosis)`,
        user: MASTER_ADMIN,
      });

      setFeedback(`💊 Tratamiento para ${chip} creado en Kardex y programado.`);
      setIsNewKardexOpen(false);
      setNewKardexForm({
        microchip: "",
        treatment: "",
        system: "TEGUMEN",
        dosisTotales: 7,
        notes: "",
        prescribedBy: "Dra. Jenny Zapata Calle",
      });
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error al crear prescripción: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKardexStatus = async (item: KardexRecord) => {
    if (!item.id) return;
    const nextStatus = item.status === "activo" ? "suspendido" : "activo";
    await db.kardex.update(item.id, { status: nextStatus });
    setFeedback(`Tratamiento marcado como ${nextStatus.toUpperCase()}.`);
    await refreshAllData();
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleDeleteKardex = async (item: KardexRecord) => {
    if (!item.id) return;
    if (!window.confirm(`¿Seguro que deseas eliminar la prescripción "${item.treatment}" para ${item.microchip}?`)) return;
    await db.kardex.delete(item.id);
    setFeedback(`🗑️ Tratamiento eliminado del Kardex.`);
    await refreshAllData();
    setTimeout(() => setFeedback(null), 2500);
  };

  // --- CRUD DE TAREAS DE TURNO ---
  const handleCreateShiftTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftForm.microchip.trim()) {
      alert("Por favor ingresa microchip.");
      return;
    }
    setLoading(true);
    try {
      const chip = newShiftForm.microchip.trim().toUpperCase();
      const animal = await db.animals.where("microchip").equals(chip).first();

      await db.shiftTasks.add({
        microchip: chip,
        animalName: newShiftForm.animalName || animal?.name || "Felino",
        location: newShiftForm.location || animal?.location || "CUARENTENA 1",
        species: "gato",
        laborType: newShiftForm.laborType,
        shift: newShiftForm.shift,
        isCompleted: false,
        medication: newShiftForm.medication,
        scheduledDate: new Date().toISOString().split("T")[0],
        area: "gatera",
        assignedTo: newShiftForm.assignedTo || undefined,
        notes: newShiftForm.notes,
      });

      setFeedback(`📋 Tarea de turno asignada a ${chip}.`);
      setIsNewShiftOpen(false);
      setNewShiftForm({
        microchip: "",
        animalName: "",
        location: "CUARENTENA 1",
        laborType: "medicacion",
        shift: "mañana",
        assignedTo: "",
        medication: "",
        notes: "",
      });
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error al crear tarea: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleShiftTask = async (task: ShiftTask) => {
    if (!task.id) return;
    const nextCompleted = !task.isCompleted;
    await db.shiftTasks.update(task.id, {
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? new Date().toISOString() : undefined,
      completedBy: nextCompleted ? "Admin Dirección" : undefined,
    });
    await refreshAllData();
  };

  const handleDeleteShiftTask = async (task: ShiftTask) => {
    if (!task.id) return;
    if (!window.confirm("¿Seguro que deseas eliminar esta tarea de turno?")) return;
    await db.shiftTasks.delete(task.id);
    setFeedback("🗑️ Tarea de turno eliminada.");
    await refreshAllData();
    setTimeout(() => setFeedback(null), 2000);
  };

  // --- CRUD DE PERSONAL ---
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.name.trim()) {
      alert("Por favor ingresa el nombre del funcionario.");
      return;
    }
    setLoading(true);
    try {
      await registerStaffMember({
        name: newStaffForm.name.trim(),
        role: newStaffForm.role,
        email: newStaffForm.email.trim() || undefined,
        pin: newStaffForm.pin.trim() || undefined,
        specialty: newStaffForm.specialty.trim() || undefined,
      });

      setFeedback(`👤 Funcionario ${newStaffForm.name} registrado con éxito.`);
      setIsNewStaffOpen(false);
      setNewStaffForm({
        name: "",
        role: "auxiliar",
        email: "",
        pin: "",
        specialty: "",
      });
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error al registrar funcionario: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (userId: string) => {
    if (!newPinValue.trim() || newPinValue.trim().length < 4) {
      alert("El PIN debe tener al menos 4 dígitos numéricos.");
      return;
    }
    const success = await updateStaffPin(userId, newPinValue.trim());
    if (success) {
      setFeedback("✅ PIN actualizado con éxito.");
      setResetPinUserId(null);
      setNewPinValue("");
      await refreshAllData();
      setTimeout(() => setFeedback(null), 3000);
    } else {
      alert("No se pudo actualizar el PIN.");
    }
  };

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!window.confirm(`¿Seguro que deseas eliminar el acceso a ${name}?`)) return;
    await deleteStaffMember(id);
    setFeedback(`🗑️ Usuario ${name} eliminado.`);
    await refreshAllData();
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleStartEditStaff = (staff: StaffMember) => {
    setEditingStaffMember(staff);
    setEditStaffForm({
      name: staff.name,
      role: staff.role === "admin" ? "veterinario" : staff.role,
      specialty: staff.specialty || "",
      email: staff.email || "",
      phone: staff.phone || "",
      pin: staff.pin || "",
    });
  };

  const handleSaveStaffEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaffMember || !editStaffForm.name.trim()) return;

    if (editStaffForm.pin.trim() && editStaffForm.pin.trim().length < 4) {
      alert("El PIN debe tener al menos 4 dígitos numéricos.");
      return;
    }

    setLoading(true);
    try {
      const updated = await updateStaffMember(editingStaffMember.id, {
        name: editStaffForm.name.trim(),
        role: editStaffForm.role,
        specialty: editStaffForm.specialty.trim() || undefined,
        email: editStaffForm.email.trim() || undefined,
        phone: editStaffForm.phone.trim() || undefined,
        pin: editStaffForm.pin.trim() || undefined,
      });

      if (updated) {
        setFeedback(`✅ Funcionario ${updated.name} actualizado con éxito.`);
        setEditingStaffMember(null);
        await refreshAllData();
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err: any) {
      alert("Error al actualizar funcionario: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  // --- BACKUP Y RESTAURACIÓN DEL SISTEMA ---
  const handleExportFullBackup = async () => {
    setLoading(true);
    try {
      const [
        animals,
        kardex,
        shiftTasks,
        census,
        staff,
        auditLogs,
        gateraRecords,
      ] = await Promise.all([
        db.animals.toArray(),
        db.kardex.toArray(),
        db.shiftTasks.toArray(),
        db.census.toArray(),
        db.staff.toArray(),
        db.auditLogs.toArray(),
        db.gateraRecords.toArray(),
      ]);

      const backupObject = {
        app: "CBA_LA_PERLA_SHELTER_SYSTEM",
        version: 7,
        exportedAt: new Date().toISOString(),
        totalRecords: animals.length,
        data: {
          animals,
          kardex,
          shiftTasks,
          census,
          staff,
          auditLogs,
          gateraRecords,
        },
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObject, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `CBA_LAPERLA_BACKUP_COMPLETO_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setFeedback("💾 Copia de seguridad completa JSON descargada con éxito.");
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(`Error al generar copia de seguridad: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackupFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmRestore = window.prompt(
      "⚠️ RESTAURACIÓN DE BASE DE DATOS:\nEsta acción importará y sobreescribirá los registros de la copia de seguridad seleccionada.\nEscribe 'RESTAURAR' para proceder:"
    );
    if (confirmRestore !== "RESTAURAR") return;

    setLoading(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup.data || !Array.isArray(backup.data.animals)) {
        throw new Error("El archivo no tiene la estructura de copia de seguridad válida de CBA La Perla.");
      }

      // Importar en Dexie
      if (backup.data.animals?.length > 0) await db.animals.bulkPut(backup.data.animals);
      if (backup.data.kardex?.length > 0) await db.kardex.bulkPut(backup.data.kardex);
      if (backup.data.shiftTasks?.length > 0) await db.shiftTasks.bulkPut(backup.data.shiftTasks);
      if (backup.data.census?.length > 0) await db.census.bulkPut(backup.data.census);
      if (backup.data.gateraRecords?.length > 0) await db.gateraRecords.bulkPut(backup.data.gateraRecords);
      if (backup.data.staff?.length > 0) await db.staff.bulkPut(backup.data.staff);

      setFeedback(`🎉 Base de datos restaurada con éxito: ${backup.data.animals.length} animales procesados.`);
      await refreshAllData();
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: any) {
      alert(`Error al restaurar copia de seguridad: ${err?.message || err}`);
    } finally {
      setLoading(false);
      if (restoreFileInputRef.current) restoreFileInputRef.current.value = "";
    }
  };

  const handleForceFullSync = async () => {
    setLoading(true);
    try {
      const res = await syncAnimalsBidirectional();
      setFeedback(`☁️ Sincronización completada: ⬇️ ${res.pulled} descargados, ⬆️ ${res.pushed} subidos a Supabase.`);
      await refreshAllData();
    } catch (e: any) {
      setFeedback(`⚠️ Error al sincronizar: ${e?.message || "Fallo de conexión"}`);
    } finally {
      setLoading(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Filtros de Animales
  const filteredAnimals = animalsList.filter((a) => {
    const q = animalSearch.toLowerCase().trim();
    const matchSearch =
      q === "" ||
      a.microchip.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      (a.location && a.location.toLowerCase().includes(q)) ||
      (a.hc && a.hc.toLowerCase().includes(q));

    const matchLocation =
      animalFilterLocation === "TODAS" ||
      (a.location && a.location.trim().toUpperCase() === animalFilterLocation);

    return matchSearch && matchLocation;
  });

  // Filtros de Kardex
  const filteredKardex = kardexList.filter((k) => {
    const q = kardexSearch.toLowerCase().trim();
    return (
      q === "" ||
      k.microchip.toLowerCase().includes(q) ||
      k.treatment.toLowerCase().includes(q) ||
      k.system.toLowerCase().includes(q) ||
      k.prescribedBy.toLowerCase().includes(q)
    );
  });

  // Filtros de Tareas
  const filteredShifts = shiftTasksList.filter((s) => {
    if (shiftFilter === "TODOS") return true;
    if (shiftFilter === "PENDIENTES") return !s.isCompleted;
    if (shiftFilter === "COMPLETADAS") return s.isCompleted;
    return s.shift === shiftFilter;
  });

  // Filtros de Auditoría
  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      searchAuditQuery === "" ||
      log.microchip.toLowerCase().includes(searchAuditQuery.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchAuditQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchAuditQuery.toLowerCase()) ||
      (log.animalName && log.animalName.toLowerCase().includes(searchAuditQuery.toLowerCase()));

    const matchAction = filterAction === "TODAS" || log.action === filterAction;
    const matchUser = filterUser === "TODOS" || log.userId === filterUser || log.userName === filterUser;

    return matchSearch && matchAction && matchUser;
  });

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md p-1 sm:p-4 flex items-center justify-center animate-in fade-in overscroll-contain">
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-purple-200 flex flex-col max-h-[96dvh] sm:max-h-[92vh]">
        
        {/* Cabecera del Dashboard */}
        <div className="p-4 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/30 text-purple-300 rounded-xl border border-purple-500/40">
              <ShieldAlert className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base leading-tight">
                  Centro de Control y Administración Total
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-purple-900 text-purple-200 border border-purple-700">
                  Dirección CBA La Perla
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Gestión total de Animales, Kardex, Turnos, Personal, Auditoría y Análisis Exploratorio de Datos (EDA)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogoutAdmin}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-800"
              >
                Cerrar Sesión Admin
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Cerrar panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        {!isAuthenticated ? (
          /* PANTALLA DE ACCESO PROTEGIDO */
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-purple-100 text-purple-800 flex items-center justify-center border-2 border-purple-200 shadow-sm">
              <Lock className="w-8 h-8 text-purple-700" />
            </div>

            <div>
              <h4 className="text-xl font-black text-slate-900">
                Acceso Exclusivo de Administrador Maestro
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Para garantizar la integridad y trazabilidad legal de los registros, ingresa la clave de dirección.
              </p>
            </div>

            {authError && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="w-full max-w-xs space-y-3 pt-2">
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  autoFocus
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="PIN o Clave de Administrador"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-center font-mono font-black text-lg text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-700/25 transition-all"
              >
                <span>Desbloquear Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          /* PANEL DESBLOQUEADO CON NAVEGACIÓN TOTAL */
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Feedback Message */}
            {feedback && (
              <div className="p-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between px-4 animate-in fade-in shrink-0">
                <span>{feedback}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            )}

            {/* Pestañas de Navegación del Dashboard */}
            <div className="flex border-b border-slate-200 bg-slate-100 p-2 gap-1 shrink-0 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("eda")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "eda"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>📊 Análisis Exploratorio (EDA)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("animals")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "animals"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>🐱 Animales / Censo ({animalsList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("kardex")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "kardex"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Pill className="w-3.5 h-3.5" />
                <span>💊 Kardex Tratamientos ({kardexList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("shifts")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "shifts"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>📋 Turnos de Campo ({shiftTasksList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("stats")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "stats"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>👥 Actividad por Usuario</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("staff")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "staff"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>🔐 Personal / PINs ({staffList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("audit")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "audit"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>🛡️ Auditoría ({auditLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("system")}
                className={`px-3 py-2 rounded-xl font-black flex items-center gap-1.5 transition-all shrink-0 ${
                  activeTab === "system"
                    ? "bg-purple-700 text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>⚙️ Base de Datos & Backup</span>
              </button>

              <div className="ml-auto flex items-center">
                <button
                  type="button"
                  onClick={refreshAllData}
                  disabled={loading}
                  className="p-2 text-slate-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all"
                  title="Actualizar todo"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* CONTENIDO DE PESTAÑA */}
            <div className="flex-1 p-4 overflow-y-auto">
              
              {/* PESTAÑA 1: ANÁLISIS EXPLORATORIO DE DATOS (EDA) */}
              {activeTab === "eda" && edaSummary && (
                <div className="space-y-4">
                  {/* Barra de Acciones EDA */}
                  <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-3xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📊</span>
                        <h4 className="font-black text-base sm:text-lg">
                          Informe de Análisis Exploratorio de Datos (EDA)
                        </h4>
                      </div>
                      <p className="text-xs text-purple-200 mt-0.5">
                        Estadísticas demográficas, perfil retroviral felino, ocupación de caniles y carga médica de GATERA.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleExportEdaExcel}
                        disabled={loading}
                        className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Descargar Informe EDA en Excel (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3.5 py-2.5 bg-purple-800/80 hover:bg-purple-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                        title="Imprimir resumen ejecutivo"
                      >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">Imprimir</span>
                      </button>
                    </div>
                  </div>

                  {/* Tarjetas Principales de KPIs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl">
                      <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wide block">
                        Felinos Activos en Censo
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-2xl font-black text-purple-950">{edaSummary.activeCats}</span>
                        <span className="text-xs text-purple-600 font-bold">/ {edaSummary.totalCats} reg.</span>
                      </div>
                      <span className="text-[10px] text-purple-700 font-medium block mt-1">
                        {edaSummary.deceasedCats} dados de baja (fallecidos)
                      </span>
                    </div>

                    <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-2xl">
                      <span className="text-[10px] font-bold text-rose-800 uppercase tracking-wide block">
                        Prevalencia Retroviral
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-2xl font-black text-rose-950">
                          {edaSummary.retroviral.prevalenciaGlobal}%
                        </span>
                        <span className="text-xs text-rose-600 font-bold">
                          ({edaSummary.retroviral.vifPositivo + edaSummary.retroviral.felvPositivo + edaSummary.retroviral.doblePositivo} pos)
                        </span>
                      </div>
                      <span className="text-[10px] text-rose-700 font-medium block mt-1">
                        VIF+: {edaSummary.retroviral.vifPositivo} • FeLV+: {edaSummary.retroviral.felvPositivo} • Doble: {edaSummary.retroviral.doblePositivo}
                      </span>
                    </div>

                    <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">
                        Felinos Ferales
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-2xl font-black text-amber-950">
                          {edaSummary.temperament.porcentajeFeral}%
                        </span>
                        <span className="text-xs text-amber-600 font-bold">({edaSummary.temperament.ferales})</span>
                      </div>
                      <span className="text-[10px] text-amber-700 font-medium block mt-1">
                        {edaSummary.temperament.sociables} sociables / dóciles
                      </span>
                    </div>

                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl">
                      <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wide block">
                        Carga Médica Activa
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-2xl font-black text-indigo-950">
                          {edaSummary.clinical.porcentajeMedicados}%
                        </span>
                        <span className="text-xs text-indigo-600 font-bold">
                          ({edaSummary.clinical.activosConTratamiento})
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-700 font-medium block mt-1">
                        Cumplimiento turnos: {edaSummary.operations.tasaCumplimiento}%
                      </span>
                    </div>
                  </div>

                  {/* Desglose Detallado en 2 Columnas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Columna Izquierda: Ocupación por Zonas */}
                    <div className="p-4 bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-purple-700" />
                          Distribución de Ocupación por Zona
                        </h5>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {edaSummary.byZone.length} macro-zonas
                        </span>
                      </div>

                      <div className="space-y-2">
                        {edaSummary.byZone.map((z) => (
                          <div key={z.zone} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                              <span>{z.zone}</span>
                              <span>
                                {z.count} felinos ({z.percentage}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(z.percentage * 2, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Top Caniles */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
                          Caniles con Mayor Concentración:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {edaSummary.topCaniles.slice(0, 8).map((c) => (
                            <span
                              key={c.canil}
                              className="px-2 py-0.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-lg text-[10px] font-bold"
                            >
                              {c.canil}: <strong>{c.count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Columna Derecha: Retrovirales, Condición Corporal y Sistemas Médicos */}
                    <div className="p-4 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-xs">
                      
                      {/* Retrovirales */}
                      <div>
                        <h5 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2">
                          <HeartPulse className="w-4 h-4 text-rose-600" />
                          Perfil Retroviral Felino (Inmunodeficiencia & Leucemia)
                        </h5>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <span className="text-sm font-black text-emerald-900 block">{edaSummary.retroviral.negativo}</span>
                            <span className="text-[9px] font-bold text-emerald-700 uppercase">Negativos</span>
                          </div>
                          <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl">
                            <span className="text-sm font-black text-amber-900 block">
                              {edaSummary.retroviral.vifPositivo + edaSummary.retroviral.felvPositivo}
                            </span>
                            <span className="text-[9px] font-bold text-amber-700 uppercase">VIF o FeLV (+)</span>
                          </div>
                          <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl">
                            <span className="text-sm font-black text-rose-900 block">{edaSummary.retroviral.doblePositivo}</span>
                            <span className="text-[9px] font-bold text-rose-700 uppercase">Doble (+)</span>
                          </div>
                        </div>
                      </div>

                      {/* Condición Corporal */}
                      <div>
                        <h5 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-1.5">
                          <Activity className="w-4 h-4 text-indigo-600" />
                          Condición Corporal (Escala 1.0 - 5.0)
                        </h5>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="font-black text-slate-800 block">{edaSummary.bodyCondition.bajo}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">Baja (1.0 - 2.0)</span>
                          </div>
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="font-black text-slate-800 block">{edaSummary.bodyCondition.optimo}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">Óptima (2.5 - 3.5)</span>
                          </div>
                          <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="font-black text-slate-800 block">{edaSummary.bodyCondition.sobrepeso}</span>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">Sobrepeso (4.0+)</span>
                          </div>
                        </div>
                      </div>

                      {/* Sistemas Afectados en Tratamiento */}
                      <div>
                        <h5 className="font-black text-xs uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-1.5">
                          <Stethoscope className="w-4 h-4 text-purple-600" />
                          Sistemas Orgánicos con Mayor Carga Médica
                        </h5>
                        <div className="space-y-1">
                          {edaSummary.clinical.bySystem.slice(0, 4).map((s) => (
                            <div key={s.system} className="flex items-center justify-between text-xs py-0.5">
                              <span className="font-bold text-slate-700">{s.system}</span>
                              <span className="font-mono text-slate-500">
                                {s.count} casos ({s.percentage}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA 2: GESTIÓN MAESTRA DE ANIMALES Y CENSO */}
              {activeTab === "animals" && (
                <div className="space-y-3">
                  {/* Barra de Filtros y Registro */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={animalSearch}
                          onChange={(e) => setAnimalSearch(e.target.value)}
                          placeholder="Buscar por chip, nombre, HC o canil..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-purple-500"
                        />
                      </div>

                      <select
                        value={animalFilterLocation}
                        onChange={(e) => setAnimalFilterLocation(e.target.value)}
                        className="p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 max-w-[160px]"
                      >
                        <option value="TODAS">Todas las Ubicaciones</option>
                        {locationsList.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenRegisterNewAnimal) {
                          onOpenRegisterNewAnimal();
                          onClose();
                        } else {
                          alert("Abre la pestaña de Escáner o Censo para usar el modal completo.");
                        }
                      }}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Registrar Nuevo Felino</span>
                    </button>
                  </div>

                  {/* Tabla de Animales */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 border-b">
                          <tr>
                            <th className="p-2.5">Foto</th>
                            <th className="p-2.5">Microchip</th>
                            <th className="p-2.5">Nombre / HC</th>
                            <th className="p-2.5">Ubicación</th>
                            <th className="p-2.5">Color / Sexo</th>
                            <th className="p-2.5">Retroviral</th>
                            <th className="p-2.5">Medicación</th>
                            <th className="p-2.5 text-right">Acciones Admin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredAnimals.slice(0, 60).map((a) => (
                            <tr key={a.id || a.microchip} className="hover:bg-purple-50/30 transition-all">
                              <td className="p-2">
                                {a.photoUrl ? (
                                  <img
                                    src={a.photoUrl}
                                    alt={a.name}
                                    className="w-8 h-8 rounded-lg object-cover border border-purple-200"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] text-slate-400">
                                    🐱
                                  </div>
                                )}
                              </td>
                              <td className="p-2 font-mono font-bold text-purple-950">
                                {a.shortChip || a.microchip}
                              </td>
                              <td className="p-2">
                                <span className="font-bold text-slate-900 block">{a.name}</span>
                                <span className="text-[10px] text-slate-500">HC: {a.hc || "-"}</span>
                              </td>
                              <td className="p-2">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-md font-bold text-[10px]">
                                  {a.location}
                                </span>
                              </td>
                              <td className="p-2">
                                <span className="block font-medium text-slate-800">{a.color || "DPC"}</span>
                                <span className="text-[10px] text-slate-500 uppercase">{a.sexoCode || a.gender}</span>
                              </td>
                              <td className="p-2">
                                <span
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                    a.vifStatus === "POSITIVO" || a.felvStatus === "POSITIVO"
                                      ? "bg-rose-100 text-rose-900"
                                      : "bg-emerald-100 text-emerald-900"
                                  }`}
                                >
                                  {a.retroviralStatus || "NEGATIVO"}
                                </span>
                              </td>
                              <td className="p-2 max-w-[140px] truncate">
                                {a.notes || a.observacionesMedicas || "-"}
                              </td>
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingAnimal(a)}
                                    className="p-1 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-lg transition-all"
                                    title="Editar todos los parámetros del animal"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMarkDeceased(a)}
                                    className="p-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition-all"
                                    title="Dar de baja / Registrar fallecimiento"
                                  >
                                    🕊️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteAnimalStrict(a)}
                                    className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg transition-all"
                                    title="Eliminar permanentemente de la base de datos"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* MODAL / FORMULARIO EDICIÓN TOTAL DE ANIMAL */}
              {editingAnimal && (
                <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm p-3 flex items-center justify-center animate-in fade-in">
                  <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <Edit3 className="w-4 h-4 text-purple-400" />
                        <h4 className="font-black text-sm">
                          Editar Parámetros de: {editingAnimal.name} ({editingAnimal.microchip})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingAnimal(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveAnimalEdit} className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Nombre Felino:</label>
                          <input
                            type="text"
                            value={editingAnimal.name}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, name: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Microchip:</label>
                          <input
                            type="text"
                            value={editingAnimal.microchip}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, microchip: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-mono font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Ubicación / Canil:</label>
                          <input
                            type="text"
                            value={editingAnimal.location}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, location: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-bold uppercase"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Historia Clínica (HC):</label>
                          <input
                            type="text"
                            value={editingAnimal.hc || ""}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, hc: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Código Sexo (A):</label>
                          <select
                            value={editingAnimal.sexoCode || "MFA"}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, sexoCode: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-bold"
                          >
                            <option value="MFA">MFA (Macho Fértil Adulto)</option>
                            <option value="HFA">HFA (Hembra Fértil Adulta)</option>
                            <option value="MFC">MFC (Macho Cachorro)</option>
                            <option value="HFC">HFC (Hembra Cachorra)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Color Oficial:</label>
                          <input
                            type="text"
                            value={editingAnimal.color || ""}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, color: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-bold uppercase"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Condición Corporal:</label>
                          <input
                            type="text"
                            value={editingAnimal.condicionCorporal || "RANGO 3.0/5"}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, condicionCorporal: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Estado de Salud:</label>
                          <select
                            value={editingAnimal.estadoSalud || "Saludable"}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, estadoSalud: e.target.value })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-bold"
                          >
                            <option value="Saludable">Saludable</option>
                            <option value="Regular">Regular</option>
                            <option value="Delicado">Delicado</option>
                            <option value="Crítico">Crítico</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Test VIF (Inmunodeficiencia):</label>
                          <select
                            value={editingAnimal.vifStatus || "NEGATIVO"}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, vifStatus: e.target.value as any })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-bold"
                          >
                            <option value="NEGATIVO">NEGATIVO</option>
                            <option value="POSITIVO">POSITIVO</option>
                            <option value="PENDIENTE">PENDIENTE</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Test FeLV (Leucemia):</label>
                          <select
                            value={editingAnimal.felvStatus || "NEGATIVO"}
                            onChange={(e) => setEditingAnimal({ ...editingAnimal, felvStatus: e.target.value as any })}
                            className="w-full p-2 bg-slate-50 border rounded-xl font-bold"
                          >
                            <option value="NEGATIVO">NEGATIVO</option>
                            <option value="POSITIVO">POSITIVO</option>
                            <option value="PENDIENTE">PENDIENTE</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 block mb-1">Observaciones Médicas / Diagnóstico:</label>
                        <textarea
                          rows={2}
                          value={editingAnimal.observacionesMedicas || ""}
                          onChange={(e) => setEditingAnimal({ ...editingAnimal, observacionesMedicas: e.target.value })}
                          className="w-full p-2 bg-slate-50 border rounded-xl"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t">
                        <button
                          type="button"
                          onClick={() => setEditingAnimal(null)}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-black rounded-xl shadow-md flex items-center gap-1.5"
                        >
                          <Save className="w-4 h-4" />
                          <span>Guardar Todos los Cambios</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* PESTAÑA 3: KARDEX Y TRATAMIENTOS MÉDICOS */}
              {activeTab === "kardex" && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="relative flex-1 w-full sm:w-auto">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={kardexSearch}
                        onChange={(e) => setKardexSearch(e.target.value)}
                        placeholder="Buscar en Kardex por chip, tratamiento o médico..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNewKardexOpen(true)}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Nueva Prescripción Médica</span>
                    </button>
                  </div>

                  {/* Formulario Modal Nueva Prescripción */}
                  {isNewKardexOpen && (
                    <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl animate-in fade-in space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-xs text-purple-950 uppercase flex items-center gap-1.5">
                          <Pill className="w-4 h-4 text-purple-700" />
                          Instaurar Nueva Prescripción en Kardex
                        </h5>
                        <button
                          type="button"
                          onClick={() => setIsNewKardexOpen(false)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleCreateKardex} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Microchip Felino:</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. 991003003806096"
                            value={newKardexForm.microchip}
                            onChange={(e) => setNewKardexForm({ ...newKardexForm, microchip: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Medicamento y Dosis:</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. REVOLUTION PLUS 1 PIPETA"
                            value={newKardexForm.treatment}
                            onChange={(e) => setNewKardexForm({ ...newKardexForm, treatment: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-bold uppercase"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Sistema Afectado:</label>
                          <select
                            value={newKardexForm.system}
                            onChange={(e) => setNewKardexForm({ ...newKardexForm, system: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          >
                            <option value="TEGUMEN">TEGUMENTARIO</option>
                            <option value="RESPIRATORIO">RESPIRATORIO</option>
                            <option value="DIGESTIVO">DIGESTIVO</option>
                            <option value="OFTÁLMICO">OFTÁLMICO</option>
                            <option value="PREVENTIVO">PREVENTIVO</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Dosis Totales:</label>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={newKardexForm.dosisTotales}
                            onChange={(e) => setNewKardexForm({ ...newKardexForm, dosisTotales: Number(e.target.value) })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          />
                        </div>
                        <div className="sm:col-span-4 flex items-center justify-end gap-2 pt-1">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black shadow-md"
                          >
                            Prescribir y Guardar
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Tabla de Kardex */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 border-b">
                          <tr>
                            <th className="p-2.5">Microchip</th>
                            <th className="p-2.5">Tratamiento / Medicamento</th>
                            <th className="p-2.5">Sistema</th>
                            <th className="p-2.5">Dosis</th>
                            <th className="p-2.5">Estado</th>
                            <th className="p-2.5">Prescrito Por</th>
                            <th className="p-2.5 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredKardex.slice(0, 50).map((k) => (
                            <tr key={k.id} className="hover:bg-purple-50/20">
                              <td className="p-2 font-mono font-bold text-purple-950">
                                {k.shortChip || k.microchip}
                              </td>
                              <td className="p-2 font-bold text-slate-900">{k.treatment}</td>
                              <td className="p-2">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-900 rounded-md text-[10px] font-bold">
                                  {k.system}
                                </span>
                              </td>
                              <td className="p-2 font-mono">
                                {k.dosisAplicadas}/{k.dosisTotales} ({k.dosisFaltantes} faltan)
                              </td>
                              <td className="p-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    k.status === "activo"
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {k.status}
                                </span>
                              </td>
                              <td className="p-2 text-slate-500">{k.prescribedBy}</td>
                              <td className="p-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleKardexStatus(k)}
                                    className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold"
                                    title={k.status === "activo" ? "Suspender tratamiento" : "Reactivar"}
                                  >
                                    {k.status === "activo" ? "Pausar" : "Activar"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteKardex(k)}
                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                                    title="Eliminar del Kardex"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA 4: TURNOS Y TAREAS DE CAMPO */}
              {activeTab === "shifts" && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <select
                        value={shiftFilter}
                        onChange={(e) => setShiftFilter(e.target.value)}
                        className="p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                      >
                        <option value="TODOS">Todos los Turnos</option>
                        <option value="PENDIENTES">Solo Pendientes</option>
                        <option value="COMPLETADAS">Solo Completadas</option>
                        <option value="mañana">Turno Mañana</option>
                        <option value="tarde">Turno Tarde</option>
                        <option value="noche">Turno Noche</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNewShiftOpen(true)}
                      className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Asignar Tarea de Turno</span>
                    </button>
                  </div>

                  {/* Formulario Nueva Tarea */}
                  {isNewShiftOpen && (
                    <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl animate-in fade-in space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-xs text-indigo-950 uppercase flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-indigo-700" />
                          Crear Tarea de Turno para Operarios / Auxiliares
                        </h5>
                        <button
                          type="button"
                          onClick={() => setIsNewShiftOpen(false)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleCreateShiftTask} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Microchip:</label>
                          <input
                            type="text"
                            required
                            placeholder="Chip del felino"
                            value={newShiftForm.microchip}
                            onChange={(e) => setNewShiftForm({ ...newShiftForm, microchip: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-mono"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Tipo de Labor:</label>
                          <select
                            value={newShiftForm.laborType}
                            onChange={(e) => setNewShiftForm({ ...newShiftForm, laborType: e.target.value as any })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          >
                            <option value="medicacion">Medicación</option>
                            <option value="limpieza">Limpieza de Canil</option>
                            <option value="baño">Baño Medicado</option>
                            <option value="nebulizacion">Nebulización</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Turno Asignado:</label>
                          <select
                            value={newShiftForm.shift}
                            onChange={(e) => setNewShiftForm({ ...newShiftForm, shift: e.target.value as any })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          >
                            <option value="mañana">Mañana</option>
                            <option value="tarde">Tarde</option>
                            <option value="noche">Noche</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Responsable Asignado:</label>
                          <select
                            value={newShiftForm.assignedTo}
                            onChange={(e) => setNewShiftForm({ ...newShiftForm, assignedTo: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          >
                            <option value="">Cualquier Auxiliar Libre</option>
                            {staffList.map((s) => (
                              <option key={s.id} value={s.name}>
                                {s.name} ({s.role})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-4 flex items-center justify-end gap-2 pt-1">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-black shadow-md"
                          >
                            Programar Tarea
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Tabla de Tareas */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="max-h-[50vh] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] sticky top-0 z-10 border-b">
                          <tr>
                            <th className="p-2.5">Estado</th>
                            <th className="p-2.5">Canil</th>
                            <th className="p-2.5">Microchip</th>
                            <th className="p-2.5">Labor</th>
                            <th className="p-2.5">Turno</th>
                            <th className="p-2.5">Responsable</th>
                            <th className="p-2.5 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredShifts.slice(0, 50).map((t) => (
                            <tr key={t.id} className="hover:bg-indigo-50/20">
                              <td className="p-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggleShiftTask(t)}
                                  className={`p-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 ${
                                    t.isCompleted
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {t.isCompleted ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                  <span>{t.isCompleted ? "Hecho" : "Pendiente"}</span>
                                </button>
                              </td>
                              <td className="p-2 font-bold text-slate-900">{t.location}</td>
                              <td className="p-2 font-mono text-purple-950 font-bold">{t.microchip}</td>
                              <td className="p-2">
                                <span className="font-bold text-indigo-900 uppercase text-[10px]">
                                  {t.laborType}
                                </span>
                                {t.medication && <span className="block text-[10px] text-slate-500">{t.medication}</span>}
                              </td>
                              <td className="p-2 uppercase text-[10px] font-bold text-slate-600">{t.shift}</td>
                              <td className="p-2 text-slate-500">{t.assignedTo || "Equipo Gatera"}</td>
                              <td className="p-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShiftTask(t)}
                                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg"
                                  title="Eliminar tarea"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* PESTAÑA 5: ACTIVIDAD POR USUARIO */}
              {activeTab === "stats" && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">
                      Desglose de Actividad por Funcionario
                    </h4>
                    <p className="text-xs text-slate-500">
                      Total de animales registrados, modificados y tratamientos instaurados por cada médico y auxiliar.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {userStats.map((u) => (
                      <div
                        key={u.userId}
                        className="p-4 bg-slate-50 hover:bg-purple-50/40 border border-slate-200 rounded-2xl space-y-3 transition-all shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                              {u.userRole === "veterinario"
                                ? "DR"
                                : u.userRole === "auxiliar"
                                ? "AUX"
                                : "OP"}
                            </div>
                            <div>
                              <span className="font-black text-slate-900 text-xs block leading-tight">
                                {u.userName}
                              </span>
                              <span className="text-[10px] text-purple-700 font-bold uppercase">
                                {u.userRole}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            Última: {new Date(u.lastActive).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1.5 pt-1 text-center">
                          <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                            <span className="text-xs font-black text-purple-900 block">{u.registeredCount}</span>
                            <span className="text-[9px] text-slate-500 font-bold block uppercase">Nuevos</span>
                          </div>
                          <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                            <span className="text-xs font-black text-indigo-900 block">{u.modifiedCount}</span>
                            <span className="text-[9px] text-slate-500 font-bold block uppercase">Ediciones</span>
                          </div>
                          <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                            <span className="text-xs font-black text-emerald-900 block">{u.treatmentCount}</span>
                            <span className="text-[9px] text-slate-500 font-bold block uppercase">Meds/Rx</span>
                          </div>
                          <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
                            <span className="text-xs font-black text-blue-900 block">{u.censusCount}</span>
                            <span className="text-[9px] text-slate-500 font-bold block uppercase">Censos</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PESTAÑA 6: GESTIÓN DE PERSONAL Y PINS */}
              {activeTab === "staff" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">
                        Personal de Campo y Control de Acceso
                      </h4>
                      <p className="text-xs text-slate-500">
                        Configura funcionarios y PINs personales para garantizar la confidencialidad de la sesión.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsNewStaffOpen(true)}
                      className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs shrink-0"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Agregar Nuevo Funcionario</span>
                    </button>
                  </div>

                  {/* Formulario Modal Nuevo Funcionario */}
                  {isNewStaffOpen && (
                    <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl animate-in fade-in space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-xs text-purple-950 uppercase flex items-center gap-1.5">
                          <Users className="w-4 h-4 text-purple-700" />
                          Registrar Nuevo Funcionario en CBA La Perla
                        </h5>
                        <button
                          type="button"
                          onClick={() => setIsNewStaffOpen(false)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleCreateStaff} className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Nombre Completo:</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej. Dra. Jenny Zapata"
                            value={newStaffForm.name}
                            onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Rol Asignado:</label>
                          <select
                            value={newStaffForm.role}
                            onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value as any })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          >
                            <option value="veterinario">Médico Veterinario</option>
                            <option value="auxiliar">Auxiliar Veterinario</option>
                            <option value="operario">Operario de Albergue</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">PIN Personal (4 dígitos):</label>
                          <input
                            type="password"
                            maxLength={6}
                            placeholder="Ej. 1234"
                            value={newStaffForm.pin}
                            onChange={(e) => setNewStaffForm({ ...newStaffForm, pin: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-mono text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Correo Institucional (Opcional):</label>
                          <input
                            type="email"
                            placeholder="correo@laperla.gov.co"
                            value={newStaffForm.email}
                            onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-4 flex items-center justify-end gap-2 pt-1">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black shadow-md"
                          >
                            Registrar Funcionario
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Formulario Editar Funcionario */}
                  {editingStaffMember && (
                    <div className="p-4 bg-purple-50/90 border border-purple-300 rounded-2xl animate-in fade-in space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="font-black text-xs text-purple-950 uppercase flex items-center gap-1.5">
                          <Edit3 className="w-4 h-4 text-purple-700" />
                          Modificar Funcionario: {editingStaffMember.name}
                        </h5>
                        <button
                          type="button"
                          onClick={() => setEditingStaffMember(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <form onSubmit={handleSaveStaffEdit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Nombre Completo: *</label>
                          <input
                            type="text"
                            required
                            value={editStaffForm.name}
                            onChange={(e) => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Rol Asignado: *</label>
                          <select
                            value={editStaffForm.role}
                            onChange={(e) => setEditStaffForm({ ...editStaffForm, role: e.target.value as any })}
                            className="w-full p-2 bg-white border rounded-xl font-bold"
                          >
                            <option value="veterinario">Médico Veterinario</option>
                            <option value="auxiliar">Auxiliar Veterinario</option>
                            <option value="operario">Operario de Albergue</option>
                          </select>
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">PIN Personal (Opcional):</label>
                          <input
                            type="password"
                            maxLength={6}
                            placeholder="Ej. 1234"
                            value={editStaffForm.pin}
                            onChange={(e) => setEditStaffForm({ ...editStaffForm, pin: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl font-mono text-center font-bold"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Especialidad / Cargo:</label>
                          <input
                            type="text"
                            value={editStaffForm.specialty}
                            onChange={(e) => setEditStaffForm({ ...editStaffForm, specialty: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Correo Institucional:</label>
                          <input
                            type="email"
                            value={editStaffForm.email}
                            onChange={(e) => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 block mb-1">Teléfono:</label>
                          <input
                            type="tel"
                            value={editStaffForm.phone}
                            onChange={(e) => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                            className="w-full p-2 bg-white border rounded-xl"
                          />
                        </div>
                        <div className="sm:col-span-3 flex items-center justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingStaffMember(null)}
                            className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Guardar Modificaciones</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="space-y-2">
                    {staffList.map((staff) => (
                      <div
                        key={staff.id}
                        className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shadow-xs ${staff.avatarColor}`}>
                            {staff.role === "veterinario" ? "DR" : staff.role === "auxiliar" ? "AUX" : "OP"}
                          </div>
                          <div>
                            <span className="font-black text-slate-900 text-xs block leading-tight">
                              {staff.name}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {staff.role.toUpperCase()} • {staff.email || "Sin correo"} • PIN: {staff.pin ? "••••" : "⚠️ Sin PIN (Acceso Libre)"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {resetPinUserId === staff.id ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in">
                              <input
                                type="password"
                                maxLength={6}
                                value={newPinValue}
                                onChange={(e) => setNewPinValue(e.target.value)}
                                placeholder="Nuevo PIN"
                                className="w-24 p-1.5 text-xs text-center border border-purple-300 rounded-lg font-mono font-bold bg-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleResetPin(staff.id)}
                                className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetPinUserId(null);
                                  setNewPinValue("");
                                }}
                                className="px-2 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setResetPinUserId(staff.id);
                                setNewPinValue("");
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>{staff.pin ? "Cambiar PIN" : "Asignar PIN"}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartEditStaff(staff)}
                            className="p-1.5 text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-xl transition-all"
                            title="Editar datos completos del funcionario"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteStaff(staff.id, staff.name)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
                            title="Eliminar usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PESTAÑA 7: AUDITORÍA EN TIEMPO REAL */}
              {activeTab === "audit" && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchAuditQuery}
                        onChange={(e) => setSearchAuditQuery(e.target.value)}
                        placeholder="Buscar por chip, nombre o detalle..."
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-1 focus:ring-purple-500"
                      />
                    </div>

                    <select
                      value={filterAction}
                      onChange={(e) => setFilterAction(e.target.value)}
                      className="p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="TODAS">Todas las Acciones</option>
                      <option value="REGISTRO_ANIMAL">Nuevos Registros</option>
                      <option value="MODIFICACION_ANIMAL">Ediciones de Ficha</option>
                      <option value="CAMBIO_UBICACION">Traslados de Canil</option>
                      <option value="CAMBIO_COLOR">Modificación de Color</option>
                      <option value="FOTO_SUBIDA">Fotos Subidas</option>
                      <option value="TRATAMIENTO_PRESCRITO">Tratamientos Prescritos</option>
                      <option value="CENSO_CONFIRMADO">Censos Confirmados</option>
                      <option value="BAJA_FALLECIDO">Bajas por Defunción</option>
                    </select>

                    <select
                      value={filterUser}
                      onChange={(e) => setFilterUser(e.target.value)}
                      className="p-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                    >
                      <option value="TODOS">Todos los Usuarios</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                    {filteredLogs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        No se encontraron registros con los filtros seleccionados.
                      </div>
                    ) : (
                      filteredLogs.map((log, idx) => (
                        <div
                          key={log.id || idx}
                          className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-[10px] text-slate-400">
                                {new Date(log.timestamp).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-200">
                                {log.action.replace(/_/g, " ")}
                              </span>
                              <span className="font-mono font-bold text-slate-700">
                                Chip: {log.microchip}
                              </span>
                            </div>
                            <p className="text-slate-800 font-medium">{log.details}</p>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 block text-xs">
                              {log.userName}
                            </span>
                            <span className="text-[10px] text-slate-400 uppercase font-semibold">
                              {log.userRole}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* PESTAÑA 8: BASE DE DATOS, BACKUP Y RESTAURACIÓN */}
              {activeTab === "system" && (
                <div className="space-y-4">
                  {/* Backup y Restauración */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <Database className="w-4 h-4 text-purple-700" />
                      Copia de Seguridad y Restauración Local (JSON)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Descarga una copia completa de todos los datos (animales, historial, kardex, censos, auditoría) para salvaguardar en el computador o restaurarla en cualquier dispositivo.
                    </p>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={handleExportFullBackup}
                        className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 transition-all"
                      >
                        <FileDown className="w-4 h-4" />
                        <span>Exportar Copia de Seguridad JSON Completa</span>
                      </button>

                      <input
                        ref={restoreFileInputRef}
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={handleRestoreBackupFile}
                      />

                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => restoreFileInputRef.current?.click()}
                        className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-black flex items-center gap-2 shadow-xs active:scale-95 transition-all"
                      >
                        <Upload className="w-4 h-4 text-purple-700" />
                        <span>Restaurar desde Archivo JSON</span>
                      </button>
                    </div>
                  </div>

                  {/* Sincronización Supabase */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 text-indigo-700" />
                      Estado de Conexión Nube Supabase
                    </h4>
                    <p className="text-xs text-slate-600">
                      {isSupabaseConfigured()
                        ? "✅ Conexión con Supabase configurada y lista para sincronización en tiempo real."
                        : "⚠️ Supabase no está configurado o está en modo offline local."}
                    </p>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleForceFullSync}
                      className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md active:scale-95 transition-all"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                      <span>Forzar Sincronización Total Bidireccional</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
