<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('first_name')->nullable()->after('id');
            $table->string('middle_name')->nullable()->after('first_name');
            $table->string('last_name')->nullable()->after('middle_name');
        });

        // Migrate existing names
        \Illuminate\Support\Facades\DB::table('users')->orderBy('id')->chunk(100, function ($users) {
            foreach ($users as $user) {
                if ($user->name) {
                    $parts = explode(' ', trim($user->name));
                    $firstName = array_shift($parts);
                    $lastName = count($parts) > 0 ? array_pop($parts) : '';
                    $middleName = count($parts) > 0 ? implode(' ', $parts) : '';
                    
                    \Illuminate\Support\Facades\DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'first_name' => $firstName,
                            'middle_name' => $middleName,
                            'last_name' => $lastName,
                        ]);
                }
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('name');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id');
        });

        \Illuminate\Support\Facades\DB::table('users')->orderBy('id')->chunk(100, function ($users) {
            foreach ($users as $user) {
                $fullName = trim(($user->first_name ?? '') . ' ' . ($user->middle_name ?? '') . ' ' . ($user->last_name ?? ''));
                \Illuminate\Support\Facades\DB::table('users')
                    ->where('id', $user->id)
                    ->update(['name' => $fullName]);
            }
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['first_name', 'middle_name', 'last_name']);
        });
    }
};
