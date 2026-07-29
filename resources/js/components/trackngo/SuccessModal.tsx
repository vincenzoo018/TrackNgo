import { X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    buttonText?: string;
}

export function SuccessModal({
    isOpen,
    onClose,
    title = 'Successfully',
    message = 'Action completed successfully.',
    buttonText = 'Continue'
}: SuccessModalProps) {
    
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; }
    }, [isOpen]);

    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm transform overflow-hidden rounded-2xl bg-white p-8 text-center shadow-xl transition-all animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="h-5 w-5" />
                </button>
                
                <div className="flex flex-col items-center justify-center">
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

                    <h3 className="text-2xl font-light text-slate-700 tracking-tight">
                        {title}
                    </h3>
                    
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
            </div>
        </div>,
        document.body
    );
}
