<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\AccidentPhoto;
use App\Models\AccidentReport;
use App\Models\AuditLog;
use App\Models\ReportStatusHistory;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AccidentReportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reporter_name' => ['required', 'string', 'max:255'],
            'reporter_contact' => ['nullable', 'string', 'max:50'],
            'category_id' => ['nullable', 'exists:accident_categories,id'],
            'accident_date' => ['required', 'date', 'before_or_equal:today'],
            'accident_time' => ['required', 'date_format:H:i'],
            'location_address' => ['required', 'string', 'min:5', 'max:500'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accident_type' => ['required', 'string', 'max:100'],
            'vehicles_involved' => ['required', 'integer', 'min:1', 'max:99'],
            'injury_severity' => ['required', 'in:none,minor,severe,fatal,unknown'],
            'description' => ['required', 'string', 'min:10', 'max:3000'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['file', 'mimes:jpeg,jpg,png,webp', 'max:5120'], // Max 5MB per file
        ]);

        $user = $request->user('sanctum') ?? $request->user();
        if (!$user && auth('sanctum')->check()) {
            $user = auth('sanctum')->user();
        }

        $report = DB::transaction(function () use ($validated, $user, $request) {
            $reportNumber = AccidentReport::generateReportNumber();

            $report = AccidentReport::create([
                'report_number' => $reportNumber,
                'user_id' => $user?->id,
                'category_id' => $validated['category_id'] ?? null,
                'reporter_name' => $validated['reporter_name'],
                'reporter_contact' => $validated['reporter_contact'] ?? null,
                'accident_date' => $validated['accident_date'],
                'accident_time' => $validated['accident_time'],
                'location_address' => $validated['location_address'],
                'latitude' => $validated['latitude'] ?? null,
                'longitude' => $validated['longitude'] ?? null,
                'accident_type' => $validated['accident_type'],
                'vehicles_involved' => $validated['vehicles_involved'],
                'injury_severity' => $validated['injury_severity'],
                'description' => $validated['description'],
                'status' => 'submitted',
            ]);

            // Save uploaded photos with collision-resistant unique names
            if ($request->hasFile('photos')) {
                foreach ($request->file('photos') as $file) {
                    $ext = strtolower($file->getClientOriginalExtension() ?: ($file->guessExtension() ?: 'jpg'));
                    $fileName = 'accident_' . Str::random(24) . '.' . $ext;
                    $filePath = $file->storeAs('accidents/' . date('Y/m'), $fileName, 'public');

                    AccidentPhoto::create([
                        'accident_report_id' => $report->id,
                        'file_path' => $filePath,
                        'file_name' => $fileName,
                        'original_name' => $file->getClientOriginalName(),
                        'file_size' => $file->getSize(),
                        'mime_type' => $file->getMimeType(),
                    ]);
                }
            }

            // Create initial status history
            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $user?->id,
                'from_status' => 'none',
                'to_status' => 'submitted',
                'remarks' => 'Incident report filed by reporter.',
            ]);

            // Record audit log
            AuditLog::record(
                $user?->id,
                'submit_report',
                'AccidentReport',
                $report->id,
                "New incident report submitted: {$report->report_number}"
            );

            // Notify all admins
            $admins = User::where('role', 'admin')->get();
            foreach ($admins as $admin) {
                SystemNotification::notify(
                    $admin->id,
                    "New Report Submitted: {$report->report_number}",
                    "Incident reported at {$report->location_address}",
                    'info',
                    "/admin/reports/{$report->id}"
                );
            }

            // Notify reporter that report has been submitted with initial status Pending Verification
            if ($user) {
                SystemNotification::notify(
                    $user->id,
                    "Report Submitted: {$report->report_number}",
                    "Your incident report has been received and is currently Pending Verification by traffic management.",
                    'info',
                    "/reports/{$report->id}"
                );
            }

            return $report;
        });

        $report->load(['category', 'photos']);

        return response()->json([
            'success' => true,
            'message' => 'Your accident report has been successfully submitted.',
            'data' => $report,
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $report = AccidentReport::with([
            'category',
            'photos',
            'statusHistory.user',
            'assignments.officer',
            'assignedOfficer',
            'verifiedBy',
        ])->findOrFail($id);

        $user = $request->user();

        // Enforce access control
        if ($user) {
            if ($user->isReporter() && $report->user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized access to this report.',
                ], 403);
            }
            if ($user->isOfficer() && $report->assigned_officer_id && $report->assigned_officer_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not assigned to this accident report.',
                ], 403);
            }
        }

        return response()->json([
            'success' => true,
            'data' => $report,
        ]);
    }

    public function myReports(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = AccidentReport::where('user_id', $user->id)
            ->with(['category', 'photos'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('search')) {
            $search = $request->query('search');
            $query->where(function ($q) use ($search) {
                $q->where('report_number', 'LIKE', "%{$search}%")
                  ->orWhere('location_address', 'LIKE', "%{$search}%")
                  ->orWhere('accident_type', 'LIKE', "%{$search}%");
            });
        }

        $reports = $query->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $reports,
        ]);
    }

    public function supplement(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $report = AccidentReport::findOrFail($id);

        // Security check: only the report owner can supplement
        if ($report->user_id !== $user->id) {
            return response()->json([
                'success' => false,
                'message' => 'You are not authorized to edit this report.',
            ], 403);
        }

        // Status check: only permitted in initial stages
        if (!in_array($report->status, ['submitted', 'under_review', 'additional_info_required'], true)) {
            return response()->json([
                'success' => false,
                'message' => "This report is currently in '{$report->status}' status and can no longer be edited directly.",
            ], 422);
        }

        $validated = $request->validate([
            'location_address' => ['sometimes', 'required', 'string', 'min:5', 'max:500'],
            'description' => ['sometimes', 'required', 'string', 'min:10', 'max:3000'],
            'additional_details' => ['nullable', 'string', 'max:1000'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['file', 'mimes:jpeg,jpg,png,webp', 'max:5120'],
        ]);

        DB::transaction(function () use ($report, $validated, $user, $request) {
            $oldStatus = $report->status;

            if (isset($validated['location_address'])) {
                $report->location_address = $validated['location_address'];
            }
            if (isset($validated['description'])) {
                $report->description = $validated['description'];
            }
            if (!empty($validated['additional_details'])) {
                $report->description .= "\n\n[Reporter Supplement " . date('Y-m-d H:i') . "]: " . $validated['additional_details'];
            }

            // If user supplied info for additional_info_required, move back to under_review
            if ($report->status === 'additional_info_required') {
                $report->status = 'under_review';
            }

            $report->save();

            // Save new photos if attached with collision-resistant unique names
            if ($request->hasFile('photos')) {
                foreach ($request->file('photos') as $file) {
                    $ext = strtolower($file->getClientOriginalExtension() ?: ($file->guessExtension() ?: 'jpg'));
                    $fileName = 'accident_' . Str::random(24) . '.' . $ext;
                    $filePath = $file->storeAs('accidents/' . date('Y/m'), $fileName, 'public');

                    AccidentPhoto::create([
                        'accident_report_id' => $report->id,
                        'file_path' => $filePath,
                        'file_name' => $fileName,
                        'original_name' => $file->getClientOriginalName(),
                        'file_size' => $file->getSize(),
                        'mime_type' => $file->getMimeType(),
                    ]);
                }
            }

            ReportStatusHistory::create([
                'accident_report_id' => $report->id,
                'user_id' => $user->id,
                'from_status' => $oldStatus,
                'to_status' => $report->status,
                'remarks' => 'Reporter supplemented additional information and/or evidence.',
            ]);

            AuditLog::record(
                $user->id,
                'supplement_report',
                'AccidentReport',
                $report->id,
                "Reporter supplemented report: {$report->report_number}"
            );
        });

        $report->load(['category', 'photos', 'statusHistory']);

        return response()->json([
            'success' => true,
            'message' => 'Report updated and submitted for review.',
            'data' => $report,
        ]);
    }

    public function publicMap(): JsonResponse
    {
        // Public map: shows sanitized verified and active accident points
        $reports = AccidentReport::whereIn('status', ['verified', 'assigned', 'in_progress', 'closed'])
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->select([
                'id',
                'report_number',
                'accident_date',
                'accident_time',
                'location_address',
                'latitude',
                'longitude',
                'accident_type',
                'injury_severity',
                'vehicles_involved',
                'status',
            ])
            ->orderByDesc('accident_date')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $reports,
        ]);
    }

    public function photoFile(int $id)
    {
        $photo = AccidentPhoto::findOrFail($id);
        if (!Storage::disk('public')->exists($photo->file_path)) {
            abort(404, 'Photo file not found on disk.');
        }

        return Storage::disk('public')->response($photo->file_path, $photo->original_name, [
            'Content-Type' => $photo->mime_type ?: 'image/jpeg',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }
}
