<?php

namespace App\Services\RoutingSlip;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\RoutingSlip;

class RoutingSlipSynchronizer
{
    /**
     * Run all synchronization tasks to keep documents and routing slips consistent.
     */
    public function syncAll(): void
    {
        $this->syncMissingSlips();
        $this->syncReturnedSlips();
        $this->syncEndorsementActions();
    }

    /**
     * Find all documents without any routing slips and generate initial routing slips.
     */
    public function syncMissingSlips(): void
    {
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
                'date_received'        => $doc->date_filed ?: ($doc->created_at ?: now()),
            ]);
        }
    }

    /**
     * Ensure documents marked as Returned have a corresponding returned routing slip.
     */
    public function syncReturnedSlips(): void
    {
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
                        'date_received'        => now(),
                    ]);
                }
            }
        }
    }

    /**
     * Ensure documents that had endorsements in the audit trail have their routing slips marked as endorse.
     */
    public function syncEndorsementActions(): void
    {
        $endorsedAuditDocIds = AuditTrail::where('action', 'like', '%endorse%')
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
