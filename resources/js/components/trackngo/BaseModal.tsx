import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BaseModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    identifier?: string;
    description?: React.ReactNode;
    icon?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: 'max-w-sm' | 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl' | 'max-w-5xl' | 'max-w-none';
    formProps?: React.FormHTMLAttributes<HTMLFormElement>;
    childrenContainerClassName?: string;
    headerClassName?: string;
    iconContainerClassName?: string;
};

export function BaseModal({
    isOpen,
    onClose,
    title,
    identifier,
    description,
    icon,
    children,
    footer,
    maxWidth = 'max-w-md',
    formProps,
    childrenContainerClassName = "p-5 sm:p-6",
    headerClassName = "bg-white",
    iconContainerClassName = "bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]",
}: BaseModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        // Prevent body scroll
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Keyboard accessibility: ESC to close
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 transition-all">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 z-0 bg-[rgba(0,0,0,0.5)] backdrop-blur-sm transition-opacity" 
                onClick={onClose} 
                aria-hidden="true" 
            />

            {/* Modal Dialog */}
            <div 
                role="dialog"
                aria-modal="true"
                className={cn(
                    "relative z-10 w-full rounded-[8px] bg-white shadow-2xl ring-1 ring-slate-900/5 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200",
                    maxWidth
                )}
            >
                {/* Header */}
                {(title || icon) && (
                    <div className={cn("flex items-center justify-between border-b border-slate-100 px-5 py-4 sm:px-6 shrink-0", headerClassName)}>
                        <div className="flex items-center gap-3">
                            {icon && (
                                <div className={cn("flex h-10 w-10 items-center justify-center rounded-[8px] shrink-0", iconContainerClassName)}>
                                    {icon}
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {title && (
                                        <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                            {title}
                                        </h2>
                                    )}
                                    {identifier && (
                                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                                            {identifier}
                                        </span>
                                    )}
                                </div>
                                {description && (
                                    <p className="text-[14px] text-slate-500 mt-0.5">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            type="button"
                            className="rounded-[6px] p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 shrink-0 self-start mt-1 sm:mt-0"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* Body (scrollable) */}
                {formProps ? (
                    <form {...formProps} className="flex flex-col min-h-0 flex-1">
                        <div className="flex-1 overflow-y-auto">
                            <div className={cn("flex flex-col min-h-full text-[14px]", childrenContainerClassName)}>
                                {children}
                            </div>
                        </div>
                        {/* Footer inside form to submit */}
                        {footer && (
                            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6 shrink-0 mt-auto text-[16px]">
                                {footer}
                            </div>
                        )}
                    </form>
                ) : (
                    <div className="flex flex-col min-h-0 flex-1">
                        <div className="flex-1 overflow-y-auto">
                            <div className={cn("flex flex-col min-h-full text-[14px]", childrenContainerClassName)}>
                                {children}
                            </div>
                        </div>
                        {/* Footer without form */}
                        {footer && (
                            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-6 shrink-0 mt-auto text-[16px]">
                                {footer}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
