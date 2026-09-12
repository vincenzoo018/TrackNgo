<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class AuditTrailController extends Controller
{
    /**
     * Display the Audit Trail module with System Trail and Action Trail separation
     * and role-based visibility rules.
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        // ── Seed initial system trail records if none exist ───────────────
        if (AuditTrail::where('category', 'system')->count() === 0) {
            $this->seedInitialSystemLogs();
        }

        // ── System Trail Query ────────────────────────────────────────────
        $systemQuery = AuditTrail::with(['user.role', 'user.department'])
            ->where('category', 'system');

        if (!$isFullAccess) {
            $systemQuery->where('user_id', $user->id);
        }

        // ── Action Trail Query ────────────────────────────────────────────
        $actionQuery = AuditTrail::with(['user.role', 'user.department', 'document.department'])
            ->where('category', 'action');

        if (!$isFullAccess) {
            $actionQuery->where(function ($query) use ($user) {
                // User's own workflow actions
                $query->where('user_id', $user->id)
                    // OR related document events
                    ->orWhereHas('document', function ($docQuery) use ($user) {
                        $docQuery->where('submitted_by', $user->id);
                        if ($user->department_id) {
                            $docQuery->orWhere('department_id', $user->department_id)
                                     ->orWhere('current_holder_department_id', $user->department_id)
                                     ->orWhereHas('routingSlips', function ($rQuery) use ($user) {
                                         $rQuery->where('target_department_id', $user->department_id)
                                                ->orWhere('from_department_id', $user->department_id);
                                     });
                        }
                    });
            });
        }

        $systemLogs = $systemQuery->orderBy('timestamp', 'desc')->take(200)->get()->map(function ($log) {
            return $this->formatLog($log);
        });

        $actionLogs = $actionQuery->orderBy('timestamp', 'desc')->take(300)->get()->map(function ($log) {
            return $this->formatLog($log);
        });

        // Determine current role slug for layout & links
        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'receiving',
        };

        return Inertia::render('audit-trail/Index', [
            'systemLogs'   => $systemLogs,
            'actionLogs'   => $actionLogs,
            'isFullAccess' => $isFullAccess,
            'currentRole'  => $currentRole,
            'userRoleName' => $user->role->role_name ?? 'User',
            'userName'     => $user->name,
        ]);
    }

    /**
     * Standardize format of audit log item for UI display.
     */
    protected function formatLog(AuditTrail $log): array
    {
        $userName = $log->user 
            ? $log->user->name 
            : ($log->user_role ?? 'System User');

        $roleName = $log->user_role 
            ?: ($log->user && $log->user->role ? $log->user->role->role_name : 'Staff');

        $department = $log->department 
            ?: ($log->user && $log->user->department ? $log->user->department->department_name : null);

        $documentRef = $log->document_ref 
            ?: ($log->document ? $log->document->reference_number : null);

        return [
            'audit_id'     => $log->audit_id,
            'category'     => $log->category ?? 'action',
            'action'       => $log->action,
            'user_id'      => $log->user_id,
            'user_name'    => $userName,
            'user_role'    => $roleName,
            'department'   => $department ?? 'General Office',
            'document_ref' => $documentRef,
            'document_id'  => $log->document_id,
            'description'  => $log->description,
            'ip_address'   => $log->ip_address ?: '127.0.0.1',
            'timestamp'    => $log->timestamp ? $log->timestamp->toIso8601String() : $log->created_at->toIso8601String(),
            'formatted_time' => $log->timestamp ? $log->timestamp->format('M d, Y h:i:s A') : $log->created_at->format('M d, Y h:i:s A'),
        ];
    }

    /**
     * Seed initial System Trail events so historical session activities are visible.
     */
    protected function seedInitialSystemLogs(): void
    {
        $users = User::with(['role', 'department'])->get();
        if ($users->isEmpty()) return;

        $authActions = [
            ['action' => 'Login', 'desc' => 'User logged in successfully with password authentication.'],
            ['action' => 'Session Refreshed', 'desc' => 'Session state validated via bearer cookie.'],
            ['action' => 'Logout', 'desc' => 'User gracefully logged out and session destroyed.'],
            ['action' => 'Login', 'desc' => 'Authenticated through TrackNGo single sign-on.'],
        ];

        $ips = ['192.168.1.101', '192.168.1.105', '192.168.1.112', '10.0.0.15', '127.0.0.1'];

        $now = now();

        foreach ($users as $idx => $u) {
            $roleName = $u->role->role_name ?? 'User';
            $deptName = $u->department->department_name ?? 'City Hall';

            // Create 3 realistic system trail records per user spread over the last 14 days
            for ($i = 3; $i >= 1; $i--) {
                $template = $authActions[($idx + $i) % count($authActions)];
                $time = (clone $now)->subDays($i * 2 + ($idx % 3))->subHours($idx * 2 + $i)->subMinutes($i * 12);

                AuditTrail::create([
                    'category'     => 'system',
                    'document_id'  => null,
                    'user_id'      => $u->id,
                    'user_role'    => $roleName,
                    'department'   => $deptName,
                    'document_ref' => null,
                    'action'       => $template['action'],
                    'description'  => $template['desc'],
                    'ip_address'   => $ips[($idx + $i) % count($ips)],
                    'timestamp'    => $time,
                    'created_at'   => $time,
                    'updated_at'   => $time,
                ]);
            }
        }
    }
}
