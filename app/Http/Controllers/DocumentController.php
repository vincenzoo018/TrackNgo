<?php

namespace App\Http\Controllers;

use App\Contracts\DocumentServiceInterface;
use App\Http\Requests\StoreDocumentRequest;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use App\Contracts\AuditTrailServiceInterface;

class DocumentController extends Controller
{
    public function __construct(
        protected DocumentServiceInterface $documentService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $documents = $this->documentService->getDocumentsForUser($request->user() ?: auth()->user());
        return response()->json($documents);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $document = $this->documentService->getDocumentWithConfidentialityGuard((int) $id, $request->user() ?: auth()->user());
        return response()->json($document);
    }

    public function store(StoreDocumentRequest $request)
    {
        $actor = $request->user() ?: auth()->user();
        $file = $request->file('file');

        $document = $this->documentService->createDocument($request->validated(), $file, $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json([
                'message'  => 'Document submitted successfully.',
                'document' => $document,
            ], 201);
        }

        $document->loadMissing(['currentHolder', 'currentHolderDepartment']);

        return redirect()->back()
            ->with('success', 'Document submitted successfully. Tracking: ' . $document->tracking_number)
            ->with('created_document', [
                'document_id'      => $document->document_id,
                'reference_number' => $document->reference_number,
                'tracking_number'  => $document->tracking_number,
                'recipient_name'   => $document->currentHolder?->name,
                'recipient_office' => $document->currentHolderDepartment?->department_name,
            ]);
    }

    public function register(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'register', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json([
                'message'  => 'Document registered successfully.',
                'document' => $document,
            ]);
        }

        return redirect()->back()->with('success', 'Document registered and routed successfully. Tracking: ' . $document->tracking_number);
    }

    public function receive(Request $request, $id)
    {
        return $this->accept($request, $id);
    }

    public function accept(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'accept', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document accepted successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document accepted successfully');
    }

    public function review(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'review', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document reviewed successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document reviewed successfully');
    }

    public function endorse(Request $request, $id)
    {
        $request->validate([
            'destination_type' => 'required|in:department,user,role',
            'destination_id'   => 'required',
            'remarks'          => 'nullable|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'endorse', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document endorsed successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document endorsed successfully');
    }

    public function escalate(Request $request, $id)
    {
        $request->validate([
            'justification' => 'required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'escalate', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document escalated to CART');
    }

    public function link(Request $request, $id)
    {
        $request->validate([
            'tracking_number' => 'required|string|exists:documents,tracking_number',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'link', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document linked successfully');
    }

    public function approveAndRouteToReceiving(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'approveAndRouteToReceiving', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document approved successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document approved and routed to Receiving Clerk.');
    }

    public function releaseToApplicant(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'releaseToApplicant', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document released successfully.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document successfully released to the applicant.');
    }

    public function archiveDocument(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'archive', $request->all(), $actor, $request->ip());

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

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'return', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document returned for revision.');
    }

    public function forward(Request $request, $id)
    {
        $request->validate([
            'forward_to_department' => 'required|exists:departments,department_id',
            'forward_to_user'       => 'nullable|exists:users,id',
            'instruction'           => 'nullable|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->executeWorkflowAction((int) $id, 'forward', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document forwarded successfully');
    }

    public function addComment(Request $request, $id)
    {
        $request->validate([
            'comment'     => 'required|string|max:2000',
            'quoted_text' => 'nullable|string|max:2000',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->addComment((int) $id, $request->comment, $actor, $request->ip(), $request->input('quoted_text'));

        return redirect()->back()->with('success', 'Note added successfully');
    }

    public function resubmit(Request $request, $id)
    {
        $request->validate([
            'files'   => 'required|array|min:1|max:5',
            'files.*' => 'file|mimes:pdf,doc,docx,png,jpg,jpeg|max:' . StoreDocumentRequest::APP_MAX_UPLOAD_KB,
            'note'    => 'nullable|string|max:500',
        ], [
            'files.required'   => 'Attach at least one corrected or missing file.',
            'files.max'        => 'Attach up to 5 files at a time.',
            'files.*.mimes'    => 'Files must be PDF, Word (DOC/DOCX) or images (PNG/JPG).',
            'files.*.max'      => 'Each file must not be larger than ' . (StoreDocumentRequest::APP_MAX_UPLOAD_KB / 1024) . ' MB.',
            'files.*.uploaded' => 'A file could not be uploaded. The server accepts files up to ' . StoreDocumentRequest::maxUploadLabel() . '.',
        ]);

        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'resubmit', [
            'files' => $request->file('files', []),
            'note'  => $request->input('note'),
        ], $actor, $request->ip());

        $document->loadMissing('currentHolder');

        return redirect()->back()->with('success', 'Correction submitted and sent back to ' . ($document->currentHolder?->name ?? 'the reviewer') . '.');
    }

    public function addAttachment(Request $request, $id)
    {
        $request->validate([
            'file'        => 'required|file|max:' . StoreDocumentRequest::APP_MAX_UPLOAD_KB,
            'description' => 'required|string',
        ], [
            'file.uploaded' => 'The file could not be uploaded. The server accepts files up to ' . StoreDocumentRequest::maxUploadLabel() . '.',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->addAttachment((int) $id, $request->file('file'), $request->description, $actor, $request->ip());

        return redirect()->back()->with('success', 'Attachment added successfully');
    }

    public function export($id, Request $request)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $user = $request->user() ?: auth()->user();
        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid password verification.'], 403);
        }

        // List exports (id 0) only need the password check; the CSV itself is built in the browser
        if ((int) $id === 0) {
            return response()->json(['verified' => true]);
        }

        $document = Document::findOrFail($id);

        // A correction / supporting file attached to the document, or the main document file
        $attachment = $request->filled('attachment_id')
            ? \App\Models\DocumentAttachment::where('document_id', $document->document_id)->findOrFail($request->input('attachment_id'))
            : null;
        $storedPath = $attachment?->file_path ?? $document->attachment_path;

        if (!$storedPath || !Storage::disk('public')->exists($storedPath)) {
            return response()->json(['message' => 'Original document file is not found on disk.'], 404);
        }

        app(AuditTrailServiceInterface::class)->logDocumentAction(
            document: $document,
            action: 'Exported',
            description: $attachment
                ? "Attached file {$attachment->file_name} downloaded after password verification"
                : 'Original document exported after password verification',
            actor: $user,
            ipAddress: $request->ip()
        );

        $filePath = Storage::disk('public')->path($storedPath);
        if ($attachment) {
            return response()->download($filePath, $attachment->file_name);
        }

        $extension = pathinfo($storedPath, PATHINFO_EXTENSION) ?: 'pdf';
        return response()->download($filePath, "Document_{$document->reference_number}.{$extension}");
    }

    public function update(Request $request, $id): RedirectResponse
    {
        $request->validate([
            'title'          => 'sometimes|required|string',
            'classification' => 'sometimes|required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $this->documentService->updateDocument((int) $id, $request->only(['title', 'classification']), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document updated successfully.');
    }

    public function destroy(Request $request, $id): RedirectResponse
    {
        $actor = $request->user() ?: auth()->user();
        $this->documentService->deleteDocument((int) $id, $actor, $request->ip());

        return redirect()->back()->with('success', 'Document deleted successfully.');
    }

    public function getComments(Request $request, $id): JsonResponse
    {
        $comments = DB::table('document_comments')
            ->where('document_id', $id)
            ->join('users', 'document_comments.user_id', '=', 'users.id')
            ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
            ->select(
                'document_comments.*',
                DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"),
                'roles.role_name as user_role'
            )
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($comments);
    }

    public function logAction(Request $request, $id): JsonResponse
    {
        $request->validate([
            'action'      => 'required|string',
            'description' => 'required|string',
        ]);

        $actor = $request->user() ?: auth()->user();
        $document = Document::findOrFail($id);

        app(AuditTrailServiceInterface::class)->logDocumentAction(
            document: $document,
            action: $request->action,
            description: $request->description,
            actor: $actor,
            ipAddress: $request->ip()
        );

        return response()->json(['message' => 'Action logged successfully.']);
    }

    public function getTimelineSync(Request $request, $id): JsonResponse
    {
        $document = Document::with([
            'submitter.role',
            'department',
            'currentHolder.role',
            'currentHolderDepartment',
            'destinationDepartment'
        ])->findOrFail($id);

        $auditTrail = \App\Models\AuditTrail::with(['user.role'])
            ->where('document_id', $id)
            ->orderBy('timestamp', 'desc')
            ->get();

        $comments = DB::table('document_comments')
            ->where('document_id', $id)
            ->join('users', 'document_comments.user_id', '=', 'users.id')
            ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
            ->select(
                'document_comments.*',
                DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"),
                'roles.role_name as user_role'
            )
            ->orderBy('created_at', 'desc')
            ->get();

        $attachments = \App\Models\DocumentAttachment::with(['user.role'])
            ->where('document_id', $id)
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'document' => [
                'document_id'                  => $document->document_id,
                'reference_number'             => $document->reference_number,
                'tracking_number'              => $document->tracking_number,
                'title'                        => $document->title,
                'status'                       => $document->status,
                'current_step_index'           => $document->current_step_index,
                'total_steps'                  => $document->total_steps,
                'is_internal'                  => (bool) $document->is_internal,
                'is_escalated'                 => (bool) $document->is_escalated,
                'return_reason'                => $document->return_reason,
                'submitted_by'                 => $document->submitted_by,
                'submitted_by_name'            => $document->submitter?->name,
                'department_id'                => $document->department_id,
                'department_name'              => $document->department?->department_name,
                'current_holder_id'            => $document->current_holder_id,
                'current_holder_name'          => $document->currentHolder?->name,
                'current_holder_role'          => $document->currentHolder?->role?->role_name,
                'current_holder_department_id' => $document->current_holder_department_id,
                'current_holder_department_name' => $document->currentHolderDepartment?->department_name,
                'destination_department_id'    => $document->destination_department_id,
                'destination_department_name'  => $document->destinationDepartment?->department_name,
                'date_filed'                   => $document->date_filed?->toISOString(),
                'created_at'                   => $document->created_at?->toISOString(),
                'updated_at'                   => $document->updated_at?->toISOString(),
                'completed_at'                 => $document->completed_at?->toISOString(),
            ],
            'status'             => $document->status,
            'return_reason'      => $document->return_reason,
            'current_step_index' => $document->current_step_index,
            'auditTrail'         => $auditTrail,
            'comments'           => $comments,
            'attachments'        => $attachments,
        ]);
    }

    public function trackPublicDocument(Request $request, $trackingNumber): JsonResponse
    {
        $trackingNumber = trim($trackingNumber);
        $document = Document::with([
            'submitter.role',
            'department',
            'destinationDepartment',
            'currentHolderDepartment',
            'currentHolder.role'
        ])
            ->where('tracking_number', $trackingNumber)
            ->orWhere('reference_number', $trackingNumber)
            ->first();

        if (!$document) {
            return response()->json(['message' => 'Document not found'], 404);
        }

        $auditTrail = \App\Models\AuditTrail::with(['user.role'])
            ->where('document_id', $document->document_id)
            ->orderBy('timestamp', 'desc')
            ->get();

        return response()->json([
            'document' => [
                'document_id'                  => $document->document_id,
                'reference_number'             => $document->reference_number,
                'tracking_number'              => $document->tracking_number,
                'title'                        => $document->title,
                'status'                       => $document->status,
                'current_step_index'           => $document->current_step_index,
                'total_steps'                  => $document->total_steps,
                'is_internal'                  => (bool) $document->is_internal,
                'is_escalated'                 => (bool) $document->is_escalated,
                'date_filed'                   => $document->date_filed?->format('F d, Y'),
                'created_at'                   => $document->created_at?->format('F d, Y h:i A'),
                'submitter_name'               => $document->submitter?->name ?? $document->sender ?? 'Public Submitter',
                'department_name'              => $document->department?->department_name,
                'current_holder_department'    => $document->currentHolderDepartment?->department_name ?? 'Receiving Office',
                'current_holder_name'          => $document->currentHolder?->name,
            ],
            'auditTrail' => $auditTrail,
        ]);
    }
}
