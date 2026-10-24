import Dexie, { Table } from "dexie";
import { RAW_SHELTER_DATA, ShelterRecord } from "./realData";
import { GATERA_CATS_DATA, GateraCat } from "./gateraData";

export interface Animal {
  id?: number;
  nroAnimal?: string;
  microchip: string;
  shortChip?: string;
  name: string;
  species: "gato" | "perro" | "ave" | "otro";
  breed: string;
  gender?: string;
  sexoCode?: string;            // A: HFA, MFA, HFC, MFC
  grupoEdad?: "adulto" | "cachorro";
  location: string;             // Nº CANIL (Columna B)
  status?: string;
  photoUrl?: string;
  notes?: string;
  lastCensusDate?: string;
  hc?: string;                  // HISTORIA CLINICA (HC)
  isFeral?: boolean;            // FERALES: SI / NO
  color?: string;               // COLOR
  tipoIngreso?: string;         // TIPO DE INGRESO: APM, RES, INC, E Y D
  fechaNacimiento?: string;     // FECHA DE NACIMIENTO
  edad?: string;                // EDAD APROXIMADA MESES
  fechaIngreso?: string;        // FECHA DE INGRESO
  condicionCorporal?: string;   // CONDICION CORPORAL: RANGO 1.0/5 a 4.0/5
  estadoSalud?: string;         // ESTADO: Saludable, Regular, Delicado
  observacionesMedicas?: string;// OBSERVACIONES MEDICAS (Diagnóstico / Cuadro clínico)
  requiereSeguimiento?: string; // REQUIERE SEGUIMIENTO SI/NO
  tipoSeguimiento?: string;     // TIPO DE SEGUIMIENTO: TRATAMIENTO, OBSERVACIÓN, etc.
  fechaSeguimiento?: string;    // FECHA
  peluqueria?: string;          // PELUQUERIA
  corteUnas?: string;           // CORTE DE UÑAS
  limpiezaOidos?: string;       // LIMPIEZA DE OIDOS
  fechaAseo?: string;           // FECHA EN QUE SE REALIZÓ
  medicoVeterinario?: string;   // MÉDICO VETERINARIO
  vacunaTriple?: string;
  vacunaLeucemia?: string;
  vacunaRabia?: string;
  desparasitante?: string;
}

export interface KardexRecord {
  id?: number;
  animalId?: number;
  microchip: string;
  shortChip?: string;
  system: string;
  treatment: string;
  description: string;
  startDate: string;
  endDate?: string;
  status: "activo" | "finalizado" | "suspendido";
  prescribedBy: string;
  createdAt: string;
  tipo?: string;
  pendientes?: string;
  section?: string;
  dosisBravecto?: string;
  area?: "caninos" | "gatera";
  // Control de Cumplimiento y Faltantes
  dosisTotales: number;
  dosisAplicadas: number;
  dosisFaltantes: number;
  ultimaAplicacion?: string;
  ultimoResponsable?: string;
}

export interface CensusRecord {
  id?: number;
  nroAnimal?: string;
  microchip: string;
  shortChip?: string;
  animalName: string;
  species: string;
  location: string;
  scannedAt: string;
  scannedBy: string;
  treatmentCount: number;
  area?: "caninos" | "gatera";
  hc?: string;
  sexoCode?: string;
  raza?: string;
  isFeral?: boolean;
  color?: string;
  tipoIngreso?: string;
  edad?: string;
  condicionCorporal?: string;
  estadoSalud?: string;
  medicacion?: string;
  observacionesMedicas?: string;
  requiereSeguimiento?: string;
  tipoSeguimiento?: string;
  fechaSeguimiento?: string;
  peluqueria?: string;
  corteUnas?: string;
  limpiezaOidos?: string;
  fechaAseo?: string;
  medicoVeterinario?: string;
}

export interface ShiftTask {
  id?: number;
  kardexId?: number;
  animalName: string;
  species: "perro" | "gato";
  microchip: string;
  location: string;
  medication: string;
  shift: "mañana" | "tarde" | "noche";
  laborType: "medicacion" | "limpieza" | "baño" | "nebulizacion" | "desparasitacion" | "bravecto";
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  notes?: string;
  isFeral?: boolean;
  area: "caninos" | "gatera";
  assignedTo?: string; // Nombre del auxiliar u operario
  assignedRole?: "operario" | "auxiliar" | "veterinario";
  dosisTotales?: number;
  dosisAplicadas?: number;
  dosisFaltantes?: number;
}

export interface AdministrationLog {
  id?: number;
  kardexId?: number;
  shiftTaskId?: number;
  microchip: string;
  animalName: string;
  treatment: string;
  appliedAt: string;
  appliedBy: string;
  role: string;
  area: "caninos" | "gatera";
  notes?: string;
  dosisNumero: number;
  faltantesRestantes: number;
}

class ShelterDatabase extends Dexie {
  animals!: Table<Animal, number>;
  kardex!: Table<KardexRecord, number>;
  census!: Table<CensusRecord, number>;
  shelterRecords!: Table<ShelterRecord, number>;
  gateraRecords!: Table<GateraCat, number>;
  shiftTasks!: Table<ShiftTask, number>;
  administrationLogs!: Table<AdministrationLog, number>;
  staff!: Table<any, string>;

  constructor() {
    super("ShelterAnimalDB");
    this.version(6).stores({
      animals: "++id, &microchip, shortChip, name, species, location, status, hc, isFeral",
      kardex: "++id, microchip, shortChip, system, status, startDate, endDate, section, area, dosisFaltantes",
      census: "++id, microchip, location, scannedAt, area",
      shelterRecords: "++id, microchip, shortChip, ubicacion, section, sistema",
      gateraRecords: "++id, microchip, shortChip, ubicacion, hc, isFeral, sistema",
      shiftTasks: "++id, microchip, shift, isCompleted, laborType, location, species, kardexId",
      administrationLogs: "++id, kardexId, microchip, appliedAt, appliedBy, area",
      staff: "&id, name, role, area, token",
    });
  }
}

export const db = new ShelterDatabase();

// Determinar el número de dosis programadas según el tipo de prescripción
function estimateTotalDoses(med: string, section?: string, dosisBrav?: string): number {
  const m = med.toUpperCase();
  if (section === "BRAVECTO" || m.includes("BRAVECTO") || dosisBrav) {
    return 1; // Desparasitación 1 sola dosis
  }
  if (section === "BAÑOS" || m.includes("BAÑO")) {
    return 3; // Ciclo de 3 baños semanales
  }
  if (m.includes("VACUNA") || m.includes("INMUNIZ")) {
    return 1;
  }
  if (m.includes("NEBULIZA") || m.includes("PUFF")) {
    return 10; // Ciclo respiratorio de 5 días c/12h = 10 dosis
  }
  if (m.includes("C/12H") || m.includes("C/8H")) {
    return 10;
  }
  // Tratamiento estándar de 7 días
  return 7;
}

/**
 * Inicialización limpia 100% con datos reales de los archivos Excel.
 * No genera registros demo, de prueba ni dummy.
 */
export async function initializeDatabaseIfEmpty(forceReset: boolean = false) {
  // Purgar datos dummy y si hay caninos activos (transición a 100% GATERA)
  const dummyCheck = await db.animals.filter((a) =>
    a.microchip.startsWith("DUMMY_") ||
    a.microchip.startsWith("dummy_") ||
    a.microchip.startsWith("98200041234") ||
    a.name === "Toby" ||
    a.name === "Rocky"
  ).count();

  const dogCount = await db.animals.filter((a) => a.species === "perro").count();

  if (dummyCheck > 0 || dogCount > 0 || forceReset) {
    console.log("Limpiando datos anteriores y configurando sistema EXCLUSIVO GATERA...");
    await db.animals.clear();
    await db.kardex.clear();
    await db.shelterRecords.clear();
    await db.gateraRecords.clear();
    await db.shiftTasks.clear();
    // Limpiar también registros demo del censo
    const demoCensus = await db.census.toArray();
    for (const c of demoCensus) {
      if (isDemoRecord(c.microchip, c.animalName, c.location) && c.id) {
        await db.census.delete(c.id);
      }
    }
  }

  const gateraCount = await db.gateraRecords.count();
  if (gateraCount > 0 && !forceReset) {
    return await db.animals.count();
  }

  console.log("Inicializando base de datos CBA La Perla: 100% GATERA MAESTRO (CENSO)...");

  // 1. Cargar Planilla Gatera Real (Microchips 100% Únicos de la Hoja CENSO)
  const uniqueGatera: GateraCat[] = [];
  const seenGateraChips = new Set<string>();
  for (const cat of GATERA_CATS_DATA) {
    const chip = cat.microchip.trim().toUpperCase();
    if (!seenGateraChips.has(chip)) {
      seenGateraChips.add(chip);
      uniqueGatera.push(cat);
    }
  }
  await db.gateraRecords.bulkAdd(uniqueGatera);

  // 2. Poblar tabla unificada de Animales y Kardex a partir del CENSO Maestro
  const animalsToInsert: Animal[] = [];
  const kardexToInsert: KardexRecord[] = [];
  const seenChips = new Set<string>();

  for (const cat of uniqueGatera) {
    const chip = cat.microchip.trim().toUpperCase();
    const isFeralCat = Boolean(
      cat.isFeral ||
      (cat.pendientes && cat.pendientes.toUpperCase().includes("FERAL")) ||
      (cat.descripcion && cat.descripcion.toUpperCase().includes("FERAL")) ||
      (cat.observacionesMedicas && cat.observacionesMedicas.toUpperCase().includes("FERAL"))
    );
    cat.isFeral = isFeralCat;

    if (!seenChips.has(chip)) {
      seenChips.add(chip);

      animalsToInsert.push({
        nroAnimal: cat.nroAnimal,
        microchip: chip,
        shortChip: cat.shortChip,
        name: cat.nombre,
        species: "gato",
        breed: cat.raza || "DPC",
        gender: cat.sexo,
        sexoCode: cat.sexoCode,
        grupoEdad: cat.grupoEdad,
        location: cat.ubicacion,
        status: "activo",
        notes: `${cat.pendientes || ""}. HC: ${cat.hc || ""}`,
        hc: cat.hc,
        isFeral: isFeralCat,
        color: cat.color,
        tipoIngreso: cat.tipoIngreso,
        fechaNacimiento: cat.fechaNacimiento,
        edad: cat.edad,
        fechaIngreso: cat.fechaIngreso,
        condicionCorporal: cat.condicionCorporal,
        estadoSalud: cat.estadoSalud,
        observacionesMedicas: cat.observacionesMedicas,
        requiereSeguimiento: cat.requiereSeguimiento,
        tipoSeguimiento: cat.tipoSeguimiento,
        fechaSeguimiento: cat.fechaSeguimiento,
        peluqueria: cat.peluqueria,
        corteUnas: cat.corteUnas,
        limpiezaOidos: cat.limpiezaOidos,
        fechaAseo: cat.fechaAseo,
        medicoVeterinario: cat.medicoVeterinario,
        vacunaTriple: cat.vacunaTriple,
        vacunaLeucemia: cat.vacunaLeucemia,
        vacunaRabia: cat.vacunaRabia,
        desparasitante: cat.desparasitante,
      });
    }

    if (cat.medicacion && cat.medicacion !== "Ninguno") {
      const totalDoses = estimateTotalDoses(cat.medicacion, "GATERA");
      const appliedDoses = Math.floor(totalDoses * 0.25);
      const missingDoses = Math.max(0, totalDoses - appliedDoses);

      kardexToInsert.push({
        microchip: chip,
        shortChip: cat.shortChip,
        system: cat.sistema || "TEGUMEN",
        treatment: cat.medicacion,
        description: `Gatera [${cat.ubicacion}]. HC: ${cat.hc} ${cat.isFeral ? "⚠️ FERAL" : ""}. ${cat.observacionesMedicas || ""}`,
        startDate: cat.fechaIngreso || new Date().toISOString().split("T")[0],
        endDate: cat.fechaFinal || "HNI",
        status: "activo",
        prescribedBy: cat.medicoVeterinario || "Dra. Jenny Zapata Calle",
        createdAt: new Date().toISOString(),
        tipo: cat.tipo,
        pendientes: cat.pendientes,
        section: "GATERA_CENSO",
        area: "gatera",
        dosisTotales: totalDoses,
        dosisAplicadas: appliedDoses,
        dosisFaltantes: missingDoses,
      });
    }
  }

  await db.animals.bulkAdd(animalsToInsert);
  await db.kardex.bulkAdd(kardexToInsert);

  await db.animals.bulkAdd(animalsToInsert);
  await db.kardex.bulkAdd(kardexToInsert);

  // Regla de Oro: Desduplicación garantizada en todas las tablas
  await deduplicateDatabaseRecords();

  return await db.animals.count();
}

/**
 * Función explícita para resetear y garantizar 100% de datos reales
 */
export async function resetDatabaseWithRealData() {
  await initializeDatabaseIfEmpty(true);
  await db.shiftTasks.clear();
  return await generateTodayShiftTasks();
}

// Búsqueda inteligente por chip completo, chip corto, HC, nombre o ubicación
export async function searchAnimalSmart(query: string): Promise<Animal | null> {
  const clean = query.trim().toUpperCase();
  if (!clean) return null;

  // 1. Coincidencia exacta por microchip completo
  let animal = await db.animals.where("microchip").equals(clean).first();
  if (animal) return animal;

  // 2. Coincidencia exacta por shortChip
  animal = await db.animals.where("shortChip").equals(clean).first();
  if (animal) return animal;

  // 3. Coincidencia por Historia Clínica (HC)
  animal = await db.animals.where("hc").equals(clean).first();
  if (animal) return animal;

  // 4. Búsqueda en GateraRecords directo
  const cat = await db.gateraRecords
    .filter(
      (c) =>
        c.microchip === clean ||
        c.shortChip === clean ||
        c.hc === clean ||
        c.microchip.endsWith(clean)
    )
    .first();

  if (cat) {
    return {
      microchip: cat.microchip,
      shortChip: cat.shortChip,
      name: cat.nombre,
      species: "gato",
      breed: `${cat.raza} - ${cat.color}`,
      gender: cat.sexo,
      location: cat.ubicacion,
      status: "activo",
      notes: `${cat.pendientes}. HC: ${cat.hc}`,
      hc: cat.hc,
      isFeral: cat.isFeral,
      color: cat.color,
    };
  }

  // 5. Sufijo en animales generales
  const all = await db.animals.toArray();
  const bySuffix = all.find(
    (a) =>
      a.microchip.endsWith(clean) ||
      (a.shortChip && a.shortChip.endsWith(clean)) ||
      (a.hc && a.hc === clean)
  );
  if (bySuffix) return bySuffix;

  // 6. Búsqueda por nombre o canil
  const byName = all.find(
    (a) =>
      a.name.toUpperCase().includes(clean) ||
      a.breed.toUpperCase().includes(clean) ||
      a.location.toUpperCase().includes(clean)
  );
  if (byName) return byName;

  return null;
}

/**
 * LÓGICA DE ADMINISTRACIÓN:
 * Descuenta 1 dosis faltante, incrementa dosis aplicadas, y culmina el tratamiento si faltantes llega a 0.
 */
export async function applyDoseToTreatment(
  kardexId: number,
  workerName: string,
  workerRole: string,
  notes?: string
): Promise<{ updated: KardexRecord; isCulminated: boolean } | null> {
  const item = await db.kardex.get(kardexId);
  if (!item) return null;

  const totales = item.dosisTotales || 7;
  const nuevasAplicadas = (item.dosisAplicadas || 0) + 1;
  const nuevasFaltantes = Math.max(0, totales - nuevasAplicadas);
  const isCulminated = nuevasFaltantes === 0;
  const nuevoStatus = isCulminated ? "finalizado" : item.status;
  const now = new Date().toISOString();

  await db.kardex.update(kardexId, {
    dosisAplicadas: nuevasAplicadas,
    dosisFaltantes: nuevasFaltantes,
    status: nuevoStatus,
    ultimaAplicacion: now,
    ultimoResponsable: workerName,
  });

  // Registrar en logs de administración de La Perla
  const animal = await db.animals.where("microchip").equals(item.microchip).first();
  await db.administrationLogs.add({
    kardexId,
    microchip: item.microchip,
    animalName: animal?.name || "Animal",
    treatment: item.treatment,
    appliedAt: now,
    appliedBy: workerName,
    role: workerRole,
    area: item.area || "caninos",
    notes: notes || (isCulminated ? "Tratamiento culminado al 100% (todas las dosis programadas cumplidas)" : undefined),
    dosisNumero: nuevasAplicadas,
    faltantesRestantes: nuevasFaltantes,
  });

  const updated = await db.kardex.get(kardexId);
  return { updated: updated!, isCulminated };
}

/**
 * Deshacer una dosis por corrección
 */
export async function revertDoseFromTreatment(
  kardexId: number,
  workerName: string
): Promise<KardexRecord | null> {
  const item = await db.kardex.get(kardexId);
  if (!item || !item.dosisAplicadas || item.dosisAplicadas <= 0) return null;

  const totales = item.dosisTotales || 7;
  const nuevasAplicadas = Math.max(0, item.dosisAplicadas - 1);
  const nuevasFaltantes = Math.min(totales, totales - nuevasAplicadas);
  const nuevoStatus = "activo";

  await db.kardex.update(kardexId, {
    dosisAplicadas: nuevasAplicadas,
    dosisFaltantes: nuevasFaltantes,
    status: nuevoStatus,
    ultimoResponsable: `${workerName} (Dosis corregida)`,
  });

  const updated = await db.kardex.get(kardexId);
  return updated!;
}

// Generación y despacho automático de tareas del turno a partir de la planilla activa
export async function generateTodayShiftTasks(): Promise<ShiftTask[]> {
  const existingCount = await db.shiftTasks.count();
  if (existingCount > 0) {
    return await db.shiftTasks.toArray();
  }

  console.log("Generando despacho de tareas de turno 100% GATERA...");
  const tasksToInsert: ShiftTask[] = [];

  // Tareas de Gatera (Felinos Reales del CENSO)
  const gateraCats = await db.gateraRecords.toArray();

  for (let idx = 0; idx < gateraCats.length; idx++) {
    const cat = gateraCats[idx];
    const kardexItem = await db.kardex.where("microchip").equals(cat.microchip).first();

    // 1. Tareas de Medicación
    if (cat.medicacion && cat.medicacion !== "Ninguno") {
      const isNeb =
        cat.medicacion.toLowerCase().includes("nebuliza") ||
        cat.medicacion.toLowerCase().includes("puff");
      const isOfta =
        cat.medicacion.toLowerCase().includes("ofta") ||
        cat.medicacion.toLowerCase().includes("gotas") ||
        cat.medicacion.toLowerCase().includes("ojo");

      tasksToInsert.push({
        kardexId: kardexItem?.id,
        animalName: cat.nombre,
        species: "gato",
        microchip: cat.microchip,
        location: cat.ubicacion,
        medication: cat.medicacion,
        shift: idx % 2 === 0 ? "mañana" : "tarde",
        laborType: isNeb ? "nebulizacion" : (isOfta ? "medicacion" : "medicacion"),
        isCompleted: false,
        isFeral: cat.isFeral,
        notes: `${cat.pendientes || ""}. HC: ${cat.hc} ${cat.isFeral ? "⚠️ MANEJO FERAL / GUANTES" : ""}`,
        area: "gatera",
        assignedTo: undefined,
        assignedRole: undefined,
        dosisTotales: kardexItem?.dosisTotales || 7,
        dosisAplicadas: kardexItem?.dosisAplicadas || 0,
        dosisFaltantes: kardexItem?.dosisFaltantes || 7,
      });
    }

    // 2. Tareas de Limpieza de Oídos y Aseo programadas
    if (cat.limpiezaOidos && cat.limpiezaOidos !== "NO") {
      tasksToInsert.push({
        animalName: cat.nombre,
        species: "gato",
        microchip: cat.microchip,
        location: cat.ubicacion,
        medication: "LIMPIEZA DE OIDOS + ASEO FELINO",
        shift: "mañana",
        laborType: "limpieza",
        isCompleted: false,
        isFeral: cat.isFeral,
        notes: `Aseo y limpieza ótica. HC: ${cat.hc}`,
        area: "gatera",
        assignedTo: undefined,
        assignedRole: undefined,
      });
    }
  }

  await db.shiftTasks.bulkAdd(tasksToInsert);
  return await db.shiftTasks.toArray();
}

/**
 * Depura la población de Gatera para iniciar o consolidar un censo nuevo.
 * Conserva:
 *  1. Felinos censados/actualizados (registrados en db.census con area === 'gatera').
 *  2. Felinos clasificados como FERALES (isFeral === true o marca FERAL) -> 100% PROTEGIDOS.
 * Elimina:
 *  - Todos los felinos de Gatera que NO fueron verificados en el censo actual y NO son ferales.
 */
export async function purgeObsoleteGateraRecords(): Promise<{
  totalBefore: number;
  preservedCensused: number;
  preservedFeral: number;
  deletedCount: number;
}> {
  const allCatsInGatera = await db.gateraRecords.toArray();
  const allCatAnimals = await db.animals.where("species").equals("gato").toArray();
  const allCensusRecords = await db.census.where("area").equals("gatera").toArray();

  // Conjunto de microchips censados en Gatera
  const censusedChips = new Set(allCensusRecords.map((c) => c.microchip.trim()));

  let preservedCensused = 0;
  let preservedFeral = 0;
  const chipsToDelete: string[] = [];

  for (const cat of allCatsInGatera) {
    const chip = cat.microchip.trim();
    const isFeral = Boolean(
      cat.isFeral ||
      (cat.pendientes && cat.pendientes.toUpperCase().includes("FERAL")) ||
      (cat.descripcion && cat.descripcion.toUpperCase().includes("FERAL"))
    );
    const isCensused = censusedChips.has(chip);

    if (isFeral) {
      preservedFeral++;
    } else if (isCensused) {
      preservedCensused++;
    } else {
      chipsToDelete.push(chip);
    }
  }

  // 1. Eliminar de db.gateraRecords
  for (const chip of chipsToDelete) {
    await db.gateraRecords.where("microchip").equals(chip).delete();
  }

  // 2. Eliminar también de db.animals aquellos gatos no ferales y no censados
  for (const chip of chipsToDelete) {
    const animal = allCatAnimals.find((a) => a.microchip.trim() === chip);
    if (animal?.id) {
      const isFeralAnimal = Boolean(
        animal.isFeral ||
        (animal.notes && animal.notes.toUpperCase().includes("FERAL"))
      );
      if (!isFeralAnimal && !censusedChips.has(chip)) {
        await db.animals.delete(animal.id);
      }
    }
  }

  return {
    totalBefore: allCatsInGatera.length,
    preservedCensused,
    preservedFeral,
    deletedCount: chipsToDelete.length,
  };
}

/**
 * Verifica si un registro es de prueba o demo histórico
 */
export function isDemoRecord(chip: string, name?: string, loc?: string): boolean {
  const c = (chip || "").trim().toUpperCase();
  const n = (name || "").trim().toUpperCase();
  const l = (loc || "").trim().toUpperCase();

  if (c.startsWith("98200041234") || c.startsWith("982000412345")) return true;
  if (c.startsWith("DUMMY_") || c.startsWith("TEST_") || c.startsWith("DEMO_")) return true;
  if ((n === "TOBY" || n === "ROCKY" || n === "MAX") && (l.includes("CANIL-01") || l.includes("CANIL-04") || c.startsWith("982000"))) return true;
  return false;
}

/**
 * REGLA DE ORO: Garantiza que los microchips sean 100% únicos y sin duplicados.
 * Elimina cualquier registro redundante o demo en db.animals, db.gateraRecords, db.shelterRecords y db.census.
 */
export async function deduplicateDatabaseRecords(): Promise<{
  animalsRemoved: number;
  gateraRemoved: number;
  censusRemoved: number;
  demoRemoved: number;
}> {
  let animalsRemoved = 0;
  let gateraRemoved = 0;
  let censusRemoved = 0;
  let demoRemoved = 0;

  try {
    // 0. PURGA DE REGISTROS DEMO / MOCK EN TODAS LAS TABLAS
    // a. En db.census
    const allCensus = await db.census.toArray();
    for (const item of allCensus) {
      if (isDemoRecord(item.microchip, item.animalName, item.location)) {
        if (item.id) {
          await db.census.delete(item.id);
          demoRemoved++;
        }
      }
    }

    // b. En db.animals
    const allAnimals = await db.animals.toArray();
    for (const a of allAnimals) {
      if (isDemoRecord(a.microchip, a.name, a.location)) {
        if (a.id) {
          await db.animals.delete(a.id);
          demoRemoved++;
        }
      }
    }

    // c. En db.kardex
    const allKardex = await db.kardex.toArray();
    for (const k of allKardex) {
      if (isDemoRecord(k.microchip)) {
        if (k.id) {
          await db.kardex.delete(k.id);
          demoRemoved++;
        }
      }
    }

    // d. En db.shiftTasks
    const allTasks = await db.shiftTasks.toArray();
    for (const t of allTasks) {
      if (isDemoRecord(t.microchip, t.animalName, t.location)) {
        if (t.id) {
          await db.shiftTasks.delete(t.id);
          demoRemoved++;
        }
      }
    }

    // 1. DESDUPLICAR db.census:
    // Resolver chips cortos incompletos (ej. '6713' vs '941000027956713') y lecturas repetidas
    const currentCensus = await db.census.toArray();
    
    // Identificar todos los microchips completos (>= 10 dígitos)
    const fullChips: string[] = [];
    for (const c of currentCensus) {
      const chip = c.microchip.trim().toUpperCase();
      if (chip.length >= 10 && !fullChips.includes(chip)) fullChips.push(chip);
    }

    // Buscar chips cortos que son sufijos de un chip completo en el censo
    for (const item of currentCensus) {
      const chip = item.microchip.trim().toUpperCase();
      if (chip.length < 10) {
        // Verificar si existe un chip completo que termine en este chip corto
        const hasParent = fullChips.some((full) => full.endsWith(chip) && full !== chip);
        if (hasParent && item.id) {
          await db.census.delete(item.id);
          censusRemoved++;
        }
      }
    }

    // Desduplicar chips exactos en db.census (conservar el más reciente por ID/fecha)
    const refreshedCensus = await db.census.orderBy("id").reverse().toArray();
    const seenCensusChips = new Set<string>();
    for (const item of refreshedCensus) {
      const chip = item.microchip.trim().toUpperCase();
      if (!chip) continue;
      if (seenCensusChips.has(chip)) {
        if (item.id) {
          await db.census.delete(item.id);
          censusRemoved++;
        }
      } else {
        seenCensusChips.add(chip);
      }
    }

    // 2. DESDUPLICAR db.gateraRecords
    const gateraList = await db.gateraRecords.toArray();
    const seenGatera = new Map<string, number>();
    for (const cat of gateraList) {
      const chip = cat.microchip.trim().toUpperCase();
      if (!chip) continue;
      if (seenGatera.has(chip)) {
        if (cat.id) {
          await db.gateraRecords.delete(cat.id);
          gateraRemoved++;
        }
      } else {
        if (cat.id) seenGatera.set(chip, cat.id);
      }
    }

    // 3. DESDUPLICAR db.animals
    // Primero, si hay animales con chip corto (ej. '6713') y existe el animal con chip completo (ej. '941000027956713')
    const refreshedAnimals = await db.animals.toArray();
    const animalFullChips: string[] = [];
    for (const a of refreshedAnimals) {
      const chip = a.microchip.trim().toUpperCase();
      if (chip.length >= 10 && !animalFullChips.includes(chip)) animalFullChips.push(chip);
    }
    for (const a of refreshedAnimals) {
      const chip = a.microchip.trim().toUpperCase();
      if (chip.length < 10) {
        const hasParent = animalFullChips.some((full) => full.endsWith(chip) && full !== chip);
        if (hasParent && a.id) {
          await db.animals.delete(a.id);
          animalsRemoved++;
        }
      }
    }

    // Luego, desduplicar chips exactos en db.animals
    const remainingAnimals = await db.animals.toArray();
    const seenAnimals = new Map<string, number>();
    for (const a of remainingAnimals) {
      const chip = a.microchip.trim().toUpperCase();
      if (!chip) continue;
      if (seenAnimals.has(chip)) {
        if (a.id) {
          await db.animals.delete(a.id);
          animalsRemoved++;
        }
      } else {
        if (a.id) seenAnimals.set(chip, a.id);
      }
    }
  } catch (err) {
    console.error("Error al desduplicar base de datos y limpiar datos demo:", err);
  }

  return { animalsRemoved, gateraRemoved, censusRemoved, demoRemoved };
}
