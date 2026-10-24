const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'Plan de manejo GATERA.xlsx');
console.log('Procesando datos maestros de GATERA desde:', filePath);
const workbook = XLSX.readFile(filePath);

function excelDateToJS(serial) {
  if (!serial || isNaN(serial) || typeof serial !== 'number') return String(serial || '');
  try {
    const date = new Date((serial - (25567 + 2)) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  } catch (e) {
    return String(serial);
  }
}

// 1. Extraer Tratamientos de Octubre
const ttoSheet = workbook.Sheets['PLAN TTO OCTUBRE'];
const ttoRows = XLSX.utils.sheet_to_json(ttoSheet, { header: 1, defval: '' });
const treatmentsByChip = {};

for (let i = 1; i < ttoRows.length; i++) {
  const row = ttoRows[i];
  const canil = String(row[1] || '').trim();
  const rawChip = String(row[2] || '').trim();
  const desc = String(row[3] || '').trim();
  const med = String(row[4] || '').trim();
  const limpieza = String(row[5] || '').trim();
  const fechaFin = String(row[6] || '').trim();
  const tipo = String(row[7] || '').trim();
  const sistema = String(row[8] || '').trim();
  const obs = String(row[9] || '').trim();

  if (rawChip || med || canil) {
    const item = {
      canil,
      microchip: rawChip,
      descripcion: desc,
      medicacion: med,
      limpieza: limpieza ? 'SI' : 'NO',
      fechaFin: fechaFin || 'HNI',
      tipo,
      sistema: sistema || 'TEGUMEN',
      observacion: obs,
    };

    if (rawChip) {
      const chips = rawChip.split(/[\s,-]+/).filter(c => c.length >= 6);
      if (chips.length > 0) {
        chips.forEach(c => {
          if (!treatmentsByChip[c]) treatmentsByChip[c] = [];
          treatmentsByChip[c].push(item);
        });
      } else {
        if (!treatmentsByChip[rawChip]) treatmentsByChip[rawChip] = [];
        treatmentsByChip[rawChip].push(item);
      }
    }
  }
}

// 2. Extraer Plan Sanitario
const sanSheet = workbook.Sheets['PLAN SANITARIO'];
const sanRows = XLSX.utils.sheet_to_json(sanSheet, { header: 1, defval: '' });
const sanByChip = {};

for (let i = 7; i < sanRows.length; i++) {
  const row = sanRows[i];
  const rawChip = String(row[2] || '').trim();
  if (rawChip) {
    sanByChip[rawChip] = {
      triple: String(row[5] || '').trim(),
      leucemia: String(row[6] || '').trim(),
      rabia: excelDateToJS(row[7]),
      desparasitante: String(row[9] || row[11] || '').trim(),
    };
  }
}

// 3. Extraer Censo Maestro de GATERA (Cada columna del archivo original)
const censoSheet = workbook.Sheets['CENSO'];
const censoRows = XLSX.utils.sheet_to_json(censoSheet, { header: 1, defval: '' });
const gateraCats = [];
const seenChips = new Set();

for (let i = 7; i < censoRows.length; i++) {
  const row = censoRows[i];
  if (!row || row.length === 0) continue;

  const nroAnimal = String(row[0] || '').trim();
  const canil = String(row[1] || '').trim();
  const rawChip = String(row[2] || '').trim();
  const hc = String(row[3] || '').trim();
  const sexoCode = String(row[4] || 'MFA').trim();
  const raza = String(row[5] || 'DPC').trim();
  const feralStr = String(row[6] || 'NO').trim().toUpperCase();
  const color = String(row[7] || '').trim();
  const tipoIngreso = String(row[8] || 'RES').trim();
  const fechaNac = excelDateToJS(row[9]);
  const edad = String(row[10] || '').trim();
  const fechaIngreso = excelDateToJS(row[11]);
  const condicion = String(row[12] || 'RANGO 2.0/5').trim();
  const estado = String(row[13] || 'Saludable').trim();
  const tratamientoBase = String(row[14] || '').trim();
  const observaciones = String(row[15] || '').trim();
  const reqSeguimiento = String(row[16] || (observaciones ? 'SI' : 'NO')).trim().toUpperCase();
  const tipoSeguimiento = String(row[17] || (tratamientoBase ? 'TRATAMIENTO' : 'NO APLICA')).trim();
  const fechaSeguimiento = excelDateToJS(row[18]);
  const peluqueria = String(row[19] || '').trim();
  const corteUnas = String(row[20] || '').trim();
  const limpiezaOidos = String(row[21] || '').trim();
  const fechaAseo = excelDateToJS(row[22]);
  const medico = String(row[23] || 'Dra. Jenny Zapata Calle').trim();

  // Validar que sea fila válida
  if (!canil && !rawChip && !hc) continue;

  const chipStr = rawChip || (`SIN_CHIP_${i}`);
  if (seenChips.has(chipStr)) continue; // Garantizar unicidad estricta de microchip
  seenChips.add(chipStr);

  const shortChip = rawChip && rawChip.length > 7 ? rawChip.slice(-7) : rawChip;
  const isFeral = feralStr.includes('SI') || observaciones.toUpperCase().includes('FERAL');
  const isHembra = sexoCode.toUpperCase().startsWith('H');
  const isAdulto = sexoCode.toUpperCase().includes('A');

  // Buscar tratamientos adicionales de octubre
  const ttoList = treatmentsByChip[rawChip] || (shortChip ? treatmentsByChip[shortChip] : undefined) || [];
  const sanInfo = sanByChip[rawChip] || (shortChip ? sanByChip[shortChip] : undefined);

  // Armar medicación consolidada
  const medConsolidada = ttoList.length > 0
    ? ttoList.map(t => `${t.medicacion} (${t.sistema})`).join(' | ')
    : tratamientoBase;

  const nombre = color ? `Gato ${color.split(' ')[0]} ${canil}` : `Felino ${canil}`;

  gateraCats.push({
    id: i,
    nroAnimal: nroAnimal || String(gateraCats.length + 1),
    ubicacion: canil || 'GATERA GENERAL',
    microchip: chipStr,
    shortChip: shortChip || chipStr,
    hc: hc,
    sexoCode: sexoCode,
    sexo: isHembra ? 'hembra' : 'macho',
    grupoEdad: isAdulto ? 'adulto' : 'cachorro',
    raza: raza || 'DPC',
    isFeral: isFeral,
    color: color,
    tipoIngreso: tipoIngreso,
    fechaNacimiento: fechaNac,
    edad: edad,
    fechaIngreso: fechaIngreso,
    condicionCorporal: condicion,
    estadoSalud: estado,
    medicacion: medConsolidada || 'Ninguno',
    observacionesMedicas: observaciones,
    requiereSeguimiento: reqSeguimiento,
    tipoSeguimiento: tipoSeguimiento,
    fechaSeguimiento: fechaSeguimiento,
    peluqueria: peluqueria,
    corteUnas: corteUnas,
    limpiezaOidos: limpiezaOidos,
    fechaAseo: fechaAseo,
    medicoVeterinario: medico,
    nombre: nombre.trim(),
    descripcion: `${sexoCode} ${color} (${raza})`,
    pendientes: isFeral ? '⚠️ MANEJO FERAL / GUANTES' : (observaciones || 'REVISIÓN GENERAL'),
    sistema: ttoList[0]?.sistema || (medConsolidada.toLowerCase().includes('respi') ? 'RESPI' : (medConsolidada.toLowerCase().includes('ofta') || medConsolidada.toLowerCase().includes('gotas') ? 'OCULAR' : 'TEGUMEN')),
    fechaFinal: ttoList[0]?.fechaFin || 'HNI',
    tipo: ttoList[0]?.tipo || 'S',
    vacunaTriple: sanInfo?.triple || '',
    vacunaLeucemia: sanInfo?.leucemia || '',
    vacunaRabia: sanInfo?.rabia || '',
    desparasitante: sanInfo?.desparasitante || 'REVOLUTION / TOTAL FCG',
  });
}

console.log('Total Felinos procesados de la hoja CENSO:', gateraCats.length);

// Generar archivo TypeScript con todos los campos maestros de CENSO
const content = `// Base de datos de Felinos - GATERA (Copia fiel del archivo maestro Plan de manejo GATERA.xlsx - Hoja CENSO)
// Contiene todos y cada uno de los campos, filas y columnas del censo original.

export interface GateraCat {
  id?: number;
  nroAnimal?: string;            // N° animal
  ubicacion: string;             // Nº CANIL (Columna B)
  microchip: string;             // MICROCHIP (MC)
  shortChip: string;             // Sufijo Microchip
  hc: string;                    // HISTORIA CLINICA (HC)
  sexoCode: string;              // A (HFA, MFA, HFC, MFC)
  sexo: "macho" | "hembra";      // Sexo interpretado
  grupoEdad: "adulto" | "cachorro"; // Grupo etario interpretado
  raza: string;                  // RAZA (DPC, DPL, etc.)
  isFeral: boolean;              // FERALES (SI / NO)
  color: string;                 // COLOR
  tipoIngreso: string;           // TIPO DE INGRESO (APM, RES, INC, E Y D)
  fechaNacimiento?: string;      // FECHA DE NACIMIENTO
  edad: string;                  // EDAD APROXIMADA MESES
  fechaIngreso?: string;         // FECHA DE INGRESO
  condicionCorporal: string;     // CONDICION CORPORAL (Rango 1.0 a 4.0 / 5)
  estadoSalud: string;           // ESTADO (Saludable, Regular, Delicado)
  medicacion: string;            // TRATAMIENTO
  observacionesMedicas: string;  // OBSERVACIONES MEDICAS (Diagnóstico / Cuadro clínico)
  requiereSeguimiento: string;   // REQUIERE SEGUIMIENTO SI/NO
  tipoSeguimiento: string;       // TIPO DE SEGUIMIENTO (TRATAMIENTO, OBSERVACIÓN, etc.)
  fechaSeguimiento?: string;     // FECHA
  peluqueria?: string;           // PELUQUERIA
  corteUnas?: string;            // CORTE DE UÑAS
  limpiezaOidos?: string;        // LIMPIEZA DE OIDOS
  fechaAseo?: string;            // FECHA EN QUE SE REALIZÓ
  medicoVeterinario: string;     // MÉDICO VETERINARIO

  // Campos adicionales clínicos de compatibilidad
  nombre: string;
  descripcion: string;
  pendientes: string;
  sistema: string;
  fechaFinal: string;
  tipo: string;

  // Plan Sanitario
  vacunaTriple?: string;
  vacunaLeucemia?: string;
  vacunaRabia?: string;
  desparasitante?: string;
}

export const GATERA_CATS_DATA: GateraCat[] = ${JSON.stringify(gateraCats, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'src', 'lib', 'gateraData.ts');
fs.writeFileSync(outputPath, content, 'utf8');
console.log('Archivo TypeScript maestro guardado en:', outputPath);
