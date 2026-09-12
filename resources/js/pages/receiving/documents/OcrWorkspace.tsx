import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ScanText, Sparkles } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import IntegratedDocumentViewer from '@/components/trackngo/IntegratedDocumentViewer';
import { useState } from 'react';

interface OcrWorkspaceProps {
    dbDocument?: any;
    documentId?: string | number;
}

export default function OcrWorkspace({ dbDocument, documentId = 1 }: OcrWorkspaceProps) {
    const [selectedOcrText, setSelectedOcrText] = useState('');

    const docTitle = dbDocument?.title || 'Executive Order No. 12';
    const docRef = dbDocument?.reference_number || dbDocument?.tracking_number || 'TNG-2026-0004';
    const pdfPath = dbDocument?.attachment_path ? `/storage/${dbDocument.attachment_path}` : null;
    const ocrContent = dbDocument?.ocr_text || `REPUBLIC OF THE PHILIPPINES
CITY OF MATI

EXECUTIVE ORDER NO. 12
Series of 2026

AN ORDER MANDATING ALL CITY DEPARTMENTS TO ADOPT THE TRACKNGO SYSTEM.

WHEREAS, the City Government of Mati is committed to streamlining its services...
WHEREAS, the Anti-Red Tape Authority (ARTA) requires...

NOW THEREFORE, I, HON. MAYOR of the City of Mati, do hereby order:

Section 1. Implementation. All departments must immediately adopt and utilize TrackNGo for digital document processing.`;

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'My Documents', href: '/receiving/documents' },
                { title: docRef, href: `/receiving/documents/${documentId}` },
                { title: 'Inline OCR Viewer', href: '#' },
            ]}
        >
            <Head title="Integrated OCR Viewer — TrackNGo Mati" />

            <div className="flex flex-col space-y-4">
                {/* Header with Title and Back Link */}
                <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <ScanText className="h-6 w-6 text-[var(--tng-blue-600)]" />
                            Integrated Document OCR Workspace
                        </h1>
                        <p className="mt-1 text-[14px] text-slate-500 flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700">{docRef}</span>
                            <span>•</span>
                            <span>{docTitle}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium text-[12px] bg-emerald-50 px-2 py-0.5 rounded-[4px] border border-emerald-200">
                                <Sparkles className="h-3 w-3 text-emerald-600" />
                                Direct Inline OCR Active
                            </span>
                        </p>
                    </div>
                    <Link
                        href={`/receiving/documents/${documentId}`}
                        className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 shadow-xs"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Document
                    </Link>
                </div>

                {/* Full-width 100% Integrated Document Viewer & OCR Surface (No separate right-side panel) */}
                <div className="w-full rounded-[8px] border border-slate-200 bg-white overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                    <IntegratedDocumentViewer
                        pdfUrl={pdfPath}
                        ocrText={ocrContent}
                        fileName={docTitle}
                        documentId={documentId}
                        selectedText={selectedOcrText}
                        onTextSelect={(text) => setSelectedOcrText(text)}
                        defaultToolbarPosition="top"
                    />
                </div>
            </div>
        </TrackngoLayout>
    );
}
