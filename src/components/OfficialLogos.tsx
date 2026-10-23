"use client";
import React from "react";

/**
 * Logotipo Oficial de la Alcaldía de Medellín
 * Utiliza exactamente la imagen oficial cargada por el usuario
 */
export const AlcaldiaMedellinLogo: React.FC<{ className?: string }> = ({ className = "h-8" }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200/40 flex items-center justify-center shrink-0">
      <img
        src="/alcaldia_medellin.png"
        alt="Alcaldía de Medellín - Distrito de Ciencia, Tecnología e Innovación"
        className="h-8 w-auto max-w-[130px] object-contain"
      />
    </div>
  </div>
);

/**
 * Logotipo del Centro de Bienestar Animal La Perla
 * Inspirado directamente en el aviso oficial del albergue (Foto del usuario)
 */
export const LaPerlaLogo: React.FC<{ className?: string }> = ({ className = "h-9" }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-700 shadow-md text-white font-black shrink-0 border border-teal-300/40">
      <span className="text-xl">🐾</span>
    </div>
    <div className="flex flex-col text-left leading-none">
      <span className="font-black text-base tracking-tight text-orange-500 drop-shadow-sm font-sans">
        La Perla
      </span>
      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-0.5">
        Centro de Bienestar Animal
      </span>
    </div>
  </div>
);

/**
 * Crédito y Derechos de Autor Oficiales:
 * © 2026 tiendastelegram by Kuromi04
 */
export const DeveloperCredit: React.FC = () => (
  <footer className="text-center py-4 text-[10px] text-slate-500 select-none border-t border-slate-200/80 mt-6 bg-slate-50/50">
    <div className="flex flex-col items-center justify-center gap-1 font-medium">
      <span className="font-bold text-slate-700">
        © 2026 Desarrollado por <span className="text-indigo-600 font-black">tiendastelegram</span> by <span className="text-pink-600 font-black">Kuromi04</span>
      </span>
      <span className="text-[9px] text-slate-400">
        Software Propietario • Todos los derechos reservados
      </span>
    </div>
  </footer>
);
