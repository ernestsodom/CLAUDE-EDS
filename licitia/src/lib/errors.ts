import { NextResponse } from "next/server";
import { logger } from "./logger";

export class AppError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code: string = "internal_error"
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404, "not_found");
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado") {
    super(message, 403, "forbidden");
  }
}

export class ValidationError extends AppError {
  constructor(message = "Datos inválidos") {
    super(message, 422, "validation_error");
  }
}

/** Envuelve un handler de API Route con manejo de errores homogéneo. */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AppError) {
        logger.warn("app_error", { code: err.code, message: err.message });
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.status }
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error("unhandled_error", { message, stack: err instanceof Error ? err.stack : undefined });
      return NextResponse.json(
        { error: { code: "internal_error", message: "Error interno del servidor" } },
        { status: 500 }
      );
    }
  };
}
