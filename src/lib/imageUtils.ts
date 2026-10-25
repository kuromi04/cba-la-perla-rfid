/**
 * Utilidades de Procesamiento y Compresión de Imágenes para el Sistema CBA La Perla
 * Permite capturar fotos con la cámara del celular o seleccionar de la galería,
 * comprimiéndolas a JPEG optimizado en base64 para almacenamiento offline en IndexedDB
 * y sincronización instantánea con Supabase.
 */

export async function compressImageFile(
  file: File,
  maxDimension = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("El archivo seleccionado no es una imagen válida"));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Error al leer el archivo de imagen"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Error al procesar la imagen"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("No se pudo inicializar el procesador de imagen (Canvas 2D)"));
          return;
        }

        // Fondo blanco para imágenes transparentes (PNGs)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime un Canvas o imagen capturada en vivo por la cámara a JPEG optimizado en base64
 */
export function compressCanvasToBase64(
  sourceCanvas: HTMLCanvasElement,
  maxDimension = 800,
  quality = 0.75
): string {
  let width = sourceCanvas.width;
  let height = sourceCanvas.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sourceCanvas.toDataURL("image/jpeg", quality);

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}
