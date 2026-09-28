<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;

class StoreDocumentRequest extends FormRequest
{
    /** Application limit for a document upload (validation rule `max:10240`). */
    public const APP_MAX_UPLOAD_KB = 10240;

    /**
     * Largest upload that will actually reach Laravel: PHP silently discards files above
     * upload_max_filesize / post_max_size, so the effective limit is the smallest of the three.
     */
    public static function maxUploadBytes(): int
    {
        $limits = array_filter([
            self::iniBytes(ini_get('upload_max_filesize')),
            self::iniBytes(ini_get('post_max_size')),
            self::APP_MAX_UPLOAD_KB * 1024,
        ], fn ($bytes) => $bytes > 0);

        return (int) min($limits);
    }

    public static function maxUploadLabel(): string
    {
        return rtrim(rtrim(number_format(self::maxUploadBytes() / 1048576, 1), '0'), '.') . ' MB';
    }

    private static function iniBytes(string|false $value): int
    {
        $value = trim((string) $value);
        if ($value === '') {
            return 0;
        }
        $number = (float) $value;

        return (int) match (strtolower(substr($value, -1))) {
            'g'     => $number * 1073741824,
            'm'     => $number * 1048576,
            'k'     => $number * 1024,
            default => $number,
        };
    }

    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'title'                 => 'required|string|max:150', // documents.title is varchar(150)
            'type_id'               => 'required|exists:document_types,type_id',
            'department_id'         => 'required|exists:departments,department_id',
            'file'                  => 'required|file|max:' . self::APP_MAX_UPLOAD_KB,
            'classification'        => 'required|string|max:50',
            'forward_to'            => 'required|exists:departments,department_id',
            'forward_to_user'       => 'nullable|exists:users,id',
            'instruction'           => 'nullable|string|max:500',
            'ocr_text'              => 'nullable|string',
            'is_internal'           => 'nullable|boolean',
            'urgency_justification' => 'nullable|string|max:500',
        ];
    }

    public function messages(): array
    {
        return [
            // Raised when PHP dropped the file (e.g. larger than upload_max_filesize)
            'file.uploaded' => 'The file could not be uploaded. The server accepts files up to ' . self::maxUploadLabel() . '.',
            'file.required' => 'Please upload the document file.',
            'file.max'      => 'The file must not be larger than ' . (self::APP_MAX_UPLOAD_KB / 1024) . ' MB.',
        ];
    }

    /**
     * Receiving Clerks only file external documents, which must land on a Department Head.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $actor = $this->user();
            if (!$actor || !$actor->hasRole('Receiving Clerk') || $validator->errors()->isNotEmpty()) {
                return;
            }

            $deptHeads = User::where('department_id', $this->input('forward_to'))
                ->where('is_active', true)
                ->whereHas('role', fn($q) => $q->where('role_name', 'Department Head'));

            if (!(clone $deptHeads)->exists()) {
                $validator->errors()->add('forward_to', 'The selected department has no active Department Head to receive this document.');
                return;
            }

            if ($this->filled('forward_to_user') && !(clone $deptHeads)->where('id', $this->input('forward_to_user'))->exists()) {
                $validator->errors()->add('forward_to_user', 'The selected recipient must be a Department Head of the selected department.');
            }
        });
    }
}
