import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export type DocumentStatus = 'submitted' | 'received' | 'in_progress' | 'escalated' | 'approved' | 'rejected' | 'archived';

const STATUS_CONFIG: Record<DocumentStatus, { label: string; bg: string; text: string; dot: string }> = {
    submitted: { label: 'SUBMITTED', bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
    received: { label: 'RECEIVED', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
    in_progress: { label: 'IN PROGRESS', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
    escalated: { label: 'ESCALATED', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500 animate-pulse' },
    approved: { label: 'APPROVED', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    rejected: { label: 'REJECTED', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-500' },
    archived: { label: 'ARCHIVED', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

type SeverityPillProps = {
    status: DocumentStatus;
    className?: string;
};

export function SeverityPill({ status, className }: SeverityPillProps) {
    const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.submitted;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide',
                config.bg,
                config.text,
                status === 'escalated' && 'tng-pulse-overdue',
                className,
            )}
        >
            <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
            {config.label}
        </span>
    );
}

export function UrgentBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 shadow-sm animate-pulse">
            <AlertCircle className="h-3.5 w-3.5" />
            URGENT
        </span>
    );
}

export function SpClearedBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--tng-purple-200)] bg-[var(--tng-purple-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--tng-purple-700)] shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5" />
            SP Cleared
        </span>
    );
}
