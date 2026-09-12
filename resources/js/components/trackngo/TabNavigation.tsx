import React from 'react';
import { cn } from '@/lib/utils';

export interface TabItem<T extends string = string> {
    id: T;
    label: string;
    icon?: React.ReactNode;
    count?: number;
}

interface TabNavigationProps<T extends string = string> {
    tabs: TabItem<T>[];
    activeTab: T;
    onChange: (tabId: T) => void;
    className?: string;
    ariaLabel?: string;
}

export default function TabNavigation<T extends string = string>({
    tabs,
    activeTab,
    onChange,
    className,
    ariaLabel = 'Navigation Tabs',
}: TabNavigationProps<T>) {
    return (
        <div className={cn('w-full', className)}>
            {/* ── Mobile Dropdown (< 640px) ─────────────────────────────────── */}
            <div className="sm:hidden mb-3">
                <label htmlFor="mobile-tab-select" className="sr-only">
                    Select a section
                </label>
                <div className="relative">
                    <select
                        id="mobile-tab-select"
                        value={activeTab}
                        onChange={(e) => onChange(e.target.value as T)}
                        className="block w-full rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-[var(--tng-slate-800)] shadow-xs focus:border-[var(--tng-blue-500)] focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 outline-none transition-all cursor-pointer"
                    >
                        {tabs.map((tab) => (
                            <option key={tab.id} value={tab.id}>
                                {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Desktop & Tablet Tab Bar (>= 640px) ────────────────────────── */}
            <nav
                className="hidden sm:flex items-center gap-1 border-b border-[var(--tng-slate-200)] overflow-x-auto no-scrollbar"
                aria-label={ariaLabel}
            >
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => onChange(tab.id)}
                            className={cn(
                                'group flex items-center whitespace-nowrap px-3 py-2 text-xs sm:text-[13px] transition-all border-b-2 -mb-[1px] cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--tng-blue-500)] focus-visible:ring-offset-2',
                                isActive
                                    ? 'border-[var(--tng-blue-600)] text-[var(--tng-blue-600)] font-bold'
                                    : 'border-transparent text-[var(--tng-slate-500)] font-medium hover:text-[var(--tng-slate-700)] hover:border-[var(--tng-slate-300)]'
                            )}
                        >
                            {tab.icon && (
                                <span
                                    className={cn(
                                        'mr-1.5 shrink-0 transition-colors [&>svg]:h-3.5 [&>svg]:w-3.5',
                                        isActive
                                            ? 'text-[var(--tng-blue-600)]'
                                            : 'text-[var(--tng-slate-400)] group-hover:text-[var(--tng-slate-600)]'
                                    )}
                                >
                                    {tab.icon}
                                </span>
                            )}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && (
                                <span
                                    className={cn(
                                        'ml-2 rounded-full px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold transition-colors',
                                        isActive
                                            ? 'bg-[var(--tng-blue-100)] text-[var(--tng-blue-700)]'
                                            : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-800'
                                    )}
                                >
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}
