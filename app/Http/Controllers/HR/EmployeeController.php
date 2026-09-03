<?php

namespace App\Http\Controllers\HR;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function index()
    {
        $employees = User::with(['department', 'role'])->orderBy('last_name', 'asc')->orderBy('first_name', 'asc')->get();
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_name', 'asc')->get();

        return Inertia::render('hr/employees/Index', [
            'dbEmployees' => $employees,
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    public function create()
    {
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_name', 'asc')->get();

        return Inertia::render('hr/employees/Create', [
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:60',
            'middle_name' => 'nullable|string|max:60',
            'last_name' => 'required|string|max:60',
            'email' => 'required|string|email|max:100',
            'password' => 'required|string|min:8',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => 'nullable|string|max:20',
            'signature' => 'required|string', // Base64 data URL
        ]);

        $user = User::where('email', $validated['email'])->first();

        if ($user) {
            $user->update([
                'first_name' => $validated['first_name'],
                'middle_name' => $validated['middle_name'],
                'last_name' => $validated['last_name'],
                'password' => Hash::make($validated['password']),
                'department_id' => $validated['department_id'],
                'role_id' => $validated['role_id'],
                'mobile_number' => $validated['mobile_number'],
                'signature' => $validated['signature'],
                'is_active' => 1,
            ]);
        } else {
            $validated['password'] = Hash::make($validated['password']);
            $validated['is_active'] = 1;
            User::create($validated);
        }

        return redirect()->route('hr.employees.index')->with('success', 'Employee saved successfully.');
    }

    public function edit(User $employee)
    {
        $employee->load(['department', 'role']);
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_name', 'asc')->get();

        return Inertia::render('hr/employees/Edit', [
            'dbEmployee' => $employee,
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    public function update(Request $request, User $employee)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:60',
            'middle_name' => 'nullable|string|max:60',
            'last_name' => 'required|string|max:60',
            'email' => 'required|string|email|max:100|unique:users,email,' . $employee->id,
            'password' => 'nullable|string|min:8',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => 'nullable|string|max:20',
            'is_active' => 'required|boolean',
        ]);

        $data = $validated;
        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        } else {
            unset($data['password']);
        }

        $employee->update($data);

        return redirect()->route('hr.employees.index')->with('success', 'Employee updated successfully.');
    }

    public function destroy(User $employee)
    {
        $employee->delete();
        return redirect()->back()->with('success', 'Employee deleted successfully.');
    }
}

