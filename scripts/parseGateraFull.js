const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, '..', 'Plan de manejo GATERA.xlsx');
console.log('Abriendo archivo completo...');
const workbook = XLSX.readFile(filePath);

console.log('Hojas en libro:', workbook.SheetNames);

// 1. Analizar Hoja CENSO
const censoSheet = workbook.Sheets['CENSO'];
const censoRows = XLSX.utils.sheet_to_json(censoSheet, { header: 1, defval: '' });
console.log('CENSO Total Filas:', censoRows.length);
console.log('CENSO Fila 7 (Encabezados aprox):', JSON.stringify(censoRows[6]?.slice(0, 15)));
console.log('CENSO Fila 8 (Muestra 1):', JSON.stringify(censoRows[7]?.slice(0, 15)));
console.log('CENSO Fila 9 (Muestra 2):', JSON.stringify(censoRows[8]?.slice(0, 15)));

// 2. Analizar Hoja PLAN TTO OCTUBRE
const ttoSheet = workbook.Sheets['PLAN TTO OCTUBRE'];
const ttoRows = XLSX.utils.sheet_to_json(ttoSheet, { header: 1, defval: '' });
console.log('\nPLAN TTO OCTUBRE Total Filas:', ttoRows.length);
console.log('PLAN TTO OCTUBRE Fila 1 (Encabezados):', JSON.stringify(ttoRows[0]?.slice(0, 12)));
console.log('PLAN TTO OCTUBRE Fila 2 (Muestra 1):', JSON.stringify(ttoRows[1]?.slice(0, 12)));
console.log('PLAN TTO OCTUBRE Fila 3 (Muestra 2):', JSON.stringify(ttoRows[2]?.slice(0, 12)));

// 3. Analizar Hoja PLAN SANITARIO
const sanSheet = workbook.Sheets['PLAN SANITARIO'];
const sanRows = XLSX.utils.sheet_to_json(sanSheet, { header: 1, defval: '' });
console.log('\nPLAN SANITARIO Total Filas:', sanRows.length);
console.log('PLAN SANITARIO Fila 7 (Encabezados):', JSON.stringify(sanRows[6]?.slice(0, 12)));
console.log('PLAN SANITARIO Fila 8 (Muestra 1):', JSON.stringify(sanRows[7]?.slice(0, 12)));
