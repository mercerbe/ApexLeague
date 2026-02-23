import { ProfileForm } from "@/app/(authed)/profile/profile-form";

export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-neutral-600">Manage your identity used across league standings and feed messages.</p>
      <div className="mt-6">
        <ProfileForm />
      </div>
    </main>
  );
}
