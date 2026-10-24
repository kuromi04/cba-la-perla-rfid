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
  const workbook = XLSX.utils.book_new();

  // Hoja 1: CENSO GATERA (Estructura Fiel de las 24 Columnas del Archivo Maestro)
  const censoRows = cats.map((c) => ({
    "N° animal": c.nroAnimal || "",
    "Nº CANIL": c.ubicacion,
    "MICROCHIP (MC)": c.microchip,
    "HISTORIA CLINICA (HC)": c.hc,
    "A": c.sexoCode || (c.sexo === "hembra" ? "HFA" : "MFA"),
    "RAZA": c.raza || "DPC",
    "FERALES": c.isFeral ? "SI" : "NO",
    "COLOR": c.color || "",
    "TIPO DE INGRESO": c.tipoIngreso || "RES",
    "FECHA DE NACIMIENTO": c.fechaNacimiento || "",
    "EDAD APROXIMADA MESES ": c.edad || "",
    "FECHA DE INGRESO": c.fechaIngreso || "",
    "CONDICION CORPORAL": c.condicionCorporal || "RANGO 2.0/5",
    "ESTADO": c.estadoSalud || "Saludable",
    "TRATAMIENTO": c.medicacion || "",
    "OBSERVACIONES MEDICAS  ": c.observacionesMedicas || "",
    "REQUIERE SEGUIMIENTO SI/NO ": c.requiereSeguimiento || (c.observacionesMedicas ? "SI" : "NO"),
    "TIPO DE SEGUIMIENTO ": c.tipoSeguimiento || "TRATAMIENTO",
    "FECHA ": c.fechaSeguimiento || "",
    "PELUQUERIA ": c.peluqueria || "",
    "CORTE DE UÑAS ": c.corteUnas || "",
    "LIMPIEZA DE OIDOS": c.limpiezaOidos || "",
    "FECHA EN QUE SE REALIZÓ": c.fechaAseo || "",
    "MÉDICO VETERINARIO": c.medicoVeterinario || "Dra. Jenny Zapata Calle",
  }));
  const wsCenso = XLSX.utils.json_to_sheet(censoRows);
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

  // Hoja 2: PLAN TTO OCTUBRE GATERA
  const ttoRows = cats
    .filter((c) => c.medicacion && c.medicacion !== "Ninguno")
    .map((c) => ({
      "CANIL": c.ubicacion,
      "MICROCHIP (MC)": c.microchip,
      "HISTORIA CLINICA (HC)": c.hc,
      "DESCRIPCIÓN": c.descripcion,
      "MEDICACION (DOSIS)": c.medicacion,
      "SISTEMA": c.sistema,
      "FECHA FINAL": c.fechaFinal,
      "TIPO": c.tipo,
      "PENDIENTES": c.pendientes,
    }));
  const wsTto = XLSX.utils.json_to_sheet(ttoRows);
  XLSX.utils.book_append_sheet(workbook, wsTto, "PLAN TTO OCTUBRE");

  // Hoja 3: PLAN SANITARIO FELINO
  const sanRows = cats.map((c) => ({
    "CANIL": c.ubicacion,
    "MICROCHIP (MC)": c.microchip,
    "HISTORIA CLINICA (HC)": c.hc,
    "DESCRIPCIÓN": c.descripcion,
    "TRIPLE FELINA": c.vacunaTriple || "PENDIENTE",
    "LEUCEMIA FELINA": c.vacunaLeucemia || "PENDIENTE",
    "DESPARASITANTE": c.desparasitante || "FIPRONIL / TOTAL FCG",
  }));
  const wsSan = XLSX.utils.json_to_sheet(sanRows);
  XLSX.utils.book_append_sheet(workbook, wsSan, "PLAN SANITARIO");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `Plan_de_manejo_GATERA_${today}.xlsx`);
}

