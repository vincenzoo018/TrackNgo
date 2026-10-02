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
cp .env.example .env          # then set DB_CONNECTION / DB_DATABASE etc. for your database
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

## Tests and CI

```bash
php artisan test
```

GitHub Actions (`.github/workflows/tests.yml`) installs the app, runs the migrations, builds the frontend and runs
the test suite — those must pass. ESLint, Prettier, TypeScript, Pint and PHPStan also run but are **advisory**
(shown in the log, not failing the build) because the codebase predates them; remove `continue-on-error` from a
step once that check passes.
