import { Head } from '@inertiajs/react';
import { Search, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { mockSmsNotifications } from '@/lib/mock-data';
import TablePagination from '@/components/trackngo/TablePagination';
import { StatCard } from '@/components/trackngo/StatCard';

export default function CartSmsDashboard() {
    const sms = mockSmsNotifications;
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const filteredSms = sms.filter((msg) =>
        msg.document_ref.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.recipient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.mobile_number.includes(searchQuery)
    );

    const paginatedSms = filteredSms.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    return (
        <TrackngoLayout>
            <Head title="SMS Dashboard — TrackNGo Mati" />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">SMS Notification Log</h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Monitor automated SMS dispatch status for escalations and updates
                    </p>
                </div>

                {/* SMS Summary Stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <StatCard
                        title="Total Sent"
                        value={sms.length}
                        sublabel="All SMS dispatches"
                        icon={Send}
                    />
                    <StatCard
                        title="Delivered"
                        value={sms.filter(s => s.status === 'sent').length}
                        sublabel="Successfully received"
                        icon={CheckCircle2}
                    />
                    <StatCard
                        title="Failed"
                        value={sms.filter(s => s.status === 'failed').length}
                        sublabel="Delivery errors"
                        icon={XCircle}
                    />
                    <StatCard
                        title="Pending"
                        value={sms.filter(s => s.status === 'pending').length}
                        sublabel="Queued for delivery"
                        icon={Clock}
                    />
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        placeholder="Search by reference number, tracking number, type, or name..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="h-12 w-full rounded-xl border border-[var(--tng-slate-200)] bg-white pl-12 pr-4 text-sm focus:border-[var(--tng-blue-500)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20"
                    />
                </div>

                <div className="w-full rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs overflow-hidden">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left border-collapse text-[13px] text-slate-700">
                            <thead className="bg-[var(--tng-slate-50)] border-b border-[var(--tng-slate-200)]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Date / Time</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Document</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Recipient</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Mobile Number</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Message Content</th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginatedSms.length > 0 ? (
                                    paginatedSms.map((msg) => (
                                        <tr key={msg.id} className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40 group">
                                            <td className="px-4 py-3 text-[13px] font-normal text-slate-600 whitespace-nowrap">
                                                {new Date(msg.created_at).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-[13px] font-normal text-[#0066cc]">
                                                {msg.document_ref}
                                            </td>
                                            <td className="px-4 py-3 text-[13px] font-normal text-slate-900">
                                                {msg.recipient_name}
                                            </td>
                                            <td className="px-4 py-3 text-[13px] font-mono font-normal text-slate-700">
                                                {msg.mobile_number}
                                            </td>
                                            <td className="max-w-md px-4 py-3 text-[13px] font-normal text-slate-600 truncate">
                                                {msg.message}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium border capitalize
                                                    ${msg.status === 'sent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                                                    ${msg.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200' : ''}
                                                    ${msg.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                                                `}>
                                                    {msg.status === 'sent' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                    {msg.status === 'failed' && <XCircle className="h-3.5 w-3.5" />}
                                                    {msg.status === 'pending' && <Clock className="h-3.5 w-3.5" />}
                                                    {msg.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400 text-[13px]">
                                            No SMS notification logs found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filteredSms.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        pageSizeOptions={[20, 50, 100]}
                        itemLabel="notifications"
                    />
                </div>
            </div>
        </TrackngoLayout>
    );
}
