import { Head, Link, router } from '@inertiajs/react';
import { BellRing, History, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useCartActions } from '@/components/trackngo/cart/CartActionModals';
import { EmptyState, LevelBadge, PageHeader, Panel, StatusBadge, TimeMeter, buttonStyles } from '@/components/trackngo/cart/CartUi';
import { TrackingTimeline } from '@/components/trackngo/cart/TrackingTimeline';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { Escalation, EscalationRules, MonitorRow, TimelineStop } from '@/lib/cart';
import { dayUnit, elapsedSince, formatDate, formatDateTime, handlerLabel, plural, remainingLabel, timeAgo } from '@/lib/cart';
import { cn } from '@/lib/utils';

type ActivityEntry = {
    audit_id: number;
    user_name: string;
    user_role: string;
    action: string;
    description: string | null;
    timestamp: string;
};

type Props = {
    document: MonitorRow & { classification: string; addressed_to: string | null };
    timeline: TimelineStop[];
    escalations: Escalation[];
    activity: ActivityEntry[];
    rules: EscalationRules;
};

function Facts({ items }: { items: [string, ReactNode][] }) {
    return (
        <dl className="divide-y divide-slate-100">
            {items
                .filter(([, value]) => value !== null && value !== undefined && value !== '')
                .map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 px-4 py-2.5 sm:px-5">
                        <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
                        <dd className="text-right text-[13px] font-medium text-slate-800">{value}</dd>
                    </div>
                ))}
        </dl>
    );
}

export default function CartDocumentShow({ document: doc, timeline, escalations, activity, rules }: Props) {
    const { openFollowUp, openResolve, modals } = useCartActions();
    const active = doc.escalation?.status === 'active' ? doc.escalation : null;
    const unit = dayUnit(rules);

    useEffect(() => {
        const timer = setInterval(() => router.reload({ only: ['document', 'timeline', 'escalations', 'activity'] }), 60_000);

        return () => clearInterval(timer);
    }, []);

    return (
        <TrackngoLayout
            role="cart"
            breadcrumbs={[
                { title: 'Document Monitoring', href: '/cart/monitoring' },
                { title: doc.tracking_number, href: `/cart/monitoring/${doc.id}` },
            ]}
        >
            <Head title={doc.tracking_number} />

            <PageHeader
                title={doc.tracking_number}
                description={
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {doc.is_confidential && <Lock className="h-3.5 w-3.5 text-slate-400" aria-label="Confidential" />}
                        <span className="text-slate-700">{doc.title}</span>
                        <span className="text-slate-300">·</span>
                        <span>{doc.document_type}</span>
                    </span>
                }
                actions={
                    <>
                        <Link href={`/cart/audit-trail?document=${doc.id}`} className={buttonStyles.secondary}>
                            <History className="h-4 w-4" />
                            Audit trail
                        </Link>
                        {active && (
                            <button type="button" onClick={() => openResolve(doc)} className={buttonStyles.secondary}>
                                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                Resolve escalation
                            </button>
                        )}
                        {!doc.is_closed && (
                            <button
                                type="button"
                                onClick={() => openFollowUp(doc)}
                                disabled={!doc.can_follow_up}
                                title={doc.can_follow_up ? undefined : `A follow-up was sent ${timeAgo(doc.last_follow_up_at)}; one is allowed every ${rules.follow_up_hours} hours.`}
                                className={buttonStyles.primary}
                            >
                                <BellRing className="h-4 w-4" />
                                Send follow-up
                            </button>
                        )}
                    </>
                }
            />

            <div className="space-y-5 pb-10">
                {/* Status strip */}
                <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={doc.monitor_status} />
                    {doc.monitor_status === 'escalated' && <LevelBadge level={doc.escalation?.level ?? 'Manual'} />}
                    <span className="text-xs text-slate-500">
                        {doc.status_label} · {doc.stage.label} (step {doc.stage.step} of {doc.stage.total})
                    </span>
                </div>

                {active && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4">
                        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
                        <div className="min-w-0 text-[13px]">
                            <p className="font-semibold text-rose-900">
                                Escalated ({active.level}) on {formatDateTime(active.escalated_at)}
                            </p>
                            <p className="mt-0.5 text-rose-800">{active.reason}</p>
                            <p className="mt-1 text-xs text-rose-700">
                                {handlerLabel(doc)} remains responsible for processing it. CART follows up and records the resolution.
                            </p>
                        </div>
                    </div>
                )}

                {doc.is_confidential && (
                    <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        Confidential document: its contents stay with the sender and recipients. CART sees its routing and timing only.
                    </p>
                )}

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="space-y-5">
                        <Panel title="Processing time" description={`ARTA period counted in ${unit}`}>
                            <div className="px-4 pt-4 pb-3 sm:px-5">
                                <TimeMeter row={doc} />
                            </div>
                            <Facts
                                items={[
                                    ['Assigned for processing', formatDateTime(doc.date_received)],
                                    ['Allowed (L)', plural(doc.allowed_days, 'day')],
                                    ['Elapsed (WD)', plural(doc.elapsed_days, 'day')],
                                    [doc.overdue_days > 0 ? 'Overdue (OD)' : 'Remaining', doc.overdue_days > 0 ? plural(doc.overdue_days, 'day') : remainingLabel(doc)],
                                    ['Deadline', formatDate(doc.deadline)],
                                    ['Completed', doc.is_closed ? formatDateTime(doc.completed_at) : null],
                                ]}
                            />
                        </Panel>

                        {!doc.is_closed && (
                            <Panel title="Current location">
                                <Facts
                                    items={[
                                        ['Handler', doc.current_handler ?? 'Not assigned to a person'],
                                        ['Role', doc.current_handler_role],
                                        ['Department', doc.current_department ?? '—'],
                                        ['Workflow stage', doc.stage.label],
                                        ['Received by handler', formatDateTime(doc.holder_since)],
                                        ['Time with handler', elapsedSince(doc.holder_since)],
                                        ['Last activity', formatDateTime(doc.last_activity)],
                                        ['Last CART follow-up', doc.last_follow_up_at ? formatDateTime(doc.last_follow_up_at) : null],
                                    ]}
                                />
                            </Panel>
                        )}

                        <Panel title="Document">
                            <Facts
                                items={[
                                    ['Tracking number', doc.tracking_number],
                                    ['Reference', doc.reference_number],
                                    ['Type', doc.document_type],
                                    ['From department', doc.origin_department],
                                    ['Submitted by', doc.submitted_by],
                                    ['Addressed to', doc.addressed_to],
                                    ['Classification', doc.classification],
                                    ['Workflow status', doc.status_label],
                                ]}
                            />
                        </Panel>
                    </div>

                    <div className="space-y-5 lg:col-span-2">
                        <Panel title="Tracking timeline" description="Every office the document passed through and how long each held it" bodyClassName="p-4 sm:p-5">
                            <TrackingTimeline stops={timeline} />
                        </Panel>

                        <Panel title="Escalation history" description={`${plural(escalations.length, 'escalation')} recorded`}>
                            {escalations.length === 0 ? (
                                <EmptyState icon={ShieldCheck} title="Never escalated" message="This document has stayed within its processing period." className="py-8" />
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {escalations.map((escalation) => (
                                        <li key={escalation.id} className="px-4 py-3 sm:px-5">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <LevelBadge level={escalation.level} />
                                                <span className="text-xs text-slate-500">{formatDateTime(escalation.escalated_at)}</span>
                                                <span
                                                    className={cn(
                                                        'ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                        escalation.status === 'active' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700',
                                                    )}
                                                >
                                                    {escalation.status === 'active' ? 'Active' : 'Resolved'}
                                                </span>
                                            </div>
                                            <p className="mt-1.5 text-[13px] text-slate-700">{escalation.reason}</p>
                                            {escalation.responsible && <p className="mt-0.5 text-xs text-slate-500">Responsible: {escalation.responsible}</p>}
                                            {escalation.status === 'resolved' && (
                                                <p className="mt-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600">
                                                    Resolved by {escalation.resolved_by ?? 'System'} on {formatDateTime(escalation.resolved_at)}
                                                    {escalation.notes ? ` — ${escalation.notes}` : ''}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        <Panel
                            title="Activity"
                            description="Audit trail of this document (view only)"
                            aside={
                                <Link href={`/cart/audit-trail?document=${doc.id}`} className="text-xs font-medium text-[#0066cc] hover:underline">
                                    Open in Audit Trail
                                </Link>
                            }
                        >
                            {activity.length === 0 ? (
                                <EmptyState icon={History} title="No activity recorded" className="py-8" />
                            ) : (
                                <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto">
                                    {activity.map((entry) => (
                                        <li key={entry.audit_id} className="px-4 py-3 sm:px-5">
                                            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                                                <p className="text-[13px] text-slate-800">
                                                    <span className="font-semibold">{entry.action}</span>
                                                    <span className="text-slate-500">
                                                        {' '}
                                                        · {entry.user_name} ({entry.user_role})
                                                    </span>
                                                </p>
                                                <time className="text-xs whitespace-nowrap text-slate-500">{formatDateTime(entry.timestamp)}</time>
                                            </div>
                                            {entry.description && <p className="mt-0.5 text-xs text-slate-600">{entry.description}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>
                </div>
            </div>

            {modals}
        </TrackngoLayout>
    );
}
