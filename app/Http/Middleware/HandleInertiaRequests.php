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
            $user->load('role');
            $roleName = strtolower($user->role->role_name ?? '');
            $userData = [
                'id'    => $user->id,
                'name'  => $user->name,
                'email' => $user->email,
                'role'  => $roleMap[$roleName] ?? 'receiving',
            ];
        }

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $userData,
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
        ];
    }
}
