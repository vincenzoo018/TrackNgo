import { Head } from '@inertiajs/react';
import { Plus, Search, FileSignature } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import TableActionButtons from '@/components/trackngo/TableActionButtons';

export default function Templates() {
    return (
        <TrackngoLayout role="admin">
            <Head title="System Templates" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">System Templates</h1>
                    <p className="mt-1 text-[var(--tng-slate-500)]">Manage document and notification templates</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 rounded-lg bg-[var(--tng-blue-600)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--tng-blue-700)]">
                        <Plus className="h-4 w-4" />
                        New Template
                    </button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm flex flex-col hover:border-[var(--tng-blue-300)] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="rounded-lg bg-blue-50 p-3 text-blue-600">
                            <FileSignature className="h-6 w-6" />
                        </div>
                        <TableActionButtons
                            onEdit={() => alert('Edit template')}
                            editTitle="Edit Record"
                            onDelete={() => { if (confirm('Delete template?')) alert('Deleted'); }}
                            deleteTitle="Delete Record"
                        />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--tng-slate-900)] mb-1">Standard SMS Alert</h3>
                    <p className="text-sm text-[var(--tng-slate-500)] mb-4 flex-1">
                        Default template for notifying users when their document is processed. Contains merge tags for document title and tracking number.
                    </p>
                    <div className="flex items-center justify-between text-xs font-medium text-[var(--tng-slate-500)] border-t border-[var(--tng-slate-100)] pt-4 mt-auto">
                        <span>Type: Notification</span>
                        <span className="text-[var(--tng-blue-600)]">Active</span>
                    </div>
                </div>

                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm flex flex-col hover:border-[var(--tng-blue-300)] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="rounded-lg bg-amber-50 p-3 text-amber-600">
                            <FileSignature className="h-6 w-6" />
                        </div>
                        <TableActionButtons
                            onEdit={() => alert('Edit template')}
                            editTitle="Edit Record"
                            onDelete={() => { if (confirm('Delete template?')) alert('Deleted'); }}
                            deleteTitle="Delete Record"
                        />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--tng-slate-900)] mb-1">Escalation Warning</h3>
                    <p className="text-sm text-[var(--tng-slate-500)] mb-4 flex-1">
                        Template for ARTA warning notifications when a document is near its threshold limit.
                    </p>
                    <div className="flex items-center justify-between text-xs font-medium text-[var(--tng-slate-500)] border-t border-[var(--tng-slate-100)] pt-4 mt-auto">
                        <span>Type: Notification</span>
                        <span className="text-[var(--tng-blue-600)]">Active</span>
                    </div>
                </div>

                <div className="rounded-xl border border-[var(--tng-slate-200)] bg-white p-6 shadow-sm flex flex-col hover:border-[var(--tng-blue-300)] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-600">
                            <FileSignature className="h-6 w-6" />
                        </div>
                        <TableActionButtons
                            onEdit={() => alert('Edit template')}
                            editTitle="Edit Record"
                            onDelete={() => { if (confirm('Delete template?')) alert('Deleted'); }}
                            deleteTitle="Delete Record"
                        />
                    </div>
                    <h3 className="text-lg font-semibold text-[var(--tng-slate-900)] mb-1">Routing Slip Printout</h3>
                    <p className="text-sm text-[var(--tng-slate-500)] mb-4 flex-1">
                        HTML template used to generate the physical routing slip format for printing.
                    </p>
                    <div className="flex items-center justify-between text-xs font-medium text-[var(--tng-slate-500)] border-t border-[var(--tng-slate-100)] pt-4 mt-auto">
                        <span>Type: Document</span>
                        <span className="text-[var(--tng-blue-600)]">Active</span>
                    </div>
                </div>
            </div>
        </TrackngoLayout>
    );
}
