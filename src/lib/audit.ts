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

import * as XLSX from "xlsx";

export interface UserAuditStat {
  userId: string;
  userName: string;
  userRole: string;
  registeredCount: number;
  modifiedCount: number;
  treatmentCount: number;
  censusCount: number;
  tasksCompletedCount: number;
  totalActions: number;
  lastActive: string;
  registeredChips: string[];
  recentLogs: AuditLogEntry[];
}

/**
 * Agrupa y consolida exhaustivamente las estadísticas de registros subidos y acciones por cada usuario.
 * Cruza datos de auditLogs, animales creados, tareas cumplidas y prescripciones en Kardex.
 */
export async function getAuditStatsByUser(): Promise<UserAuditStat[]> {
  const statsMap = new Map<string, UserAuditStat>();

  const getOrCreate = (key: string, name: string, role = "operario"): UserAuditStat => {
    let stat = statsMap.get(key);
    if (!stat) {
      stat = {
        userId: key,
        userName: name,
        userRole: role,
        registeredCount: 0,
        modifiedCount: 0,
        treatmentCount: 0,
        censusCount: 0,
        tasksCompletedCount: 0,
        totalActions: 0,
        lastActive: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        registeredChips: [],
        recentLogs: [],
      };
      statsMap.set(key, stat);
    }
    return stat;
  };

  try {
    // 1. Incorporar logs de auditoría remota de Supabase si hay red
    if (typeof window !== "undefined" && navigator.onLine) {
      try {
        const { fetchAuditLogsFromSupabase } = await import("./supabase");
        const cloudLogs = await fetchAuditLogsFromSupabase();
        for (const cl of cloudLogs) {
          const exists = await db.auditLogs.where("timestamp").equals(cl.timestamp).first();
          if (!exists) {
            await db.auditLogs.add({
              timestamp: cl.timestamp,
              userId: cl.user_id,
              userName: cl.user_name,
              userRole: cl.user_role,
              action: cl.action,
              microchip: cl.microchip,
              animalName: cl.animal_name,
              location: cl.location,
              details: cl.details,
              previousValue: cl.previous_value,
              newValue: cl.new_value,
            }).catch(() => {});
          }
        }
      } catch {}
    }

    // 2. Procesar todos los logs locales
    const allLogs = await db.auditLogs.orderBy("timestamp").reverse().toArray();

    for (const log of allLogs) {
      const key = log.userId || log.userName;
      const stat = getOrCreate(key, log.userName, log.userRole);

      stat.totalActions += 1;
      if (log.timestamp > stat.lastActive) {
        stat.lastActive = log.timestamp;
      }
      if (stat.recentLogs.length < 15) {
        stat.recentLogs.push(log);
      }

      if (log.action === "REGISTRO_ANIMAL") {
        stat.registeredCount += 1;
        if (log.microchip && !stat.registeredChips.includes(log.microchip)) {
          stat.registeredChips.push(log.microchip);
        }
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

    // 3. Cruzar con animales creados en la base de datos (por si no tenían log directo)
    const allAnimals = await db.animals.toArray();
    for (const animal of allAnimals) {
      if (animal.createdBy) {
        const key = animal.createdById || animal.createdBy;
        const stat = getOrCreate(key, animal.createdBy, "veterinario");
        if (!stat.registeredChips.includes(animal.microchip)) {
          stat.registeredChips.push(animal.microchip);
          if (stat.registeredCount < stat.registeredChips.length) {
            stat.registeredCount = stat.registeredChips.length;
          }
        }
        if (animal.createdAt && animal.createdAt > stat.lastActive) {
          stat.lastActive = animal.createdAt;
        }
      }
    }

    // 4. Cruzar con tareas de turnos completadas
    const allTasks = await db.shiftTasks.where("isCompleted").equals(1 as any).toArray();
    for (const task of allTasks) {
      if (task.completedBy) {
        const stat = getOrCreate(task.completedBy, task.completedBy, "auxiliar");
        stat.tasksCompletedCount += 1;
        if (task.completedAt && task.completedAt > stat.lastActive) {
          stat.lastActive = task.completedAt;
        }
      }
    }

    // 5. Cruzar con tratamientos prescritos en Kardex
    const allKardex = await db.kardex.toArray();
    for (const k of allKardex) {
      if (k.prescribedBy) {
        const stat = getOrCreate(k.prescribedBy, k.prescribedBy, "veterinario");
        if (stat.treatmentCount === 0) {
          stat.treatmentCount += 1;
        }
      }
    }
  } catch (err) {
    console.warn("Error calculando estadísticas de auditoría:", err);
  }

  return Array.from(statsMap.values()).sort((a, b) => b.totalActions - a.totalActions);
}

/**
 * Exporta el reporte oficial de actividad de funcionarios y auditoría a un archivo Excel (.xlsx)
 */
export async function exportUserActivityExcelReport(
  stats: UserAuditStat[],
  logs: AuditLogEntry[]
): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen de Productividad por Funcionario
  const statsRows = stats.map((s, idx) => ({
    "N°": idx + 1,
    "FUNCIONARIO": s.userName,
    "ROL / CARGO": s.userRole.toUpperCase(),
    "TOTAL ACCIONES": s.totalActions,
    "FELINOS REGISTRADOS": s.registeredCount,
    "MODIFICACIONES CLÍNICAS": s.modifiedCount,
    "TRATAMIENTOS KARDEX": s.treatmentCount,
    "TAREAS TURNO CUMPLIDAS": s.tasksCompletedCount,
    "CENSOS CONFIRMADOS": s.censusCount,
    "ÚLTIMA ACTIVIDAD": s.lastActive ? new Date(s.lastActive).toLocaleString() : "N/A",
  }));
  const wsStats = XLSX.utils.json_to_sheet(statsRows);
  XLSX.utils.book_append_sheet(wb, wsStats, "ACTIVIDAD_PERSONAL");

  // Hoja 2: Log Cronológico Completo de Acciones
  const logRows = logs.slice(0, 500).map((l, idx) => ({
    "N°": idx + 1,
    "FECHA Y HORA": new Date(l.timestamp).toLocaleString(),
    "FUNCIONARIO": l.userName,
    "ROL": l.userRole.toUpperCase(),
    "ACCIÓN": l.action,
    "MICROCHIP": l.microchip || "N/A",
    "FELINO": l.animalName || "N/A",
    "CANIL / UBICACIÓN": l.location || "N/A",
    "DETALLE": l.details,
    "VALOR PREVIO": l.previousValue || "",
    "VALOR NUEVO": l.newValue || "",
  }));
  const wsLogs = XLSX.utils.json_to_sheet(logRows);
  XLSX.utils.book_append_sheet(wb, wsLogs, "LOG_AUDITORIA_DETALLE");

  const todayStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `CBA_LaPerla_Actividad_Personal_${todayStr}.xlsx`);
}
