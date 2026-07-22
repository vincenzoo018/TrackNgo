import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export type AuditEntry = {
    id?: number | string;
    audit_id?: number | string;
    action: string;
    description?: string;
    details?: string;
    user?: any;
    timestamp: string;
};

type Props = {
    entries: AuditEntry[];
    className?: string;
};

export function AuditTrailTimeline({ entries, className }: Props) {
    return (
        <div className={cn("rounded-2xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm", className)}>
            <div className="mb-6 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500" />
                <h3 className="text-lg font-bold text-[var(--tng-slate-900)]">Audit Trail</h3>
            </div>
            
            {entries.length > 0 ? (
                <div className="space-y-0 relative">
                    {entries.map((entry, idx) => (
                        <div key={entry.audit_id || entry.id || idx} className="relative pl-8 pb-8 last:pb-0">
                            {/* Vertical Line */}
                            {idx !== entries.length - 1 && (
                                <div className="absolute left-[5px] top-6 bottom-0 w-[2px] bg-[var(--tng-slate-200)]" />
                            )}
                            
                            {/* Dot */}
                            <div className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-[var(--tng-blue-500)] ring-4 ring-white" />
                            
                            {/* Content */}
                            <div className="flex flex-col">
                                <h4 className="text-base font-semibold text-[var(--tng-slate-800)] capitalize">
                                    {(entry.action || '').toLowerCase() === 'submitted' ? 'Document Registered' :
                                     (entry.action || '').toLowerCase() === 'forward' ? 'Document Forwarded' :
                                     (entry.action || '').toLowerCase() === 'endorsed' ? 'Document Endorsed' :
                                     (entry.action || '').toLowerCase() === 'escalated' ? 'Document Escalated' :
                                     (entry.action || '').toLowerCase().includes('document') ? entry.action : `Document ${entry.action}`}
                                </h4>
                                <p className="mt-1 text-sm text-[var(--tng-slate-500)] leading-relaxed">
                                    {entry.details || entry.description}
                                </p>
                                <p className="mt-2 text-xs font-medium text-[var(--tng-slate-400)]">
                                    {entry.user?.name || entry.user_name || entry.user || 'System'} · {new Date(entry.timestamp || entry.created_at).toLocaleString('en-US', {
                                        month: 'numeric',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        hour12: true
                                    })}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-[var(--tng-slate-400)] text-center py-4">No audit history found.</p>
            )}
        </div>
    );
}
