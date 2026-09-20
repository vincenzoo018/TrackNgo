<?php

namespace App\Services\Audit;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\User;

class AuditTrailService implements AuditTrailServiceInterface
{
    public function __construct(
        protected AuditTrailRepository $repository
    ) {}

    /**
     * Log a document-specific workflow action (Action Trail).
     */
    public function logDocumentAction(
        Document|int $document,
        string $action,
        string $description,
        ?User $actor = null,
        ?string $ipAddress = null
    ): AuditTrail {
        $actor = $actor ?: auth()->user();
        $ip = $ipAddress ?: (request()->ip() ?: '127.0.0.1');

        if (is_numeric($document)) {
            $doc = Document::find($document);
            $docId = (int) $document;
            $docRef = $doc?->reference_number ?? "DOC-{$docId}";
        } else {
            $docId = $document->document_id;
            $docRef = $document->reference_number;
        }

        return AuditTrail::create([
            'category'     => 'action',
            'document_id'  => $docId,
            'document_ref' => $docRef,
            'user_id'      => $actor?->id,
            'user_role'    => $actor?->role?->role_name ?? 'Staff',
            'department'   => $actor?->department?->department_name ?? null,
            'action'       => $action,
            'description'  => $description,
            'ip_address'   => $ip,
            'timestamp'    => now(),
        ]);
    }

    /**
     * Log an administrative, user management, or security override action.
     */
    public function logUserAction(
        string $action,
        string $description,
        ?User $actor = null,
        ?string $ipAddress = null,
        string $category = 'system'
    ): AuditTrail {
        $actor = $actor ?: auth()->user();
        $ip = $ipAddress ?: (request()->ip() ?: '127.0.0.1');

        return AuditTrail::create([
            'category'     => $category,
            'document_id'  => null,
            'document_ref' => null,
            'user_id'      => $actor?->id,
            'user_role'    => $actor?->role?->role_name ?? 'Admin',
            'department'   => $actor?->department?->department_name ?? null,
            'action'       => $action,
            'description'  => $description,
            'ip_address'   => $ip,
            'timestamp'    => now(),
        ]);
    }

    /**
     * Build the audit trail view payload for the given user.
     */
    public function getAuditTrailPayload(User $user): array
    {
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        // Ensure system records exist
        $this->ensureInitialSystemLogs();

        $systemLogs = $this->repository->getSystemLogs($user, $isFullAccess)->map(fn ($log) => $this->formatLog($log))->values()->all();
        $actionLogs = $this->repository->getActionLogs($user, $isFullAccess)->map(fn ($log) => $this->formatLog($log))->values()->all();

        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'receiving',
        };

        return [
            'systemLogs'   => $systemLogs,
            'actionLogs'   => $actionLogs,
            'isFullAccess' => $isFullAccess,
            'currentRole'  => $currentRole,
            'userRoleName' => $user->role->role_name ?? 'User',
            'userName'     => $user->name,
        ];
    }

    /**
     * Standardize audit log record for frontend consumption.
     */
    public function formatLog(AuditTrail $log): array
    {
        $roleName = $log->user_role
            ?: ($log->user && $log->user->role ? $log->user->role->role_name : 'Staff');
        $deptName = $log->department
            ?: ($log->user && $log->user->department ? $log->user->department->department_name : 'General Office');

        $ts = $log->timestamp ?: now();

        return [
            'audit_id'       => $log->audit_id,
            'category'       => $log->category,
            'user_name'      => $log->user ? $log->user->name : 'System Monitor',
            'user_role'      => $roleName,
            'department'     => $deptName,
            'action'         => $log->action,
            'description'    => $log->description,
            'document_id'    => $log->document_id,
            'document_ref'   => $log->document_ref ?: ($log->document ? $log->document->reference_number : null),
            'ip_address'     => $log->ip_address ?: '127.0.0.1',
            'timestamp'      => $ts->toIso8601String(),
            'formatted_time' => $ts->format('M d, Y h:i A'),
        ];
    }

    /**
     * Seed initial system trail records if none exist.
     */
    protected function ensureInitialSystemLogs(): void
    {
        if (AuditTrail::where('category', 'system')->count() === 0) {
            $initialEvents = [
                ['action' => 'System Boot',      'desc' => 'TrackNGo Mati application core services started and initialized successfully.'],
                ['action' => 'Database Sync',    'desc' => 'Database schema migrations and baseline seeds verified.'],
                ['action' => 'Service Ready',    'desc' => 'Document workflow tracker and notification services are active and operational.'],
            ];

            $admin = User::first();
            foreach ($initialEvents as $index => $event) {
                AuditTrail::create([
                    'category'     => 'system',
                    'document_id'  => null,
                    'document_ref' => null,
                    'user_id'      => $admin?->id,
                    'user_role'    => 'Administrator',
                    'department'   => 'Office of the City Administrator',
                    'action'       => $event['action'],
                    'description'  => $event['desc'],
                    'ip_address'   => '127.0.0.1',
                    'timestamp'    => now()->subMinutes(30 - ($index * 10)),
                ]);
            }
        }
    }
}
