import { randomUUID } from 'node:crypto';
import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ApiError, ErrorCode } from '@app/shared';
import type { Request, Response } from 'express';
import { ERROR_STATUS, isErrorCode } from './error-codes';

const INTERNAL_MESSAGE = 'Internal server error';

const STATUS_DERIVED_CODE: Readonly<Record<number, ErrorCode>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

interface ResolvedError {
  status: number;
  message: string | string[];
  rawCode: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMessage(value: unknown): value is string | string[] {
  return typeof value === 'string' || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

/** Errors that are not Nest HttpExceptions but carry a 4xx status (e.g. Express body-parser). */
function clientErrorStatus(exception: unknown): number | undefined {
  if (!isRecord(exception)) return undefined;
  const status = exception.status ?? exception.statusCode;
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 499 ? status : undefined;
}

function resolveHttpException(exception: HttpException): ResolvedError {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return { status: exception.getStatus(), message: response, rawCode: undefined };
  }
  const message = isRecord(response) && isMessage(response.message) ? response.message : exception.message;
  return { status: exception.getStatus(), message, rawCode: isRecord(response) ? response.code : undefined };
}

function resolve(exception: unknown): ResolvedError | undefined {
  if (exception instanceof HttpException) return resolveHttpException(exception);
  const status = clientErrorStatus(exception);
  if (status !== undefined && isRecord(exception)) {
    const message =
      exception.type === 'entity.parse.failed'
        ? 'Malformed JSON body'
        : typeof exception.message === 'string'
          ? exception.message
          : (STATUS_CODES[status] ?? 'Bad Request');
    return { status, message, rawCode: undefined };
  }
  return undefined;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (res.headersSent) return;

    const requestId = this.requestIdOf(res);
    const where = `[${requestId}] ${req.method} ${req.url}`;
    const resolved = resolve(exception);

    if (resolved === undefined || resolved.status >= 500) {
      this.logger.error(`${where} -> 500`, this.describe(exception));
      this.send(res, 500, INTERNAL_MESSAGE, 'INTERNAL_ERROR');
      return;
    }

    const { status, message, rawCode } = resolved;
    let code: ErrorCode;
    if (isErrorCode(rawCode)) {
      code = rawCode;
      if (ERROR_STATUS[code] !== status) {
        this.logger.warn(`${where} -> ${status}: code ${code} expects status ${ERROR_STATUS[code]}`);
      }
    } else {
      const derived = STATUS_DERIVED_CODE[status];
      code = derived ?? 'VALIDATION_ERROR';
      if (derived === undefined) {
        this.logger.warn(`${where} -> ${status}: no valid error code, falling back to VALIDATION_ERROR`);
      }
    }
    this.send(res, status, message, code);
  }

  private send(res: Response, statusCode: number, message: string | string[], code: ErrorCode): void {
    const body: ApiError = { statusCode, error: STATUS_CODES[statusCode] ?? 'Error', message, code };
    res.status(statusCode).json(body);
  }

  private requestIdOf(res: Response): string {
    const value: unknown = res.locals?.requestId;
    return typeof value === 'string' ? value : randomUUID();
  }

  private describe(exception: unknown): string {
    return exception instanceof Error && exception.stack ? exception.stack : String(exception);
  }
}
