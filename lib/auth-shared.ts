// Мелочи авторизации без серверных зависимостей: lib/auth.ts помечен
// server-only и тянет pg с argon2, а middleware работает на edge-рантайме
// и импортировать его не может.

export const SESSION_COOKIE = "finora_session";

// Отдельная кука для владельца платформы (/admin) — сессии компаний и
// платформы не должны пересекаться, это разные модели данных в разных
// таблицах control-базы.
export const PLATFORM_SESSION_COOKIE = "finora_platform_session";
