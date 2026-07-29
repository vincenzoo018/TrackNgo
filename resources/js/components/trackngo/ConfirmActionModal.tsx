import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
}

export function ConfirmActionModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    isLoading = false
}: ConfirmActionModalProps) {
    
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; }
    }, [isOpen]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                onClick={isLoading ? undefined : onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left shadow-xl transition-all animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            isDestructive ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                        )}>
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <h3 className="text-lg font-semibold leading-6 text-slate-900">
                            {title}
                        </h3>
                    </div>
                    {!isLoading && (
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-500 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
                
                <div className="mt-4 ml-14">
                    <p className="text-sm text-slate-500">
                        {message}
                    </p>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        {cancelText}
                    </button>
                    <button
                        type="button"
                        className={cn(
                            "rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2",
                            isDestructive 
                                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500" 
                                : "bg-[#6fcab8] hover:bg-[#5dbba8] focus:ring-teal-500"
                        )}
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading && (
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
