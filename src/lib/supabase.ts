import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { db, Animal, ShiftTask } from "./db";
import { StaffMember, MASTER_ADMIN } from "./staff";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cliente seguro: no explota si no están definidas las variables en entorno local
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

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
  if (!supabase) return false;

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

    const { error } = await supabase
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
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
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
 * 2. PRESENCIA EN VIVO / MONITOREO DE QUIÉN ESTÁ CONECTADO
 */
export async function recordStaffPresence(member: StaffMember): Promise<void> {
  if (!supabase || !member?.id) return;

  try {
    const payload = {
      staff_id: member.id,
      staff_name: member.name,
      role: member.role,
      area: "gatera",
      last_seen: new Date().toISOString(),
      device_info: typeof window !== "undefined" ? navigator.userAgent.slice(0, 80) : undefined,
    };

    await supabase
      .from("staff_presence")
      .upsert(payload, { onConflict: "staff_id" });
  } catch (err) {
    // Fail silently without disrupting UI
  }
}

/**
 * Obtener personal conectado recientemente (últimos 10 minutos)
 */
export async function getConnectedStaff(): Promise<ConnectedStaff[]> {
  if (!supabase) return [];

  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data, error } = await supabase
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
  if (!supabase) return false;

  try {
    const payload = {
      client_task_id: task.id || null,
      kardex_id: task.kardexId || null,
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
      is_feral: Boolean(task.isFeral),
      notes: task.notes || null,
      area: "gatera",
      assigned_to: task.assignedTo || null,
      assigned_role: task.assignedRole || null,
      dosis_totales: task.dosisTotales ?? 7,
      dosis_aplicadas: task.dosisAplicadas ?? 0,
      dosis_faltantes: task.dosisFaltantes ?? 7,
      updated_at: new Date().toISOString(),
    };

    // Si ya existe un registro con el mismo microchip y turno, actualizarlo
    const { error } = await supabase
      .from("shift_tasks")
      .upsert(payload, { onConflict: "microchip,shift,medication" });

    if (error) {
      // Fallback simple insert/update si no hay conflicto compuesto
      const { error: insErr } = await supabase.from("shift_tasks").insert(payload);
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
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
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
  if (!supabase || tasks.length === 0) return;

  try {
    const rows = tasks.map((t) => ({
      client_task_id: t.id || null,
      kardex_id: t.kardexId || null,
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
      is_feral: Boolean(t.isFeral),
      notes: t.notes || null,
      area: "gatera",
      assigned_to: t.assignedTo || null,
      assigned_role: t.assignedRole || null,
      dosis_totales: t.dosisTotales ?? 7,
      dosis_aplicadas: t.dosisAplicadas ?? 0,
      dosis_faltantes: t.dosisFaltantes ?? 7,
      updated_at: new Date().toISOString(),
    }));

    await supabase.from("shift_tasks").upsert(rows);
  } catch (err) {
    console.warn("Error syncing all tasks to Supabase:", err);
  }
}

/**
 * 4. SINCRONIZACIÓN DE ANIMALES Y CENSO
 */
export async function syncAnimalToSupabase(animal: Animal): Promise<boolean> {
  if (!supabase) return false;

  try {
    const payload = {
      microchip: animal.microchip,
      name: animal.name,
      species: "gato",
      breed: animal.breed || "DPC",
      sex: animal.sexoCode?.startsWith("H") ? "hembra" : "macho",
      status: "activo",
      notes: animal.notes || animal.observacionesMedicas,
      attributes: {
        shortChip: animal.shortChip,
        hc: animal.hc,
        isFeral: animal.isFeral,
        location: animal.location,
        color: animal.color,
        condicionCorporal: animal.condicionCorporal,
        estadoSalud: animal.estadoSalud,
        tipoIngreso: animal.tipoIngreso,
        edad: animal.edad,
        medicoVeterinario: animal.medicoVeterinario,
        requiereSeguimiento: animal.requiereSeguimiento,
        lastCensusDate: animal.lastCensusDate,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
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
  if (!supabase) return { synced: 0, total: 0 };

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
        notes: a.notes || a.observacionesMedicas,
        attributes: {
          shortChip: a.shortChip,
          hc: a.hc,
          isFeral: a.isFeral,
          location: a.location,
          color: a.color,
          condicionCorporal: a.condicionCorporal,
          estadoSalud: a.estadoSalud,
          tipoIngreso: a.tipoIngreso,
          edad: a.edad,
          medicoVeterinario: a.medicoVeterinario,
          lastCensusDate: a.lastCensusDate,
        },
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
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
