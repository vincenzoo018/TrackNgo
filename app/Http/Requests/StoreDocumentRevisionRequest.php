<?php

namespace App\Http\Requests;

use App\Models\Document;
use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Create Revision: a corrected file (same formats and size limit as at filing) and the reason for it.
 * Authorization runs first, so a direct request from someone who may not do it gets 403.
 */
class StoreDocumentRevisionRequest extends FormRequest
{
    private ?Document $document = null;

    public function authorize(): Response
    {
        return Gate::inspect('createRevision', $this->document());
    }

    public function document(): Document
    {
        return $this->document ??= Document::findOrFail($this->route('id'));
    }

    public function rules(): array
    {
        return self::fileRules('file') + [
            'reason'   => 'required|string|min:5|max:500',
            'ocr_text' => 'nullable|string',
        ];
    }

    /** The new version's file: the formats the viewer and signature stamping can handle */
    public static function fileRules(string $field): array
    {
        return [
            $field => 'required|file|mimes:' . implode(',', StoreDocumentRequest::VIEWABLE_TYPES) . '|max:' . StoreDocumentRequest::APP_MAX_UPLOAD_KB,
        ];
    }

    public function messages(): array
    {
        return self::fileMessages('file') + [
            'reason.required' => 'Give the reason for this new version.',
            'reason.min'      => 'Describe the reason for this new version in a few words.',
        ];
    }

    public static function fileMessages(string $field): array
    {
        return [
            "{$field}.required" => 'Choose the corrected file.',
            "{$field}.mimes"    => 'The file must be a PDF, Word (.docx) or an image (PNG/JPG).',
            "{$field}.max"      => 'The file must not be larger than ' . (StoreDocumentRequest::APP_MAX_UPLOAD_KB / 1024) . ' MB.',
            "{$field}.uploaded" => 'The file could not be uploaded. The server accepts files up to ' . StoreDocumentRequest::maxUploadLabel() . '.',
        ];
    }
}
