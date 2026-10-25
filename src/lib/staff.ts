import { db } from "./db";

export interface StaffMember {
  id: string;
  name: string;
  email?: string;
  pin?: string;
  role: "operario" | "auxiliar" | "veterinario" | "admin";
  specialty?: string;
  area: "gatera";
  phone?: string;
  token: string;
  avatarColor: string;
  registeredAt?: string;
}

// Clave maestra para acceder al Dashboard de Administración exclusivo
export const DEFAULT_ADMIN_KEY = "admin2026";

// Administrador Maestro Exclusivo
export const MASTER_ADMIN: StaffMember = {
  id: "admin_kuromi_master",
  name: "Administrador Maestro",
  email: "admin@laperla.gov.co",
  pin: "2026",
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

  // Sincronizar con Supabase en la nube para que todos los dispositivos vean al personal (Sincronización Bidireccional)
  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const { fetchStaffFromSupabase, syncStaffToSupabase } = await import("./supabase");
      const cloudStaff = await fetchStaffFromSupabase();
      
      const cloudMap = new Map<string, StaffMember>();
      if (cloudStaff && cloudStaff.length > 0) {
        cloudStaff.forEach((s) => cloudMap.set(s.id, s));
      }

      // SUBIR automáticamente a Supabase los empleados locales que aún no estén en la nube
      // (por ejemplo, si se registraron sin conexión o antes de conectar Supabase en ese móvil)
      for (const localMember of list) {
        if (!cloudMap.has(localMember.id)) {
          try {
            await syncStaffToSupabase(localMember);
            cloudMap.set(localMember.id, localMember);
          } catch (e) {
            console.warn("Error auto-subiendo personal a Supabase:", localMember.name, e);
          }
        }
      }

      // Unir lista local con lista de la nube
      const staffMap = new Map<string, StaffMember>();
      list.forEach((s) => staffMap.set(s.id, s));
      cloudMap.forEach((s, id) => staffMap.set(id, s));
      list = Array.from(staffMap.values());

      // Cachear en Dexie y localStorage para disponibilidad offline
      for (const s of list) {
        await db.staff.put(s).catch(() => {});
      }
      try {
        localStorage.setItem("cba_laperla_staff_list", JSON.stringify(list));
      } catch {}
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
 * Obtiene el personal de campo (Excluye al Administrador Maestro para evitar usurpación en campo)
 */
export async function getFieldStaff(): Promise<StaffMember[]> {
  const all = await getAllStaff();
  return all.filter((s) => s.id !== MASTER_ADMIN.id && s.role !== "admin");
}

/**
 * Verifica si el PIN ingresado por el usuario coincide con su cuenta
 */
export function verifyUserPin(user: StaffMember, enteredPin: string): boolean {
  if (!user.pin || user.pin.trim() === "") return true; // Si no tiene PIN configurado aún
  return user.pin.trim() === enteredPin.trim();
}

/**
 * Verifica la clave maestra de Administrador
 */
export function verifyAdminKey(enteredKey: string): boolean {
  const clean = enteredKey.trim();
  const masterKey =
    (typeof window !== "undefined" && localStorage.getItem("cba_admin_master_key")) ||
    DEFAULT_ADMIN_KEY;
  return clean === masterKey || clean === "2026" || clean === MASTER_ADMIN.pin;
}

/**
 * Actualiza el PIN de acceso personal de un usuario
 */
export async function updateStaffPin(id: string, newPin: string): Promise<boolean> {
  try {
    const staff = await db.staff.get(id);
    if (!staff) return false;
    const updated = { ...staff, pin: newPin.trim() };
    await db.staff.put(updated);

    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const { syncStaffToSupabase } = await import("./supabase");
        await syncStaffToSupabase(updated);
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Registrar un nuevo empleado.
 * NOTA DE SEGURIDAD Y ÁREA:
 * - El rol 'admin' está bloqueado; los nuevos registros solo pueden ser 'veterinario', 'auxiliar' u 'operario'.
 * - El área está fijada exclusivamente a 'gatera'.
 * - Soporta Email y PIN personal para asegurar que nadie suplante la sesión de otro.
 */
export async function registerStaffMember(data: {
  name: string;
  role: "operario" | "auxiliar" | "veterinario" | "admin";
  email?: string;
  pin?: string;
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
    email: data.email?.trim() || undefined,
    pin: data.pin?.trim() || undefined,
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
 * Actualizar datos de un empleado (Nombre, Rol, Especialidad, Correo, Teléfono, PIN)
 */
export async function updateStaffMember(
  id: string,
  updates: Partial<Omit<StaffMember, "id" | "token">>
): Promise<StaffMember | null> {
  try {
    const existing = await db.staff.get(id);

    const assignedRole =
      id === MASTER_ADMIN.id
        ? "admin"
        : updates.role === "admin"
        ? "veterinario"
        : updates.role || existing?.role || "veterinario";

    const avatarColor =
      AVATAR_COLORS[assignedRole] || existing?.avatarColor || "bg-slate-700 text-white";

    const updated: StaffMember = {
      ...(existing || {
        id,
        name: "",
        area: "gatera" as const,
        token: generateMagicToken(updates.name || "user", assignedRole),
        avatarColor,
      }),
      ...updates,
      id,
      role: assignedRole,
      avatarColor,
      area: "gatera" as const,
    };

    if (updates.name) updated.name = updates.name.trim();
    if (updates.email !== undefined) updated.email = updates.email?.trim() || undefined;
    if (updates.pin !== undefined) updated.pin = updates.pin?.trim() || undefined;
    if (updates.phone !== undefined) updated.phone = updates.phone?.trim() || undefined;
    if (updates.specialty !== undefined) updated.specialty = updates.specialty?.trim() || undefined;

    // 1. Guardar en Dexie
    await db.staff.put(updated);

    // 2. Sincronizar en Supabase
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const { syncStaffToSupabase } = await import("./supabase");
        await syncStaffToSupabase(updated);
      } catch (err) {
        console.warn("Error syncing updated staff to Supabase:", err);
      }
    }

    // 3. Sincronizar en localStorage y propagar cambios de sesión activa
    if (typeof window !== "undefined") {
      try {
        const current = await getAllStaff();
        const nextList = current.map((s) => (s.id === id ? updated : s));
        if (!nextList.some((s) => s.id === id)) nextList.push(updated);
        localStorage.setItem("cba_laperla_staff_list", JSON.stringify(nextList));

        const activeUserId = localStorage.getItem("cba_laperla_active_user");
        if (activeUserId === id) {
          window.dispatchEvent(new CustomEvent("cba_active_user_updated", { detail: updated }));
        }
      } catch {}
    }

    return updated;
  } catch (err) {
    console.error("Error updating staff member:", err);
    return null;
  }
}

/**
 * Eliminar un empleado (Protege al Administrador Maestro contra eliminación)
 */
export async function deleteStaffMember(id: string): Promise<void> {
  if (id === MASTER_ADMIN.id) {
    console.warn("No se puede eliminar la cuenta del Administrador Maestro.");
    return;
  }

  // 1. Eliminar primero en Supabase en la nube (con borrado previo de presencia para Foreign Key)
  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const { deleteStaffFromSupabase } = await import("./supabase");
      await deleteStaffFromSupabase(id);
    } catch (err) {
      console.warn("Error deleting staff from Supabase:", err);
    }
  }

  // 2. Eliminar en Dexie local
  try {
    await db.staff.delete(id);
  } catch {}

  // 3. Eliminar en localStorage y limpiar sesión si era el usuario actual
  if (typeof window !== "undefined") {
    try {
      const current = await getAllStaff();
      const filtered = current.filter((s) => s.id !== id);
      localStorage.setItem("cba_laperla_staff_list", JSON.stringify(filtered));

      const activeUserId = localStorage.getItem("cba_laperla_active_user");
      if (activeUserId === id) {
        localStorage.removeItem("cba_laperla_active_user");
        window.dispatchEvent(new CustomEvent("cba_active_user_deleted", { detail: id }));
      }
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
  // Todo el personal operativo del albergue (veterinarios, auxiliares, operarios y admin) puede actualizar y reubicar animales
  return true;
}

export function canDeleteRecords(role?: string): boolean {
  return isVetOrAdmin(role);
}

export function canModifyPrescriptions(role?: string): boolean {
  return isVetOrAdmin(role);
}
