"use client";

// Корневой домен сам по себе не принадлежит ни одной компании.
// Здесь можно ввести её адрес и перейти на свой поддомен.

import { useState } from "react";
import { Zap, ArrowRight } from "lucide-react";
import { APP_DOMAIN } from "@/lib/tenant-host";

export default function CompanyPage() {
  const [slug, setSlug] = useState("");
  const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clean) return;
    window.location.href = `${location.protocol}//${clean}.${APP_DOMAIN}${location.port ? `:${location.port}` : ""}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form
        onSubmit={go}
        className="w-full max-w-sm rounded-card border border-line bg-surface p-6 shadow-card sm:p-8"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-on-brand">
            <Zap size={18} aria-hidden />
          </span>
          <div>
            <p className="font-semibold tracking-tight">Nasiya</p>
            <p className="text-xs text-mute">Учёт рассрочек</p>
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Адрес вашей компании</span>
          <div className="flex items-center rounded-[10px] border border-line bg-canvas transition-colors focus-within:border-brand focus-within:bg-surface">
            <input
              className="w-full min-w-0 bg-transparent px-3.5 py-2.5 text-sm outline-none"
              placeholder="акме"
              autoFocus
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <span className="shrink-0 pr-3.5 text-sm text-mute">.{APP_DOMAIN}</span>
          </div>
        </label>

        <button
          type="submit"
          disabled={!clean}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-[10px] bg-brand px-4 py-2.5 text-sm font-medium text-on-brand shadow-card transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-mute disabled:shadow-none"
        >
          Перейти <ArrowRight size={15} aria-hidden />
        </button>

        <p className="mt-4 text-center text-xs text-mute">
          Не знаете адрес — спросите у администратора вашей компании
        </p>
      </form>
    </div>
  );
}
