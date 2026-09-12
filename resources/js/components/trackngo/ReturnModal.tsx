import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { BaseModal } from './BaseModal';

type ReturnModalProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    identifier?: string;
};

export function ReturnModal({ open, onClose, onConfirm, identifier }: ReturnModalProps) {
    const [reason, setReason] = useState('');

    return (
        <BaseModal
            isOpen={open}
            onClose={onClose}
            title="Return Document"
            identifier={identifier}
            description="Provide a reason for returning this document."
            icon={<AlertCircle className="h-5 w-5" />}
            maxWidth="max-w-lg"
            headerClassName="bg-orange-50 rounded-t-2xl"
            iconContainerClassName="bg-orange-100 text-orange-600"
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
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
                                : "bg-slate-300 cursor-not-allowed"
                        )}
                    >
                        Confirm Return
                    </button>
                </>
            }
        >
            <div className="space-y-6">
                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Reason for Return <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="State the missing requirements or corrections needed..."
                        rows={5}
                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                </div>
            </div>
        </BaseModal>
    );
}
