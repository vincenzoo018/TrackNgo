import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { DocumentListView } from '@/components/trackngo/DocumentListView';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { isClosedStatus, isCurrentHolder } from '@/lib/document-holder';
import CreateDocumentModal from './CreateDocumentModal';

export default function ReceivingDocumentsIndex() {
    const { props } = usePage<any>();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const users = (props.dbUsers || []) as any[];
    const authUser = props.auth?.user;
    const authUserId = String(authUser?.id ?? '');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    /**
     * Receiving Clerk buckets:
     *  - Sent:      documents this clerk filed & dispatched (external step 1 → Department Head)
     *  - Received:  documents sitting with the clerk (pending registration, approved for release, etc.)
     *  - Forwarded: documents the clerk registered/routed on to another office
     *  - Returned:  documents returned for revision
     */
    const classifyDoc = (doc: any): 'received' | 'sent' | 'forwarded' | 'returned' | null => {
        const s = (doc.status || '').toLowerCase();
        if (s === 'returned') {
            return 'returned';
        }
        if (['completed', 'archived'].includes(s)) {
            return null;
        }
        if (authUserId && String(doc.submitted_by) === authUserId) {
            return 'sent';
        }
        if (String(doc.current_holder_id ?? '') === authUserId ||
            ['received', 'pending', 'pending_registration', 'approved'].includes(s)) {
            return 'received';
        }
        if (['forwarded', 'in_transit', 'registered', 'sent', 'endorsed', 'accepted', 'ongoing'].includes(s)) {
            return 'forwarded';
        }
        return null;
    };

    // Waiting on the clerk: held by them, awaiting registration, or approved and back for release
    const needsAction = (doc: any) => {
        const s = (doc.status || '').toLowerCase();
        if (isClosedStatus(s)) {
            return false;
        }
        return isCurrentHolder(doc, authUser) || ['submitted', 'pending_registration'].includes(s);
    };

    return (
        <TrackngoLayout>
            <Head title="My Documents — TrackNGo Mati" />

            <DocumentListView
                title="My Documents"
                documents={documents}
                departments={departments}
                documentTypes={documentTypes}
                basePath="/receiving/documents"
                needsAction={needsAction}
                tabs={[
                    { id: 'received', label: 'Received', match: (d) => classifyDoc(d) === 'received' },
                    { id: 'sent', label: 'Sent', match: (d) => classifyDoc(d) === 'sent' },
                    { id: 'forwarded', label: 'Forwarded', match: (d) => classifyDoc(d) === 'forwarded' },
                    { id: 'returned', label: 'Returned', match: (d) => classifyDoc(d) === 'returned' },
                ]}
                onCreate={() => setIsCreateModalOpen(true)}
                exportFileName="documents.csv"
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
