<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Document PIN: a 6-digit code, separate from the login password, asked before any document is downloaded
     * or exported. Stored hashed. Accounts that handle documents get it when HR / Admin registers them;
     * existing accounts set it in Profile Settings.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'document_pin')) {
                $table->string('document_pin')->nullable()->after('password');
            }
            if (!Schema::hasColumn('users', 'document_pin_updated_at')) {
                $table->timestamp('document_pin_updated_at')->nullable()->after('document_pin');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['document_pin_updated_at', 'document_pin'] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
