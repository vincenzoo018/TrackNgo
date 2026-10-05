import type { ReactNode } from 'react';
import { ConfirmActionModal } from '@/components/trackngo/ConfirmActionModal';
import { DocumentDetailView, actionButton } from '@/components/trackngo/DocumentDetailView';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { HolderStatusCard } from '@/components/trackngo/HolderStatusCard';
import { ReturnModal } from '@/components/trackngo/ReturnModal';
import { SuccessModal } from '@/components/trackngo/SuccessModal';
import type { DocumentPage } from '@/hooks/use-document-page';
import { describeHolder } from '@/lib/document-holder';

export function ReturnButton({ page }: { page: DocumentPage }) {
    return (
        <button onClick={() => page.setReturnModalOpen(true)} className={actionButton.secondary}>
            Return Document
        </button>
    );
}

/**
 * A returned document: its holder uploads the correction (and, on the fixed-flow documents, may re-route it);
 * anyone else sees who has it.
 */
export function ReturnedActions({ page, isHolder, rerouteLabel }: { page: DocumentPage; isHolder: boolean; rerouteLabel?: string }) {
    const { doc, users, auth } = page;

    if (!isHolder) {
        return (
            <HolderStatusCard
                variant="waiting"
                title="Returned for Correction"
                holder={describeHolder(doc, users)}
                message="Waiting for the missing / corrected files to be uploaded."
            />
        );
    }

    return (
        <>
            <button type="button" onClick={() => page.setCorrectionModalOpen(true)} className={actionButton.danger}>
                Upload Correction
            </button>
            {rerouteLabel && (
                <button onClick={() => page.setForwardModalOpen(true)} className={actionButton.secondary}>
                    {rerouteLabel}
                </button>
            )}
            {/* Returned to you: pass it further back unless you are where it started */}
            {String(doc.submitted_by) !== String(auth?.user?.id) && <ReturnButton page={page} />}
        </>
    );
}

const CLOSED_STATUSES = ['completed', 'released', 'archived'];
const AWAITING_ACCEPTANCE = ['sent', 'submitted', 'registered', 'pending', 'endorsed', 'forwarded'];

/**
 * Actions on a document that follows the route chosen at filing. Nobody picks the next person: approving
 * (and signing, when this person signs) sends it to the next one on the route, and after the last person it
 * goes to Receiving for release (external) or is completed (internal). Returning stays available.
 */
export function RouteActions({ page, isHolder }: { page: DocumentPage; isHolder: boolean }) {
    const { doc, users, auth } = page;
    const info = doc.route_info ?? {};
    const status = String(doc.status || '').toLowerCase();

    if (CLOSED_STATUSES.includes(status)) {
        return (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-[14px] font-medium text-slate-600">
                {info.ends_with === 'release' ? 'Released / Completed' : 'Completed'}
            </p>
        );
    }

    if (status === 'returned') {
        return <ReturnedActions page={page} isHolder={isHolder} />;
    }

    if (!isHolder) {
        const sentByMe = String(doc.submitted_by) === String(auth?.user?.id);

        return (
            <HolderStatusCard
                variant={sentByMe ? 'sent' : 'forwarded'}
                title={sentByMe ? 'Sent' : 'On its route'}
                holder={describeHolder(doc, users)}
                message="It moves to the next person on its route automatically when they approve it."
            />
        );
    }

    // External route finished: Receiving releases it to the applicant
    if (status === 'approved' && info.ends_with === 'release') {
        return (
            <>
                <button
                    onClick={() => page.requestRouteAction('route:release', 'Release Document', 'Are you sure you want to release this document to the applicant?', 'Release', 'Document successfully released to applicant.')}
                    className={actionButton.primary}
                >
                    Release to Applicant
                </button>
                <ReturnButton page={page} />
            </>
        );
    }

    if (AWAITING_ACCEPTANCE.includes(status)) {
        return (
            <>
                <button
                    onClick={() => page.requestRouteAction('route:accept', 'Accept Document', 'Are you sure you want to receive and accept this document?', 'Receive', 'Document received and accepted.')}
                    className={actionButton.primary}
                >
                    Receive / Accept Document
                </button>
                <ReturnButton page={page} />
            </>
        );
    }

    const verb = info.holder_signs ? 'Sign & Approve' : 'Approve';
    const next: string | null = info.next_name ?? null;
    const destination = next ?? (info.ends_with === 'release' ? 'Receiving for release' : null);
    const label = destination ? `${verb} — send to ${destination}` : `${verb} & Complete`;
    const success = next
        ? `Document ${info.holder_signs ? 'signed, ' : ''}approved and sent to ${next}.`
        : info.ends_with === 'release'
            ? 'Document approved and sent to Receiving for release.'
            : 'Document approved and completed. It has been returned to the sender.';

    return (
        <>
            <button
                onClick={() => page.requestRouteAction(
                    'route:approve',
                    verb,
                    `${info.holder_signs ? 'Your registered signature will be stamped on the document. ' : ''}`
                        + (destination ? `It then goes to ${destination}.` : 'This completes the document and returns it to the sender.'),
                    info.holder_signs ? 'Sign & Approve' : 'Approve',
                    success,
                )}
                className={actionButton.primary}
            >
                {label}
            </button>
            <ReturnButton page={page} />
        </>
    );
}

export function NoActionsAvailable() {
    return (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-500">
            No actions available
        </p>
    );
}

type DocumentPageViewProps = {
    page: DocumentPage;
    /** Role key for the official routing slip modal links */
    role: string;
    backUrl: string;
    actionsTitle: string;
    actions: ReactNode;
    onEndorse: (destType: string, destId: string, rem: string) => void;
    onReturn: (reason: string) => void;
    onConfirm: () => void;
};

/** A role's document detail view with its Forward, Return, confirm and success dialogs. */
export function DocumentPageView({ page, role, backUrl, actionsTitle, actions, onEndorse, onReturn, onConfirm }: DocumentPageViewProps) {
    const { doc, confirmState, successState } = page;

    return (
        <>
            <DocumentDetailView
                doc={doc}
                trail={page.trail}
                comments={page.comments}
                attachments={page.attachments}
                users={page.users}
                role={role}
                backUrl={backUrl}
                actionsTitle={actionsTitle}
                actions={actions}
                correctionOpen={page.correctionModalOpen}
                onCorrectionOpenChange={page.setCorrectionModalOpen}
            />

            <ForwardModal
                open={page.forwardModalOpen}
                onClose={() => page.setForwardModalOpen(false)}
                departments={page.departments}
                users={page.users}
                identifier={doc.reference_number}
                onConfirm={onEndorse}
            />

            <ReturnModal
                open={page.returnModalOpen}
                onClose={() => page.setReturnModalOpen(false)}
                onConfirm={onReturn}
                identifier={doc.reference_number}
            />

            <ConfirmActionModal
                isOpen={confirmState.isOpen}
                onClose={page.closeConfirm}
                onConfirm={onConfirm}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.btnText}
                identifier={doc.reference_number}
                isLoading={page.isActionLoading}
            />

            <SuccessModal
                isOpen={successState.isOpen}
                onClose={page.closeSuccess}
                title={successState.title}
                identifier={doc.reference_number}
                message={successState.message}
            />
        </>
    );
}
