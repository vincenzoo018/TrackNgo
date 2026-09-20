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
        label = `ARTA Overdue (${Math.abs(daysLeft)}d past)`;
        bgColor = 'bg-red-50 border border-red-200';
        textColor = 'text-red-700 font-semibold';
    } else if (isUrgent) {
        label = 'ARTA (0d left)';
        bgColor = 'bg-amber-50 border border-amber-200';
        textColor = 'text-amber-700 font-medium';
    } else if (isMet) {
        label = `ARTA (${daysLeft}d met)`;
        bgColor = 'bg-emerald-50 border border-emerald-200';
        textColor = 'text-emerald-700 font-normal';
    } else {
        label = `ARTA (${daysLeft}d left)`;
        bgColor = 'bg-slate-100 border border-slate-200';
        textColor = 'text-slate-600 font-normal';
    }

    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md px-2 py-0.5 text-[12px] whitespace-nowrap',
                bgColor,
                textColor,
                className,
            )}
        >
            {label}
        </span>
    );
}
