import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

interface Harness {
  host: ArgumentsHost;
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
}

function makeHost(headersSent = false): Harness {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const res = { status, setHeader, headersSent, locals: { requestId: 'rid-1' } };
  const req = { method: 'GET', url: '/api/v1/x' };
  const host = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ArgumentsHost;
  return { host, setHeader, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ConflictException with code -> exact body', () => {
    const { host, status, json } = makeHost();
    filter.catch(new ConflictException({ code: 'INVALID_STATUS', message: 'x' }), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ statusCode: 409, error: 'Conflict', message: 'x', code: 'INVALID_STATUS' });
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('ValidationPipe-style BadRequestException (message array, no code) -> VALIDATION_ERROR', () => {
    const { host, json } = makeHost();
    filter.catch(new BadRequestException(['a must be a string', 'b should not exist']), host);
    expect(json).toHaveBeenCalledWith({
      statusCode: 400,
      error: 'Bad Request',
      message: ['a must be a string', 'b should not exist'],
      code: 'VALIDATION_ERROR',
    });
  });

  it("NotFoundException('x') -> NOT_FOUND", () => {
    const { host, json } = makeHost();
    filter.catch(new NotFoundException('x'), host);
    expect(json).toHaveBeenCalledWith({ statusCode: 404, error: 'Not Found', message: 'x', code: 'NOT_FOUND' });
  });

  it('plain Error -> generic 500 without leaking, logged with request id and stack', () => {
    const { host, status, json } = makeHost();
    const error = new Error('db password is hunter2');
    filter.catch(error, host);
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(json.mock.calls)).not.toContain('hunter2');
    expect(errorSpy).toHaveBeenCalledWith('[rid-1] GET /api/v1/x -> 500', error.stack);
  });

  it('non-Error throwables -> generic 500', () => {
    const { host, json } = makeHost();
    filter.catch('just a string', host);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500, code: 'INTERNAL_ERROR' }));
    expect(errorSpy).toHaveBeenCalledWith('[rid-1] GET /api/v1/x -> 500', 'just a string');
  });

  it('HttpException with status 500 and a secret message -> generic message', () => {
    const { host, json } = makeHost();
    filter.catch(new HttpException({ code: 'INTERNAL_ERROR', message: 'secret connection string' }, 500), host);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  it('body-parser-style error (status 400, entity.parse.failed) -> 400 VALIDATION_ERROR', () => {
    const { host, status, json } = makeHost();
    filter.catch({ status: 400, type: 'entity.parse.failed', message: 'Unexpected token' }, host);
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' }));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('413 without a code -> 413 + VALIDATION_ERROR + warn', () => {
    const { host, status, json } = makeHost();
    filter.catch({ status: 413, type: 'entity.too.large', message: 'request entity too large' }, host);
    expect(status).toHaveBeenCalledWith(413);
    expect(json).toHaveBeenCalledWith({
      statusCode: 413,
      error: 'Payload Too Large',
      message: 'request entity too large',
      code: 'VALIDATION_ERROR',
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('code whose status differs from the actual status keeps the status and warns', () => {
    const { host, status, json } = makeHost();
    filter.catch(new NotFoundException({ code: 'INSUFFICIENT_STOCK', message: 'y' }), host);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404, code: 'INSUFFICIENT_STOCK' }));
    expect(warnSpy).toHaveBeenCalled();
  });

  it('an unknown code is ignored and derived from the status', () => {
    const { host, json } = makeHost();
    filter.catch(new NotFoundException({ code: 'NOPE', message: 'z' }), host);
    expect(json).toHaveBeenCalledWith({ statusCode: 404, error: 'Not Found', message: 'z', code: 'NOT_FOUND' });
  });

  it('429 with retryAfter sets the Retry-After header and keeps the body at four keys', () => {
    const { host, setHeader, status, json } = makeHost();
    filter.catch(
      new HttpException(
        { code: 'TOO_MANY_REQUESTS', message: 'slow down', retryAfter: 42 },
        HttpStatus.TOO_MANY_REQUESTS,
      ),
      host,
    );
    expect(status).toHaveBeenCalledWith(429);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
    expect(json).toHaveBeenCalledWith({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'slow down',
      code: 'TOO_MANY_REQUESTS',
    });
    expect(Object.keys(json.mock.calls[0][0] as object).sort()).toEqual(['code', 'error', 'message', 'statusCode']);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('Retry-After is rounded up to an integer of at least 1 second', () => {
    const { host, setHeader } = makeHost();
    filter.catch(
      new HttpException({ code: 'TOO_MANY_REQUESTS', message: 'm', retryAfter: 0.2 }, HttpStatus.TOO_MANY_REQUESTS),
      host,
    );
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '1');
  });

  it('429 without retryAfter sets no header; other statuses never set it', () => {
    const first = makeHost();
    filter.catch(new HttpException({ code: 'TOO_MANY_REQUESTS', message: 'm' }, HttpStatus.TOO_MANY_REQUESTS), first.host);
    expect(first.setHeader).not.toHaveBeenCalled();

    const second = makeHost();
    filter.catch(
      new HttpException({ code: 'INVALID_STATUS', message: 'm', retryAfter: 5 }, HttpStatus.CONFLICT),
      second.host,
    );
    expect(second.setHeader).not.toHaveBeenCalled();
  });

  it('headers already sent -> nothing is written', () => {
    const { host, status, json } = makeHost(true);
    filter.catch(new Error('late'), host);
    expect(status).not.toHaveBeenCalled();
    expect(json).not.toHaveBeenCalled();
  });
});
