import { Send, Clock, Forward } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HolderStatusCardProps = {
    variant: 'sent' | 'waiting' | 'forwarded';
    title: string;
    holder: string;
    message?: string;
    className?: string;
};

const VARIANTS = {
    sent: { icon: Send, box: 'border-emerald-200 bg-emerald-50', title: 'text-emerald-800', text: 'text-emerald-700' },
    waiting: { icon: Clock, box: 'border-amber-200 bg-amber-50', title: 'text-amber-800', text: 'text-amber-700' },
    forwarded: { icon: Forward, box: 'border-slate-200 bg-slate-50', title: 'text-slate-800', text: 'text-slate-600' },
} as const;

/**
 * Read-only replacement for a role's action buttons while another user holds the document
 * (e.g. the clerk after sending, or the Mayor before the Department Head endorses it).
 */
export function HolderStatusCard({ variant, title, holder, message, className }: HolderStatusCardProps) {
    const v = VARIANTS[variant];
    const Icon = v.icon;

    return (
        <div className={cn('rounded-[8px] border p-4 text-center', v.box, className)} role="status">
            <p className={cn('flex items-center justify-center gap-1.5 text-[14px] font-semibold', v.title)}>
                <Icon className="h-4 w-4" />
                {title}
            </p>
            <p className={cn('mt-1.5 text-[13px]', v.text)}>
                Now with <span className="font-semibold">{holder}</span>
            </p>
            {message && <p className={cn('mt-1 text-[12px]', v.text)}>{message}</p>}
        </div>
    );
}
