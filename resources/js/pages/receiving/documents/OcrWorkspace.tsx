import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Lock, ScanText } from 'lucide-react';
import { useState } from 'react';
import IntegratedDocumentViewer from '@/components/trackngo/IntegratedDocumentViewer';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { csrfHeaders } from '@/lib/csrf';

interface OcrWorkspaceProps {
    dbDocument?: any;
    documentId?: string | number;
}

export default function OcrWorkspace({ dbDocument, documentId }: OcrWorkspaceProps) {
    const [selectedOcrText, setSelectedOcrText] = useState('');

    const id = dbDocument?.document_id ?? documentId;
    const docTitle = dbDocument?.title || 'Document';
    const docRef = dbDocument?.reference_number || dbDocument?.tracking_number || `#${id}`;
    const filePath = dbDocument?.attachment_path ? `/storage/${dbDocument.attachment_path}` : null;
    const isHidden = Boolean(dbDocument?.is_confidential_hidden);
    // The universal /documents/{id} route opens the document page of the viewer's own role
    const documentUrl = `/documents/${id}`;

    // Text read by "Scan Text" is stored on the document (replaces text that could not be read at upload)
    const saveOcrText = async (text: string) => {
        try {
            const res = await fetch(`/documents/${id}/ocr-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...csrfHeaders() },
                credentials: 'same-origin',
                body: JSON.stringify({ ocr_text: text }),
            });
            if (res.ok) {
                router.reload({ only: ['dbDocument'] });
            }
        } catch {
            // The text stays visible in the viewer even if saving failed
        }
    };

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Document', href: documentUrl },
                { title: docRef, href: documentUrl },
                { title: 'OCR Workspace', href: '#' },
            ]}
        >
            <Head title="OCR Workspace — TrackNGo Mati" />

            <div className="flex flex-col space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <ScanText className="h-6 w-6 text-[var(--tng-blue-600)]" />
                            Document OCR Workspace
                        </h1>
                        <p className="mt-1 text-[14px] text-slate-500 flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-slate-700">{docRef}</span>
                            <span>•</span>
                            <span>{docTitle}</span>
                            {isHidden && (
                                <span className="inline-flex items-center gap-1 rounded-[4px] border border-red-200 bg-red-50 px-2 py-0.5 text-[12px] font-medium text-red-700">
                                    <Lock className="h-3 w-3" /> Contents restricted
                                </span>
                            )}
                        </p>
                        {!isHidden && (
                            <p className="mt-1 text-[13px] text-slate-500">
                                {dbDocument?.ocr_text ? 'Showing the text read from this document.' : 'No text has been read from this document yet. Click "Scan Text" to run OCR.'}
                            </p>
                        )}
                    </div>
                    <Link
                        href={documentUrl}
                        className="inline-flex items-center gap-1.5 rounded-[8px] border border-slate-300 bg-white px-3 py-1.5 text-xs sm:text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 shadow-xs"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Document
                    </Link>
                </div>

                <div className="w-full rounded-[8px] border border-slate-200 bg-white overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
                    <IntegratedDocumentViewer
                        fileUrl={filePath}
                        ocrText={dbDocument?.ocr_text || null}
                        fileName={docTitle}
                        documentId={id}
                        isConfidential={isHidden}
                        selectedText={selectedOcrText}
                        onTextSelect={(text) => setSelectedOcrText(text)}
                        onOcrText={isHidden ? undefined : saveOcrText}
                    />
                </div>
            </div>
        </TrackngoLayout>
    );
}
