<?php

namespace App\Http\Controllers;

use App\Contracts\DocumentServiceInterface;
use App\Http\Requests\StoreDocumentRequest;
use App\Http\Requests\StoreDocumentRevisionRequest;
use App\Models\Document;
use App\Models\DocumentRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use App\Contracts\AuditTrailServiceInterface;
use App\Services\User\DocumentPinService;
use Inertia\Inertia;

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

    public function ocrWorkspace($id)
    {
        return Inertia::render('receiving/documents/OcrWorkspace', [
            'dbDocument' => Document::find($id),
            'documentId' => $id,
        ]);
    }

    /**
     * Role document page ($view comes from the route defaults). Confidential contents — file, text,
     * comments, attachments, signature images — only reach the sender, the people on its route and its
     * signatories; the Receiving Clerk keeps the metadata and the trail for monitoring.
     */
    public function page(Request $request, $id, string $view)
    {
        $user = $request->user() ?: auth()->user();
        $document = Document::with([
            'submitter', 'department', 'type', 'currentHolderDepartment', 'currentHolder', 'client', 'linkedDocument',
            'destinationDepartment', 'destinationUser',
            'routingSlips.fromUser', 'routingSlips.toUser', 'routingSlips.fromDepartment', 'routingSlips.targetDepartment',
            'signatories.user.role', 'signatories.user.department', 'signatories.signature',
        ])->findOrFail($id);
        $canView = $document->contentsVisibleTo($user);
        if ($document->route_based) {
            // Steps for the progress bar and where approving sends it next
            $document->setAttribute('route_info', app(\App\Services\Document\DocumentRoute::class)->present($document));
        }
        // Versions of the main file (for those who may open it) and whether this viewer may edit the details or
        // upload a new version; the server checks again on every request
        $revisions = app(\App\Services\Document\DocumentRevisionService::class);
        $document->setAttribute('revision_info', $canView ? $revisions->present($document) : null);
        $document->setAttribute('abilities', $revisions->abilities($document, $user));

        return Inertia::render($view, [
            'dbDocument'    => $document,
            'dbAuditTrail'  => \App\Models\AuditTrail::with(['user.role', 'user.department'])->where('document_id', $id)->orderBy('timestamp', 'asc')->get(),
            'dbDepartments' => \App\Models\Department::all(),
            // Edit Metadata: the document type list
            'dbDocumentTypes' => \App\Models\DocumentType::orderBy('type_name')->get(['type_id', 'type_name']),
            'dbUsers'       => \App\Models\User::leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
                ->leftJoin('departments', 'users.department_id', '=', 'departments.department_id')
                ->select('users.*', 'roles.role_name', 'departments.department_name')
                ->get(),
            'dbComments'    => $canView ? $this->commentsQuery($id)->get() : [],
            'dbAttachments' => $canView
                ? \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get()
                : [],
        ]);
    }

    /**
     * Save text read from the main document file by OCR in the browser (e.g. "Scan Text" on a document whose
     * text could not be read at upload). Only people who can open the document may set it.
     */
    public function saveOcrText(Request $request, $id): JsonResponse
    {
        $validated = $request->validate([
            'ocr_text' => 'required|string|max:4000000',
        ]);

        $actor = $request->user() ?: auth()->user();
        $document = Document::findOrFail($id);
        if (!$document->contentsVisibleTo($actor)) {
            return response()->json(['message' => 'This document is confidential. Only its sender and recipients can open it.'], 403);
        }

        $text = trim($validated['ocr_text']);
        if ($text !== trim((string) $document->ocr_text)) {
            $document->update(['ocr_text' => $text]);

            app(AuditTrailServiceInterface::class)->logDocumentAction(
                document: $document,
                action: 'OCR Text Updated',
                description: 'Text read from the document file by OCR (' . number_format(mb_strlen($text)) . ' characters).',
                actor: $actor,
                ipAddress: $request->ip()
            );
        }

        return response()->json(['message' => 'OCR text saved.']);
    }

    private function commentsQuery($documentId)
    {
        return DB::table('document_comments')
            ->where('document_id', $documentId)
            ->join('users', 'document_comments.user_id', '=', 'users.id')
            ->leftJoin('roles', 'users.role_id', '=', 'roles.role_id')
            ->select(
                'document_comments.*',
                DB::raw("TRIM(CONCAT_WS(' ', users.first_name, users.middle_name, users.last_name)) as user_name"),
                'roles.role_name as user_role'
            )
            ->orderBy('created_at', 'desc');
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

        $document->loadMissing(['currentHolder', 'currentHolderDepartment', 'destinationUser', 'destinationDepartment']);

        return redirect()->back()
            ->with('success', 'Document submitted successfully. Tracking: ' . $document->tracking_number)
            ->with('created_document', [
                'document_id'      => $document->document_id,
                'reference_number' => $document->reference_number,
                'tracking_number'  => $document->tracking_number,
                'recipient_name'   => $document->currentHolder?->name,
                'recipient_office' => $document->currentHolderDepartment?->department_name,
                // Internal: sits with the Receiving Clerk for registration, then goes to this person
                'is_internal'      => (bool) $document->is_internal,
                'addressee_name'   => $document->destinationUser?->name,
                'addressee_office' => $document->destinationDepartment?->department_name,
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

    /** Route-based documents: approve (and sign, when this stop signs) and send it to the next person on the route. */
    public function approveOnRoute(Request $request, $id)
    {
        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'approveRoute', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document approved.', 'document' => $document]);
        }

        return redirect()->back()->with('success', 'Document approved and sent on its route.');
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
        $stamps = $this->signatureDue((int) $id, $actor);
        $document = $this->documentService->executeWorkflowAction((int) $id, 'endorse', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document endorsed successfully.', 'document' => $document, 'signature_stamped' => $stamps]);
        }

        return redirect()->back()->with('success', 'Document endorsed successfully')->with('signature_stamped', $stamps);
    }

    /** Whether the actor's registered signature will be stamped by this approval (shown back to them). */
    private function signatureDue(int $documentId, $actor): bool
    {
        return \App\Models\DocumentSignatory::where('document_id', $documentId)
            ->where('user_id', $actor->id)
            ->whereNull('signed_at')
            ->exists();
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
        $stamps = $this->signatureDue((int) $id, $actor);
        $document = $this->documentService->executeWorkflowAction((int) $id, 'approveAndRouteToReceiving', $request->all(), $actor, $request->ip());

        if ($request->wantsJson()) {
            return response()->json(['message' => 'Document approved successfully.', 'document' => $document, 'signature_stamped' => $stamps]);
        }

        // Internal documents are completed by the final approval; external ones go to the clerk for release
        $message = $document->is_internal
            ? 'Document approved and completed. It has been returned to the sender.'
            : 'Document approved and routed to Receiving Clerk.';

        return redirect()->back()->with('success', $message)->with('signature_stamped', $stamps);
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
        $stamps = $this->signatureDue((int) $id, $actor);
        $this->documentService->executeWorkflowAction((int) $id, 'forward', $request->all(), $actor, $request->ip());

        return redirect()->back()->with('success', 'Document forwarded successfully')->with('signature_stamped', $stamps);
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
        // mode=version: the corrected main file becomes a new version (earlier versions are kept), with a reason
        if ($request->input('mode') === 'version') {
            Gate::authorize('createRevision', Document::findOrFail($id));
            $request->validate(StoreDocumentRevisionRequest::fileRules('main_file') + [
                'note'     => 'required|string|min:5|max:500',
                'ocr_text' => 'nullable|string',
            ], StoreDocumentRevisionRequest::fileMessages('main_file') + [
                'note.required' => 'Give the reason for the corrected version.',
                'note.min'      => 'Describe the correction in a few words.',
            ]);
        } else {
            $request->validate([
                'files'   => 'required|array|min:1|max:5',
                'files.*' => 'file|mimes:' . implode(',', StoreDocumentRequest::VIEWABLE_TYPES) . '|max:' . StoreDocumentRequest::APP_MAX_UPLOAD_KB,
                'note'    => 'nullable|string|max:500',
            ], [
                'files.required'   => 'Attach at least one corrected or missing file.',
                'files.max'        => 'Attach up to 5 files at a time.',
                'files.*.mimes'    => 'Files must be PDF, Word (.docx) or images (PNG/JPG).',
                'files.*.max'      => 'Each file must not be larger than ' . (StoreDocumentRequest::APP_MAX_UPLOAD_KB / 1024) . ' MB.',
                'files.*.uploaded' => 'A file could not be uploaded. The server accepts files up to ' . StoreDocumentRequest::maxUploadLabel() . '.',
            ]);
        }

        $actor = $request->user() ?: auth()->user();
        $document = $this->documentService->executeWorkflowAction((int) $id, 'resubmit', [
            'files'     => $request->input('mode') === 'version' ? [] : $request->file('files', []),
            'note'      => $request->input('note'),
            'main_file' => $request->input('mode') === 'version' ? $request->file('main_file') : null,
            'ocr_text'  => $request->input('ocr_text'),
        ], $actor, $request->ip());

        $document->loadMissing('currentHolder');

        return redirect()->back()->with('success', 'Correction submitted and sent back to ' . ($document->currentHolder?->name ?? 'the reviewer') . '.');
    }

    public function addAttachment(Request $request, $id)
    {
        $request->validate([
            'file'        => 'required|file|mimes:' . implode(',', StoreDocumentRequest::VIEWABLE_TYPES) . '|max:' . StoreDocumentRequest::APP_MAX_UPLOAD_KB,
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
        // Every download / export asks for the account's document PIN (not the login password)
        $request->validate([
            'pin' => 'required|string|max:12',
        ], [
            'pin.required' => 'Enter your 6-digit document PIN.',
        ]);

        $user = $request->user() ?: auth()->user();
        $check = app(DocumentPinService::class)->check($user, $request->input('pin'));
        if ($check['code'] !== DocumentPinService::OK) {
            return response()->json(['message' => $check['message'], 'code' => $check['code']], $check['code'] === DocumentPinService::LOCKED ? 429 : 403);
        }

        // List exports (id 0) only need the PIN check; the CSV itself is built in the browser
        if ((int) $id === 0) {
            return response()->json(['verified' => true]);
        }

        $document = Document::findOrFail($id);
        if (!$document->contentsVisibleTo($user)) {
            return response()->json(['message' => 'This document is confidential. Only its sender and recipients can download it.'], 403);
        }

        // An earlier version of the main file (revision_id; with variant=signed, the copy signed on that version),
        // the signed copy, a correction / supporting file attached to the document, or the main document file
        $signedCopy = $request->input('variant') === 'signed';
        $revision = $request->filled('revision_id')
            ? DocumentRevision::where('document_id', $document->document_id)->findOrFail($request->input('revision_id'))
            : null;
        $attachment = !$signedCopy && !$revision && $request->filled('attachment_id')
            ? \App\Models\DocumentAttachment::where('document_id', $document->document_id)->findOrFail($request->input('attachment_id'))
            : null;
        $storedPath = match (true) {
            $revision !== null => $signedCopy ? $revision->signed_file_path : $revision->file_path,
            $signedCopy        => $document->signed_file_path,
            default            => $attachment?->file_path ?? $document->attachment_path,
        };

        if (!$storedPath || !Storage::disk('public')->exists($storedPath)) {
            return response()->json(['message' => 'Original document file is not found on disk.'], 404);
        }

        $currentVersion = $document->currentVersionNumber();
        app(AuditTrailServiceInterface::class)->logDocumentAction(
            document: $document,
            action: 'Exported',
            description: match (true) {
                $revision !== null   => ($signedCopy ? "Signed copy of Version {$revision->version_number}" : "Version {$revision->version_number} ({$revision->file_name})")
                    . ' downloaded after password verification',
                $signedCopy          => 'Final signed copy downloaded after password verification',
                $attachment !== null => "Attached file {$attachment->file_name} downloaded after password verification",
                $currentVersion > 1  => "Document (Version {$currentVersion}) exported after password verification",
                default              => 'Original document exported after password verification',
            },
            actor: $user,
            ipAddress: $request->ip()
        );

        $reference = $document->reference_number;
        // Signed copies of Word files stay Word files
        $extension = pathinfo($storedPath, PATHINFO_EXTENSION) ?: 'pdf';
        $downloadName = match (true) {
            $revision !== null   => ($signedCopy ? 'Signed_' : 'Document_') . "{$reference}_v{$revision->version_number}.{$extension}",
            $signedCopy          => "Signed_{$reference}.{$extension}",
            $attachment !== null => $attachment->file_name,
            default              => "Document_{$reference}.{$extension}",
        };

        return response()->download(Storage::disk('public')->path($storedPath), $downloadName);
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
        $document = Document::findOrFail($id);
        if (!$document->contentsVisibleTo($request->user())) {
            return response()->json([]);
        }

        return response()->json($this->commentsQuery($id)->get());
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

        $canView = $document->contentsVisibleTo($request->user());
        $comments = $canView ? $this->commentsQuery($id)->get() : [];
        $attachments = $canView
            ? \App\Models\DocumentAttachment::with(['user.role'])->where('document_id', $id)->orderBy('created_at', 'asc')->get()
            : [];

        return response()->json([
            'document' => [
                'document_id'                  => $document->document_id,
                'reference_number'             => $document->reference_number,
                'tracking_number'              => $document->tracking_number,
                'title'                        => $document->visibleTitle(),
                'status'                       => $document->status,
                'current_step_index'           => $document->current_step_index,
                'total_steps'                  => $document->total_steps,
                'route_based'                  => (bool) $document->route_based,
                'route_info'                   => $document->route_based ? app(\App\Services\Document\DocumentRoute::class)->present($document) : null,
                'is_internal'                  => (bool) $document->is_internal,
                'is_escalated'                 => (bool) $document->is_escalated,
                'return_reason'                => $canView ? $document->return_reason : null,
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
            'return_reason'      => $canView ? $document->return_reason : null,
            'current_step_index' => $document->current_step_index,
            'auditTrail'         => $auditTrail,
            'comments'           => $comments,
            'attachments'        => $attachments,
        ]);
    }

    /** Workflow steps shown on the public tracking page, worded for the public (internal remarks never leave the system) */
    private const PUBLIC_TIMELINE = [
        'submit'                    => 'Submitted',
        'register'                  => 'Registered by the Receiving Office',
        'accepted'                  => 'Received and accepted',
        'review'                    => 'Under review',
        'endorse'                   => 'Forwarded to the next office',
        'forward'                   => 'Forwarded to the next office',
        'approve'                   => 'Approved',
        'return'                    => 'Returned for corrections',
        'resubmitted'               => 'Corrections submitted',
        'digital signature stamped' => 'Signed by an authorized official',
        'all signatures complete'   => 'All required signatures complete',
        'release'                   => 'Released to the applicant',
        'completed'                 => 'Completed',
    ];

    /**
     * Public tracking (QR code / tracking number, no login): status, progress and an office-level timeline only.
     * No staff names, e-mails, phone numbers, IP addresses or remarks are exposed.
     */
    public function trackPublicDocument(Request $request, $trackingNumber): JsonResponse
    {
        $trackingNumber = strtoupper(trim($trackingNumber));
        $document = Document::with(['department', 'currentHolderDepartment'])
            ->where('tracking_number', $trackingNumber)
            ->orWhere('reference_number', $trackingNumber)
            ->first();

        if (!$document) {
            return response()->json(['message' => 'Document not found'], 404);
        }

        $timeline = \App\Models\AuditTrail::where('document_id', $document->document_id)
            ->orderBy('timestamp', 'desc')
            // Several steps can happen within the same second
            ->orderBy('audit_id', 'desc')
            ->get()
            ->filter(fn ($entry) => isset(self::PUBLIC_TIMELINE[strtolower((string) $entry->action)]))
            ->map(fn ($entry) => [
                'action'      => $entry->action,
                'description' => self::PUBLIC_TIMELINE[strtolower((string) $entry->action)],
                // Offices, not people, are shown publicly
                'user_name'   => $entry->department ?: ($entry->user_role ?: 'LGU Office'),
                'user_role'   => $entry->user_role,
                'department'  => $entry->department,
                'timestamp'   => $entry->timestamp?->toIso8601String(),
            ])
            ->values();

        $status = strtolower((string) $document->status);

        return response()->json([
            'document' => [
                'reference_number'          => $document->reference_number,
                'tracking_number'           => $document->tracking_number,
                'title'                     => $document->visibleTitle(),
                'status'                    => $document->status,
                'status_label'              => match ($status) {
                    'completed', 'released' => 'Completed',
                    'approved'              => 'Approved — for release',
                    'returned'              => 'Returned for corrections',
                    'archived'              => 'Archived',
                    default                 => 'In process',
                },
                'current_step_index'        => $document->current_step_index,
                'total_steps'               => $document->total_steps,
                'is_internal'               => (bool) $document->is_internal,
                // ISO timestamps: the page shows them in the viewer's own time zone
                'date_filed'                => $document->date_filed?->toIso8601String(),
                'created_at'                => $document->created_at?->toIso8601String(),
                'completed_at'              => $document->completed_at?->toIso8601String(),
                // External documents are filed for a client; internal ones are shown by office
                'submitter_name'            => $document->is_internal ? $document->department?->department_name : ($document->sender ?: 'Applicant'),
                'department_name'           => $document->department?->department_name,
                'current_holder_department' => in_array($status, ['completed', 'released', 'archived'], true)
                    ? null
                    : ($document->currentHolderDepartment?->department_name ?? 'Receiving Office'),
            ],
            'auditTrail' => $timeline,
        ]);
    }
}
