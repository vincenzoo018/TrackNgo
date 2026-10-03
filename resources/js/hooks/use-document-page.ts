import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { mockDocuments, mockAuditTrail } from '@/lib/mock-data';

/** Props every role's document page receives from DocumentController@page. */
export type DocumentPageProps = {
    dbDocument?: any;
    dbAuditTrail?: any[];
    dbComments?: any[];
    dbDepartments?: any[];
    dbUsers?: any[];
    dbAttachments?: any[];
};

type ConfirmedActionOptions = {
    /** Window events broadcast on success, e.g. 'tng:fsm-refresh' */
    events: string[];
    message: string;
    title?: string;
    /** Close the dialog on error too, so the reason (e.g. a signature still missing) shows in the Actions panel */
    closeOnError?: boolean;
};

const broadcast = (events: string[]) => events.forEach((name) => window.dispatchEvent(new CustomEvent(name)));

/**
 * State and workflow requests shared by the role document pages (Receiving, Department Head, Mayor):
 * modal / confirm / success dialogs, the 5-second live refresh, and posting FSM actions.
 */
export function useDocumentPage({ dbDocument, dbAuditTrail, dbComments, dbDepartments, dbUsers, dbAttachments }: DocumentPageProps) {
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

    const requestAction = (action: string, title: string, message: string, btnText: string) => {
        setConfirmState({ isOpen: true, action, title, message, btnText });
    };

    const closeConfirm = () => setConfirmState((prev) => ({ ...prev, isOpen: false }));
    const closeSuccess = () => setSuccessState((prev) => ({ ...prev, isOpen: false }));

    /** Post a workflow transition with no payload, then close the confirm dialog and show the success modal. */
    const postAction = (url: string, { events, message, title = 'Successfully', closeOnError = false }: ConfirmedActionOptions) => {
        setIsActionLoading(true);
        router.post(url, {}, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                broadcast(events);
                closeConfirm();
                setIsActionLoading(false);
                setSuccessState({ isOpen: true, title, message });
            },
            onError: () => {
                setIsActionLoading(false);

                if (closeOnError) {
                    closeConfirm();
                }
            },
        });
    };

    /** Forward / endorse through the given endpoint; onSent runs before the refresh events are broadcast. */
    const postEndorse = (url: string, destType: string, destId: string, rem: string, onSent: () => void) => {
        router.post(url, {
            destination_type: destType,
            destination_id: destId,
            remarks: rem
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                onSent();
                broadcast(['tng:fsm-refresh', 'tng:document-sent']);
            }
        });
    };

    /** Send the document back with the reason logged; message is shown in the success modal. */
    const postReturn = (reason: string, message: string) => {
        setIsActionLoading(true);
        router.post(`/documents/${doc.document_id}/return`, {
            reason
        }, {
            preserveState: true,
            preserveScroll: true,
            onSuccess: () => {
                setReturnModalOpen(false);
                setIsActionLoading(false);
                setSuccessState({ isOpen: true, title: 'Returned', message });
            },
            onError: () => setIsActionLoading(false)
        });
    };

    return {
        auth,
        doc,
        trail,
        comments,
        departments,
        users,
        attachments,
        forwardModalOpen,
        setForwardModalOpen,
        returnModalOpen,
        setReturnModalOpen,
        correctionModalOpen,
        setCorrectionModalOpen,
        confirmState,
        successState,
        setSuccessState,
        closeConfirm,
        closeSuccess,
        isActionLoading,
        requestAction,
        postAction,
        postEndorse,
        postReturn,
    };
}

export type DocumentPage = ReturnType<typeof useDocumentPage>;
