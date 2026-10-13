import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { DocumentListView } from '@/components/trackngo/DocumentListView';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { describeHolder, isClosedStatus, isCurrentHolder } from '@/lib/document-holder';
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
     *  - Received:  documents sitting with the clerk (approved for release, etc.)
     *  - Forwarded: documents the clerk routed on to another office
     *  - Internal:  staff documents (registered automatically), monitored for status and location only
     *  - Returned:  documents returned for revision
     */
    const classifyDoc = (doc: any): 'received' | 'sent' | 'forwarded' | 'internal' | 'returned' | null => {
        const s = (doc.status || '').toLowerCase();
        if (['completed', 'archived', 'vetoed'].includes(s)) {
            return null;
        }
        if (doc.is_internal) {
            return 'internal';
        }
        if (s === 'returned') {
            return 'returned';
        }
        if (authUserId && String(doc.submitted_by) === authUserId) {
            return 'sent';
        }
        if (String(doc.current_holder_id ?? '') === authUserId ||
            ['received', 'pending', 'pending_registration', 'approved', 'deemed_approved'].includes(s)) {
            return 'received';
        }
        if (['forwarded', 'in_transit', 'registered', 'sent', 'endorsed', 'accepted', 'ongoing'].includes(s)) {
            return 'forwarded';
        }
        return null;
    };

    // Waiting on the clerk: held by them (e.g. approved and back for release); internal documents never are
    const needsAction = (doc: any) => {
        const s = (doc.status || '').toLowerCase();
        if (isClosedStatus(s) || doc.is_internal) {
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
                    { id: 'internal', label: 'Internal', match: (d) => classifyDoc(d) === 'internal' },
                ]}
                // Where an internal document is now
                rowNote={(doc) => doc.is_internal && !isClosedStatus(doc.status) && (
                    <span className="mt-1 block max-w-[220px] truncate text-[11px] text-slate-500" title={describeHolder(doc, users)}>
                        With {describeHolder(doc, users)}
                    </span>
                )}
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
