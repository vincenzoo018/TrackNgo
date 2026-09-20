import React, { useState, useEffect, useRef } from 'react';
import { Link } from '@inertiajs/react';
import { AlertCircle, AlertTriangle, Bell, Flame, X, ArrowRight, Clock, Building2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NotificationItem {
    id: string;
    db_id?: number;
    document_id?: number;
    type: 'receipt' | 'deadline_warning' | 'deadline_overdue' | 'deadline_escalated' | 'escalated';
    severity: 'normal' | 'warning' | 'overdue' | 'escalated';
    title: string;
    reference_number?: string;
    document_type?: string;
    originating_department?: string;
    action_url: string;
    created_at: string;
    is_read?: boolean;
}

interface NotificationBannerProps {
    alert: NotificationItem | null;
    onDismiss?: () => void;
    duration?: number; // Auto-dismiss duration in milliseconds (default: 10,000ms / 10s)
}

export function NotificationBanner({ alert, onDismiss, duration = 10000 }: NotificationBannerProps) {
    const [dismissed, setDismissed] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-dismiss countdown when alert arrives or changes
    useEffect(() => {
        if (!alert) return;

        setDismissed(false);
        setIsExiting(false);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Auto-dismiss after 10 seconds
        timerRef.current = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => {
                setDismissed(true);
                if (onDismiss) onDismiss();
            }, 300);
        }, duration);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [alert?.id, duration]);

    if (!alert || dismissed) {
        return null;
    }

    const handleDismiss = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        setIsExiting(true);
        setTimeout(() => {
            setDismissed(true);
            if (onDismiss) onDismiss();
        }, 200);
    };

    const isOverdue = alert.severity === 'overdue';
    const isEscalated = alert.severity === 'escalated';
    const isWarning = alert.severity === 'warning';
    const isReceipt = alert.severity === 'normal' || alert.type === 'receipt';

    return (
        <div
            className={cn(
                'relative w-full border-b px-4 py-2.5 sm:px-6 transition-all duration-300 overflow-hidden',
                isExiting ? 'opacity-0 -translate-y-2 max-h-0 py-0 border-b-0' : 'opacity-100 translate-y-0 max-h-24',
                (isOverdue || isEscalated) && 'border-rose-200 bg-rose-50/95 text-rose-950',
                isWarning && 'border-amber-200 bg-amber-50/95 text-amber-950',
                isReceipt && 'border-blue-200 bg-blue-50/95 text-slate-900',
            )}
            role="alert"
        >
            <style>{`
                @keyframes tngToastCountdown {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>

            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs sm:text-[13px]">
                {/* Left: Icon & Notification Context */}
                <div className="flex items-center gap-2.5 min-w-0">
                    <span
                        className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-2xs',
                            (isOverdue || isEscalated) && 'bg-rose-600 text-white',
                            isWarning && 'bg-amber-500 text-white',
                            isReceipt && 'bg-[var(--tng-blue-600)] text-white',
                        )}
                    >
                        {isEscalated && <Flame className="h-4 w-4" />}
                        {isOverdue && <AlertCircle className="h-4 w-4" />}
                        {isWarning && <AlertTriangle className="h-4 w-4" />}
                        {isReceipt && <Bell className="h-4 w-4" />}
                    </span>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                        <span className="font-bold tracking-tight text-slate-900">
                            {alert.title}
                        </span>

                        {alert.reference_number && (
                            <span className="inline-flex items-center gap-1 font-mono font-medium text-slate-600">
                                <FileText className="h-3 w-3 text-slate-400" />
                                {alert.reference_number}
                            </span>
                        )}

                        {alert.document_type && (
                            <span className="text-slate-500 hidden sm:inline">
                                • {alert.document_type}
                            </span>
                        )}

                        {alert.originating_department && (
                            <span className="inline-flex items-center gap-1 text-slate-600 hidden md:inline-flex">
                                <Building2 className="h-3 w-3 text-slate-400" />
                                {alert.originating_department}
                            </span>
                        )}

                        <span className="inline-flex items-center gap-1 text-slate-400 text-[11px] hidden lg:inline-flex">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>

                {/* Right: Action Link + Dismiss Button */}
                <div className="flex items-center gap-2 ml-auto">
                    <Link
                        href={alert.action_url}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold shadow-2xs transition-colors',
                            (isOverdue || isEscalated) && 'bg-rose-600 text-white hover:bg-rose-700',
                            isWarning && 'bg-amber-600 text-white hover:bg-amber-700',
                            isReceipt && 'bg-[var(--tng-blue-600)] text-white hover:bg-[var(--tng-blue-700)]',
                        )}
                    >
                        <span>Open Document Details + FSM view</span>
                        <ArrowRight className="h-3 w-3" />
                    </Link>

                    <button
                        onClick={handleDismiss}
                        className="rounded p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700 transition-colors"
                        title="Dismiss notice"
                        aria-label="Dismiss notification"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* 10-second auto-dismiss progress countdown line */}
            <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-black/5 overflow-hidden">
                <div
                    className={cn(
                        'h-full',
                        (isOverdue || isEscalated) && 'bg-rose-500/70',
                        isWarning && 'bg-amber-500/70',
                        isReceipt && 'bg-blue-500/70',
                    )}
                    style={{
                        animation: `tngToastCountdown ${duration}ms linear forwards`,
                    }}
                />
            </div>
        </div>
    );
}
