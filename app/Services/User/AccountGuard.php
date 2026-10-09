<?php

namespace App\Services\User;

use App\Models\Role;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Who may manage which account. Only an Administrator creates, edits, promotes or deactivates Administrator
 * accounts: HR may give any other role. Nobody changes their own role, office or account status (another
 * Administrator / HR does), so no one can promote or re-assign themselves. Enforced on every request, whatever the
 * form shows.
 */
class AccountGuard
{
    public static function adminRoleId(): ?int
    {
        return Role::where('role_name', 'Admin')->value('role_id');
    }

    public static function isAdmin(?User $user): bool
    {
        return (bool) $user?->hasRole('Admin');
    }

    /** The roles $actor may give to an account */
    public static function assignableRoles(User $actor)
    {
        return Role::query()
            ->when(!self::isAdmin($actor), fn ($q) => $q->where('role_name', '!=', 'Admin'))
            ->orderBy('role_id')
            ->get();
    }

    /** HR may not create an Administrator account or give the Admin role */
    public function ensureRoleAssignable(User $actor, mixed $roleId): void
    {
        if (!self::isAdmin($actor) && $roleId !== null && (int) $roleId === (int) self::adminRoleId()) {
            throw ValidationException::withMessages(['role_id' => 'Only an Administrator can create Administrator accounts or give the Admin role.']);
        }
    }

    /** HR may not edit, reset or deactivate an Administrator account */
    public function ensureCanManage(User $actor, User $target): void
    {
        if (!self::isAdmin($actor) && self::isAdmin($target)) {
            abort(403, 'Only an Administrator can change an Administrator account.');
        }
    }

    /** Nobody changes their own role, office or account status */
    public function ensureNotSelfEscalation(User $actor, User $target, array $data): void
    {
        if ((int) $actor->id !== (int) $target->id) {
            return;
        }
        $changes = [];
        if (array_key_exists('role_id', $data) && $data['role_id'] !== null && (int) $data['role_id'] !== (int) $target->role_id) {
            $changes[] = 'role';
        }
        if (array_key_exists('department_id', $data) && $data['department_id'] !== null && (int) $data['department_id'] !== (int) $target->department_id) {
            $changes[] = 'office';
        }
        if (array_key_exists('is_active', $data) && $data['is_active'] !== null && (bool) $data['is_active'] !== (bool) $target->is_active) {
            $changes[] = 'account status';
        }
        if ($changes) {
            throw ValidationException::withMessages([
                'role_id' => 'You cannot change your own ' . implode(', ', $changes) . '. Ask another Administrator' . (self::isAdmin($actor) ? '' : ' or HR') . ' to do it.',
            ]);
        }
    }
}
