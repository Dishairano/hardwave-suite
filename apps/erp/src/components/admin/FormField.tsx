"use client";

import { forwardRef } from "react";

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

interface TextareaFieldProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  helperText?: string;
}

interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string }[];
}

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-300">
          {label}
          {props.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          ref={ref}
          className={`w-full px-4 py-2.5 bg-[#0c0c12] border rounded-lg text-white placeholder-zinc-500 focus:outline-none transition ${
            error
              ? "border-red-500/50 focus:border-red-500"
              : "border-white/10 focus:border-orange-500/50"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="text-sm text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, helperText, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-300">
          {label}
          {props.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <textarea
          ref={ref}
          className={`w-full px-4 py-2.5 bg-[#0c0c12] border rounded-lg text-white placeholder-zinc-500 focus:outline-none transition resize-none ${
            error
              ? "border-red-500/50 focus:border-red-500"
              : "border-white/10 focus:border-orange-500/50"
          } ${className}`}
          rows={4}
          {...props}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="text-sm text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);
TextareaField.displayName = "TextareaField";

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, helperText, options, className, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-zinc-300">
          {label}
          {props.required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <select
          ref={ref}
          className={`w-full px-4 py-2.5 bg-[#0c0c12] border rounded-lg text-white focus:outline-none transition ${
            error
              ? "border-red-500/50 focus:border-red-500"
              : "border-white/10 focus:border-orange-500/50"
          } ${className}`}
          {...props}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {helperText && !error && (
          <p className="text-sm text-zinc-500">{helperText}</p>
        )}
      </div>
    );
  }
);
SelectField.displayName = "SelectField";

export default FormField;
