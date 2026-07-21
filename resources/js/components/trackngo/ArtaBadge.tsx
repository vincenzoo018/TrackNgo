import { cn } from '@/lib/utils';

type ArtaBadgeProps = {
    daysLeft: number | undefined;
    threshold?: number;
    className?: string;
};

export function ArtaBadge({ daysLeft, threshold, className }: ArtaBadgeProps) {
    if (daysLeft === undefined) return null;

    const isOverdue = daysLeft < 0;
    const isUrgent = daysLeft === 0;
    const isMet = daysLeft > 0 && threshold !== undefined && daysLeft >= threshold;

    let label: string;
    let bgColor: string;
    let textColor: string;

    if (isOverdue) {
        label = `ARTA OVERDUE – ${Math.abs(daysLeft)}D PAST`;
        bgColor = 'bg-red-600';
        textColor = 'text-white';
    } else if (isUrgent) {
        label = 'ARTA 0D LEFT';
        bgColor = 'bg-orange-500';
        textColor = 'text-white';
    } else if (isMet) {
        label = `ARTA ${daysLeft}D MET`;
        bgColor = 'bg-emerald-600';
        textColor = 'text-white';
    } else {
        label = `ARTA ${daysLeft}D LEFT`;
        bgColor = 'bg-[var(--tng-blue-600)]';
        textColor = 'text-white';
    }

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap',
                bgColor,
                textColor,
                isOverdue && 'tng-pulse-overdue',
                className,
            )}
        >
            {label}
        </span>
    );
}
