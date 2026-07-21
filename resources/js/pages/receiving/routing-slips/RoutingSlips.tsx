import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { mockRoutingSlips } from '@/lib/mock-data';
import { SeverityPill } from '@/components/trackngo/SeverityPill';

export default function ReceivingRoutingSlips() {
    const slips = mockRoutingSlips;

    return (
        <TrackngoLayout>
            <Head title="Routing Slips — TrackNGo Mati" />

            <div className="space-y-5">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">Routing Slips</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Track document circulation between departments
                    </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Slip ID</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Document Ref</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">From</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">To</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Action</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Instruction</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Status</th>
                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--tng-slate-500)]">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--tng-slate-100)]">
                            {slips.map((slip) => (
                                <tr key={slip.id} className="transition-colors hover:bg-[var(--tng-blue-50)]/50">
                                    <td className="px-4 py-3 text-sm font-medium text-[var(--tng-slate-800)]">RS-{String(slip.id).padStart(4, '0')}</td>
                                    <td className="px-4 py-3 text-sm font-semibold text-[var(--tng-blue-600)]">{slip.document?.reference_number}</td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-[var(--tng-slate-700)]">{slip.from_user}</div>
                                        <div className="text-xs text-[var(--tng-slate-400)]">{slip.from_department}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-[var(--tng-slate-700)]">{slip.to_user}</div>
                                        <div className="text-xs text-[var(--tng-slate-400)]">{slip.to_department}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold uppercase
                                            ${slip.action === 'forward' ? 'bg-blue-50 text-blue-700' : ''}
                                            ${slip.action === 'endorse' ? 'bg-green-50 text-green-700' : ''}
                                            ${slip.action === 'return' ? 'bg-orange-50 text-orange-700' : ''}
                                            ${slip.action === 'reject' ? 'bg-red-50 text-red-700' : ''}
                                        `}>
                                            {slip.action}
                                        </span>
                                    </td>
                                    <td className="max-w-xs px-4 py-3 text-sm text-[var(--tng-slate-600)] truncate">{slip.instruction}</td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold
                                            ${slip.status === 'active' ? 'bg-blue-50 text-blue-700' : ''}
                                            ${slip.status === 'completed' ? 'bg-green-50 text-green-700' : ''}
                                            ${slip.status === 'returned' ? 'bg-orange-50 text-orange-700' : ''}
                                        `}>
                                            {slip.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-[var(--tng-slate-500)]">
                                        {new Date(slip.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
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
