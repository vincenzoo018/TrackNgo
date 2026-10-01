import { Head, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import { ReturnModal } from '@/components/trackngo/ReturnModal';
import { ConfirmActionModal } from '@/components/trackngo/ConfirmActionModal';
import { SuccessModal } from '@/components/trackngo/SuccessModal';
import { DocumentDetailView, actionButton } from '@/components/trackngo/DocumentDetailView';
import { getStandardizedStatus } from '@/lib/status-helper';
import { isCurrentHolder, describeHolder, isClosedStatus } from '@/lib/document-holder';
import { HolderStatusCard } from '@/components/trackngo/HolderStatusCard';
import { mockDocuments, mockAuditTrail } from '@/lib/mock-data';

export default function ReceivingDocumentShow({ dbDocument, dbAuditTrail, dbComments, dbDepartments, dbUsers, dbAttachments }: any) {
    const { auth } = usePage<any>().props;
    const doc = dbDocument || mockDocuments[0];
    const trail = dbAuditTrail || mockAuditTrail.filter((a: any) => a.document_ref === doc.reference_number);
    const comments = dbComments || [];
    const departments = dbDepartments || [];
    const users = dbUsers || [];
    const attachments = dbAttachments || doc.attachments || [];

    const [forwardModalOpen, setForwardModalOpen] = useState(false);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [correctionModalOpen, setCorrectionModalOpen] = useState(false);

    const [confirmState, setConfirmState] = useState({ isOpen: false, action: '', title: '', message: '', btnText: '' });
    const [successState, setSuccessState] = useState({ isOpen: false, title: '', message: '' });
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['dbDocument', 'dbAuditTrail', 'dbComments', 'dbAttachments'] });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleEndorse = (destType: string, destId: string, rem: string) => {
        router.post(`/documents/${doc.document_id}/endorse`, {
            destination_type: destType,
            destination_id: destId,
            remarks: rem
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setForwardModalOpen(false);
                setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document endorsed successfully.' });
                window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                window.dispatchEvent(new CustomEvent('tng:document-sent'));
            }
        });
    };

    const requestAction = (action: string, title: string, message: string, btnText: string) => {
        setConfirmState({ isOpen: true, action, title, message, btnText });
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
        route_to_receiving: {
            url: 'approve-route',
            events: ['tng:fsm-refresh', 'tng:document-sent'],
            message: 'Document forwarded to the Receiving Clerk for release.',
        },
    };

    const handleConfirmAction = () => {
        const config = CONFIRM_ACTIONS[confirmState.action === 'receive' ? 'accept' : confirmState.action];
        if (!config) return;
        setIsActionLoading(true);
        router.post(`/documents/${doc.document_id}/${config.url}`, {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                config.events.forEach(name => window.dispatchEvent(new CustomEvent(name)));
                setConfirmState(prev => ({ ...prev, isOpen: false }));
                setIsActionLoading(false);
                setSuccessState({ isOpen: true, title: 'Successfully', message: config.message });
            },
            onError: () => setIsActionLoading(false)
        });
    };

    const handleReturn = (reason: string) => {
        setIsActionLoading(true);
        router.post(`/documents/${doc.document_id}/return`, {
            reason
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setReturnModalOpen(false);
                setIsActionLoading(false);
                setSuccessState({ isOpen: true, title: 'Returned', message: 'Document returned successfully.' });
            },
            onError: () => setIsActionLoading(false)
        });
    };

    const userRole = (auth?.user?.role?.role_name || auth?.user?.role || 'receiving').toString().toLowerCase();
    const rolePrefix = userRole.includes('admin') ? 'admin'
        : userRole.includes('hr') ? 'hr'
        : userRole.includes('cart') ? 'cart'
        : 'receiving';
    const backToListUrl = `/${rolePrefix}/documents`;
    const homeUrl = `/${rolePrefix}`;

    const returnButton = (
        <button onClick={() => setReturnModalOpen(true)} className={actionButton.secondary}>
            Return Document
        </button>
    );

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
            return (
                <>
                    <button
                        onClick={() => requestAction('register', 'Register Document', 'Are you sure you want to register this document and generate its routing slip?', 'Register')}
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
                    <button onClick={() => setForwardModalOpen(true)} className={actionButton.secondary}>
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
                        onClick={() => requestAction('route_to_receiving', 'Forward to Receiving Clerk', 'Forward this reviewed document to the Receiving Clerk for release?', 'Forward')}
                        className={actionButton.primary}
                    >
                        Forward to Receiving Clerk
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
        if (std === 'Returned' && !isHolder) {
            return (
                <HolderStatusCard
                    variant="waiting"
                    title="Returned for Correction"
                    holder={describeHolder(doc, users)}
                    message="Waiting for the missing / corrected files to be uploaded."
                />
            );
        }
        if (std === 'Returned') {
            return (
                <>
                    <button type="button" onClick={() => setCorrectionModalOpen(true)} className={actionButton.danger}>
                        Upload Correction
                    </button>
                    <button onClick={() => setForwardModalOpen(true)} className={actionButton.secondary}>
                        Re-route / Endorse
                    </button>
                </>
            );
        }
        return (
            <>
                <button onClick={() => setForwardModalOpen(true)} className={actionButton.primary}>
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

            <DocumentDetailView
                doc={doc}
                trail={trail}
                comments={comments}
                attachments={attachments}
                users={users}
                role={rolePrefix}
                backUrl={backToListUrl}
                actionsTitle="Core Actions"
                actions={renderActions()}
                signatoryLabel="Received By"
                correctionOpen={correctionModalOpen}
                onCorrectionOpenChange={setCorrectionModalOpen}
            />

            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                onConfirm={handleEndorse}
                departments={departments}
                users={users}
                identifier={doc.reference_number}
            />

            <ReturnModal
                open={returnModalOpen}
                onClose={() => setReturnModalOpen(false)}
                onConfirm={(reason) => handleReturn(reason)}
                identifier={doc.reference_number}
            />

            <ConfirmActionModal
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                onConfirm={handleConfirmAction}
                title={confirmState.title}
                message={confirmState.message}
                confirmText={confirmState.btnText}
                identifier={doc.reference_number}
                isLoading={isActionLoading}
            />

            <SuccessModal
                isOpen={successState.isOpen}
                onClose={() => setSuccessState(prev => ({ ...prev, isOpen: false }))}
                title={successState.title}
                identifier={doc.reference_number}
                message={successState.message}
            />
        </TrackngoLayout>
    );
}
