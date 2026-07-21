<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\AuditTrail;
use Illuminate\Http\Request;
use Carbon\Carbon;

class WorkflowController extends Controller
{
    // Feature 1: Built-in Commenting & Rejection Reasons (using Audit_Trail)
    public function returnDocument(Request $request, $document_id)
    {
        $request->validate([
            'reason' => 'required|string',
            'user_id' => 'required|integer'
        ]);

        $document = Document::findOrFail($document_id);
        
        // Log the return with comment in audit trail
        AuditTrail::create([
            'document_id' => $document_id,
            'user_id' => $request->user_id,
            'action' => 'RETURNED_WITH_COMMENT',
            'details' => $request->reason,
            'timestamp' => Carbon::now()
        ]);

        return response()->json(['message' => 'Document returned successfully with comments']);
    }

    public function getDocumentComments($document_id)
    {
        // Fetch only comment/rejection trails for the thread UI
        $comments = AuditTrail::where('document_id', $document_id)
            ->where('action', 'RETURNED_WITH_COMMENT')
            ->with('user')
            ->orderBy('timestamp', 'asc')
            ->get();
            
        return response()->json($comments);
    }
}
