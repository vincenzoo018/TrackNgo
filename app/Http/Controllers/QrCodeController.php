<?php

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\RoutingSlip;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class QrCodeController extends Controller
{
    /**
     * Display the QR Codes traceability index page.
     */
    public function index(Request $request): Response
    {
        $user = auth()->user();
        $userRole = strtolower($user->role->role_name ?? '');

        // Visibility rules:
        // Admin & CART: Can view all QR codes across all documents and routing slips.
        // Other roles: Scoped to their own documents, assigned routing slips, or department documents.
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        // Determine current role slug for navigation and links
        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'receiving',
        };

        // Query Routing Slips with eager-loaded relations
        $query = RoutingSlip::with([
            'document.department',
            'document.type',
            'document.submitter.role',
            'fromUser.role',
            'fromUser.department',
            'toUser.role',
            'toUser.department',
            'fromDepartment',
            'targetDepartment',
            'receiver',
        ]);

        if (!$isFullAccess) {
            $query->where(function ($q) use ($user) {
                // User directly involved as sender or recipient
                $q->where('from_user_id', $user->id)
                  ->orWhere('to_user_id', $user->id);

                // Department involvement (origin or target)
                if ($user->department_id) {
                    $q->orWhere('from_department_id', $user->department_id)
                      ->orWhere('target_department_id', $user->department_id);
                }

                // Relevant to user's documents (submitter or current holder)
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

        $records = $query->orderBy('slip_id', 'desc')->get()->map(function ($slip) {
            return $this->formatQrCodeItem($slip);
        });

        // Dynamic departments and document types for filter dropdowns
        $departments = Department::where('is_active', true)
            ->orderBy('department_name')
            ->get(['department_id', 'department_name', 'code']);

        $documentTypes = DocumentType::where('is_active', true)
            ->orderBy('type_name')
            ->get(['type_id', 'type_name']);

        return Inertia::render('qr-codes/Index', [
            'qrCodes'       => $records,
            'departments'   => $departments,
            'documentTypes' => $documentTypes,
            'isFullAccess'  => $isFullAccess,
            'currentRole'   => $currentRole,
            'userRoleName'  => $user->role->role_name ?? 'User',
            'userName'      => $user->name,
        ]);
    }

    /**
     * Format each routing slip into a standardized QR code traceability item.
     */
    protected function formatQrCodeItem(RoutingSlip $slip): array
    {
        $doc = $slip->document;

        // Unique QR Code ID directly mapped to slip and document
        $qrId = 'QR-2026-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT);

        // Routing slip identification
        $routingSlipId = $slip->tracking_number
            ?: ('RS-2026-' . str_pad($slip->slip_id, 4, '0', STR_PAD_LEFT));

        // Document reference number & title
        $documentRef = $doc ? $doc->reference_number : ('DOC-' . $slip->document_id);
        $documentTitle = $doc ? $doc->title : ('Document #' . $slip->document_id);
        $documentType = $doc && $doc->type ? $doc->type->type_name : 'Standard Document';

        // Controlling department
        $departmentName = $slip->fromDepartment
            ? $slip->fromDepartment->department_name
            : ($doc && $doc->department ? $doc->department->department_name : 'General Office');

        $departmentCode = $slip->fromDepartment && $slip->fromDepartment->code
            ? $slip->fromDepartment->code
            : ($doc && $doc->department ? $doc->department->code : 'DEPT');

        // Standardized Status: Active, Completed, Archived
        $docStatus = strtolower($doc ? $doc->status : '');
        $slipStatus = strtolower($slip->status ?? '');

        if ($docStatus === 'archived' || $slipStatus === 'archived' || in_array($docStatus, ['approved'])) {
            $status = 'Archived';
        } elseif ($docStatus === 'completed' || $slipStatus === 'completed') {
            $status = 'Completed';
        } else {
            $status = 'Active';
        }

        // Standardized sender and recipient
        $fromName = $slip->sender_name
            ?: ($slip->fromUser ? $slip->fromUser->name : ($doc && $doc->submitter ? $doc->submitter->name : 'Staff Submitter'));

        $toDept = $slip->targetDepartment
            ? $slip->targetDepartment->department_name
            : ($slip->toUser && $slip->toUser->department ? $slip->toUser->department->department_name : 'Department Pool');

        $toName = $slip->toUser ? $slip->toUser->name : 'Department Pool';

        // Machine-readable payload for scanning verification
        $qrData = "TRACKNGO|QR:{$qrId}|DOC:{$documentRef}|SLIP:{$routingSlipId}|DEPT:{$departmentName}";
        $qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' . urlencode($qrData);

        $createdAt = $slip->created_at ?: now();

        return [
            'qr_id'              => $qrId,
            'qr_data'            => $qrData,
            'qr_image_url'       => $qrImageUrl,
            'document_id'        => $slip->document_id,
            'document_ref'       => $documentRef,
            'document_title'     => $documentTitle,
            'document_type'      => $documentType,
            'routing_slip_id'    => $routingSlipId,
            'numeric_slip_id'    => $slip->slip_id,
            'department'         => $departmentName,
            'department_code'    => $departmentCode,
            'status'             => $status,
            'raw_document_status'=> $docStatus,
            'date_generated'     => $createdAt->format('M d, Y h:i A'),
            'date_iso'           => $createdAt->toIso8601String(),
            'formatted_date'     => $createdAt->format('Y-m-d'),
            'stop_number'        => 'Stop #1',
            'from_name'          => $fromName,
            'to_name'            => $toName,
            'to_department'      => $toDept,
            'action'             => ucfirst($slip->action ?? 'Forward'),
            'instruction'        => $slip->instruction ?: 'For review and verification.',
        ];
    }
}
