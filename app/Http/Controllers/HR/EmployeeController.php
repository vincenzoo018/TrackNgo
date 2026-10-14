<?php

namespace App\Http\Controllers\HR;

use App\Contracts\AuditTrailServiceInterface;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreDocumentRequest;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Rules\PhilippineMobileNumber;
use App\Services\User\AccountGuard;
use App\Services\User\DocumentPinService;
use App\Support\EmailAddress;
use App\Support\PhilippineMobile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    /** A drawn signature as a PNG / JPEG data URL */
    private const SIGNATURE_PATTERN = '/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+\/=]+$/';

    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService,
        protected DocumentPinService $documentPins,
        protected AccountGuard $accounts
    ) {}

    public function index(Request $request)
    {
        // Administrator accounts are managed by the Admin only
        $employees = User::with(['department', 'role'])
            ->whereDoesntHave('role', fn ($q) => $q->where('role_name', 'Admin'))
            ->orderBy('last_name', 'asc')->orderBy('first_name', 'asc')->get();
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = AccountGuard::assignableRoles($request->user())->sortBy('role_name')->values();

        return Inertia::render('hr/employees/Index', [
            'dbEmployees' => $employees,
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    public function create(Request $request)
    {
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = AccountGuard::assignableRoles($request->user())->sortBy('role_name')->values();

        return Inertia::render('hr/employees/Create', [
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        self::normalizeContact($request);

        $validated = $request->validate(self::nameRules() + [
            // An e-mail already registered is refused: existing accounts are changed through Edit, never overwritten here
            'email' => 'required|string|' . EmailAddress::RULE . '|max:100|unique:users,email',
            'password' => 'required|string|min:8',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => PhilippineMobileNumber::forAccount(),
            'signature' => ['required', 'string', 'max:2000000', 'regex:' . self::SIGNATURE_PATTERN],
            // Accounts that handle documents get their document PIN (asked before downloads) when registered
        ] + DocumentPinService::staffRules(DocumentPinService::roleIdRequiresPin($request->input('role_id'))),
            self::messages() + ['signature.required' => 'Draw the employee\'s signature.']);

        // HR never creates an Administrator
        $this->accounts->ensureRoleAssignable($request->user(), $validated['role_id']);

        $pin = $validated['document_pin'] ?? null;
        unset($validated['document_pin']);
        $validated['password'] = Hash::make($validated['password']);
        $validated['is_active'] = 1;

        // The account and its PIN are saved together (nothing is saved if the PIN is refused)
        DB::transaction(function () use ($validated, $pin, $request) {
            $user = User::create($validated);
            if ($pin) {
                $this->documentPins->setByStaff($user, $pin, $request->user(), $request->ip());
            }
        });

        return redirect()->route('hr.employees.index')->with('success', 'Employee saved successfully.');
    }

    /** Mobile numbers stored as 09XXXXXXXXX and emails trimmed and lower-case, before they are validated */
    private static function normalizeContact(Request $request): void
    {
        $request->merge([
            'mobile_number' => PhilippineMobile::normalizeInput($request->input('mobile_number')),
            'email'         => EmailAddress::normalizeInput($request->input('email')),
        ]);
    }

    /** Letters (incl. ñ / accented), spaces, periods, apostrophes and hyphens, as on the client intake form */
    private static function nameRules(): array
    {
        $name = 'regex:' . StoreDocumentRequest::NAME_PATTERN;

        return [
            'first_name' => ['required', 'string', 'max:60', $name],
            'middle_name' => ['nullable', 'string', 'max:60', $name],
            'last_name' => ['required', 'string', 'max:60', $name],
        ];
    }

    private static function messages(): array
    {
        $letters = 'may only contain letters, spaces, periods, apostrophes and hyphens.';

        return [
            'first_name.regex' => "The first name {$letters}",
            'middle_name.regex' => "The middle name {$letters}",
            'last_name.regex' => "The last name {$letters}",
            'email.unique' => 'This email address is already registered to another account.',
            'signature.regex' => 'The signature could not be read. Please clear the pad and sign again.',
        ] + PhilippineMobileNumber::accountMessages() + DocumentPinService::staffMessages();
    }

    public function edit(Request $request, User $employee)
    {
        $this->accounts->ensureCanManage($request->user(), $employee);
        $employee->load(['department', 'role']);
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = AccountGuard::assignableRoles($request->user())->sortBy('role_name')->values();

        return Inertia::render('hr/employees/Edit', [
            'dbEmployee' => $employee,
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
            // The registered signature is hidden from user lists; HR sees it here to verify or replace it
            'currentSignature' => $employee->signature ?: null,
        ]);
    }

    public function update(Request $request, User $employee)
    {
        $this->accounts->ensureCanManage($request->user(), $employee);
        self::normalizeContact($request);

        $validated = $request->validate(self::nameRules() + [
            'email' => 'required|string|' . EmailAddress::RULE . '|max:100|unique:users,email,' . $employee->id,
            'password' => 'nullable|string|min:8',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => PhilippineMobileNumber::forAccount($employee->id),
            'is_active' => 'required|boolean',
            // Optional: a newly drawn signature (base64 PNG data URL) replaces the registered one
            'signature' => ['nullable', 'string', 'max:2000000', 'regex:' . self::SIGNATURE_PATTERN],
            // Optional: HR resets a forgotten document PIN (the owner changes it in Profile Settings)
        ] + DocumentPinService::staffRules(false), self::messages());

        $this->accounts->ensureRoleAssignable($request->user(), $validated['role_id']);
        $this->accounts->ensureNotSelfEscalation($request->user(), $employee, $validated);

        $data = $validated;
        unset($data['document_pin']);
        if (!empty($validated['password'])) {
            $data['password'] = Hash::make($validated['password']);
        } else {
            unset($data['password']);
        }
        if (empty($validated['signature'])) {
            unset($data['signature']);
        }

        if (!empty($validated['document_pin'])) {
            $this->documentPins->setByStaff($employee, $validated['document_pin'], $request->user(), $request->ip());
        }
        $employee->update($data);

        $this->auditTrailService->logUserAction(
            action: 'Update Employee',
            description: "HR updated employee records for {$employee->name} ({$employee->email})",
            actor: $request->user(),
            ipAddress: $request->ip()
        );

        return redirect()->route('hr.employees.index')->with('success', 'Employee updated successfully.');
    }

    /**
     * "Delete" deactivates the account: deleting it would erase the documents, routing slips and audit trail tied to
     * it. A deactivated account can no longer sign in; HR can activate it again from Edit.
     */
    public function destroy(Request $request, User $employee)
    {
        $this->accounts->ensureCanManage($request->user(), $employee);
        if ((int) $employee->id === (int) $request->user()->id) {
            return redirect()->back()->withErrors(['error' => 'You cannot deactivate your own account.']);
        }

        $employee->update(['is_active' => false]);

        $this->auditTrailService->logUserAction(
            action: 'Deactivate Employee',
            description: "HR deactivated the account of {$employee->name} ({$employee->email}); their records are kept.",
            actor: $request->user(),
            ipAddress: $request->ip()
        );

        return redirect()->back()->with('success', 'Employee account deactivated. Their documents and history are kept.');
    }
}

