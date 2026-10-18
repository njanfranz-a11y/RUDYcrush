<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportStatusHistory extends Model
{
    use HasFactory;

    protected $table = 'report_status_history';

    protected $fillable = [
        'accident_report_id',
        'user_id',
        'from_status',
        'to_status',
        'remarks',
    ];

    public function report(): BelongsTo
    {
        return $this->belongsTo(AccidentReport::class, 'accident_report_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
