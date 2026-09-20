<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OverrideRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        $authRole = strtolower(auth()->user()->role->role_name ?? '');

        if ($authRole === 'hr') {
            return [
                'department_id' => 'required|exists:departments,department_id',
                'is_active'     => 'nullable|boolean',
            ];
        }

        return [
            'role_id'       => 'required|exists:roles,role_id',
            'department_id' => 'nullable|exists:departments,department_id',
            'is_active'     => 'nullable|boolean',
        ];
    }
}
