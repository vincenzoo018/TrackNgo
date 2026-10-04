<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turns sms_notifications into the SMS log for the Semaphore integration: who it was for, which event
 * caused it (event_key is unique, so the same event can never be sent twice), simulation flag,
 * provider message id, attempts and the failure reason. The API key is never stored.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sms_notifications', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->after('document_ref');
            $table->string('notification_type', 40)->nullable()->after('user_id');
            $table->string('event_key', 150)->nullable()->unique()->after('notification_type');
            $table->string('provider', 30)->default('semaphore')->after('message');
            $table->string('provider_message_id', 64)->nullable()->after('provider');
            $table->boolean('simulation')->default(false)->after('status');
            $table->unsignedTinyInteger('attempts')->default(0)->after('simulation');
            $table->dateTime('next_attempt_at')->nullable()->after('attempts');
            $table->string('error_message', 255)->nullable()->after('next_attempt_at');

            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['mobile_number', 'created_at']);
            $table->index(['status', 'next_attempt_at']);
        });
    }

    public function down(): void
    {
        Schema::table('sms_notifications', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropIndex(['mobile_number', 'created_at']);
            $table->dropIndex(['status', 'next_attempt_at']);
            $table->dropUnique(['event_key']);
            $table->dropColumn([
                'user_id', 'notification_type', 'event_key', 'provider', 'provider_message_id',
                'simulation', 'attempts', 'next_attempt_at', 'error_message',
            ]);
        });
    }
};
