<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        // Map the DB role_name to the frontend key used in TypeScript
        $roleMap = [
            'admin'           => 'admin',
            'mayor'           => 'mayor',
            'department head' => 'department_head',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'hr'              => 'hr',
        ];

        $userData = null;
        if ($user) {
            $user->load(['role', 'department']);
            $roleName = strtolower($user->role->role_name ?? '');
            $userData = [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'role'  => $roleMap[$roleName] ?? 'receiving',
                'department_id' => $user->department_id,
                'department_name' => $user->department->department_name ?? null,
                // Signatures are registered by HR; the image itself is never shared
                'has_signature' => (bool) $user->has_signature,
            ];
        }

        $notifications = null;
        if ($user) {
            $notifications = \App\Services\NotificationService::getNotificationsForUser($user);
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $userData,
                'just_logged_in' => (bool) $request->session()->pull('tng_just_logged_in', false),
                'session_token' => $request->session()->get('tng_login_session_token') ?: (string) $request->session()->getId(),
            ],
            'notifications' => $notifications,
            // Effective upload ceiling (PHP ini + app rule) so the client can reject oversized files before posting
            'upload' => [
                'max_bytes' => \App\Http\Requests\StoreDocumentRequest::maxUploadBytes(),
                'max_label' => \App\Http\Requests\StoreDocumentRequest::maxUploadLabel(),
            ],
            'flash' => [
                'success'          => fn () => $request->session()->get('success'),
                'error'            => fn () => $request->session()->get('error'),
                'created_document' => fn () => $request->session()->get('created_document'),
                // Set when the actor's registered signature was stamped by their forward / approval
                'signature_stamped' => fn () => $request->session()->get('signature_stamped'),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            // Public tracking page address for QR codes (LAN IP instead of localhost, see TrackingLink)
            'tracking' => fn () => ['base_url' => \App\Support\TrackingLink::baseUrl($request)],
        ];
    }
}
