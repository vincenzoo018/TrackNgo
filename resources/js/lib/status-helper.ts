export type StandardizedStatus = 'Received' | 'Ongoing' | 'Sent' | 'Returned' | 'Approved' | 'Deemed Approved' | 'Vetoed' | 'Completed' | 'Archived';

export const STANDARDIZED_STATUSES: StandardizedStatus[] = ['Received', 'Ongoing', 'Sent', 'Returned', 'Approved', 'Deemed Approved', 'Vetoed', 'Completed', 'Archived'];

export function isFinalizedOrArchived(rawStatus?: string): boolean {
    if (!rawStatus) return false;
    const s = String(rawStatus).toLowerCase().trim().replace(/[-_]/g, ' ');
    return s === 'approved' || s === 'deemed approved' || s === 'vetoed' || s === 'completed' || s === 'archived' || s === 'complete' || s === 'archive';
}

export function getStandardizedStatus(rawStatus?: string): StandardizedStatus {
    if (!rawStatus) return 'Ongoing';
    const s = String(rawStatus).toLowerCase().trim().replace(/[-_]/g, ' ');

    // Finalized & Archived mappings
    if (s === 'approved') {
        return 'Approved';
    }
    // No action within the period: approved by law (RA 11032 Sec. 10 / LGC Sec. 54), waiting for release
    if (s === 'deemed approved') {
        return 'Deemed Approved';
    }
    // An ordinance / resolution vetoed by the Mayor (LGC Sec. 54)
    if (s === 'vetoed') {
        return 'Vetoed';
    }
    if (s === 'completed' || s === 'complete') {
        return 'Completed';
    }
    if (s === 'archived' || s === 'archive') {
        return 'Archived';
    }

    // Received mappings: received, accepted, registered, etc.
    if (
        s === 'received' || 
        s === 'accepted' || 
        s === 'dept accepted' || 
        s === 'mayor accepted' ||
        s === 'registered' ||
        s.includes('receiv')
    ) {
        return 'Received';
    }

    // Returned mappings: returned, rejected, return
    if (
        s === 'returned' || 
        s === 'rejected' || 
        s === 'reject' || 
        s === 'return'
    ) {
        return 'Returned';
    }

    // Sent mappings: sent, submitted, endorsed, forwarded, for release, released, routed
    if (
        s === 'sent' || 
        s === 'submitted' || 
        s === 'endorsed' || 
        s === 'for release' || 
        s === 'released' || 
        s === 'routed' ||
        s.includes('endorse')
    ) {
        return 'Sent';
    }

    // Default to Ongoing: ongoing, in review, reviewed, pending registration, active, pending
    return 'Ongoing';
}

export const STATUS_STYLE_CONFIG: Record<
    StandardizedStatus,
    { label: string; bg: string; text: string; border: string; dot: string; lightBg: string }
> = {
    Received: {
        label: 'Received',
        bg: 'bg-sky-50',
        text: 'text-sky-700',
        border: 'border-sky-200',
        dot: 'bg-sky-500',
        lightBg: 'bg-sky-50/50',
    },
    Ongoing: {
        label: 'Ongoing',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-500 animate-pulse',
        lightBg: 'bg-amber-50/50',
    },
    Sent: {
        label: 'Sent',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        dot: 'bg-blue-500',
        lightBg: 'bg-blue-50/50',
    },
    Returned: {
        label: 'Returned',
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-500',
        lightBg: 'bg-rose-50/50',
    },
    Approved: {
        label: 'Approved',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        dot: 'bg-emerald-500',
        lightBg: 'bg-emerald-50/50',
    },
    'Deemed Approved': {
        label: 'Deemed Approved',
        bg: 'bg-violet-50',
        text: 'text-violet-700',
        border: 'border-violet-200',
        dot: 'bg-violet-500',
        lightBg: 'bg-violet-50/50',
    },
    Vetoed: {
        label: 'Vetoed',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200',
        dot: 'bg-red-500',
        lightBg: 'bg-red-50/50',
    },
    Completed: {
        label: 'Completed',
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        border: 'border-teal-200',
        dot: 'bg-teal-500',
        lightBg: 'bg-teal-50/50',
    },
    Archived: {
        label: 'Archived',
        bg: 'bg-slate-100',
        text: 'text-slate-700',
        border: 'border-slate-300',
        dot: 'bg-slate-500',
        lightBg: 'bg-slate-100/50',
    },
};
