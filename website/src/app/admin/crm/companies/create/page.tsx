"use client";

import { useState } from "react";
import { useCreate } from "@refinedev/core";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { FormField, TextareaField, SelectField } from "@/components/admin/FormField";

const industries = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "education", label: "Education" },
  { value: "entertainment", label: "Entertainment" },
  { value: "music", label: "Music" },
  { value: "media", label: "Media" },
  { value: "other", label: "Other" },
];

const statuses = [
  { value: "lead", label: "Lead" },
  { value: "prospect", label: "Prospect" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export default function CreateCompanyPage() {
  const router = useRouter();
  const { mutate: create, isLoading } = useCreate();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    // Validation
    const newErrors: Record<string, string> = {};
    if (!data.name) newErrors.name = "Company name is required";
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email as string)) {
      newErrors.email = "Invalid email format";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    create(
      { resource: "companies", values: data },
      {
        onSuccess: () => router.push("/admin/crm/companies"),
        onError: (error: any) => {
          setErrors({ form: error?.message || "Failed to create company" });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/admin/crm/companies"
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Add Company</h1>
          <p className="text-zinc-400 mt-1">Create a new company record</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.form && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {errors.form}
          </div>
        )}

        <div className="bg-[#101018] border border-white/10 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
            Basic Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="name"
              label="Company Name"
              placeholder="Acme Inc."
              required
              error={errors.name}
            />
            <SelectField
              name="industry"
              label="Industry"
              options={industries}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="website"
              label="Website"
              type="url"
              placeholder="https://example.com"
            />
            <SelectField
              name="status"
              label="Status"
              options={statuses}
            />
          </div>
        </div>

        <div className="bg-[#101018] border border-white/10 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
            Contact Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="email"
              label="Email"
              type="email"
              placeholder="contact@example.com"
              error={errors.email}
            />
            <FormField
              name="phone"
              label="Phone"
              type="tel"
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <TextareaField
            name="address"
            label="Address"
            placeholder="123 Main St, City, Country"
          />
        </div>

        <div className="bg-[#101018] border border-white/10 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
            Additional Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              name="employee_count"
              label="Employee Count"
              type="number"
              placeholder="100"
            />
            <FormField
              name="annual_revenue"
              label="Annual Revenue"
              type="number"
              placeholder="1000000"
            />
          </div>

          <TextareaField
            name="notes"
            label="Notes"
            placeholder="Additional notes about this company..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/crm/companies"
            className="px-4 py-2 text-zinc-400 hover:text-white transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isLoading ? "Creating..." : "Create Company"}
          </button>
        </div>
      </form>
    </div>
  );
}
