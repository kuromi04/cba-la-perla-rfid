"use client";
import React, { useState } from "react";
import { ConnectedStaff } from "@/lib/supabase";
import { StaffMember } from "@/lib/staff";
import {
  X,
  Users,
  Smartphone,
  Laptop,
  CheckCircle2,
  RefreshCw,
  Clock,
  Shield,
  Wifi,
  Sparkles,
} from "lucide-react";

interface PresenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectedStaff: ConnectedStaff[];
  currentUser: StaffMember | null;
  onForceSync: () => Promise<void>;
}

export const PresenceModal: React.FC<PresenceModalProps> = ({
  isOpen,
  onClose,
  connectedStaff,
  currentUser,
  onForceSync,
}) => {
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setSyncing(true);
    setSyncSuccessMessage(null);
    try {
      await onForceSync();
      setSyncSuccessMessage("¡Datos sincronizados al 100% con Supabase y todos los dispositivos!");
      setTimeout(() => setSyncSuccessMessage(null), 4000);
    } catch (err: any) {
      setSyncSuccessMessage("Error al sincronizar: " + (err?.message || "Revisa la conexión"));
    } finally {
      setSyncing(false);
    }
  };

  const activeNowCount = connectedStaff.filter((s) => s.isOnlineNow).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-inner">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Presencia en Vivo
                </h2>
                <span className="flex items-center gap-1 bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {activeNowCount || (currentUser ? 1 : 0)} activo{activeNowCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Personal activo desde PC o Móvil en cualquier ubicación
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-200 text-sm">
          {/* Tarjeta de Forzar Sincronización Manual */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div>
              <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Sincronización Bidireccional Activa
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Los cambios se envían automáticamente por WebSockets a toda la red.
              </p>
            </div>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncing}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar Ya"}
            </button>
          </div>

          {syncSuccessMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{syncSuccessMessage}</span>
            </div>
          )}

          {/* Lista de Profesionales */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
              Personal Detectado en Red
            </h4>

            {connectedStaff.length === 0 ? (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                <Wifi className="w-8 h-8 text-slate-500 mx-auto animate-pulse" />
                <p className="text-xs text-slate-300 font-semibold">
                  {currentUser
                    ? `${currentUser.name} (Sesión activa en este dispositivo)`
                    : "No se registran otros usuarios en los últimos minutos."}
                </p>
                <p className="text-[11px] text-slate-400">
                  Asegúrate de que los demás dispositivos cuenten con conexión a internet y credenciales de Supabase configuradas.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
                {connectedStaff.map((staff) => {
                  const isCurrent = currentUser?.id === staff.staff_id;
                  const devInfo = (staff.device_info || "").toLowerCase();
                  const isPC = devInfo.includes("pc") || devInfo.includes("mac");

                  return (
                    <div
                      key={staff.staff_id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isCurrent
                          ? "bg-emerald-950/30 border-emerald-500/40 shadow-sm"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar o Icono de Dispositivo */}
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-200 flex items-center justify-center font-black text-xs border border-slate-700">
                            {isPC ? <Laptop className="w-5 h-5 text-indigo-400" /> : <Smartphone className="w-5 h-5 text-emerald-400" />}
                          </div>
                          {staff.isOnlineNow && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full" />
                          )}
                        </div>

                        {/* Info Usuario */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white text-xs sm:text-sm truncate">
                              {staff.staff_name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] bg-emerald-900/80 text-emerald-300 font-black px-1.5 py-0.2 rounded border border-emerald-500/40">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                            <span className="capitalize font-medium text-slate-300">
                              {staff.role}
                            </span>
                            <span>•</span>
                            <span className="truncate">{staff.device_info || "Dispositivo"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Estado y Timestamp */}
                      <div className="text-right shrink-0">
                        {staff.isOnlineNow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            En línea
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Activo rec.
                          </span>
                        )}
                        <p className="text-[9px] text-slate-300 mt-1">
                          {new Date(staff.last_seen).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Información sobre Arquitectura REA */}
          <div className="p-3 bg-slate-950/70 rounded-2xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <p className="font-bold text-slate-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              Sincronización Distribuida en Tiempo Real
            </p>
            <p className="leading-relaxed">
              La arquitectura de datos local en Dexie almacena cada registro sin latencia offline, y cuando hay conexión a internet o WiFi institucional, el canal en tiempo real replica instantáneamente fotos, fichas clínicas, tareas y censo en todos los dispositivos conectados.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
