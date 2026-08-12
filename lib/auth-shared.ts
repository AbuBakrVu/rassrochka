// Мелочи авторизации без серверных зависимостей: lib/auth.ts помечен
// server-only и тянет pg с argon2, а middleware работает на edge-рантайме
// и импортировать его не может.

export const SESSION_COOKIE = "nasiya_session";
