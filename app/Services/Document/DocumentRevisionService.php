<?php

namespace App\Services\Document;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\Document;
use App\Models\DocumentRevision;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;

/**
 * Versions of a document's main file. A corrected file never overwrites the original: it is stored as the next
 * version and becomes the current file, while every earlier version (and the copy signed on it) stays available.
 * Signatures belong to the version that was signed, so a new version has to be signed again; the workflow
 * itself (holder, status, route position) is left as it is — uploading a version approves nothing.
 */
class DocumentRevisionService
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService,
        protected DocumentRoute $route
    ) {}

    /** Version 1: the file submitted at filing (called inside the filing transaction). */
    public function recordOriginal(Document $document, UploadedFile $file, string $path, User $actor): DocumentRevision
    {
        return DocumentRevision::create([
            'document_id' => $document->document_id,
            'version_number' => 1,
            'revision_reason' => 'Original submission',
        ] + $this->fileDetails($file, $path) + $this->creator($actor));
    }

    /**
     * Store $file as the next version of the document and make it the current file. The caller has checked
     * the uploader may do it (DocumentPolicy::createRevision).
     */
    public function create(Document $document, UploadedFile $file, string $reason, User $actor, ?string $ipAddress = null, ?string $ocrText = null): DocumentRevision
    {
        // Laravel names the stored file itself (random name, extension from its contents), never after the upload
        $path = $file->store('documents', 'public');

        try {
            $revision = DB::transaction(fn () => $this->record($document, $file, $path, trim($reason), $actor, $ipAddress, $ocrText));
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($path);
            throw $e;
        }

        $document->refresh();
        if ($document->route_based) {
            // Signers who have to sign again appear on the progress bar again
            $this->route->sync($document);
        }

        return $revision;
    }

    private function record(Document $document, UploadedFile $file, string $path, string $reason, User $actor, ?string $ipAddress, ?string $ocrText): DocumentRevision
    {
        $locked = Document::whereKey($document->document_id)->lockForUpdate()->firstOrFail();
        $previous = $this->ensureOriginal($locked);
        $number = $previous->version_number + 1;

        // Signatures stay with the version they were made on (together with its signed copy); everyone signs the new one
        $signers = $locked->signatories()->whereNotNull('signed_at')->pluck('user_id');
        if ($signers->isNotEmpty()) {
            $previous->update([
                'signed_file_path'       => $locked->signed_file_path,
                'signed_copy_signatures' => (int) $locked->signed_copy_signatures,
            ]);
            $locked->signatories()->update(['signature_id' => null, 'signed_at' => null]);
            if ($locked->route_based) {
                // The route takes the document back to them for the new signature
                $locked->routeStops()->where('signs', true)->whereIn('user_id', $signers)->update(['approved_at' => null]);
            }
        }

        $revision = DocumentRevision::create([
            'document_id'     => $locked->document_id,
            'version_number'  => $number,
            'revision_reason' => $reason,
        ] + $this->fileDetails($file, $path) + $this->creator($actor));

        $ocrText = $ocrText !== null && trim($ocrText) !== '' ? trim($ocrText) : null;
        $locked->update([
            'attachment_path'        => $path,
            'version'                => "v{$number}.0",
            // Text read from the new file in the browser; "Scan Text" in the viewer reads it otherwise
            'ocr_text'               => $ocrText,
            'signed_file_path'       => null,
            'signed_copy_signatures' => 0,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $locked,
            action: 'Revision Created',
            description: "Version {$number} uploaded by {$actor->name} ({$revision->file_name}). Reason: {$reason}"
                . ($signers->isNotEmpty()
                    ? " The {$signers->count()} signature(s) on Version {$previous->version_number} stay with that version; the signatories sign Version {$number} again."
                    : '')
                . ' SHA-256 ' . substr((string) $revision->file_hash, 0, 16) . '…',
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $revision;
    }

    /** Documents filed before versions were tracked get their current file recorded as Version 1 first. */
    private function ensureOriginal(Document $document): DocumentRevision
    {
        $current = DocumentRevision::where('document_id', $document->document_id)->orderByDesc('version_number')->first();
        if ($current) {
            return $current;
        }

        $disk = Storage::disk('public');
        $path = (string) $document->attachment_path;
        $exists = $path !== '' && $disk->exists($path);
        $submitter = $document->submitter;

        return DocumentRevision::create([
            'document_id'     => $document->document_id,
            'version_number'  => 1,
            'file_path'       => $path,
            'file_name'       => basename($path),
            'file_size'       => $exists ? $disk->size($path) : null,
            'mime_type'       => $exists ? $disk->mimeType($path) : null,
            'file_hash'       => $exists ? hash_file('sha256', $disk->path($path)) : null,
            'revision_reason' => 'Original submission',
            'created_by'      => $submitter?->id,
            'created_by_name' => mb_substr($submitter?->name ?: ($document->sender ?: 'Sender'), 0, 150),
        ]);
    }

    /**
     * Version history for the document page (only for viewers who may open the document), newest first, with
     * who signed each version.
     */
    public function present(Document $document): array
    {
        $revisions = $document->revisions()
            ->with(['signatures' => fn ($q) => $q->select('signature_id', 'revision_id', 'signed_by_user_id', 'signed_at')->with('signer:id,first_name,middle_name,last_name')])
            ->get();
        $current = (int) ($revisions->max('version_number') ?: 1);

        return [
            'current'  => $current,
            'versions' => $revisions->sortByDesc('version_number')->map(fn (DocumentRevision $revision) => [
                'revision_id'            => $revision->revision_id,
                'version_number'         => $revision->version_number,
                'is_current'             => $revision->version_number === $current,
                'file_path'              => $revision->file_path,
                'file_name'              => $revision->file_name,
                'file_size'              => $revision->file_size,
                'mime_type'              => $revision->mime_type,
                'file_hash'              => $revision->file_hash ? substr($revision->file_hash, 0, 16) : null,
                'reason'                 => $revision->revision_reason,
                'created_by'             => $revision->created_by_name,
                'created_at'             => $revision->created_at?->toIso8601String(),
                // The copy signed while this was the current version (kept once a newer version replaced it)
                'signed_file_path'       => $revision->signed_file_path,
                'signed_copy_signatures' => $revision->signed_copy_signatures,
                'signed_by'              => $revision->signatures->map(fn ($s) => $s->signer?->name)->filter()->unique()->values()->all(),
            ])->values()->all(),
        ];
    }

    /** What the viewer may do with the document's details and file (the server checks again on every request) */
    public function abilities(Document $document, ?User $user): array
    {
        if (!$user) {
            return ['edit_metadata' => false, 'edit_content' => false, 'content_locked_reason' => null, 'create_revision' => false];
        }
        $gate = Gate::forUser($user);
        $content = $gate->inspect('editContentDetails', $document);

        return [
            'edit_metadata'         => $gate->inspect('editMetadata', $document)->allowed(),
            'edit_content'          => $content->allowed(),
            'content_locked_reason' => $content->denied() ? $content->message() : null,
            'create_revision'       => $gate->inspect('createRevision', $document)->allowed(),
        ];
    }

    private function fileDetails(UploadedFile $file, string $path): array
    {
        // The uploaded name is only shown to people, never used to store or find the file
        $name = preg_replace('/[\x00-\x1F\x7F]+/u', '', basename(str_replace('\\', '/', (string) $file->getClientOriginalName()))) ?: '';

        return [
            'file_path' => $path,
            'file_name' => mb_substr($name !== '' ? $name : basename($path), 0, 200),
            'file_size' => $file->getSize() ?: null,
            'mime_type' => mb_substr((string) $file->getMimeType(), 0, 100) ?: null,
            'file_hash' => hash_file('sha256', Storage::disk('public')->path($path)) ?: null,
        ];
    }

    private function creator(User $actor): array
    {
        return ['created_by' => $actor->id, 'created_by_name' => mb_substr($actor->name, 0, 150)];
    }
}
