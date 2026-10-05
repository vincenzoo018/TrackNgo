<?php

namespace App\Http\Requests;

use App\Models\Document;
use App\Rules\PhilippineMobileNumber;
use App\Support\PhilippineMobile;
use Illuminate\Auth\Access\Response;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Edit Metadata: the same rules as when the document was filed. Fields outside these rules (tracking number,
 * filer, dates, signatures...) are ignored. Authorization runs first, so a direct request from someone who may
 * not edit the document gets 403 before anything is validated.
 */
class UpdateDocumentMetadataRequest extends FormRequest
{
    public function authorize(): Response
    {
        return Gate::inspect('editMetadata', $this->document());
    }

    private ?Document $document = null;

    public function document(): Document
    {
        return $this->document ??= Document::findOrFail($this->route('id'));
    }

    protected function prepareForValidation(): void
    {
        $client = $this->input('client');
        if (is_array($client) && isset($client['contact_number'])) {
            $client['contact_number'] = PhilippineMobile::normalizeInput((string) $client['contact_number']);
            $this->merge(['client' => $client]);
        }
    }

    public function rules(): array
    {
        $name = ['string', 'max:60', 'regex:' . StoreDocumentRequest::NAME_PATTERN];

        return [
            'title'               => 'sometimes|required|string|max:150', // documents.title is varchar(150)
            'type_id'             => 'sometimes|required|exists:document_types,type_id',
            'client'              => 'sometimes|array',
            'client.first_name'   => ['sometimes', 'required', ...$name],
            'client.middle_name'  => ['sometimes', 'nullable', ...$name],
            'client.last_name'    => ['sometimes', 'required', ...$name],
            'client.suffix'       => 'sometimes|nullable|string|max:10',
            'client.organization' => 'sometimes|nullable|string|max:150',
            'client.purpose'      => 'sometimes|required|string|min:5|max:255',
            // The applicant is texted when the document is ready for pickup and when it is released
            'client.contact_number' => ['sometimes', 'required', 'string', new PhilippineMobileNumber()],
            'client.email'          => 'sometimes|nullable|email:rfc|max:100',
        ];
    }

    public function attributes(): array
    {
        return (new StoreDocumentRequest())->attributes() + ['type_id' => 'document type'];
    }
}
