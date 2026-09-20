<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'first_name'    => 'required|string|max:60',
            'middle_name'   => 'nullable|string|max:60',
            'last_name'     => 'required|string|max:60',
            'email'         => 'required|string|email|max:100|unique:users,email',
            'password'      => 'required|string|min:6',
            'department_id' => 'required|exists:departments,department_id',
            'role_id'       => 'required|exists:roles,role_id',
            'mobile_number' => 'nullable|string|max:20',
            'signature'     => 'nullable|string',
            'is_active'     => 'nullable|boolean',
        ];
    }
}
