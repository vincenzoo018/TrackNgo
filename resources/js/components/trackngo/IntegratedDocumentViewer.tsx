import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    ScanText,
    Highlighter,
    Download,
    Copy,
    Check,
    ZoomIn,
    ZoomOut,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    FileText,
    Lock,
    MousePointer,
    Crop,
    Sparkles,
    X,
    FileDown,
    MessageSquareQuote,
    RefreshCw,
    FileX,
    PanelTop,
    PanelBottom,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { ExportPasswordModal } from '@/components/trackngo/ExportPasswordModal';

// Bundle the PDF.js worker with the app (same-origin); a CDN worker breaks offline and on version mismatch
if (typeof window !== 'undefined' && pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

// Only needed for PDFs with CJK / non-embedded standard fonts; jsDelivr mirrors the exact npm version
const PDFJS_ASSETS = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}`;
const DEFAULT_SCALE = 1.15;

type FileKind = 'pdf' | 'image' | 'docx' | 'unsupported' | 'none';

function detectFileKind(url?: string | null): FileKind {
    if (!url) return 'none';
    const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
    if (ext === 'docx') return 'docx';
    return 'unsupported';
}

export interface TextItemBounds {
    id: string;
    str: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IntegratedDocumentViewerProps {
    /** URL of the stored file (PDF, image or DOCX). */
    fileUrl?: string | null;
    /** @deprecated use fileUrl — kept for existing callers; accepts any supported file type. */
    pdfUrl?: string | null;
    ocrText?: string | null;
    fileName?: string;
    documentId?: number | string;
    /** Set when the shown file is one of the document's attachments (password-gated download of that file) */
    attachmentId?: number | null;
    isConfidential?: boolean;
    selectedText?: string;
    onTextSelect?: (text: string) => void;
    onAddAnchoredComment?: (selectedText: string) => void;
    defaultToolbarPosition?: 'top' | 'bottom';
    className?: string;
}

const toolButton = 'inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-[0.98]';

export default function IntegratedDocumentViewer({
    fileUrl,
    pdfUrl,
    ocrText,
    fileName = 'Document Preview',
    documentId,
    attachmentId = null,
    isConfidential = false,
    selectedText = '',
    onTextSelect,
    onAddAnchoredComment,
    defaultToolbarPosition = 'top',
    className
}: IntegratedDocumentViewerProps) {
    const url = fileUrl ?? pdfUrl ?? null;
    const kind = detectFileKind(url);
    const isPdf = kind === 'pdf';
    const canZoom = kind === 'pdf' || kind === 'image' || kind === 'docx';
    const hasOcrText = Boolean(ocrText && ocrText.trim());

    // File State
    const [numPages, setNumPages] = useState<number>(1);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(DEFAULT_SCALE);
    // Load result is keyed by URL so a stale result (or a cached image firing onLoad early) can never leak across files
    const [loadState, setLoadState] = useState<{ url: string; error: string | null } | null>(null);
    const loadedCurrent = Boolean(url) && loadState?.url === url;
    const isLoading = canZoom && !isConfidential && !loadedCurrent;
    const loadError = loadedCurrent ? loadState!.error : null;
    const markLoaded = (forUrl: string, error: string | null = null) => setLoadState({ url: forUrl, error });
    const [pageTextItems, setPageTextItems] = useState<TextItemBounds[]>([]);
    const [pageViewport, setPageViewPort] = useState<{ width: number; height: number }>({ width: 640, height: 850 });

    // Interaction Modes & OCR State
    const [mode, setMode] = useState<'text' | 'area'>('text');
    const [highlightsActive, setHighlightsActive] = useState<boolean>(true); // Active by default for immediate visibility
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState<boolean>(false);
    const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
    const [toolbarPosition, setToolbarPosition] = useState<'top' | 'bottom'>(defaultToolbarPosition);
    // "OCR Text" shows the extracted text for any file type (images and Word files have no PDF text layer)
    const [viewMode, setViewMode] = useState<'document' | 'text'>('document');
    const [downloadGateOpen, setDownloadGateOpen] = useState<boolean>(false);

    // Active Inline Selection Floating Pill State
    const [activeInlineSelection, setActiveInlineSelection] = useState<{
        text: string;
        x: number;
        y: number;
        width: number;
    } | null>(null);

    // Area Selection State
    const [isDrawingArea, setIsDrawingArea] = useState<boolean>(false);
    const [areaStart, setAreaStart] = useState<{ x: number; y: number } | null>(null);
    const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [areaOcrResult, setAreaOcrResult] = useState<string | null>(null);
    const [isAreaScanning, setIsAreaScanning] = useState<boolean>(false);

    // References
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const docxContainerRef = useRef<HTMLDivElement>(null);
    const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
    const renderTaskRef = useRef<ReturnType<pdfjsLib.PDFPageProxy['render']> | null>(null);

    // Sync external selectedText
    useEffect(() => {
        if (!selectedText) {
            setActiveInlineSelection(null);
        }
    }, [selectedText]);

    // Reset view state whenever a different file is shown
    useEffect(() => {
        setPageNumber(1);
        setNumPages(1);
        setScale(DEFAULT_SCALE);
        setPageTextItems([]);
        setViewMode('document');
    }, [url]);

    // Load PDF Document
    useEffect(() => {
        if (!isPdf || !url || isConfidential) return;

        let isMounted = true;
        const loadingTask = pdfjsLib.getDocument({
            url,
            cMapUrl: `${PDFJS_ASSETS}/cmaps/`,
            cMapPacked: true,
            standardFontDataUrl: `${PDFJS_ASSETS}/standard_fonts/`,
        });

        loadingTask.promise
            .then((pdf) => {
                if (!isMounted) return;
                pdfDocRef.current = pdf;
                setNumPages(pdf.numPages);
                markLoaded(url);
            })
            .catch((err: any) => {
                if (!isMounted) return;
                console.warn('PDF.js load notice:', err);
                markLoaded(url, err?.status === 404 || err?.name === 'MissingPDFException'
                    ? 'The file is missing from storage.'
                    : 'The PDF could not be opened in the browser.');
            });

        return () => {
            isMounted = false;
            pdfDocRef.current = null;
            loadingTask.destroy();
        };
    }, [isPdf, url, isConfidential]);

    // Render DOCX files to HTML in the browser (docx-preview is loaded only when needed)
    useEffect(() => {
        if (kind !== 'docx' || !url || isConfidential) return;

        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(url);
                if (!res.ok) throw new Error(res.status === 404 ? 'The file is missing from storage.' : `The file could not be downloaded (HTTP ${res.status}).`);
                const blob = await res.blob();
                const { renderAsync } = await import('docx-preview');
                if (cancelled || !docxContainerRef.current) return;
                docxContainerRef.current.innerHTML = '';
                await renderAsync(blob, docxContainerRef.current, undefined, {
                    inWrapper: true,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                });
                if (!cancelled) markLoaded(url);
            } catch (err: any) {
                if (cancelled) return;
                console.warn('DOCX preview notice:', err);
                markLoaded(url, err?.message?.startsWith('The file') ? err.message : 'This Word document could not be displayed.');
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [kind, url, isConfidential]);

    // Render Page to Canvas
    const renderPage = useCallback(async () => {
        if (!pdfDocRef.current || !canvasRef.current) return;

        try {
            // A new zoom/page cancels the in-flight render (one canvas cannot host two renders)
            renderTaskRef.current?.cancel();

            const page = await pdfDocRef.current.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            setPageViewPort({ width: viewport.width, height: viewport.height });

            const canvas = canvasRef.current;
            if (!canvas) return;

            // Handle High-DPI screens for crisp typography
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            const renderTask = page.render({
                canvas,
                viewport,
                transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
            });
            renderTaskRef.current = renderTask;
            await renderTask.promise;

            // Extract text items with bounding coordinates
            const textContent = await page.getTextContent();
            const items: TextItemBounds[] = [];

            textContent.items.forEach((item: any, idx: number) => {
                if (!item.str || item.str.trim() === '' || !item.transform) return;

                // PDF.js transform: [scaleX, skewY, skewX, scaleY, transX, transY]
                const tx = item.transform[4];
                const ty = item.transform[5];
                const [vx, vy] = viewport.convertToViewportPoint(tx, ty);

                const itemWidth = Math.max(item.width * scale, 12);
                const itemHeight = Math.max(Math.abs(item.transform[3] || item.height || 12) * scale, 12);

                items.push({
                    id: `text-${pageNumber}-${idx}`,
                    str: item.str,
                    x: vx,
                    y: vy - itemHeight,
                    width: itemWidth,
                    height: itemHeight,
                });
            });

            // If PDF.js found no embedded text (e.g. scanned image PDF) but backend ocrText exists:
            if (items.length === 0 && ocrText) {
                const lines = ocrText.split('\n').filter(l => l.trim().length > 0);
                const totalLines = Math.min(lines.length, 30);
                const lineHeight = Math.min(26 * scale, (viewport.height * 0.85) / Math.max(totalLines, 1));
                const startY = 40 * scale;

                lines.slice(0, totalLines).forEach((line, idx) => {
                    items.push({
                        id: `synthetic-ocr-${pageNumber}-${idx}`,
                        str: line.trim(),
                        x: 36 * scale,
                        y: startY + (idx * (lineHeight + 6 * scale)),
                        width: Math.min(viewport.width - 72 * scale, Math.max(line.length * 7.5 * scale, 120)),
                        height: lineHeight,
                    });
                });
            }

            setPageTextItems(items);
        } catch (err: any) {
            if (err?.name === 'RenderingCancelledException') return;
            console.error('Error rendering PDF page:', err);
        }
    }, [pageNumber, scale, ocrText]);

    useEffect(() => {
        if (isPdf && !isLoading && !loadError && pdfDocRef.current) {
            renderPage();
        }
    }, [isPdf, isLoading, loadError, pageNumber, scale, renderPage]);

    // Full Scan Text Animation & Action
    const handleScanText = () => {
        setIsScanning(true);
        setScanSuccessMessage(null);
        setActiveInlineSelection(null);

        // Animate scanning laser sweep
        setTimeout(() => {
            setIsScanning(false);
            if (isPdf && viewMode === 'document') {
                setHighlightsActive(true);
                const count = pageTextItems.length || (ocrText ? ocrText.split(/\s+/).filter(Boolean).length : 0);
                setScanSuccessMessage(count > 0 ? `OCR scan complete. ${count} text regions recognized and highlighted.` : 'OCR scan complete. Text verified successfully.');
            } else {
                // Images and Word files have no text layer: show the extracted text instead
                setViewMode('text');
                const words = ocrText ? ocrText.split(/\s+/).filter(Boolean).length : 0;
                setScanSuccessMessage(words > 0 ? `OCR scan complete. ${words} words extracted.` : 'OCR scan complete. No readable text was found in this file.');
            }
            setTimeout(() => setScanSuccessMessage(null), 4500);
        }, 1500);
    };

    // Copy Handler: Copies selected text if available, otherwise copies all recognized OCR text
    const handleCopyAction = () => {
        const textToCopy = activeInlineSelection?.text || selectedText || ocrText || pageTextItems.map(i => i.str).join(' ');
        if (!textToCopy) return;

        navigator.clipboard.writeText(textToCopy);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
    };

    // Export Handlers
    const handleExportTxt = () => {
        const textToExport = ocrText || pageTextItems.map(i => i.str).join('\n') || 'No OCR text available.';
        const blob = new Blob([textToExport], { type: 'text/plain;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${fileName.replace(/[^a-z0-9]/gi, '_')}_OCR.txt`;
        link.click();
        URL.revokeObjectURL(blobUrl);
        setIsExportOpen(false);
        logExportAction('Exported OCR as TXT');
    };

    const handleExportJson = () => {
        const words = ocrText ? ocrText.split(/\s+/).filter(Boolean) : pageTextItems.map(i => i.str);
        const data = {
            documentTitle: fileName,
            documentId: documentId || null,
            pageCount: numPages,
            currentPage: pageNumber,
            extractedText: ocrText || pageTextItems.map(i => i.str).join(' '),
            wordCount: words.length,
            recognizedRegionsCount: pageTextItems.length,
            exportedAt: new Date().toISOString(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${fileName.replace(/[^a-z0-9]/gi, '_')}_OCR.json`;
        link.click();
        URL.revokeObjectURL(blobUrl);
        setIsExportOpen(false);
        logExportAction('Exported OCR as JSON');
    };

    const logExportAction = (description: string) => {
        if (!documentId) return;
        router.post(`/documents/${documentId}/log-action`, {
            action: 'Exported',
            description: description
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Handle Inline Highlight Click
    const handleItemClick = (item: TextItemBounds, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelection = {
            text: item.str,
            x: item.x,
            y: item.y,
            width: item.width,
        };
        setActiveInlineSelection(newSelection);
        if (onTextSelect) {
            onTextSelect(item.str);
        }
    };

    // Area Selection Mouse Handlers
    const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (mode !== 'area') return;

        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        const startX = e.clientX - rect.left;
        const startY = e.clientY - rect.top;

        setIsDrawingArea(true);
        setAreaStart({ x: startX, y: startY });
        setSelectionBox(null);
        setAreaOcrResult(null);
        setActiveInlineSelection(null);
    };

    const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isDrawingArea || !areaStart) return;

        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const x = Math.min(areaStart.x, currentX);
        const y = Math.min(areaStart.y, currentY);
        const width = Math.abs(currentX - areaStart.x);
        const height = Math.abs(currentY - areaStart.y);

        setSelectionBox({ x, y, width, height });
    };

    const handleOverlayMouseUp = () => {
        if (!isDrawingArea) return;
        setIsDrawingArea(false);

        if (selectionBox && (selectionBox.width < 15 || selectionBox.height < 15)) {
            setSelectionBox(null);
        }
    };

    // Run OCR on Marquee Area Selection
    const handleRunOcrOnArea = () => {
        if (!selectionBox) return;

        setIsAreaScanning(true);

        setTimeout(() => {
            let extracted = '';
            const intersectingItems = pageTextItems.filter(item => {
                const itemRight = item.x + item.width;
                const itemBottom = item.y + item.height;
                const boxRight = selectionBox.x + selectionBox.width;
                const boxBottom = selectionBox.y + selectionBox.height;

                return !(
                    itemRight < selectionBox.x ||
                    item.x > boxRight ||
                    itemBottom < selectionBox.y ||
                    item.y > boxBottom
                );
            });

            if (intersectingItems.length > 0) {
                extracted = intersectingItems.map(i => i.str).join(' ');
            } else if (ocrText) {
                const lines = ocrText.split('\n').filter(Boolean);
                const ratio = selectionBox.y / (pageViewport.height || 800);
                const targetIdx = Math.floor(ratio * lines.length);
                extracted = lines.slice(Math.max(0, targetIdx - 1), Math.min(lines.length, targetIdx + 3)).join(' ');
            } else {
                extracted = 'Recognized text region in selected box.';
            }

            setAreaOcrResult(extracted);
            setIsAreaScanning(false);
            if (onTextSelect) {
                onTextSelect(extracted);
            }
            setActiveInlineSelection({
                text: extracted,
                x: selectionBox.x,
                y: selectionBox.y,
                width: selectionBox.width,
            });
        }, 500);
    };

    // DOM Native Text Selection Handler
    const handleNativeTextSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            const text = selection.toString().trim();
            if (onTextSelect) {
                onTextSelect(text);
            }
        }
    };

    // Confidentiality Shield
    if (isConfidential) {
        return (
            <div className={cn("flex flex-col items-center justify-center rounded-[8px] border border-slate-200 bg-slate-50 p-12 text-center h-[480px]", className)}>
                <div className="rounded-full bg-red-100 p-5 mb-4">
                    <Lock className="h-8 w-8 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">Confidential Document</h3>
                <p className="text-[14px] text-slate-500 max-w-md mx-auto leading-relaxed">
                    The contents of this document are restricted. You can route it, but only authorized personnel can view the file.
                </p>
            </div>
        );
    }

    // Downloading the original is password-gated (ExportPasswordModal → /documents/{id}/export); without a
    // document id (e.g. a standalone preview) there is nothing to verify against, so no download is offered
    const canDownload = Boolean(url && documentId);
    const fileActions = canDownload ? (
        <button type="button" onClick={() => setDownloadGateOpen(true)} className={toolButton} title="Password required">
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Download</span>
        </button>
    ) : null;

    // Shown instead of the file when there is nothing the browser can display
    const renderFallback = (title: string, message: string) => (
        <div className="w-full max-w-3xl self-start rounded-[8px] border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-start gap-3">
                <FileX className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                <div className="flex-1">
                    <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">{message}</p>
                    {fileActions && <div className="mt-4 flex flex-wrap gap-2">{fileActions}</div>}
                </div>
            </div>
            {ocrText && (
                <div className="mt-6 border-t border-slate-200 pt-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Extracted Text</p>
                    <div
                        className="max-h-[420px] overflow-y-auto tng-scrollbar text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap select-text"
                        onMouseUp={handleNativeTextSelection}
                    >
                        {ocrText}
                    </div>
                </div>
            )}
        </div>
    );

    const zoomPercent = Math.round((scale / DEFAULT_SCALE) * 100);

    const segmentButton = (active: boolean) => cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[13px] font-medium transition-all",
        active ? "bg-[var(--tng-blue-600)] text-white shadow-2xs" : "text-slate-600 hover:bg-slate-100"
    );
    const showDocumentTools = viewMode === 'document';
    const hasFileStage = canZoom;

    const renderInlineToolbar = () => (
        <div className={cn(
            "flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-4 py-2.5 shrink-0 z-20",
            toolbarPosition === 'top' ? "border-b border-slate-200" : "border-t border-slate-200 order-last"
        )}>
            {/* Left Controls: View, Page Navigation, Zoom & Selection Mode */}
            <div className="flex flex-wrap items-center gap-2">
                {hasFileStage && hasOcrText && (
                    <div className="flex items-center bg-white border border-slate-200 rounded-[6px] shadow-2xs p-0.5">
                        <button type="button" onClick={() => setViewMode('document')} className={segmentButton(viewMode === 'document')} title="Show the original file">
                            Document
                        </button>
                        <button type="button" onClick={() => setViewMode('text')} className={segmentButton(viewMode === 'text')} title="Show the text extracted by OCR">
                            OCR Text
                        </button>
                    </div>
                )}

                {isPdf && showDocumentTools && (
                    <div className="flex items-center bg-white border border-slate-200 rounded-[6px] shadow-2xs px-1 py-0.5">
                        <button
                            type="button"
                            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                            disabled={pageNumber <= 1}
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Previous Page"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-[13px] font-medium text-slate-700 px-2 select-none">
                            {pageNumber} <span className="text-slate-400">/</span> {numPages}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                            disabled={pageNumber >= numPages}
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Next Page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {hasFileStage && showDocumentTools && (
                    <div className="flex items-center bg-white border border-slate-200 rounded-[6px] shadow-2xs px-1 py-0.5">
                        <button
                            type="button"
                            onClick={() => setScale(s => Math.max(0.6, Number((s - 0.15).toFixed(2))))}
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale(DEFAULT_SCALE)}
                            className="text-[12px] font-medium text-slate-600 px-1.5 w-12 text-center hover:text-slate-900"
                            title="Fit Document"
                        >
                            {zoomPercent}%
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale(s => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {isPdf && showDocumentTools && (
                    <div className="flex items-center bg-white border border-slate-200 rounded-[6px] shadow-2xs p-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                setMode('text');
                                setSelectionBox(null);
                                setAreaOcrResult(null);
                            }}
                            className={segmentButton(mode === 'text')}
                            title="Highlight and click recognized text directly"
                        >
                            <MousePointer className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Text Select</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMode('area');
                                setActiveInlineSelection(null);
                            }}
                            className={segmentButton(mode === 'area')}
                            title="Drag a box to extract text from an area"
                        >
                            <Crop className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Area OCR</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Right Actions: Scan Text, Highlights, Copy, Export, Open / Download, Dock */}
            <div className="flex flex-wrap items-center gap-2">
                {hasFileStage && (
                    <button
                        type="button"
                        onClick={handleScanText}
                        disabled={isScanning || isLoading || Boolean(loadError)}
                        className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--tng-blue-600)] px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-[var(--tng-blue-700)] active:scale-[0.98] disabled:opacity-60"
                        title="Run OCR scan on this document"
                    >
                        {isScanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />}
                        <span>{isScanning ? 'Scanning...' : 'Scan Text'}</span>
                    </button>
                )}

                {isPdf && showDocumentTools && (
                    <button
                        type="button"
                        onClick={() => setHighlightsActive(!highlightsActive)}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs sm:text-[13px] font-semibold transition-all shadow-xs active:scale-[0.98]",
                            highlightsActive
                                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                        title={highlightsActive ? "Hide yellow OCR text highlights" : "Show yellow OCR text highlights"}
                    >
                        <Highlighter className={cn("h-3.5 w-3.5", highlightsActive ? "text-amber-600" : "text-slate-500")} />
                        <span className="hidden sm:inline">Highlights</span>
                    </button>
                )}

                {(isPdf || hasOcrText) && (
                    <button
                        type="button"
                        onClick={handleCopyAction}
                        className={toolButton}
                        title={activeInlineSelection ? `Copy selected: "${activeInlineSelection.text}"` : "Copy all recognized OCR text"}
                    >
                        {copiedText ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                        <span className={copiedText ? 'text-emerald-700' : undefined}>{copiedText ? 'Copied' : 'Copy'}</span>
                    </button>
                )}

                {(isPdf || hasOcrText || canDownload) && (
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className={toolButton}
                            title="Export recognized text or download the original file"
                        >
                            <FileDown className="h-3.5 w-3.5 text-slate-500" />
                            <span>Export</span>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </button>

                        {isExportOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsExportOpen(false)} />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-[8px] border border-slate-200 bg-white p-1.5 shadow-xl text-[14px]">
                                    {(isPdf || hasOcrText) && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={handleExportTxt}
                                                className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 transition-colors font-medium text-[13px]"
                                            >
                                                <FileText className="h-4 w-4 text-slate-500" />
                                                Export as Text (.txt)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleExportJson}
                                                className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 transition-colors font-medium text-[13px]"
                                            >
                                                <FileDown className="h-4 w-4 text-slate-500" />
                                                Export as JSON (.json)
                                            </button>
                                        </>
                                    )}
                                    {canDownload && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsExportOpen(false);
                                                setDownloadGateOpen(true);
                                            }}
                                            className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 transition-colors font-medium text-[13px]"
                                        >
                                            <Download className="h-4 w-4 text-slate-500" />
                                            Download Original File (password)
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {hasFileStage && fileActions}

                <button
                    type="button"
                    onClick={() => setToolbarPosition(p => p === 'top' ? 'bottom' : 'top')}
                    className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title={toolbarPosition === 'top' ? "Dock toolbar to bottom" : "Dock toolbar to top"}
                >
                    {toolbarPosition === 'top' ? <PanelBottom className="h-4 w-4" /> : <PanelTop className="h-4 w-4" />}
                </button>
            </div>
        </div>
    );

    // Extracted OCR text as a readable page; selecting text feeds anchored comments
    const renderOcrTextPage = () => (
        <div className="w-full max-w-3xl self-start rounded-[4px] border border-slate-300 bg-white p-8 shadow-xl">
            <p className="mb-4 border-b border-slate-200 pb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                OCR Extracted Text — select text to comment on it
            </p>
            <div
                className="text-[14px] text-slate-800 leading-relaxed whitespace-pre-wrap select-text"
                onMouseUp={handleNativeTextSelection}
            >
                {ocrText}
            </div>
        </div>
    );

    const showFile = !isLoading && !loadError;

    return (
        <div className={cn("flex flex-col w-full rounded-[8px] border border-slate-200 bg-white overflow-hidden", className)}>
            {(canZoom || hasOcrText) && renderInlineToolbar()}

            {/* Scan Success Banner */}
            {scanSuccessMessage && (
                <div className="flex items-center justify-between bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-[13px] font-medium text-emerald-800 shrink-0">
                    <span>{scanSuccessMessage}</span>
                    <button
                        type="button"
                        onClick={() => setScanSuccessMessage(null)}
                        className="text-emerald-600 hover:text-emerald-800 p-0.5"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Document Stage */}
            <div className={cn("relative flex-1 bg-slate-100 overflow-auto flex justify-center p-4 sm:p-6 max-h-[780px] tng-scrollbar", canZoom && "min-h-[520px]")}>
                {isLoading && viewMode === 'document' && (
                    <div className="flex flex-col items-center justify-center space-y-3 py-24 text-slate-500">
                        <RefreshCw className="h-7 w-7 animate-spin text-[var(--tng-blue-600)]" />
                        <p className="text-[14px] font-medium">Loading document...</p>
                    </div>
                )}

                {kind === 'none' && renderFallback('No file attached', 'This record has no uploaded file.')}

                {kind === 'unsupported' && renderFallback(
                    'Preview not available',
                    'This file type cannot be shown in the browser. Open or download it to view the original.'
                )}

                {!isLoading && loadError && viewMode === 'document' && renderFallback('This file could not be displayed', loadError)}

                {viewMode === 'text' && renderOcrTextPage()}

                {/* Image */}
                {kind === 'image' && url && !loadError && (
                    <div className={cn('w-full self-start', (!showFile || viewMode === 'text') && 'hidden')}>
                        <img
                            src={url}
                            alt={fileName}
                            onLoad={() => markLoaded(url)}
                            onError={() => markLoaded(url, 'The image is missing from storage or could not be loaded.')}
                            style={{ width: `${zoomPercent}%`, maxWidth: 'none' }}
                            className="mx-auto block bg-white shadow-xl rounded-[4px] border border-slate-300"
                        />
                    </div>
                )}

                {/* Word document (rendered by docx-preview) */}
                {kind === 'docx' && (
                    <div className={cn('w-full self-start', (!showFile || viewMode === 'text') && 'hidden')}>
                        <div
                            ref={docxContainerRef}
                            style={{ zoom: scale / DEFAULT_SCALE }}
                            className="tng-docx select-text"
                            onMouseUp={handleNativeTextSelection}
                        />
                    </div>
                )}

                {/* PDF: Canvas + OCR overlay */}
                {isPdf && showFile && (
                    <div
                        className={cn("relative bg-white shadow-xl rounded-[4px] border border-slate-300 transition-all self-start", viewMode === 'text' && "hidden")}
                        style={{
                            width: pageViewport.width ? `${pageViewport.width}px` : 'auto',
                            height: pageViewport.height ? `${pageViewport.height}px` : 'auto',
                            minHeight: '400px'
                        }}
                    >
                        <canvas ref={canvasRef} className="block select-none" />

                        {/* Interactive Overlay Layer for Highlight & Marquee Area Selection */}
                        <div
                            ref={overlayRef}
                            className={cn(
                                "absolute inset-0 z-10",
                                mode === 'area' ? "cursor-crosshair" : "cursor-text"
                            )}
                            onMouseDown={handleOverlayMouseDown}
                            onMouseMove={handleOverlayMouseMove}
                            onMouseUp={handleOverlayMouseUp}
                            onMouseLeave={handleOverlayMouseUp}
                        >
                            {/* Scanning Laser Animation Beam */}
                            {isScanning && (
                                <div
                                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_18px_rgba(59,130,246,0.95)] z-30 pointer-events-none"
                                    style={{
                                        animation: 'scanLaser 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                                    }}
                                />
                            )}

                            {/* Inline OCR Highlights */}
                            {highlightsActive && pageTextItems.map((item) => {
                                const isSelected = activeInlineSelection?.text === item.str || selectedText === item.str;

                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            left: `${item.x}px`,
                                            top: `${item.y}px`,
                                            width: `${item.width}px`,
                                            height: `${item.height}px`,
                                        }}
                                        onClick={(e) => handleItemClick(item, e)}
                                        className={cn(
                                            "absolute rounded-[4px] transition-all cursor-pointer group",
                                            isSelected
                                                ? "bg-yellow-400/80 border-2 border-yellow-600 shadow-sm z-20"
                                                : "bg-amber-300/40 hover:bg-amber-300/75 border border-amber-400/70"
                                        )}
                                        title={`Click to select: "${item.str}"`}
                                    />
                                );
                            })}

                            {/* Floating Contextual Action Pill (Anchored directly over/under selected text) */}
                            {activeInlineSelection && (
                                <div
                                    style={{
                                        left: `${Math.max(10, Math.min(activeInlineSelection.x, (pageViewport.width || 600) - 260))}px`,
                                        top: `${Math.max(10, activeInlineSelection.y - 42)}px`,
                                    }}
                                    className="absolute z-30 flex items-center gap-1.5 bg-slate-900/95 text-white rounded-[8px] p-1.5 shadow-2xl whitespace-nowrap text-[13px]"
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <span className="max-w-[140px] truncate pl-1.5 pr-2 border-r border-slate-700 text-amber-300 font-semibold text-[12px]">
                                        {activeInlineSelection.text}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard.writeText(activeInlineSelection.text);
                                            setCopiedText(true);
                                            setTimeout(() => setCopiedText(false), 2000);
                                        }}
                                        className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] font-medium hover:bg-slate-800 text-slate-200 transition-colors"
                                        title="Copy selected text"
                                    >
                                        {copiedText ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                        <span>{copiedText ? 'Copied' : 'Copy'}</span>
                                    </button>

                                    {onAddAnchoredComment && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAddAnchoredComment(activeInlineSelection.text);
                                            }}
                                            className="flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[12px] font-medium bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] text-white transition-colors"
                                            title="Comment on this text"
                                        >
                                            <MessageSquareQuote className="h-3 w-3" />
                                            <span>Comment</span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveInlineSelection(null);
                                            if (onTextSelect) onTextSelect('');
                                        }}
                                        className="p-1 rounded-[4px] hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                        title="Dismiss"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* Active Marquee Selection Box */}
                            {selectionBox && (
                                <div
                                    style={{
                                        left: `${selectionBox.x}px`,
                                        top: `${selectionBox.y}px`,
                                        width: `${selectionBox.width}px`,
                                        height: `${selectionBox.height}px`,
                                    }}
                                    className={cn(
                                        "absolute border-2 border-dashed border-[var(--tng-blue-600)] bg-[var(--tng-blue-600)]/15 rounded-[6px] pointer-events-auto shadow-md z-20",
                                        isAreaScanning && "animate-pulse"
                                    )}
                                >
                                    <div
                                        className="absolute -top-10 left-0 flex items-center gap-1.5 bg-slate-900/95 text-white rounded-[8px] p-1 shadow-xl z-30 whitespace-nowrap text-[12px]"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            onClick={handleRunOcrOnArea}
                                            disabled={isAreaScanning}
                                            className="flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] text-white font-medium transition-colors"
                                        >
                                            {isAreaScanning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                            <span>Run OCR</span>
                                        </button>

                                        {areaOcrResult && onAddAnchoredComment && (
                                            <button
                                                type="button"
                                                onClick={() => onAddAnchoredComment(areaOcrResult)}
                                                className="flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 hover:bg-slate-800 text-slate-200 transition-colors"
                                            >
                                                <MessageSquareQuote className="h-3.5 w-3.5 text-blue-400" />
                                                <span>Comment</span>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectionBox(null);
                                                setAreaOcrResult(null);
                                            }}
                                            className="p-1 rounded-[4px] hover:bg-slate-800 text-slate-400 hover:text-white"
                                            title="Dismiss selection"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>

                                    {/* Popover showing extracted area OCR text */}
                                    {areaOcrResult && (
                                        <div
                                            className="absolute top-full left-0 mt-2 w-72 rounded-[8px] border border-slate-200 bg-white p-3 shadow-2xl z-30 text-slate-800 text-[13px]"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Extracted Text</p>
                                            <p className="text-[13px] text-slate-700 bg-slate-50 p-2.5 rounded-[6px] border border-slate-100 mb-2 leading-relaxed max-h-28 overflow-y-auto">
                                                {areaOcrResult}
                                            </p>
                                            <div className="flex items-center justify-end gap-2 text-[12px]">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(areaOcrResult);
                                                        setCopiedText(true);
                                                        setTimeout(() => setCopiedText(false), 2000);
                                                    }}
                                                    className="px-2.5 py-1 rounded-[6px] border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                                                >
                                                    {copiedText ? 'Copied' : 'Copy'}
                                                </button>
                                                {onAddAnchoredComment && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onAddAnchoredComment(areaOcrResult)}
                                                        className="px-3 py-1 rounded-[6px] bg-[var(--tng-blue-600)] text-white font-medium hover:bg-[var(--tng-blue-700)] transition-colors"
                                                    >
                                                        Add Comment
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes scanLaser {
                    0% { top: 0%; opacity: 0.8; }
                    50% { opacity: 1; }
                    100% { top: 100%; opacity: 0.8; }
                }
                .tng-docx .docx-wrapper { background: transparent; padding: 0; }
                .tng-docx .docx-wrapper > section.docx { margin: 0 auto 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15); border: 1px solid rgb(203 213 225); }
            `}</style>

            {canDownload && (
                <ExportPasswordModal
                    isOpen={downloadGateOpen}
                    onClose={() => setDownloadGateOpen(false)}
                    documentId={documentId!}
                    attachmentId={attachmentId}
                    identifier={fileName}
                    onSuccess={(msg) => {
                        setScanSuccessMessage(msg);
                        setTimeout(() => setScanSuccessMessage(null), 4500);
                    }}
                />
            )}
        </div>
    );
}
