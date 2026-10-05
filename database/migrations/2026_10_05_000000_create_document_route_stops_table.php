<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Flexible routes: the people a document goes through, in order, chosen when it is filed (by the Receiving
 * Clerk for external documents, by the sender for internal ones). Each person approves (and signs when
 * `signs` is set) and the document moves on to the next automatically. Documents filed before routes
 * existed keep route_based = false and finish on the fixed 7 / 6-step flow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_route_stops', function (Blueprint $table) {
            $table->id('route_stop_id');
            $table->unsignedBigInteger('document_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedSmallInteger('position');
            $table->boolean('signs')->default(false);
            $table->dateTime('approved_at')->nullable();
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->unique(['document_id', 'position']);
        });

        Schema::table('documents', function (Blueprint $table) {
            $table->boolean('route_based')->default(false)->after('requires_signature');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn('route_based');
        });
        Schema::dropIfExists('document_route_stops');
    }
};
