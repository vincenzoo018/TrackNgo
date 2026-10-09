<?php

namespace App\Services\User;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\UserServiceInterface;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use App\Services\User\AccountGuard;
use Illuminate\Support\Facades\Hash;

class UserService implements UserServiceInterface
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService,
        protected DocumentPinService $documentPins,
        protected AccountGuard $accounts
    ) {}

    public function getUserIndexPayload(User $actor): array
    {
        $authRole = strtolower($actor->role->role_name ?? '');
        $userRole = $authRole === 'hr' ? 'hr' : 'admin';

        // HR does not manage Administrator accounts, so it neither sees them here nor can give the Admin role
        $users = User::with(['department', 'role'])
            ->when($userRole === 'hr', fn ($q) => $q->whereDoesntHave('role', fn ($r) => $r->where('role_name', 'Admin')))
            ->orderBy('id', 'asc')
            ->get();

        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = AccountGuard::assignableRoles($actor);

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
        $this->accounts->ensureRoleAssignable($actor, $data['role_id'] ?? null);
        $pin = $data['document_pin'] ?? null;
        unset($data['document_pin']);
        $data['password'] = Hash::make($data['password']);
        $data['is_active'] = isset($data['is_active']) ? (bool) $data['is_active'] : true;

        $user = DB::transaction(function () use ($data, $pin, $actor, $ipAddress) {
            $user = User::create($data);
            if ($pin) {
                $this->documentPins->setByStaff($user, $pin, $actor, $ipAddress);
            }

            return $user;
        });
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
        $this->accounts->ensureCanManage($actor, $user);
        $this->accounts->ensureNotSelfEscalation($actor, $user, [
            'role_id'       => $authRole === 'admin' ? ($data['role_id'] ?? null) : null,
            'department_id' => $data['department_id'] ?? null,
            'is_active'     => $data['is_active'] ?? null,
        ]);

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

        // A forgotten document PIN is reset here (refused for the actor's own account: Profile Settings)
        if (!empty($data['document_pin'])) {
            $this->documentPins->setByStaff($user, $data['document_pin'], $actor, $ipAddress);
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
        $this->accounts->ensureCanManage($actor, $user);
        $this->accounts->ensureNotSelfEscalation($actor, $user, [
            'role_id'       => $authRole === 'hr' ? null : ($data['role_id'] ?? null),
            'department_id' => $data['department_id'] ?? null,
            'is_active'     => $data['is_active'] ?? null,
        ]);
        if ($authRole !== 'hr') {
            $this->accounts->ensureRoleAssignable($actor, $data['role_id'] ?? null);
        }

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
            throw new \InvalidArgumentException('Action prohibited: You cannot deactivate your own Administrator account.');
        }

        // Deactivated, never deleted: the account's documents, routing slips, signatures and audit trail stay intact
        $user->update(['is_active' => false]);

        $this->auditTrailService->logUserAction(
            action: 'Deactivate User',
            description: "Admin deactivated the account of {$user->name} ({$user->email}); their records are kept.",
            actor: $actor,
            ipAddress: $ipAddress
        );
    }
}
