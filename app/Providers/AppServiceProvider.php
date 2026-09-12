<?php

namespace App\Providers;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        // ── Audit Trail: System Trail Event Listeners ────────────────────
        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Login::class, function (\Illuminate\Auth\Events\Login $event) {
            $user = $event->user;
            \App\Models\AuditTrail::create([
                'category'     => 'system',
                'document_id'  => null,
                'user_id'      => $user->id,
                'user_role'    => $user->role->role_name ?? 'User',
                'department'   => $user->department->department_name ?? null,
                'document_ref' => null,
                'action'       => 'Login',
                'description'  => 'User authenticated and session established successfully.',
                'ip_address'   => request()->ip() ?? '127.0.0.1',
                'timestamp'    => now(),
            ]);
        });

        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Logout::class, function (\Illuminate\Auth\Events\Logout $event) {
            $user = $event->user;
            if ($user) {
                \App\Models\AuditTrail::create([
                    'category'     => 'system',
                    'document_id'  => null,
                    'user_id'      => $user->id,
                    'user_role'    => $user->role->role_name ?? 'User',
                    'department'   => $user->department->department_name ?? null,
                    'document_ref' => null,
                    'action'       => 'Logout',
                    'description'  => 'User session terminated / logged out.',
                    'ip_address'   => request()->ip() ?? '127.0.0.1',
                    'timestamp'    => now(),
                ]);
            }
        });

        \Illuminate\Support\Facades\Event::listen(\Illuminate\Auth\Events\Failed::class, function (\Illuminate\Auth\Events\Failed $event) {
            $user = $event->user;
            \App\Models\AuditTrail::create([
                'category'     => 'system',
                'document_id'  => null,
                'user_id'      => $user ? $user->id : null,
                'user_role'    => $user && $user->role ? $user->role->role_name : 'Guest',
                'department'   => $user && $user->department ? $user->department->department_name : null,
                'document_ref' => null,
                'action'       => 'Failed Login',
                'description'  => 'Failed authentication attempt for credentials: ' . ($event->credentials['email'] ?? 'unknown user'),
                'ip_address'   => request()->ip() ?? '127.0.0.1',
                'timestamp'    => now(),
            ]);
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
