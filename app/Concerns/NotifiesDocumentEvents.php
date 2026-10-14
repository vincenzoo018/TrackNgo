<?php

namespace App\Concerns;

use App\Models\Document;
use App\Models\User;
use App\Services\Document\DocumentWorkflowService;
use Closure;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Shared by the SMS and email notifiers: the reference each audience knows a document by, who has to act on it
 * now, and evaluating a notification only after the workflow's transaction has committed, without ever throwing
 * (a notification problem must not undo or stop the action that caused it).
 */
trait NotifiesDocumentEvents
{
    /** Staff know a document by its office reference number */
    protected function staffRef(Document $document): string
    {
        return $document->reference_number ?: ($document->tracking_number ?: "#{$document->document_id}");
    }

    /** Applicants follow their document by its tracking number on the public tracking page. */
    protected function applicantRef(Document $document): string
    {
        return $document->tracking_number ?: ($document->reference_number ?: "#{$document->document_id}");
    }

    /** The current handler, or the office head while an office (no one person) holds the document */
    protected function currentHandler(Document $document): ?User
    {
        if ($document->current_holder_id) {
            return User::find($document->current_holder_id);
        }

        return $document->current_holder_department_id
            ? app(DocumentWorkflowService::class)->resolveOfficeHead((int) $document->current_holder_department_id)
            : null;
    }

    protected function afterCommit(Closure $callback): void
    {
        DB::afterCommit(function () use ($callback) {
            try {
                $callback();
            } catch (Throwable $e) {
                Log::error(class_basename(static::class) . ': event could not be evaluated', ['error' => $e->getMessage()]);
            }
        });
    }
}
