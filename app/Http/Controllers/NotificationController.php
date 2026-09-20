<?php

namespace App\Http\Controllers;

use App\Models\SystemNotification;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get real-time notifications for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'counts' => ['total' => 0, 'received' => 0, 'warning' => 0, 'overdue' => 0, 'escalated' => 0],
                'items' => [],
                'banner' => null,
            ]);
        }

        $data = NotificationService::getNotificationsForUser($user);
        return response()->json($data);
    }

    /**
     * Mark an individual notification as read.
     */
    public function markAsRead(Request $request, $id): JsonResponse
    {
        // Check if ID is numeric (db id) or prefix string
        $dbId = is_numeric($id) ? $id : str_replace(['receipt-', 'deadline-'], '', $id);

        if (is_numeric($dbId)) {
            SystemNotification::where('id', $dbId)->update(['is_read' => true]);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            SystemNotification::where('is_read', false)
                ->where(function ($q) use ($user) {
                    $q->where('user_id', $user->id)
                      ->orWhere('target_department_id', $user->department_id)
                      ->orWhereNull('target_department_id');
                })
                ->update(['is_read' => true]);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Automatically log when a toast notification is triggered for a user.
     */
    public function logToastTriggered(Request $request): JsonResponse
    {
        $user = $request->user();
        $message = $request->input('message');
        $referenceNumber = $request->input('reference_number');

        if ($user && $message) {
            \App\Models\AuditTrail::create([
                'category'     => 'action',
                'document_ref' => $referenceNumber ?: '—',
                'user_id'      => $user->id,
                'user_role'    => $user->role->role_name ?? 'User',
                'department'   => $user->department->department_name ?? 'LGU Mati',
                'action'       => 'Toast Notification Triggered',
                'description'  => "Toast displayed in session: {$message}",
                'ip_address'   => $request->ip() ?? '127.0.0.1',
                'timestamp'    => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }
}
