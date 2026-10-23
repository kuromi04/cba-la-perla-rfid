const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'Plan de manejo GATERA.xlsx');
console.log('Procesando datos de Gatera...');
const workbook = XLSX.readFile(filePath);

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

    // Si tiene chips explícitos
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

console.log('Tratamientos indexados para chips individuales:', Object.keys(treatmentsByChip).length);

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
      rabia: String(row[7] || '').trim(),
      desparasitante: String(row[9] || row[11] || '').trim(),
    };
  }
}

// 3. Extraer Censo Maestro
const censoSheet = workbook.Sheets['CENSO'];
const censoRows = XLSX.utils.sheet_to_json(censoSheet, { header: 1, defval: '' });
const gateraCats = [];
const seen = new Set();

for (let i = 7; i < censoRows.length; i++) {
  const row = censoRows[i];
  const canil = String(row[1] || '').trim();
  const rawChip = String(row[2] || '').trim();
  const hc = String(row[3] || '').trim();
  const sexoCode = String(row[4] || '').trim(); // HFA, MFA, etc.
  const raza = String(row[5] || 'DPC').trim();
  const feral = String(row[6] || 'NO').toUpperCase().trim();
  const color = String(row[7] || '').trim();
  const tipoIngreso = String(row[8] || '').trim();
  const edad = String(row[10] || '').trim();
  const condicion = String(row[12] || '').trim();
  const estado = String(row[13] || '').trim();
  const tratamientoBase = String(row[14] || '').trim();

  // Validar que sea fila válida
  if (!canil && !rawChip && !hc) continue;

  const chipStr = rawChip || `SIN_CHIP_${i}`;
  const shortChip = rawChip && rawChip.length > 7 ? rawChip.slice(-7) : rawChip;

  const isFeral = feral.includes('SI');
  const isHembra = sexoCode.startsWith('H');

  // Buscar tratamientos de octubre
  const ttoList = treatmentsByChip[rawChip] || (shortChip ? treatmentsByChip[shortChip] : undefined) || [];
  const sanInfo = sanByChip[rawChip] || (shortChip ? sanByChip[shortChip] : undefined);

  // Armar medicación consolidada
  const medConsolidada = ttoList.length > 0
    ? ttoList.map(t => `${t.medicacion} (${t.sistema})`).join(' | ')
    : tratamientoBase;

  const cat = {
    id: i,
    ubicacion: canil || 'GATERA GENERAL',
    microchip: chipStr,
    shortChip: shortChip || chipStr,
    hc: hc,
    descripcion: `${sexoCode} ${color} (${raza})`,
    nombre: color ? `Gato ${color.split(' ')[0]} ${canil}` : `Felino ${canil}`,
    sexo: isHembra ? 'hembra' : 'macho',
    raza: raza,
    color: color,
    isFeral: isFeral,
    tipoIngreso: tipoIngreso,
    edad: edad,
    condicionCorporal: condicion,
    estadoSalud: estado,
    medicacion: medConsolidada,
    sistema: ttoList[0]?.sistema || (medConsolidada.toLowerCase().includes('respi') ? 'RESPI' : 'TEGUMEN'),
    fechaFinal: ttoList[0]?.fechaFin || 'HNI',
    tipo: ttoList[0]?.tipo || 'S',
    pendientes: isFeral ? '⚠️ MANEJO FERAL / GUANTES' : 'REVISIÓN GENERAL',
    vacunaTriple: sanInfo?.triple || '',
    vacunaLeucemia: sanInfo?.leucemia || '',
    desparasitante: sanInfo?.desparasitante || 'FIPRONIL / TOTAL FCG',
  };

  gateraCats.push(cat);
}

console.log('Total Gatos procesados con éxito:', gateraCats.length);

// Generar archivo TypeScript
const content = `// Base de datos de Felinos - GATERA (450+ registros reales)
// Extraído de: Plan de manejo GATERA.xlsx

export interface GateraCat {
  id?: number;
  ubicacion: string;
  microchip: string;
  shortChip: string;
  hc: string;
  nombre: string;
  descripcion: string;
  sexo: "macho" | "hembra";
  raza: string;
  color: string;
  isFeral: boolean;
  tipoIngreso: string;
  edad: string;
  condicionCorporal: string;
  estadoSalud: string;
  medicacion: string;
  sistema: string;
  fechaFinal: string;
  tipo: string;
  pendientes: string;
  vacunaTriple?: string;
  vacunaLeucemia?: string;
  desparasitante?: string;
}

export const GATERA_CATS_DATA: GateraCat[] = ${JSON.stringify(gateraCats, null, 2)};
`;

const outputPath = path.join(__dirname, '..', 'src', 'lib', 'gateraData.ts');
fs.writeFileSync(outputPath, content, 'utf8');
console.log('Archivo TypeScript guardado en:', outputPath);
