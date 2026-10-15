import type { INestApplication, Type } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, MetadataScanner, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator';

/**
 * Returns "<Controller>.<method>" for every route handler that declares neither @Public() nor @Roles(...)
 * (on the handler or on the class).
 */
export function findUndeclaredRoutes(app: INestApplication): string[] {
  const reflector = app.get(Reflector);
  const scanner = new MetadataScanner();
  const undeclared: string[] = [];

  for (const nestModule of app.get(ModulesContainer).values()) {
    for (const wrapper of nestModule.controllers.values()) {
      const controller = wrapper.metatype as Type<unknown> | null;
      if (!controller) continue;
      for (const methodName of scanner.getAllMethodNames(controller.prototype)) {
        const handler: unknown = controller.prototype[methodName as keyof typeof controller.prototype];
        if (typeof handler !== 'function') continue;
        if (reflector.get(METHOD_METADATA, handler) === undefined) continue; // not a route handler
        const targets = [handler, controller];
        const isPublic = reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets);
        const roles = reflector.getAllAndOverride<unknown>(ROLES_KEY, targets);
        if (!isPublic && roles === undefined) undeclared.push(`${controller.name}.${methodName}`);
      }
    }
  }
  return undeclared.sort();
}
