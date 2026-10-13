import { useForm, usePage } from '@inertiajs/react';
import { Archive } from 'lucide-react';
import { useState } from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';

type PaperLocation = {
    office: string | null;
    cabinet: string;
    box: string | null;
    remarks: string | null;
    recorded_by: string | null;
    recorded_at: string | null;
};

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';
const errorClass = 'mt-1 text-[12px] font-medium text-red-600';

function dateTime(value?: string | null): string {
    if (!value) {
return '';
}

    return new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Where the paper original of an internal document is kept. Internal documents never pass through the Receiving
 * Clerk, so whoever has the document records it here (the clerk sees it on the Location Map).
 */
export function PaperOriginalCard({ doc }: { doc: any }) {
    const departments = ((usePage<any>().props.dbDepartments || []) as any[]).filter(d => d.is_active !== false);
    const info = doc.paper_location as { current: PaperLocation | null; can_record: boolean } | undefined;
    const [open, setOpen] = useState(false);
    // The office keeping it now: the holder's, or the sender's once the document is finished
    const office = doc.current_holder_department_id ?? doc.department_id;
    const form = useForm({ department_id: office ? String(office) : '', cabinet: '', box: '', remarks: '' });

    if (!info || (!info.current && !info.can_record)) {
        return null;
    }

    const current = info.current;

    const close = () => {
        setOpen(false);
        form.clearErrors();
    };
    const save = (e: React.FormEvent) => {
        e.preventDefault();
        form.post(`/documents/${doc.document_id}/physical-location`, {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                form.reset('cabinet', 'box', 'remarks');
            },
        });
    };

    return (
        <section className="rounded-lg border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                    <Archive className="h-4 w-4 text-slate-500" /> Paper Original
                </h2>
                {info.can_record && (
                    <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-medium text-[#0066cc] hover:underline">
                        {current ? 'Update Location' : 'Record Location'}
                    </button>
                )}
            </div>
            <div className="p-5 text-[13px]">
                {current ? (
                    <>
                        <p className="font-medium text-slate-900">{current.office}</p>
                        <p className="text-slate-700">{[current.cabinet, current.box].filter(Boolean).join(' · ')}</p>
                        {current.remarks && <p className="text-slate-500">{current.remarks}</p>}
                        <p className="mt-1 text-[12px] text-slate-500">Recorded by {current.recorded_by} · {dateTime(current.recorded_at)}</p>
                    </>
                ) : (
                    <p className="text-slate-500">Not recorded yet.</p>
                )}
            </div>

            <BaseModal
                isOpen={open}
                onClose={close}
                title="Paper Original"
                identifier={doc.tracking_number || doc.reference_number}
                description="Where the paper original of this document is kept now."
                maxWidth="max-w-md"
                formProps={{ onSubmit: save }}
                footer={
                    <>
                        <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={form.processing} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--tng-blue-700)] disabled:opacity-60">Save Location</button>
                    </>
                }
            >
                <div className="space-y-3">
                    <div>
                        <label className={labelClass}>Office <span className="text-red-500">*</span></label>
                        <select value={form.data.department_id} onChange={(e) => form.setData('department_id', e.target.value)} className={inputClass}>
                            <option value="">Select the office keeping it…</option>
                            {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.department_name}</option>)}
                        </select>
                        {form.errors.department_id && <p className={errorClass}>{form.errors.department_id}</p>}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>Cabinet / shelf <span className="text-red-500">*</span></label>
                            <input value={form.data.cabinet} onChange={(e) => form.setData('cabinet', e.target.value)} className={inputClass} maxLength={100} placeholder="e.g. Cabinet 3, Drawer 2" />
                            {form.errors.cabinet && <p className={errorClass}>{form.errors.cabinet}</p>}
                        </div>
                        <div>
                            <label className={labelClass}>Box / folder</label>
                            <input value={form.data.box} onChange={(e) => form.setData('box', e.target.value)} className={inputClass} maxLength={100} placeholder="e.g. Box 2026-11" />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Remarks</label>
                        <input value={form.data.remarks} onChange={(e) => form.setData('remarks', e.target.value)} className={inputClass} maxLength={255} />
                    </div>
                </div>
            </BaseModal>
        </section>
    );
}
