<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfficerAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'accident_report_id',
        'officer_id',
        'assigned_by',
        'assignment_notes',
        'status',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(AccidentReport::class, 'accident_report_id');
    }

    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'officer_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
