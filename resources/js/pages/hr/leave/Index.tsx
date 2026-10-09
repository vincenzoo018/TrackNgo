import { Head, router, useForm } from '@inertiajs/react';
import { CalendarDays, Plus, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { FlashMessage } from '@/components/trackngo/FlashMessage';
import { SearchInput } from '@/components/trackngo/ListFilters';
import TabNavigation from '@/components/trackngo/TabNavigation';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

type Leave = {
    id: number;
    user_id: number;
    employee: string;
    role: string | null;
    department: string | null;
    leave_type: string;
    start_date: string;
    end_date: string;
    working_days: number;
    reason: string | null;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    reviewed_by: string | null;
    reviewed_at: string | null;
    review_remarks: string | null;
    oic: { officer: string; order: string; status: string } | null;
};
type Employee = { id: number; name: string; role: string | null; department: string | null; needs_oic: boolean };
type Officer = { id: number; name: string; role: string | null; department: string | null; has_signature: boolean };
type Props = { leaves: Leave[]; employees: Employee[]; officers: Officer[]; leaveTypes: string[] };
type Tab = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS: Record<Leave['status'], string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-800',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-red-200 bg-red-50 text-red-700',
    cancelled: 'border-slate-200 bg-slate-50 text-slate-500',
};

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';
const errorClass = 'mt-1 text-[12px] font-medium text-red-600';
const smallButton = 'rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors';

function period(start: string, end: string): string {
    const fmt = (v: string, year: boolean) => new Date(`${v}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'Asia/Manila' });

    return start === end ? fmt(start, true) : `${fmt(start, false)} – ${fmt(end, true)}`;
}

/** HR → Leave Management */
export default function LeaveIndex({ leaves, employees, officers, leaveTypes }: Props) {
    const [tab, setTab] = useState<Tab>('pending');
    const [search, setSearch] = useState('');
    const [recordOpen, setRecordOpen] = useState(false);
    const [approving, setApproving] = useState<Leave | null>(null);
    const [rejecting, setRejecting] = useState<Leave | null>(null);

    const recordForm = useForm({ user_id: '', leave_type: leaveTypes[0] ?? '', start_date: '', end_date: '', reason: '' });
    const approveForm = useForm({ review_remarks: '', designated_user_id: '', designation_order_number: '' });
    const rejectForm = useForm({ review_remarks: '' });

    const counts = useMemo(() => ({
        pending: leaves.filter(l => l.status === 'pending').length,
        approved: leaves.filter(l => l.status === 'approved').length,
        rejected: leaves.filter(l => l.status === 'rejected').length,
        all: leaves.length,
    }), [leaves]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return leaves.filter(l => (tab === 'all' || l.status === tab)
            && (!q || [l.employee, l.department, l.leave_type, l.role].some(v => String(v || '').toLowerCase().includes(q))));
    }, [leaves, tab, search]);

    const approvingEmployee = approving ? employees.find(e => e.id === approving.user_id) : null;
    const oicCandidates = approving ? officers.filter(o => o.id !== approving.user_id) : [];

    const submitRecord = (e: React.FormEvent) => {
        e.preventDefault();
        recordForm.post('/hr/leave', { preserveScroll: true, onSuccess: () => { setRecordOpen(false); recordForm.reset(); } });
    };
    const submitApprove = (e: React.FormEvent) => {
        e.preventDefault();
        if (approving) {
            approveForm.post(`/hr/leave/${approving.id}/approve`, { preserveScroll: true, onSuccess: () => { setApproving(null); approveForm.reset(); } });
        }
    };
    const submitReject = (e: React.FormEvent) => {
        e.preventDefault();
        if (rejecting) {
            rejectForm.post(`/hr/leave/${rejecting.id}/reject`, { preserveScroll: true, onSuccess: () => { setRejecting(null); rejectForm.reset(); } });
        }
    };
    const cancel = (leave: Leave) => {
        if (confirm(`Cancel the ${leave.leave_type} of ${leave.employee}?${leave.oic ? ' The Officer-in-Charge designation ends too.' : ''}`)) {
            router.post(`/hr/leave/${leave.id}/cancel`, {}, { preserveScroll: true });
        }
    };

    return (
        <TrackngoLayout role="hr">
            <Head title="Leave Management — TrackNGo Mati" />
            <FlashMessage />

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">Leave Management</h1>
                        <p className="mt-0.5 max-w-3xl text-sm text-[var(--tng-slate-500)]">
                            Record and approve leave. Weekends and holidays are not counted. Approving the leave of the Mayor or a Department Head can designate the Officer-in-Charge for the same days.
                        </p>
                    </div>
                    <button type="button" onClick={() => { recordForm.clearErrors(); setRecordOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs hover:bg-[#005bb5]">
                        <Plus className="h-4 w-4" /> Record Leave
                    </button>
                </div>

                <TabNavigation<Tab>
                    tabs={[
                        { id: 'pending', label: 'Pending', count: counts.pending },
                        { id: 'approved', label: 'Approved', count: counts.approved },
                        { id: 'rejected', label: 'Rejected', count: counts.rejected },
                        { id: 'all', label: 'All', count: counts.all },
                    ]}
                    activeTab={tab}
                    onChange={setTab}
                />

                <div className="flex flex-wrap items-center gap-3">
                    <SearchInput value={search} onChange={setSearch} />
                </div>

                <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                            <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <tr>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Employee</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Leave</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Dates</th>
                                    <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">Working Days</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                            <CalendarDays className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                                            No leave {tab === 'all' ? 'recorded' : tab} yet.
                                        </td>
                                    </tr>
                                )}
                                {filtered.map(l => (
                                    <tr key={l.id} className="align-top transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40">
                                        <td className="px-4 py-3">
                                            <div className="text-slate-900">{l.employee}</div>
                                            <div className="text-[12px] text-slate-500">{[l.role, l.department].filter(Boolean).join(' · ')}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>{l.leave_type}</div>
                                            {l.reason && <div className="max-w-[260px] text-[12px] text-slate-500">{l.reason}</div>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">{period(l.start_date, l.end_date)}</td>
                                        <td className="px-4 py-3 text-center">{l.working_days}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-medium capitalize ${STATUS[l.status]}`}>{l.status}</span>
                                            {l.oic && (
                                                <div className="mt-1 flex items-center gap-1 text-[12px] text-violet-700">
                                                    <UserCheck className="h-3.5 w-3.5" /> OIC: {l.oic.officer} (DO No. {l.oic.order})
                                                </div>
                                            )}
                                            {l.review_remarks && <div className="mt-1 max-w-[220px] text-[12px] text-slate-500">{l.review_remarks}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="flex justify-end gap-1.5">
                                                {l.status === 'pending' && (
                                                    <>
                                                        <button type="button" onClick={() => { approveForm.reset(); approveForm.clearErrors(); setApproving(l); }} className={`${smallButton} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}>Approve</button>
                                                        <button type="button" onClick={() => { rejectForm.reset(); rejectForm.clearErrors(); setRejecting(l); }} className={`${smallButton} border-red-200 bg-white text-red-700 hover:bg-red-50`}>Reject</button>
                                                    </>
                                                )}
                                                {(l.status === 'pending' || l.status === 'approved') && (
                                                    <button type="button" onClick={() => cancel(l)} className={`${smallButton} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>Cancel</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <BaseModal
                isOpen={recordOpen}
                onClose={() => setRecordOpen(false)}
                title="Record Leave"
                maxWidth="max-w-lg"
                formProps={{ onSubmit: submitRecord }}
                footer={
                    <>
                        <button type="button" onClick={() => setRecordOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={recordForm.processing} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] disabled:opacity-60">Record</button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Employee <span className="text-red-500">*</span></label>
                        <select value={recordForm.data.user_id} onChange={(e) => recordForm.setData('user_id', e.target.value)} className={inputClass}>
                            <option value="">Select an employee…</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name} — {[emp.role, emp.department].filter(Boolean).join(', ')}</option>)}
                        </select>
                        {recordForm.errors.user_id && <p className={errorClass}>{recordForm.errors.user_id}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Type of leave <span className="text-red-500">*</span></label>
                        <select value={recordForm.data.leave_type} onChange={(e) => recordForm.setData('leave_type', e.target.value)} className={inputClass}>
                            {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>First day <span className="text-red-500">*</span></label>
                            <input type="date" value={recordForm.data.start_date} onChange={(e) => recordForm.setData(d => ({ ...d, start_date: e.target.value, end_date: d.end_date && d.end_date >= e.target.value ? d.end_date : e.target.value }))} className={inputClass} />
                            {recordForm.errors.start_date && <p className={errorClass}>{recordForm.errors.start_date}</p>}
                        </div>
                        <div>
                            <label className={labelClass}>Last day <span className="text-red-500">*</span></label>
                            <input type="date" value={recordForm.data.end_date} min={recordForm.data.start_date} onChange={(e) => recordForm.setData('end_date', e.target.value)} className={inputClass} />
                            {recordForm.errors.end_date && <p className={errorClass}>{recordForm.errors.end_date}</p>}
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Reason</label>
                        <textarea value={recordForm.data.reason} onChange={(e) => recordForm.setData('reason', e.target.value)} rows={2} maxLength={500} className={inputClass} />
                    </div>
                </div>
            </BaseModal>

            <BaseModal
                isOpen={approving !== null}
                onClose={() => setApproving(null)}
                title="Approve Leave"
                identifier={approving ? `${approving.employee} · ${period(approving.start_date, approving.end_date)}` : undefined}
                maxWidth="max-w-lg"
                formProps={{ onSubmit: submitApprove }}
                footer={
                    <>
                        <button type="button" onClick={() => setApproving(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={approveForm.processing} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60">Approve</button>
                    </>
                }
            >
                <div className="space-y-4">
                    {approvingEmployee?.needs_oic && (
                        <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/60 p-3">
                            <p className="text-[13px] text-violet-900">
                                {approving?.employee} is {approvingEmployee.role === 'Mayor' ? 'the City Mayor' : `the head of ${approvingEmployee.department ?? 'an office'}`}. Designate an Officer-in-Charge so their documents do not stall (optional).
                            </p>
                            <div>
                                <label className={labelClass}>Officer-in-Charge</label>
                                <select value={approveForm.data.designated_user_id} onChange={(e) => approveForm.setData('designated_user_id', e.target.value)} className={inputClass}>
                                    <option value="">No OIC</option>
                                    {oicCandidates.map(o => (
                                        <option key={o.id} value={o.id} disabled={!o.has_signature}>
                                            {o.name} — {[o.role, o.department].filter(Boolean).join(', ')}{o.has_signature ? '' : ' (no registered signature)'}
                                        </option>
                                    ))}
                                </select>
                                {approveForm.errors.designated_user_id && <p className={errorClass}>{approveForm.errors.designated_user_id}</p>}
                            </div>
                            {approveForm.data.designated_user_id && (
                                <div>
                                    <label className={labelClass}>Designation Order No. <span className="text-red-500">*</span></label>
                                    <input value={approveForm.data.designation_order_number} onChange={(e) => approveForm.setData('designation_order_number', e.target.value)} className={inputClass} maxLength={60} placeholder="e.g. 12, s. 2026" />
                                    {approveForm.errors.designation_order_number && <p className={errorClass}>{approveForm.errors.designation_order_number}</p>}
                                </div>
                            )}
                            {(approveForm.errors as any).start_date && <p className={errorClass}>{(approveForm.errors as any).start_date}</p>}
                        </div>
                    )}
                    <div>
                        <label className={labelClass}>Remarks</label>
                        <input value={approveForm.data.review_remarks} onChange={(e) => approveForm.setData('review_remarks', e.target.value)} className={inputClass} maxLength={500} />
                    </div>
                </div>
            </BaseModal>

            <BaseModal
                isOpen={rejecting !== null}
                onClose={() => setRejecting(null)}
                title="Reject Leave"
                identifier={rejecting ? `${rejecting.employee} · ${period(rejecting.start_date, rejecting.end_date)}` : undefined}
                maxWidth="max-w-md"
                formProps={{ onSubmit: submitReject }}
                footer={
                    <>
                        <button type="button" onClick={() => setRejecting(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={rejectForm.processing} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">Reject</button>
                    </>
                }
            >
                <label className={labelClass}>Reason <span className="text-red-500">*</span></label>
                <textarea value={rejectForm.data.review_remarks} onChange={(e) => rejectForm.setData('review_remarks', e.target.value)} rows={3} maxLength={500} className={inputClass} autoFocus />
                {rejectForm.errors.review_remarks && <p className={errorClass}>{rejectForm.errors.review_remarks}</p>}
            </BaseModal>
        </TrackngoLayout>
    );
}
