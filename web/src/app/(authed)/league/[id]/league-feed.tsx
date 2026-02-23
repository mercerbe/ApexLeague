"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

interface MessageRecord {
  id: string;
  league_id: string;
  user_id: string;
  parent_message_id: string | null;
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

type FeedSortMode = "recent" | "active_threads";

export function LeagueFeed({ leagueId, isMember }: { leagueId: string; isMember: boolean }) {
  const [messages, setMessages] = useState<MessageRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<FeedSortMode>("recent");
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
      const response = await fetch(`/api/leagues/${leagueId}/messages?limit=200&sort=${sortMode}`, {
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
  }, [isMember, leagueId, sortMode]);

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

  const messageById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  const grouped = useMemo(() => {
    const parentMap = new Map<string, MessageRecord>();
    const repliesMap = new Map<string, MessageRecord[]>();

    for (const message of messages) {
      if (!message.parent_message_id) {
        parentMap.set(message.id, message);
        continue;
      }

      const current = repliesMap.get(message.parent_message_id) ?? [];
      current.push(message);
      repliesMap.set(message.parent_message_id, current);
    }

    const parentRows = [...parentMap.values()];

    if (sortMode === "recent") {
      parentRows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      parentRows.sort((a, b) => {
        const latestA = Math.max(
          new Date(a.created_at).getTime(),
          ...(repliesMap.get(a.id) ?? []).map((reply) => new Date(reply.created_at).getTime()),
        );
        const latestB = Math.max(
          new Date(b.created_at).getTime(),
          ...(repliesMap.get(b.id) ?? []).map((reply) => new Date(reply.created_at).getTime()),
        );
        return latestB - latestA;
      });
    }

    for (const replies of repliesMap.values()) {
      replies.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const orphanReplies = messages.filter((message) => message.parent_message_id && !parentMap.has(message.parent_message_id));

    return {
      parents: parentRows,
      repliesMap,
      orphanReplies,
    };
  }, [messages, sortMode]);

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
        body: JSON.stringify({ body, parent_message_id: replyParentId }),
      });

      const payload = (await response.json()) as CreateMessageResponse;

      if (!response.ok || !payload.message) {
        throw new Error(payload.error ?? "Unable to send message.");
      }

      const createdMessage = payload.message;
      setMessages((current) => [createdMessage, ...current]);
      setDraft("");
      setReplyParentId(null);
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
          <h2 className="text-xl font-semibold">Message Board</h2>
          <p className="mt-1 text-sm text-neutral-600">Start threads, post replies, and keep race takes organized.</p>
        </div>
        <span className="rounded-lg bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">{messageCount} messages</span>
      </div>

      {!isMember ? <p className="mt-4 text-sm text-neutral-600">Join this league to view and post messages.</p> : null}

      {isMember ? (
        <div className="mt-4">
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">Sort</span>
            <select
              className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as FeedSortMode)}
            >
              <option value="recent">Newest parent messages first</option>
              <option value="active_threads">Threads with latest activity first</option>
            </select>
          </label>
        </div>
      ) : null}

      {isMember ? (
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
          <div className="w-full">
            {replyParentId ? (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="truncate">
                  Replying to: {displayAuthor(messageById.get(replyParentId) ?? { id: "", league_id: "", user_id: "", parent_message_id: null, body: "", created_at: "" })}
                </p>
                <button type="button" onClick={() => setReplyParentId(null)} className="font-semibold underline">
                  Cancel
                </button>
              </div>
            ) : null}
            <textarea
              required
              maxLength={1000}
              placeholder={replyParentId ? "Write a reply..." : "Start a new thread or post an update..."}
              className="min-h-24 w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isSending || draft.trim().length === 0}
            className="h-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending ? "Posting..." : replyParentId ? "Reply" : "Post"}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {isMember && isLoading ? <p className="mt-4 text-sm text-neutral-600">Loading feed...</p> : null}

      {isMember && !isLoading && grouped.parents.length === 0 && grouped.orphanReplies.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600">No messages yet. Start the conversation.</p>
      ) : null}

      {isMember && !isLoading && grouped.parents.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {grouped.parents.map((message) => {
            const replies = grouped.repliesMap.get(message.id) ?? [];
            return (
              <li key={message.id} className="rounded-lg border border-neutral-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-neutral-900">{displayAuthor(message)}</p>
                  <p className="text-xs text-neutral-500">{new Date(message.created_at).toLocaleString()}</p>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{message.body}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" className="text-xs font-medium text-red-700 hover:underline" onClick={() => setReplyParentId(message.id)}>
                    Reply
                  </button>
                  <p className="text-xs text-neutral-500">{replies.length} replies</p>
                </div>

                {replies.length > 0 ? (
                  <ul className="mt-3 space-y-2 border-l border-neutral-200 pl-3">
                    {replies.map((reply) => (
                      <li key={reply.id} className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-medium text-neutral-900">{displayAuthor(reply)}</p>
                          <p className="text-xs text-neutral-500">{new Date(reply.created_at).toLocaleString()}</p>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{reply.body}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {isMember && !isLoading && grouped.orphanReplies.length > 0 ? (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-neutral-500">Recent Replies (No Parent In View)</p>
          <ul className="mt-2 space-y-2">
            {grouped.orphanReplies.map((message) => (
              <li key={message.id} className="rounded-md border border-neutral-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-neutral-900">{displayAuthor(message)}</p>
                <p className="text-xs text-neutral-500">{new Date(message.created_at).toLocaleString()}</p>
              </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-800">{message.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
