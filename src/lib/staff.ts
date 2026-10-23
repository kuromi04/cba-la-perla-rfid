import { db } from "./db";

export interface StaffMember {
  id: string;
  name: string;
  role: "operario" | "auxiliar" | "veterinario" | "admin";
  specialty?: string;
  area: "caninos" | "gatera" | "ambas";
  phone?: string;
  token: string;
  avatarColor: string;
  registeredAt?: string;
}

// Array vacío inicial: Sin datos precargados. Cada empleado se registra de nuevo.
export const SHELTER_STAFF: StaffMember[] = [];

const AVATAR_COLORS: Record<string, string> = {
  veterinario: "bg-emerald-700 text-white",
  auxiliar: "bg-amber-600 text-white",
  operario: "bg-blue-600 text-white",
  admin: "bg-purple-800 text-white",
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
 */
export async function getAllStaff(): Promise<StaffMember[]> {
  try {
    const list = await db.staff.toArray();
    if (list && list.length > 0) return list;
  } catch (err) {
    console.error("Error reading staff from Dexie:", err);
  }

  // Respaldo en localStorage
  if (typeof window !== "undefined") {
    try {
      const local = localStorage.getItem("cba_laperla_staff_list");
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }

  return [];
}

/**
 * Registrar un nuevo empleado (Médico Veterinario, Auxiliar, Operario o Admin)
 */
export async function registerStaffMember(data: {
  name: string;
  role: "operario" | "auxiliar" | "veterinario" | "admin";
  specialty?: string;
  area: "caninos" | "gatera" | "ambas";
  phone?: string;
}): Promise<StaffMember> {
  const cleanId = data.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_") + "_" + Date.now().toString().slice(-4);

  const token = generateMagicToken(data.name, data.role);
  const avatarColor = AVATAR_COLORS[data.role] || "bg-slate-700 text-white";

  const newMember: StaffMember = {
    id: cleanId,
    name: data.name.trim(),
    role: data.role,
    specialty: data.specialty?.trim() || (data.role === "veterinario" ? "Médico Veterinario" : data.role.toUpperCase()),
    area: data.area,
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
 * Eliminar un empleado
 */
export async function deleteStaffMember(id: string): Promise<void> {
  try {
    await db.staff.delete(id);
  } catch {}

  if (typeof window !== "undefined") {
    try {
      const current = await getAllStaff();
      const filtered = current.filter((s) => s.id !== id);
      localStorage.setItem("cba_laperla_staff_list", JSON.stringify(filtered));
    } catch {}
  }
}

/**
 * Permisos CBA La Perla:
 * Médicos Veterinarios y Administrador pueden modificar o eliminar animales.
 */
export function canEditAnimals(role?: string): boolean {
  if (!role) return false;
  return role === "veterinario" || role === "admin";
}
