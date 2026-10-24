<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Duplicate accident detection
    |--------------------------------------------------------------------------
    |
    | A report is treated as a possible duplicate when its GPS position falls
    | within the radius below AND its accident date/time falls within the time
    | window. Descriptions and accident types are intentionally ignored because
    | different Residents may describe the same accident differently.
    |
    | When GPS coordinates are missing, the written location is compared with
    | the configured address similarity threshold instead.
    |
    */

    'duplicate_detection' => [
        'radius_meters' => (int) env('ROADWATCH_DUPLICATE_RADIUS_METERS', 300),
        'time_window_minutes' => (int) env('ROADWATCH_DUPLICATE_TIME_WINDOW_MINUTES', 120),
        'address_similarity' => (float) env('ROADWATCH_DUPLICATE_ADDRESS_SIMILARITY', 0.60),
    ],

];
