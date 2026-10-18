<?php

namespace Tests\Feature;

use App\Models\AccidentCategory;
use App\Models\AccidentPhoto;
use App\Models\AccidentReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccidentReportingApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed categories if not already present
        if (AccidentCategory::count() === 0) {
            AccidentCategory::create([
                'name' => 'Collision',
                'slug' => 'collision',
                'is_active' => true,
            ]);
        }
    }

    public function test_user_can_register_as_citizen_reporter(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Testing Citizen',
            'email' => 'citizen.test@roadwatch.gov',
            'phone' => '+63 912 345 6789',
            'password' => 'SecurePass123!',
            'password_confirmation' => 'SecurePass123!',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.role', 'reporter');

        $this->assertDatabaseHas('users', [
            'email' => 'citizen.test@roadwatch.gov',
            'role' => 'reporter',
        ]);
    }

    public function test_registration_rejects_duplicate_email(): void
    {
        User::create([
            'name' => 'Existing User',
            'email' => 'duplicate.check@roadwatch.gov',
            'role' => 'reporter',
            'is_active' => true,
            'password' => bcrypt('Password123!'),
        ]);

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Another User',
            'email' => 'duplicate.check@roadwatch.gov',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_can_submit_accident_report(): void
    {
        $user = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Testing Reporter',
            'reporter_contact' => '09123334444',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'latitude' => 14.8587,
            'longitude' => 120.8143,
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Two passenger vehicles collided along inner lane during rain.',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('accident_reports', [
            'reporter_name' => 'Testing Reporter',
            'status' => 'submitted',
        ]);
    }

    public function test_report_submission_rejects_future_dates(): void
    {
        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Invalid Date Tester',
            'accident_date' => now()->addDays(5)->toDateString(),
            'accident_time' => '10:00',
            'location_address' => 'Some address here in Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'Testing future date rejection.',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['accident_date']);
    }

    public function test_ordinary_reporter_cannot_access_admin_stats(): void
    {
        $reporter = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($reporter);

        $response = $this->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_admin_can_access_stats(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/admin/dashboard/stats');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure(['data' => ['counts', 'by_type', 'by_severity', 'weekly_trend']]);
    }

    public function test_rejection_requires_reason(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $report = AccidentReport::create([
            'report_number' => 'AR-TEST-001',
            'reporter_name' => 'Test Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '12:00',
            'location_address' => 'Malolos Crossing',
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'Test incident description.',
            'status' => 'submitted',
        ]);

        $response = $this->putJson("/api/v1/admin/reports/{$report->id}/reject", []);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['rejection_reason']);
    }

    public function test_admin_can_verify_submitted_report(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);

        $report = AccidentReport::create([
            'report_number' => 'AR-TEST-002',
            'reporter_name' => 'Test Reporter',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '12:00',
            'location_address' => 'Guiguinto Exit',
            'accident_type' => 'Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'none',
            'description' => 'Incident verified by camera.',
            'status' => 'submitted',
        ]);

        $response = $this->putJson("/api/v1/admin/reports/{$report->id}/verify", [
            'official_remarks' => 'Confirmed by CCTVs.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'verified');

        $this->assertDatabaseHas('accident_reports', [
            'id' => $report->id,
            'status' => 'verified',
            'verified_by' => $admin->id,
        ]);
    }

    public function test_can_submit_report_with_photo_evidence(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($user);

        $file = UploadedFile::fake()->create('accident_scene.jpg', 200, 'image/jpeg');

        $response = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Photo Reporter',
            'reporter_contact' => '09123334444',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '14:30',
            'location_address' => 'MacArthur Highway, Malolos, Bulacan',
            'accident_type' => 'Rear-end Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Collision with photo evidence attached.',
            'photos' => [$file],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $reportId = $response->json('data.id');
        $photo = AccidentPhoto::where('accident_report_id', $reportId)->first();

        $this->assertNotNull($photo);
        $this->assertEquals('accident_scene.jpg', $photo->original_name);
        Storage::disk('public')->assertExists($photo->file_path);

        // Verify photo file endpoint
        $fileResponse = $this->get("/api/v1/photos/{$photo->id}/file");
        $fileResponse->assertStatus(200);
    }

    public function test_multiple_reports_with_identical_filenames_are_stored_distinctly(): void
    {
        Storage::fake('public');

        $user = User::factory()->create(['role' => 'reporter', 'is_active' => true]);
        Sanctum::actingAs($user);

        // First report with filename evidence.jpg
        $file1 = UploadedFile::fake()->create('evidence.jpg', 300, 'image/jpeg');
        $response1 = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Reporter One',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '10:00',
            'location_address' => 'Location Alpha, Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 1,
            'injury_severity' => 'none',
            'description' => 'First incident report description.',
            'photos' => [$file1],
        ]);
        $response1->assertStatus(201);
        $report1Id = $response1->json('data.id');

        // Second report also with filename evidence.jpg
        $file2 = UploadedFile::fake()->create('evidence.jpg', 400, 'image/jpeg');
        $response2 = $this->postJson('/api/v1/reports', [
            'reporter_name' => 'Reporter Two',
            'accident_date' => now()->subDay()->toDateString(),
            'accident_time' => '11:00',
            'location_address' => 'Location Beta, Bulacan',
            'accident_type' => 'Collision',
            'vehicles_involved' => 2,
            'injury_severity' => 'minor',
            'description' => 'Second incident report description.',
            'photos' => [$file2],
        ]);
        $response2->assertStatus(201);
        $report2Id = $response2->json('data.id');

        $photo1 = AccidentPhoto::where('accident_report_id', $report1Id)->first();
        $photo2 = AccidentPhoto::where('accident_report_id', $report2Id)->first();

        $this->assertNotNull($photo1);
        $this->assertNotNull($photo2);
        // Original names are both evidence.jpg
        $this->assertEquals('evidence.jpg', $photo1->original_name);
        $this->assertEquals('evidence.jpg', $photo2->original_name);

        // Stored file paths must be distinct (no collision/overwriting)
        $this->assertNotEquals($photo1->file_path, $photo2->file_path);
        $this->assertNotEquals($photo1->file_name, $photo2->file_name);

        // Both distinct files must exist in storage
        Storage::disk('public')->assertExists($photo1->file_path);
        Storage::disk('public')->assertExists($photo2->file_path);

        // Each report displays its own correct photo via API
        $show1 = $this->getJson("/api/v1/reports/{$report1Id}");
        $show1->assertStatus(200);
        $this->assertEquals($photo1->id, $show1->json('data.photos.0.id'));
        $this->assertEquals($photo1->file_path, $show1->json('data.photos.0.file_path'));

        $show2 = $this->getJson("/api/v1/reports/{$report2Id}");
        $show2->assertStatus(200);
        $this->assertEquals($photo2->id, $show2->json('data.photos.0.id'));
        $this->assertEquals($photo2->file_path, $show2->json('data.photos.0.file_path'));
    }
}
