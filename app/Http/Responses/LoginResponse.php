<?php

namespace App\Http\Responses;

use Illuminate\Http\JsonResponse;
use Laravel\Fortify\Contracts\LoginResponse as LoginResponseContract;
use Symfony\Component\HttpFoundation\Response;

class LoginResponse implements LoginResponseContract
{
    public function toResponse($request): Response
    {
        if ($request->wantsJson()) {
            return new JsonResponse(['two_factor' => false], 200);
        }

        $user = $request->user();
        $roleName = strtolower($user->role->role_name ?? '');

        $dashboard = match ($roleName) {
            'admin'           => '/admin',
            'mayor'           => '/mayor',
            'department head' => '/department-head',
            'cart'            => '/cart',
            'receiving clerk' => '/receiving',
            'hr'              => '/hr',
            default           => '/login',
        };

        return redirect()->intended($dashboard);
    }
}
