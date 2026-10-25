"use client";
import React, { useState, useEffect } from "react";
import {
  StaffMember,
  getFieldStaff,
  registerStaffMember,
  updateStaffMember,
  deleteStaffMember,
  verifyUserPin,
} from "@/lib/staff";
import {
  User,
  Stethoscope,
  Check,
  X,
  UserPlus,
  Trash2,
  Users,
  CheckCircle2,
  Shield,
  Lock,
  RefreshCw,
  KeyRound,
  ArrowRight,
  AlertTriangle,
  Edit2,
  Save,
} from "lucide-react";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffMember | null;
  onSelectUser: (user: StaffMember) => void;
  onOpenAdminDashboard?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser,
  onOpenAdminDashboard,
}) => {
  const [activeTab, setActiveTab] = useState<"lista" | "registro">("lista");
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Formulario de registro de nuevo empleado
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"veterinario" | "auxiliar" | "operario">("veterinario");
  const [area, setArea] = useState<"gatera">("gatera");
  const [specialty, setSpecialty] = useState("");
  const [phone, setPhone] = useState("");

  const [staffPendingPin, setStaffPendingPin] = useState<StaffMember | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  // Estado para edición de datos del funcionario
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"veterinario" | "auxiliar" | "operario">("veterinario");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPin, setEditPin] = useState("");

  const refreshStaff = async (isManual = false) => {
    setLoading(true);
    try {
      // Excluye al Administrador Maestro para que nadie lo suplante desde campo
      const list = await getFieldStaff();
      setStaffList(list);
      if (isManual) {
        setFeedback(`☁️ Personal sincronizado: ${list.length} empleados de campo activos.`);
        setTimeout(() => setFeedback(null), 3000);
      }
      if (list.length === 0) {
        setActiveTab("registro");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStaff();
      setFeedback(null);
      setStaffPendingPin(null);
      setEditingMember(null);
      setEnteredPin("");
      setPinError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectStaff = (staff: StaffMember) => {
    // Si el usuario tiene PIN configurado, solicitarlo obligatoriamente
    if (staff.pin && staff.pin.trim().length > 0) {
      setStaffPendingPin(staff);
      setEnteredPin("");
      setPinError(null);
    } else {
      // Si no tiene PIN configurado aún, permitir acceso directo
      onSelectUser(staff);
      onClose();
    }
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffPendingPin) return;

    if (verifyUserPin(staffPendingPin, enteredPin)) {
      onSelectUser(staffPendingPin);
      setStaffPendingPin(null);
      setEnteredPin("");
      setPinError(null);
      onClose();
    } else {
      setPinError("⛔ PIN incorrecto. No tienes autorización para usar la sesión de otro funcionario.");
      setEnteredPin("");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (pin.trim() && pin.trim().length < 4) {
      alert("El PIN personal de seguridad debe tener mínimo 4 dígitos.");
      return;
    }

    const newMember = await registerStaffMember({
      name: name.trim(),
      email: email.trim() || undefined,
      pin: pin.trim() || undefined,
      role,
      area,
      specialty: specialty.trim() || undefined,
      phone: phone.trim() || undefined,
    });

    setFeedback(`✅ ${newMember.name} registrado con éxito (${newMember.role.toUpperCase()})`);
    setName("");
    setEmail("");
    setPin("");
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

  const handleStartEdit = (member: StaffMember) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditRole(member.role === "admin" ? "veterinario" : member.role);
    setEditSpecialty(member.specialty || "");
    setEditEmail(member.email || "");
    setEditPhone(member.phone || "");
    setEditPin(member.pin || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !editName.trim()) return;

    if (editPin.trim() && editPin.trim().length < 4) {
      alert("El PIN personal debe tener al menos 4 dígitos numéricos.");
      return;
    }

    setLoading(true);
    try {
      const updated = await updateStaffMember(editingMember.id, {
        name: editName.trim(),
        role: editRole,
        specialty: editSpecialty.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        pin: editPin.trim() || undefined,
      });

      if (updated) {
        setFeedback(`✅ Datos de ${updated.name} actualizados.`);
        if (currentUser?.id === updated.id) {
          onSelectUser(updated);
        }
        setEditingMember(null);
        await refreshStaff();
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err: any) {
      alert("Error al actualizar funcionario: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, staffName: string) => {
    if (!window.confirm(`¿Deseas eliminar a ${staffName} de la lista de personal de campo?`)) return;
    await deleteStaffMember(id);
    await refreshStaff();
    setFeedback(`Personal ${staffName} eliminado.`);
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-5 space-y-4 my-auto animate-in zoom-in-95 max-h-[92vh] overflow-y-auto border border-slate-200">
        
        {/* Cabecera del Modal de Sesión */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-700 rounded-2xl text-white shadow-md shadow-purple-700/30">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base leading-tight">
                PERSONAL CBA LA PERLA
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Sesiones individuales protegidas para Médicos, Auxiliares y Operarios
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

        {/* PROMPT DE EDICIÓN DE FUNCIONARIO */}
        {editingMember ? (
          <div className="p-4 bg-purple-50/90 border-2 border-purple-300 rounded-2xl space-y-3 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-purple-200 pb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-700 text-white rounded-lg">
                  <Edit2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-sm">Editar Datos de Funcionario</h4>
                  <p className="text-[10px] text-slate-500">Actualiza los datos institucionales y de acceso</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nombre Completo: *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rol / Cargo: *</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                  >
                    <option value="veterinario">Médico Veterinario</option>
                    <option value="auxiliar">Auxiliar Veterinario</option>
                    <option value="operario">Operario de Albergue</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">PIN Personal (Opcional):</label>
                  <input
                    type="password"
                    maxLength={6}
                    value={editPin}
                    onChange={(e) => setEditPin(e.target.value)}
                    placeholder="Ej. 1234"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-center font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Especialidad / Cargo Detallado:</label>
                <input
                  type="text"
                  value={editSpecialty}
                  onChange={(e) => setEditSpecialty(e.target.value)}
                  placeholder="Ej: Cirugía, Hospitalización, etc."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Correo Institucional:</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="correo@laperla.gov.co"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Teléfono / WhatsApp:</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="300 000 0000"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="w-1/2 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-1/2 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? "Guardando..." : "Guardar Cambios"}</span>
                </button>
              </div>
            </form>
          </div>
        ) : staffPendingPin ? (
          <div className="p-4 bg-purple-50/80 border-2 border-purple-200 rounded-2xl space-y-3 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm ${staffPendingPin.avatarColor}`}>
                {staffPendingPin.role === "veterinario" ? "DR" : staffPendingPin.role === "auxiliar" ? "AUX" : "OP"}
              </div>
              <div>
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  Autenticación de Funcionario
                </span>
                <h4 className="font-black text-slate-900 text-sm">{staffPendingPin.name}</h4>
                <span className="text-[11px] text-slate-500">{staffPendingPin.specialty}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Esta cuenta está protegida. Ingresa tu PIN personal de seguridad para activar tu sesión:
            </p>

            {pinError && (
              <div className="p-2.5 bg-red-100 border border-red-300 text-red-900 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmPin} className="space-y-3 pt-1">
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  required
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  placeholder="PIN de 4 a 6 dígitos"
                  className="w-full pl-9 pr-4 py-2.5 bg-white border border-purple-300 rounded-xl text-center font-mono font-black text-base text-purple-950 focus:ring-2 focus:ring-purple-600 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStaffPendingPin(null)}
                  className="w-1/2 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <span>Ingresar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {/* Selector de Pestañas: Lista de Empleados vs Nuevo Registro */}
            <div className="flex p-1 bg-slate-100 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("lista")}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "lista"
                    ? "bg-purple-700 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Personal de Campo ({staffList.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("registro")}
                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === "registro"
                    ? "bg-purple-700 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>➕ Registrar Empleado</span>
              </button>
            </div>

            {/* PESTAÑA 1: LISTA DE PERSONAL DE CAMPO */}
            {activeTab === "lista" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 px-1">
                  <span className="text-[11px] font-bold text-slate-500">
                    Selecciona tu usuario e ingresa tu PIN:
                  </span>
                  <button
                    type="button"
                    onClick={() => refreshStaff(true)}
                    disabled={loading}
                    className="text-[11px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded-lg transition-all"
                    title="Sincronizar personal desde Supabase"
                  >
                    <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    <span>{loading ? "Sincronizando..." : "Sincronizar"}</span>
                  </button>
                </div>

                {staffList.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-3xl border border-slate-200 space-y-3">
                    <Users className="w-10 h-10 text-slate-300 mx-auto" />
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">No hay empleados de campo registrados</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Registra a los médicos veterinarios, auxiliares u operarios para iniciar sesión.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("registro")}
                      className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-2xl font-black text-xs shadow-md"
                    >
                      ➕ Registrar Primer Empleado
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {currentUser && (
                      <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-2xl flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${currentUser.avatarColor}`}>
                            {currentUser.role === "veterinario" ? "DR" : currentUser.role === "auxiliar" ? "AUX" : "OP"}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-purple-700 block uppercase">Mi Sesión Actual</span>
                            <span className="text-xs font-black text-slate-900 truncate block">{currentUser.name}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(currentUser)}
                          className="px-2.5 py-1.5 bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 rounded-xl text-xs font-bold flex items-center gap-1 shadow-2xs shrink-0"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Modificar mis datos</span>
                        </button>
                      </div>
                    )}

                    {staffList.map((staff) => {
                      const isCurrent = currentUser?.id === staff.id;

                      return (
                        <div
                          key={staff.id}
                          onClick={() => handleSelectStaff(staff)}
                          className={`p-3 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                            isCurrent
                              ? "bg-purple-50 border-purple-500 shadow-sm"
                              : "bg-slate-50 hover:bg-white border-slate-200 hover:border-purple-300"
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
                                : "OP"}
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
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {staff.role}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
                                {staff.specialty} • {staff.pin ? "🔒 Con PIN" : "🔓 Sin PIN"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {isCurrent ? (
                              <span className="px-2.5 py-1 bg-purple-700 text-white rounded-xl text-[10px] font-black flex items-center gap-1 shadow-sm">
                                <Check className="w-3 h-3" /> Activo
                              </span>
                            ) : (
                              <span className="px-3 py-1.5 bg-slate-200 hover:bg-purple-700 hover:text-white rounded-xl text-[10px] font-bold text-slate-700 transition-colors flex items-center gap-1">
                                {staff.pin && <Lock className="w-2.5 h-2.5" />}
                                <span>Entrar</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(staff);
                              }}
                              className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors ml-1"
                              title="Editar datos del funcionario"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

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
                    NOMBRE COMPLETO: <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Dr. Santiago Ramírez, María Paula Restrepo..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">ROL EN EL ALBERGUE:</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      <option value="veterinario">👨‍⚕️ Médico Veterinario</option>
                      <option value="auxiliar">🧑‍🔬 Auxiliar Veterinario</option>
                      <option value="operario">👷 Operario de Albergue</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">PIN PERSONAL (4 DÍGITOS):</label>
                    <input
                      type="password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="Ej: 1234"
                      className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    CORREO ELECTRÓNICO (OPCIONAL):
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@laperla.gov.co o personal"
                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
                  />
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
                    TELÉFONO MÓVIL (OPCIONAL):
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
                    className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-700/25 transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>REGISTRAR E INICIAR SESIÓN</span>
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* Botón de Acceso Exclusivo a Panel de Administración (Dirección) */}
        <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenAdminDashboard) onOpenAdminDashboard();
            }}
            className="w-full sm:w-auto px-3.5 py-2 bg-slate-900 hover:bg-black text-purple-300 hover:text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-xs"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>🔒 Panel de Administración y Dirección</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium">
            GATERA CBA LA PERLA • 2026
          </span>
        </div>

      </div>
    </div>
  );
};
