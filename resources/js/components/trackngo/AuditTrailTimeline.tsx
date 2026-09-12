import React from 'react';
import { cn } from '@/lib/utils';
import { 
    CheckCircle2, 
    Send, 
    RotateCcw, 
    Forward, 
    FileSearch, 
    FileText, 
    Paperclip, 
    Download,
    History,
    Shield,
    Clock
} from 'lucide-react';

export interface AuditActionEntry {
    _id?: string;
    id?: number | string;
    audit_id?: number | string;
    action?: string;
    action_type?: string;
    description?: string;
    user_name?: string;
    user_role?: string;
    department?: string;
    document_ref?: string;
    tracking_number?: string;
    timestamp?: string;
    formatted_time?: string;
    created_at?: string;
    _date?: Date;
    file_name?: string;
    file_size?: number;
    url?: string | null;
    reason?: string;
    _type?: 'action' | 'attachment' | 'comment';
}

interface AuditTrailTimelineProps {
    entries: AuditActionEntry[];
    documentRef?: string;
    className?: string;
    emptyMessage?: string;
}

function formatBytes(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getActionStyle(actionName?: string) {
    const act = (actionName || '').toLowerCase();
    if (act.includes('submit') || act.includes('create') || act.includes('register')) {
        return {
            color: 'text-blue-600',
            bg: 'bg-blue-50 text-blue-800 border-blue-200',
            dot: 'border-[#0066cc] text-[#0066cc]',
            icon: Send,
        };
    }
    if (act.includes('approve') || act.includes('accept') || act.includes('complete')) {
        return {
            color: 'text-emerald-600',
            bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            dot: 'border-emerald-600 text-emerald-600',
            icon: CheckCircle2,
        };
    }
    if (act.includes('return') || act.includes('reject')) {
        return {
            color: 'text-rose-600',
            bg: 'bg-rose-50 text-rose-800 border-rose-200',
            dot: 'border-rose-600 text-rose-600',
            icon: RotateCcw,
        };
    }
    if (act.includes('endorse') || act.includes('forward') || act.includes('route')) {
        return {
            color: 'text-purple-600',
            bg: 'bg-purple-50 text-purple-800 border-purple-200',
            dot: 'border-purple-600 text-purple-600',
            icon: Forward,
        };
    }
    if (act.includes('review')) {
        return {
            color: 'text-indigo-600',
            bg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
            dot: 'border-indigo-600 text-indigo-600',
            icon: FileSearch,
        };
    }
    return {
        color: 'text-slate-600',
        bg: 'bg-slate-100 text-slate-800 border-slate-200',
        dot: 'border-slate-400 text-slate-500',
        icon: FileText,
    };
}

export function AuditTrailTimeline({
    entries = [],
    documentRef,
    className,
    emptyMessage = 'No audit trail actions recorded yet.',
}: AuditTrailTimelineProps) {
    if (!entries || entries.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400 bg-white rounded-[8px] border border-slate-200/80 p-6">
                <History className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-[14px] font-semibold text-slate-700">{emptyMessage}</p>
                <p className="text-[12px] text-slate-400 mt-0.5">
                    Committed workflow actions will appear here in real time.
                </p>
            </div>
        );
    }

    return (
        <div className={cn('relative pl-7 sm:pl-9', className)}>
            {/* Continuous Vertical Timeline Line */}
            <div 
                className="absolute left-[11px] sm:left-[15px] top-4 bottom-4 w-0.5 bg-slate-200" 
                aria-hidden="true" 
            />

            {/* Stack of Vertical Cards (16–20px spacing) */}
            <div className="space-y-4 sm:space-y-5">
                {entries.map((item, idx) => {
                    const idKey = item._id || item.id || item.audit_id || idx;
                    const actionName = item.action || item.action_type || 'Workflow Action';
                    const style = getActionStyle(actionName);
                    const ActionIcon = style.icon;

                    // Parse date safely
                    let dateStr = item.formatted_time || item.timestamp || item.created_at || '';
                    if (item._date instanceof Date) {
                        dateStr = item._date.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                        });
                    } else if (dateStr && !dateStr.includes(',')) {
                        const parsed = new Date(dateStr);
                        if (!isNaN(parsed.getTime())) {
                            dateStr = parsed.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                            });
                        }
                    }

                    const refNumber = item.document_ref || item.tracking_number || documentRef;
                    const isReturn = actionName.toLowerCase().includes('return');

                    return (
                        <div key={idKey} className="relative group">
                            {/* Circle / Step Marker on the left (on vertical line) */}
                            <div
                                className={cn(
                                    'absolute -left-[23px] sm:-left-[27px] top-4 flex h-6 w-6 items-center justify-center rounded-full bg-white border-2 shadow-xs transition-transform group-hover:scale-105 select-none z-10',
                                    style.dot
                                )}
                                title={actionName}
                            >
                                <span className={cn('h-2 w-2 rounded-full bg-current')} />
                            </div>

                            {/* Vertical Action Card */}
                            <div
                                className={cn(
                                    'rounded-[8px] border bg-white p-4 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm',
                                    isReturn ? 'border-rose-200 bg-rose-50/25' : 'border-slate-200'
                                )}
                            >
                                {/* Header: Action Type (16px semi-bold) + Timestamp (12px muted gray) */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="text-[16px] font-semibold text-slate-900 tracking-tight flex items-center gap-1.5">
                                            <ActionIcon className={cn('h-4 w-4', style.color)} />
                                            <span>{actionName}</span>
                                        </h4>
                                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold border', style.bg)}>
                                            Status: {actionName}
                                        </span>
                                    </div>

                                    {dateStr && (
                                        <span className="text-[12px] font-normal text-slate-400">
                                            {dateStr}
                                        </span>
                                    )}
                                </div>

                                {/* User Details: User name, role, department (14px regular) */}
                                <div className="mt-2.5 text-[14px] font-normal text-slate-600 flex flex-wrap items-center gap-1.5">
                                    <span className="font-semibold text-slate-800">
                                        {item.user_name || 'Authorized Officer'}
                                    </span>
                                    {item.user_role && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-slate-600">{item.user_role}</span>
                                        </>
                                    )}
                                    {item.department && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-slate-500">{item.department}</span>
                                        </>
                                    )}
                                </div>

                                {/* Document Reference (14px regular) */}
                                {refNumber && (
                                    <div className="mt-1 text-[14px] font-normal text-slate-600 flex items-center gap-1.5">
                                        <span className="text-slate-400">Document Ref:</span>
                                        <span className="font-mono text-slate-800 font-medium">
                                            {refNumber}
                                        </span>
                                    </div>
                                )}

                                {/* Attachment file if present */}
                                {item.file_name && (
                                    <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[6px] border border-slate-200 bg-slate-50 p-2 text-xs">
                                        <div className="flex items-center gap-2 truncate">
                                            <Paperclip className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="font-medium text-slate-800 truncate">{item.file_name}</span>
                                            {item.file_size && (
                                                <span className="text-slate-400">({formatBytes(item.file_size)})</span>
                                            )}
                                        </div>
                                        {item.url && (
                                            <a
                                                href={item.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0066cc] hover:underline shrink-0"
                                            >
                                                <Download className="h-3.5 w-3.5" />
                                                View
                                            </a>
                                        )}
                                    </div>
                                )}

                                {/* Description / Observation body (14px regular) */}
                                {item.description && (
                                    <p className="mt-2 text-[14px] text-slate-700 leading-relaxed">
                                        {item.description}
                                    </p>
                                )}

                                {/* Reason if return/reject */}
                                {item.reason && (
                                    <div className="mt-2 rounded-[6px] border border-rose-200 bg-white p-2.5 text-[13px] text-rose-900">
                                        <span className="font-semibold block text-[11px] uppercase tracking-wider text-rose-700 mb-0.5">
                                            Official Reason:
                                        </span>
                                        <p className="text-[14px] text-slate-800 font-medium">
                                            {item.reason}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AuditTrailTimeline;
