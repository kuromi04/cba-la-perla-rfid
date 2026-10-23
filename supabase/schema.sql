-- =========================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS - ALBERGUE DE ANIMALES (4,000+ MASCOTAS)
-- Motor: PostgreSQL 15+ / Supabase
-- =========================================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. TIPOS ENUMERADOS
CREATE TYPE user_role AS ENUM ('admin', 'veterinario', 'operario');
CREATE TYPE task_shift AS ENUM ('mañana', 'tarde', 'noche');
CREATE TYPE treatment_status AS ENUM ('activo', 'finalizado', 'suspendido');
CREATE TYPE animal_status AS ENUM ('activo', 'en_adopcion', 'adoptado', 'fallecido', 'cuarentena');

-- 2. PERFILES DE USUARIO
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'operario',
    phone TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. UBICACIONES FÍSICAS (Caniles, Patios, Casetas, Cuarentenas)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,       -- Ej: 'CANIL-01', 'PATIO-SUR'
    zone TEXT NOT NULL,              -- Ej: 'Zona Perros Grandes', 'Cuarentena Felina'
    capacity INT DEFAULT 1,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CATÁLOGOS DINÁMICOS CONFIGURABLES (Evita hardcodear en código)
CREATE TABLE IF NOT EXISTS catalog_types (
    slug TEXT PRIMARY KEY,           -- Ej: 'sistema_medico', 'especie', 'via_admin'
    name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    catalog_slug TEXT NOT NULL REFERENCES catalog_types(slug) ON DELETE CASCADE,
    code TEXT NOT NULL,              -- Ej: 'DERMATOLOGICO', 'GASTROINTESTINAL'
    label TEXT NOT NULL,             -- Ej: 'Dermatológico', 'Gastrointestinal'
    color_hex VARCHAR(7) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(catalog_slug, code)
);

-- 5. TABLA DE ANIMALES (Soporta 4,000+ registros con índices de alto rendimiento)
CREATE TABLE IF NOT EXISTS animals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    microchip VARCHAR(32) NOT NULL UNIQUE, -- Código FDX-B (15 dígitos) o EMID (10 dígitos)
    name TEXT NOT NULL,
    species TEXT NOT NULL DEFAULT 'perro', -- 'perro', 'gato', 'ave', 'otro'
    breed TEXT,
    sex VARCHAR(10) CHECK (sex IN ('macho', 'hembra', 'desconocido')),
    approx_birth_date DATE,
    weight_kg NUMERIC(5,2),
    current_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    status animal_status NOT NULL DEFAULT 'activo',
    photo_url TEXT,
    notes TEXT,
    attributes JSONB DEFAULT '{}'::jsonb, -- Campos personalizados creados por Admin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices B-Tree y Trigram para búsquedas ultrarrápidas (< 5ms)
CREATE INDEX IF NOT EXISTS idx_animals_microchip ON animals(microchip);
CREATE INDEX IF NOT EXISTS idx_animals_location ON animals(current_location_id);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);
CREATE INDEX IF NOT EXISTS idx_animals_name_trgm ON animals USING gin (name gin_trgm_ops);

-- 6. KARDEX CLÍNICO Y TRATAMIENTOS
CREATE TABLE IF NOT EXISTS treatments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    prescribed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    system_code TEXT NOT NULL,             -- Referencia a catalog_items('sistema_medico')
    treatment_name TEXT NOT NULL,          -- Ej: 'Antipulgas Bravecto', 'Amoxicilina'
    description TEXT,                      -- Indicaciones de dosis y aplicación
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status treatment_status NOT NULL DEFAULT 'activo',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatments_animal ON treatments(animal_id);
CREATE INDEX IF NOT EXISTS idx_treatments_active ON treatments(status) WHERE status = 'activo';
CREATE INDEX IF NOT EXISTS idx_treatments_dates ON treatments(start_date, end_date);

-- 7. TAREAS ASIGNADAS POR TURNO (Auxiliares / Operarios)
CREATE TABLE IF NOT EXISTS treatment_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treatment_id UUID NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    shift task_shift NOT NULL DEFAULT 'mañana',
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_schedule ON treatment_tasks(scheduled_date, shift, is_completed);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON treatment_tasks(assigned_to, is_completed);

-- 8. REGISTROS DE CENSO DIARIO (Auditoría de Lectura con W91A)
CREATE TABLE IF NOT EXISTS daily_census (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    scanned_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    scanned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scanner_device TEXT DEFAULT 'W91A_HID',
    offline_sync_id TEXT, -- UUID generado en cliente para prevenir duplicados al sincronizar
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_census_animal_date ON daily_census(animal_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_census_date ON daily_census(scanned_at);

-- =========================================================================
-- DATOS SEMILLA (Catalogos y Valores por Defecto)
-- =========================================================================

INSERT INTO catalog_types (slug, name, description) VALUES
('sistema_medico', 'Sistemas Médicos', 'Categorización clínica para Kardex'),
('especie', 'Especies', 'Tipos de animales admitidos')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO catalog_items (catalog_slug, code, label, color_hex, display_order) VALUES
('sistema_medico', 'DERMATOLOGICO', 'Dermatológico', '#EC4899', 1),
('sistema_medico', 'GASTROINTESTINAL', 'Gastrointestinal', '#F59E0B', 2),
('sistema_medico', 'RESPIRATORIO', 'Respiratorio', '#06B6D4', 3),
('sistema_medico', 'OFTALMOLOGICO', 'Oftalmológico', '#8B5CF6', 4),
('sistema_medico', 'TRAUMATOLOGICO', 'Traumatológico', '#EF4444', 5),
('sistema_medico', 'PREVENTIVO', 'Preventivo (Vacunas/Antiparasitarios)', '#10B981', 6),
('sistema_medico', 'CONDUCTUAL', 'Conductual', '#6366F1', 7)
ON CONFLICT (catalog_slug, code) DO NOTHING;

INSERT INTO catalog_items (catalog_slug, code, label, color_hex, display_order) VALUES
('especie', 'PERRO', 'Perro', '#3B82F6', 1),
('especie', 'GATO', 'Gato', '#10B981', 2),
('especie', 'AVE', 'Ave', '#F59E0B', 3),
('especie', 'OTRO', 'Otro', '#6B7280', 4)
ON CONFLICT (catalog_slug, code) DO NOTHING;

-- Ubicaciones iniciales de ejemplo
INSERT INTO locations (code, zone, capacity) VALUES
('CANIL-01', 'Patio Central', 2),
('CANIL-02', 'Patio Central', 2),
('CANIL-03', 'Patio Norte', 3),
('CANIL-04', 'Patio Norte', 3),
('GATERA-01', 'Zona Felina', 4),
('CUARENTENA-01', 'Hospitalización', 1)
ON CONFLICT (code) DO NOTHING;
