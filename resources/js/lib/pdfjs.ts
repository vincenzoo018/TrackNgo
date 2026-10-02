/**
 * PDF.js for the whole app. The legacy build is used on purpose: the modern build of pdfjs-dist 6 relies on
 * very new JavaScript (Map.getOrInsertComputed, Math.sumPrecise) and fails to open any PDF in browsers that
 * lack it (e.g. Chrome 137), which broke both the document viewer and OCR at upload.
 */
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

// Bundled with the app (same-origin) instead of a CDN worker
if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export * from 'pdfjs-dist/legacy/build/pdf.mjs';
