"use client";

import { useLayoutEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "@/lib/theme";

// Тема оформления: светлая, тёмная или как в системе. Выбор хранится в
// localStorage у каждого пользователя в его браузере; до первой отрисовки
// класс .dark ставит THEME_SCRIPT из lib/theme.ts (подключён в
// app/layout.tsx), чтобы страница не мигала светлой темой. applyTheme ниже
// делает то же самое — держать их в паре.

export type ThemeChoice = "light" | "dark" | "system";

function readChoice(): ThemeChoice {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const META: Record<ThemeChoice, { label: string; icon: typeof Sun }> = {
  system: { label: "Как в системе", icon: Monitor },
  light: { label: "Светлая тема", icon: Sun },
  dark: { label: "Тёмная тема", icon: Moon },
};

export default function ThemeToggle({
  className = "text-mute hover:bg-canvas hover:text-ink",
}: {
  /** Цвета кнопки — на тёмной полосе меню они свои. */
  className?: string;
}) {
  const [choice, setChoice] = useState<ThemeChoice>("system");

  // Читаем сохранённый выбор и заново ставим класс: в разработке React при
  // повторном монтировании сбрасывает атрибуты <html>, выставленные скриптом.
  // Плюс следим за сменой темы системы, пока выбрано «Как в системе».
  useLayoutEffect(() => {
    const saved = readChoice();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage доступен только в браузере
    setChoice(saved);
    applyTheme(saved);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readChoice() === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const next = () => {
    const value = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
    setChoice(value);
    try {
      if (value === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // приватный режим — тема просто не запомнится
    }
    applyTheme(value);
  };

  const { label, icon: Icon } = META[choice];
  return (
    <button
      onClick={next}
      title={`${label} — нажмите, чтобы сменить`}
      aria-label={`Тема оформления: ${label.toLowerCase()}. Сменить`}
      className={`shrink-0 rounded-full p-2 transition-colors ${className}`}
    >
      <Icon size={17} aria-hidden />
    </button>
  );
}
