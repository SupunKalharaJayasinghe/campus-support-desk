"use client";

import {
    Children,
    useCallback,
    useMemo,
    useState,
    isValidElement,
    type ReactElement,
    type ReactNode,
} from "react";

export function Step({ children }: { children: ReactNode }) {
    return <div className="stepper-step">{children}</div>;
}

type StepperProps = {
    initialStep?: number;
    onStepChange?: (step: number) => void;
    onFinalStepCompleted?: () => void;
    backButtonText?: string;
    nextButtonText?: string;
    /** Label for the button on the last step (defaults to "Done"). */
    finalButtonText?: string;
    children: ReactNode;
};

export default function Stepper({
    initialStep = 1,
    onStepChange,
    onFinalStepCompleted,
    backButtonText = "Previous",
    nextButtonText = "Next",
    finalButtonText = "Done",
    children,
}: StepperProps) {
    const steps = useMemo(
        () => Children.toArray(children).filter(isValidElement) as ReactElement[],
        [children]
    );
    const total = steps.length;
    const safeTotal = Math.max(total, 1);

    const normalize = useCallback((n: number) => Math.min(Math.max(1, n), safeTotal), [safeTotal]);

    const [step, setStep] = useState(() => normalize(initialStep));

    const current = normalize(step);
    const index = current - 1;
    const isLast = current === safeTotal && total > 0;

    const handleBack = () => {
        if (current <= 1) return;
        const next = current - 1;
        setStep(next);
        onStepChange?.(next);
    };

    const handleNext = () => {
        if (isLast) {
            onFinalStepCompleted?.();
            return;
        }
        const next = current + 1;
        setStep(next);
        onStepChange?.(next);
    };

    if (total === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-500">
                <span>
                    Step {current} of {total}
                </span>
                <div className="flex gap-1" aria-hidden>
                    {steps.map((_, i) => (
                        <span
                            key={i}
                            className={`h-1.5 w-1.5 rounded-full ${
                                i === index ? "bg-blue-600" : "bg-slate-300"
                            }`}
                        />
                    ))}
                </div>
            </div>

            <div className="min-h-[10rem] rounded-xl border border-blue-100 bg-slate-50/80 p-4 text-sm text-slate-700">
                {steps[index]}
            </div>

            <div className="flex justify-between gap-2">
                <button
                    type="button"
                    onClick={handleBack}
                    disabled={current <= 1}
                    className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {backButtonText}
                </button>
                <button
                    type="button"
                    onClick={handleNext}
                    className="rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                >
                    {isLast ? finalButtonText : nextButtonText}
                </button>
            </div>
        </div>
    );
}
