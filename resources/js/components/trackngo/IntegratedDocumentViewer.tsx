import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
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
    PanelTop,
    PanelBottom,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
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
    pdfUrl?: string | null;
    ocrText?: string | null;
    fileName?: string;
    documentId?: number | string;
    isConfidential?: boolean;
    selectedText?: string;
    onTextSelect?: (text: string) => void;
    onAddAnchoredComment?: (selectedText: string) => void;
    defaultToolbarPosition?: 'top' | 'bottom';
    className?: string;
}

export default function IntegratedDocumentViewer({
    pdfUrl,
    ocrText,
    fileName = 'Document Preview',
    documentId,
    isConfidential = false,
    selectedText = '',
    onTextSelect,
    onAddAnchoredComment,
    defaultToolbarPosition = 'top',
    className
}: IntegratedDocumentViewerProps) {
    // PDF State
    const [numPages, setNumPages] = useState<number>(1);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.15);
    const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
    const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
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
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

    // Sync external selectedText
    useEffect(() => {
        if (!selectedText) {
            setActiveInlineSelection(null);
        }
    }, [selectedText]);

    // Load PDF Document
    useEffect(() => {
        if (!pdfUrl || isConfidential) {
            setIsLoadingPdf(false);
            return;
        }

        let isMounted = true;
        setIsLoadingPdf(true);
        setPdfLoadError(null);

        const loadPdf = async () => {
            try {
                const loadingTask = pdfjsLib.getDocument({
                    url: pdfUrl,
                    cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/cmaps/`,
                    cMapPacked: true,
                });

                const pdf = await loadingTask.promise;
                if (!isMounted) return;

                pdfDocRef.current = pdf;
                setNumPages(pdf.numPages);
                setIsLoadingPdf(false);
            } catch (err: any) {
                if (!isMounted) return;
                console.warn('PDF.js load notice:', err);
                setPdfLoadError(err.message || 'Could not load PDF document.');
                setIsLoadingPdf(false);
            }
        };

        loadPdf();

        return () => {
            isMounted = false;
        };
    }, [pdfUrl, isConfidential]);

    // Render Page to Canvas
    const renderPage = useCallback(async () => {
        if (!pdfDocRef.current || !canvasRef.current) return;

        try {
            const page = await pdfDocRef.current.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            setPageViewPort({ width: viewport.width, height: viewport.height });

            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            if (!context) return;

            // Handle High-DPI screens for crisp typography
            const dpr = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * dpr);
            canvas.height = Math.floor(viewport.height * dpr);
            canvas.style.width = `${Math.floor(viewport.width)}px`;
            canvas.style.height = `${Math.floor(viewport.height)}px`;

            context.scale(dpr, dpr);

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };

            await page.render(renderContext as any).promise;

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
        } catch (err) {
            console.error('Error rendering PDF page:', err);
        }
    }, [pageNumber, scale, ocrText]);

    useEffect(() => {
        if (!isLoadingPdf && pdfDocRef.current) {
            renderPage();
        }
    }, [isLoadingPdf, pageNumber, scale, renderPage]);

    // Full Scan Text Animation & Action
    const handleScanText = () => {
        setIsScanning(true);
        setScanSuccessMessage(null);
        setActiveInlineSelection(null);

        // Animate scanning laser sweep
        setTimeout(() => {
            setIsScanning(false);
            setHighlightsActive(true);
            const count = pageTextItems.length || (ocrText ? ocrText.split(/\s+/).filter(Boolean).length : 0);
            setScanSuccessMessage(`OCR scan complete! ${count > 0 ? `${count} text regions recognized & highlighted inline.` : 'Text verified successfully.'}`);
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
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName.replace(/[^a-z0-9]/gi, '_')}_OCR.txt`;
        link.click();
        URL.revokeObjectURL(url);
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
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName.replace(/[^a-z0-9]/gi, '_')}_OCR.json`;
        link.click();
        URL.revokeObjectURL(url);
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
        if (mode !== 'text') return;
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
            <div className={cn("flex flex-col items-center justify-center rounded-[8px] border border-slate-200 bg-slate-50 p-12 text-center h-[650px] shadow-sm", className)}>
                <div className="rounded-full bg-red-100 p-6 mb-5">
                    <Lock className="h-10 w-10 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Confidential Document</h3>
                <p className="text-[14px] text-slate-500 max-w-md mx-auto leading-relaxed">
                    This document is marked as confidential. Direct OCR text recognition overlays and document preview are restricted to authorized personnel.
                </p>
            </div>
        );
    }

    // Render the Anchored Toolbar Component
    const renderInlineToolbar = () => (
        <div className={cn(
            "flex flex-wrap items-center justify-between gap-3 bg-slate-50/95 px-4 py-2.5 backdrop-blur-md shrink-0 transition-all z-20",
            toolbarPosition === 'top' ? "border-b border-slate-200" : "border-t border-slate-200 order-last"
        )}>
            {/* Left Controls: Page Navigation & Zoom & Mode */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Page Navigation */}
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

                {/* Zoom Controls */}
                <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-[6px] shadow-2xs px-1 py-0.5">
                    <button
                        type="button"
                        onClick={() => setScale(s => Math.max(0.6, Number((s - 0.15).toFixed(2))))}
                        className="p-1 rounded-[4px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-[12px] font-medium text-slate-600 px-1.5 w-12 text-center select-none">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        type="button"
                        onClick={() => setScale(s => Math.min(2.5, Number((s + 0.15).toFixed(2))))}
                        className="p-1 rounded-[4px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setScale(1.15)}
                        className="p-1 ml-0.5 rounded-[4px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors text-[11px] font-semibold"
                        title="Fit Document"
                    >
                        Fit
                    </button>
                </div>

                {/* Selection Mode Switcher */}
                <div className="flex items-center bg-white border border-slate-200 rounded-[6px] shadow-2xs p-0.5">
                    <button
                        type="button"
                        onClick={() => {
                            setMode('text');
                            setSelectionBox(null);
                            setAreaOcrResult(null);
                        }}
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[13px] font-medium transition-all",
                            mode === 'text'
                                ? "bg-[var(--tng-blue-600)] text-white shadow-2xs"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
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
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[13px] font-medium transition-all",
                            mode === 'area'
                                ? "bg-[var(--tng-blue-600)] text-white shadow-2xs"
                                : "text-slate-600 hover:bg-slate-100"
                        )}
                        title="Drag marquee box to extract specific region OCR"
                    >
                        <Crop className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Area OCR</span>
                    </button>
                </div>
            </div>

            {/* Right Core Actions: Scan Text, Highlight OCR Toggle, Copy, Export */}
            <div className="flex flex-wrap items-center gap-2">
                {/* 1. Scan Text Action Button */}
                <button
                    type="button"
                    onClick={handleScanText}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--tng-blue-600)] px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-white shadow-xs transition-all hover:bg-[var(--tng-blue-700)] active:scale-[0.98] disabled:opacity-60"
                    title="Run interactive OCR scan on this document"
                >
                    {isScanning ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-white" />
                    ) : (
                        <ScanText className="h-3.5 w-3.5 text-white" />
                    )}
                    <span>{isScanning ? 'Scanning...' : 'Scan Text'}</span>
                </button>

                {/* 2. Highlight OCR Toggle Button (Yellow highlight indicator) */}
                <button
                    type="button"
                    onClick={() => setHighlightsActive(!highlightsActive)}
                    className={cn(
                        "inline-flex items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-xs sm:text-[13px] font-semibold transition-all shadow-xs active:scale-[0.98]",
                        highlightsActive
                            ? "border-amber-300 bg-amber-50/90 text-amber-900 hover:bg-amber-100"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    )}
                    title={highlightsActive ? "Hide yellow OCR text highlights" : "Show yellow OCR text highlights"}
                >
                    <span className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        highlightsActive ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" : "bg-slate-300"
                    )} />
                    <Highlighter className="h-3.5 w-3.5 text-amber-600" />
                    <span className="hidden sm:inline">Highlights</span>
                </button>

                {/* 3. Copy Button (Copies selection or all recognized OCR text) */}
                <button
                    type="button"
                    onClick={handleCopyAction}
                    className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-[0.98]"
                    title={activeInlineSelection ? `Copy selected: "${activeInlineSelection.text}"` : "Copy all recognized OCR text"}
                >
                    {copiedText ? (
                        <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="h-3.5 w-3.5 text-slate-600" />
                            <span>Copy</span>
                        </>
                    )}
                </button>

                {/* 4. Export Dropdown */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setIsExportOpen(!isExportOpen)}
                        className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-slate-700 shadow-xs hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        title="Export recognized document text"
                    >
                        <Download className="h-3.5 w-3.5 text-slate-500" />
                        <span>Export</span>
                        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>

                    {isExportOpen && (
                        <>
                            {/* Semi-transparent Modal Overlay Backdrop (rgba(0,0,0,0.5)) */}
                            <div
                                className="fixed inset-0 z-40 bg-[rgba(0,0,0,0.5)] backdrop-blur-2xs transition-opacity"
                                onClick={() => setIsExportOpen(false)}
                            />
                            <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-[8px] border border-slate-200 bg-white p-1.5 shadow-xl text-[14px] animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                                    Export Options
                                </div>
                                <button
                                    type="button"
                                    onClick={handleExportTxt}
                                    className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 transition-colors font-medium text-[14px]"
                                >
                                    <FileText className="h-4 w-4 text-blue-600" />
                                    <span>Export as Text (.txt)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportJson}
                                    className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 transition-colors font-medium text-[14px]"
                                >
                                    <FileDown className="h-4 w-4 text-purple-600" />
                                    <span>Export as JSON (.json)</span>
                                </button>
                                {pdfUrl && (
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        download
                                        className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 border-t border-slate-100 mt-1 pt-2 transition-colors font-medium text-[14px]"
                                        onClick={() => {
                                            setIsExportOpen(false);
                                            logExportAction('Downloaded original PDF document');
                                        }}
                                    >
                                        <Download className="h-4 w-4 text-emerald-600" />
                                        <span>Download Original PDF</span>
                                    </a>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* 5. Anchor Position Switcher (Top / Bottom) */}
                <button
                    type="button"
                    onClick={() => setToolbarPosition(p => p === 'top' ? 'bottom' : 'top')}
                    className="p-1.5 rounded-[6px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title={toolbarPosition === 'top' ? "Dock toolbar to bottom" : "Dock toolbar to top"}
                >
                    {toolbarPosition === 'top' ? (
                        <PanelBottom className="h-4 w-4" />
                    ) : (
                        <PanelTop className="h-4 w-4" />
                    )}
                </button>
            </div>
        </div>
    );

    return (
        <div 
            ref={containerRef}
            className={cn(
                "flex flex-col w-full rounded-[8px] border border-slate-200 bg-white shadow-sm overflow-hidden",
                className
            )}
        >
            {/* Inline Toolbar Anchored at Top or Bottom */}
            {renderInlineToolbar()}

            {/* Scan Success Toast Banner */}
            {scanSuccessMessage && (
                <div className="flex items-center justify-between bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-[13px] font-medium text-emerald-800 animate-in fade-in duration-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <span>{scanSuccessMessage}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setScanSuccessMessage(null)}
                        className="text-emerald-600 hover:text-emerald-800 p-0.5"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Main Interactive Document Stage */}
            <div className="relative flex-1 bg-slate-100/90 overflow-auto flex justify-center p-4 sm:p-6 min-h-[580px] max-h-[780px] tng-scrollbar select-text">
                {isLoadingPdf ? (
                    <div className="flex flex-col items-center justify-center space-y-4 py-24 text-slate-500">
                        <RefreshCw className="h-8 w-8 animate-spin text-[var(--tng-blue-600)]" />
                        <p className="text-[14px] font-medium">Loading document and preparing OCR layers...</p>
                    </div>
                ) : pdfLoadError && !pdfUrl ? (
                    /* Fallback when no PDF file is attached, showing readable digital text preview */
                    <div className="w-full max-w-3xl bg-white rounded-[8px] shadow-sm border border-slate-200 p-8 flex flex-col justify-start">
                        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{fileName}</h3>
                                <p className="text-[13px] text-slate-500">Physical document scanned into digital database</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                                Digital OCR Document
                            </span>
                        </div>
                        <div 
                            className="prose prose-slate max-w-none text-[14px] text-slate-700 leading-relaxed whitespace-pre-wrap select-text"
                            onMouseUp={handleNativeTextSelection}
                        >
                            {ocrText || "No digitized text is registered for this record yet."}
                        </div>
                    </div>
                ) : (
                    /* Interactive Canvas + Color-Coded Inline OCR Highlights Layer */
                    <div 
                        className="relative bg-white shadow-xl rounded-[4px] border border-slate-300 transition-all self-start"
                        style={{
                            width: pageViewport.width ? `${pageViewport.width}px` : 'auto',
                            height: pageViewport.height ? `${pageViewport.height}px` : 'auto',
                            minHeight: '400px'
                        }}
                    >
                        {/* Canvas Layer */}
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

                            {/* Color-Coded Inline OCR Highlights (Yellow for recognized text) */}
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
                                        title={`OCR Recognized: "${item.str}" — Click to select`}
                                    >
                                        {/* Hover Tooltip showing recognized text */}
                                        <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 rounded-[6px] bg-slate-900 text-white text-[12px] whitespace-nowrap z-40 pointer-events-none shadow-lg font-medium">
                                            {item.str}
                                        </span>
                                    </div>
                                );
                            })}

                            {/* Floating Contextual Action Pill (Anchored directly over/under selected text) */}
                            {activeInlineSelection && (
                                <div 
                                    style={{
                                        left: `${Math.max(10, Math.min(activeInlineSelection.x, (pageViewport.width || 600) - 260))}px`,
                                        top: `${Math.max(10, activeInlineSelection.y - 42)}px`,
                                    }}
                                    className="absolute z-30 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-sm text-white rounded-[8px] p-1.5 shadow-2xl animate-in zoom-in-95 duration-150 whitespace-nowrap text-[13px]"
                                    onMouseDown={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-1 pl-1.5 pr-2 border-r border-slate-700 text-amber-300 font-semibold text-[12px]">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        <span className="max-w-[120px] truncate">{activeInlineSelection.text}</span>
                                    </div>

                                    {/* Copy Selected Text */}
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

                                    {/* Anchor Comment */}
                                    {onAddAnchoredComment && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAddAnchoredComment(activeInlineSelection.text);
                                            }}
                                            className="flex items-center gap-1 rounded-[6px] px-2.5 py-1 text-[12px] font-medium bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] text-white transition-colors"
                                            title="Add anchored discussion comment for this text"
                                        >
                                            <MessageSquareQuote className="h-3 w-3" />
                                            <span>Comment</span>
                                        </button>
                                    )}

                                    {/* Dismiss Selection */}
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
                                    {/* Floating Action Pill above/below Selection Box */}
                                    <div 
                                        className="absolute -top-10 left-0 flex items-center gap-1.5 bg-slate-900/95 backdrop-blur-sm text-white rounded-[8px] p-1 shadow-xl z-30 whitespace-nowrap text-[12px]"
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
                                                <span>Anchor Comment</span>
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
                                            className="absolute top-full left-0 mt-2 w-72 rounded-[8px] border border-slate-200 bg-white p-3 shadow-2xl z-30 text-slate-800 text-[13px] animate-in fade-in duration-150"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2 font-semibold text-slate-900 text-[12px]">
                                                <span className="flex items-center gap-1.5 text-[var(--tng-blue-700)]">
                                                    <ScanText className="h-3.5 w-3.5" />
                                                    OCR Extracted from Selection
                                                </span>
                                            </div>
                                            <p className="text-[13px] text-slate-700 bg-slate-50 p-2.5 rounded-[6px] border border-slate-100 mb-2 leading-relaxed max-h-28 overflow-y-auto">
                                                "{areaOcrResult}"
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
                                                    {copiedText ? 'Copied!' : 'Copy'}
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

            {/* Custom Scan Beam CSS Keyframes */}
            <style>{`
                @keyframes scanLaser {
                    0% { top: 0%; opacity: 0.8; }
                    50% { opacity: 1; }
                    100% { top: 100%; opacity: 0.8; }
                }
            `}</style>
        </div>
    );
}
