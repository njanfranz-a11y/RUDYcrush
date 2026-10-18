<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AccidentReport extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'report_number',
        'user_id',
        'category_id',
        'reporter_name',
        'reporter_contact',
        'accident_date',
        'accident_time',
        'location_address',
        'latitude',
        'longitude',
        'accident_type',
        'vehicles_involved',
        'injury_severity',
        'description',
        'status',
        'rejection_reason',
        'additional_info_notes',
        'assigned_officer_id',
        'verified_by',
        'verified_at',
        'official_remarks',
        'investigation_findings',
        'actions_taken',
        'closed_at',
    ];

    protected $casts = [
        'accident_date' => 'date:Y-m-d',
        'vehicles_involved' => 'integer',
        'latitude' => 'float',
        'longitude' => 'float',
        'verified_at' => 'datetime',
        'closed_at' => 'datetime',
    ];

    // Status transition rules matrix
    public const VALID_TRANSITIONS = [
        'submitted' => ['under_review', 'verified', 'assigned', 'rejected'],
        'under_review' => ['additional_info_required', 'verified', 'assigned', 'rejected'],
        'additional_info_required' => ['under_review', 'submitted', 'rejected'],
        'verified' => ['assigned', 'in_progress', 'closed'],
        'assigned' => ['in_progress', 'verified', 'closed'],
        'in_progress' => ['closed', 'verified'],
        'closed' => [], // Terminal status
        'rejected' => [], // Terminal status
    ];

    public static function canTransition(string $from, string $to): bool
    {
        if ($from === $to) {
            return true;
        }
        return in_array($to, self::VALID_TRANSITIONS[$from] ?? [], true);
    }

    public static function generateReportNumber(): string
    {
        $prefix = 'AR-' . date('Ym') . '-';
        $latest = self::withTrashed()
            ->where('report_number', 'LIKE', $prefix . '%')
            ->orderByDesc('id')
            ->first();

        if (!$latest) {
            return $prefix . '0001';
        }

        $lastSeq = (int) substr($latest->report_number, strlen($prefix));
        return $prefix . str_pad((string)($lastSeq + 1), 4, '0', STR_PAD_LEFT);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(AccidentCategory::class, 'category_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(AccidentPhoto::class, 'accident_report_id');
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(ReportStatusHistory::class, 'accident_report_id')->orderByDesc('created_at');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(OfficerAssignment::class, 'accident_report_id')->orderByDesc('created_at');
    }

    public function assignedOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_officer_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
