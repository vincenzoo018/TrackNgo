# TrackNgo

TrackNGo Mati — document management and monitoring system for the Office of the Mayor of Mati.

## Requirements

| Tool | Version |
|---|---|
| PHP | **8.4 or newer** (the locked Laravel 13 / Symfony 8.1 packages need PHP 8.4.1+) |
| Composer | 2.x |
| Node.js | 22.x |
| Database | MySQL (local development) — SQLite works too |

> If `composer install` says *"Your lock file does not contain a compatible set of packages"* and lists
> `requires php >=8.4.1`, your PHP is too old. Upgrade PHP (in Laragon: *Menu → PHP → Version*) — do not run
> `composer update` to work around it, that changes the package versions for everyone.

## First-time setup (after cloning)

```bash
composer install
cp .env.example .env          # then set DB_CONNECTION / DB_DATABASE etc. and the TURNSTILE_* keys (see below)
php artisan key:generate
php artisan migrate --seed
npm install
npm run build                 # or `npm run dev` while working on the frontend
```

## After pulling new changes

```bash
composer install              # installs exactly what composer.lock says
npm install
php artisan migrate           # applies any new migrations
npm run build
```

## ARTA escalation monitor (CART)

The CART module checks every active document against its ARTA processing period. Run the scheduler so it runs
every five minutes:

```bash
php artisan schedule:work     # development
# production: a cron entry for `php artisan schedule:run` every minute
```

Without the scheduler it still runs (at most once a minute) whenever CART pages are open. Settings are in
`config/arta.php`; set `ARTA_COUNT_WORKING_DAYS=true` in `.env` to count Monday–Friday only.

## Email notifications

Important events are emailed: completed / released / ready-for-release / extended / deemed-approved documents,
ARTA escalations (the handler; the applicant once at Overdue) and documents returned for correction. Applicants only
get an email when the Receiving Clerk recorded their address. Every email is logged in **Admin → Email Dashboard**,
where failed ones can be retried after the address is corrected.

1. In your local `.env` (never in `.env.example` or Git) set the Gmail account and a Google **App Password**
   (Google Account → Security → 2-Step Verification → App passwords; never the normal password):
   ```
   MAIL_MAILER=smtp
   MAIL_SCHEME=smtp
   MAIL_HOST=smtp.gmail.com
   MAIL_PORT=587
   MAIL_USERNAME=your-account@gmail.com
   MAIL_PASSWORD=your-16-letter-app-password
   MAIL_FROM_ADDRESS="your-account@gmail.com"
   MAIL_FROM_NAME="TrackNGo Mati"
   TRACKNGO_EMAIL_ENABLED=true
   TRACKNGO_EMAIL_BLOCKED_DOMAINS=mati.com   # demo accounts' placeholder domain: never emailed
   ```
2. `php artisan migrate`, then `php artisan config:clear`.
3. Check the setup: `php artisan email:test you@gmail.com` (at most 5 per day).
4. Emails are sent by the queue. `php artisan schedule:work` (or the production cron) runs the queue every minute;
   `composer dev` / `php artisan queue:work` can run as well.

Limits are in `.env`: `TRACKNGO_EMAIL_MAX_PER_DAY` (default 50; extra emails wait, they are not dropped),
`TRACKNGO_EMAIL_MAX_PER_RECIPIENT_PER_DAY` and `TRACKNGO_EMAIL_MAX_ATTEMPTS`. "Sent" means the mail server accepted
the message; a bounce can still arrive in the sending mailbox later. Set `TRACKING_URL` so links in emails open on
phones (e.g. `http://192.168.1.5:8000`).

## Login captcha (Cloudflare Turnstile)

The login and forgot-password forms carry a Cloudflare Turnstile check, confirmed on the server before the password
is looked at. It **fails closed**: without keys, or when Cloudflare cannot be reached, nobody can log in.

1. In the Cloudflare dashboard (Turnstile → the widget → Hostname Management) list every address people open
   TrackNGo on: `localhost` for local testing and the live domain before deploying. Turnstile does not run on an IP
   address such as `192.168.1.5` (the widget shows "Unable to connect to website", error 110200), so a LAN
   deployment needs a domain name. With `APP_ENV=local`, pages opened on `http://127.0.0.1:8000` (what
   `php artisan serve` prints) move to `http://localhost:8000` by themselves.
2. In your local `.env` (never in `.env.example` or Git):
   ```
   TURNSTILE_ENABLED=true
   TURNSTILE_SITE_KEY=your-site-key
   TURNSTILE_SECRET_KEY=your-secret-key
   ```
   For a quick local setup without the real keys, Cloudflare's test keys always pass: site
   `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA`. They are refused when
   `APP_ENV=production`.
3. `php artisan config:clear`. The server must reach `https://challenges.cloudflare.com` (and so must the
   browsers); failures are written to `storage/logs/laravel.log`.

## Tests and CI

```bash
php artisan test
```

GitHub Actions (`.github/workflows/tests.yml`) installs the app, runs the migrations, builds the frontend and runs
the test suite — those must pass. ESLint, Prettier, TypeScript, Pint and PHPStan also run but are **advisory**
(shown in the log, not failing the build) because the codebase predates them; remove `continue-on-error` from a
step once that check passes.
