import { Head } from '@inertiajs/react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { actionButton } from '@/components/trackngo/DocumentDetailView';
import { DocumentPageView, ReturnButton, ReturnedActions } from '@/components/trackngo/DocumentPageActions';
import { getStandardizedStatus } from '@/lib/status-helper';
import { isCurrentHolder, describeHolder, isClosedStatus } from '@/lib/document-holder';
import { HolderStatusCard } from '@/components/trackngo/HolderStatusCard';
import { useDocumentPage, type DocumentPageProps } from '@/hooks/use-document-page';

export default function ReceivingDocumentShow(props: DocumentPageProps) {
    const page = useDocumentPage(props);
    const { auth, doc, users, confirmState, requestAction } = page;

    const handleEndorse = (destType: string, destId: string, rem: string) => {
        page.postEndorse(`/documents/${doc.document_id}/endorse`, destType, destId, rem, () => {
            page.setForwardModalOpen(false);
            page.setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document endorsed successfully.' });
        });
    };

    // Confirmed FSM transitions: endpoint, events to broadcast and the success message
    const CONFIRM_ACTIONS: Record<string, { url: string; events: string[]; message: string }> = {
        register: {
            url: 'register',
            events: ['tng:fsm-refresh', 'tng:document-sent'],
            message: 'Document registered! A tracking number has been assigned and the document has been forwarded to the destination department.',
        },
        release: {
            url: 'release',
            events: ['tng:fsm-refresh', 'tng:document-sent'],
            message: 'Document successfully released to applicant.',
        },
        accept: {
            url: 'accept',
            events: ['tng:fsm-refresh', 'tng:document-sent', 'tng:document-received'],
            message: 'Document received and accepted successfully.',
        },
        review: {
            url: 'review',
            events: ['tng:fsm-refresh'],
            message: 'Document marked as reviewed. You can now forward / endorse it.',
        },
        // Final approval of an internal document: completed and returned to the sender (no release step)
        route_to_receiving: {
            url: 'approve-route',
            events: ['tng:fsm-refresh', 'tng:document-sent'],
            message: 'Document approved and completed. It has been returned to the sender with all signatures.',
        },
    };

    const handleConfirmAction = () => {
        const config = CONFIRM_ACTIONS[confirmState.action === 'receive' ? 'accept' : confirmState.action];
        if (!config) return;
        page.postAction(`/documents/${doc.document_id}/${config.url}`, { events: config.events, message: config.message, closeOnError: true });
    };

    const userRole = (auth?.user?.role?.role_name || auth?.user?.role || 'receiving').toString().toLowerCase();
    const rolePrefix = userRole.includes('admin') ? 'admin'
        : userRole.includes('hr') ? 'hr'
        : userRole.includes('cart') ? 'cart'
        : 'receiving';
    const backToListUrl = `/${rolePrefix}/documents`;
    const homeUrl = `/${rolePrefix}`;

    const returnButton = <ReturnButton page={page} />;

    const renderActions = () => {
        const std = getStandardizedStatus(doc.status);
        // This page is shared with Admin/CART/HR; Admin keeps override rights (see DocumentService)
        const isHolder = isCurrentHolder(doc, auth?.user) || auth?.user?.role === 'admin';
        // Internal docs arrive at the clerk as step 1 (status "Ongoing") and must be registered (step 2)
        const needsRegistration = doc.status === 'submitted' || doc.status === 'pending_registration' ||
            (Boolean(doc.is_internal) && (doc.current_step_index || 1) <= 1 && isHolder);
        const rawStatus = (doc.status || '').toLowerCase();

        // Once the clerk has sent/forwarded the document, it is read-only here until it comes back for release
        if (!isHolder && !needsRegistration && std !== 'Returned' && !isClosedStatus(doc.status)) {
            const sentByMe = String(doc.submitted_by) === String(auth?.user?.id);
            return (
                <HolderStatusCard
                    variant={sentByMe ? 'sent' : 'forwarded'}
                    title={sentByMe ? 'Sent' : 'Forwarded'}
                    holder={describeHolder(doc, users)}
                    message={(doc.current_step_index || 1) <= 1
                        ? 'Awaiting acceptance by the Department Head.'
                        : 'You will be notified when it is routed back to Receiving for release.'}
                />
            );
        }
        if (needsRegistration) {
            // Internal documents already name their recipient; the clerk only registers them for the record
            const addressee = doc.destination_user?.name
                ? `${doc.destination_user.name}${doc.destination_department?.department_name ? ` (${doc.destination_department.department_name})` : ''}`
                : doc.destination_department?.department_name;
            return (
                <>
                    {addressee && (
                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] text-slate-600">
                            Addressed to <span className="font-semibold text-slate-800">{addressee}</span>. Registering records it and sends it to them.
                        </p>
                    )}
                    <button
                        onClick={() => requestAction(
                            'register',
                            'Register Document',
                            addressee
                                ? `Register this document? It will get a tracking number and go to ${addressee}.`
                                : 'Are you sure you want to register this document and generate its routing slip?',
                            'Register'
                        )}
                        className={actionButton.primary}
                    >
                        Register &amp; Route Document
                    </button>
                    {returnButton}
                </>
            );
        }
        // Holder must accept first — incl. an internal doc just registered by the clerk and routed here (step 2)
        if (std === 'Sent' || ['sent', 'forwarded', 'endorsed', 'registered'].includes(rawStatus)) {
            return (
                <>
                    <button
                        onClick={() => requestAction('accept', 'Accept Document', 'Are you sure you want to receive and accept this document?', 'Receive')}
                        className={actionButton.primary}
                    >
                        Receive / Accept Document
                    </button>
                    {returnButton}
                </>
            );
        }
        // Accepted → Reviewed (FSM step 3, or step 6 for the second-stage office) → Forward
        if (rawStatus === 'accepted' || rawStatus === 'received') {
            return (
                <>
                    <button
                        onClick={() => requestAction('review', 'Mark as Reviewed', 'Mark this document as reviewed by your office?', 'Mark Reviewed')}
                        className={actionButton.primary}
                    >
                        Mark as Reviewed
                    </button>
                    <button onClick={() => page.setForwardModalOpen(true)} className={actionButton.secondary}>
                        Forward / Endorse
                    </button>
                    {returnButton}
                </>
            );
        }
        // Mayor-origin internal: the reviewing office ends the flow by forwarding to the Receiving Clerk (step 6)
        if (rawStatus === 'ongoing' && Boolean(doc.is_internal) && (doc.current_step_index || 0) >= 6 && auth?.user?.role !== 'receiving') {
            return (
                <>
                    <button
                        onClick={() => requestAction('route_to_receiving', 'Approve & Complete', `Approve this document? It will be completed and returned to ${doc.submitter?.name || 'the sender'} right away.`, 'Approve')}
                        className={actionButton.primary}
                    >
                        Approve &amp; Complete Document
                    </button>
                    {returnButton}
                </>
            );
        }
        if (doc.status === 'approved' || doc.status === 'for_release') {
            return (
                <>
                    <button
                        onClick={() => requestAction('release', 'Release Document', 'Are you sure you want to release this document to the applicant?', 'Release')}
                        className={actionButton.primary}
                    >
                        Release to Applicant
                    </button>
                    {returnButton}
                </>
            );
        }
        if (doc.status === 'released' || doc.status === 'completed') {
            return (
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center text-[14px] font-medium text-slate-600">
                    Released / Completed
                </p>
            );
        }
        if (std === 'Returned') {
            return <ReturnedActions page={page} isHolder={isHolder} rerouteLabel="Re-route / Endorse" />;
        }
        return (
            <>
                <button onClick={() => page.setForwardModalOpen(true)} className={actionButton.primary}>
                    Forward / Endorse
                </button>
                {returnButton}
            </>
        );
    };

    return (
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: homeUrl },
                { title: 'Documents', href: backToListUrl },
                { title: doc.reference_number || doc.tracking_number, href: '#' },
            ]}
        >
            <Head title={`${doc.reference_number || doc.tracking_number} — TrackNGo Mati`} />

            <DocumentPageView
                page={page}
                role={rolePrefix}
                backUrl={backToListUrl}
                actionsTitle="Core Actions"
                actions={renderActions()}
                onEndorse={handleEndorse}
                onReturn={(reason) => page.postReturn(reason, 'Document returned successfully.')}
                onConfirm={handleConfirmAction}
            />
        </TrackngoLayout>
    );
}
