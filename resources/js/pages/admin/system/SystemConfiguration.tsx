import { Head, router, useForm } from '@inertiajs/react';
import { CalendarDays, Download, FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { FlashMessage } from '@/components/trackngo/FlashMessage';
import TabNavigation from '@/components/trackngo/TabNavigation';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

type DocumentType = {
    type_id: number;
    type_name: string;
    description: string | null;
    arta_processing_days: number;
    service_category: string;
    is_active: boolean;
    documents_count: number;
    counts_calendar_days: boolean;
};

type Category = { id: string; label: string; days: number | null };
type Holiday = { id: number; date: string; name: string; type: 'regular' | 'special' | 'suspension'; year: number };

type Props = {
    documentTypes: DocumentType[];
    categories: Category[];
    holidays: Holiday[];
    holidayTypes: { id: string; label: string }[];
    year: number;
    years: number[];
    hasNationalList: boolean;
};

type Tab = 'types' | 'holidays';

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)] disabled:bg-slate-50 disabled:text-slate-400';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';
const errorClass = 'mt-1 text-[12px] font-medium text-red-600';
const primaryButton = 'inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs transition-all hover:bg-[#005bb5]';
const secondaryButton = 'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-medium text-slate-700 shadow-xs transition-all hover:bg-slate-50';

const HOLIDAY_CHIP: Record<string, string> = {
    regular: 'border-blue-200 bg-blue-50 text-[#0066cc]',
    special: 'border-amber-200 bg-amber-50 text-amber-800',
    suspension: 'border-red-200 bg-red-50 text-red-700',
};

function formatDate(value: string): { date: string; weekday: string } {
    const d = new Date(`${value.slice(0, 10)}T12:00:00+08:00`);

    return {
        date: d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }),
        weekday: d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Manila' }),
    };
}

function periodLabel(type: Pick<DocumentType, 'arta_processing_days' | 'counts_calendar_days' | 'service_category'>): string {
    const days = `${type.arta_processing_days} ${type.counts_calendar_days ? 'calendar' : 'working'} day${type.arta_processing_days === 1 ? '' : 's'}`;

    return type.service_category === 'legislative' ? `${days} for the Mayor to sign or veto` : days;
}

export default function SystemConfiguration({ documentTypes, categories, holidays, holidayTypes, year, years, hasNationalList }: Props) {
    const initialTab = (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'holidays') ? 'holidays' : 'types';
    const [tab, setTab] = useState<Tab>(initialTab);
    const [typeModal, setTypeModal] = useState<DocumentType | 'new' | null>(null);
    const [holidayModal, setHolidayModal] = useState<Holiday | 'new' | null>(null);

    const typeForm = useForm({ type_name: '', description: '', service_category: 'simple', arta_processing_days: '' as string | number, is_active: true });
    const holidayForm = useForm({ date: '', name: '', type: 'regular' });

    const openType = (type: DocumentType | 'new') => {
        typeForm.clearErrors();
        typeForm.setData(type === 'new'
            ? { type_name: '', description: '', service_category: 'simple', arta_processing_days: '', is_active: true }
            : { type_name: type.type_name, description: type.description || '', service_category: type.service_category, arta_processing_days: type.arta_processing_days, is_active: type.is_active });
        setTypeModal(type);
    };
    const openHoliday = (holiday: Holiday | 'new') => {
        holidayForm.clearErrors();
        holidayForm.setData(holiday === 'new' ? { date: `${year}-01-01`, name: '', type: 'regular' } : { date: holiday.date.slice(0, 10), name: holiday.name, type: holiday.type });
        setHolidayModal(holiday);
    };

    const selectedCategory = categories.find(c => c.id === typeForm.data.service_category);
    const saveType = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setTypeModal(null) };
        if (typeModal === 'new') {
            typeForm.post('/admin/system/types', options);
        } else if (typeModal) {
            typeForm.put(`/admin/system/types/${typeModal.type_id}`, options);
        }
    };
    const saveHoliday = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: () => setHolidayModal(null) };
        if (holidayModal === 'new') {
            holidayForm.post('/admin/system/holidays', options);
        } else if (holidayModal) {
            holidayForm.put(`/admin/system/holidays/${holidayModal.id}`, options);
        }
    };
    const removeHoliday = (holiday: Holiday) => {
        if (confirm(`Remove ${holiday.name} from the Holiday Calendar? Deadlines computed from now on will count that day.`)) {
            router.delete(`/admin/system/holidays/${holiday.id}`, { preserveScroll: true });
        }
    };
    const changeYear = (value: number) => router.get('/admin/system', { year: value, tab: 'holidays' }, { preserveState: true, preserveScroll: true });
    const loadNational = () => router.post('/admin/system/holidays/national', { year }, { preserveScroll: true });

    const yearOptions = Array.from(new Set([...years, year, year + 1])).sort();

    return (
        <TrackngoLayout role="admin">
            <Head title="System Configuration — TrackNGo Mati" />
            <FlashMessage />

            <div className="space-y-6">
                <div>
                    <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">System Configuration</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Document types with their Citizen's Charter processing period, and the Holiday Calendar every ARTA deadline skips.
                    </p>
                </div>

                <TabNavigation<Tab>
                    tabs={[
                        { id: 'types', label: 'Document Types', icon: <FileText className="h-4 w-4" />, count: documentTypes.length },
                        { id: 'holidays', label: 'Holiday Calendar', icon: <CalendarDays className="h-4 w-4" />, count: holidays.length },
                    ]}
                    activeTab={tab}
                    onChange={setTab}
                />

                {tab === 'types' && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="max-w-3xl text-[13px] text-slate-500">
                                RA 11032: Simple 3, Complex 7, Highly Technical 20 working days (weekends and holidays not counted). Ordinances and resolutions give the Mayor 10 calendar days to sign or veto (LGC Sec. 54). A changed period applies to documents filed afterwards.
                            </p>
                            <button type="button" onClick={() => openType('new')} className={primaryButton}>
                                <Plus className="h-4 w-4" /> Add Document Type
                            </button>
                        </div>

                        <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                            <div className="w-full overflow-x-auto">
                                <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                                    <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                        <tr>
                                            <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Document Type</th>
                                            <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Category</th>
                                            <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Processing Period</th>
                                            <th className="px-4 py-3 text-center text-[14px] font-normal text-slate-600">Documents</th>
                                            <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Status</th>
                                            <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                        {documentTypes.map(type => (
                                            <tr key={type.type_id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40">
                                                <td className="px-4 py-3">
                                                    <div className="text-slate-900">{type.type_name}</div>
                                                    {type.description && <div className="text-[12px] text-slate-500">{type.description}</div>}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">{categories.find(c => c.id === type.service_category)?.label ?? 'Custom'}</td>
                                                <td className="px-4 py-3">{periodLabel(type)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-700">{type.documents_count}</span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${type.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                                        {type.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <TableActionButtons onEdit={() => openType(type)} editTitle="Edit document type" showDelete={false} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'holidays' && (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <label htmlFor="holiday-year" className="text-[13px] text-slate-600">Year</label>
                                <select id="holiday-year" value={year} onChange={(e) => changeYear(Number(e.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">
                                    {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {hasNationalList && (
                                    <button type="button" onClick={loadNational} className={secondaryButton} title="Adds the regular and special non-working days proclaimed for this year">
                                        <Download className="h-4 w-4" /> Load national holidays
                                    </button>
                                )}
                                <button type="button" onClick={() => openHoliday('new')} className={primaryButton}>
                                    <Plus className="h-4 w-4" /> Add Holiday / Suspension
                                </button>
                            </div>
                        </div>
                        <p className="text-[13px] text-slate-500">
                            Add local holidays (e.g. the City Charter Day) and work suspensions (typhoons, declared non-working days). Deadlines computed from then on skip them.
                        </p>

                        <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                            <div className="w-full overflow-x-auto">
                                <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                                    <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                        <tr>
                                            <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Date</th>
                                            <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Holiday</th>
                                            <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Type</th>
                                            <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                        {holidays.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No holidays recorded for {year}.</td>
                                            </tr>
                                        )}
                                        {holidays.map(holiday => {
                                            const { date, weekday } = formatDate(holiday.date);

                                            return (
                                                <tr key={holiday.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40">
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-slate-900">{date}</div>
                                                        <div className="text-[12px] text-slate-500">{weekday}</div>
                                                    </td>
                                                    <td className="px-4 py-3">{holiday.name}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${HOLIDAY_CHIP[holiday.type]}`}>
                                                            {holidayTypes.find(t => t.id === holiday.type)?.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                                        <TableActionButtons onEdit={() => openHoliday(holiday)} onDelete={() => removeHoliday(holiday)} editTitle="Edit" deleteTitle="Remove" />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <BaseModal
                isOpen={typeModal !== null}
                onClose={() => setTypeModal(null)}
                title={typeModal === 'new' ? 'Add Document Type' : 'Edit Document Type'}
                description="The category sets the processing period from the Citizen's Charter. Only Custom takes the days you enter."
                maxWidth="max-w-lg"
                formProps={{ onSubmit: saveType }}
                footer={
                    <>
                        <button type="button" onClick={() => setTypeModal(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={typeForm.processing} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] disabled:opacity-60">Save</button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Name <span className="text-red-500">*</span></label>
                        <input value={typeForm.data.type_name} onChange={(e) => typeForm.setData('type_name', e.target.value)} className={inputClass} maxLength={100} autoFocus />
                        {typeForm.errors.type_name && <p className={errorClass}>{typeForm.errors.type_name}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Description</label>
                        <input value={typeForm.data.description} onChange={(e) => typeForm.setData('description', e.target.value)} className={inputClass} maxLength={255} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <label className={labelClass}>Category <span className="text-red-500">*</span></label>
                            <select
                                value={typeForm.data.service_category}
                                onChange={(e) => {
                                    const category = categories.find(c => c.id === e.target.value);
                                    typeForm.setData(data => ({ ...data, service_category: e.target.value, arta_processing_days: category?.days ?? data.arta_processing_days }));
                                }}
                                className={inputClass}
                            >
                                {categories.map(c => <option key={c.id} value={c.id}>{c.label}{c.days ? ` — ${c.days} days` : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Processing days</label>
                            <input
                                type="number"
                                min={1}
                                max={60}
                                value={selectedCategory?.days ?? typeForm.data.arta_processing_days}
                                onChange={(e) => typeForm.setData('arta_processing_days', e.target.value)}
                                disabled={selectedCategory?.days !== null}
                                className={inputClass}
                            />
                            {typeForm.errors.arta_processing_days && <p className={errorClass}>{typeForm.errors.arta_processing_days}</p>}
                        </div>
                    </div>
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
                        {typeForm.data.service_category === 'legislative'
                            ? 'Counted in calendar days from the Mayor\'s receipt. Without a signature or veto in time the document is deemed approved (LGC Sec. 54).'
                            : 'Counted in working days: weekends and the dates in the Holiday Calendar are skipped (RA 11032). One extension of the same length is allowed.'}
                    </p>
                    {typeModal !== 'new' && (
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={typeForm.data.is_active} onChange={(e) => typeForm.setData('is_active', e.target.checked)} className="rounded border-slate-300" />
                            Offered when filing a document
                        </label>
                    )}
                </div>
            </BaseModal>

            <BaseModal
                isOpen={holidayModal !== null}
                onClose={() => setHolidayModal(null)}
                title={holidayModal === 'new' ? 'Add Holiday / Suspension' : 'Edit Holiday'}
                maxWidth="max-w-md"
                formProps={{ onSubmit: saveHoliday }}
                footer={
                    <>
                        <button type="button" onClick={() => setHolidayModal(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={holidayForm.processing} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] disabled:opacity-60">Save</button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Date <span className="text-red-500">*</span></label>
                        <input type="date" value={holidayForm.data.date} onChange={(e) => holidayForm.setData('date', e.target.value)} className={inputClass} />
                        {holidayForm.errors.date && <p className={errorClass}>{holidayForm.errors.date}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Name <span className="text-red-500">*</span></label>
                        <input value={holidayForm.data.name} onChange={(e) => holidayForm.setData('name', e.target.value)} className={inputClass} maxLength={150} placeholder="e.g. City of Mati Charter Day" />
                        {holidayForm.errors.name && <p className={errorClass}>{holidayForm.errors.name}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Type <span className="text-red-500">*</span></label>
                        <select value={holidayForm.data.type} onChange={(e) => holidayForm.setData('type', e.target.value)} className={inputClass}>
                            {holidayTypes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                        </select>
                    </div>
                </div>
            </BaseModal>
        </TrackngoLayout>
    );
}
