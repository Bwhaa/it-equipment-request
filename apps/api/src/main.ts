import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // Not inside configureApp: every e2e app uses it and would register signal listeners.
  app.enableShutdownHooks();
  await app.listen(Number(process.env.API_PORT ?? 3001));
}
void bootstrap();
