<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * Editing a document's details and uploading a new version of its file (config/document_permissions.php).
 * Checked on every request: the role must allow it, the document must be with the person (or still awaiting
 * its first recipient, for its filer) and still in process. Signed versions are never changed in place.
 */
class DocumentPolicy
{
    public function editMetadata(User $user, Document $document): Response
    {
        if (!$user->hasDocumentPermission('documents.edit_metadata')) {
            return Response::deny('Your role cannot edit document details.');
        }
        if ($document->isClosed()) {
            return Response::deny('This document is completed, so its details can no longer be edited.');
        }
        if (!$document->contentsVisibleTo($user)) {
            return Response::deny('This document is confidential. Only its sender and recipients can edit it.');
        }
        if (!$user->hasRole('Admin') && !$this->handles($user, $document)) {
            return Response::deny('Only the person who currently holds this document can edit its details.');
        }

        return Response::allow();
    }

    /**
     * Title, document type, the applicant's name and purpose: what the signatories approved. Locked once someone
     * has signed the current version, or once it is approved for release; contact details stay editable.
     */
    public function editContentDetails(User $user, Document $document): Response
    {
        $access = $this->editMetadata($user, $document);
        if ($access->denied()) {
            return $access;
        }
        if ($document->hasSignaturesOnCurrentVersion()) {
            return Response::deny('This version has been signed, so only the contact details can still be changed.');
        }
        if (strtolower((string) $document->status) === 'approved') {
            return Response::deny('This document is approved for release, so only the contact details can still be changed.');
        }

        return Response::allow();
    }

    public function createRevision(User $user, Document $document): Response
    {
        if (!$user->hasDocumentPermission('documents.create_revision')) {
            return Response::deny('Your role cannot upload a new version of a document.');
        }
        if ($document->isClosed() || strtolower((string) $document->status) === 'approved') {
            return Response::deny('A new version can only be uploaded while the document is still being processed.');
        }
        if (!$document->attachment_path) {
            return Response::deny('This document has no file to replace.');
        }
        if (!$document->contentsVisibleTo($user)) {
            return Response::deny('This document is confidential. Only its sender and recipients can change it.');
        }

        $returnedToThem = strtolower((string) $document->status) === 'returned' && $document->isHeldBy($user);
        if (in_array($user->role?->role_name, config('document_permissions.revision_only_when_returned', []), true)) {
            return $returnedToThem
                ? Response::allow()
                : Response::deny('The Receiving Clerk can upload a new version only of a document returned to them.');
        }

        return $this->handles($user, $document)
            ? Response::allow()
            : Response::deny('Only the person who currently holds this document can upload a new version.');
    }

    /** Version history and earlier files: whoever may open the document's contents */
    public function viewRevisions(User $user, Document $document): bool
    {
        return $document->contentsVisibleTo($user);
    }

    /** The document is with them, or they filed it and nobody has received it yet */
    private function handles(User $user, Document $document): bool
    {
        return $document->isHeldBy($user)
            || ((int) $document->submitted_by === (int) $user->id && $document->awaitingFirstReceipt());
    }
}
