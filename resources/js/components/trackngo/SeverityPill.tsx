import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { getStandardizedStatus, STATUS_STYLE_CONFIG, StandardizedStatus } from '@/lib/status-helper';

export type DocumentStatus = 
    | StandardizedStatus 
    | 'pending_registration' 
    | 'submitted' 
    | 'registered' 
    | 'accepted' 
    | 'dept_accepted' 
    | 'endorsed' 
    | 'mayor_accepted' 
    | 'reviewed' 
    | 'approved' 
    | 'released' 
    | 'completed' 
    | 'escalated' 
    | 'rejected' 
    | 'archived' 
    | 'routed'
    | string;

type SeverityPillProps = {
    status: DocumentStatus;
    className?: string;
    useStandardized?: boolean;
};

export function SeverityPill({ status, className, useStandardized = true }: SeverityPillProps) {
    const stdStatus = getStandardizedStatus(status);
    const config = STATUS_STYLE_CONFIG[stdStatus];

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium tracking-normal border transition-all duration-200 shadow-2xs',
                config.bg,
                config.text,
                config.border,
                className
            )}
        >
            <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
            {config.label}
        </span>
    );
}

export function UrgentBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[12px] font-semibold text-red-700 shadow-2xs">
            <AlertCircle className="h-3 w-3 text-red-600" />
            URGENT
        </span>
    );
}

export function SpClearedBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--tng-purple-200)] bg-[var(--tng-purple-50)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--tng-purple-700)] shadow-2xs">
            <CheckCircle2 className="h-3 w-3" />
            SP Cleared
        </span>
    );
}
