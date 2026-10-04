// Ошибка во входных данных запроса — роуты отвечают на неё 400 с текстом
// для пользователя (app/api/_lib/handler.ts). Отдельный файл, чтобы её
// могли бросать и модули lib/, не завязываясь на обвязку роутов.

export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}
