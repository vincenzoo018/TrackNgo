<?php

namespace App\Contracts;

use App\Models\Document;
use App\Models\User;
use Illuminate\Http\UploadedFile;

interface DocumentServiceInterface
{
    /**
     * List documents scoped to user role and department.
     */
    public function getDocumentsForUser(User $user);

    /**
     * Retrieve document with confidentiality guard applied.
     */
    public function getDocumentWithConfidentialityGuard(int $id, User $user): Document;

    /**
     * Store and register a newly submitted document.
     */
    public function createDocument(array $data, ?UploadedFile $file, User $actor, ?string $ipAddress = null): Document;

    /**
     * Perform workflow action on document.
     */
    public function executeWorkflowAction(
        int $documentId,
        string $action,
        array $params,
        User $actor,
        ?string $ipAddress = null
    ): Document;

    /**
     * Add a discussion comment to the document.
     */
    public function addComment(int $documentId, string $comment, User $actor, ?string $ipAddress = null);

    /**
     * Add an attachment to the document.
     */
    public function addAttachment(int $documentId, UploadedFile $file, string $description, User $actor, ?string $ipAddress = null);

    /**
     * Update document metadata.
     */
    public function updateDocument(int $documentId, array $data, User $actor, ?string $ipAddress = null): Document;

    /**
     * Delete document and related records.
     */
    public function deleteDocument(int $documentId, User $actor, ?string $ipAddress = null): void;
}
