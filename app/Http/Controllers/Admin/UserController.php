<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditTrail;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Display the User Accounts Management page for Administrator or HR.
     */
    public function index(): Response
    {
        $authUser = auth()->user();
        $authRole = strtolower($authUser->role->role_name ?? '');
        $userRole = $authRole === 'hr' ? 'hr' : 'admin';

        $users = User::with(['department', 'role'])
            ->orderBy('id', 'asc')
            ->get();

        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_id', 'asc')->get();

        return Inertia::render('admin/users/Index', [
            'dbUsers' => $users,
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
            'userRole' => $userRole,
        ]);
    }

    /**
     * Show the user creation form.
     */
    public function create(): Response
    {
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_id', 'asc')->get();

        return Inertia::render('admin/users/Create', [
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    /**
     * Store a newly created user account.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'first_name' => 'required|string|max:60',
            'middle_name' => 'nullable|string|max:60',
            'last_name' => 'required|string|max:60',
            'email' => 'required|string|email|max:100|unique:users,email',
            'password' => 'required|string|min:6',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => 'nullable|string|max:20',
            'signature' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $validated['password'] = Hash::make($validated['password']);
        $validated['is_active'] = $request->has('is_active') ? (bool)$request->is_active : true;

        $user = User::create($validated);
        $role = Role::find($user->role_id);
        $actor = strtolower(auth()->user()->role->role_name ?? '') === 'hr' ? 'HR' : 'Admin';

        AuditTrail::create([
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? $actor,
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Create User',
            'description' => "{$actor} created account for {$user->name} with role " . ($role->role_name ?? 'Unknown'),
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        $redirectRoute = strtolower(auth()->user()->role->role_name ?? '') === 'hr' ? 'hr.users.index' : 'admin.users.index';
        return redirect()->route($redirectRoute)->with('success', 'User account created successfully.');
    }

    /**
     * Update an existing user's information and credentials.
     */
    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $authUser = auth()->user();
        $authRole = strtolower($authUser->role->role_name ?? '');
        $actor = $authRole === 'hr' ? 'HR' : 'Admin';

        $validated = $request->validate([
            'first_name' => 'required|string|max:60',
            'middle_name' => 'nullable|string|max:60',
            'last_name' => 'required|string|max:60',
            'email' => 'required|string|email|max:100|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:6',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => 'nullable|string|max:20',
            'is_active' => 'required|boolean',
        ]);

        $data = [
            'first_name' => $validated['first_name'],
            'middle_name' => $validated['middle_name'],
            'last_name' => $validated['last_name'],
            'email' => $validated['email'],
            'department_id' => $validated['department_id'],
            'mobile_number' => $validated['mobile_number'],
            'is_active' => $validated['is_active'],
        ];

        // HR can update employee info & department, but only Admin can modify roles directly via update
        if ($authRole === 'admin') {
            $data['role_id'] = $validated['role_id'];
        }

        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        }

        $user->update($data);

        AuditTrail::create([
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? $actor,
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Update User',
            'description' => "{$actor} updated user details for {$user->name} ({$user->email})",
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', "User account for {$user->name} updated successfully.");
    }

    /**
     * Override role and department permissions for a user.
     * Admin has full role/department override; HR can override department and status.
     */
    public function overrideRole(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $authUser = auth()->user();
        $authRole = strtolower($authUser->role->role_name ?? '');
        $actor = $authRole === 'hr' ? 'HR' : 'Admin';

        $oldRole = $user->role->role_name ?? 'None';
        $oldDept = $user->department->department_name ?? 'None';

        if ($authRole === 'hr') {
            // HR can override department assignment and employee active status
            $validated = $request->validate([
                'department_id' => 'required|exists:departments,department_id',
                'is_active' => 'nullable|boolean',
            ]);

            $newDept = Department::find($validated['department_id']);
            $updateData = ['department_id' => $validated['department_id']];
            if (isset($validated['is_active'])) {
                $updateData['is_active'] = $validated['is_active'];
            }

            $user->update($updateData);

            AuditTrail::create([
                'user_id' => auth()->id(),
                'user_role' => auth()->user()->role->role_name ?? 'HR',
                'department' => auth()->user()->department->department_name ?? null,
                'action' => 'Department Override',
                'description' => "HR overrode department assignment for {$user->name} from '{$oldDept}' to '" . ($newDept->department_name ?? 'New Department') . "'",
                'ip_address' => $request->ip(),
                'timestamp' => now(),
            ]);

            return redirect()->back()->with('success', "Department for {$user->name} successfully overridden to " . ($newDept->department_name ?? 'new department') . ".");
        }

        // Admin has full role & department override access
        $validated = $request->validate([
            'role_id' => 'required|exists:roles,role_id',
            'department_id' => 'nullable|exists:departments,department_id',
            'is_active' => 'nullable|boolean',
        ]);

        $newRole = Role::find($validated['role_id']);

        $updateData = ['role_id' => $validated['role_id']];
        if (isset($validated['department_id'])) {
            $updateData['department_id'] = $validated['department_id'];
        }
        if (isset($validated['is_active'])) {
            $updateData['is_active'] = $validated['is_active'];
        }

        $user->update($updateData);

        AuditTrail::create([
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'Admin',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Role Override',
            'description' => "Admin overrode role for {$user->name} from '{$oldRole}' to '" . ($newRole->role_name ?? 'Unknown') . "'",
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', "Role for {$user->name} successfully overridden to " . ($newRole->role_name ?? 'new role') . ".");
    }

    /**
     * Delete a user account from the system (Admin only).
     */
    public function destroy(Request $request, $id)
    {
        $authUser = auth()->user();
        $authRole = strtolower($authUser->role->role_name ?? '');

        if ($authRole !== 'admin') {
            abort(403, 'Unauthorized action: Only System Administrators are authorized to delete user accounts.');
        }

        $user = User::findOrFail($id);

        if ($user->id === $authUser->id) {
            return redirect()->back()->with('error', 'Action prohibited: You cannot delete your own Administrator account.');
        }

        $userName = $user->name;
        $userEmail = $user->email;

        AuditTrail::create([
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'Admin',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Delete User',
            'description' => "Admin permanently deleted user {$userName} ({$userEmail})",
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        $user->delete();

        return redirect()->back()->with('success', "User account for {$userName} has been deleted.");
    }
}
