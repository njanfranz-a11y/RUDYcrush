<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class AccidentPhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'accident_report_id',
        'file_path',
        'file_name',
        'original_name',
        'file_size',
        'mime_type',
        'caption',
    ];

    protected $appends = ['url', 'api_url'];

    public function getUrlAttribute(): string
    {
        return asset('storage/' . $this->file_path);
    }

    public function getApiUrlAttribute(): string
    {
        return url('/api/v1/photos/' . $this->id . '/file');
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(AccidentReport::class, 'accident_report_id');
    }
}
