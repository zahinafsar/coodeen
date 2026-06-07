export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function captureTabFrame(): Promise<ImageBitmap> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "browser" },
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);

  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  await video.play();

  await new Promise((r) => requestAnimationFrame(r));

  const bitmap = await createImageBitmap(video);
  stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  return bitmap;
}

export function cropToDataUrl(bitmap: ImageBitmap, rect: CropRect): string {
  const scaleX = bitmap.width / window.innerWidth;
  const scaleY = bitmap.height / window.innerHeight;

  const srcX = rect.x * scaleX;
  const srcY = rect.y * scaleY;
  const srcW = rect.width * scaleX;
  const srcH = rect.height * scaleY;

  const canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
  return canvas.toDataURL("image/png");
}
