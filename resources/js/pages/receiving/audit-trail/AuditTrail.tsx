import { Head } from '@inertiajs/react';
import { Search, History, Filter } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { mockAuditTrail } from '@/lib/mock-data';
import { format } from 'date-fns';

export default function AuditTrail() {
    return (
        <TrackngoLayout role="receiving">
            <Head title="Audit Trail" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">Audit Trail</h1>
                    <p className="mt-1 text-[var(--tng-slate-500)]">System-wide event and document tracking logs</p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-2 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-2 text-sm font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]">
                        <Filter className="h-4 w-4" />
                        Filter
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            className="pl-9 pr-4 py-2 w-full sm:w-64 rounded-md border border-[var(--tng-slate-200)] focus:border-[var(--tng-blue-600)] focus:ring-1 focus:ring-[var(--tng-blue-600)] outline-none text-sm shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-[var(--tng-slate-200)] shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-[var(--tng-slate-600)]">
                        <thead className="bg-[var(--tng-slate-50)] text-[var(--tng-slate-500)] border-b border-[var(--tng-slate-200)]">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Timestamp</th>
                                <th className="px-6 py-4 font-semibold">Action</th>
                                <th className="px-6 py-4 font-semibold">User / Role</th>
                                <th className="px-6 py-4 font-semibold">Description</th>
                                <th className="px-6 py-4 font-semibold">Document Ref</th>
                                <th className="px-6 py-4 font-semibold text-right">IP Address</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-200)]">
                            {mockAuditTrail.map((log) => (
                                <tr key={log.id} className="hover:bg-[var(--tng-slate-50)] transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-[var(--tng-slate-500)]">
                                        {format(new Date(log.timestamp), 'MMM d, yyyy h:mm:ss a')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-[var(--tng-slate-900)] flex items-center gap-2">
                                            <History className="w-3.5 h-3.5 text-[var(--tng-slate-400)]" />
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-[var(--tng-slate-900)]">{log.user}</span>
                                            <span className="text-xs text-[var(--tng-slate-500)] capitalize">{log.user_role.replace('_', ' ')}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate text-[var(--tng-slate-600)]" title={log.description}>
                                        {log.description}
                                    </td>
                                    <td className="px-6 py-4">
                                        {log.document_ref ? (
                                            <span className="font-mono text-xs font-medium text-[var(--tng-blue-700)] bg-blue-50 px-2 py-1 rounded">
                                                {log.document_ref}
                                            </span>
                                        ) : (
                                            <span className="text-[var(--tng-slate-400)]">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-xs text-[var(--tng-slate-500)]">
                                        {log.ip_address}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </TrackngoLayout>
    );
}

