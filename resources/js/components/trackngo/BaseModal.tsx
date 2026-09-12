import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BaseModalProps = {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    identifier?: string;
    badge?: string;
    badgeVariant?: 'default' | 'amber' | 'emerald' | 'red';
    description?: React.ReactNode;
    icon?: React.ReactNode;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'max-w-sm' | 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | 'max-w-4xl' | 'max-w-5xl' | 'max-w-none';
    formProps?: React.FormHTMLAttributes<HTMLFormElement>;
    childrenContainerClassName?: string;
    headerClassName?: string;
    iconContainerClassName?: string;
};

/**
 * Unified BaseModal component enforcing standard structure across TrackNGo:
 * - Header: Clear title with icon, subtitle, identifier badge, close button
 * - Body: Organized into labeled sections with consistent spacing and typography
 * - Form Fields: Consistent font sizes, red '*' on required fields, inline error messages
 * - Footer: Right-aligned action buttons (Primary and Secondary)
 * - Accessibility: ESC to close, keyboard navigation, backdrop blur overlay
 */
export function BaseModal({
    isOpen,
    onClose,
    title,
    identifier,
    badge,
    badgeVariant = 'default',
    description,
    icon,
    children,
    footer,
    maxWidth = 'max-w-lg',
    formProps,
    childrenContainerClassName = "p-6 space-y-6",
    headerClassName = "bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]",
    iconContainerClassName = "bg-blue-100 text-[var(--tng-blue-600)]",
}: BaseModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        // Prevent body scrolling while modal is open
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Keyboard accessibility: ESC key closes modal
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

    const widthMap: Record<string, string> = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        '2xl': 'max-w-2xl',
        '3xl': 'max-w-3xl',
        '4xl': 'max-w-4xl',
        '5xl': 'max-w-5xl',
        none: 'max-w-none',
    };
    const resolvedMaxWidth = maxWidth ? (widthMap[maxWidth] || maxWidth) : 'max-w-lg';

    const badgeClasses = {
        default: 'text-blue-700 bg-blue-50 border-blue-200',
        amber: 'text-amber-700 bg-amber-50 border-amber-200',
        emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        red: 'text-red-700 bg-red-50 border-red-200',
    };
    const badgeText = badge || identifier;

    const modalContent = (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 transition-all">
            {/* Backdrop with semi-transparent overlay and blur */}
            <div 
                className="absolute inset-0 z-0 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in" 
                onClick={onClose} 
                aria-hidden="true" 
            />

            {/* Modal Dialog Container */}
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? "trackngo-modal-title" : undefined}
                className={cn(
                    "relative z-10 w-full rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150 border border-slate-200",
                    resolvedMaxWidth
                )}
            >
                {/* ── HEADER ─────────────────────────────────────────────── */}
                {(title || icon) && (
                    <div className={cn("flex items-start justify-between px-6 py-4 shrink-0", headerClassName)}>
                        <div className="flex items-start gap-3">
                            {icon && (
                                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl shrink-0 mt-0.5 shadow-xs", iconContainerClassName)}>
                                    {icon}
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {title && (
                                        <h2 id="trackngo-modal-title" className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                                            {title}
                                        </h2>
                                    )}
                                    {badgeText && (
                                        <span className={cn("font-mono text-xs font-bold px-2.5 py-0.5 rounded-md border shadow-2xs", badgeClasses[badgeVariant] || badgeClasses.default)}>
                                            {badgeText}
                                        </span>
                                    )}
                                </div>
                                {description && (
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 shrink-0 cursor-pointer ml-2"
                            aria-label="Close modal"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* ── BODY (Scrollable) ──────────────────────────────────── */}
                {formProps ? (
                    <form {...formProps} className="flex flex-col min-h-0 flex-1">
                        <div className="flex-1 overflow-y-auto tng-scrollbar">
                            <div className={cn("flex flex-col min-h-full text-sm", childrenContainerClassName)}>
                                {children}
                            </div>
                        </div>
                        {/* ── FOOTER (Aligned Right) ───────────────────────── */}
                        {footer && (
                            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 shrink-0 mt-auto">
                                {footer}
                            </div>
                        )}
                    </form>
                ) : (
                    <div className="flex flex-col min-h-0 flex-1">
                        <div className="flex-1 overflow-y-auto tng-scrollbar">
                            <div className={cn("flex flex-col min-h-full text-sm", childrenContainerClassName)}>
                                {children}
                            </div>
                        </div>
                        {/* ── FOOTER (Aligned Right) ───────────────────────── */}
                        {footer && (
                            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 shrink-0 mt-auto">
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

/**
 * Standardized Section header for Modal bodies:
 * Provides clear labeled divisions (e.g., "User Information", "Role Assignment", etc.)
 */
export function ModalSection({
    title,
    icon,
    description,
    children,
    className = "",
}: {
    title: string;
    icon?: React.ReactNode;
    description?: string;
    children?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("space-y-3", className)}>
            <div className="border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                    {icon && <span className="text-slate-500">{icon}</span>}
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        {title}
                    </h3>
                </div>
                {description && (
                    <p className="text-xs text-slate-400 mt-0.5">{description}</p>
                )}
            </div>
            {children}
        </div>
    );
}

/**
 * Standardized Form Field with consistent label, required '*' indicator,
 * and red inline validation error styling.
 */
export function ModalField({
    label,
    required = false,
    error,
    description,
    children,
    className = "",
}: {
    label?: string;
    required?: boolean;
    error?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("space-y-1.5", className)}>
            {label && (
                <label className="block text-xs font-semibold text-slate-700">
                    {label}
                    {required && <span className="text-red-500 font-bold ml-1">*</span>}
                </label>
            )}
            {children}
            {description && !error && (
                <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>
            )}
            {error && (
                <p className="text-xs text-red-600 font-medium mt-1 animate-in fade-in">
                    {error}
                </p>
            )}
        </div>
    );
}

/**
 * Reusable Standard Primary Action Button
 */
export function ModalPrimaryButton({
    children,
    isLoading = false,
    loadingText = 'Processing...',
    disabled,
    className = "",
    type = "submit",
    onClick,
}: {
    children: React.ReactNode;
    isLoading?: boolean;
    loadingText?: string;
    disabled?: boolean;
    className?: string;
    type?: "submit" | "button" | "reset";
    onClick?: () => void;
}) {
    return (
        <button
            type={type}
            disabled={disabled || isLoading}
            onClick={onClick}
            className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tng-blue-600)] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-[var(--tng-blue-700)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
                className
            )}
        >
            {isLoading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{loadingText}</span>
                </>
            ) : (
                children
            )}
        </button>
    );
}

/**
 * Reusable Standard Secondary Action Button (Cancel)
 */
export function ModalSecondaryButton({
    children = "Cancel",
    onClick,
    disabled = false,
    className = "",
}: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50 cursor-pointer",
                className
            )}
        >
            {children}
        </button>
    );
}
