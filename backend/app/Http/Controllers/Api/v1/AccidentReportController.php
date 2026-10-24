<?php

namespace App\Http\Controllers\Api\v1;

use App\Http\Controllers\Controller;
use App\Models\AccidentPhoto;
use App\Models\AccidentReport;
use App\Models\AuditLog;
use App\Models\ReportStatusHistory;
use App\Models\SystemNotification;
use App\Models\User;
use App\Rules\PhilippineMobile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AccidentReportController extends Controller
{
    /**
     * MySQL advisory lock that serializes duplicate checks and inserts. Without
     * it, two Residents could both pass the check at the same instant and both
     * create a report for the same accident.
     */
    private const SUBMISSION_LOCK_NAME = 'roadwatch:report-submission';

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reporter_name' => ['required', 'string', 'max:255'],
            'reporter_contact' => ['nullable', 'string', new PhilippineMobile],
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

        if (!$this->acquireSubmissionLock()) {
            return response()->json([
                'success' => false,
                'message' => 'Another report is being submitted right now. Please try again in a moment.',
            ], 503);
        }

        try {
            // Check every Resident's active reports before anything is written,
            // so a duplicate cannot be created by calling the API directly.
            $duplicate = $this->findLikelyDuplicate($validated);
            if ($duplicate) {
                return response()->json([
                    'success' => false,
                    'message' => 'Someone may have already reported an accident near this location and time. Please review the existing report before submitting another one.',
                    'duplicate' => [
                        'report_number' => $duplicate->report_number,
                        'accident_type' => $duplicate->accident_type,
                        'location_address' => $duplicate->location_address,
                        'accident_date' => $duplicate->accident_date,
                        'accident_time' => substr((string) $duplicate->accident_time, 0, 5),
                        'status' => $duplicate->status,
                    ],
                ], 409);
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
        } finally {
            $this->releaseSubmissionLock();
        }

        $report->load(['category', 'photos']);

        $hasGps = isset($validated['latitude'], $validated['longitude'])
            && $validated['latitude'] !== null
            && $validated['longitude'] !== null;

        return response()->json([
            'success' => true,
            'message' => 'Your accident report has been successfully submitted.',
            'data' => $report,
            // Missing coordinates mean the fallback address comparison was used.
            // Tell the Resident that the check was less precise.
            'duplicate_check' => $hasGps
                ? ['status' => 'checked', 'message' => null]
                : [
                    'status' => 'inconclusive',
                    'message' => 'No GPS coordinates were provided, so duplicate detection used the written location and time. A nearby report may not have been detected.',
                ],
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
            // Officers may only open cases that are currently dispatched to
            // them. Checking the null case too closes a gap where any officer
            // could read an unassigned report by guessing its id.
            if ($user->isOfficer() && $report->assigned_officer_id !== $user->id) {
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

    /**
     * Chart and summary data for the signed-in Resident's dashboard.
     *
     * Everything is scoped to user_id, so another Resident's reports can never
     * influence these totals, trends, or category breakdowns.
     */
    public function myDashboard(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'weeks' => ['nullable', 'integer', 'in:4,6,12'],
        ]);

        $weeks = (int) ($validated['weeks'] ?? 12);
        $userId = $request->user()->id;

        $countsRow = AccidentReport::where('user_id', $userId)
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN status IN ('submitted', 'under_review', 'additional_info_required') THEN 1 ELSE 0 END) as awaiting_review")
            ->selectRaw("SUM(CASE WHEN status IN ('verified', 'assigned', 'in_progress', 'closed') THEN 1 ELSE 0 END) as in_progress_and_resolved")
            ->selectRaw("SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as resolved")
            ->first();

        $total = (int) ($countsRow->total ?? 0);

        // Weekly trend buckets ending with the current week. "Filed" uses the
        // submission timestamp; "resolved" uses closure time, with updated_at
        // as a fallback for older closed records that lack closed_at.
        $rangeStart = now()->startOfWeek()->subWeeks($weeks - 1);
        $rangeEnd = now()->endOfWeek();

        $buckets = [];
        for ($i = 0; $i < $weeks; $i++) {
            $bucketStart = $rangeStart->copy()->addWeeks($i)->startOfWeek();
            $bucketEnd = $bucketStart->copy()->endOfWeek();

            $buckets[] = [
                'label' => $bucketStart->format('M j'),
                'start_date' => $bucketStart->toDateString(),
                'end_date' => $bucketEnd->toDateString(),
                'filed' => 0,
                'resolved' => 0,
            ];
        }

        $filedReports = AccidentReport::where('user_id', $userId)
            ->whereBetween('created_at', [$rangeStart, $rangeEnd])
            ->get(['created_at']);

        foreach ($filedReports as $report) {
            $index = $this->weekBucketIndex($report->created_at, $rangeStart, $weeks);
            if ($index !== null) {
                $buckets[$index]['filed']++;
            }
        }

        $closedReports = AccidentReport::where('user_id', $userId)
            ->where('status', 'closed')
            ->where(function ($query) use ($rangeStart, $rangeEnd) {
                $query->whereBetween('closed_at', [$rangeStart, $rangeEnd])
                    ->orWhere(function ($fallback) use ($rangeStart, $rangeEnd) {
                        $fallback->whereNull('closed_at')
                            ->whereBetween('updated_at', [$rangeStart, $rangeEnd]);
                    });
            })
            ->get(['closed_at', 'updated_at']);

        foreach ($closedReports as $report) {
            $resolvedAt = $report->closed_at ?? $report->updated_at;
            $index = $this->weekBucketIndex($resolvedAt, $rangeStart, $weeks);
            if ($index !== null) {
                $buckets[$index]['resolved']++;
            }
        }

        // Category distribution for this Resident only. Reports without a
        // category are grouped under "Uncategorized".
        $categoryRows = AccidentReport::query()
            ->leftJoin('accident_categories', 'accident_categories.id', '=', 'accident_reports.category_id')
            ->where('accident_reports.user_id', $userId)
            ->selectRaw("COALESCE(accident_categories.name, 'Uncategorized') as name")
            ->selectRaw('COUNT(*) as count')
            ->groupBy('accident_categories.id', 'accident_categories.name')
            ->orderByDesc('count')
            ->orderBy('name')
            ->get();

        $byCategory = $categoryRows->map(function ($row) use ($total) {
            $count = (int) $row->count;

            return [
                'name' => $row->name,
                'count' => $count,
                'percentage' => $total > 0 ? round(($count / $total) * 100, 1) : 0,
            ];
        })->values();

        // Average resolution time is derived from the Resident's own closed
        // reports rather than a static number.
        $closedForAverage = AccidentReport::where('user_id', $userId)
            ->where('status', 'closed')
            ->whereNotNull('closed_at')
            ->get(['created_at', 'closed_at']);

        $averageResolutionHours = null;
        if ($closedForAverage->isNotEmpty()) {
            $totalMinutes = $closedForAverage->sum(
                fn ($report) => $report->created_at->diffInMinutes($report->closed_at)
            );
            $averageResolutionHours = round($totalMinutes / 60 / $closedForAverage->count(), 1);
        }

        $recentReports = AccidentReport::where('user_id', $userId)
            ->with(['category', 'photos'])
            ->orderByDesc('created_at')
            ->limit(6)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'counts' => [
                    'total' => $total,
                    'awaiting_review' => (int) ($countsRow->awaiting_review ?? 0),
                    'in_progress_and_resolved' => (int) ($countsRow->in_progress_and_resolved ?? 0),
                    'resolved' => (int) ($countsRow->resolved ?? 0),
                ],
                'average_resolution_hours' => $averageResolutionHours,
                'trend' => [
                    'weeks' => $weeks,
                    'start_date' => $rangeStart->toDateString(),
                    'end_date' => $rangeEnd->toDateString(),
                    'buckets' => $buckets,
                ],
                'by_category' => $byCategory,
                'recent_reports' => $recentReports,
            ],
        ]);
    }

    /**
     * Map a timestamp onto one of the weekly trend buckets.
     */
    private function weekBucketIndex($value, Carbon $rangeStart, int $weeks): ?int
    {
        if (!$value) {
            return null;
        }

        $timestamp = Carbon::parse($value);

        if ($timestamp->lt($rangeStart) || $timestamp->gt($rangeStart->copy()->addWeeks($weeks)->subSecond())) {
            return null;
        }

        return (int) $rangeStart->diffInWeeks($timestamp->copy()->startOfWeek());
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

    /**
     * Deterministic duplicate heuristic (no external AI service).
     *
     * A report is a possible duplicate when:
     *   1. its accident date/time is within the configured window, AND
     *   2. its location matches:
     *        - both reports have GPS: distance is within the configured radius
     *        - GPS is missing on either side: the written addresses are similar
     *
     * Accident type and description are deliberately NOT considered: different
     * Residents may describe the same accident in completely different words.
     */
    private function findLikelyDuplicate(array $validated): ?AccidentReport
    {
        $date = Carbon::parse($validated['accident_date'])->toDateString();
        $submittedAt = Carbon::parse("{$date} {$validated['accident_time']}");
        $windowMinutes = max(
            1,
            (int) config('roadwatch.duplicate_detection.time_window_minutes', 120)
        );

        // Adjacent dates are included so a report made just before midnight
        // still matches the same accident reported just after midnight.
        $candidates = AccidentReport::query()
            ->whereBetween('accident_date', [
                $submittedAt->copy()->subDay()->toDateString(),
                $submittedAt->copy()->addDay()->toDateString(),
            ])
            // Pending, under review, verified, assigned, in-progress and closed
            // reports all count. Rejected reports are not considered.
            ->where('status', '!=', 'rejected')
            ->get();

        foreach ($candidates as $candidate) {
            try {
                $candidateDate = Carbon::parse($candidate->accident_date)->toDateString();
                $candidateAt = Carbon::parse("{$candidateDate} {$candidate->accident_time}");
            } catch (\Throwable $exception) {
                continue;
            }

            $minutesApart = abs($submittedAt->diffInMinutes($candidateAt));
            if ($minutesApart > $windowMinutes) {
                continue;
            }

            if (!$this->locationsLikelyMatch($validated, $candidate)) {
                continue;
            }

            return $candidate;
        }

        return null;
    }

    private function locationsLikelyMatch(array $validated, AccidentReport $candidate): bool
    {
        $newLat = $validated['latitude'] ?? null;
        $newLng = $validated['longitude'] ?? null;

        // When both sides have GPS, distance is authoritative. A report outside
        // the radius is allowed even if its written address looks similar.
        if ($newLat !== null && $newLng !== null
            && $candidate->latitude !== null && $candidate->longitude !== null) {
            $radiusMeters = max(
                1.0,
                (float) config('roadwatch.duplicate_detection.radius_meters', 300)
            );

            return $this->distanceMeters(
                (float) $newLat,
                (float) $newLng,
                (float) $candidate->latitude,
                (float) $candidate->longitude
            ) <= $radiusMeters;
        }

        // Fallback for missing GPS: compare the written location. The address is
        // required by validation, so this is always available on both reports.
        $addressSimilarity = max(
            $this->similarTextPercent($validated['location_address'], $candidate->location_address),
            $this->tokenSimilarity($validated['location_address'], $candidate->location_address)
        );
        $threshold = (float) config('roadwatch.duplicate_detection.address_similarity', 0.60);

        return $addressSimilarity >= $threshold;
    }

    /**
     * Serialize duplicate check + insert across requests using a MySQL advisory
     * lock. On non-MySQL drivers the check still runs, but without this lock.
     */
    private function acquireSubmissionLock(): bool
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return true;
        }

        $result = DB::selectOne(
            'SELECT GET_LOCK(?, 5) AS acquired',
            [$this->submissionLockName()]
        );

        return (int) ($result->acquired ?? 0) === 1;
    }

    private function releaseSubmissionLock(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return;
        }

        try {
            DB::select('SELECT RELEASE_LOCK(?)', [$this->submissionLockName()]);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    /**
     * Scope the advisory lock to this database so separate RoadWatch
     * environments sharing one MySQL server do not block each other.
     */
    private function submissionLockName(): string
    {
        return substr(
            self::SUBMISSION_LOCK_NAME . ':' . DB::connection()->getDatabaseName(),
            0,
            64
        );
    }

    private function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000.0;
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $a = sin($latDelta / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lngDelta / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function normalizeText(?string $value): string
    {
        $value = mb_strtolower(trim((string) $value));
        $value = preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $value) ?? '';
        $value = preg_replace('/\s+/u', ' ', $value) ?? '';

        return trim($value);
    }

    private function similarTextPercent(?string $first, ?string $second): float
    {
        $first = $this->normalizeText($first);
        $second = $this->normalizeText($second);

        if ($first === '' || $second === '') {
            return 0.0;
        }

        similar_text($first, $second, $percent);

        return $percent / 100;
    }

    private function tokenSimilarity(?string $first, ?string $second): float
    {
        $stopWords = [
            'the', 'and', 'for', 'with', 'that', 'this', 'was', 'were', 'are',
            'from', 'have', 'has', 'had', 'near', 'along', 'into', 'onto',
            'about', 'after', 'before', 'when', 'while', 'there', 'their',
        ];

        $tokenize = function (?string $value) use ($stopWords): array {
            $words = explode(' ', $this->normalizeText($value));

            return array_values(array_unique(array_filter(
                $words,
                fn (string $word) => mb_strlen($word) >= 3 && !in_array($word, $stopWords, true)
            )));
        };

        $firstTokens = $tokenize($first);
        $secondTokens = $tokenize($second);

        if ($firstTokens === [] || $secondTokens === []) {
            return 0.0;
        }

        $intersection = array_intersect($firstTokens, $secondTokens);
        $union = array_unique(array_merge($firstTokens, $secondTokens));

        return count($intersection) / count($union);
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
