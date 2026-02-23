"use client";

import { FormEvent, useEffect, useState } from "react";

interface ProfileRecord {
  id: string;
  handle: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileResponse {
  profile?: ProfileRecord;
  error?: string;
}

export function ProfileForm() {
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/profile", {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as ProfileResponse;

        if (!response.ok || !payload.profile) {
          throw new Error(payload.error ?? "Unable to load profile.");
        }

        if (!mounted) {
          return;
        }

        setProfile(payload.profile);
        setHandle(payload.profile.handle ?? "");
        setBio(payload.profile.bio ?? "");
        setAvatarUrl(payload.profile.avatar_url ?? "");
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load profile.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          handle,
          bio,
          avatar_url: avatarUrl,
        }),
      });

      const payload = (await response.json()) as ProfileResponse;

      if (!response.ok || !payload.profile) {
        throw new Error(payload.error ?? "Unable to update profile.");
      }

      setProfile(payload.profile);
      setHandle(payload.profile.handle ?? "");
      setBio(payload.profile.bio ?? "");
      setAvatarUrl(payload.profile.avatar_url ?? "");
      setSuccess("Profile updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6">
      <h2 className="text-xl font-semibold">Your Profile</h2>
      <p className="mt-1 text-sm text-neutral-600">Set your handle and avatar so league chat and standings show your identity.</p>

      {isLoading ? <p className="mt-4 text-sm text-neutral-600">Loading profile...</p> : null}

      {!isLoading ? (
        <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">Handle</span>
            <input
              maxLength={24}
              placeholder="racefan_01"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
            />
            <p className="text-xs text-neutral-500">3-24 chars. Letters, numbers, underscore only.</p>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">Avatar URL</span>
            <input
              placeholder="https://..."
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-neutral-700">Bio</span>
            <textarea
              maxLength={280}
              className="min-h-28 w-full rounded-lg border border-neutral-300 px-3 py-2"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
            <p className="text-xs text-neutral-500">{bio.length}/280</p>
          </label>

          <button
            type="submit"
            disabled={isSaving}
            className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Profile"}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {success ? <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{success}</p> : null}

      {profile ? (
        <p className="mt-4 text-xs text-neutral-500">Last updated: {new Date(profile.updated_at).toLocaleString()}</p>
      ) : null}
    </section>
  );
}
