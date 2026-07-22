import { cn } from '@/lib/utils';
import { X, AlertCircle } from 'lucide-react';
import { useState } from 'react';

type ReturnModalProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
};

export function ReturnModal({ open, onClose, onConfirm }: ReturnModalProps) {
    const [reason, setReason] = useState('');

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[var(--tng-slate-100)] px-6 py-4 shrink-0 bg-orange-50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                            <AlertCircle className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-orange-900">
                                Return Document
                            </h3>
                            <p className="text-sm text-orange-700/80">
                                Provide a reason for returning this document.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-orange-400 transition-colors hover:bg-orange-200 hover:text-orange-700"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-[var(--tng-slate-700)]">
                            Reason for Return <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="State the missing requirements or corrections needed..."
                            rows={5}
                            className="w-full rounded-lg border border-[var(--tng-slate-200)] bg-white p-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-[var(--tng-slate-100)] bg-[var(--tng-slate-50)] px-6 py-4 rounded-b-2xl shrink-0">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-200)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => reason.trim() && onConfirm(reason)}
                        disabled={!reason.trim()}
                        className={cn(
                            "flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all",
                            reason.trim() 
                                ? "bg-orange-600 hover:bg-orange-700 shadow-md shadow-orange-600/25"
                                : "bg-[var(--tng-slate-300)] cursor-not-allowed"
                        )}
                    >
                        Confirm Return
                    </button>
                </div>
            </div>
        </div>
    );
}
