import { Head, router, useForm } from '@inertiajs/react';
import { Download, FileText, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { BaseModal } from '@/components/trackngo/BaseModal';
import { FlashMessage } from '@/components/trackngo/FlashMessage';
import { SearchInput } from '@/components/trackngo/ListFilters';
import TableActionButtons from '@/components/trackngo/TableActionButtons';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';

type Template = {
    id: number;
    name: string;
    description: string | null;
    type_id: number | null;
    type_name: string | null;
    file_name: string;
    file_size: number | null;
    is_active: boolean;
    updated_by: string | null;
    updated_at: string | null;
};

type Props = { templates: Template[]; documentTypes: { type_id: number; type_name: string }[] };

const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tng-blue-500)] focus:ring-1 focus:ring-[var(--tng-blue-500)]';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700';
const errorClass = 'mt-1 text-[12px] font-medium text-red-600';

function size(bytes: number | null): string {
    if (!bytes) return '';
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Admin → Document Templates: blank forms staff download from the filing form for the chosen document type */
export default function TemplatesIndex({ templates, documentTypes }: Props) {
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Template | 'new' | null>(null);
    const form = useForm<{ name: string; description: string; type_id: string; is_active: boolean; file: File | null }>({
        name: '', description: '', type_id: '', is_active: true, file: null,
    });

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return templates.filter(t => !q || [t.name, t.description, t.type_name, t.file_name].some(v => String(v || '').toLowerCase().includes(q)));
    }, [templates, search]);

    const open = (template: Template | 'new') => {
        form.clearErrors();
        form.setData(template === 'new'
            ? { name: '', description: '', type_id: '', is_active: true, file: null }
            : { name: template.name, description: template.description || '', type_id: template.type_id ? String(template.type_id) : '', is_active: template.is_active, file: null });
        setEditing(template);
    };
    const save = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, forceFormData: true, onSuccess: () => setEditing(null) };
        if (editing === 'new') {
            form.post('/admin/templates', options);
        } else if (editing) {
            form.transform(data => ({ ...data, is_active: data.is_active ? 1 : 0 }));
            form.post(`/admin/templates/${editing.id}`, options);
        }
    };
    const remove = (template: Template) => {
        if (confirm(`Delete the template "${template.name}"? Its file is removed.`)) {
            router.delete(`/admin/templates/${template.id}`, { preserveScroll: true });
        }
    };

    return (
        <TrackngoLayout role="admin">
            <Head title="Document Templates — TrackNGo Mati" />
            <FlashMessage />

            <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-[20px] font-bold text-[var(--tng-slate-900)]">Document Templates</h1>
                        <p className="mt-0.5 max-w-3xl text-sm text-[var(--tng-slate-500)]">
                            Blank forms and letter templates (PDF or Word). Staff see the template of the document type they choose when filing a document.
                        </p>
                    </div>
                    <button type="button" onClick={() => open('new')} className="inline-flex items-center gap-2 rounded-lg bg-[#0066cc] px-4 py-2 text-[14px] font-medium text-white shadow-xs hover:bg-[#005bb5]">
                        <Plus className="h-4 w-4" /> Add Template
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <SearchInput value={search} onChange={setSearch} />
                </div>

                <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                            <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <tr>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Template</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Document Type</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">File</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Last Updated</th>
                                    <th className="px-4 py-3 text-[14px] font-normal text-slate-600">Status</th>
                                    <th className="px-4 py-3 text-right text-[14px] font-normal text-slate-600">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                                            {templates.length === 0 ? 'No templates yet. Add the forms offices use most.' : 'No template matches the search.'}
                                        </td>
                                    </tr>
                                )}
                                {filtered.map(t => (
                                    <tr key={t.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--tng-blue-50)] text-[var(--tng-blue-600)]"><FileText className="h-4 w-4" /></div>
                                                <div className="min-w-0">
                                                    <div className="text-slate-900">{t.name}</div>
                                                    {t.description && <div className="text-[12px] text-slate-500">{t.description}</div>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{t.type_name ?? <span className="text-slate-400">Any type</span>}</td>
                                        <td className="px-4 py-3">
                                            <a href={`/templates/${t.id}/download`} className="inline-flex items-center gap-1.5 text-[#0066cc] hover:underline">
                                                <Download className="h-3.5 w-3.5" /> {t.file_name}
                                            </a>
                                            <div className="text-[12px] text-slate-500">{size(t.file_size)}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div>{t.updated_at ? new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</div>
                                            <div className="text-[12px] text-slate-500">{t.updated_by}</div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${t.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                                                {t.is_active ? 'Offered' : 'Hidden'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <TableActionButtons onEdit={() => open(t)} onDelete={() => remove(t)} editTitle="Edit template" deleteTitle="Delete template" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <BaseModal
                isOpen={editing !== null}
                onClose={() => setEditing(null)}
                title={editing === 'new' ? 'Add Template' : 'Edit Template'}
                maxWidth="max-w-lg"
                formProps={{ onSubmit: save }}
                footer={
                    <>
                        <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
                        <button type="submit" disabled={form.processing} className="rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-blue-700)] disabled:opacity-60">
                            {form.processing ? 'Saving…' : 'Save'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Name <span className="text-red-500">*</span></label>
                        <input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} className={inputClass} maxLength={150} placeholder="e.g. Building Permit Application Form" autoFocus />
                        {form.errors.name && <p className={errorClass}>{form.errors.name}</p>}
                    </div>
                    <div>
                        <label className={labelClass}>Description</label>
                        <input value={form.data.description} onChange={(e) => form.setData('description', e.target.value)} className={inputClass} maxLength={500} />
                    </div>
                    <div>
                        <label className={labelClass}>Document type</label>
                        <select value={form.data.type_id} onChange={(e) => form.setData('type_id', e.target.value)} className={inputClass}>
                            <option value="">Any type</option>
                            {documentTypes.map(t => <option key={t.type_id} value={t.type_id}>{t.type_name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={labelClass}>File (PDF or Word .docx){editing === 'new' && <span className="text-red-500"> *</span>}</label>
                        <input
                            type="file"
                            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={(e) => form.setData('file', e.target.files?.[0] ?? null)}
                            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                        />
                        {editing && editing !== 'new' && <p className="mt-1 text-[12px] text-slate-500">Current file: {editing.file_name}. Choose a file only to replace it.</p>}
                        {form.errors.file && <p className={errorClass}>{form.errors.file}</p>}
                    </div>
                    {editing !== 'new' && (
                        <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} className="rounded border-slate-300" />
                            Offered in the filing form
                        </label>
                    )}
                </div>
            </BaseModal>
        </TrackngoLayout>
    );
}
