import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { RejectNulCharactersPipe } from './common/reject-nul.pipe';
import { requestIdMiddleware } from './common/request-id.middleware';
import { parseTrustProxy } from './common/trust-proxy';

interface SettableApp {
  set(setting: string, value: unknown): unknown;
}

function isSettableApp(value: unknown): value is SettableApp {
  // An Express application is a function object, so accept both.
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'set' in value &&
    typeof value.set === 'function'
  );
}

export function configureApp(app: INestApplication): void {
  const trustProxy = parseTrustProxy(app.get(ConfigService).get<string>('TRUST_PROXY'));
  if (trustProxy !== undefined) {
    const express: unknown = app.getHttpAdapter().getInstance();
    if (isSettableApp(express)) express.set('trust proxy', trustProxy);
  }

  app.use(requestIdMiddleware);
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new RejectNulCharactersPipe(),
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
