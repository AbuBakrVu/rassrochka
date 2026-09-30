// Тема оформления: общее для серверного layout и клиентского переключателя
// (components/theme-toggle.tsx). Отдельный файл без "use client": серверный
// компонент не может взять обычную константу из клиентского модуля.

export const THEME_STORAGE_KEY = "theme";

/** Выполняется в <head> до первой отрисовки — ставит .dark на <html> без мигания. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;
