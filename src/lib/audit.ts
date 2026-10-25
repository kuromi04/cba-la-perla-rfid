import { db, AuditLogEntry } from "./db";
import { StaffMember } from "./staff";

/**
 * Registra una acción de auditoría en IndexedDB y la transmite a Supabase en segundo plano.
 */
export async function recordAudit(data: {
  action: AuditLogEntry["action"];
  microchip: string;
  animalName?: string;
  location?: string;
  details: string;
  previousValue?: string;
  newValue?: string;
  user?: StaffMember | null;
}): Promise<AuditLogEntry> {
  const timestamp = new Date().toISOString();
  const userId = data.user?.id || "anon_user";
  const userName = data.user?.name || "Personal CBA La Perla";
  const userRole = data.user?.role || "operario";

  const entry: AuditLogEntry = {
    timestamp,
    userId,
    userName,
    userRole,
    action: data.action,
    microchip: data.microchip,
    animalName: data.animalName,
    location: data.location,
    details: data.details,
    previousValue: data.previousValue,
    newValue: data.newValue,
  };

  try {
    const id = await db.auditLogs.add(entry);
    entry.id = id;
  } catch (err) {
    console.warn("Error guardando log de auditoría en IndexedDB:", err);
  }

  // Transmitir a Supabase en segundo plano si hay red
  if (typeof window !== "undefined" && navigator.onLine) {
    try {
      const { syncAuditLogToSupabase } = await import("./supabase");
      syncAuditLogToSupabase(entry).catch((e) =>
        console.warn("Audit log sync non-blocking error:", e)
      );
    } catch {}
  }

  return entry;
}

/**
 * Obtiene los últimos logs de auditoría ordenados del más reciente al más antiguo.
 */
export async function getAuditLogs(limit = 200): Promise<AuditLogEntry[]> {
  try {
    const logs = await db.auditLogs.orderBy("timestamp").reverse().limit(limit).toArray();
    return logs;
  } catch (err) {
    console.warn("Error obteniendo logs de auditoría:", err);
    return [];
  }
}

export interface UserAuditStat {
  userId: string;
  userName: string;
  userRole: string;
  registeredCount: number;
  modifiedCount: number;
  treatmentCount: number;
  censusCount: number;
  totalActions: number;
  lastActive: string;
}

/**
 * Agrupa y consolida las estadísticas de registros subidos y acciones por usuario.
 */
export async function getAuditStatsByUser(): Promise<UserAuditStat[]> {
  const statsMap = new Map<string, UserAuditStat>();

  try {
    const allLogs = await db.auditLogs.toArray();

    for (const log of allLogs) {
      const key = log.userId || log.userName;
      let stat = statsMap.get(key);

      if (!stat) {
        stat = {
          userId: log.userId,
          userName: log.userName,
          userRole: log.userRole,
          registeredCount: 0,
          modifiedCount: 0,
          treatmentCount: 0,
          censusCount: 0,
          totalActions: 0,
          lastActive: log.timestamp,
        };
        statsMap.set(key, stat);
      }

      stat.totalActions += 1;
      if (log.timestamp > stat.lastActive) {
        stat.lastActive = log.timestamp;
      }

      if (log.action === "REGISTRO_ANIMAL") {
        stat.registeredCount += 1;
      } else if (
        log.action === "MODIFICACION_ANIMAL" ||
        log.action === "CAMBIO_UBICACION" ||
        log.action === "CAMBIO_COLOR" ||
        log.action === "FOTO_SUBIDA" ||
        log.action === "FOTO_ELIMINADA" ||
        log.action === "BAJA_FALLECIDO"
      ) {
        stat.modifiedCount += 1;
      } else if (log.action === "TRATAMIENTO_PRESCRITO" || log.action === "TRATAMIENTO_EDITADO") {
        stat.treatmentCount += 1;
      } else if (log.action === "CENSO_CONFIRMADO") {
        stat.censusCount += 1;
      }
    }
  } catch (err) {
    console.warn("Error calculando estadísticas de auditoría:", err);
  }

  return Array.from(statsMap.values()).sort((a, b) => b.totalActions - a.totalActions);
}
