// Clasificador e intérprete de intenciones clínicas veterinarias
// Reconoce la nomenclatura real del albergue:
// HCA, MCA, HCC, MCC, APM, HNI, FS, S, ZOO, OQE, OVH, C6, PB,
// y fármacos reales: Bravecto, Baxidin, Labiderm, Doxilina, Levetiracetam, Pimobendan, etc.

export interface ParsedClinicalIntent {
  rawText: string;
  microchip: string | null;
  location: string | null;
  system: string;
  treatment: string;
  description: string;
  durationDays: number;
  confidence: number;
  dosisBravecto?: string; // Dosis de desparasitante interno/externo (ej: 0.15, 0.2, 0.5, 1.0)
  isDesparasitante?: boolean;
}

export function parseClinicalVoice(transcript: string, currentChip?: string): ParsedClinicalIntent {
  const text = transcript.toLowerCase();

  // 1. Detección de Microchip (10-15 dígitos o 6-7 dígitos del sufijo)
  const chipMatch = text.match(/\b\d{6,15}\b/);
  const microchip = chipMatch ? chipMatch[0] : (currentChip || null);

  // 2. Detección de Ubicación (Canil, Triaje, Sala, UCE, Patio, UPH)
  let location: string | null = null;
  const triajeMatch = text.match(/tria(?:ge|je)\s*(\d+[-]?\d*|[a-z])/i);
  const uceMatch = text.match(/uce\s*(\d+)/i);
  const salaMatch = text.match(/sala\s*([a-z0-9]+)?/i);
  const patioMatch = text.match(/patio\s*(\d+|[a-z]+)/i);

  if (triajeMatch) {
    location = `TRIAGE ${triajeMatch[1].toUpperCase()}`;
  } else if (uceMatch) {
    location = `UCE ${uceMatch[1]}`;
  } else if (salaMatch) {
    location = "SALA";
  } else if (patioMatch) {
    location = `PATIO ${patioMatch[1].toUpperCase()}`;
  }

  // 3. Detección específica de DESPARASITANTE (Bravecto, Simparica, Nexgard, Endoparásitos/Ectoparásitos)
  let isDesparasitante = false;
  let dosisBravecto: string | undefined = undefined;

  if (
    text.includes("bravecto") ||
    text.includes("desparasit") ||
    text.includes("pulga") ||
    text.includes("garrapata") ||
    text.includes("zinpar") ||
    text.includes("endectocida")
  ) {
    isDesparasitante = true;

    // Extracción de dosis de Bravecto (0.15, 0.2, 0.5, 0.7, 1 comprimido / pipeta)
    if (text.includes("media") || text.includes("medio") || text.includes("0.5") || text.includes("mitad")) {
      dosisBravecto = "0.5";
    } else if (text.includes("un cuarto") || text.includes("cuarto") || text.includes("0.25")) {
      dosisBravecto = "0.25";
    } else if (text.includes("0.2")) {
      dosisBravecto = "0.2";
    } else if (text.includes("0.15")) {
      dosisBravecto = "0.15";
    } else if (text.includes("0.7")) {
      dosisBravecto = "0.7";
    } else if (text.includes("uno") || text.includes("una") || text.includes("entera") || text.includes("1")) {
      dosisBravecto = "1";
    }
  }

  // 4. Clasificación de Sistema Clínico (Nomenclatura del Albergue)
  let system = "PREVENTIVO";
  let confidence = 0.88;

  if (isDesparasitante || text.includes("piel") || text.includes("herida") || text.includes("calvo") || text.includes("labiderm") || text.includes("sarna") || text.includes("tegumen")) {
    system = "TEGUMEN"; // En el Excel del albergue lo abrevian TEGUMEN
    confidence = 0.98;
  } else if (text.includes("corazon") || text.includes("cardio") || text.includes("pimobendan") || text.includes("enalapril") || text.includes("furosemida")) {
    system = "CARDIO";
    confidence = 0.98;
  } else if (text.includes("sangre") || text.includes("erlichia") || text.includes("anemia") || text.includes("sulfato") || text.includes("circul")) {
    system = "CIRCUL";
    confidence = 0.96;
  } else if (text.includes("ojo") || text.includes("ofta") || text.includes("gotas") || text.includes("colirio") || text.includes("ciclosporina")) {
    system = "OCULAR";
    confidence = 0.97;
  } else if (text.includes("tos") || text.includes("moco") || text.includes("solubron") || text.includes("respi")) {
    system = "RESPI";
    confidence = 0.97;
  } else if (text.includes("convuls") || text.includes("epilep") || text.includes("keppra") || text.includes("levetiracetam") || text.includes("nervio")) {
    system = "NERVIO";
    confidence = 0.98;
  } else if (text.includes("cojera") || text.includes("pata") || text.includes("lyrica") || text.includes("pregabalina") || text.includes("osteo") || text.includes("musculo")) {
    system = "OSTEO";
    confidence = 0.95;
  } else if (text.includes("vomito") || text.includes("diarrea") || text.includes("silimarina") || text.includes("digest")) {
    system = "DIGESTIVO";
    confidence = 0.95;
  } else if (text.includes("agresiv") || text.includes("ansied") || text.includes("miedo") || text.includes("amitriptilina") || text.includes("serenos") || text.includes("compor")) {
    system = "COMPOR";
    confidence = 0.96;
  }

  // 5. Extracción de Tratamiento
  let treatment = transcript;
  if (isDesparasitante) {
    treatment = `BRAVECTO 365 (Dosis: ${dosisBravecto || "1.0"})`;
  } else if (text.includes("labiderm")) {
    treatment = "LABIDERM EN CALVOS";
  } else if (text.includes("baxidin")) {
    treatment = "BAÑO MEDICADO SHAMPOO BAXIDIN + LABYDERM";
  } else if (text.includes("vitamina")) {
    treatment = "VITAMINAS";
  }

  return {
    rawText: transcript,
    microchip,
    location,
    system,
    treatment,
    description: transcript,
    durationDays: 5,
    confidence,
    dosisBravecto,
    isDesparasitante,
  };
}
