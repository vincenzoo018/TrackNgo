import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, ScanText, Copy, CheckCircle2 } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { useState } from 'react';

export default function OcrWorkspace() {
    const [copied, setCopied] = useState(false);
    const mockText = `REPUBLIC OF THE PHILIPPINES
CITY OF MATI

EXECUTIVE ORDER NO. 12
Series of 2026

AN ORDER MANDATING ALL CITY DEPARTMENTS TO ADOPT THE TRACKNGO SYSTEM.

WHEREAS, the City Government of Mati is committed to streamlining its services...
WHEREAS, the Anti-Red Tape Authority (ARTA) requires...

NOW THEREFORE, I, HON. MAYOR of the City of Mati, do hereby order:

Section 1. Implementation. All departments must immediately...`;

    const handleCopy = () => {
        navigator.clipboard.writeText(mockText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/receiving' },
                { title: 'My Documents', href: '/receiving/documents' },
                { title: 'TNG-2026-0004', href: '/receiving/documents/1' },
                { title: 'OCR Workspace', href: '#' },
            ]}
        >
            <Head title="OCR Workspace — TrackNGo Mati" />

            <div className="flex h-[calc(100vh-140px)] flex-col space-y-4">
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--tng-slate-900)] flex items-center gap-2">
                            <ScanText className="h-6 w-6 text-[var(--tng-purple-600)]" />
                            Full OCR Text Extraction
                        </h1>
                        <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                            TNG-2026-0004 — Side-by-side view of original document and AI-extracted text.
                        </p>
                    </div>
                    <Link
                        href="/receiving/documents/1"
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Document
                    </Link>
                </div>

                <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
                    {/* Left side: PDF Preview */}
                    <div className="flex flex-col rounded-xl border border-[var(--tng-slate-200)] bg-white overflow-hidden">
                        <div className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-4 py-2 text-sm font-semibold text-[var(--tng-slate-700)]">
                            Original Scanned Document
                        </div>
                        <div className="flex-1 bg-[var(--tng-slate-100)] flex items-center justify-center">
                            {/* Mock PDF Viewer */}
                            <div className="w-[80%] h-[90%] bg-white shadow-md border border-[var(--tng-slate-200)] p-8 flex flex-col">
                                <div className="w-1/2 h-4 bg-slate-200 rounded mb-2 mx-auto" />
                                <div className="w-1/3 h-3 bg-slate-200 rounded mb-8 mx-auto" />
                                
                                <div className="w-1/3 h-5 bg-slate-300 rounded mb-4" />
                                <div className="w-full h-3 bg-slate-200 rounded mb-2" />
                                <div className="w-5/6 h-3 bg-slate-200 rounded mb-6" />
                                
                                <div className="w-full h-3 bg-slate-200 rounded mb-2" />
                                <div className="w-4/5 h-3 bg-slate-200 rounded mb-6" />
                            </div>
                        </div>
                    </div>

                    {/* Right side: Extracted Text */}
                    <div className="flex flex-col rounded-xl border border-[var(--tng-slate-200)] bg-white overflow-hidden">
                        <div className="flex items-center justify-between border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] px-4 py-2">
                            <span className="text-sm font-semibold text-[var(--tng-slate-700)]">Extracted Text (Editable)</span>
                            <button 
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 rounded bg-white px-2 py-1 text-xs font-medium text-[var(--tng-slate-600)] border border-[var(--tng-slate-200)] hover:bg-[var(--tng-slate-50)]"
                            >
                                {copied ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                                {copied ? 'Copied!' : 'Copy All'}
                            </button>
                        </div>
                        <div className="flex-1 p-4">
                            <textarea 
                                className="h-full w-full resize-none rounded-lg border-0 bg-transparent p-0 text-sm text-[var(--tng-slate-800)] focus:ring-0 tng-scrollbar"
                                defaultValue={mockText}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
