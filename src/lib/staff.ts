import { db } from "./db";

export interface StaffMember {
  id: string;
  name: string;
  role: "operario" | "auxiliar" | "veterinario" | "admin";
  specialty?: string;
  area: "gatera";
  phone?: string;
  token: string;
  avatarColor: string;
  registeredAt?: string;
}

// Administrador Maestro Exclusivo (Kuromi)
export const MASTER_ADMIN: StaffMember = {
  id: "admin_kuromi_master",
  name: "Administrador Maestro",
  role: "admin",
  specialty: "Dirección y Control General",
  area: "gatera",
  phone: "",
  token: "magic_admin_kuromi_master_cba",
  avatarColor: "bg-purple-900 text-white",
  registeredAt: "2026-01-01T00:00:00.000Z",
};

// Array vacío inicial: Sin datos precargados. Cada empleado se registra de nuevo.
export const SHELTER_STAFF: StaffMember[] = [MASTER_ADMIN];

const AVATAR_COLORS: Record<string, string> = {
  veterinario: "bg-emerald-700 text-white",
  auxiliar: "bg-amber-600 text-white",
  operario: "bg-blue-600 text-white",
  admin: "bg-purple-900 text-white",
};

/**
 * Genera un token único y seguro para el Link Mágico de cada empleado
 */
export function generateMagicToken(name: string, role: string): string {
  const cleanName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .slice(0, 15);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `magic_${cleanName}_${role}_${randomSuffix}`;
}

/**
 * Obtener todos los empleados registrados (de IndexedDB + localStorage)
 * Garantiza que MASTER_ADMIN sea siempre el único admin del sistema.
 */
export async function getAllStaff(): Promise<StaffMember[]> {
  let list: StaffMember[] = [];

  try {
    const fromDb = await db.staff.toArray();
    if (fromDb && fromDb.length > 0) {
      list = fromDb;
    }
  } catch (err) {
    console.error("Error reading staff from Dexie:", err);
  }

  // Respaldo en localStorage si db estaba vacío
  if (list.length === 0 && typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("cba_laperla_staff_list");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
      }
    } catch {}
  }

  // Sincronizar con Supabase en la nube para que todos los dispositivos vean al personal
  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const { fetchStaffFromSupabase } = await import("./supabase");
      const cloudStaff = await fetchStaffFromSupabase();
      if (cloudStaff && cloudStaff.length > 0) {
        // Combinar evitando duplicados
        const staffMap = new Map<string, StaffMember>();
        list.forEach((s) => staffMap.set(s.id, s));
        cloudStaff.forEach((s) => staffMap.set(s.id, s));
        list = Array.from(staffMap.values());

        // Cachear en Dexie para disponibilidad offline
        for (const s of cloudStaff) {
          await db.staff.put(s).catch(() => {});
        }
      }
    } catch (err) {
      console.warn("Supabase staff sync non-blocking error:", err);
    }
  }

  // REGLA DE ORO: Solo el usuario creador (MASTER_ADMIN) puede ser 'admin'.
  // Cualquier otro usuario que intente tener 'admin' se normaliza a 'veterinario'.
  // REGLA GATERA EXCLUSIVA: Todo el personal opera exclusivamente en 'gatera'.
  list = list.map((member) => {
    let updatedRole = member.role;
    if (member.id !== MASTER_ADMIN.id && member.role === "admin") {
      updatedRole = "veterinario";
    }
    return {
      ...member,
      role: updatedRole,
      area: "gatera" as const,
    };
  });

  // Asegurar que el Master Admin esté siempre presente al inicio
  if (!list.some((s) => s.id === MASTER_ADMIN.id)) {
    list = [MASTER_ADMIN, ...list];
    try {
      await db.staff.put(MASTER_ADMIN);
    } catch {}
  }

  return list;
}

/**
 * Registrar un nuevo empleado.
 * NOTA DE SEGURIDAD Y ÁREA:
 * - El rol 'admin' está bloqueado; los nuevos registros solo pueden ser 'veterinario', 'auxiliar' u 'operario'.
 * - El área está fijada exclusivamente a 'gatera'.
 */
export async function registerStaffMember(data: {
  name: string;
  role: "operario" | "auxiliar" | "veterinario" | "admin";
  specialty?: string;
  area?: "gatera";
  phone?: string;
}): Promise<StaffMember> {
  // Blindaje: si alguien intenta enviar 'admin', se le asigna 'veterinario'
  const assignedRole: "operario" | "auxiliar" | "veterinario" =
    data.role === "admin" ? "veterinario" : data.role;

  const cleanId =
    data.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_") +
    "_" +
    Date.now().toString().slice(-4);

  const token = generateMagicToken(data.name, assignedRole);
  const avatarColor = AVATAR_COLORS[assignedRole] || "bg-slate-700 text-white";

  const newMember: StaffMember = {
    id: cleanId,
    name: data.name.trim(),
    role: assignedRole,
    specialty:
      data.specialty?.trim() ||
      (assignedRole === "veterinario"
        ? "Médico Veterinario Gatera"
        : assignedRole === "auxiliar"
        ? "Auxiliar Veterinario Gatera"
        : "Operario de Albergue Gatera"),
    area: "gatera",
    phone: data.phone?.trim() || "",
    token,
    avatarColor,
    registeredAt: new Date().toISOString(),
  };

  try {
    await db.staff.put(newMember);
  } catch (err) {
    console.error("Error saving to Dexie staff:", err);
  }

  // Sincronizar en Supabase en la nube para visibilidad instantánea en todos los dispositivos
  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const { syncStaffToSupabase } = await import("./supabase");
      await syncStaffToSupabase(newMember);
    } catch (err) {
      console.warn("Error syncing new staff to Supabase:", err);
    }
  }

  // Sincronizar en localStorage
  if (typeof window !== "undefined") {
    try {
      const current = await getAllStaff();
      const updated = [...current.filter((s) => s.id !== newMember.id), newMember];
      localStorage.setItem("cba_laperla_staff_list", JSON.stringify(updated));
    } catch {}
  }

  return newMember;
}

/**
 * Eliminar un empleado (Protege al Administrador Maestro contra eliminación)
 */
export async function deleteStaffMember(id: string): Promise<void> {
  if (id === MASTER_ADMIN.id) {
    console.warn("No se puede eliminar la cuenta del Administrador Maestro.");
    return;
  }

  try {
    await db.staff.delete(id);
  } catch {}

  // Eliminar en Supabase en la nube
  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const { supabase } = await import("./supabase");
      if (supabase) {
        await supabase.from("staff").delete().eq("id", id);
        await supabase.from("staff_presence").delete().eq("staff_id", id);
      }
    } catch (err) {
      console.warn("Error deleting staff from Supabase:", err);
    }
  }

  if (typeof window !== "undefined") {
    try {
      const current = await getAllStaff();
      const filtered = current.filter((s) => s.id !== id);
      localStorage.setItem("cba_laperla_staff_list", JSON.stringify(filtered));
    } catch {}
  }
}

/**
 * REGLAS DE ORO DEL SISTEMA CBA LA PERLA:
 * 1. Solo Médicos Veterinarios ('veterinario') y Administradores ('admin')
 *    tienen autorización para:
 *    - Editar datos clínicos o ubicaciones de animales
 *    - Eliminar registros o depurar censos
 *    - Prescribir, modificar o suspender tratamientos en Kardex
 *    - Alterar las planillas maestras
 * 2. Operarios y Auxiliares tienen permisos de lectura, verificación en censo,
 *    escaneo de chips y registro de dosis aplicadas en su turno de campo.
 */
export function isVetOrAdmin(role?: string): boolean {
  if (!role) return false;
  return role === "veterinario" || role === "admin";
}

export function canEditAnimals(role?: string): boolean {
  return isVetOrAdmin(role);
}

export function canDeleteRecords(role?: string): boolean {
  return isVetOrAdmin(role);
}

export function canModifyPrescriptions(role?: string): boolean {
  return isVetOrAdmin(role);
}
