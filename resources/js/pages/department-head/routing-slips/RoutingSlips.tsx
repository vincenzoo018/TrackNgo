import { Head } from '@inertiajs/react';
import { FileText, Printer, Search } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { mockRoutingSlips } from '@/lib/mock-data';
import { format } from 'date-fns';

export default function RoutingSlips() {
    return (
        <TrackngoLayout role="department-head">
            <Head title="Routing Slips" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">Routing Slips</h1>
                    <p className="mt-1 text-[var(--tng-slate-500)]">View and manage document routing histories</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--tng-slate-400)]" />
                        <input
                            type="text"
                            placeholder="Search tracking #..."
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
                                <th className="px-6 py-4 font-semibold">Tracking #</th>
                                <th className="px-6 py-4 font-semibold">Document Title</th>
                                <th className="px-6 py-4 font-semibold">Action</th>
                                <th className="px-6 py-4 font-semibold">From</th>
                                <th className="px-6 py-4 font-semibold">To</th>
                                <th className="px-6 py-4 font-semibold">Date</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-200)]">
                            {mockRoutingSlips.map((slip) => (
                                <tr key={slip.id} className="hover:bg-[var(--tng-slate-50)] transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-medium text-[var(--tng-blue-700)]">
                                            {slip.document?.tracking_number}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-[var(--tng-slate-900)] max-w-xs truncate">
                                        {slip.document?.title}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset uppercase ${
                                            slip.action === 'forward' ? 'bg-blue-50 text-blue-700 ring-blue-700/10' :
                                            slip.action === 'endorse' ? 'bg-purple-50 text-purple-700 ring-purple-700/10' :
                                            slip.action === 'return' ? 'bg-amber-50 text-amber-700 ring-amber-700/10' :
                                            'bg-emerald-50 text-emerald-700 ring-emerald-700/10'
                                        }`}>
                                            {slip.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-[var(--tng-slate-900)]">{slip.from_user}</span>
                                            <span className="text-xs text-[var(--tng-slate-500)]">{slip.from_department}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-[var(--tng-slate-900)]">{slip.to_user}</span>
                                            <span className="text-xs text-[var(--tng-slate-500)]">{slip.to_department}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-[var(--tng-slate-500)]">
                                        {format(new Date(slip.created_at), 'MMM d, yyyy h:mm a')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--tng-slate-600)] transition-colors hover:bg-[var(--tng-slate-50)]">
                                            <Printer className="h-3.5 w-3.5" />
                                            Print
                                        </button>
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

