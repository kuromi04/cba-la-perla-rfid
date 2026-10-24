"use client";
import React, { useState, useEffect } from "react";
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
  syncAllLocalToSupabase,
  fetchStaffFromSupabase,
  syncStaffToSupabase,
} from "@/lib/supabase";
import { getAllStaff, StaffMember } from "@/lib/staff";
import {
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  X,
  Database,
  Server,
  ShieldCheck,
  Users,
} from "lucide-react";

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged?: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    tables?: { staff: boolean; staff_presence: boolean; shift_tasks: boolean; animals: boolean };
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setUrl(creds.url);
      setKey(creds.key);
      if (creds.url && creds.key) {
        handleTest(creds.url, creds.key);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTest = async (testUrl = url, testKey = key) => {
    if (!testUrl.trim() || !testKey.trim()) {
      setTestResult({
        ok: false,
        message: "Por favor ingresa la URL del proyecto y la Clave Anon Key de Supabase.",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    // Guardar temporalmente para que el cliente lo tome
    saveSupabaseCredentials(testUrl, testKey);
    const res = await testSupabaseConnection();
    setTestResult(res);
    setIsTesting(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(url, key);
    await handleTest(url, key);
    if (onConfigChanged) onConfigChanged();
  };

  const handleCopySqlScript = async () => {
    try {
      const resp = await fetch("/supabase_schema.sql").catch(() => null);
      // Script oficial embebido
      const sqlText = `-- =========================================================================
-- ESQUEMA COMPLETO Y EXCLUSIVO GATERA (FELINOS) - CBA LA PERLA
-- Motor: PostgreSQL 15+ / Supabase
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA DE PERSONAL (STAFF)
CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('veterinario', 'auxiliar', 'operario', 'admin')),
    specialty TEXT,
    area TEXT NOT NULL DEFAULT 'gatera',
    phone TEXT,
    token TEXT NOT NULL,
    avatar_color TEXT,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Administrador Maestro (Kuromi)
INSERT INTO staff (id, name, role, specialty, area, phone, token, avatar_color, registered_at)
VALUES (
    'admin_kuromi_master',
    'Administrador Maestro',
    'admin',
    'Dirección y Control General',
    'gatera',
    '',
    'magic_admin_kuromi_master_cba',
    'bg-purple-900 text-white',
    NOW()
)
ON CONFLICT (id) DO UPDATE 
SET role = 'admin', area = 'gatera', updated_at = NOW();

-- 2. TABLA DE PRESENCIA EN VIVO
CREATE TABLE IF NOT EXISTS staff_presence (
    staff_id TEXT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
    staff_name TEXT NOT NULL,
    role TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'gatera',
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_info TEXT
);

-- 3. TABLA DE TAREAS Y CHECKLISTS DE TURNO
CREATE TABLE IF NOT EXISTS shift_tasks (
    id BIGSERIAL PRIMARY KEY,
    client_task_id INT,
    kardex_id INT,
    animal_name TEXT NOT NULL,
    species TEXT NOT NULL DEFAULT 'gato',
    microchip TEXT NOT NULL,
    location TEXT NOT NULL,
    medication TEXT NOT NULL,
    shift TEXT NOT NULL DEFAULT 'mañana',
    labor_type TEXT NOT NULL DEFAULT 'medicacion',
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by TEXT,
    is_feral BOOLEAN DEFAULT FALSE,
    notes TEXT,
    area TEXT NOT NULL DEFAULT 'gatera',
    assigned_to TEXT,
    assigned_role TEXT,
    dosis_totales INT DEFAULT 7,
    dosis_aplicadas INT DEFAULT 0,
    dosis_faltantes INT DEFAULT 7,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_tasks_chip ON shift_tasks(microchip);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_shift ON shift_tasks(shift, is_completed);
CREATE INDEX IF NOT EXISTS idx_shift_tasks_assigned ON shift_tasks(assigned_to);

-- 4. TABLA DE ANIMALES Y CENSO GATERA (461 FELINOS)
CREATE TABLE IF NOT EXISTS animals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    microchip VARCHAR(32) NOT NULL UNIQUE,
    name TEXT NOT NULL,
    species TEXT NOT NULL DEFAULT 'gato',
    breed TEXT,
    sex VARCHAR(10) CHECK (sex IN ('macho', 'hembra', 'desconocido')),
    approx_birth_date DATE,
    weight_kg NUMERIC(5,2),
    status TEXT NOT NULL DEFAULT 'activo',
    photo_url TEXT,
    notes TEXT,
    retroviral_status TEXT,
    vif_status TEXT,
    felv_status TEXT,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE animals ADD COLUMN IF NOT EXISTS retroviral_status TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS vif_status TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS felv_status TEXT;

CREATE INDEX IF NOT EXISTS idx_animals_microchip ON animals(microchip);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);

-- 5. POLÍTICAS DE ACCESO PÚBLICO (RLS PERMISIVO PARA DISPOSITIVOS DE CAMPO)
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access on staff" ON staff;
CREATE POLICY "Public access on staff" ON staff FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on staff_presence" ON staff_presence;
CREATE POLICY "Public access on staff_presence" ON staff_presence FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on shift_tasks" ON shift_tasks;
CREATE POLICY "Public access on shift_tasks" ON shift_tasks FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public access on animals" ON animals;
CREATE POLICY "Public access on animals" ON animals FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. HABILITAR PUBLICACIÓN REALTIME
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'staff_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staff_presence;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'shift_tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE shift_tasks;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'staff'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE staff;
  END IF;
END $$;
`;

      await navigator.clipboard.writeText(sqlText);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      alert("No se pudo copiar automáticamente. Por favor abre el archivo supabase/gatera_complete_schema.sql en tu proyecto.");
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    setSyncFeedback("Sincronizando personal local y remoto con Supabase...");

    try {
      // 1. Subir empleados locales que falten en Supabase
      const localStaff = await getAllStaff();
      for (const st of localStaff) {
        await syncStaffToSupabase(st);
      }

      // 2. Traer todos los empleados de Supabase y guardarlos localmente
      const cloudStaff = await fetchStaffFromSupabase();

      // 3. Subir animales del censo
      const animalSync = await syncAllLocalToSupabase();

      setSyncFeedback(
        `✅ Sincronización exitosa: ${cloudStaff.length} empleados sincronizados y ${animalSync.synced} felinos actualizados en la nube.`
      );
      if (onConfigChanged) onConfigChanged();
    } catch (err: any) {
      setSyncFeedback(`⚠️ Error durante la sincronización: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 animate-in fade-in">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-auto border border-slate-200 animate-in zoom-in-95 max-h-[94vh] overflow-y-auto">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-md shadow-blue-600/30">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base leading-tight">
                BASE DE DATOS SUPABASE • GATERA
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Sincronización multi-dispositivo en tiempo real (Personal, Turnos y Censo)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Estado Actual de Conexión */}
        {testResult && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold space-y-2 ${
              testResult.ok
                ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                : "bg-amber-50 border-amber-300 text-amber-950"
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.ok ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              )}
              <span>{testResult.message}</span>
            </div>

            {testResult.tables && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-[11px]">
                <div
                  className={`p-1.5 rounded-xl text-center border ${
                    testResult.tables.staff
                      ? "bg-emerald-100/80 border-emerald-300 text-emerald-900"
                      : "bg-rose-100/80 border-rose-300 text-rose-900"
                  }`}
                >
                  staff: {testResult.tables.staff ? "✅ OK" : "❌ Falta"}
                </div>
                <div
                  className={`p-1.5 rounded-xl text-center border ${
                    testResult.tables.staff_presence
                      ? "bg-emerald-100/80 border-emerald-300 text-emerald-900"
                      : "bg-rose-100/80 border-rose-300 text-rose-900"
                  }`}
                >
                  presence: {testResult.tables.staff_presence ? "✅ OK" : "❌ Falta"}
                </div>
                <div
                  className={`p-1.5 rounded-xl text-center border ${
                    testResult.tables.shift_tasks
                      ? "bg-emerald-100/80 border-emerald-300 text-emerald-900"
                      : "bg-rose-100/80 border-rose-300 text-rose-900"
                  }`}
                >
                  tasks: {testResult.tables.shift_tasks ? "✅ OK" : "❌ Falta"}
                </div>
                <div
                  className={`p-1.5 rounded-xl text-center border ${
                    testResult.tables.animals
                      ? "bg-emerald-100/80 border-emerald-300 text-emerald-900"
                      : "bg-rose-100/80 border-rose-300 text-rose-900"
                  }`}
                >
                  animals: {testResult.tables.animals ? "✅ OK" : "❌ Falta"}
                </div>
              </div>
            )}
          </div>
        )}

        {syncFeedback && (
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-2xl text-xs font-bold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            <span>{syncFeedback}</span>
          </div>
        )}

        {/* Formulario de Credenciales */}
        <form onSubmit={handleSave} className="space-y-3.5 text-xs">
          <div>
            <label className="font-black text-slate-800 block mb-1">
              1. URL del Proyecto Supabase (Project URL):
            </label>
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xyzabcdefghijklm.supabase.co"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Encuéntralo en Supabase: <strong>Settings &gt; API &gt; Project URL</strong>.
            </span>
          </div>

          <div>
            <label className="font-black text-slate-800 block mb-1">
              2. Clave Pública Anon Key (Project API Key):
            </label>
            <input
              type="text"
              required
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Encuéntralo en Supabase: <strong>Settings &gt; API &gt; Project API Keys &gt; anon / public</strong>.
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleTest(url, key)}
              disabled={isTesting}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? "animate-spin" : ""}`} />
              <span>{isTesting ? "Probando..." : "🧪 Probar Conexión"}</span>
            </button>

            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition-all active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>💾 Guardar Credenciales</span>
            </button>
          </div>
        </form>

        {/* Paso 2: Creación de Tablas en Supabase */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-black text-slate-900 flex items-center gap-1.5 uppercase text-[11px]">
              <Database className="w-4 h-4 text-blue-600" />
              Crear Tablas en Supabase (Si faltan)
            </span>
            <button
              type="button"
              onClick={handleCopySqlScript}
              className="py-1 px-2.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg font-black text-[10px] flex items-center gap-1 transition-all"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSql ? "¡Copiado!" : "📋 Copiar Script SQL"}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            Para que los empleados se reconozcan entre dispositivos, las tablas <code>staff</code>, <code>staff_presence</code>, <code>shift_tasks</code> y <code>animals</code> deben estar creadas en tu proyecto de Supabase.
          </p>

          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 font-medium">
            <li>Haz clic en el botón azul <strong>"📋 Copiar Script SQL"</strong>.</li>
            <li>Abre <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold inline-flex items-center gap-0.5">tu panel de Supabase <ExternalLink className="w-2.5 h-2.5" /></a> y ve a <strong>SQL Editor</strong>.</li>
            <li>Pega el código copiado y haz clic en <strong>RUN</strong>.</li>
          </ol>
        </div>

        {/* Paso 3: Sincronización Forzada de Personal y Censo */}
        <div className="pt-1 border-t flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleFullSync}
            disabled={isSyncing}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/30 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Sincronizando..." : "🔄 Forzar Sincronización de Personal y Censo"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
