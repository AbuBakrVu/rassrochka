"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export default function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    const url = `${window.location.origin}${path}`;
    // Не ждём Clipboard API: в средах без разрешения промис может зависнуть
    navigator.clipboard?.writeText(url).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className={`flex w-full items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
        copied
          ? "border-good bg-good-soft text-good"
          : "border-line text-brand-deep hover:border-brand hover:bg-brand-soft"
      }`}
    >
      {copied ? (
        <>
          <Check size={15} aria-hidden /> Ссылка скопирована
        </>
      ) : (
        <>
          <Link2 size={15} aria-hidden /> Скопировать ссылку
        </>
      )}
    </button>
  );
}
