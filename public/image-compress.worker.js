/// <reference lib="webworker" />

interface WorkerInput {
  imageBitmap: ImageBitmap;
  width: number;
  height: number;
  maxBytes: number;
}

interface WorkerOutput {
  base64Data: string;
  width: number;
  height: number;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { imageBitmap, width, height, maxBytes } = e.data;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    (self as unknown as Worker).postMessage({ error: "Canvas not supported" });
    return;
  }
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  let quality = 0.92;
  let blob = canvas.convertToBlobSync({ type: "image/jpeg", quality });
  let resultBytes = blob.size;

  while (resultBytes > maxBytes && quality > 0.3) {
    quality -= 0.1;
    blob = canvas.convertToBlobSync({ type: "image/jpeg", quality });
    resultBytes = blob.size;
  }

  // Convert blob to base64 via FileReaderSync (available in workers)
  const reader = new FileReaderSync();
  const dataUrl = reader.readAsDataURL(blob);
  const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");

  (self as unknown as Worker).postMessage({ base64Data, width, height } as WorkerOutput);
};
