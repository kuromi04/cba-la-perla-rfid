"use client";
import React, { useState, useEffect } from "react";
import { StaffMember, getAllStaff } from "@/lib/staff";
import { Link2, Copy, Check, MessageSquare, ExternalLink, X, UserPlus, Users } from "lucide-react";

interface MagicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkerSession: (member: StaffMember) => void;
}

export const MagicLinkModal: React.FC<MagicLinkModalProps> = ({
  isOpen,
  onClose,
  onSelectWorkerSession,
}) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getAllStaff().then((list) => {
        setStaffList(list);
        if (list.length > 0) {
          const defaultWorker = list.find((s) => s.role !== "veterinario") || list[0];
          setSelectedStaff(defaultWorker);
        } else {
          setSelectedStaff(null);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "http://192.168.0.6:3000";
  const magicUrl = selectedStaff
    ? `${origin}/?token=${selectedStaff.token}&user=${selectedStaff.id}&role=${selectedStaff.role}&area=${selectedStaff.area}`
    : "";

  const handleCopy = () => {
    if (!magicUrl) return;
    navigator.clipboard.writeText(magicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!selectedStaff || !magicUrl) return;
    const text = `Hola ${selectedStaff.name}, aquí tienes tu Enlace Mágico de acceso directo a tus tareas de CBA La Perla (${selectedStaff.area.toUpperCase()}): ${magicUrl}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-xl text-indigo-700">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Generador de Link Mágico</h3>
              <p className="text-[11px] text-slate-500">Acceso sin contraseña para auxiliares y operarios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {staffList.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border space-y-2 text-xs">
            <Users className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-slate-700 font-bold">No hay empleados registrados en el albergue.</p>
            <p className="text-slate-500 text-[11px]">
              Regístrate primero desde el botón de usuario en la barra superior.
            </p>
          </div>
        ) : (
          <>
            {/* Selección de Trabajador */}
            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 block">SELECCIONAR EMPLEADO:</label>
              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {staffList.map((staff) => (
                  <div
                    key={staff.id}
                    onClick={() => setSelectedStaff(staff)}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedStaff?.id === staff.id
                        ? "bg-indigo-50 border-indigo-400 shadow-sm"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{staff.name}</span>
                        <span
                          className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-md ${
                            staff.role === "auxiliar"
                              ? "bg-amber-100 text-amber-800"
                              : staff.role === "operario"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {staff.role}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Área asignada: <strong>{staff.area.toUpperCase()}</strong>
                      </span>
                    </div>
                    {selectedStaff?.id === staff.id && (
                      <Check className="w-5 h-5 text-indigo-600 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {selectedStaff && (
              <>
                {/* Enlace Mágico Generado */}
                <div className="p-3 bg-slate-100 rounded-2xl space-y-1 border border-slate-200 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Enlace de acceso directo:</span>
                  <p className="font-mono text-[11px] text-slate-800 break-all select-all bg-white p-2 rounded-xl border">
                    {magicUrl}
                  </p>
                </div>

                {/* Botones de Acción */}
                <div className="space-y-2 pt-1 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="py-3 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copied ? "¡Copiado!" : "Copiar Enlace"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleShareWhatsApp}
                      className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Enviar WhatsApp</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectWorkerSession(selectedStaff);
                      onClose();
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir Vista de {selectedStaff.name} Ahora</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
