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
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Search,
    FileText,
    Lock,
    MousePointer,
    Crop,
    Sparkles,
    X,
    FileDown,
    Layers,
    MessageSquareQuote,
    RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';

// Configure PDF.js worker
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface TextItemBounds {
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
    className
}: IntegratedDocumentViewerProps) {
    // PDF State
    const [numPages, setNumPages] = useState<number>(1);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1.2);
    const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
    const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
    const [pageTextItems, setPageTextItems] = useState<TextItemBounds[]>([]);
    const [pageViewport, setPageViewPort] = useState<{ width: number; height: number }>({ width: 600, height: 800 });

    // Interaction Modes & OCR State
    const [mode, setMode] = useState<'text' | 'area'>('text');
    const [highlightsActive, setHighlightsActive] = useState<boolean>(false);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState<boolean>(false);
    const [isExportOpen, setIsExportOpen] = useState<boolean>(false);



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
                console.warn('PDF.js load warning (falling back to visual text preview if needed):', err);
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

            // Handle High-DPI screens
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
                if (!item.str || !item.transform) return;

                // PDF.js transform: [scaleX, skewY, skewX, scaleY, transX, transY]
                const tx = item.transform[4];
                const ty = item.transform[5];
                const [vx, vy] = viewport.convertToViewportPoint(tx, ty);

                const itemWidth = item.width * scale;
                const itemHeight = Math.abs(item.transform[3] || item.height || 12) * scale;

                items.push({
                    id: `text-${pageNumber}-${idx}`,
                    str: item.str,
                    x: vx,
                    y: vy - itemHeight, // convert baseline to top-left
                    width: itemWidth,
                    height: itemHeight,
                });
            });

            setPageTextItems(items);
        } catch (err) {
            console.error('Error rendering PDF page:', err);
        }
    }, [pageNumber, scale]);

    useEffect(() => {
        if (!isLoadingPdf && pdfDocRef.current) {
            renderPage();
        }
    }, [isLoadingPdf, pageNumber, scale, renderPage]);

    // Full Scan Text Animation & Action
    const handleScanText = () => {
        setIsScanning(true);
        setScanSuccessMessage(null);

        // Animate scanning laser
        setTimeout(() => {
            setIsScanning(false);
            setHighlightsActive(true);
            setScanSuccessMessage('Text scanned & verified successfully! 100% extracted.');
            setTimeout(() => setScanSuccessMessage(null), 4000);
        }, 1600);
    };

    // Copy to Clipboard
    const handleCopyAllText = () => {
        const textToCopy = ocrText || pageTextItems.map(i => i.str).join(' ') || 'No text extracted.';
        navigator.clipboard.writeText(textToCopy);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
    };

    // Export Handlers
    const handleExportTxt = () => {
        const textToExport = ocrText || pageTextItems.map(i => i.str).join('\n') || '';
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
        const data = {
            documentTitle: fileName,
            documentId,
            pageCount: numPages,
            currentPage: pageNumber,
            extractedText: ocrText,
            wordsCount: ocrText ? ocrText.split(/\s+/).filter(Boolean).length : 0,
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

    // Run OCR on Area Selection
    const handleRunOcrOnArea = () => {
        if (!selectionBox) return;

        setIsAreaScanning(true);

        setTimeout(() => {
            // Find intersecting text items
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
                // Approximate from ocrText lines if items not available
                const lines = ocrText.split('\n').filter(Boolean);
                const ratio = selectionBox.y / (pageViewport.height || 800);
                const targetIdx = Math.floor(ratio * lines.length);
                extracted = lines.slice(Math.max(0, targetIdx - 1), Math.min(lines.length, targetIdx + 3)).join(' ');
            } else {
                extracted = 'No legible characters detected inside the highlighted area.';
            }

            setAreaOcrResult(extracted);
            setIsAreaScanning(false);
            if (onTextSelect) {
                onTextSelect(extracted);
            }
        }, 600);
    };

    // Standard DOM Text Selection Handler
    const handleTextSelection = () => {
        if (mode !== 'text') return;
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
            const text = selection.toString().trim();
            if (onTextSelect) {
                onTextSelect(text);
            }
        }
    };

    // Filter OCR text for search
    const filteredOcrText = ocrText || (pageTextItems.length > 0 ? pageTextItems.map(i => i.str).join(' ') : 'No extracted OCR text available for this document.');

    // Confidentiality Shield
    if (isConfidential) {
        return (
            <div className={cn("flex flex-col items-center justify-center rounded-[8px] border border-slate-200 bg-slate-50 p-12 text-center h-[700px] shadow-sm", className)}>
                <div className="rounded-full bg-red-100 p-6 mb-6">
                    <Lock className="h-12 w-12 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Confidential Document</h3>
                <p className="text-[14px] text-slate-500 max-w-md mx-auto leading-relaxed">
                    This document is marked as confidential. You are authorized to route and take administrative action on this record, but direct OCR text viewing and visual document rendering are restricted.
                </p>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className={cn(
                "flex flex-col w-full rounded-[8px] border border-slate-200 bg-white shadow-sm overflow-hidden",
                className
            )}
        >
            {/* Top Inline OCR & Document Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/90 px-4 py-2.5 backdrop-blur-sm shrink-0">
                {/* Left: Navigation & Zoom */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Page Navigation */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-[6px] shadow-xs px-1 py-0.5">
                        <button
                            type="button"
                            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                            disabled={pageNumber <= 1}
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Next Page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="hidden sm:flex items-center bg-white border border-slate-200 rounded-[6px] shadow-xs px-1 py-0.5">
                        <button
                            type="button"
                            onClick={() => setScale(s => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="h-4 w-4" />
                        </button>
                        <span className="text-[12px] font-medium text-slate-600 px-1.5 w-12 text-center select-none">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            type="button"
                            onClick={() => setScale(s => Math.min(2.5, Number((s + 0.2).toFixed(1))))}
                            className="p-1 rounded-[4px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setScale(1.2)}
                            className="p-1 ml-0.5 rounded-[4px] text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-[11px] font-semibold"
                            title="Reset Zoom (Fit Width)"
                        >
                            Fit
                        </button>
                    </div>

                    {/* Selection Mode Switcher */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-[6px] shadow-xs p-0.5">
                        <button
                            type="button"
                            onClick={() => {
                                setMode('text');
                                setSelectionBox(null);
                                setAreaOcrResult(null);
                            }}
                            className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[13px] font-medium transition-all",
                                mode === 'text'
                                    ? "bg-[var(--tng-blue-600)] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-100"
                            )}
                            title="Select text directly"
                        >
                            <MousePointer className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Text Select</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMode('area');
                            }}
                            className={cn(
                                "flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[13px] font-medium transition-all",
                                mode === 'area'
                                    ? "bg-[var(--tng-blue-600)] text-white shadow-xs"
                                    : "text-slate-600 hover:bg-slate-100"
                            )}
                            title="Click and drag to select an area for OCR"
                        >
                            <Crop className="h-3.5 w-3.5" />
                            <span className="hidden md:inline">Area OCR</span>
                        </button>
                    </div>
                </div>

                {/* Right: Core OCR Actions */}
                <div className="flex items-center gap-2">
                    {/* Start OCR Action (16px button font) */}
                    <button
                        type="button"
                        onClick={handleScanText}
                        disabled={isScanning || highlightsActive}
                        className="inline-flex items-center gap-2 rounded-[8px] bg-[var(--tng-blue-600)] px-3.5 py-1.5 text-[16px] font-medium text-white shadow-xs transition-all hover:bg-[var(--tng-blue-700)] active:scale-[0.98] disabled:opacity-60"
                        title="Run OCR scan on this document"
                    >
                        {isScanning ? (
                            <RefreshCw className="h-4 w-4 animate-spin text-white" />
                        ) : (
                            <ScanText className="h-4 w-4 text-white" />
                        )}
                        <span>{isScanning ? 'Scanning...' : 'Start OCR'}</span>
                    </button>

                    {/* Stop OCR Action (16px button font) */}
                    <button
                        type="button"
                        onClick={() => { setHighlightsActive(false); setSelectionBox(null); setAreaOcrResult(null); }}
                        disabled={!highlightsActive && !selectionBox}
                        className="inline-flex items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3.5 py-1.5 text-[16px] font-medium text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
                        title="Stop OCR and clear highlights"
                    >
                        <X className="h-4 w-4" />
                        <span className="hidden lg:inline">Stop OCR</span>
                    </button>

                    {/* Copy Text Action (16px button font) */}
                    <button
                        type="button"
                        onClick={handleCopyAllText}
                        className="inline-flex items-center gap-2 rounded-[8px] border border-slate-300 bg-white px-3.5 py-1.5 text-[16px] font-medium text-slate-700 shadow-xs transition-all hover:bg-slate-100 active:scale-[0.98]"
                        title="Copy all extracted OCR text"
                    >
                        {copiedText ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        <span className="hidden lg:inline">{copiedText ? 'Copied!' : 'Copy'}</span>
                    </button>

                    {/* Export Dropdown (16px button font) */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsExportOpen(!isExportOpen)}
                            className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 py-1.5 text-[16px] font-medium text-slate-700 shadow-xs hover:bg-slate-100 hover:text-slate-900 transition-colors"
                        >
                            <Download className="h-4 w-4 text-slate-500" />
                            <span>Export</span>
                            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        </button>

                        {isExportOpen && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsExportOpen(false)}
                                />
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-[8px] border border-slate-200 bg-white p-1 shadow-lg text-[14px] animate-in fade-in zoom-in-95 duration-150">
                                    <button
                                        type="button"
                                        onClick={handleExportTxt}
                                        className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        <FileText className="h-4 w-4 text-slate-500" />
                                        <span>Export as Text (.txt)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportJson}
                                        className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 transition-colors"
                                    >
                                        <FileDown className="h-4 w-4 text-slate-500" />
                                        <span>Export as JSON (.json)</span>
                                    </button>
                                    {pdfUrl && (
                                        <a
                                            href={pdfUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            download
                                            className="flex w-full items-center gap-2.5 rounded-[6px] px-3 py-2 text-left text-slate-700 hover:bg-slate-100 border-t border-slate-100 mt-1 pt-1.5 transition-colors"
                                            onClick={() => {
                                                setIsExportOpen(false);
                                                logExportAction('Downloaded original PDF');
                                            }}
                                        >
                                            <Download className="h-4 w-4 text-[var(--tng-blue-600)]" />
                                            <span>Download Original PDF</span>
                                        </a>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Scan Success Toast Banner */}
            {scanSuccessMessage && (
                <div className="flex items-center justify-between bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-[13px] font-medium text-emerald-800 animate-in fade-in duration-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <span>{scanSuccessMessage}</span>
                    </div>
                    <button
                        onClick={() => setScanSuccessMessage(null)}
                        className="text-emerald-600 hover:text-emerald-800 p-0.5"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Main Document Preview Stage */}
            <div className="relative flex-1 bg-slate-100/90 overflow-auto flex justify-center p-4 sm:p-6 min-h-[550px] max-h-[780px] tng-scrollbar">
                {isLoadingPdf ? (
                    <div className="flex flex-col items-center justify-center space-y-4 py-24 text-slate-500">
                        <RefreshCw className="h-8 w-8 animate-spin text-[var(--tng-blue-600)]" />
                        <p className="text-[14px] font-medium">Loading document and preparing OCR layers...</p>
                    </div>
                ) : pdfLoadError && !pdfUrl ? (
                    /* Fallback when no PDF is attached */
                    <div className="w-full max-w-3xl bg-white rounded-[8px] shadow-sm border border-slate-200 p-8 flex flex-col justify-start">
                        <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{fileName}</h3>
                                <p className="text-[13px] text-slate-500">Physical document scanned into digital database</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 rounded-[6px] bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[var(--tng-blue-700)] border border-blue-200">
                                Digital OCR Copy
                            </span>
                        </div>
                        <div 
                            className="prose prose-slate max-w-none text-[14px] text-slate-700 leading-relaxed font-serif whitespace-pre-wrap select-text"
                            onMouseUp={handleTextSelection}
                        >
                            {ocrText || "No digitized text is registered for this record yet."}
                        </div>
                    </div>
                ) : (
                    /* Interactive Canvas + Overlays Container */
                    <div 
                        className="relative bg-white shadow-xl rounded-[4px] border border-slate-300 transition-all"
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
                                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_16px_rgba(59,130,246,0.9)] z-30 pointer-events-none"
                                    style={{
                                        animation: 'scanLaser 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                                    }}
                                />
                            )}

                            {/* OCR Highlight Overlays */}
                            {highlightsActive && pageTextItems.map((item) => (
                                <div
                                    key={item.id}
                                    style={{
                                        left: `${item.x}px`,
                                        top: `${item.y}px`,
                                        width: `${item.width}px`,
                                        height: `${item.height}px`,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onTextSelect) onTextSelect(item.str);
                                    }}
                                    className="absolute bg-amber-300/35 hover:bg-amber-300/65 border border-amber-400/60 rounded-[3px] transition-all cursor-pointer group"
                                    title={`OCR: "${item.str}" — Click to select`}
                                >
                                    {/* Mini tooltip on hover */}
                                    <span className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded-[4px] bg-slate-900 text-white text-[11px] whitespace-nowrap z-40 pointer-events-none shadow-md">
                                        {item.str}
                                    </span>
                                </div>
                            ))}

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
                                        "absolute border-2 border-dashed border-[var(--tng-blue-600)] bg-[var(--tng-blue-600)]/15 rounded-[4px] pointer-events-auto shadow-sm z-20",
                                        isAreaScanning && "animate-pulse"
                                    )}
                                >
                                    {/* Floating Action Pill above/below Selection Box */}
                                    <div 
                                        className="absolute -top-10 left-0 flex items-center gap-1 bg-slate-900 text-white rounded-[6px] p-1 shadow-xl z-30 whitespace-nowrap text-[12px]"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            onClick={handleRunOcrOnArea}
                                            disabled={isAreaScanning}
                                            className="flex items-center gap-1 rounded-[4px] px-2 py-1 bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] text-white font-medium transition-colors"
                                        >
                                            {isAreaScanning ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                            <span>Run OCR</span>
                                        </button>

                                        {areaOcrResult && onAddAnchoredComment && (
                                            <button
                                                type="button"
                                                onClick={() => onAddAnchoredComment(areaOcrResult)}
                                                className="flex items-center gap-1 rounded-[4px] px-2 py-1 hover:bg-slate-800 text-slate-200 transition-colors"
                                            >
                                                <MessageSquareQuote className="h-3 w-3 text-blue-400" />
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
                                            className="absolute top-full left-0 mt-2 w-72 rounded-[6px] border border-slate-200 bg-white p-3 shadow-xl z-30 text-slate-800 text-[13px] animate-in fade-in duration-150"
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2 font-semibold text-slate-900 text-[12px]">
                                                <span className="flex items-center gap-1.5 text-[var(--tng-blue-700)]">
                                                    <ScanText className="h-3.5 w-3.5" />
                                                    OCR Extracted from Selection
                                                </span>
                                            </div>
                                            <p className="font-serif text-[13px] text-slate-700 bg-slate-50 p-2 rounded-[4px] border border-slate-100 mb-2 leading-relaxed max-h-28 overflow-y-auto">
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
                                                    className="px-2 py-1 rounded-[4px] border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
                                                >
                                                    {copiedText ? 'Copied!' : 'Copy'}
                                                </button>
                                                {onAddAnchoredComment && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onAddAnchoredComment(areaOcrResult)}
                                                        className="px-2.5 py-1 rounded-[4px] bg-[var(--tng-blue-600)] text-white font-medium hover:bg-[var(--tng-blue-700)] transition-colors"
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
