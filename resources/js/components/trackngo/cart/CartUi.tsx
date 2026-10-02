import { Link } from '@inertiajs/react';
import { ChevronDown, Lock, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { EscalationLevel, MonitorRow, MonitorStatus } from '@/lib/cart';
import { LEVEL_HINT, LEVEL_STYLE, MONITOR_STATUS, remainingLabel } from '@/lib/cart';
import { cn } from '@/lib/utils';

/** Building blocks shared by the CART pages, so every module reads the same way. */

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-[20px] font-bold leading-tight text-slate-900">{title}</h1>
                {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
            </div>
            {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}

export function Panel({
    title,
    description,
    aside,
    children,
    className,
    bodyClassName,
}: {
    title?: ReactNode;
    description?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
}) {
    return (
        <section className={cn('overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs', className)}>
            {(title || aside) && (
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0">
                        {title && <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>}
                        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
                    </div>
                    {aside}
                </header>
            )}
            <div className={bodyClassName}>{children}</div>
        </section>
    );
}

export function StatusBadge({ status, className }: { status: MonitorStatus; className?: string }) {
    const config = MONITOR_STATUS[status] ?? MONITOR_STATUS.within_time;
    const Icon = config.icon;

    return (
        <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', config.badge, className)}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {config.short}
        </span>
    );
}

export function LevelBadge({ level }: { level: EscalationLevel | null | undefined }) {
    if (!level) {
        return <span className="text-xs text-slate-400">—</span>;
    }

    return (
        <span title={LEVEL_HINT[level]} className={cn('inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', LEVEL_STYLE[level])}>
            {level}
        </span>
    );
}

/** Elapsed vs allowed processing time (WD of L), coloured by the time status */
export function TimeMeter({ row, className }: { row: Pick<MonitorRow, 'elapsed_days' | 'allowed_days' | 'arta_status' | 'is_closed' | 'remaining_days' | 'overdue_days' | 'completed_late'>; className?: string }) {
    const percent = row.allowed_days > 0 ? Math.min(100, (row.elapsed_days / row.allowed_days) * 100) : 100;
    const config = MONITOR_STATUS[row.arta_status];

    return (
        <div className={cn('min-w-[140px]', className)} title={`${row.elapsed_days} of ${row.allowed_days} days used`}>
            <div className="flex items-baseline justify-between gap-2 text-xs whitespace-nowrap">
                <span className={cn('font-medium', row.is_closed ? 'text-slate-600' : config.text)}>{remainingLabel(row)}</span>
                <span className="tabular-nums text-slate-400">
                    {row.elapsed_days}/{row.allowed_days}d
                </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={cn('h-full rounded-full', config.bar)} style={{ width: `${Math.max(percent, 4)}%` }} />
            </div>
        </div>
    );
}

export function DocLink({ row, className }: { row: Pick<MonitorRow, 'id' | 'tracking_number'>; className?: string }) {
    return (
        <Link href={`/cart/monitoring/${row.id}`} className={cn('font-medium whitespace-nowrap text-[#0066cc] hover:underline', className)}>
            {row.tracking_number}
        </Link>
    );
}

export function DocTitle({ row, detail }: { row: Pick<MonitorRow, 'title' | 'is_confidential' | 'document_type'>; detail?: string }) {
    return (
        <div className="min-w-0">
            <p className="flex items-center gap-1 truncate text-[13px] text-slate-800" title={row.title}>
                {row.is_confidential && <Lock className="h-3 w-3 shrink-0 text-slate-400" aria-label="Confidential" />}
                <span className="truncate">{row.title}</span>
            </p>
            <p className="truncate text-xs text-slate-500">
                {row.document_type}
                {detail ? ` · ${detail}` : ''}
            </p>
        </div>
    );
}

export function EmptyState({ icon: Icon, title, message, className }: { icon: LucideIcon; title: string; message?: string; className?: string }) {
    return (
        <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Icon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
            {message && <p className="mt-1 max-w-sm text-xs text-slate-500">{message}</p>}
        </div>
    );
}

// ── Filters ────────────────────────────────────────────────────────────────────────────────────

const control = 'h-9 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-700 shadow-2xs transition-colors hover:border-slate-300 focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/15';

/**
 * Filters in an even grid (4 columns on desktop). On phones only the search shows, with a "Filters"
 * button that reveals the rest — so the list is not pushed below a stack of dropdowns.
 */
export function FilterBar({
    search,
    children,
    activeCount = 0,
    searchClassName,
}: {
    search?: ReactNode;
    children?: ReactNode;
    activeCount?: number;
    /** Column span of the search box (two columns by default) */
    searchClassName?: string;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex gap-2 sm:contents">
                {search && <div className={cn('min-w-0 flex-1 sm:col-span-2', searchClassName)}>{search}</div>}
                {children && (
                    <button
                        type="button"
                        onClick={() => setOpen((value) => !value)}
                        aria-expanded={open}
                        className={cn(control, 'inline-flex shrink-0 items-center justify-center gap-1.5 px-3 font-medium sm:hidden', !search && 'w-full')}
                    >
                        <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                        Filters
                        {activeCount > 0 && <span className="rounded-full bg-[#0066cc] px-1.5 text-[11px] font-semibold text-white">{activeCount}</span>}
                    </button>
                )}
            </div>
            {children && <div className={cn(open ? 'grid grid-cols-1 gap-2' : 'hidden', 'sm:contents')}>{children}</div>}
        </div>
    );
}

export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (value: string) => void; placeholder: string; className?: string }) {
    return (
        <div className={cn('relative w-full', className)}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={cn(control, 'w-full pl-9 pr-8 placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden')}
            />
            {value && (
                <button type="button" onClick={() => onChange('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

export function SelectFilter({
    value,
    onChange,
    label,
    options,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    /** Shown as the "any" option, e.g. "All departments" */
    label: string;
    options: { value: string; label: string }[];
    className?: string;
}) {
    return (
        <div className={cn('relative', className)}>
            <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className={cn(control, 'w-full cursor-pointer appearance-none truncate pl-3 pr-8', value && 'border-[var(--tng-blue-500)]/50 bg-blue-50/40')}>
                <option value="">{label}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
    );
}

/** From – to date pair in one control (takes two filter columns) */
export function DateRangeFilter({ from, to, onChange, label = 'Received' }: { from: string; to: string; onChange: (from: string, to: string) => void; label?: string }) {
    return (
        <div className={cn(control, 'flex items-center gap-1.5 px-3 sm:col-span-2')}>
            <span className="shrink-0 text-xs text-slate-500">{label}</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} aria-label={`${label} from`} className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-700 outline-none" />
            <span className="text-slate-300">–</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} aria-label={`${label} to`} className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-700 outline-none" />
        </div>
    );
}

export function ResetButton({ onClick, label = 'Clear filters' }: { onClick: () => void; label?: string }) {
    return (
        <button type="button" onClick={onClick} className="inline-flex h-8 items-center justify-center gap-1.5 justify-self-start rounded-lg px-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <RotateCcw className="h-3.5 w-3.5" />
            {label}
        </button>
    );
}

export const buttonStyles = {
    primary: 'inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0066cc] px-3.5 py-2 text-[13px] font-medium text-white shadow-xs transition-colors hover:bg-[#005bb5] disabled:cursor-not-allowed disabled:opacity-50',
    secondary: 'inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
    ghost: 'inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40',
};

/** Table cell / header styles used by every CART table */
export const tableStyles = {
    table: 'w-full border-collapse text-left text-[13px] text-slate-700',
    head: 'border-b border-slate-200 bg-slate-50/80',
    th: 'whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-slate-500 first:pl-4 sm:first:pl-5 last:pr-4 sm:last:pr-5',
    row: 'border-b border-slate-100 align-top transition-colors last:border-0 hover:bg-slate-50/70',
    td: 'px-3 py-3 first:pl-4 sm:first:pl-5 last:pr-4 sm:last:pr-5',
};
