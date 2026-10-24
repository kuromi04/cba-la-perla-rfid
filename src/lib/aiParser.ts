// Intérprete y Clasificador de Inteligencia Artificial para Notas de Voz Clínicas en GATERA
// Reconoce la nomenclatura oficial de Gatera:
// Ubicaciones: CUARENTENA 1-8, PATIO 1-10, PATIO VIF, MATERNIDAD, HOSPITAL, JAULAS, TRIAJE
// Fármacos felinos: Revolution, Feline Full Spot, Convenia, Doxi 100, Cat Balance, Engystol, Solubron, Adrisin, etc.
// Nomenclatura: HFA, MFA, HFC, MFC, Feral (⚠️ Manejo Guantes)
// Sistemas: OCULAR, RESPI, TEGUMEN, DIGESTIVO, NERVIO, OSTEO, PREVENTIVO

export interface ParsedClinicalIntent {
  rawText: string;
  microchip: string | null;
  location: string | null;
  system: string;
  treatment: string;
  description: string;
  durationDays: number;
  confidence: number;
  isFeral?: boolean;
  laborType?: "medicacion" | "limpieza" | "baño" | "nebulizacion";
  condicionCorporal?: string;
  estadoSalud?: string;
  requiereSeguimiento?: boolean;
  observacionesMedicas?: string;
  serviciosAseo?: {
    peluqueria?: boolean;
    corteUnas?: boolean;
    limpiezaOidos?: boolean;
  };
}

export function parseClinicalVoice(transcript: string, currentChip?: string): ParsedClinicalIntent {
  const text = transcript.toLowerCase().trim();

  // 1. Detección de Microchip (10-15 dígitos o 4-7 dígitos sufijo)
  const chipMatch = text.match(/\b\d{4,15}\b/);
  const microchip = chipMatch ? chipMatch[0] : (currentChip || null);

  // 2. Detección de Ubicación en GATERA (Cuarentenas, Patios, Maternas, Hospital, etc.)
  let location: string | null = null;
  const cuarentenaMatch = text.match(/cuarentena\s*(\d+|[a-z]+)?/i);
  const patioVifMatch = text.match(/patio\s*(?:de\s*)?(?:adopciones\s*)?vif/i);
  const patioMatch = text.match(/patio\s*(\d+[-]?\d*|[a-z]+)?/i);
  const maternaMatch = text.match(/matern(?:a|idad)\s*(?:jaula\s*)?(\d+[-]?\d*|[a-z]+)?/i);
  const hospitalMatch = text.match(/hospital\s*(\d+|reactivo)?/i);
  const jaulaMatch = text.match(/jaula\s*(\d+)/i);
  const triajeMatch = text.match(/tria(?:ge|je)\s*(\d+|[a-z]+)?/i);

  if (cuarentenaMatch) {
    location = cuarentenaMatch[1] ? `CUARENTENA ${cuarentenaMatch[1].toUpperCase()}` : "CUARENTENA";
  } else if (patioVifMatch) {
    location = "PATIO 1 ADOPCIONES VIF";
  } else if (patioMatch) {
    location = patioMatch[1] ? `PATIO ${patioMatch[1].toUpperCase()}` : "PATIO";
  } else if (maternaMatch) {
    location = maternaMatch[1] ? `MATERNA JAULA ${maternaMatch[1].toUpperCase()}` : "MATERNIDAD";
  } else if (hospitalMatch) {
    location = hospitalMatch[1] ? `HOSPITAL ${hospitalMatch[1].toUpperCase()}` : "HOSPITAL";
  } else if (jaulaMatch) {
    location = `JAULA ${jaulaMatch[1]}`;
  } else if (triajeMatch) {
    location = triajeMatch[1] ? `TRIAJE ${triajeMatch[1].toUpperCase()}` : "TRIAJE";
  }

  // 3. Detección de Feral (Manejo con Guantes)
  const isFeral =
    text.includes("feral") ||
    text.includes("guante") ||
    text.includes("cautel") ||
    text.includes("agresiv") ||
    text.includes("morder");

  // 4. Servicios de Aseo Felino
  const limpiezaOidos = text.includes("oido") || text.includes("oídos") || text.includes("limpieza otica");
  const corteUnas = text.includes("uña") || text.includes("uñas") || text.includes("corte");
  const peluqueria = text.includes("peluquer") || text.includes("tusa") || text.includes("rapado");
  const bano = text.includes("baño") || text.includes("bano") || text.includes("shampoo");

  // 5. Tipo de Labor
  let laborType: "medicacion" | "limpieza" | "baño" | "nebulizacion" = "medicacion";
  if (text.includes("nebuliz") || text.includes("puff") || text.includes("inhal")) {
    laborType = "nebulizacion";
  } else if (bano) {
    laborType = "baño";
  } else if (limpiezaOidos || text.includes("limpieza") || text.includes("curacion") || text.includes("curación")) {
    laborType = "limpieza";
  }

  // 6. Clasificación de Sistema Clínico (GATERA)
  let system = "PREVENTIVO";
  let confidence = 0.90;

  if (text.includes("ojo") || text.includes("ofta") || text.includes("gotas") || text.includes("colirio") || text.includes("ciclosporina") || text.includes("conjuntiv")) {
    system = "OCULAR";
    confidence = 0.98;
  } else if (text.includes("tos") || text.includes("moco") || text.includes("estornud") || text.includes("respi") || text.includes("solubron") || text.includes("adrisin") || text.includes("nebuliz")) {
    system = "RESPI";
    confidence = 0.98;
  } else if (text.includes("piel") || text.includes("herida") || text.includes("pulga") || text.includes("acaro") || text.includes("ácaro") || text.includes("sarna") || text.includes("dermatitis") || text.includes("tegumen") || text.includes("revolution") || text.includes("full spot")) {
    system = "TEGUMEN";
    confidence = 0.98;
  } else if (text.includes("vomito") || text.includes("diarrea") || text.includes("gingiv") || text.includes("boca") || text.includes("diente") || text.includes("estomatitis") || text.includes("digest")) {
    system = "DIGESTIVO";
    confidence = 0.97;
  } else if (text.includes("convuls") || text.includes("lyrica") || text.includes("pregabalina") || text.includes("keppra") || text.includes("nervio")) {
    system = "NERVIO";
    confidence = 0.98;
  } else if (text.includes("cojera") || text.includes("fractura") || text.includes("tibia") || text.includes("pata") || text.includes("osteo")) {
    system = "OSTEO";
    confidence = 0.96;
  } else if (text.includes("corazon") || text.includes("cardio")) {
    system = "CARDIO";
    confidence = 0.96;
  }

  // 7. Extracción Inteligente de Tratamiento
  let treatment = transcript;
  if (text.includes("gotas") && text.includes("cat balance")) {
    treatment = "GOTAS OFTÁLMICAS + CAT BALANCE + ENGYSTOL";
  } else if (text.includes("full spot") || text.includes("feline")) {
    treatment = "FELINE FULL SPOT + CAT BALANCE + OMEGA 3";
  } else if (text.includes("revolution")) {
    treatment = "REVOLUTION + CAT BALANCE + OMEGA 3";
  } else if (text.includes("convenia")) {
    treatment = "CONVENIA + TRIAMCINOLONA + TRAUMEEL";
  } else if (text.includes("doxi") || text.includes("doxiciclina")) {
    treatment = "DOXI 100 + SOLUBRON + ADRISIN";
  } else if (text.includes("meloxicam")) {
    treatment = "MELOXICAM + SANIX TÓPICO";
  } else if (limpiezaOidos && !treatment.includes("LIMPIEZA")) {
    treatment = `LIMPIEZA DE OIDOS + ${transcript.toUpperCase()}`;
  }

  // 8. Condición Corporal y Estado
  let condicionCorporal: string | undefined = undefined;
  if (text.includes("1") || text.includes("caquexia") || text.includes("muy delgado")) {
    condicionCorporal = "RANGO 1.5/5";
  } else if (text.includes("2") || text.includes("delgado") || text.includes("bajo de peso")) {
    condicionCorporal = "RANGO 2.0/5";
  } else if (text.includes("3") || text.includes("ideal") || text.includes("normal") || text.includes("buen peso")) {
    condicionCorporal = "RANGO 3.0/5";
  } else if (text.includes("4") || text.includes("sobrepeso") || text.includes("gordo")) {
    condicionCorporal = "RANGO 3.5/5";
  }

  let estadoSalud: string | undefined = undefined;
  if (text.includes("delicado") || text.includes("grave") || text.includes("critico") || text.includes("crítico")) {
    estadoSalud = "Delicado";
  } else if (text.includes("regular") || text.includes("estable regular")) {
    estadoSalud = "Regular";
  } else if (text.includes("saludable") || text.includes("estable") || text.includes("buen estado") || text.includes("sano")) {
    estadoSalud = "Saludable";
  }

  // 9. Duración calculada
  let durationDays = 7;
  const diasMatch = text.match(/(?:por|durante)\s*(\d+)\s*d[ií]as/i);
  if (diasMatch) {
    durationDays = parseInt(diasMatch[1], 10);
  } else if (system === "PREVENTIVO" || text.includes("revolution") || text.includes("full spot")) {
    durationDays = 1;
  } else if (system === "RESPI" || system === "OCULAR") {
    durationDays = 10;
  }

  return {
    rawText: transcript,
    microchip,
    location,
    system,
    treatment,
    description: transcript,
    durationDays,
    confidence,
    isFeral,
    laborType,
    condicionCorporal,
    estadoSalud,
    requiereSeguimiento: true,
    observacionesMedicas: transcript,
    serviciosAseo: {
      peluqueria,
      corteUnas,
      limpiezaOidos,
    },
  };
}
