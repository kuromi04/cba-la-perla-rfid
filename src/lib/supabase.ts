import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { db, Animal, ShiftTask } from "./db";
import { StaffMember, MASTER_ADMIN } from "./staff";

export const DEFAULT_SUPABASE_URL = "https://apcevwjxqcfxjizqtrif.supabase.co";
export const DEFAULT_SUPABASE_KEY = "sb_publishable_zUmcSAiPGdCnIgbSMUsGrw_LHzK2usV";

/**
 * Obtener credenciales de Supabase (desde Variables de Entorno, localStorage o valores oficiales)
 */
export function getSupabaseCredentials(): { url: string; key: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  let key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_KEY;

  if (typeof window !== "undefined") {
    const localUrl = localStorage.getItem("cba_supabase_url");
    const localKey = localStorage.getItem("cba_supabase_anon_key");
    if (localUrl && localUrl.trim().startsWith("http")) url = localUrl.trim();
    if (localKey && localKey.trim().length > 15) key = localKey.trim();
  }

  // Si por alguna razón la key está vacía o corrupta, forzar la oficial
  if (!url || !url.startsWith("http")) url = DEFAULT_SUPABASE_URL;
  if (!key || key.length < 15) key = DEFAULT_SUPABASE_KEY;

  return { url: url.trim(), key: key.trim() };
}

let activeClient: SupabaseClient | null = null;
let lastUrl = "";
let lastKey = "";

/**
 * Obtener cliente activo de Supabase inicializado dinámicamente
 */
export function getSupabaseClient(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;

  if (!activeClient || url !== lastUrl || key !== lastKey) {
    try {
      activeClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      lastUrl = url;
      lastKey = key;
    } catch (e) {
      console.warn("Error creando cliente Supabase:", e);
      return null;
    }
  }

  return activeClient;
}

/**
 * Guardar o actualizar credenciales en localStorage
 */
export function saveSupabaseCredentials(url: string, key: string): boolean {
  if (typeof window !== "undefined") {
    if (url.trim()) localStorage.setItem("cba_supabase_url", url.trim());
    else localStorage.removeItem("cba_supabase_url");

    if (key.trim()) localStorage.setItem("cba_supabase_anon_key", key.trim());
    else localStorage.removeItem("cba_supabase_anon_key");

    activeClient = null;
    lastUrl = "";
    lastKey = "";
    return true;
  }
  return false;
}

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key);
};

// Objeto de compatibilidad hacia atrás
export const supabase = {
  from: (table: string) => {
    const client = getSupabaseClient();
    if (!client) throw new Error("Supabase no está configurado.");
    return client.from(table);
  },
};

/**
 * Diagnóstico y prueba de tablas de Supabase
 */
export async function testSupabaseConnection(): Promise<{
  ok: boolean;
  message: string;
  tables?: { staff: boolean; staff_presence: boolean; shift_tasks: boolean; animals: boolean };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, message: "No se han configurado la URL o la Anon Key de Supabase." };
  }

  const tables = {
    staff: false,
    staff_presence: false,
    shift_tasks: false,
    animals: false,
  };

  try {
    const { error: errStaff } = await client.from("staff").select("id").limit(1);
    tables.staff = !errStaff || errStaff.code !== "42P01";

    const { error: errPres } = await client.from("staff_presence").select("staff_id").limit(1);
    tables.staff_presence = !errPres || errPres.code !== "42P01";

    const { error: errTasks } = await client.from("shift_tasks").select("id").limit(1);
    tables.shift_tasks = !errTasks || errTasks.code !== "42P01";

    const { error: errAnim } = await client.from("animals").select("id").limit(1);
    tables.animals = !errAnim || errAnim.code !== "42P01";

    const allOk = tables.staff && tables.staff_presence && tables.shift_tasks && tables.animals;
    if (allOk) {
      return { ok: true, message: "✅ Conexión exitosa y todas las tablas de Gatera están operativas en Supabase.", tables };
    } else {
      return {
        ok: false,
        message: "⚠️ Conexión establecida pero faltan tablas por crear en Supabase (ejecuta el script SQL en SQL Editor).",
        tables,
      };
    }
  } catch (err: any) {
    return { ok: false, message: `Error de conexión con Supabase: ${err.message || err}` };
  }
}

export interface ConnectedStaff {
  staff_id: string;
  staff_name: string;
  role: "veterinario" | "auxiliar" | "operario" | "admin";
  area: "gatera";
  last_seen: string;
  device_info?: string;
  isOnlineNow?: boolean;
}

/**
 * 1. SINCRONIZACIÓN DE PERSONAL (STAFF)
 */
export async function syncStaffToSupabase(member: StaffMember): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const payload = {
      id: member.id,
      name: member.name,
      role: member.role,
      specialty: member.specialty || null,
      area: "gatera",
      phone: member.phone || null,
      token: member.token,
      avatar_color: member.avatarColor,
      registered_at: member.registeredAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from("staff")
      .upsert(payload, { onConflict: "id" });

    if (error) {
      console.warn("Supabase staff upsert warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Error syncing staff to Supabase:", err);
    return false;
  }
}

/**
 * Obtener todo el personal registrado desde Supabase
 */
export async function fetchStaffFromSupabase(): Promise<StaffMember[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("staff")
      .select("*")
      .order("registered_at", { ascending: true });

    if (error || !data) {
      console.warn("Supabase fetch staff warning:", error?.message);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      name: row.name,
      role: row.id === MASTER_ADMIN.id ? "admin" : (row.role === "admin" ? "veterinario" : row.role),
      specialty: row.specialty || undefined,
      area: "gatera" as const,
      phone: row.phone || undefined,
      token: row.token,
      avatarColor: row.avatar_color || "bg-emerald-700 text-white",
      registeredAt: row.registered_at,
    }));
  } catch (err) {
    console.warn("Error fetching staff from Supabase:", err);
    return [];
  }
}

/**
 * Eliminar personal de Supabase
 */
export async function deleteStaffFromSupabase(id: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    await client.from("staff").delete().eq("id", id);
    await client.from("staff_presence").delete().eq("staff_id", id);
  } catch (err) {
    console.warn("Error deleting staff from Supabase:", err);
  }
}

/**
 * 2. PRESENCIA EN VIVO / MONITOREO DE QUIÉN ESTÁ CONECTADO
 */
export async function recordStaffPresence(member: StaffMember): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !member?.id) return;

  try {
    const payload = {
      staff_id: member.id,
      staff_name: member.name,
      role: member.role,
      area: "gatera",
      last_seen: new Date().toISOString(),
      device_info: typeof window !== "undefined" ? navigator.userAgent.slice(0, 80) : undefined,
    };

    await client
      .from("staff_presence")
      .upsert(payload, { onConflict: "staff_id" });
  } catch (err) {
    // Fail silently
  }
}

/**
 * Obtener personal conectado recientemente (últimos 10 minutos)
 */
export async function getConnectedStaff(): Promise<ConnectedStaff[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await client
      .from("staff_presence")
      .select("*")
      .gte("last_seen", tenMinutesAgo)
      .order("last_seen", { ascending: false });

    if (error || !data) return [];

    const now = Date.now();
    return data.map((row: any) => {
      const lastSeenTime = new Date(row.last_seen).getTime();
      const isOnlineNow = now - lastSeenTime < 3 * 60 * 1000; // Activo en los últimos 3 min
      return {
        staff_id: row.staff_id,
        staff_name: row.staff_name,
        role: row.role,
        area: "gatera",
        last_seen: row.last_seen,
        device_info: row.device_info,
        isOnlineNow,
      };
    });
  } catch (err) {
    console.warn("Error getting connected staff:", err);
    return [];
  }
}

/**
 * 3. SUPERVISIÓN Y CHECKLISTS DE TURNOS EN VIVO
 */
export async function syncShiftTaskToSupabase(task: ShiftTask): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const payload = {
      client_task_id: task.id,
      kardex_id: task.kardexId,
      animal_name: task.animalName,
      species: "gato",
      microchip: task.microchip,
      location: task.location,
      medication: task.medication,
      shift: task.shift,
      labor_type: task.laborType,
      is_completed: task.isCompleted,
      completed_at: task.completedAt || null,
      completed_by: task.completedBy || null,
      is_feral: task.isFeral || false,
      notes: task.notes || null,
      area: "gatera",
      assigned_to: task.assignedTo || null,
      assigned_role: task.assignedRole || null,
      dosis_totales: task.dosisTotales ?? 7,
      dosis_aplicadas: task.dosisAplicadas ?? 0,
      dosis_faltantes: task.dosisFaltantes ?? 7,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from("shift_tasks")
      .upsert(payload, { onConflict: "microchip,shift,medication" });

    if (error) {
      const { error: insErr } = await client.from("shift_tasks").insert(payload);
      if (insErr) console.warn("Supabase task sync warning:", insErr.message);
    }

    return true;
  } catch (err) {
    console.warn("Error syncing task to Supabase:", err);
    return false;
  }
}

/**
 * Cargar tareas de turno desde Supabase para supervisión en vivo
 */
export async function fetchShiftTasksFromSupabase(): Promise<ShiftTask[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("shift_tasks")
      .select("*")
      .eq("area", "gatera")
      .order("id", { ascending: true });

    if (error || !data) return [];

    return data.map((r: any) => ({
      id: r.client_task_id || r.id,
      kardexId: r.kardex_id || undefined,
      animalName: r.animal_name,
      species: "gato",
      microchip: r.microchip,
      location: r.location,
      medication: r.medication,
      shift: r.shift as any,
      laborType: r.labor_type as any,
      isCompleted: Boolean(r.is_completed),
      completedAt: r.completed_at || undefined,
      completedBy: r.completed_by || undefined,
      isFeral: Boolean(r.is_feral),
      notes: r.notes || undefined,
      area: "gatera" as const,
      assignedTo: r.assigned_to || undefined,
      assignedRole: r.assigned_role as any,
      dosisTotales: r.dosis_totales,
      dosisAplicadas: r.dosis_aplicadas,
      dosisFaltantes: r.dosis_faltantes,
    }));
  } catch (err) {
    console.warn("Error fetching shift tasks from Supabase:", err);
    return [];
  }
}

/**
 * Sincronizar todas las tareas de turno a Supabase
 */
export async function syncAllTasksToSupabase(tasks: ShiftTask[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client || tasks.length === 0) return;

  try {
    const rows = tasks.map((t) => ({
      client_task_id: t.id,
      kardex_id: t.kardexId,
      animal_name: t.animalName,
      species: "gato",
      microchip: t.microchip,
      location: t.location,
      medication: t.medication,
      shift: t.shift,
      labor_type: t.laborType,
      is_completed: t.isCompleted,
      completed_at: t.completedAt || null,
      completed_by: t.completedBy || null,
      is_feral: t.isFeral || false,
      notes: t.notes || null,
      area: "gatera",
      assigned_to: t.assignedTo || null,
      assigned_role: t.assignedRole || null,
      dosis_totales: t.dosisTotales ?? 7,
      dosis_aplicadas: t.dosisAplicadas ?? 0,
      dosis_faltantes: t.dosisFaltantes ?? 7,
      updated_at: new Date().toISOString(),
    }));

    await client.from("shift_tasks").upsert(rows);
  } catch (err) {
    console.warn("Error syncing all tasks to Supabase:", err);
  }
}

/**
 * 4. SINCRONIZACIÓN DE ANIMALES Y CENSO
 */
export async function syncAnimalToSupabase(animal: Animal): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const isFallecido =
      animal.location?.toUpperCase().trim() === "FALLECIDO" ||
      animal.status?.toLowerCase().trim() === "fallecido";

    const payload = {
      microchip: animal.microchip,
      name: animal.name,
      species: "gato",
      breed: animal.breed || "DPC",
      sex: animal.sexoCode?.startsWith("H") ? "hembra" : "macho",
      status: isFallecido ? "fallecido" : (animal.status || "activo"),
      photo_url: animal.photoUrl || null,
      notes: animal.notes || animal.observacionesMedicas,
      retroviral_status: animal.retroviralStatus || null,
      vif_status: animal.vifStatus || null,
      felv_status: animal.felvStatus || null,
      attributes: {
        shortChip: animal.shortChip,
        hc: animal.hc,
        isFeral: animal.isFeral,
        location: animal.location,
        color: animal.color,
        photoUrl: animal.photoUrl || null,
        condicionCorporal: animal.condicionCorporal,
        estadoSalud: animal.estadoSalud,
        tipoIngreso: animal.tipoIngreso,
        edad: animal.edad,
        medicoVeterinario: animal.medicoVeterinario,
        requiereSeguimiento: animal.requiereSeguimiento,
        lastCensusDate: animal.lastCensusDate,
        retroviralStatus: animal.retroviralStatus,
        vifStatus: animal.vifStatus,
        felvStatus: animal.felvStatus,
        fechaFallecimiento: animal.fechaFallecimiento,
        causaFallecimiento: animal.causaFallecimiento,
        ubicacionPrevia: animal.ubicacionPrevia,
        createdBy: animal.createdBy,
        createdById: animal.createdById,
        createdAt: animal.createdAt,
        updatedBy: animal.updatedBy,
        updatedById: animal.updatedById,
        updatedAt: animal.updatedAt,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await client
      .from("animals")
      .upsert(payload, { onConflict: "microchip" });

    if (error) {
      console.warn("Supabase upsert warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Error syncing animal to Supabase:", err);
    return false;
  }
}

export async function syncAllLocalToSupabase(): Promise<{ synced: number; total: number }> {
  const client = getSupabaseClient();
  if (!client) return { synced: 0, total: 0 };

  try {
    const localAnimals = await db.animals.where("species").equals("gato").toArray();
    let synced = 0;

    const chunkSize = 50;
    for (let i = 0; i < localAnimals.length; i += chunkSize) {
      const chunk = localAnimals.slice(i, i + chunkSize);
      const rows = chunk.map((a) => ({
        microchip: a.microchip,
        name: a.name || `Felino ${a.microchip.slice(-4)}`,
        species: "gato",
        breed: a.breed || "DPC",
        sex: a.sexoCode?.startsWith("H") ? "hembra" : "macho",
        status: "activo",
        photo_url: a.photoUrl || null,
        notes: a.notes || a.observacionesMedicas,
        retroviral_status: a.retroviralStatus || null,
        vif_status: a.vifStatus || null,
        felv_status: a.felvStatus || null,
        attributes: {
          shortChip: a.shortChip,
          hc: a.hc,
          isFeral: a.isFeral,
          location: a.location,
          color: a.color,
          photoUrl: a.photoUrl || null,
          condicionCorporal: a.condicionCorporal,
          estadoSalud: a.estadoSalud,
          tipoIngreso: a.tipoIngreso,
          edad: a.edad,
          medicoVeterinario: a.medicoVeterinario,
          lastCensusDate: a.lastCensusDate,
          retroviralStatus: a.retroviralStatus,
          vifStatus: a.vifStatus,
          felvStatus: a.felvStatus,
        },
        updated_at: new Date().toISOString(),
      }));

      const { error } = await client
        .from("animals")
        .upsert(rows, { onConflict: "microchip" });

      if (!error) {
        synced += chunk.length;
      }
    }

    return { synced, total: localAnimals.length };
  } catch (err) {
    console.error("Error in full Supabase sync:", err);
    return { synced: 0, total: 0 };
  }
}

/**
 * Descargar todos los animales felinos registrados en Supabase
 * Permite alimentar el censo dinámicamente con los registros de otros dispositivos.
 */
export async function fetchAnimalsFromSupabase(): Promise<Animal[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("animals")
      .select("*")
      .eq("species", "gato")
      .order("updated_at", { ascending: false });

    if (error || !data) {
      console.warn("Supabase fetch animals warning:", error?.message);
      return [];
    }

    return data.map((row: any) => {
      const attrs = row.attributes || {};
      const isFallecido =
        row.status === "fallecido" ||
        attrs.location?.toUpperCase().trim() === "FALLECIDO";

      return {
        microchip: row.microchip,
        shortChip:
          attrs.shortChip ||
          (row.microchip.length > 7 ? row.microchip.slice(-7) : row.microchip),
        name: row.name,
        species: "gato",
        breed: row.breed || "DPC",
        gender: row.sex === "hembra" ? "hembra" : "macho",
        sexoCode: row.sex === "hembra" ? "HFA" : "MFA",
        location: isFallecido ? "FALLECIDO" : (attrs.location || "GATERA"),
        status: isFallecido ? "fallecido" : (row.status || "activo"),
        notes: row.notes,
        photoUrl: row.photo_url || attrs.photoUrl || undefined,
        hc: attrs.hc,
        isFeral: Boolean(attrs.isFeral),
        color: attrs.color,
        tipoIngreso: attrs.tipoIngreso || "RES",
        edad: attrs.edad,
        condicionCorporal: attrs.condicionCorporal,
        estadoSalud: attrs.estadoSalud,
        observacionesMedicas: row.notes,
        requiereSeguimiento: attrs.requiereSeguimiento,
        medicoVeterinario: attrs.medicoVeterinario,
        retroviralStatus: row.retroviral_status || attrs.retroviralStatus,
        vifStatus: row.vif_status || attrs.vifStatus,
        felvStatus: row.felv_status || attrs.felvStatus,
        fechaFallecimiento: attrs.fechaFallecimiento,
        causaFallecimiento: attrs.causaFallecimiento,
        ubicacionPrevia: attrs.ubicacionPrevia,
        lastCensusDate: attrs.lastCensusDate,
        createdBy: attrs.createdBy,
        createdById: attrs.createdById,
        createdAt: attrs.createdAt,
        updatedBy: attrs.updatedBy,
        updatedById: attrs.updatedById,
        updatedAt: attrs.updatedAt,
      } as Animal;
    });
  } catch (err) {
    console.warn("Error fetching animals from Supabase:", err);
    return [];
  }
}

/**
 * 5. SINCRONIZACIÓN DE LOGS DE AUDITORÍA
 */
export async function syncAuditLogToSupabase(log: any): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client.from("audit_logs").insert({
      timestamp: log.timestamp,
      user_id: log.userId,
      user_name: log.userName,
      user_role: log.userRole,
      action: log.action,
      microchip: log.microchip,
      animal_name: log.animalName || null,
      location: log.location || null,
      details: log.details,
      previous_value: log.previousValue || null,
      new_value: log.newValue || null,
    });

    if (error) {
      // Si la tabla audit_logs no existe aún en el proyecto de Supabase del usuario, advertir sin romper la app
      console.warn("Supabase audit log insert notice:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Error syncing audit log to Supabase:", err);
    return false;
  }
}

export async function fetchAuditLogsFromSupabase(): Promise<any[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("audit_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(100);

    if (error || !data) return [];
    return data;
  } catch (err) {
    return [];
  }
}

