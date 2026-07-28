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

        $isInternal = $request->input('is_internal', false);

        if ($isInternal) {
            $trackingNumber = null;
            $status = 'pending_registration';
            $currentHolderDeptId = $request->department_id; // Stays with sender until registered
            $destinationDeptId = $request->forward_to;
        } else {
            // Tracking number (global sequential)
            $globalCount = Document::whereYear('created_at', $year)->count() + 1;
            $trackingNumber = 'RS-' . $year . '-' . str_pad($globalCount, 4, '0', STR_PAD_LEFT);
            $status = 'submitted';
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
            'total_steps' => 5,
            'sender' => auth()->user()->name,
            'current_holder_department_id' => $currentHolderDeptId,
            'is_internal' => $isInternal,
            'destination_department_id' => $destinationDeptId,
            'date_filed' => now(),
        ]);

        if (!$isInternal) {
            // Create routing slip immediately if not internal
            \App\Models\RoutingSlip::create([
                'document_id' => $document->document_id,
                'tracking_number' => $trackingNumber,
                'from_user_id' => auth()->id(),
                'from_department_id' => $request->department_id,
                'to_user_id' => null, // Goes to department pool
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
            'action' => 'submitted',
            'description' => 'Document submitted and forwarded to ' . \App\Models\Department::find($request->forward_to)->department_name,
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', 'Document submitted successfully. Tracking: ' . $trackingNumber);
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
            'current_holder_department_id' => $isDept ? $request->destination_id : \App\Models\User::find($request->destination_id)->department_id,
            'current_holder_id' => $isDept ? null : $request->destination_id,
            'current_step_index' => $document->current_step_index < 2 ? 2 : $document->current_step_index,
        ]);

        $destName = $isDept 
            ? \App\Models\Department::find($request->destination_id)->department_name 
            : \App\Models\User::find($request->destination_id)->name;

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'action' => 'endorsed',
            'description' => 'Document endorsed to ' . $destName . ($request->remarks ? ': ' . $request->remarks : ''),
            'timestamp' => now(),
        ]);

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

    public function addComment(Request $request, $id)
    {
        $document = Document::findOrFail($id);
        
        $request->validate([
            'comment' => 'required|string',
            'quoted_text' => 'nullable|string',
        ]);

        \Illuminate\Support\Facades\DB::table('document_comments')->insert([
            'document_id' => $document->document_id,
            'user_id' => auth()->id(),
            'comment' => $request->comment,
            'is_anchored' => $request->quoted_text ? true : false,
            'quoted_text' => $request->quoted_text,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'document_ref' => $document->reference_number,
            'user_id' => auth()->id(),
            'action' => 'commented',
            'description' => 'User added a ' . ($request->quoted_text ? 'anchored ' : '') . 'comment.',
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', 'Comment added');
    }

    public function getComments($id)
    {
        $comments = \Illuminate\Support\Facades\DB::table('document_comments')
            ->where('document_id', $id)
            ->join('users', 'document_comments.user_id', '=', 'users.id')
            ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
            ->select('document_comments.*', 'users.name as user_name', 'roles.role_name as user_role')
            ->orderBy('created_at', 'desc')
            ->get();
            
        return response()->json($comments);
    }
    public function register(Request $request, $id)
    {
        $document = Document::findOrFail($id);

        if ($document->status !== 'pending_registration') {
            return response()->json(['message' => 'Document is not pending registration.'], 400);
        }

        $year = date('Y');
        $globalCount = Document::whereNotNull('tracking_number')->whereYear('created_at', $year)->count() + 1;
        $trackingNumber = 'RS-' . $year . '-' . str_pad($globalCount, 4, '0', STR_PAD_LEFT);

        $document->update([
            'tracking_number' => $trackingNumber,
            'status' => 'routed',
            'current_holder_department_id' => $document->destination_department_id,
            'current_step_index' => 2,
        ]);

        \App\Models\RoutingSlip::create([
            'document_id' => $document->document_id,
            'tracking_number' => $trackingNumber,
            'from_user_id' => auth()->id(),
            'from_department_id' => null, // Receiving Clerk doesn't have a specific dept context in routing
            'to_user_id' => null,
            'target_department_id' => $document->destination_department_id,
            'sender_name' => auth()->user()->name,
            'action' => 'forward',
            'instruction' => 'Registered and routed by Receiving Clerk',
            'status' => 'pending',
        ]);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? null,
            'department' => auth()->user()->department->department_name ?? null,
            'document_ref' => $document->reference_number,
            'action' => 'Registered Document',
            'description' => 'Document officially registered and assigned tracking number: ' . $trackingNumber,
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', 'Document registered and routed successfully.');
    }

    public function receive(Request $request, $id)
    {
        $document = Document::findOrFail($id);

        if ($document->status !== 'routed') {
            return response()->json(['message' => 'Document is not routed.'], 400);
        }

        $document->update([
            'status' => 'in_review',
            'current_step_index' => $document->current_step_index + 1,
        ]);

        \App\Models\RoutingSlip::where('document_id', $document->document_id)
            ->where('status', 'pending')
            ->update(['status' => 'received']);

        \App\Models\AuditTrail::create([
            'document_id' => $document->document_id,
            'user_id' => auth()->id(),
            'user_role' => auth()->user()->role->role_name ?? null,
            'department' => auth()->user()->department->department_name ?? null,
            'document_ref' => $document->reference_number,
            'action' => 'Received Document',
            'description' => 'Document officially received by destination office',
            'timestamp' => now(),
        ]);

        return redirect()->back()->with('success', 'Document received successfully.');
    }
}
