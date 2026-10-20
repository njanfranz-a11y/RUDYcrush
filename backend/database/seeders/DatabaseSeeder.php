<?php

namespace Database\Seeders;

use App\Models\AccidentCategory;
use App\Models\AccidentPhoto;
use App\Models\AccidentReport;
use App\Models\AuditLog;
use App\Models\OfficerAssignment;
use App\Models\ReportStatusHistory;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Keep the first deploy atomic: if report seeding fails, the demo
        // accounts are rolled back too and the next container start retries.
        DB::transaction(function (): void {
            $this->seedData();
        });
    }

    private function seedData(): void
    {
        // Categories are safe to ensure on every deploy. Demo accounts and
        // reports are only created on a brand-new database, so restarting the
        // service never resurrects deleted accounts or resets passwords.
        $isFreshInstall = User::count() === 0;

        // 1. Seed Categories
        $categories = [
            [
                'name' => 'Rear-end Collision',
                'slug' => 'rear-end-collision',
                'description' => 'Vehicle collides with the rear of the vehicle ahead of it.',
            ],
            [
                'name' => 'Head-on Collision',
                'slug' => 'head-on-collision',
                'description' => 'Front ends of two vehicles hit each other in opposite directions.',
            ],
            [
                'name' => 'Side-impact / T-Bone',
                'slug' => 'side-impact-t-bone',
                'description' => 'Vehicle is hit on its side by the front or rear of another vehicle.',
            ],
            [
                'name' => 'Hit-and-Run Incident',
                'slug' => 'hit-and-run',
                'description' => 'Driver collides with a vehicle, person, or property and flees the scene.',
            ],
            [
                'name' => 'Rollover Accident',
                'slug' => 'rollover',
                'description' => 'Vehicle overturns onto its side or roof, commonly due to high speed or sharp turn.',
            ],
            [
                'name' => 'Pedestrian or Cyclist Accident',
                'slug' => 'pedestrian-cyclist',
                'description' => 'Incident involving motorized vehicles and pedestrians or non-motorized bicycles.',
            ],
            [
                'name' => 'Motorcycle Collision / Spill',
                'slug' => 'motorcycle-collision',
                'description' => 'Accident involving two-wheel or three-wheel motorcycles or tricycles.',
            ],
            [
                'name' => 'Single-Vehicle Run-off-Road',
                'slug' => 'single-vehicle-runoff',
                'description' => 'Vehicle leaves the roadway and collides with guardrails, trees, or ditches.',
            ],
        ];

        $categoryModels = [];
        foreach ($categories as $cat) {
            $categoryModels[] = AccidentCategory::updateOrCreate(['slug' => $cat['slug']], $cat);
        }

        // Existing databases only need the categories above.
        if (! $isFreshInstall) {
            return;
        }

        // 2. Seed Users
        $admin = User::firstOrCreate(
            ['email' => 'admin@roadwatch.gov'],
            [
                'name' => 'Chief Admin Bautista',
                'phone' => '+63 917 111 2233',
                'role' => 'admin',
                'is_active' => true,
                'password' => Hash::make('AdminPass123!'),
            ]
        );

        $officer1 = User::firstOrCreate(
            ['email' => 'officer.santos@traffic.gov'],
            [
                'name' => 'Officer Marco Santos',
                'phone' => '+63 920 333 4455',
                'role' => 'officer',
                'badge_number' => 'PO3-8821',
                'is_active' => true,
                'password' => Hash::make('OfficerPass123!'),
            ]
        );

        $officer2 = User::firstOrCreate(
            ['email' => 'officer.reyes@traffic.gov'],
            [
                'name' => 'Officer Elena Reyes',
                'phone' => '+63 922 555 6677',
                'role' => 'officer',
                'badge_number' => 'PO2-4912',
                'is_active' => true,
                'password' => Hash::make('OfficerPass123!'),
            ]
        );

        $reporter1 = User::firstOrCreate(
            ['email' => 'maria.delacruz@gmail.com'],
            [
                'name' => 'Maria Dela Cruz',
                'phone' => '+63 918 777 8899',
                'role' => 'reporter',
                'is_active' => true,
                'password' => Hash::make('ReporterPass123!'),
            ]
        );

        $reporter2 = User::firstOrCreate(
            ['email' => 'juan.luna@gmail.com'],
            [
                'name' => 'Juan Luna',
                'phone' => '+63 929 112 3344',
                'role' => 'reporter',
                'is_active' => true,
                'password' => Hash::make('ReporterPass123!'),
            ]
        );

        // 3. Seed Realistic Accident Reports in Bulacan region
        $reports = [
            [
                'report_number' => 'AR-202610-0001',
                'user_id' => $reporter1->id,
                'category_id' => $categoryModels[0]->id, // Rear-end
                'reporter_name' => 'Maria Dela Cruz',
                'reporter_contact' => '+63 918 777 8899',
                'accident_date' => '2026-10-14',
                'accident_time' => '08:30:00',
                'location_address' => 'MacArthur Highway, Barangay Dakila, Malolos, Bulacan (Near BSU Gate 3)',
                'latitude' => 14.8587120,
                'longitude' => 120.8143890,
                'accident_type' => 'Rear-end Collision',
                'vehicles_involved' => 2,
                'injury_severity' => 'minor',
                'description' => 'White Toyota Vios was rear-ended by a passenger jeepney while stopping for pedestrian crossing. Minor bumper and headlight damage.',
                'status' => 'closed',
                'assigned_officer_id' => $officer1->id,
                'verified_by' => $admin->id,
                'verified_at' => '2026-10-14 09:15:00',
                'official_remarks' => 'Cleared by Traffic Enforcer Unit. Parties agreed on amicable settlement for repair damages.',
                'investigation_findings' => 'Brake failure on the trailing vehicle due to wet road conditions.',
                'actions_taken' => 'Towed vehicle to shoulder, traffic resumed smoothly after 20 minutes.',
                'closed_at' => '2026-10-14 11:30:00',
            ],
            [
                'report_number' => 'AR-202610-0002',
                'user_id' => $reporter2->id,
                'category_id' => $categoryModels[6]->id, // Motorcycle
                'reporter_name' => 'Juan Luna',
                'reporter_contact' => '+63 929 112 3344',
                'accident_date' => '2026-10-15',
                'accident_time' => '14:20:00',
                'location_address' => 'Plaridel Bypass Road, Barangay Tiaong, Guiguinto, Bulacan',
                'latitude' => 14.8321040,
                'longitude' => 120.8791550,
                'accident_type' => 'Motorcycle Collision / Spill',
                'vehicles_involved' => 1,
                'injury_severity' => 'minor',
                'description' => 'Motorcycle slipped on gravel along outer lane. Rider wearing helmet sustained abrasions on knees and elbows.',
                'status' => 'in_progress',
                'assigned_officer_id' => $officer1->id,
                'verified_by' => $admin->id,
                'verified_at' => '2026-10-15 15:00:00',
                'official_remarks' => 'Assigned to Officer Santos for roadside debris inspection and report validation.',
                'investigation_findings' => 'Loose aggregate from nearby construction without warning markers.',
                'actions_taken' => 'Barangay patrol contacted DPWH sub-district to sweep lane.',
            ],
            [
                'report_number' => 'AR-202610-0003',
                'user_id' => $reporter1->id,
                'category_id' => $categoryModels[3]->id, // Hit-and-run
                'reporter_name' => 'Maria Dela Cruz',
                'reporter_contact' => '+63 918 777 8899',
                'accident_date' => '2026-10-16',
                'accident_time' => '19:45:00',
                'location_address' => 'Bocaue Flyover, Barangay Wakas, Bocaue, Bulacan',
                'latitude' => 14.7989300,
                'longitude' => 120.9284100,
                'accident_type' => 'Hit-and-Run Incident',
                'vehicles_involved' => 2,
                'injury_severity' => 'severe',
                'description' => 'Dark gray pickup truck side-swiped a delivery motorcycle and sped towards NLEX entry without stopping. Rider transported to Bulacan Medical Center.',
                'status' => 'assigned',
                'assigned_officer_id' => $officer2->id,
                'verified_by' => $admin->id,
                'verified_at' => '2026-10-16 20:10:00',
                'official_remarks' => 'High-priority hit-and-run. CCTV footage requested from Bocaue Command Center.',
                'investigation_findings' => null,
                'actions_taken' => 'Flash alarm sent to toll plaza security.',
            ],
            [
                'report_number' => 'AR-202610-0004',
                'user_id' => $reporter2->id,
                'category_id' => $categoryModels[2]->id, // Side-impact
                'reporter_name' => 'Juan Luna',
                'reporter_contact' => '+63 929 112 3344',
                'accident_date' => '2026-10-17',
                'accident_time' => '07:15:00',
                'location_address' => 'Crossing Intersection, Barangay Poblacion, Pulilan, Bulacan',
                'latitude' => 14.9023400,
                'longitude' => 120.8512100,
                'accident_type' => 'Side-impact / T-Bone',
                'vehicles_involved' => 2,
                'injury_severity' => 'none',
                'description' => 'Delivery van beat the yellow light and struck side door of sedan. Both drivers safe, vehicle doors dented.',
                'status' => 'verified',
                'verified_by' => $admin->id,
                'verified_at' => '2026-10-17 07:45:00',
                'official_remarks' => 'Verified via traffic camera footage. Pending officer deployment.',
            ],
            [
                'report_number' => 'AR-202610-0005',
                'user_id' => $reporter1->id,
                'category_id' => $categoryModels[5]->id, // Pedestrian
                'reporter_name' => 'Maria Dela Cruz',
                'reporter_contact' => '+63 918 777 8899',
                'accident_date' => '2026-10-17',
                'accident_time' => '08:50:00',
                'location_address' => 'Paseo del Congreso, Barangay Catmon, Malolos, Bulacan',
                'latitude' => 14.8511200,
                'longitude' => 120.8174500,
                'accident_type' => 'Pedestrian or Cyclist Accident',
                'vehicles_involved' => 1,
                'injury_severity' => 'minor',
                'description' => 'Bicycle struck curb avoiding oncoming tricycle on narrow shoulder. Cyclist received first aid from nearby pharmacy.',
                'status' => 'submitted',
            ],
            [
                'report_number' => 'AR-202610-0006',
                'user_id' => null, // Anonymous/Public Guest submission
                'category_id' => $categoryModels[0]->id,
                'reporter_name' => 'Anonymous Citizen',
                'reporter_contact' => '09150001122',
                'accident_date' => '2026-10-16',
                'accident_time' => '23:10:00',
                'location_address' => 'Near Marilao Exit, NLEX northbound',
                'latitude' => 14.7645000,
                'longitude' => 120.9612000,
                'accident_type' => 'Rear-end Collision',
                'vehicles_involved' => 2,
                'injury_severity' => 'unknown',
                'description' => 'Saw two cars collided on shoulder lane with hazards blinking. One tow truck arriving.',
                'status' => 'under_review',
            ],
            [
                'report_number' => 'AR-202610-0007',
                'user_id' => $reporter2->id,
                'category_id' => $categoryModels[7]->id,
                'reporter_name' => 'Juan Luna',
                'reporter_contact' => '+63 929 112 3344',
                'accident_date' => '2026-10-13',
                'accident_time' => '12:00:00',
                'location_address' => 'Old bridge road',
                'latitude' => 14.8400000,
                'longitude' => 120.8200000,
                'accident_type' => 'Single-Vehicle Run-off-Road',
                'vehicles_involved' => 1,
                'injury_severity' => 'none',
                'description' => 'Test submission with incomplete information.',
                'status' => 'rejected',
                'rejection_reason' => 'Report was identified as a test entry with duplicate coordinates and insufficient incident evidence.',
            ],
        ];

        foreach ($reports as $data) {
            $report = AccidentReport::create($data);

            // Seed status history for each report
            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $report->user_id ?? $admin->id,
                'from_status' => 'none',
                'to_status' => 'submitted',
                'remarks' => 'Initial incident report submitted.',
                'created_at' => $report->created_at,
            ]);

            if ($report->status !== 'submitted') {
                ReportStatusHistory::create([
                    'accident_report_id' => $report->id,
                    'user_id' => $admin->id,
                    'from_status' => 'submitted',
                    'to_status' => $report->status,
                    'remarks' => $report->rejection_reason ?? $report->official_remarks ?? 'Administrative status progression.',
                ]);
            }

            if ($report->assigned_officer_id) {
                OfficerAssignment::create([
                    'accident_report_id' => $report->id,
                    'officer_id' => $report->assigned_officer_id,
                    'assigned_by' => $admin->id,
                    'assignment_notes' => 'Investigate incident location and contact parties involved.',
                    'status' => $report->status === 'closed' ? 'completed' : 'active',
                ]);
            }

            // Seed an audit log for administrative verification
            if ($report->verified_at) {
                AuditLog::record(
                    $admin->id,
                    'verify_report',
                    'AccidentReport',
                    $report->id,
                    "Verified accident report {$report->report_number}"
                );
            }
        }

        // 4. Seed sample notifications
        SystemNotification::notify(
            $reporter1->id,
            'Report Closed: AR-202610-0001',
            'Your reported incident at MacArthur Highway has been resolved and closed.',
            'status_change',
            '/reports/1'
        );

        SystemNotification::notify(
            $officer1->id,
            'New Assignment: AR-202610-0002',
            'You have been assigned to investigate an incident at Plaridel Bypass Road.',
            'assignment',
            '/officer/reports/2'
        );

        SystemNotification::notify(
            $admin->id,
            'New Incident Submitted: AR-202610-0005',
            'Maria Dela Cruz submitted a new incident in Barangay Catmon, Malolos.',
            'info',
            '/admin/reports/5'
        );
    }
}
