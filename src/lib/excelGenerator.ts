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

