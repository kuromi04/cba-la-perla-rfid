const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'Plan de manejo GATERA.xlsx');
console.log('Leyendo archivo:', filePath);

const workbook = XLSX.readFile(filePath, { sheets: undefined, sheetRows: 25 });
console.log('Hojas encontradas (Total:', workbook.SheetNames.length, '):');
workbook.SheetNames.forEach((name, index) => {
  const sheet = workbook.Sheets[name];
  const ref = sheet['!ref'] || 'Vacía';
  console.log(`[${index + 1}] "${name}" -> Rango: ${ref}`);
});

console.log('\n--- MUESTRA DE LAS PRIMERAS HOJAS ---');
workbook.SheetNames.slice(0, 5).forEach((name) => {
  console.log(`\n=================== HOJA: "${name}" ===================`);
  const sheet = workbook.Sheets[name];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  json.slice(0, 10).forEach((row, rIdx) => {
    const cleanRow = row.filter(cell => cell !== '').slice(0, 8);
    if (cleanRow.length > 0) {
      console.log(`Fila ${rIdx + 1}:`, JSON.stringify(cleanRow));
    }
  });
});
