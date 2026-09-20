<?php

namespace App\Services;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\SystemNotification;
use App\Models\User;
use App\Services\Notification\NotificationStrategyFactory;
use Carbon\Carbon;

class NotificationService
{
    /**
     * Trigger a document receipt notification immediately upon receiving/accepting.
     */
    public static function triggerDocumentReceiptNotification(Document $document, User $receiver): SystemNotification
    {
        $doc = $document->loadMissing(['type', 'department', 'submitter', 'currentHolderDepartment']);

        $refNo = $doc->reference_number ?: ('TNG-' . date('Y') . '-' . str_pad($doc->document_id, 4, '0', STR_PAD_LEFT));
        $docType = $doc->type->type_name ?? 'General Document';
        $originatingDept = $doc->department->department_name ?? 'LGU Mati';
        $actionUrl = "/documents/{$doc->document_id}";

        return SystemNotification::create([
            'document_id'            => $doc->document_id,
            'user_id'                => $receiver->id,
            'target_role'            => null,
            'target_department_id'   => $receiver->department_id,
            'type'                   => 'receipt',
            'severity'               => 'normal',
            'title'                  => 'New Document Received',
            'reference_number'       => $refNo,
            'document_type'          => $docType,
            'originating_department' => $originatingDept,
            'action_url'             => $actionUrl,
            'is_read'                => false,
        ]);
    }

    /**
     * Evaluate and retrieve role-scoped notifications (receipts + SLA deadlines) using polymorphic strategies.
     */
    public static function getNotificationsForUser(User $user): array
    {
        $userRole = strtolower($user->role->role_name ?? 'receiving');
        $now = Carbon::now();

        // 1. Fetch active documents using polymorphic strategy
        $strategy = NotificationStrategyFactory::make($user);
        $activeDocs = $strategy->getActiveDocuments($user);

        // 2. Compute Deadline Notifications & Record Audit Trail on state change
        $deadlineItems = [];
        $warningCount = 0;
        $overdueCount = 0;
        $escalatedCount = 0;

        foreach ($activeDocs as $doc) {
            $threshold = $doc->type->arta_processing_days ?? 3;
            $startDate = $doc->date_filed ?? $doc->created_at;
            $startCarbon = $startDate ? Carbon::parse($startDate) : $now;

            $dueDateCarbon = $doc->arta_due_date
                ? Carbon::parse($doc->arta_due_date)
                : (clone $startCarbon)->addDays($threshold);

            $diffHours = $now->diffInHours($dueDateCarbon, false);
            $diffDays = (int) round($now->diffInDays($dueDateCarbon, false));

            $severity = null;
            $title = null;
            $toastMessage = null;
            $icon = null;

            if ($doc->is_escalated) {
                $severity = 'escalated';
                $icon = '⚡';
                $title = "Escalated: {$doc->reference_number}";
                $toastMessage = "Document {$doc->reference_number} auto-flagged for corrective action.";
                $escalatedCount++;
            } elseif ($now->gt($dueDateCarbon)) {
                $severity = 'overdue';
                $icon = '❗';
                $title = "SLA Breached: {$doc->reference_number}";
                $toastMessage = "Document {$doc->reference_number} has exceeded SLA deadline.";
                $overdueCount++;
            } elseif ($diffDays <= 2 || $diffHours <= 48) {
                $severity = 'warning';
                $icon = '⚠';
                $timeLeft = $diffDays > 0 ? "{$diffDays} day" . ($diffDays > 1 ? 's' : '') : max(1, (int) round($diffHours)) . "h";
                $title = "Approaching Deadline ({$timeLeft} left): {$doc->reference_number}";
                $toastMessage = "Document {$doc->reference_number} is approaching SLA ({$timeLeft} left).";
                $warningCount++;
            }

            if ($severity) {
                self::logDeadlineStatusChangeIfNeeded($doc, $severity, $dueDateCarbon);

                $deadlineItems[] = [
                    'id'                     => 'deadline-' . $doc->document_id . '-' . $severity,
                    'document_id'            => $doc->document_id,
                    'type'                   => 'deadline_' . $severity,
                    'severity'               => $severity,
                    'icon'                   => $icon,
                    'title'                  => $title,
                    'toast_message'          => $toastMessage,
                    'reference_number'       => $doc->reference_number,
                    'document_type'          => $doc->type->type_name ?? 'Document',
                    'originating_department' => $doc->department->department_name ?? 'LGU Mati',
                    'action_url'             => "/documents/{$doc->document_id}",
                    'created_at'             => $doc->created_at ? $doc->created_at->toISOString() : now()->toISOString(),
                    'is_read'                => false,
                ];
            }
        }

        // 3. Fetch persisted Receipt Notifications
        $receiptQuery = SystemNotification::where('type', 'receipt')
            ->orderBy('created_at', 'desc')
            ->limit(25);

        if (!in_array($userRole, ['admin', 'cart'])) {
            $receiptQuery->where(function ($q) use ($user) {
                if ($user->department_id) {
                    $q->where('target_department_id', $user->department_id);
                }
                $q->orWhere('user_id', $user->id)
                  ->orWhereNull('target_department_id');
            });
        }

        $receiptNotifications = $receiptQuery->get();
        $receivedCount = $receiptNotifications->where('is_read', false)->count();

        $receiptItems = $receiptNotifications->map(function ($rn) {
            $dateStr = $rn->created_at ? Carbon::parse($rn->created_at)->format('M d, Y') : Carbon::now()->format('M d, Y');
            $ref = $rn->reference_number ?: ('RS-' . str_pad($rn->id, 4, '0', STR_PAD_LEFT));
            $dept = $rn->originating_department ?: 'LGU Mati';
            $toastMessage = "New Document Received: {$ref}, {$dept}, {$dateStr}.";

            return [
                'id'                     => 'receipt-' . $rn->id,
                'db_id'                  => $rn->id,
                'document_id'            => $rn->document_id,
                'type'                   => 'receipt',
                'severity'               => 'normal',
                'icon'                   => '📄',
                'title'                  => $rn->title ?: 'New Document Received',
                'toast_message'          => $toastMessage,
                'reference_number'       => $ref,
                'document_type'          => $rn->document_type ?? 'General Document',
                'originating_department' => $dept,
                'action_url'             => $rn->action_url ?: "/documents/{$rn->document_id}",
                'created_at'             => $rn->created_at ? $rn->created_at->toISOString() : now()->toISOString(),
                'is_read'                => (bool) $rn->is_read,
            ];
        })->toArray();

        // 4. Combine all items sorted by priority (escalated > overdue > warning > receipt)
        $severityOrder = ['escalated' => 1, 'overdue' => 2, 'warning' => 3, 'normal' => 4];
        $allItems = array_merge($deadlineItems, $receiptItems);
        usort($allItems, function ($a, $b) use ($severityOrder) {
            $orderA = $severityOrder[$a['severity']] ?? 5;
            $orderB = $severityOrder[$b['severity']] ?? 5;
            if ($orderA === $orderB) {
                return strcmp($b['created_at'], $a['created_at']);
            }
            return $orderA - $orderB;
        });

        $totalAlerts = $receivedCount + $warningCount + $overdueCount + $escalatedCount;

        return [
            'counts' => [
                'total'     => $totalAlerts,
                'received'  => $receivedCount,
                'warning'   => $warningCount,
                'overdue'   => $overdueCount,
                'escalated' => $escalatedCount,
            ],
            'items'  => array_slice($allItems, 0, 30),
        ];
    }

    /**
     * Automatically log "Deadline Status Change" event in Audit Trail if not already logged today.
     */
    private static function logDeadlineStatusChangeIfNeeded(Document $doc, string $severity, Carbon $dueDate): void
    {
        $today = Carbon::today();
        $existingLog = AuditTrail::where('document_id', $doc->document_id)
            ->where('action', 'Deadline Status Change')
            ->where('description', 'like', "%{$severity}%")
            ->whereDate('timestamp', $today)
            ->exists();

        if (!$existingLog) {
            $severityLabel = ucfirst($severity);
            AuditTrail::create([
                'category'     => 'action',
                'document_id'  => $doc->document_id,
                'document_ref' => $doc->reference_number,
                'user_id'      => auth()->id() ?: $doc->submitted_by,
                'user_role'    => 'System / ARTA Monitor',
                'department'   => $doc->department->department_name ?? 'City Government of Mati',
                'action'       => 'Deadline Status Change',
                'description'  => "Document {$doc->reference_number} transitioned to SLA status: {$severityLabel}. Target Due Date: {$dueDate->format('M d, Y')}.",
                'ip_address'   => request()->ip() ?? '127.0.0.1',
                'timestamp'    => now(),
            ]);
        }
    }
}
