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

export default function DepartmentHeadReviewAndActions({ dbDocument, dbAuditTrail, dbComments, dbDepartments, dbUsers, dbAttachments }: any) {
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
        router.post(`/department-head/documents/${doc.document_id}/endorse`, {
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
                setSuccessState({ isOpen: true, title: 'Returned', message: 'Document returned successfully with your remarks logged.' });
            },
            onError: () => setIsActionLoading(false)
        });
    };

    const handleReview = () => {
        setIsActionLoading(true);
        router.post(`/documents/${doc.document_id}/review`, {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                setIsActionLoading(false);
                setSuccessState({ isOpen: true, title: 'Review Active', message: 'Document marked as Ongoing review.' });
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
            router.post(`/department-head/documents/${doc.document_id}/accept`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document received and accepted successfully.' });
                },
                onError: () => setIsActionLoading(false)
            });
        } else if (confirmState.action === 'route_to_receiving') {
            router.post(`/department-head/documents/${doc.document_id}/approve-route`, {}, {
                preserveState: true,
                preserveScroll: true,
                onSuccess: () => {
                    window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
                    window.dispatchEvent(new CustomEvent('tng:document-sent'));
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setIsActionLoading(false);
                    setSuccessState({ isOpen: true, title: 'Successfully', message: 'Document forwarded to the Receiving Clerk for release.' });
                },
                onError: () => setIsActionLoading(false)
            });
        }
    };

    // Only the current holder (or their office when unassigned) can act; once forwarded, the panel is read-only
    const isHolder = isCurrentHolder(doc, auth?.user);
    // Mayor-origin internal docs end with the Dept Head forwarding to the Receiving Clerk (step 6)
    const canRouteToReceiving = Boolean(doc.is_internal) && (doc.current_step_index || 0) >= 6;

    const returnButton = (
        <button onClick={() => setReturnModalOpen(true)} className={actionButton.secondary}>
            Return Document
        </button>
    );

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
                    <button onClick={() => setForwardModalOpen(true)} className={actionButton.secondary}>
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
                            onClick={() => requestAction('route_to_receiving', 'Forward to Receiving Clerk', 'Forward this reviewed document to the Receiving Clerk for release?', 'Forward')}
                            className={actionButton.primary}
                        >
                            Forward to Receiving Clerk
                        </button>
                    ) : (
                        <button onClick={() => setForwardModalOpen(true)} className={actionButton.primary}>
                            {(doc.current_step_index || 0) >= 4 ? 'Forward / Endorse' : 'Endorse to Mayor'}
                        </button>
                    )}
                    {returnButton}
                </>
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
                        Re-endorse / Forward
                    </button>
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
        <TrackngoLayout
            breadcrumbs={[
                { title: 'Home', href: '/department-head' },
                { title: 'My Documents', href: '/department-head/documents' },
                { title: doc.reference_number, href: '#' },
            ]}
        >
            <Head title={`${doc.reference_number} — TrackNGo Mati`} />

            <DocumentDetailView
                doc={doc}
                trail={trail}
                comments={comments}
                attachments={attachments}
                users={users}
                role="department-head"
                backUrl="/department-head/documents"
                actionsTitle="Review Actions"
                actions={renderActions()}
                signatoryLabel="Reviewed By"
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
