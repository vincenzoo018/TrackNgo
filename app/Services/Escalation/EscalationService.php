<?php

namespace App\Services\Escalation;

use App\Contracts\AuditTrailServiceInterface;
use App\Contracts\EscalationServiceInterface;
use App\Models\Document;
use App\Models\User;
use Carbon\Carbon;

class EscalationService implements EscalationServiceInterface
{
    public function __construct(
        protected EscalationRepository $repository,
        protected AuditTrailServiceInterface $auditTrailService
    ) {}

    public function getEscalationPayload(User $user, array $filters = []): array
    {
        $userRole = strtolower($user->role->role_name ?? '');
        $isFullAccess = in_array($userRole, ['admin', 'cart']);

        $severityFilter = $filters['severity'] ?? 'all';
        $deptFilter = $filters['department'] ?? 'all';
        $typeFilter = $filters['type'] ?? 'all';
        $rangeFilter = $filters['range'] ?? 'all';
        $searchQuery = trim($filters['search'] ?? '');

        $documents = $this->repository->getCandidateDocuments($user, $isFullAccess);

        $now = Carbon::now();
        $escalatedDocs = [];

        $countOverdue = 0;
        $countApproaching = 0;
        $countUrgent = 0;
        $countCritical = 0;

        foreach ($documents as $doc) {
            $thresholdDays = $doc->type->arta_processing_days ?? 3;
            $startDate = $doc->date_filed ?? $doc->created_at;
            $startCarbon = $startDate ? Carbon::parse($startDate) : $now;

            $dueDate = $doc->arta_due_date
                ? Carbon::parse($doc->arta_due_date)
                : (clone $startCarbon)->addDays($thresholdDays);

            $diffHours = $now->diffInHours($dueDate, false);
            $diffDays = $now->diffInDays($dueDate, false);

            $isOverdue = $now->gt($dueDate);
            $hoursOverdue = $isOverdue ? abs($diffHours) : 0;
            $daysOverdue = $isOverdue ? abs($diffDays) : 0;

            $isApproaching = !$isOverdue && ($diffHours <= 24 || $diffDays <= 1);

            $urgencyLevel = 'Medium';
            $urgencyScore = 50;

            if ($isOverdue) {
                if ($hoursOverdue >= 72 || $daysOverdue >= 3) {
                    $urgencyLevel = 'Critical';
                    $urgencyScore = 95;
                    $countCritical++;
                } else {
                    $urgencyLevel = 'High';
                    $urgencyScore = 80;
                    $countOverdue++;
                }
            } elseif ($isApproaching) {
                $urgencyLevel = 'High';
                $urgencyScore = 70;
                $countApproaching++;
            } elseif ($doc->is_escalated) {
                $urgencyLevel = 'High';
                $urgencyScore = 75;
                $countUrgent++;
            }

            $isEligible = $doc->is_escalated || $isOverdue || $isApproaching;
            if (!$isEligible) {
                continue;
            }

            $severity = $isOverdue ? 'Overdue / SLA Breached' : ($isApproaching ? 'Approaching SLA' : 'Urgent Review Required');

            $docData = [
                'document_id'                  => $doc->document_id,
                'reference_number'             => $doc->reference_number,
                'tracking_number'              => $doc->tracking_number,
                'title'                        => $doc->title,
                'status'                       => $doc->status,
                'classification'               => $doc->classification ?? 'normal',
                'is_escalated'                 => (bool) $doc->is_escalated,
                'department_name'              => $doc->department->department_name ?? 'LGU Mati',
                'department_code'              => $doc->department->code ?? 'LGU',
                'department_id'                => $doc->department_id,
                'document_type'                => $doc->type->type_name ?? 'General Document',
                'type_id'                      => $doc->type_id,
                'arta_processing_days'         => $thresholdDays,
                'submitted_by_name'            => $doc->submitter->name ?? 'Staff Submitter',
                'current_holder_name'          => $doc->currentHolder->name ?? ($doc->currentHolderDepartment->department_name ?? 'Department Pool'),
                'current_holder_department'    => $doc->currentHolderDepartment->department_name ?? 'Designated Office',
                'current_holder_department_id' => $doc->current_holder_department_id,
                'date_filed'                   => $startCarbon->toIso8601String(),
                'formatted_date_filed'         => $startCarbon->format('M d, Y h:i A'),
                'due_date'                     => $dueDate->toIso8601String(),
                'formatted_due_date'           => $dueDate->format('M d, Y h:i A'),
                'is_overdue'                   => $isOverdue,
                'is_approaching'               => $isApproaching,
                'hours_overdue'                => (int) round($hoursOverdue),
                'days_overdue'                 => (int) round($daysOverdue),
                'diff_hours'                   => (int) round($diffHours),
                'urgency_level'                => $urgencyLevel,
                'urgency_score'                => $urgencyScore,
                'severity'                     => $severity,
                'action_url'                   => "/documents/{$doc->document_id}",
            ];

            // Filter checks
            if ($severityFilter !== 'all') {
                if ($severityFilter === 'overdue' && !$isOverdue) continue;
                if ($severityFilter === 'approaching' && !$isApproaching) continue;
                if ($severityFilter === 'urgent' && $urgencyLevel !== 'Critical' && $urgencyLevel !== 'High') continue;
            }

            if ($deptFilter !== 'all' && $docData['department_id'] != $deptFilter && $docData['current_holder_department_id'] != $deptFilter) {
                continue;
            }

            if ($typeFilter !== 'all' && $docData['type_id'] != $typeFilter) {
                continue;
            }

            if ($searchQuery !== '') {
                $q = strtolower($searchQuery);
                $match = str_contains(strtolower($docData['reference_number']), $q)
                    || str_contains(strtolower($docData['title']), $q)
                    || str_contains(strtolower($docData['department_name']), $q)
                    || str_contains(strtolower($docData['current_holder_name']), $q)
                    || str_contains(strtolower($docData['document_type']), $q);

                if (!$match) continue;
            }

            $escalatedDocs[] = $docData;
        }

        // Sort by urgency score descending
        usort($escalatedDocs, fn ($a, $b) => $b['urgency_score'] <=> $a['urgency_score']);

        $currentRole = match ($userRole) {
            'admin'           => 'admin',
            'cart'            => 'cart',
            'receiving clerk' => 'receiving',
            'department head' => 'department-head',
            'mayor'           => 'mayor',
            'hr'              => 'hr',
            default           => 'cart',
        };

        return [
            'escalatedDocuments' => $escalatedDocs,
            'departments'        => $this->repository->getActiveDepartments(),
            'documentTypes'      => $this->repository->getDocumentTypes(),
            'isFullAccess'       => $isFullAccess,
            'currentRole'        => $currentRole,
            'userRoleName'       => $user->role->role_name ?? 'Staff',
            'userName'           => $user->name,
            'metrics'            => [
                'total'       => count($escalatedDocs),
                'overdue'     => $countOverdue + $countCritical,
                'approaching' => $countApproaching,
                'critical'    => $countCritical,
            ],
            'filters' => [
                'severity'   => $severityFilter,
                'department' => $deptFilter,
                'type'       => $typeFilter,
                'range'      => $rangeFilter,
                'search'     => $searchQuery,
            ],
        ];
    }

    public function resolveEscalation(int $documentId, array $data, User $actor, ?string $ipAddress = null): void
    {
        $document = Document::findOrFail($documentId);
        $notes = $data['notes'] ?? 'Escalation resolved by compliance officer.';

        $document->update([
            'is_escalated' => false,
        ]);

        $this->auditTrailService->logDocumentAction(
            document: $document,
            action: 'Resolve Escalation',
            description: "CART Compliance Officer {$actor->name} marked escalation as resolved. Action notes: {$notes}",
            actor: $actor,
            ipAddress: $ipAddress
        );
    }
}
