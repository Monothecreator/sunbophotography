/**
 * Browser-side preview generation, run in the photographer's uploader before
 * anything leaves the machine. The watermarked, downscaled JPEG is the ONLY
 * derivative a guest can ever be served; the original is uploaded to a private
 * bucket and never signed until a paid order covers that photo id.
 */
export async function makeWatermarkedPreview(
  file: File,
  businessName: string,
  maxEdge = 1400,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // Diagonal repeated "SAMPLE" wash
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(-Math.PI / 6);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = Math.round(Math.max(w, h) * 0.06);
  ctx.font = `700 ${size}px Manrope, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.lineWidth = Math.max(1, size / 24);
  const stepX = size * 7;
  const stepY = size * 3.2;
  const span = Math.max(w, h);
  for (let y = -span; y <= span; y += stepY) {
    for (let x = -span; x <= span; x += stepX) {
      ctx.strokeText("SAMPLE", x, y);
      ctx.fillText("SAMPLE", x, y);
    }
  }
  ctx.restore();

  // Studio mark (logo placeholder)
  const markSize = Math.round(Math.max(w, h) * 0.028);
  ctx.font = `600 ${markSize}px Manrope, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillText(businessName || "Aperture&Ember", w - markSize + 1, h - markSize + 1);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(businessName || "Aperture&Ember", w - markSize, h - markSize);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Preview generation failed"))),
      "image/jpeg",
      0.72,
    ),
  );
}
