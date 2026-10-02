import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import CreateDocumentModal from '@/components/trackngo/CreateDocumentModal';
import { DocumentListView } from '@/components/trackngo/DocumentListView';
import TrackngoLayout from '@/layouts/trackngo/TrackngoLayout';
import { isClosedStatus, isCurrentHolder } from '@/lib/document-holder';

type HrCategory = 'employee_records' | 'leave_requests' | 'violations';

// HR Category Classifier (Employee Records, Leave Requests, Violations)
const classifyHrCategory = (doc: any): HrCategory => {
    const text = `${doc.title || ''} ${doc.type?.type_name || ''} ${doc.reference_number || ''}`.toLowerCase();
    if (text.includes('leave') || text.includes('vacation') || text.includes('sick') || text.includes('absence') || text.includes('voucher') || text.includes('requisition') || text.includes('permit') || [4, 7].includes(doc.type_id)) {
        return 'leave_requests';
    }
    if (text.includes('violation') || text.includes('disciplinary') || text.includes('show cause') || text.includes('warning') || text.includes('reprimand') || text.includes('resolution') || text.includes('report') || [5, 6, 8].includes(doc.type_id)) {
        return 'violations';
    }
    return 'employee_records';
};

export default function HrDocumentsIndex() {
    const { props } = usePage<any>();
    const documents = (props.dbDocuments || []) as any[];
    const departments = (props.dbDepartments || []) as any[];
    const documentTypes = (props.dbDocumentTypes || []) as any[];
    const authUser = props.auth?.user;
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    return (
        <TrackngoLayout>
            <Head title="HR Documents — TrackNGo Mati" />

            <DocumentListView
                title="HR Documents"
                documents={documents}
                departments={departments}
                documentTypes={documentTypes}
                basePath="/hr/documents"
                needsAction={(doc) => !isClosedStatus(doc.status) && isCurrentHolder(doc, authUser)}
                allLabel="All Records"
                tabs={[
                    { id: 'employee_records', label: 'Employee Records', match: (d) => classifyHrCategory(d) === 'employee_records' },
                    { id: 'leave_requests', label: 'Leave Requests', match: (d) => classifyHrCategory(d) === 'leave_requests' },
                    { id: 'violations', label: 'Violations', match: (d) => classifyHrCategory(d) === 'violations' },
                    // Finished documents (e.g. an internal request approved by the Mayor) stay here for the sender
                    { id: 'completed', label: 'Completed', match: (d) => isClosedStatus(d.status) },
                ]}
                statusOptions={['Received', 'Ongoing', 'Sent', 'Returned', 'Archived']}
                createLabel="New Document"
                onCreate={() => setIsCreateModalOpen(true)}
                exportFileName="hr-documents.csv"
            />

            <CreateDocumentModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                departments={departments}
                documentTypes={documentTypes}
                users={(props.dbUsers || []) as any[]}
            />
        </TrackngoLayout>
    );
}
