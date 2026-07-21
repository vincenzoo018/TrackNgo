<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    use HasFactory;

    protected $table = 'roles';
    protected $primaryKey = 'role_id';
    protected $fillable = ['role_name', 'position'];
    
    public function users() { 
        return $this->hasMany(User::class, 'role_id', 'role_id'); 
    }
}
