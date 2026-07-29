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
        bgColor = 'bg-red-100/80';
        textColor = 'text-red-700';
    } else if (isUrgent) {
        label = 'ARTA 0D LEFT';
        bgColor = 'bg-orange-100/80';
        textColor = 'text-orange-700';
    } else if (isMet) {
        label = `ARTA ${daysLeft}D MET`;
        bgColor = 'bg-emerald-100/80';
        textColor = 'text-emerald-700';
    } else {
        label = `ARTA ${daysLeft}D LEFT`;
        bgColor = 'bg-blue-100/80';
        textColor = 'text-blue-700';
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
