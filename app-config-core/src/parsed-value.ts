import { inspect } from 'util';
import merge from 'lodash.merge';
import { Json, JsonObject, JsonPrimitive, isObject } from '@app-config/utils';
import { logger } from '@app-config/logging';
import { ConfigSource, LiteralSource } from './config-source';
import { AppConfigError } from './errors';

/** The property being visited was a property in an object */
export const InObject = Symbol('InObject');
/** The property being visited was a value in an array */
export const InArray = Symbol('InArray');
/** The property being visited is the root object */
export const Root = Symbol('Root');

/** Descriptor for what "key" that a value was defined under within JSON */
export type ParsingExtensionKey =
  | [typeof InObject, string]
  | [typeof InArray, number]
  | [typeof Root];

/**
 * Arbitrary context that's passed through the hierachy during parsing, only downwards.
 *
 * This is used for environment overrides and other options, so that parsing below some
 * level in an object tree can override what the current environment is.
 */
export interface ParsingContext {
  [k: string]: string | string[] | undefined | ParsingContext;
}

/**
 * Performs transformations on raw values that were read.
 *
 * See https://app-config.dev/guide/intro/extensions.html
 */
export interface ParsingExtension {
  (
    value: Json,
    key: ParsingExtensionKey,
    parentKeys: ParsingExtensionKey[],
    context: ParsingContext,
  ): ParsingExtensionTransform | false;

  /**
   * A globally unique string that identifies what parsing extension this is.
   *
   * Used to avoid running the same extension twice when included twice.
   */
  extensionName?: string;
}

/**
 * Callback that will process and potentially transform a value.
 */
export type ParsingExtensionTransform = (
  parse: (
    value: Json,
    metadata?: ParsedValueMetadata,
    source?: ConfigSource,
    extensions?: ParsingExtension[],
    context?: ParsingContext,
  ) => Promise<ParsedValue>,
  parent: JsonObject | Json[] | undefined,
  source: ConfigSource,
  extensions: ParsingExtension[],
  root: Json,
) => Promise<ParsedValue> | ParsedValue;

/** Values associated with a ParsedValue */
export interface ParsedValueMetadata {
  [key: string]: any;
}

type ParsedValueInner = JsonPrimitive | { [k: string]: ParsedValue } | ParsedValue[];

/** Wrapper abstraction of values parsed, allowing for transformations of data (while keeping original raw form) */
export class ParsedValue {
  public readonly meta: ParsedValueMetadata = {};
  public readonly sources: ConfigSource[];
  public readonly raw: Json;
  private readonly value: ParsedValueInner;

  constructor(source: ConfigSource | ConfigSource[], raw: Json, value: ParsedValueInner) {
    this.sources = Array.isArray(source) ? source : [source];
    this.raw = raw;
    this.value = value;
  }

  /** Constructs a ParsedValue from a plain JSON object */
  static literal(raw: Json, source: ConfigSource = new LiteralSource(raw)): ParsedValue {
    return literalParsedValue(raw, source);
  }

  /** Parses (with extensions) from a value that was read from ConfigSource */
  static async parse(
    raw: Json,
    source: ConfigSource,
    extensions?: ParsingExtension[],
    metadata?: ParsedValueMetadata,
    context?: ParsingContext,
  ): Promise<ParsedValue> {
    return parseValue(raw, source, extensions, metadata, context);
  }

  /** Parses (with extensions) from a plain JSON object */
  static async parseLiteral(raw: Json, extensions: ParsingExtension[] = []): Promise<ParsedValue> {
    return parseValue(raw, new LiteralSource(raw), extensions);
  }

  /** Deep merge two ParsedValue objects */
  static merge(a: ParsedValue, b: ParsedValue) {
    const meta = merge(a.meta, b.meta);

    if (
      // an array or primitive value overrides us
      Array.isArray(b.value) ||
      typeof b.value !== 'object' ||
      b.value === null ||
      // if we were an array or primitive, they override us
      Array.isArray(a.value) ||
      typeof a.value !== 'object' ||
      a.value === null
    ) {
      return new ParsedValue(b.sources, b.raw, b.value).assignMeta(meta);
    }

    const newValue = {};
    const keys = new Set(Object.keys(b.value).concat(Object.keys(a.value)));

    for (const key of keys) {
      let newValueK;

      if (a.value[key] && b.value[key]) {
        newValueK = ParsedValue.merge(a.value[key], b.value[key]);
      } else {
        newValueK = b.value[key] ?? a.value[key];
      }

      Object.assign(newValue, { [key]: newValueK });
    }

    let newRawValue: Json = {};

    if (isObject(a.raw) && isObject(b.raw)) {
      const rawKeys = new Set(Object.keys(b.raw).concat(Object.keys(a.raw)));

      for (const key of rawKeys) {
        let newRawValueK;

        if (a.raw[key] && b.raw[key]) {
          newRawValueK = merge({}, a.raw[key], b.raw[key]);
        } else {
          newRawValueK = b.raw[key] ?? a.raw[key];
        }

        Object.assign(newRawValue, { [key]: newRawValueK });
      }
    } else {
      newRawValue = b.raw;
    }

    return new ParsedValue([...a.sources, ...b.sources], newRawValue, newValue).assignMeta(meta);
  }

  /** Returns the first ConfigSource that is of some instance type */
  getSource<CS extends ConfigSource>(clazz: new (...args: any[]) => CS): CS | undefined {
    for (const source of this.sources) {
      if (source instanceof clazz) {
        return source;
      }
    }
  }

  /** Returns the first ConfigSource that is of some instance type */
  assertSource<CS extends ConfigSource>(clazz: new (...args: any[]) => CS): CS {
    const source = this.getSource(clazz);

    if (source) {
      return source;
    }

    throw new AppConfigError(`Failed to find ConfigSource ${clazz.name}`);
  }

  /** Returns all ConfigSource objects that contributed to this value (including nested) */
  allSources(): Set<ConfigSource> {
    const sources = new Set(this.sources);

    if (Array.isArray(this.value)) {
      for (const inner of this.value) {
        for (const source of inner.sources) {
          sources.add(source);
        }
      }
    }

    if (typeof this.value === 'object' && this.value !== null) {
      for (const inner of Object.values(this.value)) {
        for (const source of inner.sources) {
          sources.add(source);
        }
      }
    }

    return sources;
  }

  /** Adds metadata to the ParsedValue */
  assignMeta(metadata: ParsedValueMetadata) {
    Object.assign(this.meta, metadata);
    return this;
  }

  /** Removes metadata by key */
  removeMeta(key: string) {
    delete this.meta[key];
    return this;
  }

  /** Lookup property by nested key name(s) */
  property([key, ...rest]: string[]): ParsedValue | undefined {
    if (key === '') return this.property(rest);

    if (key === undefined || !this.value || typeof this.value !== 'object') {
      return this;
    }

    if (Array.isArray(this.value)) {
      return this.value[parseFloat(key)]?.property(rest);
    }

    return this.value[key]?.property(rest);
  }

  /** Returns JSON object if the value is one */
  asObject(): { [key: string]: ParsedValue } | undefined {
    if (typeof this.value === 'object' && this.value !== null && !Array.isArray(this.value)) {
      return this.value;
    }
  }

  /** Returns JSON array if the value is one */
  asArray(): ParsedValue[] | undefined {
    if (Array.isArray(this.value)) return this.value;
  }

  /** Returns JSON primitive value if the value is one */
  asPrimitive(): JsonPrimitive | undefined {
    if ((typeof this.value !== 'object' || this.value === null) && !Array.isArray(this.value)) {
      return this.value;
    }
  }

  /** Returns if the underlying value is an object */
  isObject(): boolean {
    return this.asObject() !== undefined;
  }

  /** Returns if the underlying value is an array */
  isArray(): boolean {
    return this.asArray() !== undefined;
  }

  /** Returns if the underlying value is a primitive */
  isPrimitive(): boolean {
    return this.asPrimitive() !== undefined;
  }

  /** Deep clones underlying value */
  clone(): ParsedValue {
    return this.cloneWhere(() => true);
  }

  /** Deep clones underlying value, depending on a predicate function */
  cloneWhere(filter: (value: ParsedValue) => boolean): ParsedValue {
    if (Array.isArray(this.value)) {
      const filtered = this.value.filter(filter);

      return new ParsedValue(
        this.sources,
        filtered.map((v) => v.raw),
        filtered.map((v) => v.cloneWhere(filter)),
      );
    }

    if (typeof this.value === 'object' && this.value !== null) {
      const value: { [k: string]: ParsedValue } = {};
      const raw: JsonObject = {};

      for (const [key, entry] of Object.entries(this.value)) {
        if (filter(entry)) {
          value[key] = entry.cloneWhere(filter);

          if (isObject(this.raw)) {
            raw[key] = this.raw[key];
          }
        }
      }

      return new ParsedValue(this.sources, raw, value);
    }

    if (!filter(this)) {
      throw new AppConfigError('ParsedValue::cloneWhere filtered itself out');
    }

    return new ParsedValue(this.sources, this.raw, this.value);
  }

  /** Calls the function, with every nested ParsedValue */
  visitAll(callback: (value: ParsedValue) => void) {
    callback(this);

    if (Array.isArray(this.value)) {
      this.value.forEach((item) => {
        item.visitAll(callback);
      });
    } else if (typeof this.value === 'object' && this.value !== null) {
      for (const item of Object.values(this.value)) {
        item.visitAll(callback);
      }
    }
  }

  /** Extracts underlying JSON value from the wrapper */
  toJSON(): Json {
    if (Array.isArray(this.value)) {
      return this.value.map((v) => v.toJSON());
    }

    // transforming to JSON requires recursive descent into each level to toJSON
    // this is because each layer has ParsedValues, not POJOs
    if (this.value && typeof this.value === 'object') {
      const json: Json = {};

      for (const [key, value] of Object.entries(this.value)) {
        json[key] = value.toJSON();
      }

      return json;
    }

    return this.value;
  }

  [inspect.custom]() {
    if (this.meta.parsedFromEncryptedValue) {
      return `ParsedValue(encrypted) <${inspect(this.value)}>`;
    }

    if (this.meta.fromSecrets) {
      return `ParsedValue(secret) <${inspect(this.value)}>`;
    }

    if (Object.keys(this.meta).length > 0) {
      return `ParsedValue(${inspect(this.meta)}) <${inspect(this.value)}>`;
    }

    return `ParsedValue <${inspect(this.value)}>`;
  }

  toString() {
    return JSON.stringify(this.toJSON());
  }
}

function literalParsedValue(raw: Json, source: ConfigSource): ParsedValue {
  let transformed: ParsedValueInner;

  if (Array.isArray(raw)) {
    transformed = raw.map((v) => literalParsedValue(v, source));
  } else if (isObject(raw)) {
    transformed = {};

    for (const [key, value] of Object.entries(raw)) {
      transformed[key] = literalParsedValue(value, source);
    }
  } else {
    transformed = raw;
  }

  return new ParsedValue(source, raw, transformed);
}

/** Same as ParsedValue.parse */
export async function parseValue(
  value: Json,
  source: ConfigSource,
  extensions: ParsingExtension[] = [],
  metadata: ParsedValueMetadata = {},
  context: ParsingContext = {},
): Promise<ParsedValue> {
  return parseValueInner(value, source, extensions, metadata, context, [[Root]], value);
}

async function parseValueInner(
  value: Json,
  source: ConfigSource,
  extensions: ParsingExtension[],
  metadata: ParsedValueMetadata = {},
  context: ParsingContext = {},
  parentKeys: ParsingExtensionKey[],
  root: Json,
  parent?: JsonObject | Json[],
  visitedExtensions: Set<ParsingExtension | string> = new Set(),
): Promise<ParsedValue> {
  const [currentKey] = parentKeys.slice(-1);
  const parentKeysNext = parentKeys.slice(0, parentKeys.length - 1);

  let applicableExtension: ParsingExtensionTransform | undefined;

  // before anything else, we check for parsing extensions that should be applied
  // we do this first, so that the traversal is top-down, not depth first
  // this is a bit counter-intuitive, but an example makes this clear:
  //   { $env: { default: { $extends: '...' }, production: { $extends: '...' } } }
  // in this example, we don't actually want to visit "production" if we don't have to
  //
  // for this reason, we pass "parse" as a function to extensions, so they can recurse as needed
  for (const extension of extensions) {
    // we track visitedExtensions so that calling `parse` in an extension doesn't hit that same extension with the same value
    if (visitedExtensions.has(extension)) continue;
    if (extension.extensionName && visitedExtensions.has(extension.extensionName)) continue;

    const applicable = extension(value, currentKey, parentKeysNext, context);

    if (applicable) {
      applicableExtension = applicable;
      visitedExtensions.add(extension);

      if (extension.extensionName) {
        visitedExtensions.add(extension.extensionName);
      }

      break;
    }
  }

  if (applicableExtension) {
    const parse: Parameters<ParsingExtensionTransform>[0] = (
      inner,
      metadataOverride,
      sourceOverride,
      extensionsOverride,
      contextOverride,
    ) =>
      parseValueInner(
        inner,
        sourceOverride ?? source,
        extensionsOverride ?? extensions,
        { ...metadata, ...metadataOverride },
        { ...context, ...contextOverride },
        parentKeys,
        root,
        parent,
        visitedExtensions,
      );

    // note that we don't traverse the object is an extension applied, that's up to them (with `parse`)
    return applicableExtension(parse, parent, source, extensions, root);
  }

  if (Array.isArray(value)) {
    const output = await Promise.all(
      Array.from(value.entries()).map(([index, item]) => {
        return parseValueInner(
          item,
          source,
          extensions,
          undefined,
          context,
          parentKeys.concat([[InArray, index]]),
          root,
          value,
        );
      }),
    );

    return new ParsedValue(source, value, output).assignMeta(metadata);
  }

  if (isObject(value)) {
    const obj: { [key: string]: ParsedValue } = {};

    // we have to queue up merging, so that non-merging keys get assigned first
    const toMerge: ParsedValue[] = [];
    const toOverride: ParsedValue[] = [];
    const flattenTo: ParsedValue[] = [];

    await Promise.all(
      Object.entries(value).map(async ([key, item]) => {
        const parsed = await parseValueInner(
          item,
          source,
          extensions,
          undefined,
          context,
          parentKeys.concat([[InObject, key]]),
          root,
          value,
        );

        // NOTE: shouldMerge is treated as shouldFlatten when the value itself is not an object (because we cannot merge arrays or primitives)
        if (parsed.meta.shouldFlatten) {
          flattenTo.push(parsed.removeMeta('shouldFlatten'));
        } else if (parsed.meta.shouldMerge) {
          if (parsed.isObject()) {
            toMerge.push(parsed.removeMeta('shouldMerge'));
          } else {
            flattenTo.push(parsed.removeMeta('shouldMerge'));
          }
        } else if (parsed.meta.shouldOverride) {
          if (parsed.isObject()) {
            toOverride.push(parsed.removeMeta('shouldOverride'));
          } else {
            flattenTo.push(parsed.removeMeta('shouldOverride'));
          }
        } else if (parsed.meta.rewriteKey) {
          if (typeof parsed.meta.rewriteKey !== 'string') {
            throw new AppConfigError('Internal error: rewriteKey was not a string');
          }

          obj[parsed.meta.rewriteKey] = parsed.removeMeta('rewriteKey');
        } else {
          obj[key] = parsed;
        }
      }),
    );

    if (flattenTo.length > 0) {
      if (Object.keys(value).length > 1) {
        logger.warn(
          `An object with multiple keys is being flattened. Other values will be ignored.`,
        );
      }

      if (flattenTo.length > 1) {
        logger.warn(
          `Two values were present in an object that both tried to "flatten" - this is undefined behavior`,
        );
      }

      return flattenTo[0].assignMeta(metadata);
    }

    let output = new ParsedValue(source, value, obj).assignMeta(metadata);

    // do merge(s) at the end, so it applies regardless of key order
    for (const parsed of toMerge) {
      output = ParsedValue.merge(parsed, output);
    }

    // toMerge vs toOverride just changes the order of precedent when merging
    for (const parsed of toOverride) {
      output = ParsedValue.merge(output, parsed);
    }

    return output;
  }

  return new ParsedValue(source, value, value).assignMeta(metadata);
}
