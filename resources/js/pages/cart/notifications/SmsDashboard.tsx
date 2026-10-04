import { Head } from '@inertiajs/react';
import { Search, Send, CheckCircle2, XCircle, Clock, FlaskConical } from 'lucide-react';
import { useState } from 'react';
import { StatCard } from '@/components/trackngo/StatCard';
import TablePagination from '@/components/trackngo/TablePagination';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { SmsNotification } from '@/types/trackngo';

type SmsStatus = {
    provider: string;
    enabled: boolean;
    dryRun: boolean;
    /** True while SMS_ENABLED=false or SMS_DRY_RUN=true: nothing reaches Semaphore */
    simulating: boolean;
    apiKeyConfigured: boolean;
    senderName: string | null;
    creditBalance: number | null;
};

type Props = {
    smsLogs: SmsNotification[];
    smsStatus: SmsStatus;
};

const WAITING = ['queued', 'sending', 'pending'];
const NOT_SENT = ['skipped', 'invalid_number'];

const TYPE_LABELS: Record<string, string> = {
    document_completed: 'Completed',
    ready_for_pickup: 'Ready for pickup',
    document_released: 'Released',
    arta_escalation: 'ARTA escalation',
    test: 'Test',
};

function statusClass(status: string): string {
    if (status === 'sent') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }

    if (status === 'failed' || status === 'refunded') {
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }

    if (WAITING.includes(status)) {
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }

    if (status === 'simulated') {
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }

    return 'bg-slate-100 text-slate-600 border-slate-200';
}

function YesNo({ value }: { value: boolean }) {
    return <span className={value ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-700'}>{value ? 'YES' : 'NO'}</span>;
}

export default function CartSmsDashboard({ smsLogs = [], smsStatus }: Props) {
    const sms = smsLogs;
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const query = searchQuery.toLowerCase();
    const filteredSms = sms.filter((msg) =>
        (msg.document_ref ?? '').toLowerCase().includes(query) ||
        msg.recipient_name.toLowerCase().includes(query) ||
        msg.mobile_number.includes(searchQuery) ||
        msg.status.includes(query)
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

                {/* Provider status: switches live in .env (SMS_ENABLED, SMS_DRY_RUN) */}
                {smsStatus && (
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--tng-slate-200)] bg-white px-4 py-3 text-[13px] text-slate-600">
                        <span>SMS Provider: <span className="font-semibold text-slate-800">{smsStatus.provider}</span></span>
                        <span>SMS Enabled: <YesNo value={smsStatus.enabled} /></span>
                        <span>Dry Run: <YesNo value={smsStatus.dryRun} /></span>
                        <span>
                            Credit Balance:{' '}
                            <span className="font-semibold text-slate-800">
                                {smsStatus.creditBalance !== null ? smsStatus.creditBalance.toLocaleString() : (smsStatus.apiKeyConfigured ? 'Unavailable' : 'No API key set')}
                            </span>
                        </span>
                        <span>Sender: <span className="font-semibold text-slate-800">{smsStatus.senderName ?? 'Semaphore default'}</span></span>
                        {smsStatus.simulating && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[12px] font-medium text-blue-700">
                                <FlaskConical className="h-3.5 w-3.5" /> Simulation mode: no SMS is sent, no credits used
                            </span>
                        )}
                    </div>
                )}

                {/* SMS Summary Stats */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <StatCard
                        title="Sent"
                        value={sms.filter(s => s.status === 'sent').length}
                        sublabel="Delivered by Semaphore"
                        icon={CheckCircle2}
                    />
                    <StatCard
                        title="Waiting"
                        value={sms.filter(s => WAITING.includes(s.status)).length}
                        sublabel="Queued or awaiting delivery"
                        icon={Clock}
                    />
                    <StatCard
                        title="Failed / Not Sent"
                        value={sms.filter(s => s.status === 'failed' || s.status === 'refunded' || NOT_SENT.includes(s.status)).length}
                        sublabel="Errors, limits, invalid numbers"
                        icon={XCircle}
                    />
                    <StatCard
                        title="Simulated"
                        value={sms.filter(s => s.status === 'simulated').length}
                        sublabel="Logged only, no credits used"
                        icon={Send}
                    />
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        placeholder="Search by reference number, recipient, mobile number or status..."
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
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">Event</th>
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
                                                {msg.document_ref ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-[13px] font-normal text-slate-600 whitespace-nowrap">
                                                {TYPE_LABELS[msg.notification_type ?? ''] ?? msg.notification_type ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 text-[13px] font-normal text-slate-900">
                                                {msg.recipient_name}
                                            </td>
                                            <td className="px-4 py-3 text-[13px] font-mono font-normal text-slate-700">
                                                {msg.mobile_number || '—'}
                                            </td>
                                            <td className="max-w-md px-4 py-3 text-[13px] font-normal text-slate-600">
                                                <p className="truncate" title={msg.message}>{msg.message}</p>
                                                {msg.error_message && (
                                                    <p className="mt-0.5 text-[12px] text-rose-600">{msg.error_message}</p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-medium border capitalize ${statusClass(msg.status)}`}>
                                                    {msg.status === 'sent' && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                    {msg.status === 'failed' && <XCircle className="h-3.5 w-3.5" />}
                                                    {WAITING.includes(msg.status) && <Clock className="h-3.5 w-3.5" />}
                                                    {msg.status === 'simulated' && <FlaskConical className="h-3.5 w-3.5" />}
                                                    {msg.status.replace('_', ' ')}
                                                </span>
                                                {(msg.attempts ?? 0) > 1 && (
                                                    <p className="mt-0.5 text-[11px] text-slate-400">{msg.attempts} attempts</p>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-[13px]">
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
