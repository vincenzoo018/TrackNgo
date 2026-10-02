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

export default function MayorDocumentShow({ dbDocument, dbAuditTrail, dbComments, dbDepartments, dbUsers, dbAttachments }: any) {
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
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const [confirmState, setConfirmState] = useState({ isOpen: false, action: '', title: '', message: '', btnText: '' });
    const [successState, setSuccessState] = useState({ isOpen: false, title: '', message: '' });
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            router.reload({ only: ['dbDocument', 'dbAuditTrail', 'dbComments', 'dbAttachments'] });
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleEndorse = (destType: string, destId: string, rem: string) => {
        router.post(`/mayor/documents/${doc.document_id}/endorse`, {
            destination_type: destType,
            destination_id: destId,
            remarks: rem
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                showToast('Document endorsed successfully');
                setForwardModalOpen(false);
                window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                window.dispatchEvent(new CustomEvent('tng:document-sent'));
            }
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
                setSuccessState({ isOpen: true, title: 'Returned', message: 'Document returned to the person who forwarded it to you.' });
            },
            onError: () => setIsActionLoading(false)
        });
    };

    const requestAction = (action: string, title: string, message: string, btnText: string) => {
        setConfirmState({ isOpen: true, action, title, message, btnText });
    };

    const handleConfirmAction = () => {
        setIsActionLoading(true);
        if (confirmState.action === 'accept') {
            router.post(`/mayor/documents/${doc.document_id}/accept`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document accepted successfully.' });
                },
                onError: () => setIsActionLoading(false)
            });
        } else if (confirmState.action === 'review') {
            router.post(`/mayor/documents/${doc.document_id}/review`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document marked as reviewed.' });
                },
                onError: () => setIsActionLoading(false)
            });
        } else if (confirmState.action === 'approve') {
            router.post(`/mayor/documents/${doc.document_id}/approve-route`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                    window.dispatchEvent(new CustomEvent('tng:document-sent'));
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({
                        isOpen: true,
                        title: 'Successfully',
                        message: isInternal
                            ? `Document approved and completed. It has been returned to ${senderName} with all signatures.`
                            : 'Document approved and routed to Receiving Clerk!',
                    });
                },
                // Close the dialog so the reason (e.g. a signature still missing) shows in the Actions panel
                onError: () => {
                    setIsActionLoading(false);
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                },
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
    const returnButton = (
        <button onClick={() => setReturnModalOpen(true)} className={actionButton.secondary}>
            Return Document
        </button>
    );

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
                    <button onClick={() => setForwardModalOpen(true)} className={actionButton.secondary}>
                        Forward / Endorse
                    </button>
                    {returnButton}
                </>
            );
        }
        if (std === 'Returned' && !isCurrentHolder(doc, auth?.user)) {
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
                    {/* Returned to you: pass it further back unless you are where it started */}
                    {String(doc.submitted_by) !== String(auth?.user?.id) && returnButton}
                </>
            );
        }
        return (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-center text-sm font-medium text-slate-500">
                No actions available
            </p>
        );
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

            <DocumentDetailView
                doc={doc}
                trail={trail}
                comments={comments}
                attachments={attachments}
                users={users}
                role="mayor"
                backUrl="/mayor/documents"
                actionsTitle="Review Actions"
                actions={renderActions()}
                correctionOpen={correctionModalOpen}
                onCorrectionOpenChange={setCorrectionModalOpen}
            />

            <ForwardModal
                open={forwardModalOpen}
                onClose={() => setForwardModalOpen(false)}
                departments={departments}
                users={users}
                identifier={doc.reference_number}
                onConfirm={(destType, destId, rem) => handleEndorse(destType, destId, rem)}
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
