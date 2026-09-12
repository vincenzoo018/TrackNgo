import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StatCardProps = {
    label: string;
    value: number;
    subtitle?: string;
    icon: LucideIcon;
    color: 'green' | 'blue' | 'amber' | 'red' | 'purple' | 'emerald';
    href?: string;
    className?: string;
};

const COLOR_MAP = {
    green: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        value: 'text-emerald-600',
        icon: 'bg-emerald-100 text-emerald-600',
        hoverBorder: 'hover:border-emerald-400',
    },
    blue: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-700',
        value: 'text-blue-600',
        icon: 'bg-blue-100 text-blue-600',
        hoverBorder: 'hover:border-blue-400',
    },
    amber: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        value: 'text-amber-600',
        icon: 'bg-amber-100 text-amber-600',
        hoverBorder: 'hover:border-amber-400',
    },
    red: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        value: 'text-red-600',
        icon: 'bg-red-100 text-red-600',
        hoverBorder: 'hover:border-red-400',
    },
    purple: {
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-700',
        value: 'text-purple-600',
        icon: 'bg-purple-100 text-purple-600',
        hoverBorder: 'hover:border-purple-400',
    },
    emerald: {
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-700',
        value: 'text-emerald-600',
        icon: 'bg-emerald-100 text-emerald-600',
        hoverBorder: 'hover:border-emerald-400',
    },
};

export function StatCard({ label, value, subtitle, icon: Icon, color, href, className }: StatCardProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const colors = COLOR_MAP[color];

    useEffect(() => {
        if (value === 0) { setDisplayValue(0); return; }

        const duration = 800;
        const steps = 30;
        const stepDuration = duration / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(Math.round(eased * value));

            if (currentStep >= steps) {
                clearInterval(timer);
                setDisplayValue(value);
            }
        }, stepDuration);

        return () => clearInterval(timer);
    }, [value]);

    const cardInner = (
        <div className="flex items-start justify-between">
            <div>
                <p className={cn('text-3xl font-bold tabular-nums tracking-tight', colors.value)}>
                    {displayValue}
                </p>
                <p className={cn('mt-0.5 text-sm font-semibold flex items-center gap-1', colors.text)}>
                    {label}
                    {href && (
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-slate-500" />
                    )}
                </p>
                {subtitle && (
                    <p className="mt-0.5 text-xs text-[var(--tng-slate-500)]">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className={cn('rounded-lg p-2 transition-transform group-hover:scale-110', colors.icon)}>
                <Icon className="h-5 w-5" />
            </div>
        </div>
    );

    if (href) {
        return (
            <Link
                href={href}
                className={cn(
                    'group block rounded-xl border p-4 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
                    colors.bg,
                    colors.border,
                    colors.hoverBorder,
                    className,
                )}
            >
                {cardInner}
            </Link>
        );
    }

    return (
        <div
            className={cn(
                'rounded-xl border p-4 transition-all duration-200 hover:shadow-md',
                colors.bg,
                colors.border,
                className,
            )}
        >
            {cardInner}
        </div>
    );
}
