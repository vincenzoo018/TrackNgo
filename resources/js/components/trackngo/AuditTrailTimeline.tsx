import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

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
    defaultExpanded?: boolean;
};

export function AuditTrailTimeline({ entries, className, defaultExpanded = false }: Props) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    return (
        <div className={cn("rounded-2xl border border-[var(--tng-slate-200)] bg-white shadow-sm overflow-hidden", className)}>
            <div 
                className="flex items-center justify-between p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500" />
                    <h3 className="text-lg font-bold text-[var(--tng-slate-900)]">Audit Trail</h3>
                    <span className="ml-2 rounded-full bg-[var(--tng-slate-100)] px-2 py-0.5 text-xs font-semibold text-[var(--tng-slate-600)]">
                        {entries.length}
                    </span>
                </div>
                <div className="text-[var(--tng-slate-400)]">
                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
            </div>
            
            {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-[var(--tng-slate-100)]">
                    {entries.length > 0 ? (
                        <div className="space-y-0 relative mt-4">
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
            )}
        </div>
    );
}
