/**
 * Addresses of a document's files. Files are private: DocumentFileController shows them only to the people who may
 * open the document (never from /storage/...). The address ends with the stored file name, so the viewer can tell
 * a PDF from a Word file or an image.
 */
export type DocumentFileKind = 'main' | 'signed' | 'attachment' | 'revision' | 'revision-signed';

function baseName(path: string): string {
    return encodeURIComponent(String(path).split('/').pop() || 'file');
}

export function documentFileUrl(documentId: number | string, kind: DocumentFileKind, path?: string | null, fileId?: number | string | null): string | null {
    if (!path || !documentId) {
        return null;
    }

    return fileId !== undefined && fileId !== null
        ? `/documents/${documentId}/files/${kind}/${fileId}/${baseName(path)}`
        : `/documents/${documentId}/files/${kind}/${baseName(path)}`;
}
