"use client";

import Button from "@/components/ui/Button";

type Props = {
    open: boolean;
    onDismiss: () => void;
};

export default function UrgentPaymentDoneDialog({ open, onDismiss }: Props) {
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            role="presentation"
        >
            <button
                type="button"
                className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
                aria-label="Dismiss"
                onClick={onDismiss}
            />
            <div
                className="relative z-10 w-full max-w-md rounded-2xl border border-emerald-200 bg-white p-6 shadow-xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="urgent-payment-done-title"
            >
                <h2
                    id="urgent-payment-done-title"
                    className="text-lg font-semibold text-slate-800"
                >
                    Payment complete
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                    You&apos;ve completed your urgent card payment. Thank you.
                </p>
                <div className="mt-6 flex justify-end">
                    <Button type="button" className="rounded-full" onClick={onDismiss}>
                        OK
                    </Button>
                </div>
            </div>
        </div>
    );
}
