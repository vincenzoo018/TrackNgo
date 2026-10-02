import { router } from '@inertiajs/react';
import { BellRing, ShieldCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { BaseModal, ModalField, ModalPrimaryButton, ModalSecondaryButton } from '@/components/trackngo/BaseModal';
import { LevelBadge } from '@/components/trackngo/cart/CartUi';
import type { MonitorRow } from '@/lib/cart';
import { formatDateTime, handlerLabel, plural } from '@/lib/cart';

type ActionRow = Pick<
    MonitorRow,
    'id' | 'tracking_number' | 'current_handler' | 'current_department' | 'remaining_days' | 'overdue_days' | 'allowed_days' | 'arta_status' | 'escalation' | 'last_follow_up_at'
>;

const textarea = 'w-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-[var(--tng-blue-500)] focus:ring-2 focus:ring-[var(--tng-blue-500)]/15';

function suggestedMessage(row: ActionRow): string {
    if (row.overdue_days > 0) {
        return `This document is ${plural(row.overdue_days, 'day')} past its ${row.allowed_days}-day processing period. Please act on it as soon as possible.`;
    }

    if (row.arta_status === 'due') {
        return 'This document reaches its processing deadline today. Please complete your action today.';
    }

    if (row.arta_status === 'approaching') {
        return `${plural(row.remaining_days, 'day')} remain before this document's processing deadline. Please act on it.`;
    }

    return 'Please update CART on the status of this document.';
}

/**
 * CART's two monitoring actions — a follow-up notice to the current handler, and resolving an escalation.
 * Neither changes the document or its route. Returns openers plus the modals to render once per page.
 */
export function useCartActions() {
    const [followUpRow, setFollowUpRow] = useState<ActionRow | null>(null);
    const [resolveRow, setResolveRow] = useState<ActionRow | null>(null);
    const [message, setMessage] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const openFollowUp = useCallback((row: ActionRow) => {
        setError(null);
        setMessage(suggestedMessage(row));
        setFollowUpRow(row);
    }, []);

    const openResolve = useCallback((row: ActionRow) => {
        setError(null);
        setNotes('');
        setResolveRow(row);
    }, []);

    const close = useCallback(() => {
        if (!busy) {
            setFollowUpRow(null);
            setResolveRow(null);
        }
    }, [busy]);

    const submitFollowUp = () => {
        if (!followUpRow) {
            return;
        }

        setBusy(true);
        router.post(`/cart/documents/${followUpRow.id}/follow-up`, { message }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`Follow-up sent to ${handlerLabel(followUpRow)}.`);
                setFollowUpRow(null);
            },
            onError: (errors) => setError(errors.message ?? 'The follow-up could not be sent.'),
            onFinish: () => setBusy(false),
        });
    };

    const submitResolve = () => {
        if (!resolveRow) {
            return;
        }

        if (notes.trim().length < 5) {
            setError('Describe the action taken (at least 5 characters).');

            return;
        }

        setBusy(true);
        router.post(`/cart/escalations/${resolveRow.id}/resolve`, { notes }, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success(`Escalation of ${resolveRow.tracking_number} marked as resolved.`);
                setResolveRow(null);
            },
            onError: (errors) => setError(errors.notes ?? 'The escalation could not be resolved.'),
            onFinish: () => setBusy(false),
        });
    };

    const modals = (
        <>
            <BaseModal
                isOpen={Boolean(followUpRow)}
                onClose={close}
                title="Send follow-up"
                identifier={followUpRow?.tracking_number}
                description={followUpRow ? `Notifies ${handlerLabel(followUpRow)} that this document needs action. The document and its route are not changed.` : undefined}
                icon={<BellRing className="h-5 w-5" />}
                maxWidth="max-w-lg"
                childrenContainerClassName="p-6 space-y-4"
                footer={
                    <>
                        <ModalSecondaryButton onClick={close} disabled={busy} />
                        <ModalPrimaryButton type="button" onClick={submitFollowUp} isLoading={busy} loadingText="Sending…">
                            Send follow-up
                        </ModalPrimaryButton>
                    </>
                }
            >
                <ModalField label="Message" required error={error ?? undefined} description="Shown in the handler's notifications and recorded in the audit trail.">
                    <textarea rows={4} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} className={textarea} />
                </ModalField>
                {followUpRow?.last_follow_up_at && <p className="text-xs text-slate-500">Last follow-up: {formatDateTime(followUpRow.last_follow_up_at)}</p>}
            </BaseModal>

            <BaseModal
                isOpen={Boolean(resolveRow)}
                onClose={close}
                title="Resolve escalation"
                identifier={resolveRow?.tracking_number}
                description="Records how the escalation was handled. The document stays with its current handler."
                icon={<ShieldCheck className="h-5 w-5" />}
                iconContainerClassName="bg-emerald-100 text-emerald-700"
                maxWidth="max-w-lg"
                childrenContainerClassName="p-6 space-y-4"
                footer={
                    <>
                        <ModalSecondaryButton onClick={close} disabled={busy} />
                        <ModalPrimaryButton type="button" onClick={submitResolve} isLoading={busy} loadingText="Saving…" className="bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-700">
                            Mark as resolved
                        </ModalPrimaryButton>
                    </>
                }
            >
                {resolveRow?.escalation && (
                    <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                            <LevelBadge level={resolveRow.escalation.level} />
                            <span>{formatDateTime(resolveRow.escalation.escalated_at)}</span>
                        </div>
                        {resolveRow.escalation.reason && <p className="text-slate-700">{resolveRow.escalation.reason}</p>}
                        <p>With {handlerLabel(resolveRow)}</p>
                    </div>
                )}
                <ModalField label="Action taken" required error={error ?? undefined}>
                    <textarea
                        rows={4}
                        maxLength={1000}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. Called the office; the handler committed to forward it today."
                        className={textarea}
                    />
                </ModalField>
            </BaseModal>
        </>
    );

    return { openFollowUp, openResolve, modals };
}
