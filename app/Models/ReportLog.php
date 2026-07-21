<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReportLog extends Model
{
    use HasFactory;

    protected $table = 'report_logs';

    protected $primaryKey = 'report_id';
    protected $fillable = ['generated_by', 'report_type', 'date_from', 'date_to', 'generated_at'];
    protected $casts = ['date_from' => 'date', 'date_to' => 'date', 'generated_at' => 'datetime'];
    
    public function user() { return $this->belongsTo(User::class, 'generated_by', 'id'); }
        
}
