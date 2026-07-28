<?php

namespace App\Http\Controllers\HR;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DepartmentController extends Controller
{
    public function index()
    {
        $departments = Department::with('head')->withCount('users')->orderBy('department_name', 'asc')->get();
        $users = User::orderBy('name', 'asc')->get();

        return Inertia::render('hr/departments/Index', [
            'dbDepartments' => $departments,
            'dbUsers' => $users,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'department_name' => 'required|string|max:255|unique:departments',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'head_id' => 'nullable|exists:users,id',
            'is_active' => 'required|boolean',
        ]);

        Department::create($validated);

        return redirect()->back()->with('success', 'Department created successfully.');
    }

    public function update(Request $request, Department $department)
    {
        $validated = $request->validate([
            'department_name' => 'required|string|max:255|unique:departments,department_name,' . $department->department_id . ',department_id',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'head_id' => 'nullable|exists:users,id',
            'is_active' => 'required|boolean',
        ]);

        $department->update($validated);

        return redirect()->back()->with('success', 'Department updated successfully.');
    }

    public function destroy(Department $department)
    {
        if ($department->users()->count() > 0) {
            return redirect()->back()->withErrors(['error' => 'Cannot delete a department with assigned employees.']);
        }

        $department->delete();
        return redirect()->back()->with('success', 'Department deleted successfully.');
    }
}

