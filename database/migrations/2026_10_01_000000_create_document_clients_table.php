<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * External client (walk-in / mail / email) registered by the Receiving Clerk for a document.
     * Fields follow the standard LGU records intake slip and the ARTA client classification.
     */
    public function up(): void
    {
        if (Schema::hasTable('document_clients')) {
            return;
        }

        Schema::create('document_clients', function (Blueprint $table) {
            $table->id('client_id');
            $table->unsignedBigInteger('document_id')->unique();
            $table->string('client_type', 20);
            $table->string('first_name', 60);
            $table->string('middle_name', 60)->nullable();
            $table->string('last_name', 60);
            $table->string('suffix', 10)->nullable();
            $table->string('sex', 10)->nullable();
            $table->string('organization', 150)->nullable();
            $table->string('house_street', 150)->nullable();
            $table->string('barangay', 100);
            $table->string('city_municipality', 100);
            $table->string('province', 100);
            $table->string('contact_number', 20);
            $table->string('email', 100)->nullable();
            $table->string('id_type', 50)->nullable();
            $table->string('id_number', 50)->nullable();
            $table->string('receipt_mode', 20);
            $table->string('purpose', 255);
            $table->string('representative_name', 150)->nullable();
            $table->timestamps();

            $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_clients');
    }
};
