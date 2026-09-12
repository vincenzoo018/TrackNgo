import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, ExternalLink, QrCode } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { cn } from '@/lib/utils';

export type RoutingSlipModalData = {
    slip_id?: number | string;
    formatted_slip_id?: string;
    tracking_number?: string;
    document_id?: number | string;
    document_ref?: string;
    document_title?: string;
    from_name?: string;
    from_department?: string;
    from_role?: string;
    to_name?: string;
    to_department?: string;
    action?: string;
    instruction?: string;
    status?: string;
    date?: string;
    formatted_date?: string;
    formatted_datetime?: string;
    stop_number?: string;
    qr_data?: string;
};

export type RoutingSlipModalProps = {
    isOpen: boolean;
    onClose: () => void;
    slip: RoutingSlipModalData | null;
    currentRole?: string;
};

export function RoutingSlipModal({
    isOpen,
    onClose,
    slip,
    currentRole = 'receiving',
}: RoutingSlipModalProps) {
    if (!isOpen || !slip) return null;

    const trackingNumber = slip.tracking_number || slip.formatted_slip_id || `RS-2026-${String(slip.slip_id || '0001').padStart(4, '0')}`;
    const qrPayload = encodeURIComponent(slip.qr_data || trackingNumber || slip.document_ref || 'TRACKNGO');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrPayload}`;

    const handlePrint = () => {
        window.print();
    };

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
            {/* Dark Backdrop Overlay */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity print:hidden"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Modal Dialog Box */}
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 print:shadow-none print:border-none print:max-h-none print:p-0"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Standardized Header Bar ───────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0 print:hidden">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                            <QrCode className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-slate-900 leading-tight">
                                    Official Routing Slip
                                </h2>
                                <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    {trackingNumber}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Verified document tracking record & dispatch voucher
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        aria-label="Close modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ── Scrollable Body: Official Layout Matching Screenshot ─── */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 print:p-0 print:overflow-visible">
                    <div
                        id="printable-routing-slip-card"
                        className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs font-mono text-slate-900 relative"
                    >
                        {/* Header: ROUTING SLIP + QR Code */}
                        <div className="flex justify-between items-start border-b border-slate-200 pb-5">
                            <div className="pr-4">
                                <h1 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-950 font-mono">
                                    ROUTING SLIP
                                </h1>
                                <p className="text-sm sm:text-base font-bold mt-2 text-slate-900 leading-snug">
                                    {slip.from_department || 'Originating Office'}
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                    {slip.from_name || 'Authorized Personnel'}
                                </p>
                            </div>

                            <div className="flex flex-col items-end text-right shrink-0">
                                <img
                                    src={qrUrl}
                                    alt={`QR Code for ${trackingNumber}`}
                                    className="w-16 h-16 sm:w-20 sm:h-20 mb-2 mix-blend-multiply border border-slate-200 rounded p-1 bg-white"
                                />
                                <p className="text-xs sm:text-sm font-bold tracking-tight text-slate-800">
                                    {slip.stop_number || 'Stop #1'}
                                </p>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                                    {trackingNumber}
                                </p>
                                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                                    Submitted on {slip.formatted_date || (slip.date ? slip.date.slice(0, 10) : '2026-07-27')}
                                </p>
                            </div>
                        </div>

                        {/* Middle Section: FROM and TO Columns */}
                        <div className="flex justify-between py-5 sm:py-6 border-b border-slate-200">
                            <div className="w-1/2 pr-3 sm:pr-4">
                                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                                    FROM:
                                </p>
                                <p className="text-sm sm:text-base font-bold text-slate-950">
                                    {slip.from_name || 'Origin Submitter'}
                                </p>
                                <p className="text-xs text-slate-700 mt-0.5 leading-snug">
                                    {slip.from_department || 'Department Office'}
                                </p>
                            </div>

                            <div className="w-1/2 pl-3 sm:pl-4 border-l border-slate-100">
                                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wider">
                                    TO:
                                </p>
                                <p className="text-sm sm:text-base font-bold text-slate-950">
                                    {slip.to_department || 'Destination Department'}
                                </p>
                                <p className="text-xs text-slate-700 mt-0.5 leading-snug">
                                    {slip.to_name || 'Department Pool'}
                                </p>
                            </div>
                        </div>

                        {/* Instructions Section */}
                        <div className="pt-4 sm:pt-5">
                            <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
                                INSTRUCTIONS:
                            </p>
                            <div className="text-xs sm:text-sm bg-slate-50 p-3 sm:p-3.5 rounded-lg border border-slate-200 text-slate-800 leading-relaxed font-mono">
                                {slip.instruction || 'For review and appropriate action.'}
                            </div>
                        </div>

                        {/* Structured Metadata Strip: Status, Action, Document Ref, Date */}
                        <div className="mt-5 pt-4 border-t border-dashed border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-sans text-slate-600">
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    Document Ref
                                </span>
                                <span className="font-mono font-bold text-slate-800">
                                    {slip.document_ref || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    Action Required
                                </span>
                                <span className="font-semibold text-blue-700 capitalize">
                                    {slip.action || 'Forward'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    Slip Status
                                </span>
                                <span
                                    className={cn(
                                        'font-bold inline-block px-2 py-0.5 rounded text-[11px]',
                                        (slip.status || '').toLowerCase() === 'completed'
                                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                            : (slip.status || '').toLowerCase() === 'returned'
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    )}
                                >
                                    {slip.status || 'Active'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-semibold text-slate-400 block tracking-wider">
                                    Date Recorded
                                </span>
                                <span className="text-slate-700">
                                    {slip.formatted_datetime || slip.formatted_date || (slip.date ? slip.date.slice(0, 10) : 'Today')}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Standardized Footer Action Bar ────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0 print:hidden">
                    {slip.document_id ? (
                        <Link
                            href={`/${currentRole}/documents/${slip.document_id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Document Workspace
                        </Link>
                    ) : (
                        <div />
                    )}

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                            <Printer className="h-3.5 w-3.5" />
                            Print Slip
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
