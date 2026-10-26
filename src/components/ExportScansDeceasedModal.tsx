"use client";
import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  X,
  Calendar,
  Users,
  Download,
  CheckCircle,
  Loader2,
  Skull,
  QrCode,
  Camera,
  Filter,
} from "lucide-react";
import {
  exportUserScansAndDeceasedExcel,
  getUserActivityStats,
  normalizeStaffName,
  UserActivityStatsItem,
} from "@/lib/excelGenerator";
import { db, syncAnimalsBidirectional } from "@/lib/db";
import { getFieldStaff, StaffMember } from "@/lib/staff";
import { RefreshCw } from "lucide-react";

interface ExportScansDeceasedModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultUser?: string;
}

export const ExportScansDeceasedModal: React.FC<ExportScansDeceasedModalProps> = ({
  isOpen,
  onClose,
  defaultUser = "all",
}) => {
  const [selectedUser, setSelectedUser] = useState<string>(defaultUser);
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week">("all");
  const [isExporting, setIsExporting] = useState(false);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<UserActivityStatsItem[]>([]);
  const [previewStats, setPreviewStats] = useState<{ scans: number; deceased: number; photos: number }>({
    scans: 0,
    deceased: 0,
    photos: 0,
  });
  const [feedback, setFeedback] = useState<string | null>(null);

  // Cargar lista dinámica y estadísticas consolidadas exactas (100% coincidentes con el Excel)
  const loadUsersAndStats = async () => {
    try {
      const stats = await getUserActivityStats(dateFilter, selectedUser);
      setAvailableUsers(stats.userList);
      setPreviewStats(stats.previewStats);
    } catch (err) {
      console.warn("Error cargando estadísticas para exportación:", err);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadUsersAndStats();
  }, [isOpen, dateFilter, selectedUser]);

  const handleSyncCloud = async () => {
    setIsSyncingCloud(true);
    setFeedback("🔄 Descargando y sincronizando novedades desde Supabase en la nube...");
    try {
      await syncAnimalsBidirectional();
      await loadUsersAndStats();
      setFeedback("✅ Sincronización completa: todos los escaneos móviles están al día.");
    } catch {
      setFeedback("⚠️ Conexión no disponible. Mostrando datos locales de este dispositivo.");
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  if (!isOpen) return null;

  const handleExecuteExport = async () => {
    setIsExporting(true);
    setFeedback(null);
    try {
      const result = await exportUserScansAndDeceasedExcel({
        userFilter: selectedUser,
        dateFilter,
      });

      setFeedback(
        `✅ Archivo exportado con éxito: ${result.fileName} (${result.totalScans} escaneos y ${result.totalDeceased} fallecidos consolidados).`
      );
      setTimeout(() => {
        onClose();
      }, 3500);
    } catch (err: any) {
      console.error("Error al exportar reporte Excel:", err);
      setFeedback("❌ Ocurrió un error al generar el archivo Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md p-3 sm:p-4 flex items-center justify-center animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <div className="p-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-black text-sm">Descargar Escaneos y Fallecidos</h3>
              <p className="text-[10px] text-emerald-200 font-medium">
                CBA La Perla • Reporte Oficial por Usuario en Excel (.xlsx)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-emerald-200 hover:text-white rounded-xl hover:bg-white/10 transition-all"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido del Formulario */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Mensaje de éxito / feedback */}
          {feedback && (
            <div
              className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
                feedback.startsWith("✅")
                  ? "bg-emerald-50 text-emerald-950 border-emerald-300"
                  : "bg-rose-50 text-rose-950 border-rose-300"
              }`}
            >
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{feedback}</span>
            </div>
          )}
          {/* Botón de Sincronización en la Nube */}
          <div className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl">
            <span className="text-[11px] font-bold text-emerald-950 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sincronización con móviles y PC
            </span>
            <button
              type="button"
              disabled={isSyncingCloud}
              onClick={handleSyncCloud}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-[11px] flex items-center gap-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? "animate-spin" : ""}`} />
              <span>{isSyncingCloud ? "Sincronizando..." : "Actualizar desde Nube"}</span>
            </button>
          </div>

          {/* Tarjeta de Métricas Rápidas */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 p-3 rounded-2xl text-center">
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                <QrCode className="w-3 h-3 text-indigo-600" /> Escaneos
              </span>
              <span className="text-base font-black text-slate-900">{previewStats.scans}</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                <Skull className="w-3 h-3 text-rose-600" /> Fallecidos
              </span>
              <span className="text-base font-black text-rose-900">{previewStats.deceased}</span>
            </div>
            <div className="p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <span className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                <Camera className="w-3 h-3 text-purple-600" /> Con Foto
              </span>
              <span className="text-base font-black text-purple-900">{previewStats.photos}</span>
            </div>
          </div>

          {/* Filtro 1: Selección de Usuario */}
          <div className="space-y-1.5">
            <label className="font-black text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-700" />
              Funcionario / Usuario Responsable:
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
            >
              <option value="all">👥 Todos los Funcionarios (Consolidado General)</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.role === "veterinario" ? "👩‍⚕️" : "🧑‍🔧"} {u.name} ({u.count} registros)
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-500 block">
              Puedes descargar la actividad de todos los usuarios o filtrar solo la de un médico en particular (ej. Dra. Natalia Cortés).
            </span>
          </div>

          {/* Filtro 2: Rango de Fecha */}
          <div className="space-y-1.5">
            <label className="font-black text-slate-800 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              Período de Escaneo:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {[
                { id: "all", label: "Histórico Todo" },
                { id: "today", label: "Solo Hoy" },
                { id: "yesterday", label: "Ayer" },
                { id: "week", label: "Últimos 7 Días" },
              ].map((df) => (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => setDateFilter(df.id as any)}
                  className={`py-2 px-2.5 rounded-xl font-black text-[11px] transition-all text-center border ${
                    dateFilter === df.id
                      ? "bg-emerald-700 text-white border-emerald-800 shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                  }`}
                >
                  {df.label}
                </button>
              ))}
            </div>
          </div>

          {/* Estructura del Archivo Excel */}
          <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-1.5">
            <h4 className="text-[11px] font-black uppercase text-teal-950 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-teal-700" />
              Estructura del Libro Excel Oficial (.xlsx):
            </h4>
            <ul className="text-[10px] space-y-1 text-teal-900 font-medium list-disc list-inside">
              <li>
                <strong>Hoja 1 (RESUMEN_POR_USUARIO):</strong> Cuadro estadístico con total escaneos, activos verificados, defunciones, fotos adjuntas y horarios de primer y último escaneo.
              </li>
              <li>
                <strong>Hoja 2 (ESCANEOS_DIARIOS):</strong> Lista detallada de cada escaneo con microchip de 15 dígitos, chip corto, canil/ubicación, estado de salud, retroviral, foto y observaciones.
              </li>
              <li>
                <strong>Hoja 3 (CONTROL_FALLECIDOS):</strong> Registro oficial de felinos fallecidos con causa de defunción, última ubicación previa y profesional responsable de la baja.
              </li>
            </ul>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 hover:text-slate-900 font-bold rounded-xl text-xs transition-all"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleExecuteExport}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-95 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Generando Excel...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-200" />
                <span>Descargar Excel Oficial (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
