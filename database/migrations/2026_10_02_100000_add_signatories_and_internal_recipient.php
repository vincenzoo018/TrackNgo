<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Internal routing keeps the person the sender chose (the clerk only registers the document), and
     * documents that need signatures list their signatories, each stamp's position on the page and the
     * final signed copy produced once everyone has signed.
     */
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            if (!Schema::hasColumn('documents', 'destination_user_id')) {
                $table->unsignedBigInteger('destination_user_id')->nullable()->after('destination_department_id');
                $table->foreign('destination_user_id')->references('id')->on('users')->onDelete('set null');
            }
            if (!Schema::hasColumn('documents', 'requires_signature')) {
                $table->boolean('requires_signature')->default(false)->after('classification');
            }
            if (!Schema::hasColumn('documents', 'signed_file_path')) {
                $table->string('signed_file_path')->nullable()->after('attachment_path');
            }
        });

        if (!Schema::hasTable('document_signatories')) {
            Schema::create('document_signatories', function (Blueprint $table) {
                $table->id('signatory_id');
                $table->unsignedBigInteger('document_id');
                $table->unsignedBigInteger('user_id');
                $table->unsignedSmallInteger('sign_order')->default(1);
                $table->unsignedBigInteger('signature_id')->nullable();
                $table->dateTime('signed_at')->nullable();
                $table->timestamps();

                $table->unique(['document_id', 'user_id']);
                $table->foreign('document_id')->references('document_id')->on('documents')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('signature_id')->references('signature_id')->on('digital_signatures')->onDelete('set null');
            });
        }

        Schema::table('digital_signatures', function (Blueprint $table) {
            // Snapshot of the signer's signature image (PNG data URL) at the time of signing
            $table->longText('signature_image')->nullable()->change();

            if (!Schema::hasColumn('digital_signatures', 'page')) {
                // Stamp position as fractions (0..1) of the displayed page, origin top-left; null = no placement (non-PDF files)
                $table->unsignedSmallInteger('page')->nullable()->after('action_type');
                $table->decimal('pos_x', 8, 6)->nullable()->after('page');
                $table->decimal('pos_y', 8, 6)->nullable()->after('pos_x');
                $table->decimal('width', 8, 6)->nullable()->after('pos_y');
                $table->decimal('height', 8, 6)->nullable()->after('width');
            }
        });
    }

    public function down(): void
    {
        Schema::table('digital_signatures', function (Blueprint $table) {
            if (Schema::hasColumn('digital_signatures', 'page')) {
                $table->dropColumn(['page', 'pos_x', 'pos_y', 'width', 'height']);
            }
        });

        Schema::dropIfExists('document_signatories');

        Schema::table('documents', function (Blueprint $table) {
            if (Schema::hasColumn('documents', 'destination_user_id')) {
                $table->dropForeign(['destination_user_id']);
                $table->dropColumn('destination_user_id');
            }
            if (Schema::hasColumn('documents', 'requires_signature')) {
                $table->dropColumn('requires_signature');
            }
            if (Schema::hasColumn('documents', 'signed_file_path')) {
                $table->dropColumn('signed_file_path');
            }
        });
    }
};
