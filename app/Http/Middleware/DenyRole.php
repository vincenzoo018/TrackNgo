<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the given roles out of a group of routes: not-role:CART
 * (CART monitors documents; it never files, routes, approves or comments on them).
 */
class DenyRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $role = strtolower((string) $request->user()?->role?->role_name);

        if ($role !== '' && in_array($role, array_map('strtolower', $roles), true)) {
            abort(403, 'Your role has monitoring access only and cannot perform this action.');
        }

        return $next($request);
    }
}
