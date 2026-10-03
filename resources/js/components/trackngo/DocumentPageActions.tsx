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

/** A returned document: its holder uploads the correction and re-routes it; anyone else sees who has it. */
export function ReturnedActions({ page, isHolder, rerouteLabel }: { page: DocumentPage; isHolder: boolean; rerouteLabel: string }) {
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
            <button onClick={() => page.setForwardModalOpen(true)} className={actionButton.secondary}>
                {rerouteLabel}
            </button>
            {/* Returned to you: pass it further back unless you are where it started */}
            {String(doc.submitted_by) !== String(auth?.user?.id) && <ReturnButton page={page} />}
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
