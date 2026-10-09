<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * A deactivated account, or one without a role, is signed out on its next request: deactivating someone (HR /
 * Admin) takes effect at once, even on a browser that is still signed in.
 */
class EnsureActiveAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && (!$user->is_active || !$user->role_id)) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            $message = !$user->is_active
                ? 'Your account has been deactivated. Please contact HR or the System Administrator.'
                : 'Your account has no role yet. Please contact HR or the System Administrator.';

            return $request->expectsJson()
                ? response()->json(['message' => $message], 401)
                : redirect()->route('login')->with('status', $message);
        }

        return $next($request);
    }
}
