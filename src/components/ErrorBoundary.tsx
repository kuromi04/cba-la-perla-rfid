"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an unhandled client error:", error, errorInfo);
  }

  public handleReload = () => {
    // Si la URL tiene parámetros que puedan estar corruptos, recargar a la raíz
    if (typeof window !== "undefined") {
      window.location.href = window.location.origin + window.location.pathname;
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-3xl flex items-center justify-center mb-4 border border-amber-500/40 shadow-lg shadow-amber-500/20">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <h1 className="text-xl font-black mb-2 tracking-tight">
            CBA La Perla • Gatera
          </h1>
          <p className="text-xs text-slate-300 max-w-sm mb-6 leading-relaxed">
            Se detectó una discrepancia al sincronizar la vista del turno. El sistema ha protegido tus datos y registros locales.
          </p>

          {this.state.error?.message && (
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-[11px] font-mono text-amber-300 max-w-xs overflow-x-auto mb-6 text-left">
              {this.state.error.message}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
            <button
              type="button"
              onClick={this.handleRetry}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all text-xs"
            >
              <RefreshCw className="w-4 h-4" /> Reintentar Vista
            </button>

            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3.5 px-4 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 font-bold rounded-2xl flex items-center justify-center gap-2 border border-slate-700 transition-all text-xs"
            >
              <Home className="w-4 h-4" /> Ir al Inicio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
