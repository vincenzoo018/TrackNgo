<?php
$models = [
    'Department' => [
        'table' => 'departments',
        'primaryKey' => 'department_id',
        'content' => "
    protected \$primaryKey = 'department_id';
    protected \$fillable = ['department_name'];
    public function users() { return \$this->hasMany(User::class, 'department_id', 'department_id'); }
    public function documents() { return \$this->hasMany(Document::class, 'department_id', 'department_id'); }
        "
    ],
    'DocumentType' => [
        'table' => 'document_types',
        'primaryKey' => 'type_id',
        'content' => "
    protected \$primaryKey = 'type_id';
    protected \$fillable = ['type_name', 'arta_days'];
    public function documents() { return \$this->hasMany(Document::class, 'type_id', 'type_id'); }
        "
    ],
    'Document' => [
        'table' => 'documents',
        'primaryKey' => 'document_id',
        'content' => "
    protected \$primaryKey = 'document_id';
    protected \$fillable = ['reference_number', 'title', 'submitted_by', 'department_id', 'type_id', 'attachment_path', 'current_step_index', 'is_escalated', 'date_filed'];
    protected \$casts = ['date_filed' => 'datetime'];
    
    public function submitter() { return \$this->belongsTo(User::class, 'submitted_by', 'id'); }
    public function department() { return \$this->belongsTo(Department::class, 'department_id', 'department_id'); }
    public function type() { return \$this->belongsTo(DocumentType::class, 'type_id', 'type_id'); }
    public function routingSlips() { return \$this->hasMany(RoutingSlip::class, 'document_id', 'document_id'); }
    public function auditTrails() { return \$this->hasMany(AuditTrail::class, 'document_id', 'document_id'); }
    public function escalations() { return \$this->hasMany(ArtaEscalation::class, 'document_id', 'document_id'); }
    public function signatures() { return \$this->hasMany(DigitalSignature::class, 'document_id', 'document_id'); }
        "
    ],
    'ReportLog' => [
        'table' => 'report_logs',
        'primaryKey' => 'report_id',
        'content' => "
    protected \$primaryKey = 'report_id';
    protected \$fillable = ['generated_by', 'report_type', 'date_from', 'date_to', 'generated_at'];
    protected \$casts = ['date_from' => 'date', 'date_to' => 'date', 'generated_at' => 'datetime'];
    
    public function user() { return \$this->belongsTo(User::class, 'generated_by', 'id'); }
        "
    ],
    'RoutingSlip' => [
        'table' => 'routing_slips',
        'primaryKey' => 'slip_id',
        'content' => "
    protected \$primaryKey = 'slip_id';
    protected \$fillable = ['document_id', 'tracking_number', 'received_by', 'date_received', 'sender_name', 'action_instruction', 'target_department_id', 'noted_by', 'slip_status'];
    protected \$casts = ['date_received' => 'datetime'];
    
    public function document() { return \$this->belongsTo(Document::class, 'document_id', 'document_id'); }
    public function receiver() { return \$this->belongsTo(User::class, 'received_by', 'id'); }
    public function targetDepartment() { return \$this->belongsTo(Department::class, 'target_department_id', 'department_id'); }
    public function noter() { return \$this->belongsTo(User::class, 'noted_by', 'id'); }
        "
    ],
    'DigitalSignature' => [
        'table' => 'digital_signatures',
        'primaryKey' => 'signature_id',
        'content' => "
    protected \$primaryKey = 'signature_id';
    protected \$fillable = ['document_id', 'signed_by_user_id', 'signature_image', 'signature_hash', 'action_type', 'signed_at'];
    protected \$casts = ['signed_at' => 'datetime'];
    
    public function document() { return \$this->belongsTo(Document::class, 'document_id', 'document_id'); }
    public function signer() { return \$this->belongsTo(User::class, 'signed_by_user_id', 'id'); }
        "
    ],
    'AuditTrail' => [
        'table' => 'audit_trail',
        'primaryKey' => 'audit_id',
        'content' => "
    protected \$primaryKey = 'audit_id';
    protected \$fillable = ['document_id', 'user_id', 'action', 'details', 'timestamp'];
    protected \$casts = ['timestamp' => 'datetime'];
    
    public function document() { return \$this->belongsTo(Document::class, 'document_id', 'document_id'); }
    public function user() { return \$this->belongsTo(User::class, 'user_id', 'id'); }
        "
    ],
    'ArtaEscalation' => [
        'table' => 'arta_escalations',
        'primaryKey' => 'escalation_id',
        'content' => "
    protected \$primaryKey = 'escalation_id';
    protected \$fillable = ['document_id', 'arta_threshold', 'days_elapsed', 'escalation_level', 'notified_user_id', 'notification_sent', 'resolved', 'escalated_at', 'resolved_at'];
    protected \$casts = ['escalated_at' => 'datetime', 'resolved_at' => 'datetime', 'notification_sent' => 'boolean', 'resolved' => 'boolean'];
    
    public function document() { return \$this->belongsTo(Document::class, 'document_id', 'document_id'); }
    public function notifiedUser() { return \$this->belongsTo(User::class, 'notified_user_id', 'id'); }
        "
    ]
];

$modelsDir = 'c:/Users/Huawei/TrackNgo/app/Models';
foreach ($models as $name => $data) {
    $classFile = $modelsDir . '/' . $name . '.php';
    $content = "<?php\n\nnamespace App\Models;\n\nuse Illuminate\Database\Eloquent\Factories\HasFactory;\nuse Illuminate\Database\Eloquent\Model;\n\nclass {$name} extends Model\n{\n    use HasFactory;\n\n    protected \$table = '{$data['table']}';\n{$data['content']}\n}\n";
    file_put_contents($classFile, $content);
}

// Modify User.php
$userFile = $modelsDir . '/User.php';
if (file_exists($userFile)) {
    $userContent = file_get_contents($userFile);
    if (strpos($userContent, 'public function role') === false) {
        $relationships = "
    public function role() { return \$this->belongsTo(Role::class, 'role_id', 'role_id'); }
    public function department() { return \$this->belongsTo(Department::class, 'department_id', 'department_id'); }
    public function submittedDocuments() { return \$this->hasMany(Document::class, 'submitted_by', 'id'); }
    public function receivedSlips() { return \$this->hasMany(RoutingSlip::class, 'received_by', 'id'); }
    public function signatures() { return \$this->hasMany(DigitalSignature::class, 'signed_by_user_id', 'id'); }
";
        $userContent = preg_replace('/(}\s*)$/', $relationships . "\n$1", $userContent);
        file_put_contents($userFile, $userContent);
    }
}

$controllers = [
    'DocumentController' => "
namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function index()
    {
        \$documents = Document::with(['submitter', 'department', 'type'])->get();
        return response()->json(\$documents);
    }

    public function show(\$id)
    {
        \$document = Document::with(['submitter', 'department', 'type', 'routingSlips', 'auditTrails', 'signatures'])->findOrFail(\$id);
        return response()->json(\$document);
    }
}
",
    'WorkflowController' => "
namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\AuditTrail;
use Illuminate\Http\Request;
use Carbon\Carbon;

class WorkflowController extends Controller
{
    // Feature 1: Built-in Commenting & Rejection Reasons (using Audit_Trail)
    public function returnDocument(Request \$request, \$document_id)
    {
        \$request->validate([
            'reason' => 'required|string',
            'user_id' => 'required|integer'
        ]);

        \$document = Document::findOrFail(\$document_id);
        
        // Log the return with comment in audit trail
        AuditTrail::create([
            'document_id' => \$document_id,
            'user_id' => \$request->user_id,
            'action' => 'RETURNED_WITH_COMMENT',
            'details' => \$request->reason,
            'timestamp' => Carbon::now()
        ]);

        return response()->json(['message' => 'Document returned successfully with comments']);
    }

    public function getDocumentComments(\$document_id)
    {
        // Fetch only comment/rejection trails for the thread UI
        \$comments = AuditTrail::where('document_id', \$document_id)
            ->where('action', 'RETURNED_WITH_COMMENT')
            ->with('user')
            ->orderBy('timestamp', 'asc')
            ->get();
            
        return response()->json(\$comments);
    }
}
",
    'SignatureController' => "
namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\DigitalSignature;
use App\Models\ArtaEscalation;
use Illuminate\Http\Request;
use Carbon\Carbon;

class SignatureController extends Controller
{
    // Feature 3: Auto-Resolution of ARTA Escalations
    public function applySignature(Request \$request, \$document_id)
    {
        \$request->validate([
            'user_id' => 'required|integer',
            'signature_hash' => 'required|string',
            'action_type' => 'required|string'
        ]);

        \$signature = DigitalSignature::create([
            'document_id' => \$document_id,
            'signed_by_user_id' => \$request->user_id,
            'signature_hash' => \$request->signature_hash,
            'action_type' => \$request->action_type,
            'signed_at' => Carbon::now()
        ]);

        // Auto-resolve any pending escalations for this document
        ArtaEscalation::where('document_id', \$document_id)
            ->where('resolved', false)
            ->update([
                'resolved' => true,
                'resolved_at' => Carbon::now()
            ]);

        return response()->json(['message' => 'Signature applied and escalations automatically resolved']);
    }

    // Feature 2: Public Document Authenticator
    public function verifySignature(Request \$request)
    {
        \$request->validate([
            'reference_number' => 'required|string',
            'signature_hash' => 'required|string'
        ]);

        \$document = Document::where('reference_number', \$request->reference_number)->first();
        
        if (!\$document) {
            return response()->json(['valid' => false, 'message' => 'Document not found']);
        }

        \$signature = DigitalSignature::where('document_id', \$document->document_id)
            ->where('signature_hash', \$request->signature_hash)
            ->with('signer')
            ->first();

        if (\$signature) {
            return response()->json([
                'valid' => true, 
                'message' => 'Document is authentic',
                'signed_by' => \$signature->signer->name,
                'signed_at' => \$signature->signed_at
            ]);
        }

        return response()->json(['valid' => false, 'message' => 'Invalid signature or tampered document']);
    }
}
",
    'ReportController' => "
namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\Request;
use Carbon\Carbon;

class ReportController extends Controller
{
    // Feature 4: Predictive SLA Warning Dashboard
    public function getPredictiveWarnings()
    {
        // Get all active documents that aren't escalated yet
        \$activeDocuments = Document::with('type')
            ->where('is_escalated', false)
            ->where('current_step_index', '<', 5) // Assuming 5 is completed
            ->get();

        \$warnings = [];

        foreach (\$activeDocuments as \$doc) {
            if (!\$doc->type) continue;
            
            \$daysAllowed = \$doc->type->arta_days;
            \$deadline = Carbon::parse(\$doc->date_filed)->addWeekdays(\$daysAllowed);
            \$daysLeft = Carbon::now()->diffInWeekdays(\$deadline, false);

            // If there's 1 day or less left, flag it as a critical warning
            if (\$daysLeft <= 1 && \$daysLeft >= 0) {
                \$warnings[] = [
                    'document' => \$doc,
                    'status' => 'Critical Warning',
                    'message' => \"Expiring in {\$daysLeft} day(s)\",
                    'deadline' => \$deadline->format('Y-m-d')
                ];
            }
        }

        return response()->json(\$warnings);
    }
}
"
];

$controllersDir = 'c:/Users/Huawei/TrackNgo/app/Http/Controllers';
foreach ($controllers as $name => $content) {
    $classFile = $controllersDir . '/' . $name . '.php';
    $fileContent = "<?php\n" . $content;
    file_put_contents($classFile, $fileContent);
}

echo 'Models and Controllers generated successfully!';
