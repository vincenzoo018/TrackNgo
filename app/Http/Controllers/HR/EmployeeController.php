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
        $employees = User::with(['department', 'role'])->orderBy('name', 'asc')->get();
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
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => 'nullable|string|max:20',
            'signature' => 'required|string', // Base64 data URL
        ]);

        $validated['password'] = Hash::make('password123'); // Default password
        $validated['is_active'] = 1;

        User::create($validated);

        return redirect()->route('hr.employees.index')->with('success', 'Employee created successfully.');
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
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $employee->id,
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => 'nullable|string|max:20',
            'is_active' => 'required|boolean',
        ]);

        $employee->update($validated);

        return redirect()->route('hr.employees.index')->with('success', 'Employee updated successfully.');
    }

    public function destroy(User $employee)
    {
        $employee->delete();
        return redirect()->back()->with('success', 'Employee deleted successfully.');
    }
}

