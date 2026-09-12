<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        
        $query = Document::with(['submitter', 'department', 'type']);
        
        // Admin and Mayor can see all documents, others are restricted
        if ($user && $user->role && !in_array($user->role->role_name, ['Admin', 'Mayor'])) {
            $query->where(function ($q) use ($user) {
                if ($user->department_id) {
                    $q->where('current_holder_department_id', $user->department_id);
                }
                $q->orWhere('current_holder_id', $user->id)
                  ->orWhere('submitted_by', $user->id);
            });
        }
        
        $documents = $query->orderBy('created_at', 'desc')->get();
        return response()->json($documents);
    }

    public function show($id)
    {
        $document = Document::with(['submitter', 'department', 'type', 'routingSlips', 'auditTrails', 'signatures'])->findOrFail($id);
        
        // Confidentiality Guard for Receiving Clerk
        $user = auth()->user();
        if ($document->classification === 'Confidential' && $user && $user->role && $user->role->role_name === 'Receiving') {
            $document->attachment_path = null;
            $document->ocr_text = 'Confidential Document — Metadata Only. You are authorized to route this document but not view its contents.';
            $document->is_confidential_hidden = true;
        }
        
        return response()->json($document);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string',
            'type_id' => 'required|exists:document_types,type_id',
            'department_id' => 'required|exists:departments,department_id',
            'file' => 'required|file|max:10240',
            'classification' => 'required|string',
            'forward_to' => 'required|exists:departments,department_id',
            'forward_to_user' => 'nullable|exists:users,id',
            'instruction' => 'nullable|string',
            'ocr_text' => 'nullable|string',
            'is_internal' => 'nullable|boolean',
        ]);

        $path = $request->file('file')->store('documents', 'public');
        
        // Generate department-aware reference number: {DEPT_CODE}-{YEAR}-{SEQ}
        $department = \App\Models\Department::find($request->department_id);
        $deptCode = $department->code ?? 'GEN';
        $year = date('Y');
        $deptDocCount = Document::where('department_id', $request->department_id)
            ->whereYear('created_at', $year)
            ->count() + 1;
        $referenceNumber = $deptCode . '-' . $year . '-' . str_pad($deptDocCount, 4, '0', STR_PAD_LEFT);

        $isInternal = $request->boolean('is_internal');

        if ($isInternal) {
            $trackingNumber = null;
            $status = 'Ongoing';
            $receivingDept = \App\Models\Department::where('department_name', 'like', '%Receiving%')->orWhere('code', 'REC')->first();
            $currentHolderDeptId = $receivingDept ? $receivingDept->department_id : 1;
            $destinationDeptId = $request->forward_to;
        } else {
            // Tracking number (global sequential safe)
            $latestDoc = Document::whereNotNull('tracking_number')
                ->where('tracking_number', 'like', "RS-$year-%")
                ->orderBy('tracking_number', 'desc')
                ->first();
            
            $nextSeq = $latestDoc ? ((int) substr($latestDoc->tracking_number, -4)) + 1 : 1;
            $trackingNumber = 'RS-' . $year . '-' . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);
            $status = 'Sent';
            $currentHolderDeptId = $request->forward_to;
            $destinationDeptId = null;
        }

        $document = Document::create([
            'reference_number' => $referenceNumber,
            'tracking_number' => $trackingNumber,
            'title' => $request->title,
            'type_id' => $request->type_id,
            'department_id' => $request->department_id,
            'submitted_by' => auth()->id(),
            'attachment_path' => $path,
            'classification' => $request->classification,
            'urgency_justification' => $request->urgency_justification,
            'status' => $status,
            'ocr_text' => $request->ocr_text,
            'current_step_index' => 1,
            'total_steps' => 6,
            'sender' => auth()->user()->name,
            'current_holder_department_id' => $currentHolderDeptId,
            'is_internal' => $isInternal,
            'destination_department_id' => $destinationDeptId,
            'date_filed' => now(),
        ]);

        if ($isInternal) {
            \App\Models\RoutingSlip::create([
                'document_id' => $document->document_id,
                'tracking_number' => 'PENDING-' . $document->reference_number,
                'from_user_id' => auth()->id(),
                'from_department_id' => $request->department_id,
                'to_user_id' => null,
                'target_department_id' => $currentHolderDeptId,
                'sender_name' => auth()->user()->name,
                'action' => 'forward',
                'instruction' => 'Submitted for registration and routing.',
                'status' => 'pending',
            ]);
        } else {
            // Create routing slip immediately if not internal
            \App\Models\RoutingSlip::create([
                'document_id' => $document->document_id,
                'tracking_number' => $trackingNumber,
                'from_user_id' => auth()->id(),
                'from_department_id' => $request->department_id,
                'to_user_id' => $request->forward_to_user, // Specific user or null for pool
                'target_department_id' => $request->forward_to,
                'sender_name' => auth()->user()->name,
                'action' => 'forward',
                'instruction' => $request->instruction,
                'status' => 'pending',
            ]);
        }

        // Create audit trail
        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'User',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Submit',
            'description' => 'Document submitted and routed to ' . (\App\Models\Department::find($request->forward_to)->department_name ?? 'destination'),
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', 'Document submitted successfully. Tracking: ' . $trackingNumber);
    }

    public function accept(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $document->update([
            'status' => 'Received',
            'current_step_index' => 3,
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'User',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Receive',
            'description' => 'Document officially received and accepted by ' . auth()->user()->name . ' for review.',
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document accepted successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document accepted successfully');
    }

    public function review(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $document->update([
            'status' => 'Ongoing',
            'current_step_index' => 4,
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'User',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Review',
            'description' => 'Document has been reviewed and marked as ongoing by ' . auth()->user()->name . '.',
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document reviewed successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document reviewed successfully');
    }

    public function endorse(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $request->validate([
            'destination_type' => 'required|in:department,user',
            'destination_id' => 'required',
            'remarks' => 'nullable|string',
        ]);

        $isDept = $request->destination_type === 'department';
        
        \App\Models\RoutingSlip::create([
            'document_id' => $document->document_id,
            'tracking_number' => $document->tracking_number,
            'from_user_id' => auth()->id(),
            'from_department_id' => $document->current_holder_department_id,
            'to_user_id' => $isDept ? null : $request->destination_id,
            'target_department_id' => $isDept ? $request->destination_id : \App\Models\User::find($request->destination_id)->department_id,
            'sender_name' => auth()->user()->name,
            'action' => 'forward',
            'instruction' => $request->remarks,
            'status' => 'pending',
        ]);

        $document->update([
            'status' => 'Sent',
            'current_holder_department_id' => $isDept ? $request->destination_id : \App\Models\User::find($request->destination_id)->department_id,
            'current_holder_id' => $isDept ? null : $request->destination_id,
            'current_step_index' => 4,
        ]);

        $destName = $isDept 
            ? \App\Models\Department::find($request->destination_id)->department_name 
            : \App\Models\User::find($request->destination_id)->name;

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'User',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Endorse',
            'description' => 'Document endorsed to ' . $destName . ($request->remarks ? ': ' . $request->remarks : ''),
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document endorsed successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document endorsed successfully');
    }

    public function escalate(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $request->validate([
            'justification' => 'required|string',
        ]);

        $document->update([
            'is_escalated' => true,
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'action' => 'escalated',
            'description' => 'Document escalated to CART. Justification: ' . $request->justification,
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', 'Document escalated to CART');
    }

    public function link(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $request->validate([
            'tracking_number' => 'required|string|exists:documents,tracking_number',
        ]);

        $linkedDoc = Document::where('tracking_number', $request->tracking_number)->first();
        
        $document->update([
            'linked_document_id' => $linkedDoc->document_id,
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'action' => 'linked',
            'description' => 'Document linked to tracking number ' . $request->tracking_number,
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', 'Document linked successfully');
    }

    public function approveAndRouteToReceiving(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        // Find receiving department
        $receivingDept = \App\Models\Department::where('department_name', 'like', '%Receiving%')->orWhere('code', 'REC')->first();
        $destDeptId = $receivingDept ? $receivingDept->department_id : 1;

        \App\Models\RoutingSlip::create([
            'document_id' => $document->document_id,
            'tracking_number' => $document->tracking_number,
            'from_user_id' => auth()->id(),
            'from_department_id' => $document->current_holder_department_id,
            'to_user_id' => null,
            'target_department_id' => $destDeptId,
            'sender_name' => auth()->user()->name,
            'action' => 'forward',
            'instruction' => 'Approved by Mayor. For final release to applicant.',
            'status' => 'pending',
        ]);

        $document->update([
            'status' => 'approved',
            'current_holder_department_id' => $destDeptId,
            'current_holder_id' => null,
            'current_step_index' => 5,
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'Mayor',
            'department' => auth()->user()->department->department_name ?? 'Office of the Mayor',
            'action' => 'Approve',
            'description' => 'Document approved and routed to Receiving Clerk for release.',
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document approved successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document approved and routed to Receiving Clerk.');
    }

    public function releaseToApplicant(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $document->update([
            'status' => 'completed',
            'completed_at' => now(),
            'current_holder_id' => null,
            'current_holder_department_id' => null,
            'current_step_index' => 6,
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'User',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => 'Release',
            'description' => 'Document officially released to applicant and marked as completed.',
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document released successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document successfully released to the applicant.');
    }

    public function archiveDocument(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        $user = auth()->user();
        $userRole = $user->role->role_name ?? 'User';

        $document->update([
            'status' => 'archived',
            'completed_at' => $document->completed_at ?? now(),
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => $user->id,
            'user_role' => $userRole,
            'department' => $user->department->department_name ?? null,
            'action' => 'Archive',
            'description' => 'Document moved to Central Archive Repository by ' . $user->name,
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document archived successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document moved to Archived module.');
    }

    public function returnDocument(Request $request, $id)
    {
        $request->validate([
            'reason' => 'required|string',
        ]);

        $document = Document::findOrFail($id);
        $user = auth()->user();
        $userRole = $user->role->role_name ?? 'User';

        $document->update([
            'status' => 'Returned',
            'return_reason' => $request->reason,
            'current_holder_id' => $document->submitted_by ?? $document->current_holder_id,
        ]);

        $audit = \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => $user->id,
            'user_role' => $userRole,
            'department' => $user->department->department_name ?? null,
            'action' => 'Return',
            'description' => 'Document marked as Returned. Reason for return: ' . $request->reason,
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->header('X-Inertia')) {
            return redirect()->back()->with('success', 'Document returned successfully.');
        }

        if ($request->wantsJson()) {
            return response()->json([
                'message' => 'Document returned successfully.', 
                'document' => $document,
                'audit' => $audit->load(['user.role', 'user.department'])
            ]);
        }

        return redirect()->back()->with('success', 'Document returned successfully.');
    }

    public function addComment(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $request->validate([
            'comment' => 'required|string',
            'quoted_text' => 'nullable|string',
        ]);

        $isAnchored = !empty($request->quoted_text);

        \Illuminate\Support\Facades\DB::table('document_comments')->insert([
            'document_id' => $document->document_id,
            'user_id' => auth()->id(),
            'comment' => $request->comment,
            'is_anchored' => $isAnchored,
            'quoted_text' => $request->quoted_text,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'User',
            'department' => auth()->user()->department->department_name ?? null,
            'action' => $isAnchored ? 'Anchor' : 'Comment',
            'description' => $isAnchored 
                ? 'Anchored note added on excerpt: "' . \Illuminate\Support\Str::limit($request->quoted_text, 60) . '" — ' . $request->comment 
                : 'Comment posted: ' . \Illuminate\Support\Str::limit($request->comment, 80),
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Comment added successfully.']);
        }

        return redirect()->back()->with('success', 'Comment added');
    }

    public function getComments($id)
    {
        $comments = \Illuminate\Support\Facades\DB::table('document_comments')
            ->where('document_id', $id)
            ->join('users', 'document_comments.user_id', '=', 'users.id')
            ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
            ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
            ->orderBy('created_at', 'asc')
            ->get();
            
        return response()->json($comments);
    }

    public function register(Request $request, $id)
    {
        $document = Document::findOrFail($id);

        $year = date('Y');
        $latestDoc = Document::whereNotNull('tracking_number')
            ->where('tracking_number', 'like', "RS-$year-%")
            ->orderBy('tracking_number', 'desc')
            ->first();
            
        $nextSeq = $latestDoc ? ((int) substr($latestDoc->tracking_number, -4)) + 1 : 1;
        $trackingNumber = 'RS-' . $year . '-' . str_pad($nextSeq, 4, '0', STR_PAD_LEFT);

        $document->update([
            'tracking_number' => $trackingNumber,
            'status' => 'Ongoing',
            'current_holder_department_id' => $document->destination_department_id ?? $document->department_id,
            'current_step_index' => 2,
        ]);

        \App\Models\RoutingSlip::create([
            'document_id' => $document->document_id,
            'tracking_number' => $trackingNumber,
            'from_user_id' => auth()->id(),
            'from_department_id' => auth()->user()->department_id,
            'to_user_id' => null,
            'target_department_id' => $document->destination_department_id ?? $document->department_id,
            'sender_name' => auth()->user()->name,
            'action' => 'forward',
            'instruction' => 'Registered and routed for processing',
            'status' => 'pending',
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'Receiving Clerk',
            'department' => auth()->user()->department->department_name ?? null,
            'document_ref' => $document->reference_number,
            'action' => 'Register',
            'description' => 'Document officially registered and assigned tracking number: ' . $trackingNumber,
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document registered successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document registered and routed successfully.');
    }

    public function receive(Request $request, $id)
    {
        $document = Document::findOrFail($id);

        $document->update([
            'status' => 'Received',
            'current_step_index' => max(2, $document->current_step_index),
        ]);

        \App\Models\RoutingSlip::where('document_id', $document->document_id)
            ->where('status', 'pending')
            ->update(['status' => 'received']);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? 'User',
            'department' => auth()->user()->department->department_name ?? null,
            'document_ref' => $document->reference_number,
            'action' => 'Receive',
            'description' => 'Document officially received by ' . auth()->user()->name,
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document received successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document received successfully.');
    }

    public function export(Request $request, $id)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = auth()->user();
        
        // Check allowed roles
        $allowedRoles = ['Receiving Clerk', 'Department Head', 'Mayor', 'Admin', 'HR', 'CART'];
        $userRole = $user->role->role_name ?? '';
        if (!in_array($userRole, $allowedRoles)) {
            return response()->json(['message' => 'Unauthorized role for export.'], 403);
        }

        // Verify password
        if (!\Illuminate\Support\Facades\Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Incorrect password.'], 401);
        }

        if ($id == 0) {
            \App\Models\AuditTrail::create([
                'document_id' => null,
                'user_id' => $user->id,
                'user_role' => $userRole,
                'department' => $user->department->department_name ?? null,
                'document_ref' => 'Document List',
                'action' => 'Export',
                'description' => 'Document list exported securely via password verification.',
                'ip_address' => $request->ip(),
                'timestamp' => now(),
            ]);

            return response()->json([
                'message' => 'Export successful.',
                'url' => null
            ]);
        }

        $document = Document::findOrFail($id);

        // Log to Audit Trail
        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'user_id' => $user->id,
            'user_role' => $userRole,
            'department' => $user->department->department_name ?? null,
            'document_ref' => $document->reference_number,
            'action' => 'Export',
            'description' => 'Document exported securely via password verification.',
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        return response()->json([
            'message' => 'Export successful.',
            'url' => $document->attachment_path ? asset('storage/' . $document->attachment_path) : null
        ]);
    }

    public function addAttachment(Request $request, $id)
    {
        $request->validate([
            'file' => 'required|file|max:20480',
            'reason' => 'nullable|string',
        ]);

        $document = Document::findOrFail($id);
        $user = auth()->user();
        $userRole = $user->role->role_name ?? 'User';

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        $fileSize = $file->getSize();
        $fileType = $file->getClientMimeType();
        $path = $file->store('attachments', 'public');

        $attachment = \App\Models\DocumentAttachment::create([
            'document_id' => $document->document_id,
            'user_id' => $user->id,
            'file_name' => $fileName,
            'file_path' => $path,
            'file_size' => $fileSize,
            'file_type' => $fileType,
            'reason' => $request->reason,
        ]);

        $document->attachment_path = $path;
        $document->save();

        $audit = \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => $user->id,
            'user_role' => $userRole,
            'department' => $user->department->department_name ?? null,
            'action' => 'Add Attachment',
            'description' => 'Uploaded corrected attachment: ' . $fileName . ($request->reason ? ' — Note: ' . $request->reason : ''),
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        $attachmentPayload = [
            'attachment_id' => $attachment->attachment_id,
            'file_name' => $attachment->file_name,
            'file_path' => $attachment->file_path,
            'file_size' => $attachment->file_size,
            'file_type' => $attachment->file_type,
            'reason' => $attachment->reason,
            'url' => asset('storage/' . $attachment->file_path),
            'created_at' => $attachment->created_at,
            'user_name' => $user->name,
            'user_role' => $userRole,
        ];

        if ($request->header('X-Inertia')) {
            return redirect()->back()->with('success', 'Attachment uploaded successfully.');
        }

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json([
                'message' => 'Attachment uploaded successfully.',
                'attachment' => $attachmentPayload,
                'audit' => $audit->load(['user.role', 'user.department']),
            ]);
        }

        return redirect()->back()->with('success', 'Attachment uploaded successfully.');
    }

    public function getTimelineSync($id)
    {
        $document = Document::with(['submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder'])->findOrFail($id);
        $auditTrail = \App\Models\AuditTrail::with(['user.role', 'user.department'])
            ->where('document_id', $id)
            ->orderBy('timestamp', 'asc')
            ->get();
        $comments = \Illuminate\Support\Facades\DB::table('document_comments')
            ->where('document_id', $id)
            ->join('users', 'document_comments.user_id', '=', 'users.id')
            ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
            ->select('document_comments.*', \Illuminate\Support\Facades\DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"), 'roles.role_name as user_role')
            ->orderBy('created_at', 'asc')
            ->get();
        $attachments = \App\Models\DocumentAttachment::with('user.role')
            ->where('document_id', $id)
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($att) {
                return [
                    'attachment_id' => $att->attachment_id,
                    'file_name' => $att->file_name,
                    'file_path' => $att->file_path,
                    'file_size' => $att->file_size,
                    'file_type' => $att->file_type,
                    'reason' => $att->reason,
                    'url' => asset('storage/' . $att->file_path),
                    'created_at' => $att->created_at,
                    'user_name' => $att->user ? $att->user->name : 'User',
                    'user_role' => $att->user && $att->user->role ? $att->user->role->role_name : 'User',
                ];
            });

        return response()->json([
            'status' => $document->status,
            'return_reason' => $document->return_reason,
            'document' => $document,
            'auditTrail' => $auditTrail,
            'comments' => $comments,
            'attachments' => $attachments,
        ]);
    }

    public function logAction(Request $request, $id)
    {
        $request->validate([
            'action' => 'required|string',
            'description' => 'required|string',
        ]);

        $document = Document::findOrFail($id);
        $user = auth()->user();
        $userRole = $user->role ? $user->role->role_name : 'Unknown';

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'user_id' => $user->id,
            'user_role' => $userRole,
            'department' => $user->department->department_name ?? null,
            'document_ref' => $document->reference_number,
            'action' => $request->action,
            'description' => $request->description,
            'ip_address' => $request->ip(),
            'timestamp' => now(),
        ]);

        return redirect()->back();
    }
}
