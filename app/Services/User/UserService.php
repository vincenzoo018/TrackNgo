<?php

namespace App\Services\User;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\UserServiceInterface;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class UserService implements UserServiceInterface
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    public function getUserIndexPayload(User $actor): array
    {
        $authRole = strtolower($actor->role->role_name ?? '');
        $userRole = $authRole === 'hr' ? 'hr' : 'admin';

        $users = User::with(['department', 'role'])
            ->orderBy('id', 'asc')
            ->get();

        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_id', 'asc')->get();

        return [
            'dbUsers'       => $users,
            'dbDepartments' => $departments,
            'dbRoles'       => $roles,
            'userRole'      => $userRole,
        ];
    }

    public function getUserCreatePayload(): array
    {
        return [
            'dbDepartments' => Department::orderBy('department_name', 'asc')->get(),
            'dbRoles'       => Role::orderBy('role_id', 'asc')->get(),
        ];
    }

    public function createUser(array $data, User $actor, ?string $ipAddress = null): User
    {
        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = isset($data['is_active']) ? (bool) $data['is_active'] : true;

        $user = User::create($data);
        $role = Role::find($user->role_id);
        $actorRole = strtolower($actor->role->role_name ?? '') === 'hr' ? 'HR' : 'Admin';

        $this->auditTrailService->logUserAction(
            action: 'Create User',
            description: "{$actorRole} created account for {$user->name} with role " . ($role->role_name ?? 'Unknown'),
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $user;
    }

    public function updateUser(int $userId, array $data, User $actor, ?string $ipAddress = null): User
    {
        $user = User::findOrFail($userId);
        $authRole = strtolower($actor->role->role_name ?? '');
        $actorLabel = $authRole === 'hr' ? 'HR' : 'Admin';

        $updateData = [
            'first_name'    => $data['first_name'],
            'middle_name'   => $data['middle_name'] ?? null,
            'last_name'     => $data['last_name'],
            'email'         => $data['email'],
            'department_id' => $data['department_id'],
            'mobile_number' => $data['mobile_number'] ?? null,
            'is_active'     => $data['is_active'],
        ];

        // HR can update employee info & department, but only Admin can modify roles directly via update
        if ($authRole === 'admin' && isset($data['role_id'])) {
            $updateData['role_id'] = $data['role_id'];
        }

        if (!empty($data['password'])) {
            $updateData['password'] = Hash::make($data['password']);
        }

        $user->update($updateData);

        $this->auditTrailService->logUserAction(
            action: 'Update User',
            description: "{$actorLabel} updated user details for {$user->name} ({$user->email})",
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $user;
    }

    public function overrideRole(int $userId, array $data, User $actor, ?string $ipAddress = null): User
    {
        $user = User::findOrFail($userId);
        $authRole = strtolower($actor->role->role_name ?? '');

        $oldRole = $user->role->role_name ?? 'None';
        $oldDept = $user->department->department_name ?? 'None';

        if ($authRole === 'hr') {
            $newDept = Department::find($data['department_id']);
            $updateData = ['department_id' => $data['department_id']];
            if (isset($data['is_active'])) {
                $updateData['is_active'] = $data['is_active'];
            }

            $user->update($updateData);

            $this->auditTrailService->logUserAction(
                action: 'Department Override',
                description: "HR overrode department assignment for {$user->name} from '{$oldDept}' to '" . ($newDept->department_name ?? 'New Department') . "'",
                actor: $actor,
                ipAddress: $ipAddress
            );

            return $user;
        }

        // Admin has full role & department override access
        $newRole = Role::find($data['role_id']);
        $updateData = ['role_id' => $data['role_id']];
        if (isset($data['department_id'])) {
            $updateData['department_id'] = $data['department_id'];
        }
        if (isset($data['is_active'])) {
            $updateData['is_active'] = $data['is_active'];
        }

        $user->update($updateData);

        $this->auditTrailService->logUserAction(
            action: 'Role Override',
            description: "Admin overrode role for {$user->name} from '{$oldRole}' to '" . ($newRole->role_name ?? 'Unknown') . "'",
            actor: $actor,
            ipAddress: $ipAddress
        );

        return $user;
    }

    public function deleteUser(int $userId, User $actor, ?string $ipAddress = null): void
    {
        $authRole = strtolower($actor->role->role_name ?? '');
        if ($authRole !== 'admin') {
            abort(403, 'Unauthorized action: Only System Administrators are authorized to delete user accounts.');
        }

        $user = User::findOrFail($userId);
        if ($user->id === $actor->id) {
            throw new \InvalidArgumentException('Action prohibited: You cannot delete your own Administrator account.');
        }

        $userName = $user->name;
        $userEmail = $user->email;

        $user->delete();

        $this->auditTrailService->logUserAction(
            action: 'Delete User',
            description: "Admin permanently deleted user {$userName} ({$userEmail})",
            actor: $actor,
            ipAddress: $ipAddress
        );
    }
}
