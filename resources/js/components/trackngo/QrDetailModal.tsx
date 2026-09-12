import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    QrCode,
    Printer,
    Download,
    ExternalLink,
    CheckCircle2,
    Copy,
    Check,
    Building2,
    Calendar,
    Route,
    FileText,
    ShieldCheck,
} from 'lucide-react';
import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';

export type QrCodeItem = {
    qr_id: string;
    qr_data: string;
    qr_image_url: string;
    document_id: number;
    document_ref: string;
    document_title: string;
    document_type: string;
    routing_slip_id: string;
    numeric_slip_id: number;
    department: string;
    department_code: string;
    status: 'Active' | 'Completed' | 'Archived' | string;
    raw_document_status?: string;
    date_generated: string;
    date_iso: string;
    formatted_date: string;
    stop_number: string;
    from_name: string;
    to_name: string;
    to_department: string;
    action: string;
    instruction: string;
};

interface QrDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    qrItem: QrCodeItem | null;
    currentRole?: string;
}

export function QrDetailModal({
    isOpen,
    onClose,
    qrItem,
    currentRole = 'receiving',
}: QrDetailModalProps) {
    const [copied, setCopied] = useState(false);

    if (!isOpen || !qrItem) return null;

    const handleCopyPayload = () => {
        navigator.clipboard.writeText(qrItem.qr_data);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadQr = () => {
        const link = document.createElement('a');
        link.href = qrItem.qr_image_url;
        link.target = '_blank';
        link.download = `${qrItem.qr_id}_${qrItem.document_ref}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    const getStatusBadge = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'completed') {
            return 'bg-indigo-50 text-indigo-700 border-indigo-200';
        }
        if (s === 'archived') {
            return 'bg-purple-50 text-purple-700 border-purple-200';
        }
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity print:hidden"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Dialog */}
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:p-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0 print:hidden">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                            <QrCode className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-[18px] sm:text-[20px] font-bold text-slate-900 leading-tight">
                                    QR Code Verification & Traceability
                                </h2>
                                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                                    {qrItem.qr_id}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Verified document token mapped directly to {qrItem.document_ref} & {qrItem.routing_slip_id}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="h-[18px] w-[18px]" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8 print:p-0">
                    <div
                        id="printable-qr-voucher-card"
                        className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs font-sans text-slate-900"
                    >
                        {/* Top Banner: QR Code and Primary Metadata */}
                        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 pb-6 border-b border-slate-200">
                            <div className="relative group shrink-0 flex flex-col items-center">
                                <div className="p-3 bg-white border-2 border-slate-200 rounded-2xl shadow-xs">
                                    <img
                                        src={qrItem.qr_image_url}
                                        alt={`QR Code ${qrItem.qr_id}`}
                                        className="w-36 h-36 sm:w-44 sm:h-44 object-contain mix-blend-multiply"
                                    />
                                </div>
                                <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Verified In System</span>
                                </div>
                            </div>

                            <div className="flex-1 space-y-4 text-center sm:text-left w-full">
                                <div>
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                        <span className="font-mono text-sm font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                                            {qrItem.qr_id}
                                        </span>
                                        <span
                                            className={cn(
                                                'font-semibold px-2.5 py-0.5 rounded-full text-xs border',
                                                getStatusBadge(qrItem.status)
                                            )}
                                        >
                                            {qrItem.status}
                                        </span>
                                        <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200">
                                            {qrItem.document_type}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mt-2 leading-snug">
                                        {qrItem.document_title}
                                    </h3>
                                    <div className="mt-1 flex items-center justify-center sm:justify-start gap-2 text-xs text-slate-500">
                                        <span className="font-mono font-bold text-blue-600">
                                            {qrItem.document_ref}
                                        </span>
                                        <span>•</span>
                                        <span className="font-medium text-slate-700">
                                            {qrItem.department}
                                        </span>
                                    </div>
                                </div>

                                {/* Scannable Payload Strip */}
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Machine-Readable Token Payload
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCopyPayload}
                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="h-3 w-3 text-emerald-600" />
                                                    <span className="text-emerald-600">Copied</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="h-3 w-3" />
                                                    <span>Copy</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="font-mono text-xs text-slate-800 break-all leading-tight">
                                        {qrItem.qr_data}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Middle Section: Direct Traceability Mapping */}
                        <div className="py-5 border-b border-slate-200">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                                <Route className="h-4 w-4 text-blue-600" />
                                Traceability & Routing Links
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                        Associated Routing Slip
                                    </span>
                                    <div className="font-mono font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                        <span>{qrItem.routing_slip_id}</span>
                                        <span className="text-xs font-normal text-slate-500">
                                            ({qrItem.stop_number})
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-600">
                                        Action Required: <span className="font-semibold text-blue-700">{qrItem.action}</span>
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                                        Origin & Transit
                                    </span>
                                    <p className="font-medium text-slate-900 text-xs">
                                        <span className="text-slate-500">From:</span> {qrItem.from_name} ({qrItem.department})
                                    </p>
                                    <p className="font-medium text-slate-900 text-xs">
                                        <span className="text-slate-500">To:</span> {qrItem.to_department} ({qrItem.to_name})
                                    </p>
                                </div>
                            </div>

                            {qrItem.instruction && (
                                <div className="mt-3 p-3 rounded-xl bg-blue-50/50 border border-blue-100 text-xs text-slate-700">
                                    <span className="text-[10px] uppercase font-bold text-blue-800 block mb-0.5">
                                        Routing Instruction
                                    </span>
                                    <p className="font-mono text-[11px] leading-relaxed">
                                        {qrItem.instruction}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Bottom Metadata Grid */}
                        <div className="pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    QR Code ID
                                </span>
                                <span className="font-mono font-bold text-slate-900">
                                    {qrItem.qr_id}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    Document Ref
                                </span>
                                <span className="font-mono font-bold text-blue-700">
                                    {qrItem.document_ref}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    Date Generated
                                </span>
                                <span className="font-medium text-slate-800">
                                    {qrItem.date_generated}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    Department
                                </span>
                                <span className="font-medium text-slate-800 truncate block">
                                    {qrItem.department}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0 print:hidden">
                    <Link
                        href={`/${currentRole}/documents/${qrItem.document_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Document Workspace
                    </Link>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleDownloadQr}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download QR
                        </button>
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print Voucher
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors shadow-2xs"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
