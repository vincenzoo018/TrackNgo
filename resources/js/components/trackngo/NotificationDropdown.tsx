import React, { useState, useRef, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import { Bell, AlertTriangle, AlertCircle, Flame, CheckCheck, Clock, Building2, FileText, ArrowRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationItem } from './NotificationBanner';

export interface NotificationCounts {
    total: number;
    received: number;
    warning: number;
    overdue: number;
    escalated: number;
}

interface NotificationDropdownProps {
    counts: NotificationCounts;
    items: NotificationItem[];
    onMarkAllRead?: () => void;
    onItemClick?: (id: string) => void;
}

export function NotificationDropdown({
    counts,
    items,
    onMarkAllRead,
    onItemClick,
}: NotificationDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'received' | 'warning' | 'overdue' | 'escalated'>('all');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Filter items based on active tab
    const filteredItems = items.filter((item) => {
        if (activeTab === 'all') return true;
        if (activeTab === 'received') return item.type === 'receipt' || item.severity === 'normal';
        if (activeTab === 'warning') return item.severity === 'warning';
        if (activeTab === 'overdue') return item.severity === 'overdue';
        if (activeTab === 'escalated') return item.severity === 'escalated';
        return true;
    });

    const hasUnread = counts.total > 0;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Notification Bell Button with live count badge */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    'relative rounded-lg p-2 text-[var(--tng-slate-500)] transition-colors hover:bg-[var(--tng-slate-100)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20',
                    isOpen && 'bg-[var(--tng-slate-100)] text-[var(--tng-blue-600)]'
                )}
                title="Notifications"
                aria-label={`Notifications: ${counts.total} active`}
            >
                <Bell className="h-5 w-5" />
                {hasUnread && (
                    <span className="absolute right-1 top-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-2xs animate-in zoom-in-50 duration-150">
                        {counts.total > 99 ? '99+' : counts.total}
                    </span>
                )}
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[340px] sm:w-[420px] max-w-[92vw] z-50 rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-[var(--tng-blue-700)]">
                                {counts.total} active
                            </span>
                        </div>

                        {onMarkAllRead && hasUnread && (
                            <button
                                onClick={() => {
                                    onMarkAllRead();
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--tng-blue-600)] hover:text-[var(--tng-blue-800)] hover:underline"
                            >
                                <CheckCheck className="h-3.5 w-3.5" />
                                <span>Mark all as read</span>
                            </button>
                        )}
                    </div>

                    {/* Filter Tabs with Dynamic Counts */}
                    <div className="flex border-b border-slate-100 bg-white px-2 pt-1 text-[12px] overflow-x-auto tng-scrollbar">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={cn(
                                'px-2.5 py-1.5 font-medium border-b-2 transition-colors whitespace-nowrap',
                                activeTab === 'all'
                                    ? 'border-[var(--tng-blue-600)] text-[var(--tng-blue-600)] font-semibold'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            )}
                        >
                            All ({counts.total})
                        </button>
                        <button
                            onClick={() => setActiveTab('received')}
                            className={cn(
                                'px-2.5 py-1.5 font-medium border-b-2 transition-colors whitespace-nowrap',
                                activeTab === 'received'
                                    ? 'border-[var(--tng-blue-600)] text-[var(--tng-blue-600)] font-semibold'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            )}
                        >
                            Received ({counts.received})
                        </button>
                        <button
                            onClick={() => setActiveTab('warning')}
                            className={cn(
                                'px-2.5 py-1.5 font-medium border-b-2 transition-colors whitespace-nowrap',
                                activeTab === 'warning'
                                    ? 'border-amber-500 text-amber-700 font-semibold'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            )}
                        >
                            Warning ({counts.warning})
                        </button>
                        <button
                            onClick={() => setActiveTab('overdue')}
                            className={cn(
                                'px-2.5 py-1.5 font-medium border-b-2 transition-colors whitespace-nowrap',
                                activeTab === 'overdue'
                                    ? 'border-rose-600 text-rose-700 font-semibold'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            )}
                        >
                            Overdue ({counts.overdue})
                        </button>
                        {counts.escalated > 0 && (
                            <button
                                onClick={() => setActiveTab('escalated')}
                                className={cn(
                                    'px-2.5 py-1.5 font-medium border-b-2 transition-colors whitespace-nowrap',
                                    activeTab === 'escalated'
                                        ? 'border-rose-600 text-rose-700 font-semibold'
                                        : 'border-transparent text-slate-500 hover:text-slate-800'
                                )}
                            >
                                Escalated ({counts.escalated})
                            </button>
                        )}
                    </div>

                    {/* Notification Items List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 tng-scrollbar">
                        {filteredItems.length > 0 ? (
                            filteredItems.map((item) => {
                                const isOverdue = item.severity === 'overdue';
                                const isEscalated = item.severity === 'escalated';
                                const isWarning = item.severity === 'warning';
                                const isReceipt = item.severity === 'normal' || item.type === 'receipt';

                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            'p-3.5 transition-colors hover:bg-slate-50 flex items-start gap-3 group',
                                            (isOverdue || isEscalated) && 'hover:bg-rose-50/40',
                                            isWarning && 'hover:bg-amber-50/40',
                                            isReceipt && 'hover:bg-blue-50/30'
                                        )}
                                    >
                                        {/* Severity Icon */}
                                        <div
                                            className={cn(
                                                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-2xs',
                                                (isOverdue || isEscalated) && 'bg-rose-100 text-rose-600',
                                                isWarning && 'bg-amber-100 text-amber-600',
                                                isReceipt && 'bg-blue-100 text-[var(--tng-blue-600)]'
                                            )}
                                        >
                                            {isEscalated && <Flame className="h-4 w-4" />}
                                            {isOverdue && <AlertCircle className="h-4 w-4" />}
                                            {isWarning && <AlertTriangle className="h-4 w-4" />}
                                            {isReceipt && <Bell className="h-4 w-4" />}
                                        </div>

                                        {/* Details */}
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <div className="flex items-center justify-between gap-1">
                                                <p className="text-xs font-bold text-slate-900 line-clamp-1">
                                                    {item.title}
                                                </p>
                                                <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1 font-mono">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                                                {item.reference_number && (
                                                    <span className="font-mono font-medium text-slate-700">
                                                        {item.reference_number}
                                                    </span>
                                                )}
                                                {item.document_type && (
                                                    <span>• {item.document_type}</span>
                                                )}
                                                {item.originating_department && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Building2 className="h-2.5 w-2.5 text-slate-400" />
                                                        {item.originating_department}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Quick Action Link */}
                                            <div className="pt-1">
                                                <Link
                                                    href={item.action_url}
                                                    onClick={() => {
                                                        if (onItemClick) onItemClick(item.id);
                                                        setIsOpen(false);
                                                    }}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 text-[11px] font-semibold transition-colors',
                                                        (isOverdue || isEscalated) && 'text-rose-600 hover:text-rose-800',
                                                        isWarning && 'text-amber-600 hover:text-amber-800',
                                                        isReceipt && 'text-[var(--tng-blue-600)] hover:text-[var(--tng-blue-800)]'
                                                    )}
                                                >
                                                    <span>Open Document Details + FSM view</span>
                                                    <ArrowRight className="h-3 w-3" />
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No {activeTab !== 'all' ? activeTab : ''} notifications found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
