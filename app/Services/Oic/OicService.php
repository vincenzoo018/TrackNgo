<?php

namespace App\Services\Oic;

use App\Contracts\AuditTrailServiceInterface;
use App\Models\AuditTrail;
use App\Models\Document;
use App\Models\OicDesignation;
use App\Models\RoutingSlip;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Officer-in-Charge / Acting Mayor (LGC Sec. 46). While a written designation is in effect, every document meant
 * for the absent official goes to the designated officer instead, who acts on it (approves, signs, returns, vetoes)
 * with the designation as reference. Documents already waiting for the official are handed over when the
 * designation starts and given back when it ends (OicService::sync runs every five minutes and after each change).
 */
class OicService
{
    /** Roles whose absence can stall documents and may be covered by an OIC */
    public const COVERABLE_ROLES = [OicDesignation::ROLE_MAYOR, OicDesignation::ROLE_DEPARTMENT_HEAD];

    /** @var array<int, OicDesignation|null> official id => designation in effect (per request) */
    private array $active = [];

    /** @var array<int, OicDesignation> document id => designation the current actor acts under (one action) */
    private array $acting = [];

    public function __construct(
        protected AuditTrailServiceInterface $auditTrail
    ) {}

    public function today(): string
    {
        return now()->setTimezone(config('arta.timezone', 'Asia/Manila'))->toDateString();
    }

    /** The designation in effect today for the absent official, if any */
    public function activeFor(User|int|null $official): ?OicDesignation
    {
        $id = $official instanceof User ? $official->id : $official;
        if (!$id) {
            return null;
        }

        return array_key_exists($id, $this->active)
            ? $this->active[$id]
            : $this->active[$id] = OicDesignation::with(['officer.department', 'official', 'department'])
                ->where('designating_user_id', $id)
                ->activeOn($this->today())
                ->latest('id')
                ->first();
    }

    /** Who actually receives a document sent to $official: the OIC while one acts for them */
    public function recipientFor(?User $official): array
    {
        $designation = $official ? $this->activeFor($official) : null;
        $officer = $designation?->officer;

        return [
            'holder'      => $officer && $officer->is_active ? $officer : $official,
            'held_for'    => $officer && $officer->is_active ? $official : null,
            'designation' => $officer && $officer->is_active ? $designation : null,
        ];
    }

    /** The official $actor is acting for on this document (they hold it as OIC), if any */
    public function actingFor(Document $document, User $actor): ?User
    {
        if (!$document->held_for_user_id || (int) $document->current_holder_id !== (int) $actor->id) {
            return null;
        }
        $designation = $this->activeFor($document->held_for_user_id);

        return $designation && (int) $designation->designated_user_id === (int) $actor->id ? $designation->official : null;
    }

    /** The designation under which $actor acts on this document, if they hold it as OIC */
    public function designationFor(Document $document, User $actor): ?OicDesignation
    {
        $official = $this->actingFor($document, $actor);

        return $official ? $this->activeFor($official) : null;
    }

    /**
     * Run one workflow action of $actor on $document: when they act as OIC, every audit entry and signature made
     * during the action carries the designation (the document may move to someone else half-way through).
     */
    public function withActingContext(Document $document, User $actor, callable $action): mixed
    {
        $designation = $this->designationFor($document, $actor);
        if (!$designation) {
            return $action();
        }

        $this->acting[$document->document_id] = $designation;
        try {
            return $action();
        } finally {
            unset($this->acting[$document->document_id]);
        }
    }

    /** The designation the actor of the running action acts under on this document, if any */
    public function actingDesignation(?int $documentId): ?OicDesignation
    {
        return $documentId ? ($this->acting[$documentId] ?? null) : null;
    }

    /** Designations this officer is covering today */
    public function coveredBy(User $officer): Collection
    {
        return OicDesignation::with(['official', 'department'])
            ->where('designated_user_id', $officer->id)
            ->activeOn($this->today())
            ->get();
    }

    public function create(array $data, User $actor, ?string $ip = null): OicDesignation
    {
        $official = User::with(['role', 'department'])->findOrFail($data['designating_user_id']);
        $officer = User::with(['role', 'department'])->findOrFail($data['designated_user_id']);
        $role = $official->role?->role_name;

        if (!in_array($role, self::COVERABLE_ROLES, true)) {
            throw ValidationException::withMessages(['designating_user_id' => 'Only the Mayor or a Department Head can be covered by an Officer-in-Charge.']);
        }
        if ((int) $official->id === (int) $officer->id) {
            throw ValidationException::withMessages(['designated_user_id' => 'The Officer-in-Charge must be a different person.']);
        }
        if (!$officer->is_active || in_array($officer->role?->role_name, ['CART', 'Receiving Clerk'], true)) {
            throw ValidationException::withMessages(['designated_user_id' => 'Choose an active official (not a CART or Receiving Clerk account) as Officer-in-Charge.']);
        }
        if (empty($officer->signature)) {
            throw ValidationException::withMessages(['designated_user_id' => "{$officer->name} has no registered signature yet, so they could not sign for {$official->name}. Ask HR to add it first."]);
        }

        $overlap = OicDesignation::where('designating_user_id', $official->id)
            ->whereNull('ended_at')
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->first();
        if ($overlap) {
            throw ValidationException::withMessages([
                'start_date' => "{$official->name} already has an OIC designation for " . $overlap->start_date->format('M d') . ' – ' . $overlap->end_date->format('M d, Y')
                    . " (Designation Order No. {$overlap->designation_order_number}). End it first or choose other dates.",
            ]);
        }

        $designation = DB::transaction(function () use ($data, $official, $officer, $role, $actor, $ip) {
            $designation = OicDesignation::create([
                'designating_user_id'      => $official->id,
                'designated_user_id'       => $officer->id,
                'role_covered'             => $role,
                'department_id'            => $official->department_id,
                'start_date'               => $data['start_date'],
                'end_date'                 => $data['end_date'],
                'designation_order_number' => trim($data['designation_order_number']),
                'remarks'                  => $data['remarks'] ?? null,
                'created_by'               => $actor->id,
            ]);

            $this->auditTrail->logUserAction(
                action: 'OIC Designated',
                description: "{$officer->name} designated as " . $designation->load('department')->title() . " for {$official->name} from "
                    . $designation->start_date->format('M d, Y') . ' to ' . $designation->end_date->format('M d, Y')
                    . " (Designation Order No. {$designation->designation_order_number}).",
                actor: $actor,
                ipAddress: $ip
            );

            return $designation;
        });

        $this->active = [];
        $this->sync();

        return $designation;
    }

    public function end(OicDesignation $designation, User $actor, ?string $ip = null): void
    {
        if ($designation->ended_at) {
            throw ValidationException::withMessages(['designation' => 'This designation has already ended.']);
        }

        $designation->update(['ended_at' => now(), 'ended_by' => $actor->id]);
        $designation->loadMissing(['official', 'officer', 'department']);
        $this->auditTrail->logUserAction(
            action: 'OIC Designation Ended',
            description: "Designation of {$designation->officer?->name} as {$designation->title()} for {$designation->official?->name} ended by {$actor->name} (Designation Order No. {$designation->designation_order_number}).",
            actor: $actor,
            ipAddress: $ip
        );

        $this->active = [];
        $this->sync();
    }

    /** Page loads move documents for designations that started / ended today, at most every five minutes */
    public function syncIfDue(): void
    {
        if (\Illuminate\Support\Facades\Cache::add('oic:sync', true, 300)) {
            $this->sync();
        }
    }

    /**
     * Documents follow the designations in effect today: those held for an official whose OIC no longer acts go
     * back to the official, and those waiting for an official who is now covered go to the OIC.
     *
     * @return array{handed_over: int, given_back: int}
     */
    public function sync(): array
    {
        $this->active = [];
        $stats = ['handed_over' => 0, 'given_back' => 0];

        // Given back: held for someone, but the holder no longer acts for them
        Document::with(['currentHolder', 'heldFor'])
            ->whereNotNull('held_for_user_id')
            ->whereRaw('LOWER(status) NOT IN (' . implode(', ', array_fill(0, count(Document::CLOSED_STATUSES), '?')) . ')', Document::CLOSED_STATUSES)
            ->get()
            ->each(function (Document $document) use (&$stats) {
                $designation = $this->activeFor($document->held_for_user_id);
                if ($designation && (int) $designation->designated_user_id === (int) $document->current_holder_id) {
                    return;
                }
                $this->move($document, $document->heldFor, null, 'returned to', $designation);
                $stats['given_back']++;
            });

        // Handed over: waiting for an official who is covered today
        $covered = OicDesignation::with(['official', 'officer'])->activeOn($this->today())->get()->keyBy('designating_user_id');
        if ($covered->isNotEmpty()) {
            Document::whereIn('current_holder_id', $covered->keys())
                ->whereNull('held_for_user_id')
                ->whereRaw('LOWER(status) NOT IN (' . implode(', ', array_fill(0, count(Document::CLOSED_STATUSES), '?')) . ')', Document::CLOSED_STATUSES)
                ->get()
                ->each(function (Document $document) use ($covered, &$stats) {
                    $designation = $covered->get($document->current_holder_id);
                    if (!$designation?->officer?->is_active) {
                        return;
                    }
                    $this->move($document, $designation->officer, $designation->official, 'handed over to', $designation);
                    $stats['handed_over']++;
                });
        }

        return $stats;
    }

    /** Re-assign the document to $holder (for $heldFor when the holder is an OIC), with a slip and a trail entry */
    private function move(Document $document, ?User $holder, ?User $heldFor, string $verb, ?OicDesignation $designation): void
    {
        $from = $document->currentHolder;
        // An official whose OIC left gets it back; with nobody to give it to, it stays where it is
        $holder ??= $from;
        if (!$holder) {
            return;
        }

        DB::transaction(function () use ($document, $holder, $heldFor, $verb, $designation, $from) {
            $reference = $designation?->reference();
            RoutingSlip::create([
                'document_id'          => $document->document_id,
                'tracking_number'      => $document->tracking_number ?: ('PENDING-' . $document->reference_number),
                'from_user_id'         => $from?->id,
                'from_department_id'   => $document->current_holder_department_id,
                'to_user_id'           => $holder->id,
                'target_department_id' => $holder->department_id,
                'sender_name'          => 'TrackNGo (OIC designation)',
                'action'               => 'oic',
                'instruction'          => $heldFor
                    ? "Handed over to {$holder->name}, {$reference}, while {$heldFor->name} is away."
                    : "Returned to {$holder->name}: the Officer-in-Charge designation has ended.",
                'status'               => 'pending',
                'date_received'        => now(),
            ]);

            $document->forceFill([
                'current_holder_id'            => $holder->id,
                'current_holder_department_id' => $holder->department_id ?? $document->current_holder_department_id,
                'held_for_user_id'             => $heldFor?->id,
            ])->save();

            AuditTrail::create([
                'category'     => 'action',
                'document_id'  => $document->document_id,
                'document_ref' => $document->reference_number,
                'user_id'      => null,
                'user_role'    => 'System / OIC Designation',
                'department'   => $holder->department?->department_name,
                'action'       => 'OIC Hand-over',
                'description'  => $heldFor
                    ? "Document {$verb} {$holder->name} ({$reference}) because {$heldFor->name} is away."
                    : "Document {$verb} {$holder->name}: the Officer-in-Charge designation ended.",
                'ip_address'   => request()?->ip(),
                'timestamp'    => now(),
            ]);
        });

        NotificationService::triggerDocumentReceiptNotification(
            document: $document,
            targetUserId: $holder->id,
            targetDeptId: $holder->department_id,
            title: $heldFor ? "Document handed over to you as {$designation?->title()}" : 'Document returned to you (OIC designation ended)'
        );
    }

    /** Inclusive day range of the designation as shown to people: "Oct 12 – Oct 16, 2026" */
    public static function period(OicDesignation $designation): string
    {
        return Carbon::parse($designation->start_date)->format('M d') . ' – ' . Carbon::parse($designation->end_date)->format('M d, Y');
    }
}
