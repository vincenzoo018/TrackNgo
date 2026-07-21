import { cn } from '@/lib/utils';
import { AlertTriangle, Info } from 'lucide-react';

type SlaAlertProps = {
    variant: 'breach' | 'action';
    title: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    className?: string;
};

export function SlaAlert({ variant, title, message, actionLabel, onAction, className }: SlaAlertProps) {
    const isBreach = variant === 'breach';

    return (
        <div
            className={cn(
                'flex items-center justify-between rounded-xl border px-5 py-3.5 transition-all duration-200',
                isBreach
                    ? 'border-red-200 bg-red-50'
                    : 'border-amber-200 bg-amber-50',
                className,
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full',
                    isBreach ? 'bg-red-100' : 'bg-amber-100',
                )}>
                    {isBreach ? (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                        <Info className="h-4 w-4 text-amber-600" />
                    )}
                </div>
                <div>
                    <p className={cn(
                        'text-sm font-semibold',
                        isBreach ? 'text-red-800' : 'text-amber-800',
                    )}>
                        {title}
                    </p>
                    <p className={cn(
                        'text-xs',
                        isBreach ? 'text-red-600' : 'text-amber-600',
                    )}>
                        {message}
                    </p>
                </div>
            </div>
            {actionLabel && (
                <button
                    onClick={onAction}
                    className={cn(
                        'shrink-0 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors',
                        isBreach
                            ? 'border-red-300 bg-white text-red-700 hover:bg-red-50'
                            : 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50',
                    )}
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
