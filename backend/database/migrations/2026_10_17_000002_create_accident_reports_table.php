<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('accident_reports', function (Blueprint $table) {
            $table->id();
            $table->string('report_number')->unique()->index();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('accident_categories')->nullOnDelete();
            
            // Reporter Details
            $table->string('reporter_name');
            $table->string('reporter_contact')->nullable();
            
            // Incident Details
            $table->date('accident_date')->index();
            $table->time('accident_time');
            $table->string('location_address'); // Road, street, barangay, municipality, landmark
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('accident_type')->index(); // Collision, Hit-and-run, Rollover, Pedestrian, etc.
            $table->unsignedInteger('vehicles_involved')->default(1);
            $table->enum('injury_severity', ['none', 'minor', 'severe', 'fatal', 'unknown'])->default('unknown');
            $table->text('description');

            // Status & Workflow
            $table->enum('status', [
                'submitted',
                'under_review',
                'additional_info_required',
                'verified',
                'assigned',
                'in_progress',
                'closed',
                'rejected'
            ])->default('submitted')->index();

            $table->text('rejection_reason')->nullable();
            $table->text('additional_info_notes')->nullable();

            // Official Handling
            $table->foreignId('assigned_officer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('official_remarks')->nullable();
            $table->text('investigation_findings')->nullable();
            $table->text('actions_taken')->nullable();
            $table->timestamp('closed_at')->nullable();

            $table->softDeletes();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('accident_reports');
    }
};
