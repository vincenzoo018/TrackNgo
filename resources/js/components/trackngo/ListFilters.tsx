import { Filter, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatCard } from '@/components/trackngo/StatCard';

const filterSelectClass =
    'bg-white border border-[var(--tng-slate-200)] rounded-lg text-xs font-medium text-[var(--tng-slate-700)] py-2 px-3 focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none';

type FilterToolbarProps = {
    search: string;
    /** Typing in the search box */
    onSearchChange: (value: string) => void;
    /** The search box's Clear button */
    onSearchClear: () => void;
    searchPlaceholder: string;
    /** Tags for the dropdown filters; a Keyword tag for the search is added in front */
    filterTags: FilterTag[];
    /** "Reset all": clear the search and every filter */
    onResetFilters: () => void;
    /** Dropdown filters beside the search box */
    children: ReactNode;
};

/** Card holding a list page's search box, its dropdown filters and the active filter tags. */
export function FilterToolbar({ search, onSearchChange, onSearchClear, searchPlaceholder, filterTags, onResetFilters, children }: FilterToolbarProps) {
    return (
        <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="w-full pl-10 pr-4 py-2 bg-[var(--tng-slate-50)] border border-[var(--tng-slate-200)] rounded-lg text-sm text-[var(--tng-slate-900)] placeholder-[var(--tng-slate-400)] focus:bg-white focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] transition-all outline-none"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={onSearchClear}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--tng-slate-400)] hover:text-[var(--tng-slate-600)]"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Dropdown Filters */}
                <div className="flex items-center gap-2 flex-wrap">{children}</div>
            </div>

            <ActiveFilterTags tags={[{ active: !!search, label: <>Keyword: "{search}"</> }, ...filterTags]} onReset={onResetFilters} />
        </div>
    );
}

/** Stand-alone search box used above the HR tables (employees, departments, leave). */
export function SearchInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tng-slate-400)]" />
            <input
                type="text"
                placeholder="Search by reference number, tracking number, type, or name..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-full rounded-lg border border-[var(--tng-slate-200)] bg-white pl-9 pr-4 text-sm text-[var(--tng-slate-700)] placeholder:text-[var(--tng-slate-400)] focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
            />
        </div>
    );
}

type FilterSelectProps = {
    value: string;
    onChange: (value: string) => void;
    /** Extra classes, e.g. a max width for long option labels */
    className?: string;
    /** Prefix the funnel icon (used on a list's main filter) */
    withIcon?: boolean;
    children: ReactNode;
};

export function FilterSelect({ value, onChange, className, withIcon = false, children }: FilterSelectProps) {
    const select = (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={className ? `${filterSelectClass} ${className}` : filterSelectClass}
        >
            {children}
        </select>
    );

    if (!withIcon) {
        return select;
    }

    return (
        <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[var(--tng-slate-400)]" />
            {select}
        </div>
    );
}

export type DateRange = 'all' | 'today' | '7days' | '30days';

export function DateRangeSelect({ value, onChange }: { value: DateRange; onChange: (value: DateRange) => void }) {
    return (
        <FilterSelect value={value} onChange={(v) => onChange(v as DateRange)}>
            <option value="all">All Time</option>
            <option value="today">Past 24 Hours</option>
            <option value="7days">Past 7 Days</option>
            <option value="30days">Past 30 Days</option>
        </FilterSelect>
    );
}

type DepartmentSelectProps = {
    value: string;
    onChange: (value: string) => void;
    departments: Array<{ department_id: number | string; department_name: string; code?: string | null }>;
    className?: string;
};

/** Filter by department name; options read "[CODE] Department Name". */
export function DepartmentSelect({ value, onChange, departments, className }: DepartmentSelectProps) {
    return (
        <FilterSelect value={value} onChange={onChange} className={className}>
            <option value="all">All Departments</option>
            {departments.map((dept) => (
                <option key={dept.department_id} value={dept.department_name}>
                    {dept.code ? `[${dept.code}] ` : ''}
                    {dept.department_name}
                </option>
            ))}
        </FilterSelect>
    );
}

export type FilterTag = {
    /** Shown only while this filter is applied */
    active: boolean;
    label: ReactNode;
    className?: string;
};

/** "Active Filters:" tags with a Reset all link; renders nothing while no filter is applied. */
function ActiveFilterTags({ tags, onReset }: { tags: FilterTag[]; onReset: () => void }) {
    const active = tags.filter((tag) => tag.active);

    if (active.length === 0) {
        return null;
    }

    return (
        <div className="flex items-center gap-2 pt-2 border-t border-[var(--tng-slate-100)] text-xs text-[var(--tng-slate-500)] flex-wrap">
            <span>Active Filters:</span>
            {active.map((tag, i) => (
                <span
                    key={i}
                    className={`inline-flex items-center px-2 py-0.5 rounded bg-[var(--tng-slate-100)] text-[var(--tng-slate-700)]${tag.className ? ` ${tag.className}` : ''}`}
                >
                    {tag.label}
                </span>
            ))}
            <button type="button" onClick={onReset} className="text-[var(--tng-blue-600)] hover:underline ml-1 font-medium">
                Reset all
            </button>
        </div>
    );
}

export type StatFilterCard = {
    /** Status filter value the card selects */
    filter: string;
    title: string;
    value: number;
    sublabel: string;
    icon: LucideIcon;
};

/** Row of KPI cards that double as status filters: clicking a card selects its status. */
export function StatFilterCards({ cards, active, onSelect }: { cards: StatFilterCard[]; active: string; onSelect: (filter: string) => void }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
            {cards.map((card) => (
                <StatCard
                    key={card.filter}
                    title={card.title}
                    value={card.value}
                    sublabel={card.sublabel}
                    icon={card.icon}
                    active={active === card.filter}
                    onClick={() => onSelect(card.filter)}
                />
            ))}
        </div>
    );
}
