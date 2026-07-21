import { useState } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';

interface ReportGeneratorProps {
    label?: string;
}

export function ReportGenerator({ label = "Generate Report" }: ReportGeneratorProps) {
    const [generating, setGenerating] = useState(false);

    const handleGenerate = () => {
        setGenerating(true);
        // Simulate report generation
        setTimeout(() => {
            setGenerating(false);
            toast.success('Report generated successfully!');
        }, 2000);
    };

    return (
        <button 
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-[var(--tng-slate-900)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--tng-slate-800)] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {generating ? (
                <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Generating PDF...
                </>
            ) : (
                <>
                    <Download className="h-4 w-4" /> {label}
                </>
            )}
        </button>
    );
}
