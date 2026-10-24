-- =========================================================================
-- ESQUEMA COMPLETO Y EXCLUSIVO GATERA (FELINOS) - CBA LA PERLA
-- Sincronización en tiempo real de Personal, Presencia en Vivo y Checklists
-- Motor: PostgreSQL 15+ / Supabase
-- =========================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA DE PERSONAL (STAFF)
-- Permite que médicos, auxiliares y operarios se registren y se reconozcan entre dispositivos
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

-- Insertar Administrador Maestro por Defecto (Kuromi)
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

-- 2. TABLA DE PRESENCIA EN VIVO (QUIÉN ESTÁ CONECTADO)
-- Monitorea en tiempo real qué empleados están activos en el turno en Gatera
CREATE TABLE IF NOT EXISTS staff_presence (
    staff_id TEXT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
    staff_name TEXT NOT NULL,
    role TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'gatera',
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_info TEXT
);

-- 3. TABLA DE TAREAS Y CHECKLISTS DE TURNO (SUPERVISIÓN EN VIVO)
-- Permite que supervisores y médicos auditen tareas completadas por operarios y auxiliares
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

-- 4. TABLA DE ANIMALES Y CENSO DE GATERA (461 FELINOS)
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
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_animals_microchip ON animals(microchip);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);

-- 5. POLÍTICAS DE ACCESO PÚBLICO / ANONIMO (RLS PERMISIVO PARA ALBERGUE)
-- Garantiza que los dispositivos móviles y tabletas sin inicio de sesión por Auth puedan sincronizar
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

-- 6. HABILITAR PUBLICACIÓN REALTIME PARA PRESENCIA Y TAREAS
-- Permite recibir eventos instantáneos en la app cuando un empleado marca una tarea
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
