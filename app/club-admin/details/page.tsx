"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getClubAdminContext, type ManagedClub } from "../../../lib/clubAdmin";
import { supabase } from "../../../lib/supabase";

type ClubDetailsForm = {
  name: string;
  category: string;
  description: string;
  logo_url: string;
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10";

function toFormValues(club: ManagedClub): ClubDetailsForm {
  return {
    name: club.name ?? "",
    category: club.category ?? "",
    description: club.description ?? "",
    logo_url: club.logo_url ?? "",
  };
}

export default function ClubAdminDetailsPage() {
  const [managedClub, setManagedClub] = useState<ManagedClub | null>(null);
  const [form, setForm] = useState<ClubDetailsForm>({
    name: "",
    category: "",
    description: "",
    logo_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadClub = async () => {
      setLoading(true);
      setError("");

      const context = await getClubAdminContext();
      if (context.error || !context.managedClub) {
        setManagedClub(null);
        setError(context.error);
        setLoading(false);
        return;
      }

      const { data, error: clubError } = await supabase
        .from("clubs")
        .select("id, name, category, description, logo_url")
        .eq("id", context.managedClub.id)
        .maybeSingle();

      const club = (data as ManagedClub | null) ?? context.managedClub;

      if (clubError && !club?.id) {
        setManagedClub(null);
        setError(clubError.message);
        setLoading(false);
        return;
      }

      setManagedClub(club);
      setForm(toFormValues(club));
      setLoading(false);
    };

    void Promise.resolve().then(loadClub);
  }, []);

  const handleLogoFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file for the club logo.");
      event.target.value = "";
      return;
    }

    setUploadingLogo(true);
    setError("");

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("Unable to read the selected file."));
        };
        reader.onerror = () => reject(new Error("Unable to read the selected file."));
        reader.readAsDataURL(file);
      });

      setForm((prev) => ({ ...prev, logo_url: dataUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the selected file.");
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!managedClub?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name.trim() || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      logo_url: form.logo_url.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("clubs")
      .update(payload)
      .eq("id", managedClub.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      const updatedClub: ManagedClub = {
        ...managedClub,
        ...payload,
      };
      setManagedClub(updatedClub);
      setForm(toFormValues(updatedClub));
      setSuccess("Club details updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    }

    setSaving(false);
  };

  return (
    <div className="px-6 py-8 lg:px-10 2xl:px-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Club Details</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review and edit the details of your assigned club.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-2xl bg-slate-200" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-200" />
        </div>
      ) : !managedClub ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-400 shadow-sm">
          No club details available.
        </div>
      ) : (
        <>
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1e3a8a]">
              Assigned Club
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {form.logo_url ? (
                <Image
                  src={form.logo_url}
                  alt={`${managedClub.name?.trim() || "Club"} logo`}
                  width={64}
                  height={64}
                  unoptimized
                  className="h-16 w-16 rounded-2xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-[#eef3ff] text-2xl font-bold text-[#1e3a8a]">
                  {(managedClub.name?.trim() || "C").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-slate-900">
                  {managedClub.name?.trim() || "Your Club"}
                </h2>
                <span className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {managedClub.category || "Club"}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Club Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className={inputCls}
                  placeholder="Club name"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Category
                </label>
                <input
                  type="text"
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                  className={inputCls}
                  placeholder="Tech, Business, Creative..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Club Logo
                </label>
                <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-[#1e3a8a] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#1e40af]"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logo_url: "" }))}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Remove logo
                    </button>
                    <span className="text-xs text-slate-400">
                      {uploadingLogo
                        ? "Loading selected image..."
                        : "Choose an image file from your computer."}
                    </span>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Description
                </label>
                <textarea
                  rows={6}
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className={`${inputCls} resize-none`}
                  placeholder="Describe the club"
                />
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Club Details"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
