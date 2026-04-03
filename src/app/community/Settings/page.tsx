"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    Camera,
    CheckCircle2,
    Eye,
    EyeOff,
    Save,
    Shield,
    User,
} from "lucide-react";
import Container from "@/components/ui/Container";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import communityBackground from "@/app/images/community/community2.jpg";
import {
    COMMUNITY_PROFILE_AVATAR_MAX_CHARS,
    getCommunityProfileSettingsHydrationBaseline,
    readCommunityProfileSettings,
    saveCommunityProfileSettings,
    type CommunityProfileSettings,
} from "@/lib/community-profile";
import { authHeaders, readStoredUser, updateStoredUser } from "@/lib/rbac";

const AVATAR_FILE_MAX_BYTES = 600 * 1024;

export default function CommunitySettingsPage() {
    const [form, setForm] = useState<CommunityProfileSettings>(() =>
        getCommunityProfileSettingsHydrationBaseline()
    );
    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<string>("");
    const [saveError, setSaveError] = useState<string>("");
    const [photoError, setPhotoError] = useState<string>("");

    useEffect(() => {
        setForm(readCommunityProfileSettings());
    }, []);

    const isPublic = form.visibility === "public";

    const visibilityLabel = useMemo(() => {
        if (isPublic) return "Your profile is visible to all community members.";
        return "Your profile is only visible to you and moderators.";
    }, [isPublic]);

    const setField = <K extends keyof CommunityProfileSettings>(key: K, value: CommunityProfileSettings[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const onPhotoSelected = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setPhotoError("");
        if (!file.type.startsWith("image/")) {
            setPhotoError("Please choose an image file.");
            return;
        }
        if (file.size > AVATAR_FILE_MAX_BYTES) {
            setPhotoError("Image must be about 600KB or smaller. Try a smaller photo.");
            return;
        }
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result ?? ""));
                reader.onerror = () => reject(new Error("read"));
                reader.readAsDataURL(file);
            });
            if (!dataUrl.startsWith("data:image/")) {
                setPhotoError("Could not read that image.");
                return;
            }
            if (dataUrl.length > COMMUNITY_PROFILE_AVATAR_MAX_CHARS) {
                setPhotoError("That image is too large. Try a smaller or more compressed photo.");
                return;
            }
            setField("avatarUrl", dataUrl);
        } catch {
            setPhotoError("Could not read that image.");
        }
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        setSaveError("");

        try {
            const sanitized = saveCommunityProfileSettings(form);
            const storedUser = readStoredUser();
            const userId = storedUser?.id;
            if (!userId) {
                throw new Error("You must be logged in to save community profile settings.");
            }

            const res = await fetch("/api/community-profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({
                    userId,
                    displayName: sanitized.displayName,
                    username: sanitized.username,
                    email: sanitized.email,
                    bio: sanitized.bio,
                    faculty: sanitized.faculty,
                    studyYear: sanitized.studyYear,
                    visibility: sanitized.visibility,
                    avatarUrl: sanitized.avatarUrl,
                }),
            });

            const body = (await res.json().catch(() => null)) as
                | { message?: string }
                | Record<string, unknown>
                | null;

            if (!res.ok) {
                throw new Error((body as { message?: string } | null)?.message || "Failed to save profile.");
            }

            updateStoredUser({
                name: sanitized.displayName,
                username: sanitized.username || undefined,
                email: sanitized.email || undefined,
            });

            setForm(sanitized);
            setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Failed to save profile.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <main
            className="relative min-h-screen py-10 lg:py-14"
            style={{
                backgroundImage: `url(${communityBackground.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
            }}
        >
            <div className="absolute inset-0 bg-slate-100/78" />
            <Container size="6xl">
                <div className="relative z-10 rounded-3xl border border-blue-200 bg-slate-50/90 p-5 shadow-shadow md:p-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <Link
                            href="/community/profile"
                            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50"
                        >
                            <ArrowLeft size={16} />
                            Back to Profile
                        </Link>
                        <Button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="gap-2 rounded-full bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                        >
                            <Save size={15} />
                            {isSaving ? "Saving..." : "Save Changes"}
                        </Button>
                    </div>

                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">Community Profile Settings</h1>
                        <p className="mt-1 text-sm text-slate-600">
                            Edit your profile details and choose who can view your community profile.
                        </p>
                        {savedAt ? (
                            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700">
                                <CheckCircle2 size={14} /> Saved at {savedAt}
                            </p>
                        ) : null}
                        {saveError ? (
                            <p className="mt-2 text-sm font-medium text-red-700">{saveError}</p>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                        <Card className="rounded-2xl border border-blue-100 bg-white p-5 shadow-none lg:col-span-2">
                            <h2 className="text-base font-semibold text-slate-800">Edit Profile</h2>
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <p className="text-sm font-medium text-slate-700">Profile picture</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-4">
                                        {form.avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element -- data URLs / arbitrary user URLs
                                            <img
                                                src={form.avatarUrl}
                                                alt=""
                                                className="h-20 w-20 rounded-full border border-blue-200 bg-white object-cover shadow-inner"
                                            />
                                        ) : (
                                            <div
                                                className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-dashed border-blue-200 bg-blue-50 text-blue-700"
                                                aria-hidden
                                            >
                                                <User size={28} />
                                            </div>
                                        )}
                                        <div className="flex flex-col gap-2">
                                            {/*
                                              Native file input must receive the click directly (not via ref.click() on a
                                              clipped sr-only input) or the OS file picker may not open in some browsers.
                                            */}
                                            <label
                                                className="relative inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
                                                onClick={() => setPhotoError("")}
                                            >
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                                    onChange={onPhotoSelected}
                                                />
                                                <span className="pointer-events-none inline-flex items-center gap-2">
                                                    <Camera size={15} aria-hidden />
                                                    {form.avatarUrl ? "Change photo" : "Upload photo"}
                                                </span>
                                            </label>
                                            {form.avatarUrl ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPhotoError("");
                                                        setField("avatarUrl", "");
                                                    }}
                                                    className="text-left text-sm font-medium text-red-700 hover:text-red-800"
                                                >
                                                    Remove photo
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                    {photoError ? (
                                        <p className="mt-2 text-sm font-medium text-red-700">{photoError}</p>
                                    ) : (
                                        <p className="mt-2 text-xs text-slate-500">
                                            JPG, PNG, WebP, or GIF — max about 600KB. Saved with your profile.
                                        </p>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-slate-700" htmlFor="display-name">
                                        Display Name
                                    </label>
                                    <Input
                                        id="display-name"
                                        className="mt-1 border-blue-200 bg-white"
                                        value={form.displayName}
                                        onChange={(event) => setField("displayName", event.target.value)}
                                        placeholder="Your display name"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700" htmlFor="username">
                                        Username
                                    </label>
                                    <Input
                                        id="username"
                                        className="mt-1 border-blue-200 bg-white"
                                        value={form.username}
                                        onChange={(event) => setField("username", event.target.value)}
                                        placeholder="e.g. it22123456"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700" htmlFor="email">
                                        Email
                                    </label>
                                    <Input
                                        id="email"
                                        type="email"
                                        className="mt-1 border-blue-200 bg-white"
                                        value={form.email}
                                        onChange={(event) => setField("email", event.target.value)}
                                        placeholder="name@campus.edu"
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700" htmlFor="faculty">
                                        Faculty
                                    </label>
                                    <Input
                                        id="faculty"
                                        className="mt-1 border-blue-200 bg-white"
                                        value={form.faculty}
                                        onChange={(event) => setField("faculty", event.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-700" htmlFor="study-year">
                                        Study Year
                                    </label>
                                    <Input
                                        id="study-year"
                                        className="mt-1 border-blue-200 bg-white"
                                        value={form.studyYear}
                                        onChange={(event) => setField("studyYear", event.target.value)}
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="text-sm font-medium text-slate-700" htmlFor="bio">
                                        Bio
                                    </label>
                                    <Textarea
                                        id="bio"
                                        className="mt-1 min-h-[110px] border-blue-200 bg-white"
                                        value={form.bio}
                                        onChange={(event) => setField("bio", event.target.value)}
                                        placeholder="Tell your community a bit about your interests and how you help others."
                                    />
                                </div>
                            </div>
                        </Card>

                        <Card className="rounded-2xl border border-blue-100 bg-white p-5 shadow-none">
                            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
                                <Shield size={18} className="text-blue-700" />
                                Profile Visibility
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">Choose who can view your profile activity.</p>

                            <div className="mt-4 space-y-3">
                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
                                    <input
                                        type="radio"
                                        name="profile_visibility"
                                        checked={form.visibility === "public"}
                                        onChange={() => setField("visibility", "public")}
                                        className="mt-1 h-4 w-4 border-blue-300 text-blue-700 focus:ring-blue-400"
                                    />
                                    <div>
                                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <Eye size={15} className="text-blue-700" /> Public
                                        </p>
                                        <p className="mt-1 text-xs text-slate-600">Everyone in the community can view your profile.</p>
                                    </div>
                                </label>

                                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-blue-200 bg-white p-3">
                                    <input
                                        type="radio"
                                        name="profile_visibility"
                                        checked={form.visibility === "private"}
                                        onChange={() => setField("visibility", "private")}
                                        className="mt-1 h-4 w-4 border-blue-300 text-blue-700 focus:ring-blue-400"
                                    />
                                    <div>
                                        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                                            <EyeOff size={15} className="text-blue-700" /> Private
                                        </p>
                                        <p className="mt-1 text-xs text-slate-600">Only you and moderators can view profile details.</p>
                                    </div>
                                </label>
                            </div>

                            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-100/70 p-3 text-xs text-blue-900">
                                {visibilityLabel}
                            </div>

                            <div className="mt-5 rounded-xl bg-slate-50 p-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
                                <div className="mt-2 flex items-start gap-3">
                                    {form.avatarUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={form.avatarUrl}
                                            alt=""
                                            className="h-9 w-9 shrink-0 rounded-full border border-blue-200 object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                                            <User size={16} />
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">{form.displayName || "Current User"}</p>
                                        <p className="text-xs text-slate-500">{form.faculty} - {form.studyYear}</p>
                                        <p className="mt-1 text-xs text-slate-600">
                                            {form.bio || "No bio added yet."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </Container>
        </main>
    );
}
