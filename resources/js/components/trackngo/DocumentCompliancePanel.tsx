import { Link, router } from '@inertiajs/react';
import { CalendarClock, FileText, Gavel, Scale, ShieldCheck, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';

/**
 * Legal deadlines of a document (DocumentCompliancePresenter): the holiday-aware due date, the one extension of the
 * processing period with its written notice (RA 11032 Sec. 9(b)), a deemed approval (RA 11032 Sec. 10 / LGC Sec. 54),
 * the Mayor's 10-day sign-or-veto period for ordinances / resolutions, and an Officer-in-Charge holding it.
 */

export function formatDay(value?: string | null): string {
    if (!value) {
        return '';
    }
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00+08:00`);

    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}

function formatDateTime(value?: string | null): string {
    if (!value) {
        return '';
    }
    const d = new Date(value);

    return isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const STATUS_CHIP: Record<string, { label: (d: any) => string; className: string }> = {
    within_time: { label: (d) => `${d.remaining} ${d.working_days ? 'working ' : ''}day${d.remaining === 1 ? '' : 's'} left`, className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    approaching: { label: (d) => `${d.remaining} ${d.working_days ? 'working ' : ''}day${d.remaining === 1 ? '' : 's'} left`, className: 'border-amber-200 bg-amber-50 text-amber-800' },
    due: { label: () => 'Due today', className: 'border-orange-200 bg-orange-50 text-orange-700' },
    overdue: { label: (d) => `Overdue by ${d.overdue_days} day${d.overdue_days === 1 ? '' : 's'}`, className: 'border-red-200 bg-red-50 text-red-700' },
    completed: { label: () => 'Closed', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

function Row({ icon: Icon, children, tone = 'slate' }: { icon: any; children: React.ReactNode; tone?: 'slate' | 'violet' | 'red' | 'emerald' | 'amber' }) {
    const tones = {
        slate: 'text-slate-500',
        violet: 'text-violet-600',
        red: 'text-red-600',
        emerald: 'text-emerald-600',
        amber: 'text-amber-600',
    };

    return (
        <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-slate-700">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tones[tone]}`} />
            <div className="min-w-0">{children}</div>
        </div>
    );
}

/** The deadline card shown beside the document */
export function DocumentCompliancePanel({ doc, role }: { doc: any; role: string }) {
    const c = doc.compliance;
    if (!c) {
        return null;
    }
    const d = c.deadline;
    const chip = STATUS_CHIP[d.status] ?? STATUS_CHIP.within_time;
    const mayoral = c.mayoral;
    const isReceiving = role === 'receiving';

    return (
        <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-[15px] font-semibold text-slate-900">Deadline &amp; Legal Status</h2>
                {isReceiving && (
                    <div className="flex items-center gap-3 text-[13px] font-medium">
                        <Link href={`/receiving/documents/${doc.document_id}/arta-timeline`} className="text-[#0066cc] hover:underline">ARTA Timeline</Link>
                        <Link href={`/receiving/documents/${doc.document_id}/location-map`} className="text-[#0066cc] hover:underline">Location</Link>
                    </div>
                )}
            </div>
            <div className="space-y-3 p-5">
                {c.deemed && (
                    <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-[13px] text-violet-900">
                        <span className="font-semibold">Deemed approved</span> on {formatDateTime(c.deemed.at)} under {c.deemed.basis}: no action within the period.
                        {String(doc.status).toLowerCase() === 'deemed_approved' && ' It is with the Receiving Clerk for release.'}
                    </p>
                )}

                <Row icon={CalendarClock}>
                    <span className="font-medium text-slate-900">Due {formatDay(d.due_date)}</span>
                    <span className="text-slate-500"> · {d.allowed_days} {d.working_days ? 'working' : 'calendar'} days</span>
                    <span className={`ml-2 inline-flex rounded-full border px-2 py-px text-[11px] font-medium ${chip.className}`}>{chip.label(d)}</span>
                    {d.skipped?.length > 0 && (
                        <p className="mt-0.5 text-[12px] text-slate-500">
                            Holidays not counted: {d.skipped.map((h: any) => `${h.reason} (${formatDay(h.date).replace(/, \d{4}$/, '')})`).join(', ')}
                        </p>
                    )}
                </Row>

                {c.extension && (
                    <Row icon={ShieldCheck} tone="amber">
                        Extended once by {c.extension.extended_by ?? 'the processing office'} on {formatDateTime(c.extension.extended_at)}: from{' '}
                        {formatDay(c.extension.previous_due_date)} to <span className="font-medium text-slate-900">{formatDay(c.extension.new_due_date)}</span>.
                        {c.extension.reason && <span className="block text-[12px] text-slate-500">Reason: {c.extension.reason}</span>}
                        <span className="mt-1 flex flex-wrap items-center gap-3 text-[12px]">
                            <span className={c.extension.notified_client ? 'text-emerald-700' : 'text-slate-500'}>
                                {c.extension.notified_client ? 'Client notified by SMS' : 'Client not texted (no external client or SMS not sent)'}
                            </span>
                            <a href={`/documents/${doc.document_id}/extension-notice`} className="inline-flex items-center gap-1 font-medium text-[#0066cc] hover:underline">
                                <FileText className="h-3.5 w-3.5" /> Written notice
                            </a>
                        </span>
                    </Row>
                )}

                {mayoral && (
                    <Row icon={Gavel} tone={mayoral.status === 'vetoed' ? 'red' : mayoral.status === 'pending' && mayoral.days_left !== null && mayoral.days_left <= 2 ? 'amber' : 'violet'}>
                        {mayoral.status === 'not_received' && (
                            <>The Mayor's 10 days to sign or veto (LGC Sec. 54) start when the Mayor receives it.</>
                        )}
                        {mayoral.status === 'pending' && (
                            <>
                                <span className="font-medium text-slate-900">Mayor must act by {formatDay(mayoral.due_date)}</span>
                                <span className="text-slate-500">
                                    {' '}· {mayoral.days_left > 0 ? `${mayoral.days_left} day${mayoral.days_left === 1 ? '' : 's'} left` : mayoral.days_left === 0 ? 'last day today' : 'period lapsed'}
                                </span>
                                <span className="block text-[12px] text-slate-500">Received {formatDateTime(mayoral.received_at)}. Without a signature or veto it is deemed approved (LGC Sec. 54).</span>
                            </>
                        )}
                        {mayoral.action && mayoral.status === 'signed' && (
                            <>Signed by {mayoral.action.actor} on {formatDateTime(mayoral.action.date)}{mayoral.action.designation ? ` (${mayoral.action.designation})` : ''}.</>
                        )}
                        {mayoral.action && mayoral.status === 'vetoed' && (
                            <>
                                <span className="font-medium text-red-700">Vetoed</span> by {mayoral.action.actor} on {formatDateTime(mayoral.action.date)}
                                {mayoral.action.designation ? ` (${mayoral.action.designation})` : ''}.
                                {mayoral.action.remarks && <span className="block text-[12px] text-slate-600">Reasons: {mayoral.action.remarks}</span>}
                            </>
                        )}
                        {mayoral.status === 'deemed_approved' && <>Deemed approved as if signed: the Mayor did not act within 10 days (LGC Sec. 54).</>}
                    </Row>
                )}

                {c.acting && (
                    <Row icon={UserCheck} tone="violet">
                        <span className="font-medium text-slate-900">{c.acting.title}: {c.acting.officer}</span>
                        <span className="text-slate-500"> per Designation Order No. {c.acting.order}, for {c.acting.official}</span>
                    </Row>
                )}
            </div>
        </section>
    );
}

/** Extend (processing office) and Veto (Mayor / Acting Mayor) buttons for the Actions card, with their dialogs */
export function ComplianceActions({ doc }: { doc: any }) {
    const c = doc.compliance;
    const [extendOpen, setExtendOpen] = useState(false);
    const [vetoOpen, setVetoOpen] = useState(false);
    const [text, setText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    if (!c || (!c.can_extend?.allowed && !c.can_veto)) {
        return null;
    }

    const submit = (url: string, field: 'reason' | 'reasons', close: () => void) => (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        router.post(url, { [field]: text.trim() }, {
            preserveScroll: true,
            onSuccess: () => {
                close();
                setText('');
                window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
            },
            onError: (errors) => setError(errors[field] || errors.reason || errors.reasons || Object.values(errors)[0] || 'The request was refused.'),
            onFinish: () => setSaving(false),
        });
    };
    const open = (which: 'extend' | 'veto') => {
        setText('');
        setError(null);
        (which === 'extend' ? setExtendOpen : setVetoOpen)(true);
    };
    const footer = (onCancel: () => void, label: string, danger = false) => (
        <>
            <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">Cancel</button>
            <button
                type="submit"
                disabled={text.trim().length < 10 || saving}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--tng-blue-600)] hover:bg-[var(--tng-blue-700)]'}`}
            >
                {saving ? 'Saving…' : label}
            </button>
        </>
    );

    return (
        <>
            {c.can_veto && (
                <button type="button" onClick={() => open('veto')} className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-[14px] font-medium text-red-700 transition-colors hover:bg-red-50">
                    <Gavel className="h-4 w-4" /> Veto (LGC Sec. 54)
                </button>
            )}
            {c.can_extend?.allowed && (
                <button type="button" onClick={() => open('extend')} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-medium text-slate-700 transition-colors hover:bg-slate-50">
                    <CalendarClock className="h-4 w-4" /> Extend Processing Period
                </button>
            )}

            <BaseModal
                isOpen={extendOpen}
                onClose={() => setExtendOpen(false)}
                title="Extend Processing Period"
                identifier={doc.reference_number}
                description="RA 11032 allows one extension, for the same number of days, given before the deadline with a written notice to the client."
                maxWidth="max-w-lg"
                formProps={{ onSubmit: submit(`/documents/${doc.document_id}/extend`, 'reason', () => setExtendOpen(false)) }}
                footer={footer(() => setExtendOpen(false), 'Extend & Notify Client')}
            >
                <div className="space-y-3">
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-700">
                        New release date: <span className="font-semibold text-slate-900">{formatDay(c.can_extend?.new_due_date)}</span>
                        <span className="text-slate-500"> (+{c.can_extend?.extension_days} working days, from {formatDay(c.deadline?.due_date)})</span>
                    </p>
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reason for the extension <span className="text-red-500">*</span></label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            placeholder="e.g. A site inspection is required before the permit can be issued."
                            className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]"
                            autoFocus
                        />
                        <p className="mt-1 text-[12px] text-slate-500">This is written on the notice to the client, who is also texted the new date. It cannot be extended again.</p>
                    </div>
                    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
                </div>
            </BaseModal>

            <BaseModal
                isOpen={vetoOpen}
                onClose={() => setVetoOpen(false)}
                title="Veto"
                identifier={doc.reference_number}
                description="Under LGC Sec. 54 a veto must state the reasons. The document is closed as Vetoed and returned to whoever filed it."
                headerClassName="bg-red-50/70"
                maxWidth="max-w-lg"
                formProps={{ onSubmit: submit(`/documents/${doc.document_id}/veto`, 'reasons', () => setVetoOpen(false)) }}
                footer={footer(() => setVetoOpen(false), 'Veto Document', true)}
            >
                <div className="space-y-3">
                    {c.viewer_acting_for && (
                        <p className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[13px] text-violet-900">
                            <Scale className="h-4 w-4 shrink-0" /> You are acting for {c.viewer_acting_for}; the veto records your designation.
                        </p>
                    )}
                    <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Reasons for the veto <span className="text-red-500">*</span></label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={4}
                            maxLength={2000}
                            placeholder="State why the ordinance / resolution is vetoed (e.g. it is prejudicial to the public welfare)."
                            className="w-full rounded-lg border border-red-200 bg-red-50/30 p-3 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                            autoFocus
                        />
                    </div>
                    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p>}
                </div>
            </BaseModal>
        </>
    );
}

