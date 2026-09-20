import { cn } from '@/lib/utils';
import { useEffect, useState, ReactNode, isValidElement } from 'react';
import { Link } from '@inertiajs/react';
import { ArrowUpRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type StatCardProps = {
    title?: string;
    label?: string; // backwards compatibility
    value: number | string;
    sublabel?: string;
    subtitle?: string; // backwards compatibility
    icon?: LucideIcon | ReactNode;
    color?: string; // accepted for backwards compatibility, always uses system blue design
    href?: string;
    onClick?: () => void;
    active?: boolean;
    className?: string;
};

export function StatCard({
    title,
    label,
    value,
    sublabel,
    subtitle,
    icon,
    href,
    onClick,
    active = false,
    className,
}: StatCardProps) {
    const displayTitle = title || label || '';
    const displaySublabel = sublabel || subtitle || '';
    
    // Numeric count-up animation if value is numeric
    const isNumeric = typeof value === 'number';
    const numericTarget = isNumeric ? (value as number) : 0;
    const [displayNumeric, setDisplayNumeric] = useState(isNumeric ? 0 : value);

    useEffect(() => {
        if (!isNumeric) {
            setDisplayNumeric(value);
            return;
        }

        if (numericTarget === 0) {
            setDisplayNumeric(0);
            return;
        }

        const duration = 650;
        const steps = 25;
        const stepDuration = duration / steps;
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const progress = currentStep / steps;
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayNumeric(Math.round(eased * numericTarget));

            if (currentStep >= steps) {
                clearInterval(timer);
                setDisplayNumeric(numericTarget);
            }
        }, stepDuration);

        return () => clearInterval(timer);
    }, [value, isNumeric, numericTarget]);

    // Icon rendering helper (supports both forwardRef components like Lucide icons and pre-rendered JSX elements)
    const renderIcon = () => {
        if (!icon) return null;
        if (isValidElement(icon)) {
            return icon;
        }
        const IconComponent = icon as any;
        return <IconComponent className="h-4 w-4 text-[#0066cc] stroke-[2.2]" />;
    };

    const isClickable = Boolean(href || onClick);

    const cardInner = (
        <div className="flex h-full flex-col justify-between gap-2.5">
            {/* Top row: 16px bold uppercase title + optional minimal icon / arrow */}
            <div className="flex items-center justify-between gap-2">
                <span className="text-[16px] font-bold uppercase tracking-wider text-slate-700 truncate select-none">
                    {displayTitle}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                    {icon && (
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0066cc] transition-transform group-hover:scale-105">
                            {renderIcon()}
                        </div>
                    )}
                    {isClickable && (
                        <ArrowUpRight className="h-4 w-4 text-slate-400 opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-200" />
                    )}
                </div>
            </div>

            {/* Middle & Bottom: 28px bold value + 12px muted sub-label */}
            <div className="mt-auto">
                <div className="text-[28px] font-bold leading-tight tracking-tight text-slate-900 tabular-nums select-none">
                    {isNumeric ? Number(displayNumeric).toLocaleString() : displayNumeric}
                </div>
                {displaySublabel && (
                    <p className="mt-1 text-[12px] font-normal leading-normal text-slate-500 select-none line-clamp-1">
                        {displaySublabel}
                    </p>
                )}
            </div>
        </div>
    );

    const baseStyles = cn(
        'group relative block w-full min-h-[115px] rounded-xl p-4 lg:p-5 text-slate-800 transition-all duration-200 select-none overflow-hidden',
        // Design specifications: All white background, clean neutral border
        'bg-white border border-slate-200 shadow-xs',
        // Hover state: Slight shadow (box-shadow: 0 2px 6px rgba(0,0,0,0.1))
        'hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:border-slate-300',
        isClickable && 'cursor-pointer active:scale-[0.99]',
        active && 'ring-2 ring-[#0066cc]/40 border-[#0066cc] bg-slate-50/50 shadow-[0_2px_6px_rgba(0,102,204,0.1)]',
        className
    );

    if (href) {
        return (
            <Link href={href} className={baseStyles}>
                {cardInner}
            </Link>
        );
    }

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                className={cn(baseStyles, 'text-left')}
            >
                {cardInner}
            </button>
        );
    }

    return <div className={baseStyles}>{cardInner}</div>;
}

export default StatCard;
