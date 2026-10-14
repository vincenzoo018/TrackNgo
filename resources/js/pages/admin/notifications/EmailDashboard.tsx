import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    Hourglass,
    RotateCcw,
    Search,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { FlashMessage } from '@/components/trackngo/FlashMessage';
import { StatCard } from '@/components/trackngo/StatCard';
import TablePagination from '@/components/trackngo/TablePagination';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import type { EmailNotification } from '@/types/trackngo';

type EmailStatus = {
    enabled: boolean;
    mailer: string;
    host: string | null;
    configured: boolean;
    from: string;
};

type Today = {
    sent: number;
    queued: number;
    deferred: number;
    failed: number;
    used: number;
    cap: number;
};

type Props = {
    emailLogs: EmailNotification[];
    emailStatus: EmailStatus;
    today: Today;
};

const WAITING = ['queued', 'sending', 'deferred'];

const TYPE_LABELS: Record<string, string> = {
    document_completed: 'Completed',
    document_returned: 'Returned',
    ready_for_pickup: 'Ready for release',
    document_released: 'Released',
    processing_extended: 'Extended',
    deemed_approved: 'Deemed approved',
    arta_escalation: 'ARTA escalation',
    test: 'Test',
};

const RECIPIENT_LABELS: Record<EmailNotification['recipient_type'], string> = {
    staff: 'Staff',
    applicant: 'Applicant',
    test: 'Test',
};

function statusClass(status: string): string {
    if (status === 'sent') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }

    if (status === 'failed' || status === 'invalid_email') {
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }

    if (WAITING.includes(status)) {
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }

    return 'bg-slate-100 text-slate-600 border-slate-200';
}

function YesNo({ value }: { value: boolean }) {
    return (
        <span
            className={
                value
                    ? 'font-semibold text-emerald-700'
                    : 'font-semibold text-slate-700'
            }
        >
            {value ? 'YES' : 'NO'}
        </span>
    );
}

export default function EmailDashboard({
    emailLogs = [],
    emailStatus,
    today,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [retrying, setRetrying] = useState<number | null>(null);

    const query = searchQuery.trim().toLowerCase();
    const filtered = emailLogs.filter(
        (email) =>
            !query ||
            (email.document_ref ?? '').toLowerCase().includes(query) ||
            email.recipient_name.toLowerCase().includes(query) ||
            email.subject.toLowerCase().includes(query) ||
            email.status.includes(query),
    );
    const paginated = filtered.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize,
    );

    const retry = (id: number) => {
        setRetrying(id);
        router.post(
            `/admin/notifications/email/${id}/retry`,
            {},
            {
                preserveScroll: true,
                onFinish: () => setRetrying(null),
            },
        );
    };

    return (
        <TrackngoLayout>
            <Head title="Email Dashboard — TrackNGo Mati" />
            <FlashMessage />

            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--tng-slate-900)]">
                        Email Notification Log
                    </h1>
                    <p className="mt-0.5 text-sm text-[var(--tng-slate-500)]">
                        Event emails to staff and applicants
                    </p>
                </div>

                {/* Mail settings come from .env (TRACKNGO_EMAIL_ENABLED, MAIL_*); the password is never sent to the page */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--tng-slate-200)] bg-white px-4 py-3 text-[13px] text-slate-600">
                    <span>
                        Email Enabled: <YesNo value={emailStatus.enabled} />
                    </span>
                    <span>
                        Mailer:{' '}
                        <span className="font-semibold text-slate-800">
                            {emailStatus.host ?? emailStatus.mailer}
                        </span>
                        {!emailStatus.configured && (
                            <span className="ml-1.5 font-semibold text-rose-600">
                                (not set up)
                            </span>
                        )}
                    </span>
                    <span>
                        Sender:{' '}
                        <span className="font-semibold text-slate-800">
                            {emailStatus.from}
                        </span>
                    </span>
                    <span>
                        Today:{' '}
                        <span className="font-semibold text-slate-800">
                            {today.used} / {today.cap}
                        </span>
                    </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <StatCard
                        title="Sent Today"
                        value={today.sent}
                        sublabel="Accepted by the mail server"
                        icon={CheckCircle2}
                    />
                    <StatCard
                        title="Queued"
                        value={today.queued}
                        sublabel="Waiting for the queue worker"
                        icon={Clock}
                    />
                    <StatCard
                        title="Deferred"
                        value={today.deferred}
                        sublabel="Held by the daily cap"
                        icon={Hourglass}
                    />
                    <StatCard
                        title="Failed Today"
                        value={today.failed}
                        sublabel="Errors and invalid addresses"
                        icon={XCircle}
                        tone={today.failed > 0 ? 'alert' : 'default'}
                    />
                </div>

                <div className="relative">
                    <Search className="absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 text-[var(--tng-slate-400)]" />
                    <input
                        type="text"
                        placeholder="Search by reference number, recipient, subject or status..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="h-12 w-full rounded-xl border border-[var(--tng-slate-200)] bg-white pr-4 pl-12 text-sm focus:border-[var(--tng-blue-500)] focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 focus:outline-none"
                    />
                </div>

                <div className="w-full overflow-hidden rounded-xl border border-[var(--tng-slate-200)] bg-white shadow-xs">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full border-collapse text-left text-[13px] text-slate-700">
                            <thead className="border-b border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)]">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Date / Time
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Document
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Event
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Recipient
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Subject
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-left text-[14px] font-normal text-slate-600">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--tng-slate-100)]">
                                {paginated.length > 0 ? (
                                    paginated.map((email) => (
                                        <tr
                                            key={email.id}
                                            className="transition-colors odd:bg-white even:bg-slate-50/75 hover:bg-blue-50/40"
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                {new Date(
                                                    email.created_at,
                                                ).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-[#0066cc]">
                                                {email.document_ref ?? '—'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                                                {TYPE_LABELS[
                                                    email.notification_type
                                                ] ?? email.notification_type}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-slate-900">
                                                    {email.recipient_name}
                                                </p>
                                                <p className="text-[12px] text-slate-500">
                                                    {
                                                        RECIPIENT_LABELS[
                                                            email.recipient_type
                                                        ]
                                                    }{' '}
                                                    ·{' '}
                                                    <span className="font-mono">
                                                        {email.recipient_email}
                                                    </span>
                                                </p>
                                            </td>
                                            <td className="max-w-md px-4 py-3 text-slate-600">
                                                <p
                                                    className="truncate"
                                                    title={email.subject}
                                                >
                                                    {email.subject}
                                                </p>
                                                {email.error_message && (
                                                    <p className="mt-0.5 text-[12px] text-rose-600">
                                                        {email.error_message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium capitalize ${statusClass(email.status)}`}
                                                >
                                                    {email.status ===
                                                        'sent' && (
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                    )}
                                                    {(email.status ===
                                                        'failed' ||
                                                        email.status ===
                                                            'invalid_email') && (
                                                        <XCircle className="h-3.5 w-3.5" />
                                                    )}
                                                    {WAITING.includes(
                                                        email.status,
                                                    ) && (
                                                        <Clock className="h-3.5 w-3.5" />
                                                    )}
                                                    {email.status.replace(
                                                        '_',
                                                        ' ',
                                                    )}
                                                </span>
                                                {email.attempts > 1 && (
                                                    <p className="mt-0.5 text-[11px] text-slate-400">
                                                        {email.attempts}{' '}
                                                        attempts
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {email.retryable && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            retry(email.id)
                                                        }
                                                        disabled={
                                                            retrying !== null
                                                        }
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--tng-slate-200)] bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                                    >
                                                        <RotateCcw
                                                            className={`h-3.5 w-3.5 ${retrying === email.id ? 'animate-spin' : ''}`}
                                                        />
                                                        Retry
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-8 text-center text-[13px] text-slate-400"
                                        >
                                            No email notifications found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <TablePagination
                        currentPage={currentPage}
                        pageSize={pageSize}
                        totalItems={filtered.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={(newSize) => {
                            setPageSize(newSize);
                            setCurrentPage(1);
                        }}
                        pageSizeOptions={[20, 50, 100]}
                        itemLabel="emails"
                    />
                </div>
            </div>
        </TrackngoLayout>
    );
}
