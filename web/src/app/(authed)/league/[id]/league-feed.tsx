"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

interface MessageRecord {
  id: string;
  league_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profile?: { handle: string | null } | null;
}

interface MessageListResponse {
  messages?: MessageRecord[];
  error?: string;
}

interface CreateMessageResponse {
  message?: MessageRecord;
  error?: string;
}

function displayAuthor(message: MessageRecord) {
  return message.profile?.handle?.trim() || message.user_id.slice(0, 8);
}

export function LeagueFeed({ leagueId, isMember }: { leagueId: string; isMember: boolean }) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(isMember);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messageCount = useMemo(() => messages.length, [messages]);

  const loadMessages = useCallback(async () => {
    if (!isMember) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/messages?limit=50`, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json()) as MessageListResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load league feed.");
      }

      setMessages(payload.messages ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load league feed.");
    } finally {
      setIsLoading(false);
    }
  }, [isMember, leagueId]);

  useEffect(() => {
    if (!isMember) {
      setIsLoading(false);
      return;
    }

    loadMessages();

    const interval = setInterval(() => {
      loadMessages();
    }, 10000);

    return () => clearInterval(interval);
  }, [isMember, loadMessages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();

    if (!body) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ body }),
      });

      const payload = (await response.json()) as CreateMessageResponse;

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Unable to send message.");
      }

      const createdMessage = payload.message;
      setMessages((current) => [...current, createdMessage]);
      setDraft("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send message.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">League Feed</h2>
          <p className="mt-1 text-sm text-neutral-600">Chat with league members and share race takes.</p>
        </div>
        <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{messageCount} messages</span>
      </div>

      {!isMember ? <p className="mt-4 text-sm text-neutral-600">Join this league to view and post messages.</p> : null}

      {isMember ? (
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <textarea
            required
            maxLength={1000}
            placeholder="Drop your prediction..."
            className="min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button
            type="submit"
            disabled={isSending || draft.trim().length === 0}
            className="h-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {isMember && isLoading ? <p className="mt-4 text-sm text-neutral-600">Loading feed...</p> : null}

      {isMember && !isLoading && messages.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No messages yet. Start the conversation.</p>
      ) : null}

      {isMember && !isLoading && messages.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {messages.map((message) => (
            <li key={message.id} className="rounded-lg border border-neutral-200 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-neutral-900">{displayAuthor(message)}</p>
                <p className="text-xs text-neutral-500">{new Date(message.created_at).toLocaleString()}</p>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{message.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
