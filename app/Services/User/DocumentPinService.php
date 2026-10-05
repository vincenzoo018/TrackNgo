<?php

namespace App\Services\User;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * The document PIN asked before any document is downloaded or exported. It is separate from the login
 * password, stored hashed, and locked for a while after too many wrong tries. HR / Admin set it when they
 * register an account that handles documents and reset it when it is forgotten; the owner changes it in
 * Profile Settings with the current PIN.
 */
class DocumentPinService
{
    public const MAX_ATTEMPTS = 5;
    public const LOCK_SECONDS = 900;

    public const OK = 'ok';
    public const NOT_SET = 'pin_not_set';
    public const LOCKED = 'pin_locked';
    public const WRONG = 'pin_wrong';

    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    /** Accounts of every role that handles documents need a PIN (CART only monitors) */
    public static function roleRequiresPin(?string $roleName): bool
    {
        return $roleName !== null && !in_array($roleName, config('document_permissions.pin_exempt_roles', []), true);
    }

    public static function roleIdRequiresPin(mixed $roleId): bool
    {
        return $roleId !== null && $roleId !== '' && self::roleRequiresPin(Role::whereKey($roleId)->value('role_name'));
    }

    public function requiresPin(User $user): bool
    {
        return self::roleRequiresPin($user->role?->role_name);
    }

    /**
     * Check a PIN typed by the account owner.
     *
     * @return array{code: string, message: string}
     */
    public function check(User $user, ?string $pin): array
    {
        if (!$user->document_pin) {
            return ['code' => self::NOT_SET, 'message' => 'Set your document PIN in Profile Settings first. It is needed to download or export documents.'];
        }

        $key = $this->throttleKey($user);
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            return ['code' => self::LOCKED, 'message' => $this->lockedMessage($key)];
        }

        if (Hash::check((string) $pin, $user->document_pin)) {
            RateLimiter::clear($key);

            return ['code' => self::OK, 'message' => ''];
        }

        RateLimiter::hit($key, self::LOCK_SECONDS);
        $left = RateLimiter::remaining($key, self::MAX_ATTEMPTS);
        if ($left === 0) {
            $this->auditTrailService->logUserAction(
                action: 'Document PIN Locked',
                description: "Document PIN of {$user->name} locked for " . (self::LOCK_SECONDS / 60) . ' minutes after ' . self::MAX_ATTEMPTS . ' wrong tries.',
                actor: $user
            );

            return ['code' => self::LOCKED, 'message' => $this->lockedMessage($key)];
        }

        return ['code' => self::WRONG, 'message' => "Incorrect document PIN. {$left} " . ($left === 1 ? 'try' : 'tries') . ' left before it is locked.'];
    }

    /** Set or replace the PIN; $actor is the owner (Profile) or HR / Admin (registration, reset) */
    public function set(User $user, string $pin, User $actor, ?string $ipAddress = null): void
    {
        $hadPin = (bool) $user->document_pin;
        $user->forceFill(['document_pin' => Hash::make($pin), 'document_pin_updated_at' => now()])->save();
        RateLimiter::clear($this->throttleKey($user));

        $byOwner = (int) $actor->id === (int) $user->id;
        $actorRole = $actor->role?->role_name ?? 'Staff';
        $this->auditTrailService->logUserAction(
            action: $byOwner ? ($hadPin ? 'Document PIN Changed' : 'Document PIN Set') : ($hadPin ? 'Document PIN Reset' : 'Document PIN Set'),
            description: $byOwner
                ? "{$user->name} " . ($hadPin ? 'changed' : 'set') . ' their document PIN.'
                : "{$actorRole} {$actor->name} " . ($hadPin ? 'reset' : 'set') . " the document PIN of {$user->name}.",
            actor: $actor,
            ipAddress: $ipAddress
        );
    }

    /**
     * HR / Admin set a PIN from the employee / user screens (registration or a forgotten PIN). Their own PIN is
     * changed in Profile Settings with the current one, never from these screens.
     */
    public function setByStaff(User $user, string $pin, User $actor, ?string $ipAddress = null, string $field = 'document_pin'): void
    {
        if ((int) $user->id === (int) $actor->id && $user->document_pin) {
            throw ValidationException::withMessages([$field => 'Change your own document PIN in Profile Settings.']);
        }

        $this->set($user, $pin, $actor, $ipAddress);
    }

    /** Validation rules for the PIN fields of the HR / Admin account forms */
    public static function staffRules(bool $required): array
    {
        return [
            'document_pin' => [$required ? 'required' : 'nullable', 'string', new \App\Rules\DocumentPin(), 'confirmed'],
        ];
    }

    public static function staffMessages(): array
    {
        return [
            'document_pin.required'  => 'Set a 6-digit document PIN. Accounts that handle documents need it to download or export them.',
            'document_pin.confirmed' => 'The document PIN confirmation does not match.',
        ];
    }

    private function throttleKey(User $user): string
    {
        return "document-pin:{$user->id}";
    }

    private function lockedMessage(string $key): string
    {
        $minutes = max(1, (int) ceil(RateLimiter::availableIn($key) / 60));

        return "Too many wrong tries. Your document PIN is locked for {$minutes} more minute" . ($minutes === 1 ? '' : 's') . '. If you forgot it, ask HR or the Administrator to reset it.';
    }
}
