export interface RenderedPdfImage {
  blob: Blob;
  filename: string;
}

const SCALE = 2;

/** Render every local PDF page to a crisp PNG without a network request. */
export async function renderPdfPagesToImages(
  pdfBlob: Blob,
  filename: string,
): Promise<RenderedPdfImage[]> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await pdfBlob.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });

  try {
    const pdf = await loadingTask.promise;
    const base = filename.replace(/\.pdf$/i, "");
    const images: RenderedPdfImage[] = [];

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: SCALE });
        const canvas = window.document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("ছবি তৈরির canvas পাওয়া যায়নি");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport }).promise;
        const blob = await canvasToBlob(canvas);
        images.push({
          blob,
          filename: `${base}-page-${pageNumber}.png`,
        });
        page.cleanup();
        canvas.width = 0;
        canvas.height = 0;
      }

      return images;
    } finally {
      await pdf.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("ছবি তৈরি করা যায়নি"))),
      "image/png",
    );
  });
}
