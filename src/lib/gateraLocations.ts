import { db } from "./db";

// Catálogo oficial completo de Ubicaciones de GATERA (Columna B: Nº CANIL)
// Extraído fielmente de la Hoja CENSO del archivo maestro Plan de manejo GATERA.xlsx
export const OFFICIAL_GATERA_LOCATIONS: string[] = [
  // --- CUARENTENAS ---
  "CUARENTENA 1",
  "CUARENTENA 2",
  "CUARENTENA 3",
  "CUARENTENA 4",
  "CUARENTENA 5",
  "CUARENTENA 6",
  "CUARENTENA 7",
  "CUARENTENA 8",
  "CUARENTENA 9",
  "CUARENTENA 10",
  "CUARENTENA 11",
  "CUARENTENA 12",
  "CUARENTENA 13",
  "CUARENTENA 14",
  "CUARENTENA 15",
  "CUARENTENA 16",
  "CUARENTENA 17",
  "CUARENTENA 18",
  "CUARENTENA 19",

  // --- UPH (Unidad de Protección y Hospitalización) ---
  "UPH 1",
  "UPH 2",
  "UPH 3",
  "UPH 5",
  "UPH 6",
  "UPH 11",
  "UPH 12",
  "UPH 13",
  "UPH 14",
  "UPH 15",
  "UPH 16",
  "UPH 17",
  "UPH 18",
  "UPH 19",
  "UPH 20",
  "UPH 21",
  "UPH 22",
  "UPH 23",
  "UPH 24",
  "UPH 25",
  "UPH 26",
  "UPH 27",
  "UPH 28",
  "UPH 29",
  "UPH 30",
  "UPH 31",
  "UPH 32",

  // --- HOSPITAL ---
  "HOSPITAL 1",
  "HOSPITAL 2",
  "HOSPITAL 3",
  "HOSPITAL 4",
  "HOSPITAL 5",
  "HOSPITAL 6",
  "HOSPITAL 8",
  "HOSPITAL 9",
  "HOSPITAL 10",
  "HOSPITAL 11",
  "HOSPITAL 12",
  "HOSPITAL 13",
  "HOSPITAL 16",
  "HOSPITAL 17",
  "HOSPITAL 18",
  "HOSPITAL 19",
  "HOSPITAL 20",
  "HOSPITAL 21",

  // --- PATIOS GENERALES ---
  "PATIO 4",
  "PATIO 5",
  "PATIO 5 (4)",
  "PATIO 6",
  "PATIO ADOPCIÓN 8",

  // --- MATERNAS ---
  "MATERNA 1-2",
  "MATERNAS 3",
  "MATERNAS 4-5",
  "MATERNAS 6",
  "MATERANAS 7",
  "MATERNAS 8-9",
  "MATERNAS 10",
  "MATERNAS 11",
  "MATERNAS 12",
  "MATERNAS 13",
  "MATERNAS 14",
  "MATERNAS 15",
  "MATERNAS 15 APM",
  "MATERNAS 16",
  "MATERNAS 17",
  "MATERNAS 18",
  "MATERNAS 19",
  "MATERNAS 20",
  "MATERNAS 21",
  "MATERNAS 22",
  "MATERNAS 23",
  "MATERNAS 24",
  "MATERNAS 25",
  "MATERNAS 26",
  "MATERNAS 27",
  "MATERNAS 28",
  "MATERNAS 29",
  "MATERNAS 30",
  "MATERNAS 31",

  // --- JAULAS FIV / FELV ---
  "JAULA FIV 1",
  "JAULA FIV 2",
  "JAULA FIV 3",
  "JAULA FIV 4",
  "JAULA FIV 5-6",
  "JAULA FIV 7-8",
  "JAULA FIV 9",
  "JAULA FELV 1--2",
  "JAULA FELV 4",
  "JAULA FELV 5",
  "JAULA FELV 6",
  "JAULA FELV 7",
  "JAULA FELV 8",

  // --- PATIOS ESPECIALES: VIF, VILEF, LEUCEMIA ---
  "PATIO INTERNO VILEF",
  "PATIOA INTERNO",
  "PATIO 7 LEUCEMIA +",
  "PATIO 7 LEUCEMIA + apm",
  "DOBLE POSITIVO",
  "PATIO INTERNO VIF",
  "PATIO 1 VIF",
  "PATIO 2-3 VIF",

  // --- PATIOS FERALES ---
  "PATIO 1 FERALES",
  "PATIO 2 FERALES",
  "PATIO 3 FERALES",

  // --- ESTADOS Y DESTINOS OPERATIVOS ---
  "PREPARACIÓN",
  "REMITIDO",
  "FUGADO",
  "FALLECIDO",
];

// Categorías para filtrado rápido y visualización organizada en la interfaz
export const GATERA_LOCATION_GROUPS = [
  {
    name: "Cuarentenas",
    prefix: "CUARENTENA",
    badge: "🛑 Cuarentena",
  },
  {
    name: "UPH",
    prefix: "UPH",
    badge: "🩺 UPH",
  },
  {
    name: "Hospital",
    prefix: "HOSPITAL",
    badge: "🏥 Hospital",
  },
  {
    name: "Maternidades",
    prefix: "MATERN",
    badge: "🍼 Maternas",
  },
  {
    name: "Patios Generales",
    prefix: "PATIO",
    badge: "🌳 Patios",
  },
  {
    name: "Patios Ferales",
    prefix: "FERAL",
    badge: "⚠️ Ferales",
  },
  {
    name: "VIF / FeLV / Leucemia",
    prefix: "VIF",
    badge: "🧪 VIF/FeLV",
  },
  {
    name: "Jaulas FIV/FeLV",
    prefix: "JAULA",
    badge: "📦 Jaulas",
  },
  {
    name: "Fallecidos",
    prefix: "FALLECIDO",
    badge: "🕊️ Fallecidos",
  },
];

/**
 * Función de utilidad para comprobar si un felino o ubicación corresponde a un animal fallecido
 */
export function isDeceased(item?: { location?: string; ubicacion?: string; status?: string } | string | null): boolean {
  if (!item) return false;
  if (typeof item === "string") {
    return item.trim().toUpperCase() === "FALLECIDO";
  }
  const loc = (item.location || item.ubicacion || "").trim().toUpperCase();
  const stat = (item.status || "").trim().toLowerCase();
  return loc === "FALLECIDO" || stat === "fallecido";
}

/**
 * Obtiene todas las ubicaciones conocidas:
 * Las oficiales del Excel maestro + CUALQUIER NUEVA UBICACIÓN que el usuario haya registrado en la base de datos local.
 * De esta forma, el usuario puede ingresar libremente nuevas ubicaciones y el sistema las aprende dinámicamente.
 */
export async function getAllGateraLocations(): Promise<string[]> {
  const locationsSet = new Set<string>(OFFICIAL_GATERA_LOCATIONS.map((loc) => loc.trim().toUpperCase()));

  try {
    // 1. Ubicaciones registradas en db.animals
    const animals = await db.animals.toArray();
    for (const a of animals) {
      if (a.location && a.location.trim()) {
        locationsSet.add(a.location.trim().toUpperCase());
      }
    }

    // 2. Ubicaciones en db.gateraRecords
    const cats = await db.gateraRecords.toArray();
    for (const c of cats) {
      if (c.ubicacion && c.ubicacion.trim()) {
        locationsSet.add(c.ubicacion.trim().toUpperCase());
      }
    }

    // 3. Ubicaciones en db.census
    const census = await db.census.toArray();
    for (const item of census) {
      if (item.location && item.location.trim()) {
        locationsSet.add(item.location.trim().toUpperCase());
      }
    }
  } catch (err) {
    console.error("Error al cargar ubicaciones dinámicas:", err);
  }

  // Devolver ordenado alfabéticamente
  return Array.from(locationsSet).sort((a, b) => {
    // Si ambas comienzan con el mismo prefijo (ej: CUARENTENA 1 vs CUARENTENA 2), ordenar numéricamente
    const matchA = a.match(/^([A-Za-z\s]+)\s*(\d+)/);
    const matchB = b.match(/^([A-Za-z\s]+)\s*(\d+)/);
    if (matchA && matchB && matchA[1] === matchB[1]) {
      return parseInt(matchA[2], 10) - parseInt(matchB[2], 10);
    }
    return a.localeCompare(b);
  });
}
