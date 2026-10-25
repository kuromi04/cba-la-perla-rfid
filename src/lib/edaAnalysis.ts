import * as XLSX from "xlsx";
import { db, Animal, KardexRecord, ShiftTask } from "./db";
import { GateraCat } from "./gateraData";

export interface EdaSummary {
  generatedAt: string;
  totalAnimals: number;
  totalCats: number;
  activeCats: number;
  deceasedCats: number;
  totalDogs: number;
  
  // Distribución Espacial
  byZone: { zone: string; count: number; percentage: number }[];
  topCaniles: { canil: string; count: number; percentage: number }[];
  
  // Epidemiología Retroviral Felina (VIF / FeLV)
  retroviral: {
    negativo: number;
    vifPositivo: number;
    felvPositivo: number;
    doblePositivo: number;
    pendiente: number;
    totalTesteados: number;
    prevalenciaGlobal: number; // Porcentaje
  };

  // Sexo y Reproducción
  gender: {
    machoAdulto: number;     // MFA
    machoCachorro: number;   // MFC
    hembraAdulta: number;    // HFA
    hembraCachorra: number;  // HFC
    esterilizados: number;
    enteros: number;
  };

  // Grupos de Edad
  ageGroups: {
    cachorros: number; // < 6 meses
    jovenes: number;   // 6 a 12 meses
    adultos: number;   // 1 a 7 años
    gerontes: number;  // > 7 años
  };

  // Condición Corporal (1.0 a 5.0)
  bodyCondition: {
    bajo: number;      // 1.0 a 2.0 (Emaciado / Delicado)
    optimo: number;    // 2.5 a 3.5 (Peso Ideal)
    sobrepeso: number; // 4.0 a 5.0 (Sobrepeso / Obeso)
    noRegistrado: number;
  };

  // Temperamento
  temperament: {
    ferales: number;
    sociables: number;
    porcentajeFeral: number;
  };

  // Estado Clínico General
  healthState: {
    saludable: number;
    regular: number;
    delicado: number;
    critico: number;
  };

  // Carga Médica y Tratamientos Activos (Kardex)
  clinical: {
    activosConTratamiento: number;
    totalPrescripcionesKardex: number;
    porcentajeMedicados: number;
    bySystem: { system: string; count: number; percentage: number }[];
    topMedications: { medication: string; count: number }[];
  };

  // Operaciones y Turnos de Campo
  operations: {
    totalTareasTurno: number;
    tareasCompletadas: number;
    tareasPendientes: number;
    tasaCumplimiento: number;
    peluqueriaAlDia: number;
    corteUnasAlDia: number;
    limpiezaOidosAlDia: number;
  };
}

/**
 * Motor de Cálculo del Análisis Exploratorio de Datos (EDA)
 */
export async function computeEdaAnalysis(): Promise<EdaSummary> {
  const [animals, gateraCats, kardex, shiftTasks] = await Promise.all([
    db.animals.toArray(),
    db.gateraRecords.toArray(),
    db.kardex.toArray(),
    db.shiftTasks.toArray(),
  ]);

  // Consolidar felinos asegurando no duplicar chips
  const catMap = new Map<string, any>();
  for (const c of gateraCats) {
    catMap.set(c.microchip.trim().toUpperCase(), { ...c, species: "gato" });
  }
  for (const a of animals) {
    if (a.species === "gato") {
      const chip = a.microchip.trim().toUpperCase();
      const existing = catMap.get(chip);
      catMap.set(chip, { ...existing, ...a });
    }
  }

  const allCats = Array.from(catMap.values());
  const allDogs = animals.filter((a) => a.species === "perro");

  const totalAnimals = allCats.length + allDogs.length;
  const totalCats = allCats.length;

  const activeCatsList = allCats.filter((c) => {
    const loc = (c.location || c.ubicacion || "").trim().toUpperCase();
    const stat = (c.status || "").trim().toLowerCase();
    return loc !== "FALLECIDO" && stat !== "fallecido";
  });

  const deceasedCatsList = allCats.filter((c) => {
    const loc = (c.location || c.ubicacion || "").trim().toUpperCase();
    const stat = (c.status || "").trim().toLowerCase();
    return loc === "FALLECIDO" || stat === "fallecido";
  });

  const activeCats = activeCatsList.length;
  const deceasedCats = deceasedCatsList.length;
  const totalDogs = allDogs.length;

  // 1. ZONAS Y CANILES
  const zoneCounts: Record<string, number> = {};
  const canilCounts: Record<string, number> = {};

  activeCatsList.forEach((c) => {
    const loc = (c.location || c.ubicacion || "SIN UBICACIÓN").trim().toUpperCase();
    canilCounts[loc] = (canilCounts[loc] || 0) + 1;

    let zone = "OTRAS ÁREAS";
    if (loc.startsWith("CUARENTENA")) zone = "CUARENTENAS";
    else if (loc.startsWith("UPH")) zone = "UPH (PROTECCIÓN / HOSP)";
    else if (loc.startsWith("HOSPITAL")) zone = "HOSPITAL";
    else if (loc.startsWith("MATERN")) zone = "MATERNIDAD";
    else if (loc.startsWith("CANIL")) zone = "CANILES DE PISO";
    else if (loc.startsWith("JAULA")) zone = "JAULAS INDIVIDUALES";
    else if (loc.includes("PATIO") || loc.includes("SOLARIO")) zone = "PATIO / SOLARIO";

    zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
  });

  const byZone = Object.entries(zoneCounts)
    .map(([zone, count]) => ({
      zone,
      count,
      percentage: activeCats > 0 ? Number(((count / activeCats) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topCaniles = Object.entries(canilCounts)
    .map(([canil, count]) => ({
      canil,
      count,
      percentage: activeCats > 0 ? Number(((count / activeCats) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // 2. EPIDEMIOLOGÍA RETROVIRAL (VIF / FeLV)
  let retroNeg = 0;
  let vifPos = 0;
  let felvPos = 0;
  let doblePos = 0;
  let retroPend = 0;

  activeCatsList.forEach((c) => {
    const vStatus = (c.vifStatus || "").toUpperCase();
    const fStatus = (c.felvStatus || "").toUpperCase();
    const rStatus = (c.retroviralStatus || "").toUpperCase();
    const notes = ((c.observacionesMedicas || "") + " " + (c.notes || "")).toUpperCase();

    if (
      rStatus === "DOBLE_POSITIVO" ||
      (vStatus === "POSITIVO" && fStatus === "POSITIVO") ||
      (notes.includes("VIF +") && notes.includes("FELV +"))
    ) {
      doblePos++;
    } else if (rStatus === "VIF_POSITIVO" || vStatus === "POSITIVO" || notes.includes("VIF +") || notes.includes("VIF POS")) {
      vifPos++;
    } else if (rStatus === "FELV_POSITIVO" || fStatus === "POSITIVO" || notes.includes("FELV +") || notes.includes("LEUCEMIA POS")) {
      felvPos++;
    } else if (rStatus === "NEGATIVO" || (vStatus === "NEGATIVO" && fStatus === "NEGATIVO") || notes.includes("VIF-FELV NEG")) {
      retroNeg++;
    } else {
      retroPend++;
    }
  });

  const totalTesteados = retroNeg + vifPos + felvPos + doblePos;
  const totalPositivos = vifPos + felvPos + doblePos;
  const prevalenciaGlobal =
    totalTesteados > 0 ? Number(((totalPositivos / totalTesteados) * 100).toFixed(1)) : 0;

  // 3. SEXO Y REPRODUCCIÓN
  let mfa = 0;
  let mfc = 0;
  let hfa = 0;
  let hfc = 0;
  let esterilizados = 0;
  let enteros = 0;

  activeCatsList.forEach((c) => {
    const code = (c.sexoCode || "").toUpperCase();
    const gender = (c.sexo || c.gender || "").toLowerCase();
    const isAdult = (c.grupoEdad || "").toLowerCase() === "adulto" || !code.endsWith("C");

    if (code === "MFA") mfa++;
    else if (code === "MFC") mfc++;
    else if (code === "HFA") hfa++;
    else if (code === "HFC") hfc++;
    else {
      if (gender === "hembra") {
        if (isAdult) hfa++;
        else hfc++;
      } else {
        if (isAdult) mfa++;
        else mfc++;
      }
    }

    const notes = ((c.observacionesMedicas || "") + " " + (c.notes || "")).toUpperCase();
    if (code.includes("CAST") || code.includes("EST") || notes.includes("ESTERILIZ") || notes.includes("CASTRAD")) {
      esterilizados++;
    } else {
      enteros++;
    }
  });

  // 4. GRUPOS DE EDAD
  let cachorros = 0;
  let jovenes = 0;
  let adultos = 0;
  let gerontes = 0;

  activeCatsList.forEach((c) => {
    const edadStr = (c.edad || "").toUpperCase();
    const match = edadStr.match(/(\d+)/);
    const months = match ? parseInt(match[1], 10) : 24;

    if (months < 6 || edadStr.includes("CACHORRO")) cachorros++;
    else if (months <= 12 || edadStr.includes("JOVEN")) jovenes++;
    else if (months <= 84) adultos++;
    else gerontes++;
  });

  // 5. CONDICIÓN CORPORAL
  let condBajo = 0;
  let condOptimo = 0;
  let condSobrepeso = 0;
  let condNoReg = 0;

  activeCatsList.forEach((c) => {
    const cond = (c.condicionCorporal || "").toUpperCase();
    const match = cond.match(/(\d+(\.\d+)?)/);
    if (!match) {
      condNoReg++;
      return;
    }
    const val = parseFloat(match[1]);
    if (val <= 2.0) condBajo++;
    else if (val <= 3.5) condOptimo++;
    else condSobrepeso++;
  });

  // 6. TEMPERAMENTO (FERALES VS SOCIABLES)
  let ferales = 0;
  let sociables = 0;

  activeCatsList.forEach((c) => {
    if (c.isFeral === true || String(c.isFeral).toUpperCase() === "SI") {
      ferales++;
    } else {
      sociables++;
    }
  });

  const porcentajeFeral =
    activeCats > 0 ? Number(((ferales / activeCats) * 100).toFixed(1)) : 0;

  // 7. ESTADO DE SALUD
  let saludable = 0;
  let regular = 0;
  let delicado = 0;
  let critico = 0;

  activeCatsList.forEach((c) => {
    const st = (c.estadoSalud || c.estado || "Saludable").toLowerCase();
    if (st.includes("saludable") || st.includes("bueno") || st.includes("sano")) saludable++;
    else if (st.includes("regular") || st.includes("observacion")) regular++;
    else if (st.includes("critico") || st.includes("grave")) critico++;
    else delicado++;
  });

  // 8. CARGA CLÍNICA Y KARDEX
  let activosConTratamiento = 0;
  const systemCounts: Record<string, number> = {};
  const medCounts: Record<string, number> = {};

  activeCatsList.forEach((c) => {
    const med = (c.medicacion || "").trim();
    if (med && med !== "Ninguno" && med !== "NO") {
      activosConTratamiento++;
      const sys = (c.sistema || "PREVENTIVO").trim().toUpperCase();
      systemCounts[sys] = (systemCounts[sys] || 0) + 1;

      // Tokenizar medicamentos conocidos
      const normalizedMed = med.toUpperCase();
      const medList = [
        "REVOLUTION PLUS",
        "DOXICICLINA",
        "CONVENIA",
        "ENROFLOXACINA",
        "MELOXICAM",
        "FELINE FULL SPOT",
        "CIPROFLOXACINA",
        "ENGYSTOL",
        "CAT BALANCE",
        "METRONIDAZOL",
        "OMEPRAZOL",
      ];
      let matched = false;
      for (const m of medList) {
        if (normalizedMed.includes(m)) {
          medCounts[m] = (medCounts[m] || 0) + 1;
          matched = true;
        }
      }
      if (!matched) {
        const short = med.slice(0, 24);
        medCounts[short] = (medCounts[short] || 0) + 1;
      }
    }
  });

  const bySystem = Object.entries(systemCounts)
    .map(([system, count]) => ({
      system,
      count,
      percentage: activosConTratamiento > 0 ? Number(((count / activosConTratamiento) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topMedications = Object.entries(medCounts)
    .map(([medication, count]) => ({ medication, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const porcentajeMedicados =
    activeCats > 0 ? Number(((activosConTratamiento / activeCats) * 100).toFixed(1)) : 0;

  // 9. OPERACIONES, ASEO Y TURNOS
  let peluqueriaAlDia = 0;
  let corteUnasAlDia = 0;
  let limpiezaOidosAlDia = 0;

  activeCatsList.forEach((c) => {
    if (c.peluqueria === "SI") peluqueriaAlDia++;
    if (c.corteUnas === "SI") corteUnasAlDia++;
    if (c.limpiezaOidos === "SI") limpiezaOidosAlDia++;
  });

  const totalTareasTurno = shiftTasks.length;
  const tareasCompletadas = shiftTasks.filter((t) => t.isCompleted).length;
  const tareasPendientes = totalTareasTurno - tareasCompletadas;
  const tasaCumplimiento =
    totalTareasTurno > 0 ? Number(((tareasCompletadas / totalTareasTurno) * 100).toFixed(1)) : 100;

  return {
    generatedAt: new Date().toISOString(),
    totalAnimals,
    totalCats,
    activeCats,
    deceasedCats,
    totalDogs,
    byZone,
    topCaniles,
    retroviral: {
      negativo: retroNeg,
      vifPositivo: vifPos,
      felvPositivo: felvPos,
      doblePositivo: doblePos,
      pendiente: retroPend,
      totalTesteados,
      prevalenciaGlobal,
    },
    gender: {
      machoAdulto: mfa,
      machoCachorro: mfc,
      hembraAdulta: hfa,
      hembraCachorra: hfc,
      esterilizados,
      enteros,
    },
    ageGroups: {
      cachorros,
      jovenes,
      adultos,
      gerontes,
    },
    bodyCondition: {
      bajo: condBajo,
      optimo: condOptimo,
      sobrepeso: condSobrepeso,
      noRegistrado: condNoReg,
    },
    temperament: {
      ferales,
      sociables,
      porcentajeFeral,
    },
    healthState: {
      saludable,
      regular,
      delicado,
      critico,
    },
    clinical: {
      activosConTratamiento,
      totalPrescripcionesKardex: kardex.length,
      porcentajeMedicados,
      bySystem,
      topMedications,
    },
    operations: {
      totalTareasTurno,
      tareasCompletadas,
      tareasPendientes,
      tasaCumplimiento,
      peluqueriaAlDia,
      corteUnasAlDia,
      limpiezaOidosAlDia,
    },
  };
}

/**
 * Exportar Informe Completo de Análisis Exploratorio de Datos (EDA) a Excel (.xlsx)
 */
export async function exportEdaExcelReport(summary: EdaSummary): Promise<void> {
  const wb = XLSX.utils.book_new();

  // HOJA 1: RESUMEN EJECUTIVO (KPIs)
  const resumenRows: any[][] = [
    ["CENTRO DE BIENESTAR ANIMAL LA PERLA - ALCALDÍA DE MEDELLÍN"],
    ["INFORME OFICIAL DE ANÁLISIS EXPLORATORIO DE DATOS (EDA) - GATERA Y ALBERGUE"],
    [`Fecha y Hora de Emisión: ${new Date(summary.generatedAt).toLocaleString()}`],
    [""],
    ["INDICADOR DEMOGRÁFICO / CLÍNICO", "VALOR ABSOLUTO", "PORCENTAJE (%)", "NOTAS DE CONTROL"],
    ["Población Felina Total Histórica", summary.totalCats, "100%", "Censo Maestro Gatera"],
    ["Felinos Activos en Gatera (Censo Actual)", summary.activeCats, `${((summary.activeCats / (summary.totalCats || 1)) * 100).toFixed(1)}%`, "Alojamientos activos"],
    ["Felinos Dados de Baja / Fallecidos", summary.deceasedCats, `${((summary.deceasedCats / (summary.totalCats || 1)) * 100).toFixed(1)}%`, "Hoja MUERTES oficial"],
    ["Caninos en Albergue", summary.totalDogs, "-", "Módulos de Albergue"],
    [""],
    ["EPIDEMIOLOGÍA RETROVIRAL FELINA", "CASOS", "PREVALENCIA", "OBSERVACIÓN"],
    ["Negativo a VIF y FeLV", summary.retroviral.negativo, `${((summary.retroviral.negativo / (summary.retroviral.totalTesteados || 1)) * 100).toFixed(1)}%`, "Test rápido confirmado"],
    ["VIF Positivo (Inmunodeficiencia Felina)", summary.retroviral.vifPositivo, `${((summary.retroviral.vifPositivo / (summary.retroviral.totalTesteados || 1)) * 100).toFixed(1)}%`, "Aislamiento preventivo"],
    ["FeLV Positivo (Leucemia Viral Felina)", summary.retroviral.felvPositivo, `${((summary.retroviral.felvPositivo / (summary.retroviral.totalTesteados || 1)) * 100).toFixed(1)}%`, "Cohorte de positivos"],
    ["Doble Positivo (VIF + FeLV)", summary.retroviral.doblePositivo, `${((summary.retroviral.doblePositivo / (summary.retroviral.totalTesteados || 1)) * 100).toFixed(1)}%`, "Casos de alto cuidado"],
    ["Pendientes de Muestreo / Test", summary.retroviral.pendiente, "-", "Programación de ingreso"],
    ["Prevalencia Retroviral Global", `${summary.retroviral.prevalenciaGlobal}%`, "-", "De felinos testeados"],
    [""],
    ["TEMPERAMENTO Y CONDICIÓN CLÍNICA", "CANTIDAD", "DISTRIBUCIÓN", "MANEJO REQUERIDO"],
    ["Felinos Ferales (Comportamiento Agresivo/Silvestre)", summary.temperament.ferales, `${summary.temperament.porcentajeFeral}%`, "Manejo con guante / toalla"],
    ["Felinos Sociables / Dóciles", summary.temperament.sociables, `${(100 - summary.temperament.porcentajeFeral).toFixed(1)}%`, "Aptos adopción / solario"],
    ["Condición Corporal Baja (1.0 - 2.0)", summary.bodyCondition.bajo, `${((summary.bodyCondition.bajo / summary.activeCats) * 100).toFixed(1)}%`, "Suplementación Cat Balance"],
    ["Condición Corporal Óptima (2.5 - 3.5)", summary.bodyCondition.optimo, `${((summary.bodyCondition.optimo / summary.activeCats) * 100).toFixed(1)}%`, "Rango deseado"],
    ["Condición Sobrepeso / Obeso (4.0 - 5.0)", summary.bodyCondition.sobrepeso, `${((summary.bodyCondition.sobrepeso / summary.activeCats) * 100).toFixed(1)}%`, "Control de dieta"],
    [""],
    ["CARGA MÉDICA Y OPERACIONES", "VALOR", "CUMPLIMIENTO", "ESTADO"],
    ["Felinos con Medicación Activa", summary.clinical.activosConTratamiento, `${summary.clinical.porcentajeMedicados}%`, "Tratamientos en curso"],
    ["Prescripciones en Kardex", summary.clinical.totalPrescripcionesKardex, "-", "Vigentes en sistema"],
    ["Tasa Cumplimiento Tareas de Turno", `${summary.operations.tasaCumplimiento}%`, `${summary.operations.tareasCompletadas}/${summary.operations.totalTareasTurno}`, "Auxiliares / Operarios"],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows);
  wsResumen["!cols"] = [{ wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "RESUMEN_EJECUTIVO");

  // HOJA 2: DISTRIBUCIÓN ESPACIAL (ZONAS Y CANILES)
  const zonasRows: any[][] = [
    ["DISTRIBUCIÓN POR MACRO-ZONAS"],
    ["ZONA / SECCIÓN", "NÚMERO DE FELINOS", "PORCENTAJE (%)"],
    ...summary.byZone.map((z) => [z.zone, z.count, `${z.percentage}%`]),
    [""],
    ["TOP 15 CANILES CON MAYOR OCUPACIÓN"],
    ["CANIL / UBICACIÓN", "NÚMERO DE FELINOS", "PORCENTAJE (%)"],
    ...summary.topCaniles.map((c) => [c.canil, c.count, `${c.percentage}%`]),
  ];
  const wsZonas = XLSX.utils.aoa_to_sheet(zonasRows);
  wsZonas["!cols"] = [{ wch: 35 }, { wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsZonas, "DISTRIBUCION_ESPACIAL");

  // HOJA 3: CARGA CLÍNICA Y SISTEMAS AFECTADOS
  const clinicaRows: any[][] = [
    ["DISTRIBUCIÓN DE TRATAMIENTOS POR SISTEMA ORGÁNICO"],
    ["SISTEMA AFECTADO", "TRATAMIENTOS ACTIVOS", "PORCENTAJE (%)"],
    ...summary.clinical.bySystem.map((s) => [s.system, s.count, `${s.percentage}%`]),
    [""],
    ["TOP MEDICAMENTOS MÁS ADMINISTRADOS EN GATERA"],
    ["MEDICAMENTO / FÁRMACO", "DOSIS / ANIMALES"],
    ...summary.clinical.topMedications.map((m) => [m.medication, m.count]),
  ];
  const wsClinica = XLSX.utils.aoa_to_sheet(clinicaRows);
  wsClinica["!cols"] = [{ wch: 35 }, { wch: 25 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsClinica, "CARGA_CLINICA_KARDEX");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `INFORME_ANALISIS_EXPLORATORIO_EDA_${today}.xlsx`);
}
