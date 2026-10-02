import { Head, Link, router } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { AlarmClock, BellOff, CalendarClock, CheckCheck, Clock, Hourglass, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState, FilterBar, PageHeader, Panel, SearchInput, SelectFilter, StatusBadge, buttonStyles } from '@/components/trackngo/cart/CartUi';
import { ServerPagination } from '@/components/trackngo/cart/ServerPagination';
import TabNavigation from '@/components/trackngo/TabNavigation';
import type { TabItem } from '@/components/trackngo/TabNavigation';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { MonitorStatus, Pagination } from '@/lib/cart';
import { formatDateTime, timeAgo } from '@/lib/cart';
import { csrfHeaders } from '@/lib/csrf';
import { cn } from '@/lib/utils';

type Alert = {
    id: number;
    type: string;
    type_label: string;
    title: string;
    document_id: number | null;
    tracking_number: string | null;
    document_type: string | null;
    current_handler: string | null;
    department: string | null;
    monitor_status: MonitorStatus | null;
    created_at: string;
    is_read: boolean;
    action_url: string | null;
};

type Props = {
    alerts: Alert[];
    pagination: Pagination;
    filters: { type: string | null; read: string | null; search: string };
    types: { id: string; label: string; unread: number }[];
    unreadTotal: number;
};

const TYPE_STYLE: Record<string, { icon: LucideIcon; chip: string }> = {
    arta_approaching: { icon: Clock, chip: 'bg-amber-50 text-amber-600' },
    arta_due: { icon: AlarmClock, chip: 'bg-orange-50 text-orange-600' },
    arta_escalated: { icon: ShieldAlert, chip: 'bg-rose-50 text-rose-700' },
    arta_inactive: { icon: Hourglass, chip: 'bg-slate-100 text-slate-600' },
    arta_resolved: { icon: ShieldCheck, chip: 'bg-emerald-50 text-emerald-600' },
    arta_deadline_changed: { icon: CalendarClock, chip: 'bg-blue-50 text-[#0066cc]' },
};

export default function CartAlertsIndex({ alerts, pagination, filters, types, unreadTotal }: Props) {
    const [search, setSearch] = useState(filters.search);
    const firstRender = useRef(true);

    const apply = (changes: Partial<Record<'type' | 'read' | 'search', string | null>>) => {
        const next = { type: filters.type, read: filters.read, search, ...changes };
        router.get('/cart/alerts', Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { preserveState: true, preserveScroll: true, replace: true });
    };

    // Search as you type (debounced)
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false;

            return;
        }

        const timer = setTimeout(() => apply({ search }), 350);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search]);

    const open = async (alert: Alert) => {
        if (!alert.is_read) {
            await fetch(`/api/notifications/${alert.id}/read`, { method: 'POST', headers: csrfHeaders() }).catch(() => undefined);
        }

        if (alert.action_url) {
            router.visit(alert.action_url);
        }
    };

    const markRead = (alert: Alert) => router.post(`/cart/alerts/${alert.id}/read`, {}, { preserveScroll: true, preserveState: true });
    const markAllRead = () =>
        router.post('/cart/alerts/read-all', {}, { preserveScroll: true, onSuccess: () => toast.success('All alerts marked as read.') });

    const tabs: TabItem<string>[] = [
        { id: 'all', label: 'All', count: unreadTotal },
        ...types.map((t) => ({ id: t.id, label: t.label, count: t.unread })),
    ];

    return (
        <TrackngoLayout role="cart">
            <Head title="Alerts" />

            <PageHeader
                title="Alerts"
                description="Deadline, escalation and inactivity alerts raised by the ARTA monitor. Each alert is raised once per document and level."
                actions={
                    unreadTotal > 0 && (
                        <button type="button" onClick={markAllRead} className={buttonStyles.secondary}>
                            <CheckCheck className="h-4 w-4" />
                            Mark all as read
                        </button>
                    )
                }
            />

            <div className="space-y-4 pb-10">
                <TabNavigation tabs={tabs} activeTab={filters.type ?? 'all'} onChange={(id) => apply({ type: id === 'all' ? null : id })} ariaLabel="Alert types" />

                <FilterBar activeCount={filters.read ? 1 : 0} search={<SearchInput value={search} onChange={setSearch} placeholder="Tracking number or alert text…" />}>
                    <SelectFilter
                        label="Read and unread"
                        value={filters.read ?? ''}
                        onChange={(value) => apply({ read: value || null })}
                        options={[
                            { value: 'unread', label: 'Unread only' },
                            { value: 'read', label: 'Read only' },
                        ]}
                    />
                </FilterBar>

                <Panel title={`${pagination.total} alert${pagination.total === 1 ? '' : 's'}`} description="Counts on the tabs are unread alerts">
                    {alerts.length === 0 ? (
                        <EmptyState icon={BellOff} title="No alerts" message="Nothing matches these filters." />
                    ) : (
                        <>
                            <ul className="divide-y divide-slate-100">
                                {alerts.map((alert) => {
                                    const style = TYPE_STYLE[alert.type] ?? TYPE_STYLE.arta_deadline_changed;
                                    const Icon = style.icon;

                                    return (
                                        <li key={alert.id} className={cn('flex gap-3 px-4 py-3.5 sm:px-5', !alert.is_read && 'bg-blue-50/40')}>
                                            <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.chip)}>
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{alert.type_label}</span>
                                                    {!alert.is_read && <span className="h-1.5 w-1.5 rounded-full bg-[#0066cc]" aria-label="Unread" />}
                                                </div>
                                                <button type="button" onClick={() => open(alert)} className={cn('mt-0.5 text-left text-[13px] hover:text-[#0066cc] hover:underline', alert.is_read ? 'text-slate-700' : 'font-semibold text-slate-900')}>
                                                    {alert.title}
                                                </button>
                                                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                                                    {alert.tracking_number && alert.document_id && (
                                                        <Link href={`/cart/monitoring/${alert.document_id}`} className="font-medium text-[#0066cc] hover:underline">
                                                            {alert.tracking_number}
                                                        </Link>
                                                    )}
                                                    {alert.document_type && <span>{alert.document_type}</span>}
                                                    {alert.current_handler && <span>Handler: {alert.current_handler}</span>}
                                                    {alert.department && <span>{alert.department}</span>}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end gap-1.5">
                                                <time className="text-xs whitespace-nowrap text-slate-500" title={formatDateTime(alert.created_at)}>
                                                    {timeAgo(alert.created_at)}
                                                </time>
                                                {alert.monitor_status && <StatusBadge status={alert.monitor_status} />}
                                                {!alert.is_read && (
                                                    <button type="button" onClick={() => markRead(alert)} className={buttonStyles.ghost}>
                                                        Mark read
                                                    </button>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <ServerPagination pagination={pagination} itemLabel="alerts" />
                        </>
                    )}
                </Panel>
            </div>
        </TrackngoLayout>
    );
}
