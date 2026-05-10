import React from "react";

const CatalogSkeletonCard = ({ wide = false }) => (
    <div className={`rounded-[1.5rem] border border-[var(--line-soft)] bg-white/80 p-3 shadow-sm ${wide ? "w-full" : ""}`}>
        <div className="h-44 rounded-[1.25rem] bg-[var(--bg-soft)] animate-pulse" />
        <div className="mt-3 h-4 w-4/5 rounded-full bg-[var(--bg-soft)] animate-pulse" />
        <div className="mt-2 h-3 w-full rounded-full bg-[var(--bg-soft)] animate-pulse" />
        <div className="mt-3 h-8 w-24 rounded-full bg-[var(--bg-soft)] animate-pulse" />
    </div>
);

const OrderSkeletonRow = () => (
    <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-white/80 p-4 shadow-sm">
        <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-[var(--bg-soft)] animate-pulse" />
            <div className="flex-1 space-y-3">
                <div className="h-4 w-2/3 rounded-full bg-[var(--bg-soft)] animate-pulse" />
                <div className="h-3 w-1/2 rounded-full bg-[var(--bg-soft)] animate-pulse" />
                <div className="h-3 w-5/6 rounded-full bg-[var(--bg-soft)] animate-pulse" />
            </div>
        </div>
        <div className="mt-4 h-2 w-full rounded-full bg-[var(--bg-soft)] animate-pulse" />
    </div>
);

const Loading = ({ label = "Loading...", variant = "default" }) => {
    if (variant === "catalog") {
        return (
            <div className="space-y-6 py-2">
                <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">{label}</p>
                    <div className="h-4 w-24 rounded-full bg-[var(--bg-soft)] animate-pulse" />
                    <div className="h-8 w-72 max-w-full rounded-full bg-[var(--bg-soft)] animate-pulse" />
                    <div className="h-4 w-full max-w-2xl rounded-full bg-[var(--bg-soft)] animate-pulse" />
                    <div className="flex flex-wrap gap-3 pt-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-9 w-24 rounded-full bg-[var(--bg-soft)] animate-pulse" />
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {Array.from({ length: 10 }).map((_, index) => (
                        <CatalogSkeletonCard key={index} />
                    ))}
                </div>
            </div>
        );
    }

    if (variant === "orders") {
        return (
            <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">{label}</p>
                    <div className="h-5 w-40 rounded-full bg-[var(--bg-soft)] animate-pulse" />
                    <div className="h-3 w-64 rounded-full bg-[var(--bg-soft)] animate-pulse" />
                </div>
                <div className="grid gap-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <OrderSkeletonRow key={index} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[var(--accent)] border-gray-200 sm:h-14 sm:w-14"></div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">{label}</p>
        </div>
    )
}

export default Loading
