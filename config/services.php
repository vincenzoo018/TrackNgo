<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Semaphore SMS gateway (https://semaphore.co). The API key lives only in .env; never commit it.
    'semaphore' => [
        'api_key'         => env('SEMAPHORE_API_KEY'),
        // Must be a sender name approved on the Semaphore account; blank = Semaphore's default sender
        'sender_name'     => env('SEMAPHORE_SENDER_NAME'),
        'base_url'        => env('SEMAPHORE_BASE_URL', 'https://api.semaphore.co/api/v4'),
        'timeout'         => (int) env('SEMAPHORE_TIMEOUT', 10),
        'connect_timeout' => (int) env('SEMAPHORE_CONNECT_TIMEOUT', 5),
    ],

    /*
    | SMS switches (see app/Services/SmsService.php):
    |   SMS_ENABLED=false                    -> never calls Semaphore; SMS are logged as "simulated"
    |   SMS_ENABLED=true,  SMS_DRY_RUN=true  -> still simulated (dry run always wins)
    |   SMS_ENABLED=true,  SMS_DRY_RUN=false -> real SMS through Semaphore
    | Run `php artisan config:clear` after changing these if the config is cached.
    */
    'sms' => [
        'enabled'              => (bool) env('SMS_ENABLED', false),
        'dry_run'              => (bool) env('SMS_DRY_RUN', true),
        // Safety limits against loops, duplicate runs and accidental bulk sends
        'max_per_user_per_day' => (int) env('SMS_MAX_PER_USER_PER_DAY', 10),
        'max_per_document'     => (int) env('SMS_MAX_PER_DOCUMENT', 10),
        'min_interval_seconds' => (int) env('SMS_MIN_INTERVAL_SECONDS', 60),
        'max_per_day'          => (int) env('SMS_MAX_PER_DAY', 200),
        'max_attempts'         => (int) env('SMS_MAX_ATTEMPTS', 3),
    ],

    /*
    | Email notifications (see app/Services/Email/EmailService.php). The SMTP account itself is the MAIL_* settings
    | in config/mail.php. TRACKNGO_EMAIL_ENABLED=false records each event as "disabled" and sends nothing.
    | Run `php artisan config:clear` after changing these if the config is cached.
    */
    'email' => [
        'enabled'                   => (bool) env('TRACKNGO_EMAIL_ENABLED', false),
        // Our own ceiling, kept well below the provider's (Gmail's limits vary by account and can change)
        'max_per_day'               => (int) env('TRACKNGO_EMAIL_MAX_PER_DAY', 50),
        // Safety limit against loops and accidental bulk sends to one address
        'max_per_recipient_per_day' => (int) env('TRACKNGO_EMAIL_MAX_PER_RECIPIENT_PER_DAY', 10),
        'max_attempts'              => (int) env('TRACKNGO_EMAIL_MAX_ATTEMPTS', 3),
        // Placeholder domains of demo accounts (comma separated, e.g. "mati.com"): logged as skipped, never sent
        'blocked_domains'           => array_values(array_filter(array_map(
            fn ($domain) => strtolower(trim($domain)),
            explode(',', (string) env('TRACKNGO_EMAIL_BLOCKED_DOMAINS', ''))
        ))),
    ],

    /*
    | Cloudflare Turnstile captcha on the login and forgot-password forms (see app/Services/Security/Turnstile.php).
    | The secret key lives only in .env; never commit it. When enabled, a form is refused whenever the check cannot
    | be completed (missing keys, Cloudflare unreachable): it fails closed. Cloudflare's test keys are refused in
    | production. Run `php artisan config:clear` after changing these if the config is cached.
    */
    'turnstile' => [
        'enabled'               => (bool) env('TURNSTILE_ENABLED', true),
        'site_key'              => env('TURNSTILE_SITE_KEY'),
        'secret_key'            => env('TURNSTILE_SECRET_KEY'),
        'timeout'               => (int) env('TURNSTILE_TIMEOUT', 10),
        'connect_timeout'       => (int) env('TURNSTILE_CONNECT_TIMEOUT', 5),
        // Checks sent to Cloudflare per visitor IP per minute (each login / reset attempt is one check)
        'max_checks_per_minute' => (int) env('TURNSTILE_MAX_CHECKS_PER_MINUTE', 60),
    ],

];
