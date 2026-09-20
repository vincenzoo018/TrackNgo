import React, { useState, useEffect, useRef } from 'react';
import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastItem {
    id: string;
    type?: string;
    severity?: 'normal' | 'warning' | 'overdue' | 'escalated';
    title?: string;
    toast_message?: string;
    icon?: string;
    reference_number?: string;
    document_type?: string;
    originating_department?: string;
    action_url: string;
    created_at?: string;
}

interface ToastNotificationProps {
    toast: ToastItem;
    onDismiss: (id: string) => void;
    duration?: number; // Auto-dismiss duration in ms (5000 - 7000ms, default 6000ms)
}

export function ToastNotification({
    toast,
    onDismiss,
    duration = 6000,
}: ToastNotificationProps) {
    const [isExiting, setIsExiting] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-dismiss after duration
    useEffect(() => {
        timerRef.current = setTimeout(() => {
            handleClose();
        }, duration);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [toast.id, duration]);

    // Keyboard dismiss on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClose = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setIsExiting(true);
        setTimeout(() => {
            onDismiss(toast.id);
        }, 250);
    };

    const handleClickAction = () => {
        if (toast.action_url) {
            handleClose();
            router.visit(toast.action_url);
        }
    };

    // Determine icon
    const icon = toast.icon || (
        toast.severity === 'escalated' ? '⚡' :
        toast.severity === 'overdue' ? '❗' :
        toast.severity === 'warning' ? '⚠' : '📄'
    );

    // Format content message (defensively strip any leading emoji/icon if already duplicated)
    let message = toast.toast_message || toast.title || 'New document notification';
    message = message.replace(/^[❗⚠⚡📄\s]+/, '').trim();

    return (
        <div
            role="alert"
            aria-live="polite"
            className={cn(
                'group relative flex w-full max-w-[420px] items-center justify-between gap-3 rounded-lg shadow-xl transition-all duration-300 ease-out overflow-hidden select-none',
                // Design rule: System blue (#0066cc) background, pure white text, neutral clean styling
                'bg-[#0066cc] text-white border border-[#0055b3]/50',
                isExiting
                    ? 'opacity-0 -translate-y-3 scale-95'
                    : 'opacity-100 translate-y-0 scale-100'
            )}
            style={{
                fontFamily: "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
            }}
        >
            <style>{`
                @keyframes tngToastProgress {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>

            {/* Clickable toast body */}
            <div
                onClick={handleClickAction}
                className="flex flex-1 items-start gap-2.5 px-4 py-3.5 cursor-pointer hover:bg-white/5 transition-colors min-w-0"
                title="Click to view document in FSM stage"
            >
                {/* Minimal Icon */}
                <span className="text-[17px] leading-none shrink-0 mt-0.5 select-none" aria-hidden="true">
                    {icon}
                </span>

                {/* Content: 14px regular font, white text */}
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-normal leading-snug text-white break-words">
                        {message}
                    </p>
                </div>
            </div>

            {/* Manual Dismiss Button (×) */}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                }}
                className="mr-3 p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15 focus:outline-hidden focus:ring-2 focus:ring-white/40 transition-colors shrink-0"
                aria-label="Dismiss notification"
                title="Dismiss (Esc)"
            >
                <X className="h-4 w-4 stroke-[2.5]" />
            </button>

            {/* Subtle auto-dismiss countdown progress line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20 overflow-hidden pointer-events-none">
                <div
                    className="h-full bg-white/80"
                    style={{
                        animation: `tngToastProgress ${duration}ms linear forwards`,
                    }}
                />
            </div>
        </div>
    );
}

interface ToastContainerProps {
    toasts: ToastItem[];
    onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
    if (!toasts || toasts.length === 0) return null;

    return (
        <aside
            aria-label="Notifications"
            className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-[calc(100vw-2.5rem)] sm:max-w-[420px] w-full pointer-events-auto"
        >
            {toasts.map((toast) => (
                <ToastNotification
                    key={toast.id}
                    toast={toast}
                    onDismiss={onDismiss}
                    duration={6000}
                />
            ))}
        </aside>
    );
}
