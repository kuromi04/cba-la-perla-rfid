import * as XLSX from "xlsx";
import { db, Animal, ShiftTask, generateTodayShiftTasks } from "./db";
import { ShelterRecord } from "./realData";
import { GateraCat } from "./gateraData";

export interface ImportResult {
  success: boolean;
  area: "caninos" | "gatera";
  count: number;
  message: string;
}

/**
 * Lee un archivo Excel (File) cargado por el usuario y sincroniza de inmediato
 * la base de datos de IndexedDB (shelterRecords o gateraRecords, animals, kardex y shiftTasks).
 */
export async function importExcelFile(file: File): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetNames = wb.SheetNames;

  // Detección automática por nombres de hojas
  const isGatera = sheetNames.some(
    (name) =>
      name.toUpperCase().includes("CENSO") ||
      name.toUpperCase().includes("GATERA") ||
      name.toUpperCase().includes("PLAN TTO") ||
      name.toUpperCase().includes("MATRIZ")
  );

  const isCaninos = sheetNames.some(
    (name) =>
      name.toUpperCase().includes("TRIAJE") ||
      name.toUpperCase().includes("UCE") ||
      name.toUpperCase().includes("BRAVECTO") ||
      name.toUpperCase().includes("DISTEMPER") ||
      name.toUpperCase().includes("PLANILLA")
  );

  if (isGatera) {
    return await parseAndSyncGateraExcel(wb);
  } else if (isCaninos) {
    return await parseAndSyncShelterExcel(wb);
  } else {
    // Si no coincide con los nombres exactos, intentar deducir por la primera hoja
    const firstSheet = wb.Sheets[sheetNames[0]];
    const preview: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, range: 0 });
    const textPreview = JSON.stringify(preview).toUpperCase();

    if (textPreview.includes("GATERA") || textPreview.includes("FELINO") || textPreview.includes("CUARENTENA")) {
      return await parseAndSyncGateraExcel(wb);
    } else {
      return await parseAndSyncShelterExcel(wb);
    }
  }
}

/**
 * Sincronización del Plan de Manejo GATERA (Felinos)
 */
async function parseAndSyncGateraExcel(wb: XLSX.WorkBook): Promise<ImportResult> {
  const catsMap: Record<string, GateraCat> = {};

  // 1. Hoja CENSO
  const censoSheetName = wb.SheetNames.find((s) => s.toUpperCase().includes("CENSO")) || wb.SheetNames[0];
  const wsCenso = wb.Sheets[censoSheetName];

  if (wsCenso) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wsCenso, { header: 1 });
    // Encontrar la fila con los encabezados
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(20, rows.length); i++) {
      const row = rows[i] || [];
      const rowStr = row.join(" ").toUpperCase();
      if (rowStr.includes("MICROCHIP") || rowStr.includes("MC") || rowStr.includes("HISTORIA CLINICA")) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx !== -1) {
      const headers = (rows[headerRowIdx] || []).map((h: any) => String(h || "").trim().toUpperCase());
      const colCanil = headers.findIndex((h) => h.includes("CANIL") || h.includes("UBICAC"));
      const colChip = headers.findIndex((h) => h.includes("MICROCHIP") || h === "MC");
      const colHc = headers.findIndex((h) => h.includes("HISTORIA") || h === "HC");
      const colDesc = headers.findIndex((h) => h.includes("DESCRIP") || h.includes("COLOR") || h === "A");
      const colFeral = headers.findIndex((h) => h.includes("FERAL"));
      const colTto = headers.findIndex((h) => h.includes("TRATAMIENTO"));
      const colObs = headers.findIndex((h) => h.includes("OBSERVACION"));
      const colEstado = headers.findIndex((h) => h.includes("ESTADO"));
      const colEdad = headers.findIndex((h) => h.includes("EDAD"));
      const colRaza = headers.findIndex((h) => h.includes("RAZA"));
      const colColor = headers.findIndex((h) => h.includes("COLOR"));

      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const rawChip = String(row[colChip] || "").trim();
        if (!rawChip || rawChip.length < 4 || rawChip.toUpperCase().includes("TOTAL")) continue;

        const cleanChip = rawChip.replace(/[^0-9]/g, "") || rawChip;
        const shortChip = cleanChip.length > 7 ? cleanChip.slice(-7) : cleanChip;
        const ubicacion = String(row[colCanil] || "GATERA").trim().toUpperCase();
        const hc = String(row[colHc] || "").trim();
        const desc = String(row[colDesc] || `Felino ${ubicacion}`).trim();
        const feralVal = String(row[colFeral] || "").toUpperCase();
        const isFeral = feralVal.includes("SI") || feralVal === "S";
        const tto = String(row[colTto] || "Ninguno").trim();
        const obs = String(row[colObs] || "").trim();
        const estado = String(row[colEstado] || "Estable").trim();
        const edad = String(row[colEdad] || "").trim();
        const raza = String(row[colRaza] || "DPC").trim();
        const color = String(row[colColor] || desc).trim();

        const catItem: GateraCat = {
          ubicacion,
          microchip: cleanChip,
          shortChip,
          hc,
          nombre: `Gato ${desc.split(" ")[0] || ""} (${ubicacion})`,
          descripcion: desc,
          sexo: desc.toUpperCase().includes("HFA") ? "hembra" : "macho",
          raza,
          color,
          isFeral,
          tipoIngreso: "APM",
          edad,
          condicionCorporal: "RANGO 2.5/5",
          estadoSalud: estado,
          medicacion: tto !== "Ninguno" ? tto : "",
          sistema: "General",
          fechaFinal: "HNI",
          tipo: "S",
          pendientes: obs,
        };

        catsMap[cleanChip] = catItem;
      }
    }
  }

  // 2. Hoja PLAN TTO OCTUBRE para enriquecer medicamentos
  const ttoSheetName = wb.SheetNames.find((s) => s.toUpperCase().includes("TTO") || s.toUpperCase().includes("OCTUBRE"));
  if (ttoSheetName && wb.Sheets[ttoSheetName]) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[ttoSheetName], { header: 1 });
    let hIdx = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const rowStr = (rows[i] || []).join(" ").toUpperCase();
      if (rowStr.includes("MICROCHIP") || rowStr.includes("MEDICACION")) {
        hIdx = i;
        break;
      }
    }

    if (hIdx !== -1) {
      const headers = (rows[hIdx] || []).map((h: any) => String(h || "").trim().toUpperCase());
      const colChip = headers.findIndex((h) => h.includes("MICROCHIP") || h === "MC");
      const colMed = headers.findIndex((h) => h.includes("MEDICACION") || h.includes("DOSIS"));
      const colSis = headers.findIndex((h) => h.includes("SISTEMA"));
      const colPend = headers.findIndex((h) => h.includes("OBSERV") || h.includes("PEND"));

      for (let r = hIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row) continue;
        const rawChip = String(row[colChip] || "").replace(/[^0-9]/g, "");
        if (rawChip && catsMap[rawChip]) {
          const med = String(row[colMed] || "").trim();
          if (med) catsMap[rawChip].medicacion = med;
          if (colSis !== -1 && row[colSis]) catsMap[rawChip].sistema = String(row[colSis]).trim();
          if (colPend !== -1 && row[colPend]) catsMap[rawChip].pendientes = String(row[colPend]).trim();
        }
      }
    }
  }

  const finalCats = Object.values(catsMap);
  if (finalCats.length === 0) {
    return {
      success: false,
      area: "gatera",
      count: 0,
      message: "No se pudieron extraer registros válidos de la hoja CENSO de Gatera.",
    };
  }

  // Guardar en Dexie db.gateraRecords
  await db.gateraRecords.clear();
  await db.gateraRecords.bulkAdd(finalCats);

  // Sincronizar en db.animals (actualizar o insertar)
  for (const cat of finalCats) {
    await db.animals.put({
      microchip: cat.microchip,
      shortChip: cat.shortChip,
      name: cat.nombre,
      species: "gato",
      breed: `${cat.raza} - ${cat.color}`,
      gender: cat.sexo,
      location: cat.ubicacion,
      status: "activo",
      notes: `HC: ${cat.hc}. ${cat.pendientes || ""}`,
      hc: cat.hc,
      isFeral: cat.isFeral,
      color: cat.color,
    });

    if (cat.medicacion && cat.medicacion !== "Ninguno") {
      const existingKardex = await db.kardex.where("microchip").equals(cat.microchip).first();
      if (!existingKardex) {
        await db.kardex.add({
          microchip: cat.microchip,
          shortChip: cat.shortChip,
          system: cat.sistema || "General",
          treatment: cat.medicacion,
          description: cat.descripcion,
          startDate: new Date().toISOString().split("T")[0],
          endDate: cat.fechaFinal || "HNI",
          status: "activo",
          prescribedBy: "Dra. Natalia Cortés R. (Gatera)",
          createdAt: new Date().toISOString(),
          area: "gatera",
          dosisTotales: 7,
          dosisAplicadas: 0,
          dosisFaltantes: 7,
        });
      }
    }
  }

  // Regenerar tareas de turnos con los datos actualizados
  await generateTodayShiftTasks();

  return {
    success: true,
    area: "gatera",
    count: finalCats.length,
    message: `¡Sincronización exitosa! Se cargaron y actualizaron ${finalCats.length} felinos de Gatera desde el Excel original.`,
  };
}

/**
 * Sincronización de PLANILLA MEDICA ALBERGUE (Caninos)
 */
async function parseAndSyncShelterExcel(wb: XLSX.WorkBook): Promise<ImportResult> {
  const shelterRecords: ShelterRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const upperName = sheetName.toUpperCase();
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let currentSection: ShelterRecord["section"] = "TRIAJE";
    if (upperName.includes("UCE")) currentSection = "UCE";
    else if (upperName.includes("LIMPIEZA") || upperName.includes("BAÑO")) currentSection = "LIMPIEZAS";
    else if (upperName.includes("NOCHE")) currentSection = "NOCHE";
    else if (upperName.includes("BRAVECTO")) currentSection = "BRAVECTO";
    else if (upperName.includes("DISTEMPER") || upperName.includes("CDV")) currentSection = "CDV";

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const rowStr = row.join(" ").toUpperCase();
      if (
        rowStr.includes("UBICACION") ||
        rowStr.includes("TOTAL ANIMALES") ||
        rowStr.includes("MEDICACION") && row.length < 3
      ) {
        if (rowStr.includes("TRATAMIENTOS FINALIZADOS")) {
          currentSection = currentSection === "UCE" ? "UCE_FINALIZADO" : "TRIAJE_FINALIZADO";
        }
        continue;
      }

      // Buscar celda que contenga microchip (más de 6 dígitos)
      let chipVal = "";
      let descVal = "";
      let ubicVal = "";
      let medVal = "";
      let pendVal = "";
      let sisVal = "";

      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || "").trim();
        const digits = val.replace(/[^0-9]/g, "");
        if (digits.length >= 6 && !chipVal) {
          chipVal = digits;
          // La columna previa suele ser ubicación
          if (c > 0 && row[c - 1]) ubicVal = String(row[c - 1]).trim().toUpperCase();
          // La columna siguiente suele ser descripción/nombre
          if (c + 1 < row.length && row[c + 1]) descVal = String(row[c + 1]).trim();
          if (c + 2 < row.length && row[c + 2]) medVal = String(row[c + 2]).trim();
        }
      }

      if (chipVal) {
        const shortChip = chipVal.length > 7 ? chipVal.slice(-7) : chipVal;
        shelterRecords.push({
          section: currentSection,
          ubicacion: ubicVal || "ALBERGUE",
          microchip: chipVal,
          shortChip,
          descripcion: descVal || `Canino ${chipVal.slice(-4)}`,
          medicacion: medVal,
          fechaFinal: "HNI",
          tipo: "S",
          sistema: sisVal || "General",
          pendientes: pendVal,
          dosisBravecto: currentSection === "BRAVECTO" ? "1.0" : undefined,
        });
      }
    }
  }

  if (shelterRecords.length === 0) {
    return {
      success: false,
      area: "caninos",
      count: 0,
      message: "No se encontraron registros de microchips válidos en las hojas de Caninos.",
    };
  }

  // Guardar en db.shelterRecords
  await db.shelterRecords.clear();
  await db.shelterRecords.bulkAdd(shelterRecords);

  // Sincronizar en db.animals
  for (const dog of shelterRecords) {
    await db.animals.put({
      microchip: dog.microchip,
      shortChip: dog.shortChip,
      name: dog.descripcion,
      species: "perro",
      breed: dog.descripcion,
      gender: "macho",
      location: dog.ubicacion,
      status: "activo",
      notes: dog.pendientes,
    });

    if (dog.medicacion) {
      const existing = await db.kardex.where("microchip").equals(dog.microchip).first();
      if (!existing) {
        await db.kardex.add({
          microchip: dog.microchip,
          shortChip: dog.shortChip,
          system: dog.sistema || "General",
          treatment: dog.medicacion,
          description: dog.descripcion,
          startDate: new Date().toISOString().split("T")[0],
          endDate: dog.fechaFinal || "HNI",
          status: "activo",
          prescribedBy: "Médico Veterinario Albergue",
          createdAt: new Date().toISOString(),
          area: "caninos",
          dosisTotales: dog.section === "BRAVECTO" ? 1 : dog.section === "BAÑOS" ? 3 : 7,
          dosisAplicadas: 0,
          dosisFaltantes: dog.section === "BRAVECTO" ? 1 : dog.section === "BAÑOS" ? 3 : 7,
        });
      }
    }
  }

  // Regenerar tareas de turnos
  await generateTodayShiftTasks();

  return {
    success: true,
    area: "caninos",
    count: shelterRecords.length,
    message: `¡Sincronización exitosa! Se cargaron y actualizaron ${shelterRecords.length} caninos desde la planilla original.`,
  };
}
