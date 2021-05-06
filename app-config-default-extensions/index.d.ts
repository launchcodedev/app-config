// NOTE: This module "breaks" the circular dependency between different packages.
// By not being a TypeScript project with project references, we can use this
// tiny module as a glue between @app-config/node and @app-config/* extensions.

import type { ParsingExtension } from '@app-config/core';

export function defaultExtensions(): ParsingExtension[];
export function defaultEnvExtensions(): ParsingExtension[];
export function defaultMetaExtensions(): ParsingExtension[];
