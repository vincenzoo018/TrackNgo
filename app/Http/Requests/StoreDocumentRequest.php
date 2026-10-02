<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\DB;

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

    public const MAX_SIGNATORIES = 10;

    public const VIEWABLE_TYPES = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];

    public const CLIENT_TYPES = ['Citizen', 'Business', 'Government'];
    public const CLIENT_SEXES = ['Male', 'Female'];
    public const RECEIPT_MODES = ['Walk-in', 'Mail / Courier', 'Email'];
    /** Letters (incl. ñ / accented), spaces, periods, apostrophes and hyphens */
    public const NAME_PATTERN = "/^[\pL\s.'-]+$/u";

    /** PH mobile numbers are typed with spaces / dashes; store the plain 11 digits (09XXXXXXXXX). */
    protected function prepareForValidation(): void
    {
        $client = $this->input('client');
        if (is_array($client) && isset($client['contact_number'])) {
            $client['contact_number'] = preg_replace('/[\s\-()]/', '', (string) $client['contact_number']);
            $this->merge(['client' => $client]);
        }
    }

    public function rules(): array
    {
        $rules = [
            'title'                 => 'required|string|max:150', // documents.title is varchar(150)
            'type_id'               => 'required|exists:document_types,type_id',
            'department_id'         => 'required|exists:departments,department_id',
            // Only formats the system can display (old .doc files cannot be previewed in the browser)
            'file'                  => 'required|file|mimes:' . implode(',', self::VIEWABLE_TYPES) . '|max:' . self::APP_MAX_UPLOAD_KB,
            'classification'        => 'required|string|max:50',
            'forward_to'            => 'required|exists:departments,department_id',
            'forward_to_user'       => 'nullable|exists:users,id',
            'instruction'           => 'nullable|string|max:500',
            'ocr_text'              => 'nullable|string',
            'is_internal'           => 'nullable|boolean',
            'urgency_justification' => 'nullable|string|max:500',
            // Signatories in signing order; the document cannot be completed until all of them have signed
            'signatories'           => 'nullable|array|max:' . self::MAX_SIGNATORIES,
            'signatories.*'         => 'integer|distinct|exists:users,id',
        ];

        // Receiving Clerks file documents for external clients, whose details are recorded with the document
        if ($this->user()?->hasRole('Receiving Clerk')) {
            $rules += [
                'client'                     => 'required|array',
                'client.client_type'         => 'required|in:' . implode(',', self::CLIENT_TYPES),
                'client.first_name'          => ['required', 'string', 'max:60', 'regex:' . self::NAME_PATTERN],
                'client.middle_name'         => ['nullable', 'string', 'max:60', 'regex:' . self::NAME_PATTERN],
                'client.last_name'           => ['required', 'string', 'max:60', 'regex:' . self::NAME_PATTERN],
                'client.suffix'              => 'nullable|string|max:10',
                'client.sex'                 => 'nullable|in:' . implode(',', self::CLIENT_SEXES),
                'client.organization'        => 'nullable|string|max:150',
                'client.house_street'        => 'nullable|string|max:150',
                'client.barangay'            => 'required|string|max:100',
                'client.city_municipality'   => 'required|string|max:100',
                'client.province'            => 'required|string|max:100',
                'client.contact_number'      => ['required', 'string', 'regex:/^09\d{9}$/'],
                'client.email'               => 'nullable|email:rfc|max:100',
                'client.id_type'             => 'nullable|string|max:50',
                'client.id_number'           => 'nullable|required_with:client.id_type|string|max:50',
                'client.receipt_mode'        => 'required|in:' . implode(',', self::RECEIPT_MODES),
                'client.purpose'             => 'required|string|min:5|max:255',
                'client.representative_name' => ['nullable', 'string', 'max:150', 'regex:' . self::NAME_PATTERN],
            ];
        }

        return $rules;
    }

    public function attributes(): array
    {
        return [
            'client.client_type'         => 'client type',
            'client.first_name'          => 'first name',
            'client.middle_name'         => 'middle name',
            'client.last_name'           => 'last name',
            'client.suffix'              => 'suffix',
            'client.sex'                 => 'sex',
            'client.organization'        => 'organization / company',
            'client.house_street'        => 'house no. / street',
            'client.barangay'            => 'barangay',
            'client.city_municipality'   => 'city / municipality',
            'client.province'            => 'province',
            'client.contact_number'      => 'contact number',
            'client.email'               => 'email address',
            'client.purpose'             => 'purpose',
            'client.id_type'             => 'ID presented',
            'client.id_number'           => 'ID number',
            'client.receipt_mode'        => 'mode of receipt',
            'client.representative_name' => 'authorized representative',
        ];
    }

    public function messages(): array
    {
        return [
            // Raised when PHP dropped the file (e.g. larger than upload_max_filesize)
            'file.uploaded' => 'The file could not be uploaded. The server accepts files up to ' . self::maxUploadLabel() . '.',
            'file.required' => 'Please upload the document file.',
            'file.max'      => 'The file must not be larger than ' . (self::APP_MAX_UPLOAD_KB / 1024) . ' MB.',
            'file.mimes'    => 'Upload a PDF, Word (.docx) or image (PNG/JPG) file. Old .doc files cannot be viewed in the system; save them as .docx or PDF first.',
            'signatories.max'        => 'Choose up to ' . self::MAX_SIGNATORIES . ' signatories.',
            'signatories.*.distinct' => 'Each signatory can only be listed once.',
            'client.contact_number.regex' => 'The contact number must be 11 digits and start with 09, e.g. 09171234567.',
            'client.first_name.regex'          => 'The first name may only contain letters, spaces, periods, apostrophes and hyphens.',
            'client.middle_name.regex'         => 'The middle name may only contain letters, spaces, periods, apostrophes and hyphens.',
            'client.last_name.regex'           => 'The last name may only contain letters, spaces, periods, apostrophes and hyphens.',
            'client.representative_name.regex' => 'The representative name may only contain letters, spaces, periods, apostrophes and hyphens.',
        ];
    }

    /**
     * Signatories must be active officials who can open the document (never the Receiving Clerk).
     * Internal personnel address a specific person, who must belong to the destination office.
     * Receiving Clerks only file external documents, which must land on a Department Head.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $actor = $this->user();
            if (!$actor || $validator->errors()->isNotEmpty()) {
                return;
            }

            $signatoryIds = array_map('intval', (array) $this->input('signatories', []));
            if ($signatoryIds) {
                $signatories = User::whereIn('id', $signatoryIds)
                    ->where('is_active', true)
                    ->whereDoesntHave('role', fn ($q) => $q->whereIn('role_name', ['Receiving Clerk', 'Admin']))
                    ->get();
                if ($signatories->count() !== count($signatoryIds)) {
                    $validator->errors()->add('signatories', 'Signatories must be active officials (not Receiving Clerks or Admin accounts).');
                }
                // Signatures are stamped from the image HR registered; nobody signs on the spot
                $unsigned = $signatories->filter(fn (User $u) => empty($u->signature));
                if ($unsigned->isNotEmpty()) {
                    $validator->errors()->add('signatories', $unsigned->pluck('name')->join(', ', ' and ')
                        . ($unsigned->count() > 1 ? ' have' : ' has') . ' no registered signature yet. Ask HR to add it first.');
                }
            }

            if (!$actor->hasRole('Receiving Clerk')) {
                $this->validateInternalRecipient($validator, $actor);
                return;
            }

            // The address must come from the PSA list, with each level inside the one above it
            $province = DB::table('ph_provinces')->where('name', $this->input('client.province'))->first();
            $city = $province
                ? DB::table('ph_cities')->where('province_code', $province->code)->where('name', $this->input('client.city_municipality'))->first()
                : null;
            if (!$province) {
                $validator->errors()->add('client.province', 'Select a province from the list.');
            } elseif (!$city) {
                $validator->errors()->add('client.city_municipality', 'Select a city / municipality of ' . $province->name . '.');
            } elseif (!DB::table('ph_barangays')->where('city_code', $city->code)->where('name', $this->input('client.barangay'))->exists()) {
                $validator->errors()->add('client.barangay', 'Select a barangay of ' . $city->name . '.');
            }
            if ($validator->errors()->isNotEmpty()) {
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

    /**
     * Internal documents go to the Receiving Clerk first, then to this person; within the sender's own office
     * the person must be named, otherwise it would resolve back to the sender's own desk.
     */
    private function validateInternalRecipient($validator, User $actor): void
    {
        $forwardTo = (int) $this->input('forward_to');

        if ($this->filled('forward_to_user')) {
            $recipient = User::with('role')->find($this->input('forward_to_user'));
            if (!$recipient || !$recipient->is_active || (int) $recipient->department_id !== $forwardTo) {
                $validator->errors()->add('forward_to_user', 'The selected person must be active staff of the selected office.');
            } elseif ((int) $recipient->id === (int) $actor->id) {
                $validator->errors()->add('forward_to_user', 'You cannot send a document to yourself.');
            } elseif ($recipient->hasRole('Receiving Clerk')) {
                $validator->errors()->add('forward_to_user', 'The Receiving Clerk registers every internal document automatically; choose the person who should act on it.');
            }
            return;
        }

        if ($forwardTo === (int) $actor->department_id) {
            $validator->errors()->add('forward_to_user', 'Choose the person in your office who should receive this document.');
            return;
        }

        if (!app(\App\Services\Document\DocumentWorkflowService::class)->resolveOfficeHead($forwardTo, $actor->id)) {
            $validator->errors()->add('forward_to', 'The selected office has no active staff to receive this document.');
        }
    }
}
