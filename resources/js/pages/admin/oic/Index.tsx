import { Head, Link, router, useForm } from '@inertiajs/react';
import { Plus, UserCheck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { FlashMessage } from '@/components/trackngo/FlashMessage';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

type Person = { id: number; name: string; role: string | null; department: string | null; has_signature: boolean };
type Designation = {
    id: number;
    official: string;
    official_role: string;
    officer: string;
    officer_role: string;
    title: string;
    department: string | null;
    start_date: string;
    end_date: string;
    designation_order_number: string;
    remarks: string | null;
    status: 'active' | 'scheduled' | 'expired' | 'ended';
    ended_at: string | null;
    created_by: string | null;
};

type Props = { designations: Designation[]; officials: Person[]; officers: Person[]; today: string };

const STATUS: Record<Designation['status'], { label: string; className: string }> = {
    active: { label: 'In effect', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    scheduled: { label: 'Scheduled', className: 'border-blue-200 bg-blue-50 text-[#0066cc]' },
    expired: { label: 'Expired', className: 'border-slate-200 bg-slate-50 text-slate-500' },
    ended: { label: 'Ended early', className: 'border-slate-200 bg-slate-50 text-slate-500' },
};

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';
const errorClass = 'mt-1 text-[12px] font-medium text-red-600';

function day(value: string): string {
    return new Date(`${value}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}

/** Admin → User Accounts → OIC Designations (LGC Sec. 46) */
export default function OicDesignations({ designations, officials, officers, today }: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm({ designating_user_id: '', designated_user_id: '', start_date: today, end_date: today, designation_order_number: '', remarks: '' });
    const official = officials.find(o => String(o.id) === form.data.designating_user_id);
    const candidates = useMemo(() => officers.filter(o => String(o.id) !== form.data.designating_user_id), [officers, form.data.designating_user_id]);
    const officer = officers.find(o => String(o.id) === form.data.designated_user_id);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/admin/oic', { preserveScroll: true, onSuccess: () => { setOpen(false); form.reset(); } });
    };
    const end = (d: Designation) => {
        if (confirm(`End the designation of ${d.officer} as ${d.title} now? Documents waiting for ${d.official} go back to them.`)) {
            router.post(`/admin/oic/${d.id}/end`, {}, { preserveScroll: true });
        }
    };

    return (
        <TrackngoLayout role="admin">
            <Head title="OIC Designations — TrackNGo Mati" />
            <FlashMessage />

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">OIC Designations</h1>
                        <p className="mt-0.5 max-w-3xl text-sm text-[var(--tng-slate-500)]">
                            While the Mayor or a Department Head is away, documents meant for them go to the designated Officer-in-Charge, who approves, signs or returns them with the designation order as reference (LGC Sec. 46).
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/admin/users" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-medium text-slate-700 shadow-xs hover:bg-slate-50">
                            <Users className="h-4 w-4" /> User Accounts
                        </Link>
                        <button type="button" onClick={() => { form.clearErrors(); setOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs hover:bg-[#005bb5]">
                            <Plus className="h-4 w-4" /> New Designation
                        </button>
                    </div>
                </div>

                <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                            <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <tr>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Officer-in-Charge</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">For (absent official)</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Period</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Designation Order</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {designations.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No Officer-in-Charge has been designated yet.</td>
                                    </tr>
                                )}
                                {designations.map(d => (
                                    <tr key={d.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><UserCheck className="h-4 w-4" /></div>
                                                <div>
                                                    <div className="text-slate-900">{d.officer}</div>
                                                    <div className="text-[12px] text-slate-500">{d.title}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-slate-900">{d.official}</div>
                                            <div className="text-[12px] text-slate-500">{[d.official_role, d.department].filter(Boolean).join(' · ')}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">{d.start_date === d.end_date ? day(d.start_date) : `${day(d.start_date)} – ${day(d.end_date)}`}</td>
                                        <td className="px-4 py-3">
                                            <div>No. {d.designation_order_number}</div>
                                            {d.remarks && <div className="text-[12px] text-slate-500">{d.remarks}</div>}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${STATUS[d.status].className}`}>{STATUS[d.status].label}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {(d.status === 'active' || d.status === 'scheduled') && (
                                                <button type="button" onClick={() => end(d)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                                                    End now
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <BaseModal
                isOpen={open}
                onClose={() => setOpen(false)}
                title="New OIC Designation"
                description="Record the written designation order. Documents waiting for the official move to the OIC on the start date and come back when it ends."
                maxWidth="max-w-lg"
                formProps={{ onSubmit: submit }}
                footer={
                    <>
                        <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={form.processing} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] disabled:opacity-60">Designate</button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Absent official <span className="text-red-500">*</span></label>
                        <select value={form.data.designating_user_id} onChange={(e) => form.setData(data => ({ ...data, designating_user_id: e.target.value, designated_user_id: '' }))} className={inputClass}>
                            <option value="">Select the Mayor or a Department Head…</option>
                            {officials.map(o => <option key={o.id} value={o.id}>{o.name} — {[o.role, o.department].filter(Boolean).join(', ')}</option>)}
                        </select>
                        {form.errors.designating_user_id && <p className={errorClass}>{form.errors.designating_user_id}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Officer-in-Charge <span className="text-red-500">*</span></label>
                        <select value={form.data.designated_user_id} onChange={(e) => form.setData('designated_user_id', e.target.value)} className={inputClass} disabled={!official}>
                            <option value="">{official ? 'Select who acts in their place…' : 'Choose the absent official first'}</option>
                            {candidates.map(o => (
                                <option key={o.id} value={o.id} disabled={!o.has_signature}>
                                    {o.name} — {[o.role, o.department].filter(Boolean).join(', ')}{o.has_signature ? '' : ' (no registered signature)'}
                                </option>
                            ))}
                        </select>
                        {form.errors.designated_user_id && <p className={errorClass}>{form.errors.designated_user_id}</p>}
                        {official && officer && (
                            <p className="mt-1.5 text-[12px] text-slate-500">
                                {officer.name} will act as {official.role === 'Mayor' ? 'Acting Mayor' : `OIC, ${official.department ?? 'the office'}`} and sign with their own registered signature.
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>From <span className="text-red-500">*</span></label>
                            <input type="date" value={form.data.start_date} onChange={(e) => form.setData('start_date', e.target.value)} className={inputClass} />
                            {form.errors.start_date && <p className={errorClass}>{form.errors.start_date}</p>}
                        </div>
                        <div>
                            <label className={labelClass}>Until <span className="text-red-500">*</span></label>
                            <input type="date" value={form.data.end_date} min={form.data.start_date} onChange={(e) => form.setData('end_date', e.target.value)} className={inputClass} />
                            {form.errors.end_date && <p className={errorClass}>{form.errors.end_date}</p>}
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Designation Order No. <span className="text-red-500">*</span></label>
                        <input value={form.data.designation_order_number} onChange={(e) => form.setData('designation_order_number', e.target.value)} className={inputClass} maxLength={60} placeholder="e.g. 12, s. 2026" />
                        {form.errors.designation_order_number && <p className={errorClass}>{form.errors.designation_order_number}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Remarks</label>
                        <input value={form.data.remarks} onChange={(e) => form.setData('remarks', e.target.value)} className={inputClass} maxLength={500} placeholder="e.g. Official travel to Manila" />
                    </div>
                </div>
            </BaseModal>
        </TrackngoLayout>
    );
}
