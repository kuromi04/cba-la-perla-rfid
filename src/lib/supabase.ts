import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { db, Animal } from "./db";
import { StaffMember } from "./staff";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cliente seguro: no explota si no están definidas las variables en entorno local
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(supabaseUrl && supabaseAnonKey);
};

/**
 * Sincronizar un animal individual a Supabase cuando haya conexión
 */
export async function syncAnimalToSupabase(animal: Animal): Promise<boolean> {
  if (!supabase) return false;

  try {
    const payload = {
      microchip: animal.microchip,
      name: animal.name,
      species: animal.species,
      breed: animal.breed || "DPC",
      sex: animal.sexoCode?.startsWith("H") ? "hembra" : "macho",
      status: "activo",
      notes: animal.notes || animal.observacionesMedicas,
      attributes: {
        shortChip: animal.shortChip,
        hc: animal.hc,
        isFeral: animal.isFeral,
        location: animal.location,
        color: animal.color,
        condicionCorporal: animal.condicionCorporal,
        estadoSalud: animal.estadoSalud,
        tipoIngreso: animal.tipoIngreso,
        edad: animal.edad,
        medicoVeterinario: animal.medicoVeterinario,
        requiereSeguimiento: animal.requiereSeguimiento,
        lastCensusDate: animal.lastCensusDate,
      },
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("animals")
      .upsert(payload, { onConflict: "microchip" });

    if (error) {
      console.warn("Supabase upsert warning:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Error syncing animal to Supabase:", err);
    return false;
  }
}

/**
 * Sincronizar todos los animales locales a Supabase en segundo plano
 */
export async function syncAllLocalToSupabase(): Promise<{ synced: number; total: number }> {
  if (!supabase) return { synced: 0, total: 0 };

  try {
    const localAnimals = await db.animals.toArray();
    let synced = 0;

    // Procesar en lotes de 50 para máxima velocidad
    const chunkSize = 50;
    for (let i = 0; i < localAnimals.length; i += chunkSize) {
      const chunk = localAnimals.slice(i, i + chunkSize);
      const rows = chunk.map((a) => ({
        microchip: a.microchip,
        name: a.name || `Felino ${a.microchip.slice(-4)}`,
        species: a.species || "gato",
        breed: a.breed || "DPC",
        sex: a.sexoCode?.startsWith("H") ? "hembra" : "macho",
        status: "activo",
        notes: a.notes || a.observacionesMedicas,
        attributes: {
          shortChip: a.shortChip,
          hc: a.hc,
          isFeral: a.isFeral,
          location: a.location,
          color: a.color,
          condicionCorporal: a.condicionCorporal,
          estadoSalud: a.estadoSalud,
          tipoIngreso: a.tipoIngreso,
          edad: a.edad,
          medicoVeterinario: a.medicoVeterinario,
          lastCensusDate: a.lastCensusDate,
        },
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("animals")
        .upsert(rows, { onConflict: "microchip" });

      if (!error) {
        synced += chunk.length;
      }
    }

    return { synced, total: localAnimals.length };
  } catch (err) {
    console.error("Error in full Supabase sync:", err);
    return { synced: 0, total: 0 };
  }
}
