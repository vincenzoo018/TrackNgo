<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Document;
use App\Models\DocumentType;
use App\Models\Role;
use App\Models\User;
use App\Models\AuditTrail;
use App\Models\RoutingSlip;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // ── Create Roles ────────────────────────────────────────
        $roles = [
            ['role_name' => 'Admin',           'position' => 'System Administrator'],
            ['role_name' => 'Mayor',           'position' => 'City Mayor'],
            ['role_name' => 'Department Head', 'position' => 'Department Head'],
            ['role_name' => 'CART',            'position' => 'CART Personnel'],
            ['role_name' => 'Receiving Clerk', 'position' => 'Receiving Clerk'],
            ['role_name' => 'HR',              'position' => 'HR Manager'],
        ];

        foreach ($roles as $roleData) {
            Role::firstOrCreate(
                ['role_name' => $roleData['role_name']],
                $roleData
            );
        }

        // ── Create Document Types ────────────────────────────────
        $docTypes = [
            ['type_name' => 'Executive Order',   'description' => 'Directives from the Mayor',    'arta_processing_days' => 3],
            ['type_name' => 'Memorandum',        'description' => 'Internal office memo',          'arta_processing_days' => 5],
            ['type_name' => 'Travel Order',      'description' => 'Official travel request',       'arta_processing_days' => 7],
            ['type_name' => 'Voucher',           'description' => 'Financial disbursement',        'arta_processing_days' => 5],
            ['type_name' => 'Resolution',        'description' => 'Legislative resolution',        'arta_processing_days' => 10],
            ['type_name' => 'Ordinance',         'description' => 'City ordinance',                'arta_processing_days' => 15],
            ['type_name' => 'Communication',     'description' => 'Official correspondence',       'arta_processing_days' => 3],
            ['type_name' => 'Report',            'description' => 'Accomplishment/status report',  'arta_processing_days' => 5],
        ];

        foreach ($docTypes as $docData) {
            DocumentType::firstOrCreate(
                ['type_name' => $docData['type_name']],
                $docData
            );
        }

        // ── Create Departments (with codes) ──────────────────────
        $departmentsData = [
            ['name' => 'Office of the City Mayor',                           'code' => 'OCM'],
            ['name' => 'Office of the City Administrator',                   'code' => 'OCA'],
            ['name' => 'Office of the Executive Assistant',                  'code' => 'OEA'],
            ['name' => 'Office of the Secretary to the Mayor',               'code' => 'OSM'],
            ['name' => 'City Legal Office',                                  'code' => 'CLO'],
            ['name' => 'City Planning and Development Office',               'code' => 'CPDO'],
            ['name' => 'City Budget Office',                                 'code' => 'CBO'],
            ['name' => "City Accountant's Office",                           'code' => 'CAO'],
            ['name' => "City Treasurer's Office",                            'code' => 'CTO'],
            ['name' => "City Assessor's Office",                             'code' => 'CASSO'],
            ['name' => "City Engineer's Office",                             'code' => 'CEO'],
            ['name' => "City Architect's Office",                            'code' => 'CARCO'],
            ['name' => 'City General Services Office',                       'code' => 'CGSO'],
            ['name' => 'City Human Resource Management Office',              'code' => 'CHRMO'],
            ['name' => "City Civil Registrar's Office",                      'code' => 'CCRO'],
            ['name' => 'City Health Office',                                 'code' => 'CHO'],
            ['name' => 'City Social Welfare and Development Office',         'code' => 'CSWDO'],
            ['name' => 'City Agriculture Office',                            'code' => 'CAGRO'],
            ['name' => 'City Veterinary Office',                             'code' => 'CVO'],
            ['name' => 'City Environment and Natural Resources Office (CENRO)', 'code' => 'CENRO'],
            ['name' => 'City Disaster Risk Reduction and Management Office (CDRRMO)', 'code' => 'CDRRMO'],
            ['name' => 'Public Employment Service Office (PESO)',            'code' => 'PESO'],
            ['name' => 'Business Permits and Licensing Office (BPLO)',       'code' => 'BPLO'],
            ['name' => 'City Tourism Office',                                'code' => 'CTMO'],
            ['name' => 'City Information Office',                            'code' => 'CIO'],
            ['name' => 'Information and Communications Technology (ICT) Office', 'code' => 'ICT'],
            ['name' => 'City Cooperative Development Office',                'code' => 'CCDO'],
            ['name' => 'City Population Office',                             'code' => 'CPO'],
            ['name' => 'Economic Enterprise Office',                         'code' => 'EEO'],
            ['name' => 'Local Civil Registry',                               'code' => 'LCR'],
            ['name' => 'Local Youth Development Office',                     'code' => 'LYDO'],
            ['name' => 'Gender and Development (GAD) Office',                'code' => 'GAD'],
            ['name' => "Persons with Disability Affairs Office (PDAO)",      'code' => 'PDAO'],
            ['name' => 'Senior Citizens Affairs Office (OSCA)',              'code' => 'OSCA'],
            ['name' => 'Indigenous Peoples Mandatory Representative (IPMR) Office', 'code' => 'IPMR'],
            ['name' => 'Local Housing Office',                               'code' => 'LHO'],
            ['name' => 'City Nutrition Office',                              'code' => 'CNO'],
            ['name' => 'City Library',                                       'code' => 'CLIB'],
            ['name' => 'City Sports Development Office',                     'code' => 'CSDO'],
            ['name' => 'Cultural Affairs Office',                            'code' => 'CAFFO'],
            ['name' => 'Investment and Promotions Office',                   'code' => 'IPO'],
            ['name' => 'Public Information and Communications Office',       'code' => 'PICO'],
            ['name' => 'Bids and Awards Committee (BAC) Secretariat',        'code' => 'BAC'],
            ['name' => 'Internal Audit Office',                              'code' => 'IAO'],
            ['name' => 'Supply and Property Management Unit',                'code' => 'SPMU'],
            ['name' => 'Records Management Unit',                           'code' => 'RMU'],
            ['name' => 'Motor Pool Unit',                                    'code' => 'MPU'],
            ['name' => 'Maintenance and General Services Unit',              'code' => 'MGSU'],
            ['name' => 'Public Complaints and Action Center',                'code' => 'PCAC'],
            ['name' => 'Protocol and Special Events Office',                 'code' => 'PSEO'],
            ['name' => 'Peace and Order and Public Safety Office',           'code' => 'POPSO'],
            ['name' => 'Anti-Drug Abuse Council Secretariat',                'code' => 'ADACS'],
            ['name' => 'Local Economic Development and Investment Promotions Office', 'code' => 'LEDIPO'],
            ['name' => 'Traffic Management Office',                          'code' => 'TMO'],
            ['name' => 'Market Administration Office',                       'code' => 'MAO'],
            ['name' => 'Slaughterhouse Management Office',                   'code' => 'SMO'],
            ['name' => 'Cemetery Management Office',                         'code' => 'CMTO'],
            ['name' => 'Solid Waste Management Office',                      'code' => 'SWMO'],
            ['name' => 'Coastal Resource Management Office',                 'code' => 'CRMO'],
            ['name' => 'Tourism Promotions and Events Unit',                 'code' => 'TPEU'],
        ];

        foreach ($departmentsData as $deptData) {
            Department::firstOrCreate(
                ['department_name' => $deptData['name']],
                [
                    'department_name' => $deptData['name'],
                    'code'            => $deptData['code'],
                    'description'     => $deptData['name'],
                    'is_active'       => true,
                ]
            );
        }

        // ── Create Users with department assignments ─────────────
        $ocaDept    = Department::where('code', 'OCA')->first();
        $ceoDept    = Department::where('code', 'CEO')->first();
        $choDept    = Department::where('code', 'CHO')->first();
        $cboDept    = Department::where('code', 'CBO')->first();
        $chrmoDept  = Department::where('code', 'CHRMO')->first();
        $cswdoDept  = Department::where('code', 'CSWDO')->first();
        $cpdoDept   = Department::where('code', 'CPDO')->first();
        $ocmDept    = Department::where('code', 'OCM')->first();

        $users = [
            [
                'name'          => 'System Admin',
                'email'         => 'admin@mati.com',
                'password'      => 'password123',
                'role'          => 'Admin',
                'department_id' => $ocmDept->department_id ?? null,
            ],
            [
                'name'          => 'Hon. Michelle N. Rabat',
                'email'         => 'mayor@mati.com',
                'password'      => 'password123',
                'role'          => 'Mayor',
                'department_id' => $ocmDept->department_id ?? null,
            ],
            [
                'name'          => 'Engr. Ricardo Dela Cruz',
                'email'         => 'departmenthead@mati.com',
                'password'      => 'password123',
                'role'          => 'Department Head',
                'department_id' => $ceoDept->department_id ?? null,
            ],
            [
                'name'          => 'Maria Santos',
                'email'         => 'cart@mati.com',
                'password'      => 'password123',
                'role'          => 'CART',
                'department_id' => $ocaDept->department_id ?? null,
            ],
            [
                'name'          => 'Juan Reyes',
                'email'         => 'receivingclerk@mati.com',
                'password'      => 'password123',
                'role'          => 'Receiving Clerk',
                'department_id' => $ocaDept->department_id ?? null,
            ],
            [
                'name'          => 'Ana Gonzales',
                'email'         => 'hr@mati.com',
                'password'      => 'password123',
                'role'          => 'HR',
                'department_id' => $chrmoDept->department_id ?? null,
            ],
        ];

        // Additional department head users for different departments
        $additionalDeptHeads = [
            ['name' => 'Dr. Elena Pascual',      'email' => 'depthead.cho@mati.com',   'dept' => $choDept],
            ['name' => 'Atty. Jose Villanueva',   'email' => 'depthead.cbo@mati.com',   'dept' => $cboDept],
            ['name' => 'Rosa Aquino',             'email' => 'depthead.cswdo@mati.com', 'dept' => $cswdoDept],
            ['name' => 'Engr. Mark Tan',          'email' => 'depthead.cpdo@mati.com',  'dept' => $cpdoDept],
        ];

        foreach ($users as $userData) {
            $role = Role::where('role_name', $userData['role'])->first();

            User::firstOrCreate(
                ['email' => $userData['email']],
                [
                    'name'          => $userData['name'],
                    'email'         => $userData['email'],
                    'password'      => Hash::make($userData['password']),
                    'role_id'       => $role->role_id,
                    'department_id' => $userData['department_id'],
                ]
            );
        }

        $deptHeadRole = Role::where('role_name', 'Department Head')->first();
        foreach ($additionalDeptHeads as $dhData) {
            User::firstOrCreate(
                ['email' => $dhData['email']],
                [
                    'name'          => $dhData['name'],
                    'email'         => $dhData['email'],
                    'password'      => Hash::make('password123'),
                    'role_id'       => $deptHeadRole->role_id,
                    'department_id' => $dhData['dept']->department_id ?? null,
                ]
            );
        }

        // Assign department heads
        if ($ceoDept && ($dh = User::where('email', 'departmenthead@mati.com')->first())) {
            $ceoDept->update(['head_id' => $dh->id]);
        }
        if ($choDept && ($dh = User::where('email', 'depthead.cho@mati.com')->first())) {
            $choDept->update(['head_id' => $dh->id]);
        }
        if ($cboDept && ($dh = User::where('email', 'depthead.cbo@mati.com')->first())) {
            $cboDept->update(['head_id' => $dh->id]);
        }
        if ($cswdoDept && ($dh = User::where('email', 'depthead.cswdo@mati.com')->first())) {
            $cswdoDept->update(['head_id' => $dh->id]);
        }
        if ($cpdoDept && ($dh = User::where('email', 'depthead.cpdo@mati.com')->first())) {
            $cpdoDept->update(['head_id' => $dh->id]);
        }

        // ── Seed Documents ────────────────────────────────────────
        $this->seedDocuments();
    }

    private function seedDocuments(): void
    {
        $receivingClerk = User::where('email', 'receivingclerk@mati.com')->first();
        $ceoDeptHead    = User::where('email', 'departmenthead@mati.com')->first();
        $choDeptHead    = User::where('email', 'depthead.cho@mati.com')->first();
        $cboDeptHead    = User::where('email', 'depthead.cbo@mati.com')->first();
        $cswdoDeptHead  = User::where('email', 'depthead.cswdo@mati.com')->first();
        $cpdoDeptHead   = User::where('email', 'depthead.cpdo@mati.com')->first();

        $typeIds = DocumentType::pluck('type_id', 'type_name')->toArray();

        // Departments to seed documents for
        $seedDepts = [
            'CEO', 'CHO', 'CBO', 'CSWDO', 'CPDO', 'OCM', 'OCA', 'CENRO', 'BPLO', 'CLO',
        ];

        $deptModels = Department::whereIn('code', $seedDepts)->get()->keyBy('code');

        // Track per-department sequence for ascending ref numbers
        $deptSeq = [];
        // Global tracking number counter
        $trackingSeq = 0;

        $statuses = ['submitted', 'in_review', 'endorsed', 'approved', 'completed'];

        // Document seed data — realistic titles per department
        $documentsData = [
            // CEO — City Engineer's Office (5 documents)
            ['dept' => 'CEO', 'title' => 'Road Repair Request – Brgy. Sainz Main Road',          'type' => 'Memorandum',     'status' => 'submitted',  'days_ago' => 85, 'step' => 1],
            ['dept' => 'CEO', 'title' => 'Bridge Construction Status Report Q1 2026',             'type' => 'Report',         'status' => 'in_review',  'days_ago' => 72, 'step' => 2],
            ['dept' => 'CEO', 'title' => 'Drainage System Improvement – Barangay Central',        'type' => 'Voucher',        'status' => 'endorsed',   'days_ago' => 58, 'step' => 3],
            ['dept' => 'CEO', 'title' => 'Building Permit Application – SM City Mati',            'type' => 'Communication',  'status' => 'approved',   'days_ago' => 30, 'step' => 4],
            ['dept' => 'CEO', 'title' => 'Heavy Equipment Procurement Request FY2026',            'type' => 'Voucher',        'status' => 'completed',  'days_ago' => 15, 'step' => 5],

            // CHO — City Health Office (4 documents)
            ['dept' => 'CHO', 'title' => 'Dengue Prevention Program Proposal',                    'type' => 'Memorandum',     'status' => 'submitted',  'days_ago' => 80, 'step' => 1],
            ['dept' => 'CHO', 'title' => 'Medical Supply Requisition – Rural Health Units',       'type' => 'Voucher',        'status' => 'in_review',  'days_ago' => 65, 'step' => 2],
            ['dept' => 'CHO', 'title' => 'Monthly Morbidity Report – June 2026',                  'type' => 'Report',         'status' => 'endorsed',   'days_ago' => 40, 'step' => 3],
            ['dept' => 'CHO', 'title' => 'COVID-19 Booster Drive Memorandum',                     'type' => 'Executive Order','status' => 'completed',  'days_ago' => 10, 'step' => 5],

            // CBO — City Budget Office (4 documents)
            ['dept' => 'CBO', 'title' => 'Supplemental Budget No. 3 FY2026',                      'type' => 'Resolution',     'status' => 'submitted',  'days_ago' => 78, 'step' => 1],
            ['dept' => 'CBO', 'title' => 'Annual Investment Program Review',                      'type' => 'Report',         'status' => 'in_review',  'days_ago' => 60, 'step' => 2],
            ['dept' => 'CBO', 'title' => 'Budget Realignment Request – Disaster Fund',            'type' => 'Memorandum',     'status' => 'approved',   'days_ago' => 35, 'step' => 4],
            ['dept' => 'CBO', 'title' => 'Obligation Request – Capital Outlay Q2',                'type' => 'Voucher',        'status' => 'completed',  'days_ago' => 12, 'step' => 5],

            // CSWDO — Social Welfare (4 documents)
            ['dept' => 'CSWDO', 'title' => 'Solo Parent ID Distribution Schedule',                'type' => 'Memorandum',     'status' => 'submitted',  'days_ago' => 75, 'step' => 1],
            ['dept' => 'CSWDO', 'title' => 'Emergency Assistance Fund Liquidation Report',        'type' => 'Report',         'status' => 'endorsed',   'days_ago' => 50, 'step' => 3],
            ['dept' => 'CSWDO', 'title' => 'Pantawid Pamilya Compliance Monitoring',              'type' => 'Communication',  'status' => 'in_review',  'days_ago' => 28, 'step' => 2],
            ['dept' => 'CSWDO', 'title' => 'AICS Beneficiary Master List – July 2026',            'type' => 'Report',         'status' => 'completed',  'days_ago' => 5,  'step' => 5],

            // CPDO — Planning and Development (3 documents)
            ['dept' => 'CPDO', 'title' => 'Comprehensive Land Use Plan Update 2026-2030',         'type' => 'Resolution',     'status' => 'in_review',  'days_ago' => 70, 'step' => 2],
            ['dept' => 'CPDO', 'title' => 'Zoning Clearance Application – Purok 7',               'type' => 'Communication',  'status' => 'endorsed',   'days_ago' => 45, 'step' => 3],
            ['dept' => 'CPDO', 'title' => 'Development Permit – Commercial Complex',              'type' => 'Memorandum',     'status' => 'approved',   'days_ago' => 20, 'step' => 4],

            // OCM — Office of the City Mayor (3 documents)
            ['dept' => 'OCM', 'title' => 'Executive Order No. 2026-045: ARTA Compliance',         'type' => 'Executive Order','status' => 'approved',   'days_ago' => 60, 'step' => 4],
            ['dept' => 'OCM', 'title' => 'Appointment of OIC – City Health Officer',               'type' => 'Executive Order','status' => 'completed',  'days_ago' => 25, 'step' => 5],
            ['dept' => 'OCM', 'title' => 'Declaration of Calamity State – Tropical Storm Aghon',  'type' => 'Executive Order','status' => 'completed',  'days_ago' => 8,  'step' => 5],

            // OCA — Office of the City Administrator (3 documents)
            ['dept' => 'OCA', 'title' => 'Inter-Office Coordination Meeting Memo',                'type' => 'Memorandum',     'status' => 'submitted',  'days_ago' => 68, 'step' => 1],
            ['dept' => 'OCA', 'title' => 'Performance Evaluation Schedule – Q2 2026',             'type' => 'Communication',  'status' => 'endorsed',   'days_ago' => 42, 'step' => 3],
            ['dept' => 'OCA', 'title' => 'Official Travel Order – DILG Conference Manila',        'type' => 'Travel Order',   'status' => 'approved',   'days_ago' => 18, 'step' => 4],

            // CENRO (3 documents)
            ['dept' => 'CENRO', 'title' => 'Tree Cutting Permit Application – Lot 12 Brgy. Badas', 'type' => 'Communication', 'status' => 'submitted', 'days_ago' => 62, 'step' => 1],
            ['dept' => 'CENRO', 'title' => 'Environmental Compliance Certificate – Mining Ops',    'type' => 'Report',        'status' => 'in_review', 'days_ago' => 38, 'step' => 2],
            ['dept' => 'CENRO', 'title' => 'Coastal Cleanup Activity Report – July 2026',         'type' => 'Report',        'status' => 'completed', 'days_ago' => 7,  'step' => 5],

            // BPLO (3 documents)
            ['dept' => 'BPLO', 'title' => 'Business Permit Renewal – Gaisano Mall Mati',          'type' => 'Communication',  'status' => 'endorsed',   'days_ago' => 55, 'step' => 3],
            ['dept' => 'BPLO', 'title' => 'Fire Safety Compliance Report – Downtown Area',        'type' => 'Report',         'status' => 'in_review',  'days_ago' => 32, 'step' => 2],
            ['dept' => 'BPLO', 'title' => 'New Business Application – Pharmacy – Brgy. Matiao',   'type' => 'Communication',  'status' => 'submitted',  'days_ago' => 3,  'step' => 1],

            // CLO — City Legal Office (3 documents)
            ['dept' => 'CLO', 'title' => 'Legal Opinion – Boundary Dispute Brgy. Sainz vs Dawan', 'type' => 'Communication',  'status' => 'submitted',  'days_ago' => 48, 'step' => 1],
            ['dept' => 'CLO', 'title' => 'MOA Review – Sister City Agreement with Tagum',         'type' => 'Memorandum',     'status' => 'endorsed',   'days_ago' => 22, 'step' => 3],
            ['dept' => 'CLO', 'title' => 'Ordinance Draft – Curfew for Minors 2026',              'type' => 'Ordinance',      'status' => 'in_review',  'days_ago' => 14, 'step' => 2],
        ];

        // Map department heads to their departments
        $deptHeadMap = [
            'CEO'   => $ceoDeptHead,
            'CHO'   => $choDeptHead,
            'CBO'   => $cboDeptHead,
            'CSWDO' => $cswdoDeptHead,
            'CPDO'  => $cpdoDeptHead,
        ];

        foreach ($documentsData as $docData) {
            $deptCode = $docData['dept'];
            $dept = $deptModels[$deptCode] ?? null;
            if (!$dept) continue;

            // Track ascending sequence per department
            if (!isset($deptSeq[$deptCode])) {
                $deptSeq[$deptCode] = 0;
            }
            $deptSeq[$deptCode]++;

            $trackingSeq++;

            $refNumber      = $deptCode . '-2026-' . str_pad($deptSeq[$deptCode], 4, '0', STR_PAD_LEFT);
            $trackingNumber = 'RS-2026-' . str_pad($trackingSeq, 4, '0', STR_PAD_LEFT);

            $dateFiled = now()->subDays($docData['days_ago']);

            // Determine submitter — receiving clerk for most, dept heads for their own dept docs
            $submitter = $receivingClerk;
            if (isset($deptHeadMap[$deptCode])) {
                // 50% chance it was submitted by the dept head themselves
                $submitter = ($deptSeq[$deptCode] % 2 === 0) ? $deptHeadMap[$deptCode] : $receivingClerk;
            }

            $typeId = $typeIds[$docData['type']] ?? $typeIds['Memorandum'];

            // Determine current holder based on status
            $currentHolderDeptId = $dept->department_id;
            $currentHolderId = null;

            if (in_array($docData['status'], ['approved', 'completed'])) {
                // Document made it to Mayor
                $currentHolderDeptId = $deptModels['OCM']->department_id ?? $dept->department_id;
            } elseif ($docData['status'] === 'endorsed') {
                // With a different department or Mayor's office
                $currentHolderDeptId = $deptModels['OCA']->department_id ?? $dept->department_id;
            }

            $document = Document::create([
                'reference_number'            => $refNumber,
                'tracking_number'             => $trackingNumber,
                'title'                       => $docData['title'],
                'submitted_by'                => $submitter->id,
                'department_id'               => $dept->department_id,
                'type_id'                     => $typeId,
                'classification'              => 'normal',
                'status'                      => $docData['status'],
                'current_step_index'          => $docData['step'],
                'total_steps'                 => 5,
                'sender'                      => $submitter->name,
                'current_holder_department_id' => $currentHolderDeptId,
                'current_holder_id'           => $currentHolderId,
                'date_filed'                  => $dateFiled,
                'submitted_at'                => $dateFiled,
                'completed_at'                => $docData['status'] === 'completed' ? $dateFiled->copy()->addDays(rand(2, 7)) : null,
            ]);

            // Create initial audit trail
            AuditTrail::create([
                'document_id'  => $document->document_id,
                'document_ref' => $refNumber,
                'user_id'      => $submitter->id,
                'action'       => 'submitted',
                'description'  => 'Document submitted to ' . $dept->department_name,
                'timestamp'    => $dateFiled,
            ]);

            // Create initial routing slip
            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => $trackingNumber,
                'from_user_id'         => $submitter->id,
                'from_department_id'   => $submitter->department_id,
                'target_department_id' => $dept->department_id,
                'sender_name'          => $submitter->name,
                'action'               => 'forward',
                'instruction'          => 'For review and appropriate action.',
                'status'               => 'completed',
            ]);

            // Add extra audit trail entries for progressed documents
            if ($docData['step'] >= 2) {
                AuditTrail::create([
                    'document_id'  => $document->document_id,
                    'document_ref' => $refNumber,
                    'user_id'      => $deptHeadMap[$deptCode]->id ?? $submitter->id,
                    'action'       => 'reviewed',
                    'description'  => 'Document reviewed by ' . ($deptHeadMap[$deptCode]->name ?? 'Department Head'),
                    'timestamp'    => $dateFiled->copy()->addDays(rand(1, 3)),
                ]);
            }

            if ($docData['step'] >= 3) {
                AuditTrail::create([
                    'document_id'  => $document->document_id,
                    'document_ref' => $refNumber,
                    'user_id'      => $deptHeadMap[$deptCode]->id ?? $submitter->id,
                    'action'       => 'endorsed',
                    'description'  => 'Document endorsed and forwarded',
                    'timestamp'    => $dateFiled->copy()->addDays(rand(3, 5)),
                ]);
            }

            if ($docData['step'] >= 4) {
                $mayor = User::where('email', 'mayor@mati.com')->first();
                AuditTrail::create([
                    'document_id'  => $document->document_id,
                    'document_ref' => $refNumber,
                    'user_id'      => $mayor->id ?? $submitter->id,
                    'action'       => 'approved',
                    'description'  => 'Document approved by the Mayor',
                    'timestamp'    => $dateFiled->copy()->addDays(rand(5, 8)),
                ]);
            }

            if ($docData['step'] >= 5) {
                AuditTrail::create([
                    'document_id'  => $document->document_id,
                    'document_ref' => $refNumber,
                    'user_id'      => $submitter->id,
                    'action'       => 'completed',
                    'description'  => 'Document processing completed',
                    'timestamp'    => $dateFiled->copy()->addDays(rand(8, 12)),
                ]);
            }
        }
    }
}
