import { RequestMethod } from '@nestjs/common';
import type { INestApplication, Type } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, MetadataScanner, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator';

interface RouteHandler {
  controller: Type<unknown>;
  methodName: string;
  handler: Function; // eslint-disable-line @typescript-eslint/no-unsafe-function-type
}

function routeHandlers(app: INestApplication): RouteHandler[] {
  const reflector = app.get(Reflector);
  const scanner = new MetadataScanner();
  const found: RouteHandler[] = [];

  for (const nestModule of app.get(ModulesContainer).values()) {
    for (const wrapper of nestModule.controllers.values()) {
      const controller = wrapper.metatype as Type<unknown> | null;
      if (!controller) continue;
      for (const methodName of scanner.getAllMethodNames(controller.prototype)) {
        const handler: unknown = controller.prototype[methodName as keyof typeof controller.prototype];
        if (typeof handler !== 'function') continue;
        if (reflector.get(METHOD_METADATA, handler) === undefined) continue; // not a route handler
        found.push({ controller, methodName, handler });
      }
    }
  }
  return found;
}

/**
 * Returns "<Controller>.<method>" for every route handler that declares neither @Public() nor @Roles(...)
 * (on the handler or on the class).
 */
export function findUndeclaredRoutes(app: INestApplication): string[] {
  const reflector = app.get(Reflector);
  const undeclared: string[] = [];
  for (const { controller, methodName, handler } of routeHandlers(app)) {
    const targets = [handler, controller];
    const isPublic = reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets);
    const roles = reflector.getAllAndOverride<unknown>(ROLES_KEY, targets);
    if (!isPublic && roles === undefined) undeclared.push(`${controller.name}.${methodName}`);
  }
  return undeclared.sort();
}

export interface RouteInfo {
  key: string;
  isPublic: boolean;
  roles: string[];
}

function globalPrefixOf(app: INestApplication): string {
  const config: unknown = Reflect.get(app, 'config');
  if (typeof config === 'object' && config !== null && 'getGlobalPrefix' in config) {
    const read: unknown = config.getGlobalPrefix;
    if (typeof read === 'function') {
      const prefix: unknown = read.call(config);
      if (typeof prefix === 'string') return prefix;
    }
  }
  throw new Error('could not read the global prefix from the Nest application');
}

function firstPath(value: unknown): string {
  const path: unknown = Array.isArray(value) ? value[0] : value;
  return typeof path === 'string' ? path : '';
}

/** Every route of the application as "<METHOD> <full path>" with its access metadata. */
export function listRoutes(app: INestApplication): RouteInfo[] {
  const reflector = app.get(Reflector);
  const prefix = globalPrefixOf(app);

  return routeHandlers(app)
    .map(({ controller, handler }) => {
      const targets = [handler, controller];
      const method = RequestMethod[reflector.get<number>(METHOD_METADATA, handler)];
      const path = `/${prefix}/${firstPath(Reflect.getMetadata(PATH_METADATA, controller))}/${firstPath(Reflect.getMetadata(PATH_METADATA, handler))}`
        .replace(/\/+/g, '/')
        .replace(/\/$/, '');
      const roles = reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, targets) ?? [];
      return {
        key: `${method} ${path}`,
        isPublic: reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets) === true,
        roles,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}
