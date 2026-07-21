<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    use HasFactory;

    protected $table = 'departments';

    protected $primaryKey = 'department_id';

    protected $fillable = [
        'department_name',
        'code',
        'description',
        'head_id',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function head()
    {
        return $this->belongsTo(User::class, 'head_id', 'id');
    }

    public function users()
    {
        return $this->hasMany(User::class, 'department_id', 'department_id');
    }

    public function documents()
    {
        return $this->hasMany(Document::class, 'department_id', 'department_id');
    }
}
