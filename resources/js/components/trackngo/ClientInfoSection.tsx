import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * External client details captured by the Receiving Clerk (stored in document_clients).
 * Fields follow the standard LGU records intake slip; client types follow the ARTA classification.
 * The address uses the PSA list (ph_provinces → ph_cities → ph_barangays) served by LocationController.
 */
export type ClientInfo = {
    client_type: string;
    first_name: string;
    middle_name: string;
    last_name: string;
    suffix: string;
    sex: string;
    organization: string;
    house_street: string;
    barangay: string;
    city_municipality: string;
    province: string;
    contact_number: string;
    email: string;
    id_type: string;
    id_number: string;
    receipt_mode: string;
    purpose: string;
    representative_name: string;
};

export const EMPTY_CLIENT: ClientInfo = {
    client_type: 'Citizen',
    first_name: '',
    middle_name: '',
    last_name: '',
    suffix: '',
    sex: '',
    organization: '',
    house_street: '',
    barangay: '',
    city_municipality: 'City of Mati',
    province: 'Davao Oriental',
    contact_number: '',
    email: '',
    id_type: '',
    id_number: '',
    receipt_mode: 'Walk-in',
    purpose: '',
    representative_name: '',
};

// Must match StoreDocumentRequest::CLIENT_TYPES / CLIENT_SEXES / RECEIPT_MODES
const CLIENT_TYPES = ['Citizen', 'Business', 'Government'];
const SEXES = ['Male', 'Female'];
const RECEIPT_MODES = ['Walk-in', 'Mail / Courier', 'Email'];
const SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV'];

const ID_TYPES = [
    'PhilSys National ID',
    "Driver's License",
    'Passport',
    'UMID',
    'SSS ID',
    'GSIS eCard',
    'PRC ID',
    'Postal ID',
    "Voter's ID / Certification",
    'PhilHealth ID',
    'TIN ID',
    'Senior Citizen ID',
    'PWD ID',
    'Barangay ID / Certification',
    'Company / School ID',
    'Other',
];

const COMMON_PURPOSES = [
    "Request for Mayor's Clearance",
    'Business Permit Application / Renewal',
    'Request for Financial Assistance',
    'Request for Medical / Burial Assistance',
    'Request for Certification',
    'Request for Endorsement / Recommendation',
    'Invitation / Request for Courtesy Call',
    'Request for Use of Facility / Venue',
    'Solicitation / Sponsorship Request',
    'Complaint / Grievance',
];

// Must match StoreDocumentRequest (NAME_PATTERN and the 09XXXXXXXXX contact rule)
const NAME_PATTERN = /^[\p{L}\s.'-]+$/u;
const CONTACT_PATTERN = /^09\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Client-side mirror of the client rules in StoreDocumentRequest, keyed like the server errors. */
export function validateClient(client: ClientInfo): Record<string, string> {
    const found: Record<string, string> = {};
    const required: [keyof ClientInfo, string][] = [
        ['first_name', 'First name is required.'],
        ['last_name', 'Last name is required.'],
        ['province', 'Select a province.'],
        ['city_municipality', 'Select a city / municipality.'],
        ['barangay', 'Select a barangay.'],
        ['contact_number', 'Contact number is required.'],
        ['purpose', 'Purpose of request is required.'],
    ];
    required.forEach(([key, message]) => {
        if (!String(client[key] ?? '').trim()) {
            found[`client.${key}`] = message;
        }
    });

    (['first_name', 'middle_name', 'last_name', 'representative_name'] as const).forEach(key => {
        const value = client[key].trim();
        if (value && !NAME_PATTERN.test(value)) {
            found[`client.${key}`] = 'Use letters only (spaces, periods, apostrophes and hyphens are allowed).';
        }
    });
    if (client.contact_number && !CONTACT_PATTERN.test(client.contact_number)) {
        found['client.contact_number'] = 'Must be 11 digits starting with 09, e.g. 09171234567.';
    }
    if (client.email.trim() && !EMAIL_PATTERN.test(client.email.trim())) {
        found['client.email'] = 'Enter a valid email address, e.g. name@example.com.';
    }
    if (client.id_type && !client.id_number.trim()) {
        found['client.id_number'] = 'Enter the ID number.';
    }
    if (client.purpose.trim() && client.purpose.trim().length < 5) {
        found['client.purpose'] = 'Describe the purpose in at least 5 characters.';
    }
    return found;
}

type Place = { code: string; name: string };

// PSA lists rarely change, so each level is fetched once per page load
const placeCache = new Map<string, Promise<Place[]>>();
function loadPlaces(url: string): Promise<Place[]> {
    if (!placeCache.has(url)) {
        placeCache.set(url, fetch(url, { headers: { Accept: 'application/json' } })
            .then(res => (res.ok ? res.json() : []))
            .catch(() => {
                placeCache.delete(url);
                return [];
            }));
    }
    return placeCache.get(url)!;
}

const inputClass = (hasError?: boolean) => cn(
    'h-9 w-full rounded-lg border bg-white px-3 text-sm text-[var(--tng-slate-900)] placeholder:text-[var(--tng-slate-400)] focus:outline-none focus:ring-2 focus:ring-[var(--tng-blue-500)]/20 disabled:bg-[var(--tng-slate-50)] disabled:text-[var(--tng-slate-400)]',
    hasError ? 'border-red-400 focus:border-red-500' : 'border-[var(--tng-slate-200)] focus:border-[var(--tng-blue-500)]'
);

function Field({ label, required, error, hint, className, children }: {
    label: string;
    required?: boolean;
    error?: string;
    hint?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={className}>
            <label className="mb-1.5 block text-xs font-medium text-[var(--tng-slate-700)]">
                {label} {required && <span className="text-red-500 font-semibold">*</span>}
            </label>
            {children}
            {error
                ? <p className="text-[11px] text-red-600 mt-1 font-medium">{error}</p>
                : hint && <p className="text-[11px] text-[var(--tng-slate-500)] mt-1">{hint}</p>}
        </div>
    );
}

type ClientInfoSectionProps = {
    client: ClientInfo;
    /** Errors from the submit attempt / server, keyed "client.field" */
    errors: Record<string, string | undefined>;
    onChange: (field: keyof ClientInfo, value: string) => void;
};

export function ClientInfoSection({ client, errors, onChange }: ClientInfoSectionProps) {
    // Inline validation appears once a field has been left, so errors show while typing the next one
    const [touched, setTouched] = useState<Set<keyof ClientInfo>>(new Set());
    const touch = (field: keyof ClientInfo) => setTouched(prev => (prev.has(field) ? prev : new Set(prev).add(field)));
    const liveErrors = validateClient(client);
    const err = (field: keyof ClientInfo) => errors[`client.${field}`] ?? (touched.has(field) ? liveErrors[`client.${field}`] : undefined);

    const [provinces, setProvinces] = useState<Place[]>([]);
    const [cities, setCities] = useState<Place[]>([]);
    const [barangays, setBarangays] = useState<Place[]>([]);
    const provinceCode = provinces.find(p => p.name === client.province)?.code ?? '';
    const cityCode = cities.find(c => c.name === client.city_municipality)?.code ?? '';

    useEffect(() => {
        loadPlaces('/locations/provinces').then(setProvinces);
    }, []);

    useEffect(() => {
        setCities([]);
        if (provinceCode) {
            loadPlaces(`/locations/provinces/${provinceCode}/cities`).then(setCities);
        }
    }, [provinceCode]);

    useEffect(() => {
        setBarangays([]);
        if (cityCode) {
            loadPlaces(`/locations/cities/${cityCode}/barangays`).then(setBarangays);
        }
    }, [cityCode]);

    const text = (field: keyof ClientInfo, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
        <input
            type="text"
            value={client[field]}
            onChange={e => onChange(field, e.target.value)}
            onBlur={() => touch(field)}
            className={inputClass(Boolean(err(field)))}
            {...props}
        />
    );

    const select = (field: keyof ClientInfo, options: React.ReactNode, props: React.SelectHTMLAttributes<HTMLSelectElement> = {}) => (
        <select
            value={client[field]}
            onChange={e => onChange(field, e.target.value)}
            onBlur={() => touch(field)}
            className={inputClass(Boolean(err(field)))}
            {...props}
        >
            {options}
        </select>
    );

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Client Type" required error={err('client_type')}>
                    <div className="grid grid-cols-3 gap-1 rounded-lg border border-[var(--tng-slate-200)] bg-[var(--tng-slate-50)] p-1">
                        {CLIENT_TYPES.map(type => (
                            <button
                                key={type}
                                type="button"
                                onClick={() => onChange('client_type', type)}
                                className={cn(
                                    'rounded-md py-1 text-xs font-medium transition-colors',
                                    client.client_type === type
                                        ? 'bg-white text-[var(--tng-blue-700)] shadow-xs border border-[var(--tng-slate-200)]'
                                        : 'text-[var(--tng-slate-600)] hover:text-[var(--tng-slate-900)]'
                                )}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </Field>
                <Field label="Mode of Receipt" required error={err('receipt_mode')}>
                    {select('receipt_mode', RECEIPT_MODES.map(mode => <option key={mode} value={mode}>{mode}</option>))}
                </Field>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-12">
                <Field label="First Name" required error={err('first_name')} className="col-span-2 sm:col-span-4">
                    {text('first_name', { maxLength: 60 })}
                </Field>
                <Field label="Middle Name" error={err('middle_name')} className="col-span-1 sm:col-span-3">
                    {text('middle_name', { maxLength: 60 })}
                </Field>
                <Field label="Last Name" required error={err('last_name')} className="col-span-1 sm:col-span-3">
                    {text('last_name', { maxLength: 60 })}
                </Field>
                <Field label="Suffix" error={err('suffix')} className="col-span-2 sm:col-span-2">
                    {select('suffix', <><option value="">None</option>{SUFFIXES.map(s => <option key={s} value={s}>{s}</option>)}</>)}
                </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <Field label="Sex" error={err('sex')} className="sm:col-span-4">
                    {select('sex', <><option value="">Prefer not to say</option>{SEXES.map(s => <option key={s} value={s}>{s}</option>)}</>)}
                </Field>
                <Field
                    label={client.client_type === 'Citizen' ? 'Organization / Company (Optional)' : 'Organization / Company'}
                    error={err('organization')}
                    className="sm:col-span-8"
                >
                    {text('organization', { maxLength: 150, placeholder: client.client_type === 'Government' ? 'Agency or office name' : 'Business or organization name' })}
                </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Province" required error={err('province')}>
                    {select('province', (
                        <>
                            <option value="">{provinces.length ? 'Select province...' : 'Loading provinces...'}</option>
                            {provinces.map(p => <option key={p.code} value={p.name}>{p.name}</option>)}
                        </>
                    ), {
                        onChange: e => {
                            onChange('province', e.target.value);
                            onChange('city_municipality', '');
                            onChange('barangay', '');
                        },
                    })}
                </Field>
                <Field label="City / Municipality" required error={err('city_municipality')}>
                    {select('city_municipality', (
                        <>
                            <option value="">{provinceCode ? 'Select city / municipality...' : 'Select a province first'}</option>
                            {cities.map(c => <option key={c.code} value={c.name}>{c.name}</option>)}
                        </>
                    ), {
                        disabled: !provinceCode,
                        onChange: e => {
                            onChange('city_municipality', e.target.value);
                            onChange('barangay', '');
                        },
                    })}
                </Field>
                <Field label="Barangay" required error={err('barangay')}>
                    {select('barangay', (
                        <>
                            <option value="">{cityCode ? 'Select barangay...' : 'Select a city / municipality first'}</option>
                            {barangays.map(b => <option key={b.code} value={b.name}>{b.name}</option>)}
                        </>
                    ), { disabled: !cityCode })}
                </Field>
                <Field label="House No. / Street / Purok" error={err('house_street')}>
                    {text('house_street', { maxLength: 150, placeholder: 'e.g. Purok 3, Rizal St.' })}
                </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Contact Number" required error={err('contact_number')} hint="11 digits, e.g. 09171234567">
                    {text('contact_number', {
                        inputMode: 'numeric',
                        maxLength: 11,
                        placeholder: '09XXXXXXXXX',
                        onChange: e => onChange('contact_number', e.target.value.replace(/\D/g, '').slice(0, 11)),
                    })}
                </Field>
                <Field label="Email Address" error={err('email')}>
                    {text('email', { maxLength: 100, type: 'email', placeholder: 'name@example.com' })}
                </Field>
                <Field label="ID Presented" error={err('id_type')}>
                    {select('id_type', <><option value="">No ID presented</option>{ID_TYPES.map(id => <option key={id} value={id}>{id}</option>)}</>, {
                        onChange: e => {
                            onChange('id_type', e.target.value);
                            if (!e.target.value) {
                                onChange('id_number', '');
                            }
                        },
                    })}
                </Field>
                <Field label="ID Number" required={Boolean(client.id_type)} error={err('id_number')}>
                    {text('id_number', { maxLength: 50, disabled: !client.id_type, placeholder: client.id_type ? 'ID number' : '—' })}
                </Field>
            </div>

            <Field label="Authorized Representative (if filed on behalf of the client)" error={err('representative_name')}>
                {text('representative_name', { maxLength: 150, placeholder: 'Full name of representative' })}
            </Field>

            <Field label="Purpose of Request" required error={err('purpose')}>
                {text('purpose', { maxLength: 255, list: 'tng-common-purposes', placeholder: 'e.g. Request for Financial Assistance' })}
                <datalist id="tng-common-purposes">
                    {COMMON_PURPOSES.map(p => <option key={p} value={p} />)}
                </datalist>
            </Field>
        </div>
    );
}
