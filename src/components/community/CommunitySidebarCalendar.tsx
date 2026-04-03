"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];

function startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
    return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

type CommunitySidebarCalendarProps = {
    className?: string;
};

export default function CommunitySidebarCalendar({ className = "" }: CommunitySidebarCalendarProps) {
    const [view, setView] = useState(() => startOfMonth(new Date()));
    const today = useMemo(() => new Date(), []);

    const { year, monthIndex, monthLabel, cells } = useMemo(() => {
        const year = view.getFullYear();
        const monthIndex = view.getMonth();
        const monthLabel = view.toLocaleString(undefined, { month: "long", year: "numeric" });

        const first = new Date(year, monthIndex, 1);
        const last = new Date(year, monthIndex + 1, 0);
        const daysInMonth = last.getDate();
        const leadEmpty = first.getDay();

        const cells: ({ day: number } | null)[] = [];
        for (let i = 0; i < leadEmpty; i += 1) cells.push(null);
        for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day });

        return { year, monthIndex, monthLabel, cells };
    }, [view]);

    return (
        <section
            className={`rounded-xl border border-blue-100 bg-white/95 p-3 shadow-sm ${className}`}
            aria-label="Calendar"
        >
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Calendar</h2>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        onClick={() => setView((v) => addMonths(v, -1))}
                        className="rounded-lg p-1 text-slate-600 hover:bg-blue-50"
                        aria-label="Previous month"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setView((v) => addMonths(v, 1))}
                        className="rounded-lg p-1 text-slate-600 hover:bg-blue-50"
                        aria-label="Next month"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
            <p className="mt-1 text-sm font-semibold text-slate-800">{monthLabel}</p>

            <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[10px] font-semibold text-slate-400">
                {weekdayLabels.map((w, i) => (
                    <div key={`${w}-${i}`} className="py-0.5">
                        {w}
                    </div>
                ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1 text-center">
                {cells.map((cell, i) => {
                    if (!cell) {
                        return <div key={`empty-${i}`} className="aspect-square" />;
                    }
                    const date = new Date(year, monthIndex, cell.day);
                    const isToday = isSameDay(date, today);
                    return (
                        <div
                            key={cell.day}
                            className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium ${
                                isToday
                                    ? "bg-blue-700 text-white shadow-sm"
                                    : "text-slate-700 hover:bg-blue-50"
                            }`}
                        >
                            {cell.day}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
