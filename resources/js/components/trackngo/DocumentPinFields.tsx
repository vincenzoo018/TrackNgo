import React from 'react';
import { cn } from '@/lib/utils';

/** Keeps only digits, at most 6 (a document PIN) */
export const pinDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

type PinInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
    value: string;
    onValueChange: (value: string) => void;
};

/** A masked 6-digit PIN box (number keypad on phones) */
export function PinInput({ value, onValueChange, className, ...props }: PinInputProps) {
    return (
        <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            pattern="\d{6}"
            placeholder="••••••"
            value={value}
            onChange={(e) => onValueChange(pinDigits(e.target.value))}
            className={cn('font-mono tracking-[0.4em]', className)}
            {...props}
        />
    );
}

type Props = {
    pin: string;
    confirmation: string;
    onPinChange: (value: string) => void;
    onConfirmationChange: (value: string) => void;
    required: boolean;
    label?: string;
    /** Shown under the fields when there is no error */
    hint?: React.ReactNode;
    error?: string;
    inputClassName: string;
    labelClassName: string;
};

/**
 * New document PIN + confirmation (HR / Admin account forms and Profile Settings). The PIN is asked before any
 * document is downloaded or exported.
 */
export function DocumentPinFields({ pin, confirmation, onPinChange, onConfirmationChange, required, label = 'Document PIN', hint, error, inputClassName, labelClassName }: Props) {
    const asterisk = required ? <span className="ml-0.5 text-red-500">*</span> : null;

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
                <label className={labelClassName}>{label}{asterisk}</label>
                <PinInput value={pin} onValueChange={onPinChange} required={required} aria-label={label} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
                <label className={labelClassName}>Confirm {label}{asterisk}</label>
                <PinInput value={confirmation} onValueChange={onConfirmationChange} required={required || pin !== ''} aria-label={`Confirm ${label}`} className={inputClassName} />
            </div>
            {error
                ? <p className="text-xs font-medium text-red-600 sm:col-span-2">{error}</p>
                : hint && <p className="text-[12px] text-slate-500 sm:col-span-2">{hint}</p>}
        </div>
    );
}

/** The hint under the PIN fields of the account forms */
export const PIN_RULES_HINT = '6 digits, asked before downloading or exporting documents. Avoid repeated digits and straight runs like 123456.';
