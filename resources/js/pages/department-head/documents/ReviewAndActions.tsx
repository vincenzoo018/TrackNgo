import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { actionButton } from '@/components/trackngo/DocumentDetailView';
import { DocumentPageView, NoActionsAvailable, ReturnButton, ReturnedActions } from '@/components/trackngo/DocumentPageActions';
import { getStandardizedStatus } from '@/lib/status-helper';
import { isCurrentHolder, describeHolder, isClosedStatus } from '@/lib/document-holder';
import { HolderStatusCard } from '@/components/trackngo/HolderStatusCard';
import { useDocumentPage, type DocumentPageProps } from '@/hooks/use-document-page';

export default function DepartmentHeadReviewAndActions(props: DocumentPageProps) {
    const page = useDocumentPage(props);
    const { auth, doc, users, confirmState, requestAction, isActionLoading } = page;

    const handleEndorse = (destType: string, destId: string, rem: string) => {
        page.postEndorse(`/department-head/documents/${doc.document_id}/endorse`, destType, destId, rem, () => {
            page.setForwardModalOpen(false);
            page.setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document endorsed successfully.' });
        });
    };

    const handleReview = () => {
        page.postAction(`/documents/${doc.document_id}/review`, {
            events: ['tng:fsm-refresh'],
            title: 'Review Active',
            message: 'Document marked as Ongoing review.',
        });
    };

    const handleConfirmAction = () => {
        if (confirmState.action === 'accept') {
            page.postAction(`/department-head/documents/${doc.document_id}/accept`, {
                events: ['tng:fsm-refresh'],
                message: 'Document received and accepted successfully.',
            });
        } else if (confirmState.action === 'route_to_receiving') {
            page.postAction(`/department-head/documents/${doc.document_id}/approve-route`, {
                events: ['tng:fsm-refresh', 'tng:document-sent'],
                message: `Document approved and completed. It has been returned to ${senderName} with all signatures.`,
                closeOnError: true,
            });
        }
    };

    // Only the current holder (or their office when unassigned) can act; once forwarded, the panel is read-only
    const isHolder = isCurrentHolder(doc, auth?.user);
    // Mayor-origin internal docs end with this office's final approval (step 6): completed and returned to the sender
    const canRouteToReceiving = Boolean(doc.is_internal) && (doc.current_step_index || 0) >= 6;
    const senderName = doc.submitter?.name || 'the sender';

    const returnButton = <ReturnButton page={page} />;

    const renderActions = () => {
        const std = getStandardizedStatus(doc.status);
        if (std !== 'Returned' && !isClosedStatus(doc.status) && !isHolder) {
            const awaitingRegistration = Boolean(doc.is_internal) && (doc.current_step_index || 1) <= 1;
            return (
                <HolderStatusCard
                    variant={awaitingRegistration ? 'sent' : 'forwarded'}
                    title={awaitingRegistration ? 'Sent' : 'Forwarded'}
                    holder={describeHolder(doc, users)}
                    message={awaitingRegistration ? 'Awaiting registration by the Receiving Clerk.' : undefined}
                />
            );
        }
        if (std === 'Sent' || doc.status === 'submitted' || doc.status === 'registered') {
            return (
                <>
                    <button
                        onClick={() => requestAction('accept', 'Accept Document', 'Are you sure you want to receive and accept this document for review?', 'Receive')}
                        className={actionButton.primary}
                    >
                        Receive / Accept Document
                    </button>
                    {returnButton}
                </>
            );
        }
        if (std === 'Received' || doc.status === 'accepted' || doc.status === 'dept_accepted') {
            return (
                <>
                    <button onClick={handleReview} disabled={isActionLoading} className={actionButton.primary}>
                        Mark as Under Review
                    </button>
                    <button onClick={() => page.setForwardModalOpen(true)} className={actionButton.secondary}>
                        Forward / Endorse
                    </button>
                    {returnButton}
                </>
            );
        }
        if (std === 'Ongoing' || doc.status === 'reviewed') {
            return (
                <>
                    {canRouteToReceiving ? (
                        <button
                            onClick={() => requestAction('route_to_receiving', 'Approve & Complete', `Approve this document? It will be completed and returned to ${senderName} right away.`, 'Approve')}
                            className={actionButton.primary}
                        >
                            Approve &amp; Complete Document
                        </button>
                    ) : (
                        <button onClick={() => page.setForwardModalOpen(true)} className={actionButton.primary}>
                            {(doc.current_step_index || 0) >= 4 ? 'Forward / Endorse' : 'Endorse to Mayor'}
                        </button>
                    )}
                    {returnButton}
                </>
            );
        }
        if (std === 'Returned') {
            return <ReturnedActions page={page} isHolder={isHolder} rerouteLabel="Re-endorse / Forward" />;
        }
        return <NoActionsAvailable />;
    };

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/department-head' },
                { title: 'My Documents', href: '/department-head/documents' },
                { title: doc.reference_number, href: '#' },
            ]}
        >
            <Head title={`${doc.reference_number} — TrackNGo Mati`} />

            <DocumentPageView
                page={page}
                role="department-head"
                backUrl="/department-head/documents"
                actionsTitle="Review Actions"
                actions={renderActions()}
                onEndorse={handleEndorse}
                onReturn={(reason) => page.postReturn(reason, 'Document returned successfully with your remarks logged.')}
                onConfirm={handleConfirmAction}
            />
        </TrackngoLayout>
    );
}
