"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useAppContext } from "@/context/AppContext";
import { loadSupportHistory, resolveSupportHistoryFromOrders, SUPPORT_HISTORY_EVENT } from "@/lib/supportHistory";
import { SUPPORT_ACTION_LABELS, getShortOrderId } from "@/lib/supportCenter";

const formatDate = (value) => {
  if (!value) return "Not yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not yet";

  return parsed.toLocaleDateString("en-GB");
};

const formatDateTime = (value) => {
  if (!value) return "Pending";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Pending";

  return `${parsed.toLocaleDateString("en-GB")} ${parsed.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const getBadgeClass = (status) => {
  if (status === "resolved") return "bg-green-100 text-green-700";
  if (status === "in-progress") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
};

const SupportQueryHistory = ({
  mobileFullScreen = false,
  helpReturnHref = "/help",
  onOpenChat = null,
  className = "",
}) => {
  const router = useRouter();
  const { user, getToken } = useAppContext();
  const [history, setHistory] = useState([]);
  const [viewFilter, setViewFilter] = useState("all");

  const handleOpenChat = () => {
    if (typeof onOpenChat === "function") {
      onOpenChat();
      return;
    }

    router.push("/help?mode=chat");
  };

  const loadHistory = () => {
    setHistory(loadSupportHistory());
  };

  useEffect(() => {
    loadHistory();

    const syncFromStorage = () => loadHistory();
    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(SUPPORT_HISTORY_EVENT, syncFromStorage);

    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(SUPPORT_HISTORY_EVENT, syncFromStorage);
    };
  }, []);

  useEffect(() => {
    const refreshHistoryStatus = async () => {
      if (!user) return;

      try {
        const token = await getToken();
        const { data } = await axios.get("/api/order/list", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (data.success) {
          resolveSupportHistoryFromOrders((data.orders || []).slice());
          setHistory(loadSupportHistory());
        }
      } catch (error) {
        console.log("Unable to refresh query history", error);
      }
    };

    refreshHistoryStatus();
  }, [getToken, user]);

  const filteredHistory = useMemo(() => {
    if (viewFilter === "open") {
      return history.filter((item) => item.status !== "resolved");
    }

    if (viewFilter === "resolved") {
      return history.filter((item) => item.status === "resolved");
    }

    return history;
  }, [history, viewFilter]);

  const shellClasses = mobileFullScreen
    ? "fixed inset-0 z-50 h-[100dvh] w-full sm:relative sm:z-auto"
    : "relative w-full";

  return (
    <section className={`${shellClasses} ${className}`}>
      <div className={`brand-surface flex h-full flex-col overflow-hidden rounded-none sm:rounded-[2rem] ${mobileFullScreen ? "border-0 shadow-none" : ""}`}>
        <div className="border-b border-[var(--line-soft)] bg-[linear-gradient(135deg,#f8f4ec_0%,#e7ede2_100%)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="brand-tag inline-flex rounded-full px-4 py-1 text-[10px] uppercase tracking-[0.22em]">
                Query history
              </span>
              <h3 className="mt-3 text-2xl font-bold text-[var(--ink-900)]">Saved support requests</h3>
              <p className="mt-1 text-sm text-[var(--ink-500)]">
                Track cancel and return requests until they are resolved.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleOpenChat}
                className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--accent-tint)]"
              >
                Open chat
              </button>
              {mobileFullScreen ? (
                <button
                  type="button"
                  onClick={() => router.push(helpReturnHref)}
                  className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--accent-tint)]"
                >
                  Home
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-b border-[var(--line-soft)] bg-white px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {["all", "open", "resolved"].map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setViewFilter(filter)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  viewFilter === filter
                    ? "bg-[var(--accent-strong)] text-white"
                    : "border border-[var(--line-soft)] bg-[var(--bg-soft)] text-[var(--ink-700)] hover:bg-[var(--accent-tint)]"
                }`}
              >
                {filter === "all" ? "All" : filter === "open" ? "Open" : "Solved"}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,#f6f1e8_0%,#fdfbf7_40%,#fbfaf6_100%)] p-5">
          {!user ? (
            <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-white p-6 text-center text-sm text-[var(--ink-500)]">
              Sign in to see your saved cancellation and return requests.
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-white p-6 text-center">
              <p className="text-lg font-semibold text-[var(--ink-900)]">No saved queries yet</p>
              <p className="mt-2 text-sm text-[var(--ink-500)]">
                Start a cancel or return request in chat and it will appear here until it is solved.
              </p>
              <button
                type="button"
                onClick={handleOpenChat}
                className="brand-button mt-5 inline-flex rounded-full px-5 py-3 text-sm font-semibold"
              >
                Open support chat
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[1.5rem] border border-[var(--line-soft)] bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ink-900)]">
                        {SUPPORT_ACTION_LABELS[item.action] || item.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--ink-500)]">
                        {item.productName} {getShortOrderId(item.orderId)}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getBadgeClass(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-[var(--ink-700)]">
                    {item.summary || `Order status: ${item.orderStatus || "Unknown"}`}
                  </p>

                  {Array.isArray(item.timeline) && item.timeline.length > 0 ? (
                    <div className="mt-4 rounded-[1.25rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">
                        Progress
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {item.timeline.map((step) => (
                          <div
                            key={`${item.id}-${step.label}`}
                            className={`rounded-[1rem] border px-3 py-2 ${
                              step.date
                                ? "border-[var(--accent)] bg-white"
                                : "border-dashed border-[var(--line-soft)] bg-white/75"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-semibold text-[var(--ink-900)]">{step.label}</p>
                              <span className="rounded-full bg-[var(--accent-tint)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-strong)]">
                                {step.date ? "Updated" : "Pending"}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-[var(--ink-500)]">{formatDateTime(step.date)}</p>
                            {step.note ? <p className="mt-1 text-[11px] leading-5 text-[var(--ink-500)]">{step.note}</p> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--ink-500)]">
                    <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">Order {item.orderShortId}</span>
                    <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">Created {formatDate(item.createdAt)}</span>
                    <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">Updated {formatDate(item.updatedAt)}</span>
                    {item.orderStatus ? <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">Current {item.orderStatus}</span> : null}
                    {item.paymentState ? <span className="rounded-full bg-[var(--bg-soft)] px-3 py-1">{item.paymentState}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SupportQueryHistory;
