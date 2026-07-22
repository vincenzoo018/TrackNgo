<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * Accepts one or more role names: role:admin  or  role:admin,mayor
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user || ! $user->role) {
            abort(403, 'Unauthorized.');
        }

        $userRoleName = strtolower($user->role->role_name);

        if (! in_array($userRoleName, array_map('strtolower', $roles), true)) {
            // Redirect the user to their own dashboard instead of 403
            return redirect($this->dashboardForRole($userRoleName));
        }

        return $next($request);
    }

    /**
     * Map a role name to its dashboard URL.
     */
    private function dashboardForRole(string $role): string
    {
        return match ($role) {
            'admin'           => '/admin',
            'mayor'           => '/mayor',
            'department head' => '/department-head',
            'cart'            => '/cart',
            'receiving clerk' => '/receiving',
            'hr'              => '/hr',
            default           => '/login',
        };
    }
}
