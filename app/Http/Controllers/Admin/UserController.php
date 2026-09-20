<?php

namespace App\Http\Controllers\Admin;

use App\Contracts\UserServiceInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\OverrideRoleRequest;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function __construct(
        protected UserServiceInterface $userService
    ) {}

    /**
     * Display the User Accounts Management page for Administrator or HR.
     */
    public function index(Request $request): Response
    {
        $payload = $this->userService->getUserIndexPayload($request->user() ?: auth()->user());

        return Inertia::render('admin/users/Index', $payload);
    }

    /**
     * Show the user creation form.
     */
    public function create(): Response
    {
        $payload = $this->userService->getUserCreatePayload();

        return Inertia::render('admin/users/Create', $payload);
    }

    /**
     * Store a newly created user account.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        $actor = $request->user() ?: auth()->user();
        $this->userService->createUser($request->validated(), $actor, $request->ip());

        $redirectRoute = strtolower($actor->role->role_name ?? '') === 'hr' ? 'hr.users.index' : 'admin.users.index';
        return redirect()->route($redirectRoute)->with('success', 'User account created successfully.');
    }

    /**
     * Update an existing user's information and credentials.
     */
    public function update(UpdateUserRequest $request, $id): RedirectResponse
    {
        $actor = $request->user() ?: auth()->user();
        $user = $this->userService->updateUser((int) $id, $request->validated(), $actor, $request->ip());

        return redirect()->back()->with('success', "User account for {$user->name} updated successfully.");
    }

    /**
     * Override role and department permissions for a user.
     */
    public function overrideRole(OverrideRoleRequest $request, $id): RedirectResponse
    {
        $actor = $request->user() ?: auth()->user();
        $user = $this->userService->overrideRole((int) $id, $request->validated(), $actor, $request->ip());

        $authRole = strtolower($actor->role->role_name ?? '');
        $msg = $authRole === 'hr'
            ? "Department for {$user->name} successfully overridden."
            : "Role for {$user->name} successfully overridden.";

        return redirect()->back()->with('success', $msg);
    }

    /**
     * Delete a user account from the system (Admin only).
     */
    public function destroy(Request $request, $id): RedirectResponse
    {
        $actor = $request->user() ?: auth()->user();

        try {
            $this->userService->deleteUser((int) $id, $actor, $request->ip());
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }

        return redirect()->back()->with('success', 'User account has been deleted.');
    }
}
