# 🐾 Centro de Bienestar Animal La Perla — Alcaldía de Medellín
### Sistema Oficial de Planilla Médica, Censo y Lector RFID W91A (PWA Offline-First)

<p align="center">
  <img src="docs/screenshots/alcaldia_medellin.png" alt="Alcaldía de Medellín" width="220" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js" alt="Next.js 14" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/IndexedDB-Dexie.js-green?style=for-the-badge&logo=databricks" alt="IndexedDB Dexie" />
  <img src="https://img.shields.io/badge/PWA-100%25_Offline-orange?style=for-the-badge&logo=pwa" alt="PWA Offline" />
  <img src="https://img.shields.io/badge/Estado-Producci%C3%B3n-success?style=for-the-badge" alt="Estado" />
</p>

---

## 📌 Descripción del Proyecto

El **Centro de Bienestar Animal La Perla** (Medellín, Colombia) alberga cientos de caninos y felinos rescatados en áreas que presentan topografía de montaña y zonas con cobertura de red WiFi intermitente o nula. 

Esta plataforma es una **Progressive Web Application (PWA) de Grado Clínico** diseñada con arquitectura **Offline-First**, permitiendo a médicos veterinarios, auxiliares y operarios:
1. **Identificar animales en <50ms** usando el lector de microchip **RFID ISO 11784/85 (W91A)** por emulación de teclado o cámara móvil.
2. **Consultar y auditar la población real** de caninos (**Triaje, UCE, Limpiezas, Baños, Nebulizaciones, Noche, CDV, Bravecto**) y felinos de **Gatera** (más de 460 gatos con Historia Clínica individual).
3. **Controlar el cumplimiento de medicamentos y dosis faltantes** mediante el **Kardex Clínico Inteligente** con semáforo de vencimientos.
4. **Asignar labores a auxiliares y operarios** con generación de **Links Mágicos** seguros sin contraseña.
5. **Imprimir Fichas de Canil con Códigos QR dinámicos** generados 100% offline para las puertas de las jaulas, con protocolos de bioseguridad (**Distemper CDV (+)**, **Cuarentena** y **Feral/Reactivo**).

---

## 📸 Capturas de la Interfaz y Flujo Operativo

<p align="center">
  <img src="docs/screenshots/lector_w91a.jpg" alt="Lector RFID W91A en Campo" width="45%" style="border-radius: 12px; margin: 4px;" />
  <img src="docs/screenshots/planilla_caninos.jpg" alt="Planilla Caninos Original CBA" width="45%" style="border-radius: 12px; margin: 4px;" />
</p>
<p align="center">
  <em>Izquierda: Escaneo con lector RFID W91A en campo. Derecha: Digitalización exacta de las planillas oficiales.</em>
</p>

---

## ⚡ Módulos y Funcionalidades Principales

### 1. 📡 Lector RFID & Escaneo en Campo (`ScannerTab`)
- **Detección Instantánea HID:** Reconoce las lecturas del lector RFID en ráfagas de teclado inferiores a 50 ms.
- **Normalizador Inteligente de Chip:** Admite búsquedas por microchip completo de 15 dígitos ISO (`991003003806096`) o por chip corto (`3806096`).
- **Alertas de Bioseguridad y Patrones Hápticos:**
  - ☣️ **Distemper CDV (+):** Aislamiento nivel 3. Vibración táctil de emergencia (`[250, 100, 250, 100, 450]`).
  - 🛑 **Cuarentena Restringida:** Restricción de traslados sin visto bueno del médico veterinario.
  - ⚠️ **Animal Feral / Reactivo:** Alerta de manejo con equipo de protección (guantes de carnaza y toalla).
- **Semáforo Clínico de Tratamientos:**
  - 🔴 **Culminado / Requiere Alta**
  - 🟡 **Última Dosis Hoy** (vence hoy)
  - 🟢 **En Curso** (> 1 dosis pendiente)
- **Acciones Veterinarias Inmediatas:** Botones para `Dar Alta Médica` y `+7 Días (+7 dosis)` en un solo toque.
- **Subida Masiva de Lote W91A:** Importación de hasta 100 registros guardados en la memoria interna del lector.
- **Botón Directo:** `🖨️ IMPRIMIR FICHA DE CANIL & CÓDIGO QR`.

### 2. 🖨️ Ficha Médica de Canil & Código QR Dinámico (`CanilCardModal`)
- Generación de Código QR **100% offline y local** sin dependencias externas.
- Escaneo con cualquier cámara móvil que redirige directamente a `/?chip=<microchip>` abriendo la ficha en vivo.
- Estilos de impresión `@media print` en blanco y negro nítido adaptados para colgar en las puertas de los caniles.
- Incluye logotipos oficiales de la **Alcaldía de Medellín** y **CBA La Perla**, datos de historia clínica, medicación prescrita, notas de manejo y línea de firma médica.

### 3. 🐱 Planilla Gatera & 🐶 Planilla Caninos (`PlanillaEditorTab`)
- **Caninos:** Triaje, UCE, Limpiezas, Baños, Nebulizaciones, Noche, CDV, Bravecto.
- **Gatera:** 461 felinos digitalizados con HC, ubicación física, tratamientos de octubre, gatas maternas, cuarentenas y patios de adopción.
- **Importador y Exportador Excel (`.xlsx`):** Descarga y sube planillas manteniendo las fórmulas y cabeceras exactas del albergue.
- **Control de Roles:** Solo Médicos Veterinarios y Administradores tienen permisos para modificar o eliminar animales.

### 4. 💊 Kardex Clínico & Cumplimiento de Dosis (`KardexTab`)
- Control de dosis totales programadas, dosis aplicadas y dosis faltantes.
- Dashboard de métricas en tiempo real.
- Reconocimiento por **Voz IA** para dictar prescripciones médicas en campo.
- Auditoría de responsables y fechas de última aplicación.

### 5. 📋 Turnos & Checklist con Links Mágicos (`TurnosTab`)
- Vista segregada por turnos (**Mañana**, **Tarde**, **Noche**) y áreas (**Caninos** vs. **Gatera**).
- **Sincronización Bidireccional:** Al chequear una dosis aplicada en el checklist, se descuenta automáticamente del Kardex. Si se desmarca, se reintegra.
- Generación de **Links Mágicos** (`/?token=magic_...`) para operarios y auxiliares sin fricción de contraseñas.

### 6. 📊 Censo Albergue (`CensusTab`)
- Registro de censo en campo con trazabilidad de fecha, hora, ubicación y usuario.
- Exportación del censo a Excel con un clic.

---

## 🏛️ Roles y Permisos en CBA La Perla

| Rol | Permisos | Acceso a Áreas |
| :--- | :--- | :--- |
| **Médico Veterinario** | Prescribir, dar altas médicas, editar animales, crear tareas, exportar planillas. | Caninos, Gatera o Ambas |
| **Auxiliar Veterinario** | Administrar dosis, cumplir turnos, censar, asignar animales, ver planillas. | Caninos o Gatera |
| **Operario** | Cumplir tareas de limpieza, baños, alimentación y medicación básica con checklist. | Caninos o Gatera |
| **Administrador** | Control total de la base de datos, personal, auditoría y configuración. | Todas |

---

## 🛠️ Stack Tecnológico

- **Frontend:** [Next.js 14](https://nextjs.org/) (App Router, React 18, Server Components).
- **Estilos:** [Tailwind CSS](https://tailwindcss.com/) con diseño adaptado a móviles de campo.
- **Persistencia Offline:** [Dexie.js](https://dexie.com/) (IndexedDB Wrapper de alto rendimiento).
- **Generación de QR:** [qrcode](https://www.npmjs.com/package/qrcode) (Renderizado Canvas SVG 100% offline).
- **Procesamiento Excel:** [SheetJS / xlsx](https://sheetjs.com/).
- **Iconografía:** [Lucide React](https://lucide.dev/).
- **Service Worker:** Cache Stale-While-Revalidate con manifest PWA instalable.

---

## 🚀 Instalación y Puesta en Marcha Local

### Prerrequisitos
- [Node.js](https://nodejs.org/) v18.17 o superior.
- Gestor de paquetes `npm`.

### Pasos

1. **Clonar el repositorio:**
```bash
git clone https://github.com/TU_USUARIO/shelter-chip-pwa.git
cd shelter-chip-pwa
```

2. **Instalar dependencias:**
```bash
npm install
```

3. **Iniciar en modo desarrollo:**
```bash
npm run dev
```
Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

4. **Compilar y ejecutar en modo producción:**
```bash
npm run build
npm run start
```
La aplicación quedará disponible en red local (`http://0.0.0.0:3000`) para pruebas con lectores RFID físicos y celulares.

---

## 🌐 Despliegue en la Nube (Vercel & Supabase)

### 1. Despliegue en Vercel
1. Conecta este repositorio en [Vercel](https://vercel.com/).
2. Framework Preset: **Next.js**.
3. Presiona **Deploy**. Vercel asignará automáticamente una URL segura HTTPS (`https://cba-laperla.vercel.app`).
4. (Opcional) Asigna tu dominio institucional (ej: `laperla.medellin.gov.co`).

### 2. Sincronización Multi-Dispositivo con Supabase
- Para sincronizar múltiples teléfonos en tiempo real cuando se conectan a WiFi, conecta las tablas de Supabase (PostgreSQL) usando la misma estructura de `lib/db.ts`.

---

## 👨‍💻 Créditos y Autoría

- **Entidad Patrocinadora:** Centro de Bienestar Animal La Perla — Secretaría de Medio Ambiente — Alcaldía de Medellín.
- **Desarrollado por:** `tiendastelegram by Kuromi04`
- **Licencia:** MIT / Propiedad del Centro de Bienestar Animal La Perla.
