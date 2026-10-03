import { Head } from '@inertiajs/react';
import { useState } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { actionButton } from '@/components/trackngo/DocumentDetailView';
import { DocumentPageView, NoActionsAvailable, ReturnButton, ReturnedActions } from '@/components/trackngo/DocumentPageActions';
import { getStandardizedStatus } from '@/lib/status-helper';
import { isCurrentHolder, describeHolder, isClosedStatus } from '@/lib/document-holder';
import { HolderStatusCard } from '@/components/trackngo/HolderStatusCard';
import { useDocumentPage, type DocumentPageProps } from '@/hooks/use-document-page';

export default function MayorDocumentShow(props: DocumentPageProps) {
    const page = useDocumentPage(props);
    const { auth, doc, users, confirmState, requestAction } = page;
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleEndorse = (destType: string, destId: string, rem: string) => {
        page.postEndorse(`/mayor/documents/${doc.document_id}/endorse`, destType, destId, rem, () => {
            showToast('Document endorsed successfully');
            page.setForwardModalOpen(false);
        });
    };

    const handleConfirmAction = () => {
        if (confirmState.action === 'accept') {
            page.postAction(`/mayor/documents/${doc.document_id}/accept`, {
                events: ['tng:fsm-refresh'],
                message: 'Document accepted successfully.',
            });
        } else if (confirmState.action === 'review') {
            page.postAction(`/mayor/documents/${doc.document_id}/review`, {
                events: ['tng:fsm-refresh'],
                message: 'Document marked as reviewed.',
            });
        } else if (confirmState.action === 'approve') {
            page.postAction(`/mayor/documents/${doc.document_id}/approve-route`, {
                events: ['tng:fsm-refresh', 'tng:document-sent'],
                message: isInternal
                    ? `Document approved and completed. It has been returned to ${senderName} with all signatures.`
                    : 'Document approved and routed to Receiving Clerk!',
                closeOnError: true,
            });
        }
    };

    // Internal documents are completed by this approval (no release by the Receiving Clerk)
    const isInternal = Boolean(doc.is_internal);
    const senderName = doc.submitter?.name || 'the sender';
    const approveButton = (
        <button
            onClick={() => requestAction(
                'approve',
                isInternal ? 'Sign, Approve & Complete' : 'Sign and Approve',
                isInternal
                    ? `Approve this document? It will be completed and returned to ${senderName} right away.`
                    : 'Are you sure you want to sign, approve, and route this document to Receiving?',
                'Approve'
            )}
            className={actionButton.primary}
        >
            {isInternal ? 'Sign, Approve & Complete' : <>Sign &amp; Approve Document</>}
        </button>
    );
    const returnButton = <ReturnButton page={page} />;

    const renderActions = () => {
        const std = getStandardizedStatus(doc.status);
        // Mayor actions unlock only once the document is endorsed to the Mayor (Mayor becomes current holder)
        if (!isCurrentHolder(doc, auth?.user) && std !== 'Returned' && !isClosedStatus(doc.status)) {
            const reachedMayor = (doc.current_step_index || 1) >= 4;
            const filedByMayor = String(doc.submitted_by) === String(auth?.user?.id);
            if (filedByMayor) {
                return (
                    <HolderStatusCard
                        variant="sent"
                        title="Sent"
                        holder={describeHolder(doc, users)}
                        message={(doc.current_step_index || 1) <= 1
                            ? 'Awaiting registration by the Receiving Clerk.'
                            : 'Being processed by the receiving office.'}
                    />
                );
            }
            return reachedMayor ? (
                <HolderStatusCard
                    variant="forwarded"
                    title={(doc.status || '').toLowerCase() === 'approved' ? 'Approved — Routed to Receiving' : 'Forwarded'}
                    holder={describeHolder(doc, users)}
                    message="No further action is required from the Office of the Mayor."
                />
            ) : (
                <HolderStatusCard
                    variant="waiting"
                    title="Waiting to be routed"
                    holder={describeHolder(doc, users)}
                    message="Actions will be available once the Department Head forwards / endorses this document to the Mayor."
                />
            );
        }
        if (std === 'Sent' || doc.status === 'submitted' || doc.status === 'registered') {
            return (
                <>
                    <button
                        onClick={() => requestAction('accept', 'Accept Document', 'Are you sure you want to receive and accept this document?', 'Receive')}
                        className={actionButton.primary}
                    >
                        Receive / Accept Document
                    </button>
                    {approveButton}
                    {returnButton}
                </>
            );
        }
        if (std === 'Received' || std === 'Ongoing' || doc.status === 'reviewed') {
            return (
                <>
                    {(doc.current_step_index || 0) < 6 && (
                        <button
                            onClick={() => requestAction('review', 'Mark as Reviewed', 'Mark this document as reviewed by the Office of the Mayor?', 'Mark Reviewed')}
                            className={actionButton.secondary}
                        >
                            Mark as Reviewed
                        </button>
                    )}
                    {approveButton}
                    <button onClick={() => page.setForwardModalOpen(true)} className={actionButton.secondary}>
                        Forward / Endorse
                    </button>
                    {returnButton}
                </>
            );
        }
        if (std === 'Returned') {
            return <ReturnedActions page={page} isHolder={isCurrentHolder(doc, auth?.user)} rerouteLabel="Re-route / Endorse" />;
        }
        return <NoActionsAvailable />;
    };

    return (
        <TrackngoLayout role="mayor"
            breadcrumbs={[
                { title: 'Dashboard', href: '/mayor' },
                { title: 'Final Approvals', href: '/mayor/documents' },
                { title: doc.reference_number, href: '#' },
            ]}
        >
            <Head title={`${doc.reference_number} — TrackNGo Mati`} />

            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
                    {toastMessage}
                </div>
            )}

            <DocumentPageView
                page={page}
                role="mayor"
                backUrl="/mayor/documents"
                actionsTitle="Review Actions"
                actions={renderActions()}
                onEndorse={handleEndorse}
                onReturn={(reason) => page.postReturn(reason, 'Document returned to the person who forwarded it to you.')}
                onConfirm={handleConfirmAction}
            />
        </TrackngoLayout>
    );
}
