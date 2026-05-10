import React from 'react'

const Loading = ({ label = "Loading..." }) => {
    return (
        <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-[var(--accent)] border-gray-200 sm:h-14 sm:w-14"></div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--ink-500)]">{label}</p>
        </div>
    )
}

export default Loading
