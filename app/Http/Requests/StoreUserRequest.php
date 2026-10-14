<?php

namespace App\Http\Requests;

use App\Rules\PhilippineMobileNumber;
use App\Services\User\DocumentPinService;
use App\Support\EmailAddress;
use App\Support\PhilippineMobile;
use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    /** 0917…, 63917… and +63917… are stored (and checked for duplicates) as one form, 0917…; emails trimmed, lower-case */
    protected function prepareForValidation(): void
    {
        $this->merge([
            'mobile_number' => PhilippineMobile::normalizeInput($this->input('mobile_number')),
            'email'         => EmailAddress::normalizeInput($this->input('email')),
        ]);
    }

    public function rules(): array
    {
        return [
            'first_name'    => 'required|string|max:60',
            'middle_name'   => 'nullable|string|max:60',
            'last_name'     => 'required|string|max:60',
            'email'         => 'required|string|' . EmailAddress::RULE . '|max:100|unique:users,email',
            'password'      => 'required|string|min:6',
            'department_id' => 'required|exists:departments,department_id',
            'role_id'       => 'required|exists:roles,role_id',
            'mobile_number' => PhilippineMobileNumber::forAccount(null),
            'signature'     => 'nullable|string',
            'is_active'     => 'nullable|boolean',
            // Accounts that handle documents get their document PIN (asked before downloads) when registered
        ] + DocumentPinService::staffRules(DocumentPinService::roleIdRequiresPin($this->input('role_id')));
    }

    public function messages(): array
    {
        return PhilippineMobileNumber::accountMessages() + DocumentPinService::staffMessages();
    }
}
