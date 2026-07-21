import { Head } from '@inertiajs/react';
import { Search, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { mockEscalations } from '@/lib/mock-data';
import { format } from 'date-fns';

export default function ArtaEscalations() {
    return (
        <TrackngoLayout role="cart">
            <Head title="ARTA Escalations" />

            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--tng-slate-900)]">ARTA Escalations</h1>
                    <p className="mt-1 text-[var(--tng-slate-500)]">Manage documents exceeding their Anti-Red Tape Authority processing thresholds</p>
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
                                <th className="px-6 py-4 font-semibold">Severity</th>
                                <th className="px-6 py-4 font-semibold">Days Elapsed / Threshold</th>
                                <th className="px-6 py-4 font-semibold">Notified User</th>
                                <th className="px-6 py-4 font-semibold">Escalated At</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-200)]">
                            {mockEscalations.map((escalation) => (
                                <tr key={escalation.id} className="hover:bg-[var(--tng-slate-50)] transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="font-mono font-medium text-[var(--tng-blue-700)]">
                                            {escalation.document?.tracking_number}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-[var(--tng-slate-900)] max-w-xs truncate">
                                        {escalation.document?.title}
                                    </td>
                                    <td className="px-6 py-4">
                                        {escalation.escalation_level === 'warning' ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                                                <Clock className="w-3 h-3" /> Warning
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                                                <AlertTriangle className="w-3 h-3" /> Overdue
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`font-medium ${escalation.days_elapsed > escalation.arta_threshold ? 'text-red-600' : 'text-amber-600'}`}>
                                            {escalation.days_elapsed}
                                        </span>
                                        <span className="text-[var(--tng-slate-500)]"> / {escalation.arta_threshold} days</span>
                                    </td>
                                    <td className="px-6 py-4">{escalation.notified_user}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-[var(--tng-slate-500)]">
                                        {format(new Date(escalation.escalated_at), 'MMM d, yyyy h:mm a')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tng-blue-600)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--tng-blue-700)] shadow-sm">
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                            Resolve
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
