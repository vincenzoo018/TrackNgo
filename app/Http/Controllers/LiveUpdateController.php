<?php

namespace App\Http\Controllers;

use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\DocumentAttachment;
use App\Models\DocumentComment;
use App\Models\SystemNotification;
use Illuminate\Http\JsonResponse;

/**
 * Live updates without heavy polling: open pages ask every 15 seconds (only while visible) whether anything changed,
 * and reload just the part that did (resources/js/hooks/use-live-updates.ts). Each stamp is a single indexed MAX.
 */
class LiveUpdateController extends Controller
{
    public function changes(): JsonResponse
    {
        return response()->json([
            'stamps' => [
                'documents'     => (string) Document::max('updated_at') . ':' . Document::count(),
                'trail'         => (string) AuditTrail::max('audit_id'),
                'comments'      => (string) DocumentComment::max('id'),
                'attachments'   => (string) DocumentAttachment::max('attachment_id'),
                'notifications' => (string) SystemNotification::max('id') . ':' . SystemNotification::max('updated_at'),
            ],
        ]);
    }
}
