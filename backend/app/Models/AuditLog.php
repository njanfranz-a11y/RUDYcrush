<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'action',
        'target_type',
        'target_id',
        'description',
        'changes_payload',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'changes_payload' => 'array',
    ];

    /**
     * Columns the audit trail API may expose. The IP address and user agent
     * stay in the database for forensics but are no longer serialized, since
     * the audit trail screen does not display them.
     */
    protected $visible = [
        'id',
        'user_id',
        'user',
        'action',
        'target_type',
        'target_id',
        'description',
        'changes_payload',
        'created_at',
        'updated_at',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public static function record(?int $userId, string $action, ?string $targetType = null, ?int $targetId = null, ?string $description = null, ?array $changes = null): self
    {
        return self::create([
            'user_id' => $userId,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'description' => $description,
            'changes_payload' => $changes,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ]);
    }
}
