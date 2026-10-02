/**
 * Reads the text of an uploaded document in the browser:
 *  - PDF with a text layer → PDF.js text extraction
 *  - scanned PDF (no text layer) and photos (PNG / JPG) → Tesseract OCR
 *  - Word (.docx) → the paragraphs of the document
 * Tesseract's engine and English language data are served by the app itself, so OCR also works offline.
 */
import tesseractWorkerUrl from 'tesseract.js/dist/worker.min.js?url';
import tesseractCoreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import * as pdfjsLib from '@/lib/pdfjs';

export type OcrProgress = (message: string) => void;

export type OcrKind = 'pdf' | 'image' | 'docx' | 'other';

/** PDF pages read through the text layer */
const MAX_TEXT_PAGES = 30;
/** Scanned pages run through Tesseract (a few seconds each) */
const MAX_SCANNED_PAGES = 5;
/** Below this many characters per page a PDF is treated as scanned */
const MIN_TEXT_CHARS_PER_PAGE = 20;

export function ocrKind(name?: string | null): OcrKind {
    const ext =
        (name || '').split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';

    if (ext === 'pdf') {
        return 'pdf';
    }

    if (['png', 'jpg', 'jpeg'].includes(ext)) {
        return 'image';
    }

    return ext === 'docx' ? 'docx' : 'other';
}

/**
 * English language data (copied from @tesseract.js-data/eng/4.0.0_best_int). Tesseract loads
 * `${langPath}/eng.traineddata.gz` by name, so it lives at a fixed public path rather than a hashed build asset;
 * passing the data in directly is broken in tesseract.js 7 (it initializes with the bytes as the language name).
 */
const TESSDATA_PATH = '/vendor/tesseract';

/** Workers load these by URL, so they must be absolute */
const absolute = (url: string) => new URL(url, window.location.href).href;

async function recognizeImages(
    images: (Blob | HTMLCanvasElement)[],
    onProgress?: OcrProgress,
): Promise<string> {
    const { createWorker } = await import('tesseract.js');
    onProgress?.('Starting the OCR engine...');
    const worker = await createWorker('eng', 1, {
        workerPath: absolute(tesseractWorkerUrl),
        corePath: absolute(tesseractCoreUrl),
        langPath: absolute(TESSDATA_PATH),
    });

    try {
        const texts: string[] = [];

        for (let i = 0; i < images.length; i++) {
            onProgress?.(
                images.length > 1
                    ? `Running OCR on page ${i + 1} of ${images.length}...`
                    : 'Running OCR on the image...',
            );
            const { data } = await worker.recognize(images[i]);
            texts.push(data.text.trim());
        }

        return texts.filter(Boolean).join('\n\n');
    } finally {
        await worker.terminate();
    }
}

async function extractPdf(
    bytes: ArrayBuffer,
    onProgress?: OcrProgress,
): Promise<string> {
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
    const pdf = await loadingTask.promise;

    try {
        const pageCount = Math.min(pdf.numPages, MAX_TEXT_PAGES);
        const pages: string[] = [];

        for (let n = 1; n <= pageCount; n++) {
            onProgress?.(`Reading text, page ${n} of ${pageCount}...`);
            const content = await (await pdf.getPage(n)).getTextContent();
            pages.push(
                content.items
                    .map(
                        (item: any) =>
                            (item.str ?? '') + (item.hasEOL ? '\n' : ' '),
                    )
                    .join('')
                    .trim(),
            );
        }

        const text = pages.join('\n\n').trim();

        if (
            text.replace(/\s/g, '').length >=
            MIN_TEXT_CHARS_PER_PAGE * pageCount
        ) {
            return text;
        }

        // No text layer: a scanned document. Render the first pages and OCR them.
        const canvases: HTMLCanvasElement[] = [];

        for (let n = 1; n <= Math.min(pdf.numPages, MAX_SCANNED_PAGES); n++) {
            onProgress?.(`Preparing scanned page ${n}...`);
            const page = await pdf.getPage(n);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            await page.render({ canvas, viewport }).promise;
            canvases.push(canvas);
        }

        const scanned = await recognizeImages(canvases, onProgress);

        return scanned.length > text.length ? scanned : text;
    } finally {
        loadingTask.destroy();
    }
}

async function extractDocx(blob: Blob): Promise<string> {
    const { renderAsync } = await import('docx-preview');
    const container = document.createElement('div');
    await renderAsync(blob, container, undefined, {
        inWrapper: false,
        ignoreLastRenderedPageBreak: true,
    });

    return Array.from(container.querySelectorAll('p'))
        .map((p) => (p.textContent || '').trim())
        .filter(Boolean)
        .join('\n');
}

/** Text of a document file; '' when nothing readable was found. */
export async function extractDocumentText(
    file: Blob,
    name: string,
    onProgress?: OcrProgress,
): Promise<string> {
    switch (ocrKind(name)) {
        case 'pdf':
            return extractPdf(await file.arrayBuffer(), onProgress);
        case 'image':
            return recognizeImages([file], onProgress);
        case 'docx':
            onProgress?.('Reading the Word document...');

            return extractDocx(file);
        default:
            return '';
    }
}

/** OCR of a single image or canvas (e.g. an area selected on a scanned page). */
export function ocrImage(
    image: Blob | HTMLCanvasElement,
    onProgress?: OcrProgress,
): Promise<string> {
    return recognizeImages([image], onProgress);
}

/** Same as extractDocumentText for a stored file (viewer "Scan Text"). */
export async function extractTextFromUrl(
    url: string,
    onProgress?: OcrProgress,
): Promise<string> {
    const res = await fetch(url, { credentials: 'same-origin' });

    if (!res.ok) {
        throw new Error(
            res.status === 404
                ? 'The file is missing from storage.'
                : `The file could not be downloaded (HTTP ${res.status}).`,
        );
    }

    return extractDocumentText(await res.blob(), url, onProgress);
}

/** Rejects after `ms` so a slow OCR can never block submitting a document */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('OCR timed out')), ms),
        ),
    ]);
}
