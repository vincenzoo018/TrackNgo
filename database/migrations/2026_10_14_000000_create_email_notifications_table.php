<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The email log: one row per email TrackNGo decided to send (or defer / skip) for one event. event_key is unique,
 * so the same workflow event can never be emailed twice, even when a send job runs again. Only a short, sanitized
 * failure reason is kept; SMTP credentials and full server responses never reach this table.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_notifications')) {
            return;
        }

        Schema::create('email_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('event_key', 150)->unique();
            $table->string('notification_type', 40);
            $table->unsignedBigInteger('document_id')->nullable();
            $table->string('document_ref', 50)->nullable();
            // Staff member (their account email) or the applicant of an external document (the client record)
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('recipient_type', 10);
            $table->string('recipient_name', 255);
            $table->string('recipient_email', 100)->nullable();
            $table->string('subject', 200);
            // Lines of the message and its link, fixed when the event happened
            $table->json('content');
            $table->string('status', 20);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->dateTime('next_attempt_at')->nullable();
            $table->string('error_message', 255)->nullable();
            // When the mail server accepted the message (not proof that it reached the inbox)
            $table->dateTime('sent_at')->nullable();
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->nullOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['status', 'next_attempt_at']);
            $table->index(['recipient_email', 'created_at']);
            $table->index('sent_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_notifications');
    }
};
