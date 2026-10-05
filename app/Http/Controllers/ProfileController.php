<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use App\Rules\DocumentPin;
use App\Services\User\DocumentPinService;

class ProfileController extends Controller
{
    public function __construct(
        protected DocumentPinService $documentPins
    ) {}

    /**
     * Display the user's profile form.
     */
    public function show(Request $request)
    {
        $user = $request->user();

        $recentActivity = \App\Models\AuditTrail::where('user_id', $user->id)
            ->with('document')
            ->orderBy('timestamp', 'desc')
            ->take(10)
            ->get();

        return Inertia::render('profile/Show', [
            // Department and role are shown only: HR / the Administrator assign them
            'user' => $user->load(['department', 'role']),
            'recentActivity' => $recentActivity,
            'documentPin' => [
                'required'   => $this->documentPins->requiresPin($user),
                'is_set'     => (bool) $user->document_pin,
                'updated_at' => $user->document_pin_updated_at?->toIso8601String(),
            ],
        ]);
    }

    /**
     * Update the user's profile information. Department and role are not part of it: only HR and the
     * Administrator change them (employee / user management), so they are ignored here even if sent.
     */
    public function update(Request $request)
    {
        $user = $request->user();
        $request->merge(['mobile_number' => \App\Support\PhilippineMobile::normalizeInput($request->input('mobile_number'))]);

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email,' . $user->id],
            'mobile_number' => \App\Rules\PhilippineMobileNumber::forAccount($user->id),
        ], \App\Rules\PhilippineMobileNumber::accountMessages());

        $user->update($validated);

        return back()->with('status', 'profile-updated');
    }

    /**
     * Update the user's password.
     */
    public function updatePassword(Request $request)
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        $request->user()->update([
            'password' => Hash::make($validated['password']),
        ]);

        return back()->with('status', 'password-updated');
    }

    /**
     * Set or change the document PIN asked before downloads. Changing it needs the current PIN (a forgotten
     * PIN is reset by HR / the Administrator); setting the first one needs the login password.
     */
    public function updateDocumentPin(Request $request)
    {
        $user = $request->user();
        $hasPin = (bool) $user->document_pin;

        $validated = $request->validate([
            'current_pin'      => $hasPin ? ['required', 'string'] : ['nullable'],
            'current_password' => $hasPin ? ['nullable'] : ['required', 'current_password'],
            'pin'              => ['required', 'string', new DocumentPin(), 'confirmed'],
        ], [
            'current_pin.required'      => 'Enter your current document PIN.',
            'current_password.required' => 'Enter your login password to set your document PIN.',
            'pin.confirmed'             => 'The new PIN confirmation does not match.',
        ]);

        if ($hasPin) {
            $check = $this->documentPins->check($user, $validated['current_pin']);
            if ($check['code'] !== DocumentPinService::OK) {
                throw ValidationException::withMessages(['current_pin' => $check['message']]);
            }
            if (Hash::check($validated['pin'], $user->document_pin)) {
                throw ValidationException::withMessages(['pin' => 'Choose a PIN different from your current one.']);
            }
        }

        $this->documentPins->set($user, $validated['pin'], $user, $request->ip());

        return back()->with('status', 'document-pin-updated');
    }
}
