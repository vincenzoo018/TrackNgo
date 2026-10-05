<?php

namespace App\Http\Controllers\HR;

use App\Contracts\AuditTrailServiceInterface;
use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Rules\PhilippineMobileNumber;
use App\Services\User\DocumentPinService;
use App\Support\PhilippineMobile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function __construct(
        protected AuditTrailServiceInterface $auditTrailService,
        protected DocumentPinService $documentPins
    ) {}

    public function index()
    {
        $employees = User::with(['department', 'role'])->orderBy('last_name', 'asc')->orderBy('first_name', 'asc')->get();
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_name', 'asc')->get();

        return Inertia::render('hr/employees/Index', [
            'dbEmployees' => $employees,
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    public function create()
    {
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_name', 'asc')->get();

        return Inertia::render('hr/employees/Create', [
            'dbDepartments' => $departments,
            'dbRoles' => $roles,
        ]);
    }

    public function store(Request $request)
    {
        $request->merge(['mobile_number' => PhilippineMobile::normalizeInput($request->input('mobile_number'))]);
        // Saving an existing email updates that account, so its own number is not a duplicate
        $existingId = User::where('email', $request->input('email'))->value('id');

        $validated = $request->validate([
            'first_name' => 'required|string|max:60',
            'middle_name' => 'nullable|string|max:60',
            'last_name' => 'required|string|max:60',
            'email' => 'required|string|email|max:100',
            'password' => 'required|string|min:8',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => PhilippineMobileNumber::forAccount($existingId),
            'signature' => 'required|string', // Base64 data URL
            // Accounts that handle documents get their document PIN (asked before downloads) when registered
        ] + DocumentPinService::staffRules(DocumentPinService::roleIdRequiresPin($request->input('role_id'))),
            PhilippineMobileNumber::accountMessages() + DocumentPinService::staffMessages());

        $pin = $validated['document_pin'] ?? null;
        unset($validated['document_pin']);

        // The account and its PIN are saved together (nothing is saved if the PIN is refused)
        DB::transaction(fn () => $this->saveEmployee($validated, $pin, $request));

        return redirect()->route('hr.employees.index')->with('success', 'Employee saved successfully.');
    }

    /** Create the employee, or update the account already registered with that email */
    private function saveEmployee(array $validated, ?string $pin, Request $request): void
    {
        $user = User::where('email', $validated['email'])->first();

        if ($user) {
            $user->update([
                'first_name' => $validated['first_name'],
                'middle_name' => $validated['middle_name'],
                'last_name' => $validated['last_name'],
                'password' => Hash::make($validated['password']),
                'department_id' => $validated['department_id'],
                'role_id' => $validated['role_id'],
                'mobile_number' => $validated['mobile_number'],
                'signature' => $validated['signature'],
                'is_active' => 1,
            ]);
        } else {
            $validated['password'] = Hash::make($validated['password']);
            $validated['is_active'] = 1;
            $user = User::create($validated);
        }

        if ($pin) {
            $this->documentPins->setByStaff($user, $pin, $request->user(), $request->ip());
        }
    }

    public function edit(User $employee)
    {
        $employee->load(['department', 'role']);
        $departments = Department::orderBy('department_name', 'asc')->get();
        $roles = Role::orderBy('role_name', 'asc')->get();

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
        $request->merge(['mobile_number' => PhilippineMobile::normalizeInput($request->input('mobile_number'))]);

        $validated = $request->validate([
            'first_name' => 'required|string|max:60',
            'middle_name' => 'nullable|string|max:60',
            'last_name' => 'required|string|max:60',
            'email' => 'required|string|email|max:100|unique:users,email,' . $employee->id,
            'password' => 'nullable|string|min:8',
            'department_id' => 'required|exists:departments,department_id',
            'role_id' => 'required|exists:roles,role_id',
            'mobile_number' => PhilippineMobileNumber::forAccount($employee->id),
            'is_active' => 'required|boolean',
            // Optional: a newly drawn signature (base64 PNG data URL) replaces the registered one
            'signature' => ['nullable', 'string', 'max:2000000', 'regex:/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+\/=]+$/'],
            // Optional: HR resets a forgotten document PIN (the owner changes it in Profile Settings)
        ] + DocumentPinService::staffRules(false), PhilippineMobileNumber::accountMessages() + DocumentPinService::staffMessages());

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

    public function destroy(Request $request, User $employee)
    {
        $empName = $employee->name;
        $empEmail = $employee->email;
        $employee->delete();

        $this->auditTrailService->logUserAction(
            action: 'Delete Employee',
            description: "HR permanently deleted employee record {$empName} ({$empEmail})",
            actor: $request->user(),
            ipAddress: $request->ip()
        );

        return redirect()->back()->with('success', 'Employee deleted successfully.');
    }
}

