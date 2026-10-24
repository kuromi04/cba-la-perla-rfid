"use client";
import React, { useState, useEffect } from "react";
import { StaffMember, getAllStaff, registerStaffMember, deleteStaffMember } from "@/lib/staff";
import {
  User,
  Stethoscope,
  Check,
  X,
  UserPlus,
  Trash2,
  Users,
  CheckCircle2,
} from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffMember | null;
  onSelectUser: (user: StaffMember) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
}) => {
  const [activeTab, setActiveTab] = useState<"lista" | "registro">("lista");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Formulario de registro de nuevo empleado
  const [name, setName] = useState("");
  const [role, setRole] = useState<"veterinario" | "auxiliar" | "operario" | "admin">("veterinario");
  const [area, setArea] = useState<"caninos" | "gatera" | "ambas">("caninos");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");

  const refreshStaff = async () => {
    setLoading(true);
    const list = await getAllStaff();
    setStaffList(list);
    setLoading(false);

    // Si la lista está vacía, llevar directamente a la pestaña de registro
    if (list.length === 0) {
      setActiveTab("registro");
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStaff();
      setFeedback(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newMember = await registerStaffMember({
      name: name.trim(),
      role,
      area,
      specialty: specialty.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    setFeedback(`✅ ${newMember.name} registrado exitosamente como ${newMember.role.toUpperCase()}`);
    setName("");
    setSpecialty("");
    setPhone("");
    
    await refreshStaff();
    onSelectUser(newMember);

    setTimeout(() => {
      setFeedback(null);
      setActiveTab("lista");
      onClose();
    }, 1200);
  };

  const handleDelete = async (id: string, staffName: string) => {
    if (!window.confirm(`¿Deseas eliminar a ${staffName} de la lista de personal?`)) return;
    await deleteStaffMember(id);
    await refreshStaff();
    setFeedback(`Personal ${staffName} eliminado.`);
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 backdrop-blur-sm p-3 animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-5 space-y-4 my-auto animate-in zoom-in-95 max-h-[92vh] overflow-y-auto border border-slate-200">
        
        {/* Cabecera del Modal de Sesión */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-600 rounded-2xl text-white shadow-md shadow-emerald-600/30">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base leading-tight">
                PERSONAL CBA LA PERLA
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Registro y selección de Médicos, Auxiliares y Operarios
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

        {feedback && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-black flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        {/* Pestañas: Lista de Personal vs Registrar Nuevo */}
        <div className="flex p-1 bg-slate-100 rounded-2xl gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("lista")}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "lista"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Personal Registrado ({staffList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("registro")}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === "registro"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>➕ Registrar Empleado</span>
          </button>
        </div>

        {/* PESTAÑA 1: LISTA DE PERSONAL REGISTRADO */}
        {activeTab === "lista" && (
          <div className="space-y-2">
            {staffList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-3">
                <Users className="w-10 h-10 text-slate-300 mx-auto" />
                <div>
                  <h4 className="font-black text-slate-800 text-sm">No hay empleados registrados aún</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registra al primer médico veterinario, auxiliar u operario para iniciar sesión.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("registro")}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-md"
                >
                  ➕ Registrar Primer Empleado
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {staffList.map((staff) => {
                  const isCurrent = currentUser?.id === staff.id;

                  return (
                    <div
                      key={staff.id}
                      onClick={() => {
                        onSelectUser(staff);
                        onClose();
                      }}
                      className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                        isCurrent
                          ? "bg-emerald-50 border-emerald-500 shadow-sm"
                          : "bg-slate-50 hover:bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-sm ${staff.avatarColor}`}
                        >
                          {staff.role === "veterinario"
                            ? "DR"
                            : staff.role === "auxiliar"
                            ? "AUX"
                            : staff.role === "operario"
                            ? "OP"
                            : "ADM"}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-slate-900 text-xs">{staff.name}</span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                staff.role === "veterinario"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : staff.role === "auxiliar"
                                  ? "bg-amber-100 text-amber-800"
                                  : staff.role === "operario"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {staff.role}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                            {staff.specialty} • Área: <strong className="uppercase">{staff.area}</strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isCurrent ? (
                          <span className="px-2.5 py-1 bg-emerald-600 text-white rounded-xl text-[10px] font-black flex items-center gap-1 shadow-sm">
                            <Check className="w-3 h-3" /> Activo
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 bg-slate-200 hover:bg-slate-900 hover:text-white rounded-xl text-[10px] font-bold text-slate-700 transition-colors">
                            Ingresar
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(staff.id, staff.name);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                          title="Eliminar este empleado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: FORMULARIO PARA REGISTRAR NUEVO EMPLEADO */}
        {activeTab === "registro" && (
          <form onSubmit={handleRegister} className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                NOMBRE COMPLETO:
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Dr. Santiago Ramírez, María Paula Restrepo..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-slate-700 block mb-1">ROL EN EL ALBERGUE:</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="veterinario">👨‍⚕️ Médico Veterinario</option>
                  <option value="auxiliar">🧑‍🔬 Auxiliar Veterinario</option>
                  <option value="operario">👷 Operario de Albergue</option>
                  <option value="admin">🔑 Administrador</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">ÁREA ASIGNADA:</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="caninos">🐶 Caninos (Triaje/UCE)</option>
                  <option value="gatera">🐱 Gatera (461 Felinos)</option>
                  <option value="ambas">🐾 Ambas Áreas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                ESPECIALIDAD O FUNCIÓN (OPCIONAL):
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="Ej: Cirugía, Cuarentenas, Baños y Limpieza, Areneros..."
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                TELÉFONO MÓVIL (OPCIONAL PARA WHATSAPP):
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 3001234567"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                <span>REGISTRAR E INICIAR SESIÓN</span>
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="pt-2 border-t flex items-center justify-between text-[11px] text-slate-400">
          <span>Centro de Bienestar Animal La Perla</span>
          <span>Alcaldía de Medellín</span>
        </div>
      </div>
    </div>
  );
};
