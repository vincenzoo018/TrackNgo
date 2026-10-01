<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentClient extends Model
{
    use HasFactory;

    protected $primaryKey = 'client_id';

    protected $fillable = [
        'document_id',
        'client_type',
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'sex',
        'organization',
        'house_street',
        'barangay',
        'city_municipality',
        'province',
        'contact_number',
        'email',
        'id_type',
        'id_number',
        'receipt_mode',
        'purpose',
        'representative_name',
    ];

    protected $appends = ['full_name', 'full_address'];

    /** "Juan A. Dela Cruz Jr." */
    public function getFullNameAttribute(): string
    {
        $middleInitial = $this->middle_name ? mb_strtoupper(mb_substr($this->middle_name, 0, 1)) . '.' : null;

        return implode(' ', array_filter([$this->first_name, $middleInitial, $this->last_name, $this->suffix]));
    }

    /** "Purok 3, Brgy. Central, City of Mati, Davao Oriental" */
    public function getFullAddressAttribute(): string
    {
        $barangay = $this->barangay ? 'Brgy. ' . preg_replace('/^(brgy\.?|barangay)\s*/i', '', $this->barangay) : null;

        return implode(', ', array_filter([$this->house_street, $barangay, $this->city_municipality, $this->province]));
    }

    public function document()
    {
        return $this->belongsTo(Document::class, 'document_id', 'document_id');
    }
}
