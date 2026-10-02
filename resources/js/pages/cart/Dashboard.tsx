import { Head, Link, router } from '@inertiajs/react';
import { AlarmClock, AlertTriangle, CircleCheckBig, FileStack, Inbox, Loader, ShieldAlert, ShieldCheck, TimerReset } from 'lucide-react';
import { useEffect } from 'react';
import { DocLink, EmptyState, LevelBadge, Panel, PageHeader, StatusBadge, tableStyles } from '@/components/trackngo/cart/CartUi';
import { StatCard } from '@/components/trackngo/StatCard';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { Escalation, EscalationRules, MonitorRow, MonitorStatus } from '@/lib/cart';
import { MONITOR_STATUS, dayUnit, formatDate, handlerLabel, remainingLabel, timeAgo } from '@/lib/cart';
import { cn } from '@/lib/utils';

type Brief = Pick<MonitorRow, 'id' | 'tracking_number' | 'title' | 'document_type' | 'current_handler' | 'current_department' | 'remaining_days' | 'overdue_days' | 'deadline' | 'arta_status' | 'monitor_status' | 'stage'>;

type Props = {
    summary: { total: number; active: number; pending: number; in_process: number; completed: number; within_time: number; near: number; overdue: number; escalated: number };
    byStatus: { status: MonitorStatus; count: number }[];
    byDepartment: { department: string; active: number; within_time: number; near: number; overdue: number; escalated: number }[];
    recentEscalations: { escalation: Escalation; document: Brief }[];
    nearDeadline: Brief[];
    rules: EscalationRules;
};

const REFRESH_MS = 60_000;

export default function CartDashboard({ summary, byStatus, byDepartment, recentEscalations, nearDeadline, rules }: Props) {
    // Monitoring view: keep the numbers current without a manual reload
    useEffect(() => {
        const timer = setInterval(() => router.reload({ only: ['summary', 'byStatus', 'byDepartment', 'recentEscalations', 'nearDeadline'] }), REFRESH_MS);

        return () => clearInterval(timer);
    }, []);

    const statusTotal = byStatus.reduce((sum, item) => sum + item.count, 0);

    return (
        <TrackngoLayout role="cart">
            <Head title="CART Dashboard" />

            <PageHeader
                title="CART Dashboard"
                description={`Processing time and escalations across all offices, measured against each document's ARTA period (in ${dayUnit(rules)}).`}
            />

            <div className="space-y-5 pb-10">
                {/* Volume */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                    <StatCard title="Monitored" value={summary.total} sublabel={`${summary.active} active · ${summary.completed} completed`} icon={FileStack} href="/cart/monitoring" />
                    <StatCard title="Pending" value={summary.pending} sublabel="Waiting to be received" icon={Inbox} href="/cart/monitoring?view=pending" />
                    <StatCard title="In process" value={summary.in_process} sublabel="Being worked on" icon={Loader} href="/cart/monitoring?view=in_process" />
                    <StatCard title="Completed" value={summary.completed} sublabel="Finished or released" icon={CircleCheckBig} href="/cart/monitoring?view=completed" />
                </div>

                {/* Exceptions */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <StatCard title="Near deadline" value={summary.near} sublabel="Approaching or due today" icon={<AlarmClock className="h-4 w-4 text-amber-600" />} href="/cart/escalations?view=near" />
                    <StatCard title="Delayed" value={summary.overdue} sublabel="Past the processing period" icon={<AlertTriangle className="h-4 w-4 text-red-600" />} href="/cart/escalations?view=delayed" />
                    <StatCard title="Escalations" value={summary.escalated} sublabel="Active ARTA escalations" icon={<ShieldAlert className="h-4 w-4 text-rose-700" />} href="/cart/escalations?view=escalated" />
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                    {/* Documents grouped by processing status */}
                    <Panel title="Processing status" description="All documents by ARTA processing status" className="lg:col-span-2" bodyClassName="p-4 sm:p-5">
                        {statusTotal === 0 ? (
                            <EmptyState icon={FileStack} title="No documents yet" className="py-8" />
                        ) : (
                            <>
                                <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Documents by processing status">
                                    {byStatus
                                        .filter((item) => item.count > 0)
                                        .map((item) => (
                                            <div
                                                key={item.status}
                                                className={cn('h-full first:rounded-l-full last:rounded-r-full', MONITOR_STATUS[item.status].bar)}
                                                style={{ width: `${(item.count / statusTotal) * 100}%` }}
                                                title={`${MONITOR_STATUS[item.status].label}: ${item.count}`}
                                            />
                                        ))}
                                </div>
                                <ul className="mt-4 divide-y divide-slate-100">
                                    {byStatus.map((item) => {
                                        const config = MONITOR_STATUS[item.status];
                                        const Icon = config.icon;
                                        const share = statusTotal ? Math.round((item.count / statusTotal) * 100) : 0;

                                        return (
                                            <li key={item.status}>
                                                <Link
                                                    href={item.status === 'completed' ? '/cart/monitoring?view=completed' : `/cart/escalations?status=${item.status}`}
                                                    className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-slate-50"
                                                >
                                                    <Icon className={cn('h-4 w-4 shrink-0', config.text)} />
                                                    <span className="flex-1 text-slate-700">{config.label}</span>
                                                    <span className="w-9 text-right text-xs text-slate-400 tabular-nums">{share}%</span>
                                                    <span className="w-8 text-right font-semibold text-slate-900 tabular-nums">{item.count}</span>
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        )}
                    </Panel>

                    {/* Recently escalated */}
                    <Panel
                        title="Recently escalated"
                        description="Latest escalation events recorded by the ARTA monitor"
                        className="lg:col-span-3"
                        aside={
                            <Link href="/cart/escalations?view=escalated" className="text-xs font-medium text-[#0066cc] hover:underline">
                                View all
                            </Link>
                        }
                    >
                        {recentEscalations.length === 0 ? (
                            <EmptyState icon={ShieldCheck} title="No escalations" message="Documents that pass their processing period will appear here." />
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {recentEscalations.map(({ escalation, document }) => (
                                    <li key={escalation.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                                        <LevelBadge level={escalation.level} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                <DocLink row={document} className="text-[13px]" />
                                                <span className="text-xs text-slate-500">{document.document_type}</span>
                                            </div>
                                            <p className="mt-0.5 truncate text-xs text-slate-600" title={escalation.reason ?? undefined}>
                                                With {handlerLabel(document)} · {escalation.reason}
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <p className="text-xs text-slate-500">{timeAgo(escalation.escalated_at)}</p>
                                            <p className={cn('text-[11px] font-medium', escalation.status === 'active' ? 'text-rose-700' : 'text-emerald-700')}>
                                                {escalation.status === 'active' ? 'Active' : 'Resolved'}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                    {/* Documents grouped by department */}
                    <Panel title="By department" description="Active documents by the office currently holding them" className="lg:col-span-3">
                        {byDepartment.length === 0 ? (
                            <EmptyState icon={FileStack} title="No active documents" />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className={tableStyles.table}>
                                    <thead className={tableStyles.head}>
                                        <tr>
                                            <th className={tableStyles.th}>Department</th>
                                            <th className={cn(tableStyles.th, 'text-right')}>Active</th>
                                            <th className={cn(tableStyles.th, 'text-right')}>Near</th>
                                            <th className={cn(tableStyles.th, 'text-right')}>Delayed</th>
                                            <th className={cn(tableStyles.th, 'hidden text-right sm:table-cell')}>Escalated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byDepartment.map((dept) => (
                                            <tr key={dept.department} className={tableStyles.row}>
                                                <td className={cn(tableStyles.td, 'min-w-[180px]')}>
                                                    <p className="font-medium text-slate-800">{dept.department}</p>
                                                    <DepartmentMix dept={dept} />
                                                </td>
                                                <td className={cn(tableStyles.td, 'text-right tabular-nums')}>{dept.active}</td>
                                                <td className={cn(tableStyles.td, 'text-right tabular-nums', dept.near > 0 ? 'font-semibold text-amber-700' : 'text-slate-400')}>{dept.near}</td>
                                                <td className={cn(tableStyles.td, 'text-right tabular-nums', dept.overdue > 0 ? 'font-semibold text-red-700' : 'text-slate-400')}>{dept.overdue}</td>
                                                <td className={cn(tableStyles.td, 'hidden text-right tabular-nums sm:table-cell', dept.escalated > 0 ? 'font-semibold text-rose-800' : 'text-slate-400')}>{dept.escalated}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    {/* Approaching deadline */}
                    <Panel
                        title="Approaching deadline"
                        description="Act before these become overdue"
                        className="lg:col-span-2"
                        aside={
                            <Link href="/cart/escalations?view=near" className="text-xs font-medium text-[#0066cc] hover:underline">
                                View all
                            </Link>
                        }
                    >
                        {nearDeadline.length === 0 ? (
                            <EmptyState icon={TimerReset} title="Nothing near its deadline" message="Documents appear here when 20% or less of their processing period remains." />
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {nearDeadline.map((doc) => (
                                    <li key={doc.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                                        <div className="min-w-0 flex-1">
                                            <DocLink row={doc} className="text-[13px]" />
                                            <p className="truncate text-xs text-slate-500">
                                                With {handlerLabel(doc)} · due {formatDate(doc.deadline)}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 flex-col items-end gap-1">
                                            <StatusBadge status={doc.arta_status} />
                                            <span className="text-[11px] text-slate-500">{remainingLabel({ is_closed: false, completed_late: false, ...doc })}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>
        </TrackngoLayout>
    );
}

/** Thin within / near / delayed proportion bar under each department name */
function DepartmentMix({ dept }: { dept: Props['byDepartment'][number] }) {
    // Time-based buckets only: they never overlap and add up to the active count
    const parts = [
        { count: dept.within_time, className: MONITOR_STATUS.within_time.bar, label: 'Within time' },
        { count: dept.near, className: MONITOR_STATUS.approaching.bar, label: 'Near deadline' },
        { count: dept.overdue, className: MONITOR_STATUS.overdue.bar, label: 'Delayed' },
    ].filter((part) => part.count > 0);

    return (
        <div className="mt-1.5 flex h-1.5 w-full max-w-[220px] gap-0.5 overflow-hidden rounded-full bg-slate-100">
            {parts.map((part) => (
                <div key={part.label} className={cn('h-full', part.className)} style={{ width: `${(part.count / dept.active) * 100}%` }} title={`${part.label}: ${part.count}`} />
            ))}
        </div>
    );
}
