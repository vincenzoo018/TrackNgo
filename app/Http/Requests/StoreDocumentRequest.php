<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'title'                 => 'required|string|max:255',
            'type_id'               => 'required|exists:document_types,type_id',
            'department_id'         => 'required|exists:departments,department_id',
            'file'                  => 'required|file|max:10240',
            'classification'        => 'required|string|max:50',
            'forward_to'            => 'required|exists:departments,department_id',
            'forward_to_user'       => 'nullable|exists:users,id',
            'instruction'           => 'nullable|string|max:500',
            'ocr_text'              => 'nullable|string',
            'is_internal'           => 'nullable|boolean',
            'urgency_justification' => 'nullable|string|max:500',
        ];
    }
}
