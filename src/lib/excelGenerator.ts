import * as XLSX from "xlsx";
import { db } from "./db";
import { ShelterRecord } from "./realData";

export async function exportOriginalShelterExcel() {
  const records: ShelterRecord[] = await db.shelterRecords.toArray();

  const workbook = XLSX.utils.book_new();

  // -------------------------------------------------------------
  // HOJA 1: FORMATO ORIGINAL EXACTO (Consolidado de todas las secciones)
  // -------------------------------------------------------------
  const consolidatedRows: any[][] = [];

  // Cabecera Triaje
  consolidatedRows.push(["", "", "", "", "", "", "", ""]);
  consolidatedRows.push(["MEDICACION TRIAGE", "", "", "", "", "", "", ""]);
  consolidatedRows.push([
    "PARA TODOS: MEZCLAR RONIK CON 2 CUCHARADAS NEUMO+ 2 SOBRES ENTEROCHORNIC+ CONTENIDO 10 CAPSULAS DE OMEGA \n DAR ENGYSTOL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  consolidatedRows.push(["TRIAJE", "", "", "", "", "", "", ""]);
  consolidatedRows.push([
    "UBICACION",
    "MC",
    "DESCRIPCION",
    "MEDICACION",
    "FECHA FINAL",
    "TIPO",
    "SISTEMA",
    "PENDIENTES",
  ]);

  const triajeRows = records.filter((r) => r.section === "TRIAJE");
  triajeRows.forEach((r) => {
    consolidatedRows.push([
      r.ubicacion,
      r.shortChip || r.microchip,
      r.descripcion,
      r.medicacion || "",
      r.fechaFinal || "",
      r.tipo || "",
      r.sistema || "",
      r.pendientes || "",
    ]);
  });

  consolidatedRows.push(["TOTAL ANIMALES", triajeRows.length, "", "", "", "", "", ""]);
  consolidatedRows.push(["", "", "", "", "", "", "", ""]);

  // Tratamientos Finalizados
  consolidatedRows.push(["TRATAMIENTOS FINALIZADOS", "", "", "", "", "", "", ""]);
  const finalizadosRows = records.filter((r) => r.section === "TRIAJE_FINALIZADO" || r.section === "UCE_FINALIZADO");
  finalizadosRows.forEach((r) => {
    consolidatedRows.push([
      r.ubicacion,
      r.shortChip || r.microchip,
      r.descripcion,
      r.medicacion || "",
      r.fechaFinal || "",
      r.tipo || "",
      r.sistema || "",
      r.pendientes || "",
    ]);
  });

  consolidatedRows.push(["", "", "", "", "", "", "", ""]);

  // UCE Activos
  consolidatedRows.push(["MEDICACION OCTUBRE UCE", "", "", "", "", "", "", ""]);
  consolidatedRows.push([
    "PARA TODOS: MEZCLAR RONIK CON 2 CUCHARADAS NEUMO+ 2 SOBRES ENTEROCHORNIC+ CONTENIDO 10 CAPSULAS DE OMEGA \n DAR ENGYSTOL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  consolidatedRows.push(["UCE", "", "", "", "", "", "", ""]);
  consolidatedRows.push([
    "UBICACION",
    "MC",
    "DESCRIPCION",
    "MEDICACION",
    "FECHA FINAL",
    "TIPO",
    "SISTEMA",
    "PENDIENTES",
  ]);

  const uceRows = records.filter((r) => r.section === "UCE");
  uceRows.forEach((r) => {
    consolidatedRows.push([
      r.ubicacion,
      r.shortChip || r.microchip,
      r.descripcion,
      r.medicacion || "",
      r.fechaFinal || "",
      r.tipo || "",
      r.sistema || "",
      r.pendientes || "",
    ]);
  });

  consolidatedRows.push(["", "", "", "", "", "", "", ""]);

  // Limpiezas
  consolidatedRows.push(["LIMPIEZAS  UCE- TRIAJE", "", "", "", "", ""]);
  consolidatedRows.push(["INICIO", "UBIC", "MICROCHIP", "DESCRIPCIÓN", "INDICACIONES", "FIN"]);
  const limpiezasRows = records.filter((r) => r.section === "LIMPIEZAS");
  limpiezasRows.forEach((r) => {
    consolidatedRows.push([
      r.fechaInicio || "",
      r.ubicacion,
      r.shortChip || r.microchip,
      r.descripcion,
      r.medicacion,
      r.fechaFinal || "",
    ]);
  });

  consolidatedRows.push(["", "", "", "", "", ""]);

  // Baños
  consolidatedRows.push(["BAÑOS UCE- TRIAJE", "", "", "", "", ""]);
  consolidatedRows.push(["INICIO", "UBIC", "MICROCHIP", "DESCRIPCIÓN", "INDICACIONES", "FIN"]);
  const banosRows = records.filter((r) => r.section === "BAÑOS");
  banosRows.forEach((r) => {
    consolidatedRows.push([
      r.fechaInicio || "",
      r.ubicacion,
      r.shortChip || r.microchip,
      r.descripcion,
      r.medicacion,
      r.fechaFinal || "",
    ]);
  });

  consolidatedRows.push(["", "", "", "", "", ""]);

  // Medicación Noche
  consolidatedRows.push(["MEDICACIÓN NOCHE", "", "", ""]);
  consolidatedRows.push(["UBICACIÓN", "MC", "DESCRIPCIÓN", "MEDICACIÓN"]);
  const nocheRows = records.filter((r) => r.section === "NOCHE");
  nocheRows.forEach((r) => {
    consolidatedRows.push([r.ubicacion, r.shortChip || r.microchip, r.descripcion, r.medicacion]);
  });

  consolidatedRows.push(["", "", "", ""]);

  // Epidemiología (+ CDV)
  consolidatedRows.push([
    "UBICACION (+ CDV)",
    "MICROCHIP",
    "HC",
    "DESCRIPCION",
    "EDAD",
    "FECHA INGRESO PERLA",
    "MOTIVO",
    "UBICACION INICIAL",
    "COMUNA",
    "REMITIDO",
    "VACUNACION 1",
    "VACUNACION 2",
    "CDV (+)",
    "ACTUALMENTE",
  ]);
  const cdvRows = records.filter((r) => r.section === "CDV");
  cdvRows.forEach((r) => {
    consolidatedRows.push([
      r.ubicacion,
      r.microchip,
      r.hc || "",
      r.descripcion,
      r.edad || "",
      r.fechaIngreso || "",
      r.motivo || "",
      r.ubicacion,
      r.comuna || "",
      r.remitido || "",
      r.vacunacion1 || "",
      r.vacunacion2 || "",
      r.cdvFecha || "",
      r.estadoActual || "",
    ]);
  });

  consolidatedRows.push(["", "", "", ""]);

  // Aplicar Bravecto
  consolidatedRows.push(["APLICAR BAVECTO", "", "", "DOSIS"]);
  const bravectoRows = records.filter((r) => r.section === "BRAVECTO");
  bravectoRows.forEach((r) => {
    consolidatedRows.push([r.ubicacion, r.shortChip || r.microchip, r.descripcion, r.dosisBravecto || "1.0"]);
  });

  const wsConsolidada = XLSX.utils.aoa_to_sheet(consolidatedRows);
  wsConsolidada["!cols"] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 38 },
    { wch: 45 },
    { wch: 16 },
    { wch: 10 },
    { wch: 18 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsConsolidada, "PLANILLA_ORIGINAL");

  // -------------------------------------------------------------
  // HOJA 2: TRIAJE (Solo pestaña Triaje)
  // -------------------------------------------------------------
  const wsTriaje = XLSX.utils.json_to_sheet(
    triajeRows.map((r) => ({
      UBICACION: r.ubicacion,
      MICROCHIP: r.shortChip || r.microchip,
      DESCRIPCION: r.descripcion,
      MEDICACION: r.medicacion,
      "FECHA FINAL": r.fechaFinal,
      TIPO: r.tipo,
      SISTEMA: r.sistema,
      PENDIENTES: r.pendientes,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsTriaje, "OCTUBRE TRIAJE");

  // -------------------------------------------------------------
  // HOJA 3: OCTUBRE UCE (Unidad de Cuidados Especiales)
  // -------------------------------------------------------------
  const wsUCE = XLSX.utils.json_to_sheet(
    uceRows.map((r) => ({
      UBICACION: r.ubicacion,
      MICROCHIP: r.shortChip || r.microchip,
      DESCRIPCION: r.descripcion,
      MEDICACION: r.medicacion,
      "FECHA FINAL": r.fechaFinal,
      TIPO: r.tipo,
      SISTEMA: r.sistema,
      PENDIENTES: r.pendientes,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsUCE, "OCTUBRE UCE");

  // -------------------------------------------------------------
  // HOJA 4: MEDICACION NOCHE
  // -------------------------------------------------------------
  const wsNoche = XLSX.utils.json_to_sheet(
    nocheRows.map((r) => ({
      UBICACION: r.ubicacion,
      MICROCHIP: r.shortChip || r.microchip,
      DESCRIPCION: r.descripcion,
      MEDICACION: r.medicacion,
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsNoche, "MEDICACION NOCHE");

  // -------------------------------------------------------------
  // HOJA 5: LIMPIEZAS Y  BAÑOS M
  // -------------------------------------------------------------
  const limpiezasBanos = [...limpiezasRows, ...banosRows];
  const wsLimpiezas = XLSX.utils.json_to_sheet(
    limpiezasBanos.map((r) => ({
      TIPO_LABOR: r.section,
      INICIO: r.fechaInicio || "-",
      UBICACION: r.ubicacion,
      MICROCHIP: r.shortChip || r.microchip,
      DESCRIPCION: r.descripcion,
      INDICACIONES: r.medicacion,
      FIN: r.fechaFinal || "-",
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsLimpiezas, "LIMPIEZAS Y  BAÑOS M");

  // -------------------------------------------------------------
  // HOJA 6: BRAVECTO
  // -------------------------------------------------------------
  const wsBravecto = XLSX.utils.json_to_sheet(
    bravectoRows.map((r) => ({
      UBICACION: r.ubicacion,
      MICROCHIP: r.shortChip || r.microchip,
      DESCRIPCION: r.descripcion,
      DOSIS: r.dosisBravecto || "1.0",
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsBravecto, "BRAVECTO");

  // -------------------------------------------------------------
  // HOJA 7: INF DISTEMPER (CDV)
  // -------------------------------------------------------------
  const wsDistemper = XLSX.utils.json_to_sheet(
    cdvRows.map((r) => ({
      "UBICACION (+ CDV)": r.ubicacion,
      MICROCHIP: r.microchip,
      HC: r.hc || "",
      DESCRIPCION: r.descripcion,
      EDAD: r.edad || "",
      "FECHA INGRESO PERLA": r.fechaIngreso || "",
      MOTIVO: r.motivo || "",
      "UBICACION INICIAL": r.ubicacion,
      COMUNA: r.comuna || "",
      REMITIDO: r.remitido || "",
      "VACUNACION 1": r.vacunacion1 || "",
      "VACUNACION 2": r.vacunacion2 || "",
      "CDV (+)": r.cdvFecha || "",
      ACTUALMENTE: r.estadoActual || "",
    }))
  );
  XLSX.utils.book_append_sheet(workbook, wsDistemper, "INF DISTEMPER");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `PLANILLA_MEDICA_ALBERGUE_${today}.xlsx`);
}

// -------------------------------------------------------------
// EXPORTACIÓN ESPECÍFICA PARA GATERA (450+ FELINOS)
// -------------------------------------------------------------
export async function exportGateraExcel() {
  const cats = await db.gateraRecords.toArray();
  const animalCats = await db.animals.where("species").equals("gato").toArray();
  const gateraChips = new Set(cats.map((c) => c.microchip.trim().toUpperCase()));

  for (const a of animalCats) {
    const chip = a.microchip.trim().toUpperCase();
    if (!gateraChips.has(chip)) {
      cats.push({
        nroAnimal: a.nroAnimal || String(cats.length + 1),
        ubicacion: a.location,
        microchip: chip,
        shortChip: a.shortChip || (chip.length > 7 ? chip.slice(-7) : chip),
        hc: a.hc || (chip.length >= 5 ? chip.slice(-5) : chip),
        sexoCode: a.sexoCode || (a.gender === "hembra" ? "HFA" : "MFA"),
        sexo: (a.gender === "hembra" ? "hembra" : "macho") as "macho" | "hembra",
        grupoEdad: a.grupoEdad || "adulto",
        raza: a.breed || "DPC",
        isFeral: a.isFeral || false,
        color: a.color || "",
        tipoIngreso: a.tipoIngreso || "RES",
        edad: a.edad || "",
        fechaIngreso: a.fechaIngreso || "",
        condicionCorporal: a.condicionCorporal || "",
        estadoSalud: a.estadoSalud || "",
        medicacion: a.notes || "",
        observacionesMedicas: a.observacionesMedicas || a.notes || "",
        medicoVeterinario: a.medicoVeterinario || "",
        nombre: a.name,
        descripcion: a.name,
        pendientes: a.notes || "",
        status: a.status || "activo",
        fechaFallecimiento: a.fechaFallecimiento,
        causaFallecimiento: a.causaFallecimiento,
        ubicacionPrevia: a.ubicacionPrevia,
        requiereSeguimiento: a.requiereSeguimiento || "NO",
        tipoSeguimiento: a.tipoSeguimiento || "TRATAMIENTO",
        sistema: "TEGUMEN",
        fechaFinal: "HNI",
        tipo: "FS",
      });
      gateraChips.add(chip);
    }
  }

  const workbook = XLSX.utils.book_new();

  // Cabecera institucional oficial Alcaldía de Medellín / CBA La Perla (Filas 1 a 6)
  const INSTITUTIONAL_HEADER_ROWS: any[][] = [
    ["SISTEMA INTEGRADO DE GESTIÓN", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["FORMATO REGISTRO PLAN SANITARIO BLOQUE ", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Macroproceso: Gestión de Protección y Bienestar Animal", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Proceso: Atención a la Población Animal Vulnerable", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Código: FPM-AV3", "", "", "", "Versión: 5", "", "", "", "Fecha de Aprobación: 02/05/2023", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ];

  // Hoja 1: CENSO GATERA (Felinos Activos - Estructura Fiel de las 24 Columnas en Fila 7 del Archivo Maestro)
  const activeCats = cats.filter(
    (c) => c.ubicacion?.toUpperCase().trim() !== "FALLECIDO" && (c as any).status?.toLowerCase().trim() !== "fallecido"
  );
  const deceasedCats = cats.filter(
    (c) => c.ubicacion?.toUpperCase().trim() === "FALLECIDO" || (c as any).status?.toLowerCase().trim() === "fallecido"
  );

  const CENSO_24_HEADERS = [
    "N° animal",
    "Nº CANIL",
    "MICROCHIP (MC)",
    "HISTORIA CLINICA (HC)",
    "A",
    "RAZA",
    "FERALES",
    "COLOR",
    "TIPO DE INGRESO",
    "FECHA DE NACIMIENTO",
    "EDAD APROXIMADA MESES ",
    "FECHA DE INGRESO",
    "CONDICION CORPORAL",
    "ESTADO",
    "TRATAMIENTO",
    "OBSERVACIONES MEDICAS  ",
    "REQUIERE SEGUIMIENTO SI/NO ",
    "TIPO DE SEGUIMIENTO ",
    "FECHA ",
    "PELUQUERIA ",
    "CORTE DE UÑAS ",
    "LIMPIEZA DE OIDOS",
    "FECHA EN QUE SE REALIZÓ",
    "MÉDICO VETERINARIO",
  ];

  const censoRows: any[][] = [
    ...INSTITUTIONAL_HEADER_ROWS,
    CENSO_24_HEADERS,
  ];

  activeCats.forEach((c) => {
    censoRows.push([
      c.nroAnimal || "",
      c.ubicacion || "",
      c.microchip || "",
      c.hc || "",
      c.sexoCode || (c.sexo === "hembra" ? "HFA" : "MFA"),
      c.raza || "DPC",
      c.isFeral ? "SI" : "NO",
      c.color || "",
      c.tipoIngreso || "RES",
      c.fechaNacimiento || "",
      c.edad || "",
      c.fechaIngreso || "",
      c.condicionCorporal || "RANGO 2.0/5",
      c.estadoSalud || "Saludable",
      c.medicacion || "",
      c.observacionesMedicas || "",
      c.requiereSeguimiento || (c.observacionesMedicas ? "SI" : "NO"),
      c.tipoSeguimiento || "TRATAMIENTO",
      c.fechaSeguimiento || "",
      c.peluqueria || "",
      c.corteUnas || "",
      c.limpiezaOidos || "",
      c.fechaAseo || "",
      c.medicoVeterinario || "Dra. Jenny Zapata Calle",
    ]);
  });

  const wsCenso = XLSX.utils.aoa_to_sheet(censoRows);
  wsCenso["!cols"] = [
    { wch: 10 }, // N° animal
    { wch: 22 }, // Nº CANIL
    { wch: 22 }, // MICROCHIP
    { wch: 14 }, // HC
    { wch: 8 },  // A (sexoCode)
    { wch: 10 }, // RAZA
    { wch: 10 }, // FERALES
    { wch: 26 }, // COLOR
    { wch: 16 }, // TIPO DE INGRESO
    { wch: 14 }, // FECHA DE NACIMIENTO
    { wch: 20 }, // EDAD APROXIMADA
    { wch: 14 }, // FECHA DE INGRESO
    { wch: 16 }, // CONDICION CORPORAL
    { wch: 14 }, // ESTADO
    { wch: 38 }, // TRATAMIENTO
    { wch: 35 }, // OBSERVACIONES MEDICAS
    { wch: 14 }, // REQUIERE SEGUIMIENTO
    { wch: 20 }, // TIPO DE SEGUIMIENTO
    { wch: 14 }, // FECHA SEGUIMIENTO
    { wch: 12 }, // PELUQUERIA
    { wch: 14 }, // CORTE DE UÑAS
    { wch: 16 }, // LIMPIEZA DE OIDOS
    { wch: 14 }, // FECHA ASEO
    { wch: 30 }, // MÉDICO VETERINARIO
  ];
  XLSX.utils.book_append_sheet(workbook, wsCenso, "CENSO");

  // Hoja 2: PLAN TTO OCTUBRE GATERA (Exclusivo Felinos Activos - Columnas idénticas al original)
  const TTO_HEADERS = [
    "FECHA INICIO",
    "CANIL",
    "MICROCHIP (MC)",
    "DESCRIPCIÓN ",
    "MEDICACION (DOSIS)",
    "LIMPIEZA",
    "FECHA FINAL ",
    "TIPO ",
    "SISTEMA AFECTADO",
    "OBSERVACION ",
    "MEDICO VETERINARIO ",
  ];

  const ttoRows: any[][] = [TTO_HEADERS];
  activeCats
    .filter((c) => c.medicacion && c.medicacion !== "Ninguno")
    .forEach((c) => {
      ttoRows.push([
        c.fechaInicio || "",
        c.ubicacion || "",
        c.microchip || "",
        c.descripcion || c.nombre || "Felino GATERA",
        c.medicacion || "",
        c.limpieza || "",
        c.fechaFinal || "HNI",
        c.tipo || "FS",
        c.sistema || "TEGUMEN",
        c.observacionesMedicas || c.pendientes || "",
        c.medicoVeterinario || "Dra. Jenny Zapata Calle",
      ]);
    });

  const wsTto = XLSX.utils.aoa_to_sheet(ttoRows);
  wsTto["!cols"] = [
    { wch: 14 }, // FECHA INICIO
    { wch: 18 }, // CANIL
    { wch: 22 }, // MICROCHIP
    { wch: 30 }, // DESCRIPCIÓN
    { wch: 35 }, // MEDICACION
    { wch: 16 }, // LIMPIEZA
    { wch: 14 }, // FECHA FINAL
    { wch: 10 }, // TIPO
    { wch: 18 }, // SISTEMA AFECTADO
    { wch: 32 }, // OBSERVACION
    { wch: 28 }, // MEDICO VETERINARIO
  ];
  XLSX.utils.book_append_sheet(workbook, wsTto, "PLAN TTO OCTUBRE");

  // Hoja 3: PLAN SANITARIO FELINO (35 Columnas Oficiales con Cabecera Institucional)
  const SANITARIO_HEADERS = [
    "No", "CANIL", "MICROCHIP (MC)", "HISTORIA CLINICA (HC)", "FECHA ", "TRIPLE", "LEUCEMIA", "RABIA",
    "FECHA", "PRODUCTO", "FECHA", "PRODUCTO", "FECHA", "PRODUCTO", "FECHA", "PRODUCTO",
    "FECHA", "INTERPRETACIÓN", "FECHA", "INTERPRETACIÓN", "FECHA", "INTERPRETACIÓN", "FECHA", "INTERPRETACIÓN",
    "FECHA ", "FECHA ", "FECHA", "FECHA", "FECHA", "EXÁMENES", "SEXO", "ESPECIE", "EDAD", "MV", "OBSERVACIONES"
  ];

  const sanRows: any[][] = [
    ...INSTITUTIONAL_HEADER_ROWS,
    SANITARIO_HEADERS,
  ];

  activeCats.forEach((c, idx) => {
    sanRows.push([
      idx + 1,
      c.ubicacion || "",
      c.microchip || "",
      c.hc || "",
      c.vacunaFecha || "",
      c.vacunaTriple || "PENDIENTE",
      c.vacunaLeucemia || "PENDIENTE",
      c.vacunaRabia || "PENDIENTE",
      "", c.desparasitante || "FIPRONIL / TOTAL FCG",
      "", "", "", "", "", "",
      "", c.retroViralInterpretacion || "VIF / FeLV NEGATIVO",
      "", "", "", "", "", "",
      "", "", "", "", "",
      c.examenes || "",
      c.sexoCode || (c.sexo === "hembra" ? "HFA" : "MFA"),
      "FELINO",
      c.edad || "24 MESES",
      c.medicoVeterinario || "Dra. Jenny Zapata Calle",
      c.observacionesMedicas || "",
    ]);
  });

  const wsSan = XLSX.utils.aoa_to_sheet(sanRows);
  XLSX.utils.book_append_sheet(workbook, wsSan, "PLAN SANITARIO");

  // Hoja 4: MUERTES (Estructura oficial de 23 columnas con cabecera institucional)
  const MUERTES_HEADERS = [
    "N° animal",
    "Nº CANIL",
    "MICROCHIP (MC)",
    "HISTORIA CLINICA (HC)",
    "SEXO",
    "RAZA",
    "MANEJO ESPECIAL",
    "COLOR",
    "TIPO DE INGRESO",
    "FECHA DE NACIMIENTO",
    "EDAD APROXIMADA MESES ",
    "FECHA DE INGRESO",
    "CONDICION CORPORAL",
    "ESTADO",
    "TRATAMIENTO",
    "OBSERVACIONES MEDICAS  ",
    "REQUIERE SEGUIMIENTO SI/NO ",
    "TIPO DE SEGUIMIENTO ",
    "FECHA ",
    "PELUQUERIA ",
    "CORTE DE UÑAS ",
    "LIMPIEZA DE OIDOS",
    "FECHA EN QUE SE REALIZÓ",
  ];

  const muertesRows: any[][] = [
    ...INSTITUTIONAL_HEADER_ROWS,
    MUERTES_HEADERS,
  ];

  deceasedCats.forEach((c) => {
    muertesRows.push([
      c.nroAnimal || "",
      (c as any).ubicacionPrevia || c.ubicacion || "GATERA",
      c.microchip || "",
      c.hc || "",
      c.sexoCode || (c.sexo === "hembra" ? "HFA" : "MFA"),
      c.raza || "DPC",
      c.isFeral ? "SI" : "NO",
      c.color || "",
      c.tipoIngreso || "RES",
      c.fechaNacimiento || "",
      c.edad || "",
      c.fechaIngreso || "",
      c.condicionCorporal || "",
      "FALLECIDO",
      c.medicacion || "",
      (c as any).causaFallecimiento || c.observacionesMedicas || "Fallecido",
      "NO",
      "FALLECIMIENTO",
      (c as any).fechaFallecimiento || "",
      "",
      "",
      "",
      (c as any).fechaFallecimiento || "",
    ]);
  });

  const wsMuertes = XLSX.utils.aoa_to_sheet(muertesRows);
  wsMuertes["!cols"] = [
    { wch: 10 },
    { wch: 22 },
    { wch: 22 },
    { wch: 14 },
    { wch: 8 },
    { wch: 10 },
    { wch: 16 },
    { wch: 26 },
    { wch: 16 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 30 },
    { wch: 35 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(workbook, wsMuertes, "MUERTES");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `Plan_de_manejo_GATERA_${today}.xlsx`);
}

/**
 * Exportar exclusivamente el Registro y Control de Felinos Fallecidos en Excel (.xlsx)
 */
export async function exportFallecidosExcel() {
  const cats = await db.gateraRecords.toArray();
  const deceasedCats = cats.filter(
    (c) => c.ubicacion?.toUpperCase().trim() === "FALLECIDO" || (c as any).status?.toLowerCase().trim() === "fallecido"
  );

  const workbook = XLSX.utils.book_new();

  const rows = deceasedCats.map((c, idx) => ({
    "N°": idx + 1,
    "HISTORIA CLINICA (HC)": c.hc,
    "MICROCHIP (MC)": c.microchip,
    "NOMBRE FELINO": c.nombre || "S/N",
    "SEXO": c.sexoCode || (c.sexo === "hembra" ? "HFA" : "MFA"),
    "RAZA": c.raza || "DPC",
    "COLOR (COLUMNA H)": c.color || "",
    "ÚLTIMA UBICACIÓN PREVIA": (c as any).ubicacionPrevia || "GATERA",
    "FECHA FALLECIMIENTO": (c as any).fechaFallecimiento || new Date().toISOString().split("T")[0],
    "CAUSA DE DEFUNCIÓN / OBSERVACIONES": (c as any).causaFallecimiento || c.observacionesMedicas || "Sin observaciones registradas",
    "MÉDICO VETERINARIO RESPONSABLE": c.medicoVeterinario || "Dra. Jenny Zapata Calle",
  }));

  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ "INFORMACIÓN": "No hay felinos registrados como fallecidos actualmente." }]);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 22 },
    { wch: 26 },
    { wch: 10 },
    { wch: 12 },
    { wch: 28 },
    { wch: 24 },
    { wch: 22 },
    { wch: 45 },
    { wch: 32 },
  ];

  XLSX.utils.book_append_sheet(workbook, ws, "FALLECIDOS");
  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `CONTROL_FALLECIDOS_GATERA_${today}.xlsx`);
}

export interface UserScanDeceasedExportOptions {
  userFilter?: string; // "all" o nombre específico
  dateFilter?: "all" | "today" | "yesterday" | "week";
}

/**
 * Normaliza nombres de usuario para agrupar variaciones tipográficas
 */
export function normalizeStaffName(rawName?: string | null): string {
  if (!rawName) return "Sin Asignar";
  const clean = rawName.trim();
  const upper = clean.toUpperCase();

  if (upper.includes("NATALIA") && upper.includes("CORTES")) return "Dra. Natalia Cortés Restrepo";
  if (upper.includes("JENNY") && upper.includes("ZAPATA")) return "Dra. Jenny Zapata Calle";
  if (upper.includes("YANETH") && upper.includes("CALD")) return "Yaneth Esperanza Caldón Manquillo";
  if (upper.includes("GHINA") || upper.includes("COMBARIZA") || upper.includes("COMBRIZA")) return "Ghina Marcela Combariza";
  if (upper.includes("DANIELA") && upper.includes("MONSALVE")) return "Daniela Monsalve Arcila";
  if (upper.includes("CAROLINA") && upper.includes("FRANCO")) return "Dra. Carolina Franco Gallego";
  if (upper.includes("ANDRES") && upper.includes("CH")) return "Andres Ch";
  if (upper.includes("ADMINISTRADOR")) return "Dr. Administrador Maestro";
  if (clean === "Personal CBA La Perla" || clean === "anon_user") return "Personal de Turno CBA";

  return clean;
}

export interface ScanItem {
  timestamp: string;
  date: string;
  userName: string;
  userRole: string;
  microchip: string;
  shortChip: string;
  hc: string;
  name: string;
  location: string;
  status: string;
  condicionCorporal: string;
  estadoSalud: string;
  retroviralStatus: string;
  isFeral: boolean;
  medicacion: string;
  hasPhoto: boolean;
  observaciones: string;
}

export interface DeceasedItem {
  fecha: string;
  userName: string;
  microchip: string;
  shortChip: string;
  hc: string;
  name: string;
  sexo: string;
  raza: string;
  color: string;
  ubicacionPrevia: string;
  causa: string;
  isFeral: boolean;
  hasPhoto: boolean;
  observaciones: string;
}

export interface UserActivityStatsItem {
  id: string;
  name: string;
  role: string;
  count: number;
  scans: number;
  deceased: number;
  photos: number;
  firstScan: string;
  lastScan: string;
}

/**
 * Obtiene y consolida toda la actividad de escaneos y fallecidos de IndexedDB
 */
export async function getConsolidatedActivityData(
  dateFilter: "all" | "today" | "yesterday" | "week" = "all"
) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split("T")[0];
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [censusList, animalsList, gateraList, staffList] = await Promise.all([
    db.census.toArray(),
    db.animals.toArray(),
    db.gateraRecords.toArray(),
    db.staff.toArray().catch(() => []),
  ]);

  const animalMap = new Map<string, any>();
  for (const a of animalsList) {
    const chip = (a.microchip || "").trim().toUpperCase();
    if (chip) animalMap.set(chip, a);
    if (a.shortChip) animalMap.set(a.shortChip.trim().toUpperCase(), a);
  }
  for (const g of gateraList) {
    const chip = (g.microchip || "").trim().toUpperCase();
    if (chip && !animalMap.has(chip)) animalMap.set(chip, g);
  }

  const allScans: ScanItem[] = [];
  const registeredScansKey = new Set<string>();

  // A. Desde la tabla censo (escaneos en campo con lector W91A)
  for (const c of censusList) {
    const rawChip = (c.microchip || "").trim().toUpperCase();
    const ts = c.scannedAt || todayStr;
    const date = ts.split("T")[0];
    const key = `${rawChip}_${date}`;
    if (!registeredScansKey.has(key)) {
      const match = animalMap.get(rawChip);
      const uName = normalizeStaffName(c.scannedBy || match?.medicoVeterinario || match?.updatedBy || match?.createdBy);
      allScans.push({
        timestamp: ts,
        date,
        userName: uName,
        userRole: uName.startsWith("Dr") ? "MÉDICO VETERINARIO" : "OPERARIO / AUXILIAR",
        microchip: c.microchip || rawChip,
        shortChip: c.shortChip || (rawChip.length > 7 ? rawChip.slice(-7) : rawChip),
        hc: c.hc || match?.hc || "N/A",
        name: c.animalName || match?.name || match?.nombre || "Felino",
        location: c.location || match?.location || match?.ubicacion || "GATERA",
        status: match?.status || "activo",
        condicionCorporal: c.condicionCorporal || match?.condicionCorporal || "Normal",
        estadoSalud: c.estadoSalud || match?.estadoSalud || "Estable",
        retroviralStatus: c.retroviralStatus || match?.retroviralStatus || "NEGATIVO",
        isFeral: Boolean(c.isFeral || match?.isFeral),
        medicacion: c.medicacion || match?.medicacion || match?.notes || "Ninguno",
        hasPhoto: Boolean(c.photoUrl || match?.photoUrl),
        observaciones: c.observacionesMedicas || match?.observacionesMedicas || match?.notes || "Sin observaciones",
      });
      registeredScansKey.add(key);
    }
  }

  // B. Desde animales con lastCensusDate
  for (const a of animalsList) {
    const rawChip = (a.microchip || "").trim().toUpperCase();
    const ts = a.lastCensusDate;
    if (ts) {
      const date = ts.split("T")[0];
      const key = `${rawChip}_${date}`;
      if (!registeredScansKey.has(key)) {
        const uName = normalizeStaffName(a.updatedBy || a.medicoVeterinario || a.createdBy);
        allScans.push({
          timestamp: ts,
          date,
          userName: uName,
          userRole: uName.startsWith("Dr") ? "MÉDICO VETERINARIO" : "OPERARIO / AUXILIAR",
          microchip: a.microchip || rawChip,
          shortChip: a.shortChip || (rawChip.length > 7 ? rawChip.slice(-7) : rawChip),
          hc: a.hc || "N/A",
          name: a.name || "Felino",
          location: a.location || "GATERA",
          status: a.status || "activo",
          condicionCorporal: a.condicionCorporal || "Normal",
          estadoSalud: a.estadoSalud || "Estable",
          retroviralStatus: a.retroviralStatus || "NEGATIVO",
          isFeral: Boolean(a.isFeral),
          medicacion: a.notes || a.observacionesMedicas || "Ninguno",
          hasPhoto: Boolean(a.photoUrl),
          observaciones: a.observacionesMedicas || a.notes || "Sin observaciones",
        });
        registeredScansKey.add(key);
      }
    }
  }

  // C. Consolidar felinos fallecidos
  const allDeceased: DeceasedItem[] = [];
  const deceasedChips = new Set<string>();

  for (const a of animalsList) {
    const isFallecido =
      (a.location || "").toUpperCase().trim() === "FALLECIDO" ||
      (a.status || "").toLowerCase().trim() === "fallecido" ||
      Boolean(a.fechaFallecimiento);

    if (isFallecido) {
      const chip = (a.microchip || "").trim().toUpperCase();
      if (!deceasedChips.has(chip)) {
        const gRec = gateraList.find((g) => (g.microchip || "").trim().toUpperCase() === chip);
        const uName = normalizeStaffName(a.updatedBy || a.medicoVeterinario || gRec?.medicoVeterinario || a.createdBy);
        allDeceased.push({
          fecha: a.fechaFallecimiento || gRec?.fechaFallecimiento || a.updatedAt?.split("T")[0] || todayStr,
          userName: uName,
          microchip: a.microchip,
          shortChip: a.shortChip || (chip.length > 7 ? chip.slice(-7) : chip),
          hc: a.hc || gRec?.hc || "N/A",
          name: a.name || gRec?.nombre || "Felino",
          sexo: a.gender || gRec?.sexo || "macho",
          raza: a.breed || gRec?.raza || "DPC",
          color: a.color || gRec?.color || "N/A",
          ubicacionPrevia: a.ubicacionPrevia || gRec?.ubicacionPrevia || "GATERA",
          causa: a.causaFallecimiento || gRec?.causaFallecimiento || a.notes || "Causa en estudio",
          isFeral: Boolean(a.isFeral || gRec?.isFeral),
          hasPhoto: Boolean(a.photoUrl || gRec?.photoUrl),
          observaciones: a.observacionesMedicas || a.notes || gRec?.observacionesMedicas || "Registro de defunción",
        });
        deceasedChips.add(chip);
      }
    }
  }

  for (const g of gateraList) {
    const isFallecido =
      (g.ubicacion || "").toUpperCase().trim() === "FALLECIDO" ||
      (g.status || "").toLowerCase().trim() === "fallecido" ||
      Boolean(g.fechaFallecimiento);

    if (isFallecido) {
      const chip = (g.microchip || "").trim().toUpperCase();
      if (!deceasedChips.has(chip)) {
        const uName = normalizeStaffName(g.medicoVeterinario || g.updatedBy || g.createdBy);
        allDeceased.push({
          fecha: g.fechaFallecimiento || todayStr,
          userName: uName,
          microchip: g.microchip,
          shortChip: g.shortChip || (chip.length > 7 ? chip.slice(-7) : chip),
          hc: g.hc || "N/A",
          name: g.nombre || "Felino",
          sexo: g.sexo || "macho",
          raza: g.raza || "DPC",
          color: g.color || "N/A",
          ubicacionPrevia: g.ubicacionPrevia || "GATERA",
          causa: g.causaFallecimiento || g.observacionesMedicas || "Causa en estudio",
          isFeral: Boolean(g.isFeral),
          hasPhoto: Boolean(g.photoUrl),
          observaciones: g.observacionesMedicas || g.pendientes || "Registro de defunción",
        });
        deceasedChips.add(chip);
      }
    }
  }

  const matchDate = (dateOrTs: string) => {
    if (dateFilter === "all") return true;
    const d = dateOrTs.includes("T") ? dateOrTs.split("T")[0] : dateOrTs;
    if (dateFilter === "today") return d === todayStr;
    if (dateFilter === "yesterday") return d === yesterdayStr;
    if (dateFilter === "week") return d >= sevenDaysAgo;
    return true;
  };

  const filteredScansByDate = allScans.filter((s) => matchDate(s.date));
  const filteredDeceasedByDate = allDeceased.filter((d) => matchDate(d.fecha));

  return {
    allScans,
    allDeceased,
    filteredScansByDate,
    filteredDeceasedByDate,
    todayStr,
    yesterdayStr,
    sevenDaysAgo,
    staffList,
  };
}

/**
 * Obtiene estadísticas exactas de actividad por usuario para la previsualización del Modal
 */
export async function getUserActivityStats(
  dateFilter: "all" | "today" | "yesterday" | "week" = "all",
  userFilter: string = "all"
): Promise<{
  userList: UserActivityStatsItem[];
  previewStats: { scans: number; deceased: number; photos: number };
}> {
  const data = await getConsolidatedActivityData(dateFilter);
  const userMap = new Map<string, UserActivityStatsItem>();

  // Incorporar staff registrado
  for (const s of data.staffList) {
    const norm = normalizeStaffName(s.name);
    userMap.set(norm, {
      id: norm,
      name: norm,
      role: s.role === "veterinario" ? "MÉDICO VETERINARIO" : s.role.toUpperCase(),
      count: 0,
      scans: 0,
      deceased: 0,
      photos: 0,
      firstScan: "",
      lastScan: "",
    });
  }

  // Acumular escaneos filtrados por fecha
  for (const s of data.filteredScansByDate) {
    let item = userMap.get(s.userName);
    if (!item) {
      item = {
        id: s.userName,
        name: s.userName,
        role: s.userRole,
        count: 0,
        scans: 0,
        deceased: 0,
        photos: 0,
        firstScan: s.timestamp,
        lastScan: s.timestamp,
      };
      userMap.set(s.userName, item);
    }
    item.scans++;
    item.count++;
    if (s.hasPhoto) item.photos++;
    if (!item.firstScan || s.timestamp < item.firstScan) item.firstScan = s.timestamp;
    if (!item.lastScan || s.timestamp > item.lastScan) item.lastScan = s.timestamp;
  }

  // Acumular fallecidos filtrados por fecha
  for (const d of data.filteredDeceasedByDate) {
    let item = userMap.get(d.userName);
    if (!item) {
      item = {
        id: d.userName,
        name: d.userName,
        role: "MÉDICO VETERINARIO",
        count: 0,
        scans: 0,
        deceased: 0,
        photos: 0,
        firstScan: d.fecha,
        lastScan: d.fecha,
      };
      userMap.set(d.userName, item);
    }
    item.deceased++;
    item.count++;
    if (d.hasPhoto) item.photos++;
  }

  const userList = Array.from(userMap.values())
    .sort((a, b) => b.count - a.count);

  let previewStats = { scans: 0, deceased: 0, photos: 0 };
  if (userFilter === "all" || !userFilter.trim()) {
    const totalPhotos = data.filteredScansByDate.filter((s) => s.hasPhoto).length +
      data.filteredDeceasedByDate.filter((d) => d.hasPhoto).length;
    previewStats = {
      scans: data.filteredScansByDate.length,
      deceased: data.filteredDeceasedByDate.length,
      photos: totalPhotos,
    };
  } else {
    const targetNorm = normalizeStaffName(userFilter).toLowerCase();
    const matchedUser = userList.find((u) => {
      const uNorm = u.name.toLowerCase();
      return uNorm.includes(targetNorm) || targetNorm.includes(uNorm);
    });
    if (matchedUser) {
      previewStats = {
        scans: matchedUser.scans,
        deceased: matchedUser.deceased,
        photos: matchedUser.photos,
      };
    }
  }

  return { userList, previewStats };
}

/**
 * Exporta en Excel (.xlsx) la información suministrada por cada usuario de los escaneos diarios y felinos fallecidos
 */
export async function exportUserScansAndDeceasedExcel(
  options: UserScanDeceasedExportOptions = {}
): Promise<{ totalScans: number; totalDeceased: number; fileName: string }> {
  const { userFilter = "all", dateFilter = "all" } = options;

  const data = await getConsolidatedActivityData(dateFilter);
  const { filteredScansByDate, filteredDeceasedByDate, todayStr } = data;

  const matchUser = (uName: string) => {
    if (userFilter === "all" || !userFilter.trim()) return true;
    const targetNorm = normalizeStaffName(userFilter).toLowerCase();
    const currentNorm = normalizeStaffName(uName).toLowerCase();
    return currentNorm.includes(targetNorm) || targetNorm.includes(currentNorm);
  };

  const filteredScans = filteredScansByDate
    .filter((s) => matchUser(s.userName))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const filteredDeceased = filteredDeceasedByDate
    .filter((d) => matchUser(d.userName))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  // 5. Construir Workbook de Excel
  const wb = XLSX.utils.book_new();

  // HOJA 1: RESUMEN DE ACTIVIDAD POR USUARIO
  const userAggMap = new Map<string, {
    userName: string;
    role: string;
    totalScans: number;
    activeCats: number;
    deceasedCount: number;
    withPhotos: number;
    firstScan: string;
    lastScan: string;
  }>();

  for (const s of filteredScans) {
    let agg = userAggMap.get(s.userName);
    if (!agg) {
      agg = {
        userName: s.userName,
        role: s.userRole,
        totalScans: 0,
        activeCats: 0,
        deceasedCount: 0,
        withPhotos: 0,
        firstScan: s.timestamp,
        lastScan: s.timestamp,
      };
      userAggMap.set(s.userName, agg);
    }
    agg.totalScans++;
    if (s.status !== "fallecido") agg.activeCats++;
    if (s.hasPhoto) agg.withPhotos++;
    if (s.timestamp < agg.firstScan) agg.firstScan = s.timestamp;
    if (s.timestamp > agg.lastScan) agg.lastScan = s.timestamp;
  }

  for (const d of filteredDeceased) {
    let agg = userAggMap.get(d.userName);
    if (!agg) {
      agg = {
        userName: d.userName,
        role: "MÉDICO VETERINARIO",
        totalScans: 0,
        activeCats: 0,
        deceasedCount: 0,
        withPhotos: 0,
        firstScan: d.fecha,
        lastScan: d.fecha,
      };
      userAggMap.set(d.userName, agg);
    }
    agg.deceasedCount++;
  }

  const resumenRows = Array.from(userAggMap.values())
    .sort((a, b) => (b.totalScans + b.deceasedCount) - (a.totalScans + a.deceasedCount))
    .map((u, idx) => ({
      "N°": idx + 1,
      "FUNCIONARIO / PROFESIONAL": u.userName,
      "CARGO / ROL": u.role,
      "TOTAL ESCANEOS / CENSOS": u.totalScans,
      "FELINOS ACTIVOS VERIFICADOS": u.activeCats,
      "FELINOS FALLECIDOS REGISTRADOS": u.deceasedCount,
      "FOTOGRAFÍAS ADJUNTADAS": u.withPhotos,
      "PRIMER ESCANEO REGISTRADO": u.firstScan ? new Date(u.firstScan).toLocaleString() : "N/A",
      "ÚLTIMO ESCANEO REGISTRADO": u.lastScan ? new Date(u.lastScan).toLocaleString() : "N/A",
    }));

  const wsResumen = XLSX.utils.json_to_sheet(
    resumenRows.length > 0
      ? resumenRows
      : [{ "ESTADO": "No se encontraron escaneos ni fallecidos con los filtros seleccionados." }]
  );
  wsResumen["!cols"] = [
    { wch: 6 },
    { wch: 32 },
    { wch: 22 },
    { wch: 24 },
    { wch: 26 },
    { wch: 28 },
    { wch: 24 },
    { wch: 26 },
    { wch: 26 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumen, "RESUMEN_POR_USUARIO");

  // HOJA 2: ESCANEOS DIARIOS SUMINISTRADOS POR CADA USUARIO
  const scanRows = filteredScans.map((s, idx) => ({
    "N°": idx + 1,
    "FECHA Y HORA": new Date(s.timestamp).toLocaleString(),
    "FUNCIONARIO RESPONSABLE": s.userName,
    "ROL": s.userRole,
    "MICROCHIP (MC)": s.microchip,
    "CHIP CORTO (7 DÍGITOS)": s.shortChip,
    "HISTORIA CLÍNICA (HC)": s.hc,
    "NOMBRE DEL FELINO": s.name,
    "CANIL / UBICACIÓN EN GATERA": s.location,
    "ESTADO CLÍNICO": s.status.toUpperCase(),
    "CONDICIÓN CORPORAL": s.condicionCorporal,
    "ESTADO DE SALUD": s.estadoSalud,
    "ESTATUS RETROVIRAL": s.retroviralStatus,
    "MANEJO ESPECIAL / FERAL": s.isFeral ? "SI (FERAL)" : "NO",
    "TRATAMIENTO PRESCRITO": s.medicacion,
    "FOTO REGISTRADA": s.hasPhoto ? "SÍ (FOTO EN SISTEMA)" : "NO",
    "OBSERVACIONES MÉDICAS": s.observaciones,
  }));

  const wsScans = XLSX.utils.json_to_sheet(
    scanRows.length > 0
      ? scanRows
      : [{ "INFORMACIÓN": "No hay registros de escaneos diarios para el período o usuario seleccionado." }]
  );
  wsScans["!cols"] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 32 },
    { wch: 20 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 26 },
    { wch: 24 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 16 },
    { wch: 30 },
    { wch: 20 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(wb, wsScans, "ESCANEOS_DIARIOS");

  // HOJA 3: CONTROL DE FELINOS FALLECIDOS
  const deceasedRows = filteredDeceased.map((d, idx) => ({
    "N°": idx + 1,
    "FECHA DE FALLECIMIENTO": d.fecha,
    "REGISTRADO POR (MÉDICO/FUNCIONARIO)": d.userName,
    "MICROCHIP (MC)": d.microchip,
    "CHIP CORTO (7 DÍGITOS)": d.shortChip,
    "HISTORIA CLÍNICA (HC)": d.hc,
    "NOMBRE DEL FELINO": d.name,
    "SEXO": d.sexo.toUpperCase(),
    "RAZA": d.raza,
    "COLOR": d.color,
    "ÚLTIMA UBICACIÓN PREVIA (CANIL)": d.ubicacionPrevia,
    "CAUSA DE DEFUNCIÓN / DIAGNÓSTICO": d.causa,
    "MANEJO ESPECIAL / FERAL": d.isFeral ? "SI (FERAL)" : "NO",
    "FOTO REGISTRADA": d.hasPhoto ? "SÍ (FOTO EN SISTEMA)" : "NO",
    "OBSERVACIONES Y ANTECEDENTES": d.observaciones,
  }));

  const wsDeceased = XLSX.utils.json_to_sheet(
    deceasedRows.length > 0
      ? deceasedRows
      : [{ "INFORMACIÓN": "No hay felinos registrados como fallecidos en el período o usuario seleccionado." }]
  );
  wsDeceased["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 32 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 26 },
    { wch: 10 },
    { wch: 12 },
    { wch: 24 },
    { wch: 24 },
    { wch: 40 },
    { wch: 16 },
    { wch: 18 },
    { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsDeceased, "CONTROL_FALLECIDOS");

  // Nombre de archivo descriptivo
  let userLabel = "TODOS_LOS_USUARIOS";
  if (userFilter !== "all" && userFilter.trim()) {
    userLabel = normalizeStaffName(userFilter)
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .toUpperCase();
  }
  const fileName = `CBA_Escaneos_y_Fallecidos_${userLabel}_${todayStr}.xlsx`;
  XLSX.writeFile(wb, fileName);

  return {
    totalScans: filteredScans.length,
    totalDeceased: filteredDeceased.length,
    fileName,
  };
}

