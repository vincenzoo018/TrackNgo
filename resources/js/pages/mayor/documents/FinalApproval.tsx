import { Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { DocumentListView } from '@/components/trackngo/DocumentListView';
import { ForwardModal } from '@/components/trackngo/ForwardModal';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { csrfHeaders } from '@/lib/csrf';
import { isCurrentHolder } from '@/lib/document-holder';
import CreateDocumentModal from './CreateDocumentModal';

export default function MayorFinalApproval() {
    const { props } = usePage<any>();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const users = (props.dbUsers || []) as any[];
    const authUser = props.auth?.user;

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [bulkIds, setBulkIds] = useState<number[]>([]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const statusOf = (doc: any) => (doc.status || '').toLowerCase();
    // "For Approval" = active documents actually endorsed to the Mayor (Mayor is the current holder).
    // Anything still with a Department Head is "Waiting to be routed" and has no Mayor actions yet.
    const isForMayorApproval = (doc: any) =>
        isCurrentHolder(doc, authUser) && !['approved', 'completed', 'archived', 'returned'].includes(statusOf(doc));
    const isWaitingToBeRouted = (doc: any) =>
        !isCurrentHolder(doc, authUser) && (doc.current_step_index || 1) < 4 &&
        String(doc.submitted_by) !== String(authUser?.id) &&
        !['approved', 'completed', 'archived', 'returned'].includes(statusOf(doc));

    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3500);
    };

    const handleBulkEndorse = async (destType: string, destId: string, remarks: string) => {
        const ids = bulkIds;
        setBulkIds([]);
        if (ids.length === 0) {
            return;
        }
        showToast(`Endorsing ${ids.length} documents...`);

        const results = await Promise.all(ids.map(id =>
            fetch(`/mayor/documents/${id}/endorse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...csrfHeaders() },
                body: JSON.stringify({ destination_type: destType, destination_id: destId, remarks }),
            }).then(res => res.ok).catch(() => false)
        ));
        const done = results.filter(Boolean).length;
        showToast(done === ids.length
            ? `Successfully endorsed ${done} documents.`
            : `Endorsed ${done} of ${ids.length} documents. The rest are not currently with the Office of the Mayor.`);
        router.reload({ only: ['dbDocuments'] });
        window.dispatchEvent(new CustomEvent('tng:fsm-refresh'));
    };

    return (
        <TrackngoLayout role="mayor">
            <Head title="All Documents — TrackNGo Mati" />

            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">{toastMessage}</div>
            )}

            <DocumentListView
                title="Office of the Mayor — Final Approvals"
                documents={documents}
                departments={departments}
                documentTypes={documentTypes}
                basePath="/mayor/documents"
                needsAction={isForMayorApproval}
                needsActionLabel="For Approval"
                allFilter={(doc) => statusOf(doc) !== 'archived'}
                tabs={[
                    { id: 'approved', label: 'Approved', match: (d) => ['approved', 'completed'].includes(statusOf(d)) },
                    { id: 'returned', label: 'Returned', match: (d) => statusOf(d) === 'returned' },
                ]}
                rowNote={(doc) => isWaitingToBeRouted(doc) && (
                    <span className="mt-1 block text-[11px] font-medium text-amber-700">Waiting to be routed</span>
                )}
                bulkAction={{ label: 'Batch Endorse', run: (ids) => setBulkIds(ids) }}
                createLabel="Submit Document"
                onCreate={() => setIsCreateModalOpen(true)}
                exportFileName="documents.csv"
            />

            {/* Forward Modal for Batch Action */}
            <ForwardModal
                open={bulkIds.length > 0}
                onClose={() => setBulkIds([])}
                onConfirm={(type, destId, rem) => handleBulkEndorse(type, destId, rem)}
                departments={departments}
                users={users}
                defaultRemarks="Digitally signed and approved by the Mayor's Office."
            />

            <CreateDocumentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                departments={departments}
                documentTypes={documentTypes}
                users={users}
            />
        </TrackngoLayout>
    );
}
