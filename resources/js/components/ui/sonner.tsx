import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { appearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={appearance}
            className="toaster group"
            position="top-right"
            duration={6000}
            style={
                {
                    '--normal-bg': '#0066cc',
                    '--normal-text': '#ffffff',
                    '--normal-border': '#0055b3',
                    '--success-bg': '#0066cc',
                    '--success-text': '#ffffff',
                    '--info-bg': '#0066cc',
                    '--info-text': '#ffffff',
                } as React.CSSProperties
            }
            {...props}
        />
    );
}

export { Toaster };
