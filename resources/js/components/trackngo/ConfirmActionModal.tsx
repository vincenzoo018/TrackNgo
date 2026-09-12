import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BaseModal } from './BaseModal';

interface ConfirmActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    identifier?: string;
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
    identifier,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
    isLoading = false
}: ConfirmActionModalProps) {
    return (
        <BaseModal
            isOpen={isOpen}
            onClose={isLoading ? () => {} : onClose}
            title={title}
            identifier={identifier}
            icon={<AlertTriangle className="h-5 w-5" />}
            headerClassName={isDestructive ? "bg-red-50 rounded-t-2xl" : "bg-blue-50 rounded-t-2xl"}
            iconContainerClassName={isDestructive ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}
            maxWidth="max-w-md"
            footer={
                <>
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
                                : "bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)] focus:ring-[var(--tng-blue-500)]"
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
                </>
            }
        >
            <p className="text-sm text-slate-500">
                {message}
            </p>
        </BaseModal>
    );
}
