<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Document;
use App\Models\RoutingSlip;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RoutingSlipController extends Controller
{
    /**
     * Display a listing of routing slips with role-based scoping,
     * document linking, and full metadata.
     */
    public function index(Request $request)
    {
        $user = auth()->user();
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        // ── Auto-sync: Ensure every document has a linked routing slip ──────
        $this->ensureAllDocumentsHaveRoutingSlips();

        // ── Query Routing Slips ───────────────────────────────────────────
        $query = RoutingSlip::with([
            'document.department',
            'document.submitter.role',
            'fromUser.role',
            'fromUser.department',
            'toUser.role',
            'toUser.department',
            'fromDepartment',
            'targetDepartment',
            'receiver',
        ]);

        // Role-based visibility scoping:
        // Admin & Cart: View all routing slips across all departments and roles.
        // Other roles: View routing slips relevant to their own documents and actions.
        if (!$isFullAccess) {
            $query->where(function ($q) use ($user) {
                // User is directly involved as sender or recipient
                $q->where('from_user_id', $user->id)
                  ->orWhere('to_user_id', $user->id);

                // Department involvement (origin or destination)
                if ($user->department_id) {
                    $q->orWhere('from_department_id', $user->department_id)
                      ->orWhere('target_department_id', $user->department_id);
                }

                // Relevant to user's documents (submitted or held)
                $q->orWhereHas('document', function ($docQuery) use ($user) {
                    $docQuery->where('submitted_by', $user->id)
                             ->orWhere('current_holder_id', $user->id);

                    if ($user->department_id) {
                        $docQuery->orWhere('department_id', $user->department_id)
                                 ->orWhere('current_holder_department_id', $user->department_id);
                    }
                });
            });
        }

        $slips = $query->orderBy('slip_id', 'desc')->get()->map(function ($slip) {
            return $this->formatRoutingSlip($slip);
        });

        // Current role slug for layout & route links
        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'receiving',
        };

        // Active departments for filter dropdown
        $departments = Department::where('is_active', true)
            ->orderBy('department_name')
            ->get(['department_id', 'department_name', 'code']);

        return Inertia::render('routing-slips/Index', [
            'routingSlips' => $slips,
            'departments'  => $departments,
            'isFullAccess' => $isFullAccess,
            'currentRole'  => $currentRole,
            'userRoleName' => $user->role->role_name ?? 'User',
            'userName'     => $user->name,
        ]);
    }

    /**
     * Standardize routing slip format for frontend consumption.
     */
    protected function formatRoutingSlip(RoutingSlip $slip): array
    {
        $doc = $slip->document;

        // Determine sender name and department
        $fromName = $slip->sender_name
            ?: ($slip->fromUser ? $slip->fromUser->name : ($doc && $doc->submitter ? $doc->submitter->name : 'Staff Submitter'));

        $fromDept = $slip->fromDepartment
            ? $slip->fromDepartment->department_name
            : ($slip->fromUser && $slip->fromUser->department
                ? $slip->fromUser->department->department_name
                : ($doc && $doc->department ? $doc->department->department_name : 'General Office'));

        // Determine recipient name and department
        $toDept = $slip->targetDepartment
            ? $slip->targetDepartment->department_name
            : ($slip->toUser && $slip->toUser->department
                ? $slip->toUser->department->department_name
                : 'Department Pool');

        $toName = $slip->toUser
            ? $slip->toUser->name
            : 'Department Pool';

        // Standardize action type
        $rawAction = strtolower($slip->action ?? 'forward');
        $action = match ($rawAction) {
            'endorse', 'endorsed' => 'Endorse',
            'return', 'returned'   => 'Return',
            'approve', 'approved' => 'Approve',
            default               => 'Forward',
        };

        // Standardize status: Active, Completed, Returned
        $rawStatus = strtolower($slip->status ?? 'pending');
        $status = match ($rawStatus) {
            'completed'           => 'Completed',
            'returned'            => 'Returned',
            default               => 'Active', // pending, active, received
        };

        // Tracking number fallback
        $trackingNumber = $slip->tracking_number
            ?: ($doc ? $doc->tracking_number : 'RS-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT));

        $createdAt = $slip->created_at ?: now();

        return [
            'slip_id'                 => $slip->slip_id,
            'formatted_slip_id'       => 'RS-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT),
            'tracking_number'         => $trackingNumber,
            'document_id'             => $slip->document_id,
            'document_ref'            => $doc ? $doc->reference_number : 'DOC-' . $slip->document_id,
            'document_title'          => $doc ? $doc->title : 'Document #' . $slip->document_id,
            'document_status'         => $doc ? $doc->status : 'Ongoing',
            'document_classification' => $doc ? $doc->classification : 'normal',
            'from_name'               => $fromName,
            'from_department'         => $fromDept,
            'from_role'               => $slip->fromUser && $slip->fromUser->role ? $slip->fromUser->role->role_name : 'Staff',
            'to_name'                 => $toName,
            'to_department'           => $toDept,
            'action'                  => $action,
            'instruction'             => $slip->instruction ?: 'For review and appropriate action.',
            'status'                  => $status,
            'date'                    => $createdAt->toIso8601String(),
            'formatted_date'          => $createdAt->format('Y-m-d'),
            'formatted_datetime'      => $createdAt->format('M d, Y h:i A'),
            'stop_number'             => 'Stop #1',
            'qr_data'                 => $trackingNumber ?: ($doc ? $doc->reference_number : 'DOC'),
        ];
    }

    /**
     * Ensure every document in the database automatically generates
     * and links to a routing slip, and backfill sample returned/endorsed slips.
     */
    protected function ensureAllDocumentsHaveRoutingSlips(): void
    {
        // 1. Find all documents that have zero routing slips
        $documentsWithoutSlips = Document::with(['submitter.department', 'department'])
            ->doesntHave('routingSlips')
            ->get();

        foreach ($documentsWithoutSlips as $doc) {
            $fromUserId = $doc->submitted_by ?: 1;
            $fromDeptId = $doc->department_id ?: ($doc->submitter ? $doc->submitter->department_id : 1);
            $targetDeptId = $doc->destination_department_id ?: $doc->department_id ?: 1;
            $trackingNum = $doc->tracking_number ?: ('RS-' . date('Y') . '-' . str_pad($doc->document_id, 4, '0', STR_PAD_LEFT));

            RoutingSlip::create([
                'document_id'          => $doc->document_id,
                'tracking_number'      => $trackingNum,
                'from_user_id'         => $fromUserId,
                'from_department_id'   => $fromDeptId,
                'to_user_id'           => null,
                'target_department_id' => $targetDeptId,
                'sender_name'          => $doc->sender ?: ($doc->submitter ? $doc->submitter->name : 'Submitter'),
                'action'               => 'forward',
                'instruction'          => 'Submitted for registration and routing.',
                'status'               => strtolower($doc->status) === 'completed' ? 'completed' : 'pending',
            ]);
        }

        // 2. Synchronize returned documents: ensure returned documents have a routing slip with status = 'returned' and action = 'return'
        $returnedDocs = Document::where('status', 'Returned')
            ->orWhere('status', 'returned')
            ->get();

        foreach ($returnedDocs as $retDoc) {
            $hasReturnSlip = RoutingSlip::where('document_id', $retDoc->document_id)
                ->where('status', 'returned')
                ->exists();

            if (!$hasReturnSlip) {
                $latestSlip = RoutingSlip::where('document_id', $retDoc->document_id)->latest('slip_id')->first();
                if ($latestSlip) {
                    $latestSlip->update([
                        'action'      => 'return',
                        'status'      => 'returned',
                        'instruction' => $retDoc->return_reason ?: 'Document returned for revision.',
                    ]);
                } else {
                    RoutingSlip::create([
                        'document_id'          => $retDoc->document_id,
                        'tracking_number'      => $retDoc->tracking_number ?: 'RS-RET-' . $retDoc->reference_number,
                        'from_user_id'         => $retDoc->current_holder_id ?: 1,
                        'from_department_id'   => $retDoc->current_holder_department_id ?: $retDoc->department_id,
                        'to_user_id'           => $retDoc->submitted_by,
                        'target_department_id' => $retDoc->department_id,
                        'sender_name'          => 'Reviewing Officer',
                        'action'               => 'return',
                        'instruction'          => $retDoc->return_reason ?: 'Document returned for revision.',
                        'status'               => 'returned',
                    ]);
                }
            }
        }

        // 3. Ensure sample endorsements have action = 'endorse'
        $endorsedAuditDocIds = \App\Models\AuditTrail::where('action', 'like', '%endorse%')
            ->pluck('document_id')
            ->unique();

        if ($endorsedAuditDocIds->isNotEmpty()) {
            RoutingSlip::whereIn('document_id', $endorsedAuditDocIds)
                ->where('action', 'forward')
                ->where('status', '!=', 'returned')
                ->take(10)
                ->update(['action' => 'endorse']);
        }
    }
}
