/**
 * Field rules shared by the account and intake forms, so a form shows exactly what is wrong before it posts.
 * They mirror the server: StoreDocumentRequest::NAME_PATTERN, App\Support\PhilippineMobile (numbers are stored
 * as 09XXXXXXXXX) and App\Rules\DocumentPin.
 */

/** Letters (incl. ñ / accented), spaces, periods, apostrophes and hyphens */
export const NAME_PATTERN = /^[\p{L}\s.'-]+$/u;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Under email fields: the server checks the format only (App\Support\EmailAddress), never that the mailbox exists */
export const EMAIL_HINT = 'Only the format is checked, not whether the mailbox exists';

export const MOBILE_LENGTH = 11;
export const MOBILE_HINT = '11 digits starting with 09, e.g. 09171234567';

/** Keeps only digits, at most 11 (a mobile number is typed as 09XXXXXXXXX) */
export const mobileDigits = (value: string) => value.replace(/\D/g, '').slice(0, MOBILE_LENGTH);

/** Why a mobile number is refused, or null when it is a valid 09XXXXXXXXX number */
export function mobileNumberError(value: string, label = 'mobile number'): string | null {
    const number = value.trim();

    if (!number) {
        return `The ${label} is required.`;
    }

    if (!/^\d+$/.test(number)) {
        return `Use digits only (${MOBILE_HINT}).`;
    }

    if (!number.startsWith('09')) {
        return `The ${label} must start with 09.`;
    }

    if (number.length !== MOBILE_LENGTH) {
        return `The ${label} must be exactly ${MOBILE_LENGTH} digits (${number.length} entered).`;
    }

    // Obvious filler such as 09000000000 or 09123456789
    const subscriber = number.slice(2);

    if (new Set(subscriber).size === 1 || subscriber === '123456789') {
        return `Enter a real ${label}, not a placeholder.`;
    }

    return null;
}

/** Why a person's name is refused, or null */
export function nameError(value: string, label: string, required: boolean): string | null {
    const name = value.trim();

    if (!name) {
        return required ? `The ${label} is required.` : null;
    }

    if (!NAME_PATTERN.test(name)) {
        return `The ${label} may only contain letters, spaces, periods, apostrophes and hyphens.`;
    }

    return null;
}

/** Why an email address is refused, or null */
export function emailError(value: string, required = true): string | null {
    const email = value.trim();

    if (!email) {
        return required ? 'The email address is required.' : null;
    }

    return EMAIL_PATTERN.test(email) ? null : 'Enter a valid email address, e.g. juan@mati.gov.ph.';
}

const COMMON_PINS = ['123123', '121212', '112233', '111222', '159753', '147258', '789456', '696969', '102030', '010203'];

/** One digit repeated, a straight run up or down, or a common pattern (App\Rules\DocumentPin::isEasyToGuess) */
export function pinIsEasyToGuess(pin: string): boolean {
    const digits = pin.split('').map(Number);
    const steps = new Set(digits.slice(1).map((digit, i) => digit - digits[i]));
    const [step] = steps;

    return new Set(digits).size === 1 || (steps.size === 1 && Math.abs(step) === 1) || COMMON_PINS.includes(pin);
}

/** Why a new document PIN (and its confirmation) is refused, or null */
export function documentPinError(pin: string, confirmation: string, required: boolean): string | null {
    if (!pin) {
        return required ? 'Set a 6-digit document PIN.' : (confirmation ? 'Enter the new PIN in both boxes.' : null);
    }

    if (!/^\d{6}$/.test(pin)) {
        return 'The document PIN must be exactly 6 digits.';
    }

    if (pinIsEasyToGuess(pin)) {
        return 'This PIN is too easy to guess. Avoid repeated digits, straight sequences and common patterns.';
    }

    return pin === confirmation ? null : 'The document PIN confirmation does not match.';
}
