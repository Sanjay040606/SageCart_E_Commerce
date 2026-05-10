"use client";

import { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useClerk } from "@clerk/nextjs";
import { useAppContext } from "@/context/AppContext";

const SupportFeedbackBox = ({
  pageKey = "general",
  title = "What should SageCart improve?",
  subtitle = "Share one clear note, idea, or fix request. We'll send it from your signed-in account email.",
  className = "",
}) => {
  const { user } = useAppContext();
  const { openSignIn, loaded: clerkLoaded } = useClerk();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress
    || user?.emailAddresses?.[0]?.emailAddress
    || "";

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user) {
      if (!clerkLoaded) {
        toast.error("Please wait a moment and try again.");
        return;
      }

      openSignIn();
      return;
    }

    if (!message.trim()) {
      toast.error("Please write your feedback first.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data } = await axios.post("/api/feedback", {
        page: pageKey,
        subject: subject.trim(),
        message: message.trim(),
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to send feedback.");
      }

      toast.success("Your feedback was sent to SageCart.");
      setSubject("");
      setMessage("");
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || "Failed to send feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <section className={`brand-surface rounded-[2rem] p-6 md:p-8 ${className}`}>
        <div className="mb-5">
          <span className="brand-tag inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em] mb-4">
            Feedback
          </span>
          <h3 className="text-2xl font-bold text-[var(--ink-900)]">Sign in to leave feedback</h3>
          <p className="mt-2 text-[var(--ink-500)]">
            Use your SageCart account so the message can go out from your account email automatically.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!clerkLoaded) return;
            openSignIn();
          }}
          disabled={!clerkLoaded}
          className="brand-button rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {clerkLoaded ? "Sign in to continue" : "Loading sign in..."}
        </button>
      </section>
    );
  }

  return (
    <section className={`brand-surface rounded-[2rem] p-6 md:p-8 ${className}`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="brand-tag inline-flex rounded-full px-4 py-1 text-xs uppercase tracking-[0.22em] mb-4">
            Feedback
          </span>
          <h3 className="text-2xl font-bold text-[var(--ink-900)]">{title}</h3>
          <p className="mt-2 max-w-2xl text-[var(--ink-500)]">{subtitle}</p>
        </div>

        <div className="rounded-[1.25rem] border border-[var(--line-soft)] bg-white/80 px-4 py-3 text-xs text-[var(--ink-500)]">
          <p className="font-semibold text-[var(--ink-900)]">Signed in as</p>
          <p className="mt-1 break-all">{email || "Your account email"}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[0.95fr_1.45fr]">
        <div className="rounded-[1.5rem] border border-[var(--line-soft)] bg-[linear-gradient(135deg,#f8f4ec_0%,#edf2e8_100%)] p-5">
          <p className="text-sm font-semibold text-[var(--ink-900)]">What to share</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--ink-500)]">
            <li>Product ideas and UI suggestions</li>
            <li>Bugs or confusing flows you want fixed</li>
            <li>Notes about support, orders, or checkout</li>
          </ul>
          <p className="mt-4 text-xs text-[var(--ink-500)]">
            One clear message is enough. Replies will go through the SageCart support inbox.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--ink-900)]">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Short subject line"
              className="w-full rounded-[1rem] border border-[var(--line-soft)] bg-white/85 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[var(--ink-900)]">Your feedback</label>
            <textarea
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What should SageCart improve?"
              className="w-full resize-none rounded-[1rem] border border-[var(--line-soft)] bg-white/85 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="brand-button w-full rounded-full px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send feedback"}
          </button>
        </div>
      </form>
    </section>
  );
};

export default SupportFeedbackBox;
