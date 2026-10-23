"use client";
import { useEffect, useRef } from "react";

interface ScannerOptions {
  onScan: (code: string) => void;
  minLength?: number;
  timeThreshold?: number; // ms entre caracteres para detectar ráfaga de escáner HID
}

export const useBarcodeScanner = ({
  onScan,
  minLength = 8,
  timeThreshold = 60,
}: ScannerOptions) => {
  const buffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar si el usuario está activamente editando un textarea o un input que no sea el principal
      const target = event.target as HTMLElement;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      const isSearchOrChip = target && (target.getAttribute("data-chip-scanner") === "true");

      if (isInput && !isSearchOrChip && event.key !== "Enter") {
        return;
      }

      const now = Date.now();
      const char = event.key;

      // Si ha pasado demasiado tiempo entre teclas, limpiar buffer
      if (now - lastKeyTime.current > timeThreshold && buffer.current.length > 0) {
        buffer.current = "";
      }
      lastKeyTime.current = now;

      if (char === "Enter" || char === "Tab") {
        if (buffer.current.length >= minLength) {
          event.preventDefault();
          const cleanCode = buffer.current.trim();
          buffer.current = "";
          onScan(cleanCode);
          return;
        }
        buffer.current = "";
        return;
      }

      // El lector W91A envía caracteres alfanuméricos (decimales ISO 15 dígitos o hex EMID)
      if (char.length === 1 && /^[a-zA-Z0-9]$/.test(char)) {
        buffer.current += char;
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onScan, minLength, timeThreshold]);
};
