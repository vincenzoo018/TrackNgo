<?php

namespace App\Http\Requests;

use App\Rules\PhilippineMobileNumber;
use App\Services\User\DocumentPinService;
use App\Support\PhilippineMobile;
use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    /** 0917…, 63917… and +63917… are stored (and checked for duplicates) as one form, 0917… */
    protected function prepareForValidation(): void
    {
        $this->merge(['mobile_number' => PhilippineMobile::normalizeInput($this->input('mobile_number'))]);
    }

    public function rules(): array
    {
        $userId = $this->route('id') ?: $this->route('user');

        return [
            'first_name'    => 'required|string|max:60',
            'middle_name'   => 'nullable|string|max:60',
            'last_name'     => 'required|string|max:60',
            'email'         => 'required|string|email|max:100|unique:users,email,' . $userId,
            'password'      => 'nullable|string|min:6',
            'department_id' => 'required|exists:departments,department_id',
            'role_id'       => 'required|exists:roles,role_id',
            'mobile_number' => PhilippineMobileNumber::forAccount($userId ? (int) $userId : null),
            'is_active'     => 'required|boolean',
            // Optional: resets a forgotten document PIN (the owner changes it in Profile Settings)
        ] + DocumentPinService::staffRules(false);
    }

    public function messages(): array
    {
        return PhilippineMobileNumber::accountMessages() + DocumentPinService::staffMessages();
    }
}
