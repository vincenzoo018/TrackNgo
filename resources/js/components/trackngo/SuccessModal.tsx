import { Check } from 'lucide-react';
import { BaseModal } from './BaseModal';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    identifier?: string;
    message?: string;
    buttonText?: string;
}

export function SuccessModal({
    isOpen,
    onClose,
    title = 'Successfully',
    identifier,
    message = 'Action completed successfully.',
    buttonText = 'Continue'
}: SuccessModalProps) {
    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-sm"
        >
            <div className="flex flex-col items-center justify-center text-center p-2">
                <div className="relative mb-6">
                    {/* Outer glowing gradient ring */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-teal-400 to-emerald-300 blur-sm opacity-50" />
                    
                    {/* Inner circle with border */}
                    <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-transparent bg-white shadow-sm" style={{ backgroundClip: 'padding-box' }}>
                        {/* Gradient border effect via pseudo-element trick or just another div */}
                        <div className="absolute inset-[-4px] rounded-full bg-gradient-to-tr from-teal-400 to-emerald-300 -z-10" />
                        <div className="absolute inset-[2px] rounded-full bg-white -z-10" />
                        
                        <Check className="h-8 w-8 text-teal-500" strokeWidth={3} />
                    </div>
                </div>

                <div className="flex flex-col items-center gap-1.5">
                    <h3 className="text-2xl font-light text-slate-700 tracking-tight">
                        {title}
                    </h3>
                    {identifier && (
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200 shadow-2xs">
                            {identifier}
                        </span>
                    )}
                </div>
                
                <div className="mt-3">
                    <p className="text-sm text-slate-500 font-light">
                        {message}
                    </p>
                </div>

                <div className="mt-8 w-full">
                    <button
                        type="button"
                        className="w-full rounded-full bg-[#6fcab8] px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-[#5dbba8] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                        onClick={onClose}
                    >
                        {buttonText}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
}
