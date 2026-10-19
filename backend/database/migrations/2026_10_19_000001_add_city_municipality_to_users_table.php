<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add the citizen's city / municipality to their account.
     *
     * Nullable so existing users keep working without backfilling.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('city_municipality', 100)->nullable()->after('phone');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('city_municipality');
        });
    }
};