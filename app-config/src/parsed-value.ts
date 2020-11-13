import { inspect } from 'util';
import merge from 'lodash.merge';
import { Json, JsonObject, JsonPrimitive, PromiseOrNot, isObject } from './common';
import { ConfigSource, LiteralSource } from './config-source';
import { AppConfigError } from './errors';

/** The property being visited was a property in an object */
export const InObject = Symbol('InObject');
/** The property being visited was a value in an array */
export const InArray = Symbol('InArray');
/** The property being visited is the root object */
export const Root = Symbol('Root');

export type ParsingExtensionKey =
  | [typeof InObject, string]
  | [typeof InArray, number]
  | [typeof Root];

export type ParsingExtension = (
  value: Json,
  key: ParsingExtensionKey,
  context: ParsingExtensionKey[],
) => false | ParsingExtensionTransform;

export type ParsingExtensionTransform = (
  parse: (
    value: Json,
    metadata?: ParsedValueMetadata,
    source?: ConfigSource,
    extensions?: ParsingExtension[],
  ) => Promise<ParsedValue>,
  parent: JsonObject | Json[] | undefined,
  source: ConfigSource,
  extensions: ParsingExtension[],
) => PromiseOrNot<ParsedValue>;

export interface ParsedValueMetadata {
  [key: string]: any;
}

type ParsedValueInner = JsonPrimitive | { [k: string]: ParsedValue } | ParsedValue[];

/** Wrapper abstraction of values parsed, allowing for transformations of data (while keeping original raw form) */
export class ParsedValue {
  public readonly meta: ParsedValueMetadata = {};

  constructor(
    public readonly source: ConfigSource,
    private readonly rawValue: Json,
    private readonly value: ParsedValueInner,
  ) {}

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
  ): Promise<ParsedValue> {
    return parseValue(raw, source, extensions, metadata);
  }

  /** Parses (with extensions) from a plain JSON object */
  static async parseLiteral(raw: Json, extensions: ParsingExtension[] = []): Promise<ParsedValue> {
    return parseValue(raw, new LiteralSource(raw), extensions);
  }

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
      return new ParsedValue(b.source, b.rawValue, b.value).assignMeta(meta);
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

    if (isObject(a.rawValue) && isObject(b.rawValue)) {
      const rawKeys = new Set(Object.keys(b.rawValue).concat(Object.keys(a.rawValue)));

      for (const key of rawKeys) {
        let newRawValueK;

        if (a.rawValue[key] && b.rawValue[key]) {
          newRawValueK = merge({}, a.rawValue[key], b.rawValue[key]);
        } else {
          newRawValueK = b.rawValue[key] ?? a.rawValue[key];
        }

        Object.assign(newRawValue, { [key]: newRawValueK });
      }
    } else {
      newRawValue = b.rawValue;
    }

    return new ParsedValue(a.source, newRawValue, newValue).assignMeta(meta);
  }

  assignMeta(metadata: ParsedValueMetadata) {
    Object.assign(this.meta, metadata);
    return this;
  }

  removeMeta(key: string) {
    delete this.meta[key];
    return this;
  }

  /** Lookup property by nested key */
  property([key, ...rest]: string[]): ParsedValue | undefined {
    if (!key || !this.value || typeof this.value !== 'object') {
      return this;
    }

    if (Array.isArray(this.value)) {
      return this.value[parseFloat(key)]?.property(rest);
    }

    return this.value[key]?.property(rest);
  }

  asObject(): { [key: string]: ParsedValue } | undefined {
    if (typeof this.value === 'object' && this.value !== null && !Array.isArray(this.value)) {
      return this.value;
    }
  }

  asArray(): ParsedValue[] | undefined {
    if (Array.isArray(this.value)) return this.value;
  }

  asPrimitive(): JsonPrimitive | undefined {
    if ((typeof this.value !== 'object' || this.value === null) && !Array.isArray(this.value)) {
      return this.value;
    }
  }

  cloneWhere(filter: (value: ParsedValue) => boolean): ParsedValue {
    if (Array.isArray(this.value)) {
      const filtered = this.value.filter(filter);

      return new ParsedValue(
        this.source,
        filtered.map((v) => v.rawValue),
        filtered.map((v) => v.cloneWhere(filter)),
      );
    }

    if (typeof this.value === 'object' && this.value !== null) {
      const value: { [k: string]: ParsedValue } = {};
      const rawValue: JsonObject = {};

      for (const [key, entry] of Object.entries(this.value)) {
        if (filter(entry)) {
          value[key] = entry.cloneWhere(filter);

          if (isObject(this.rawValue)) {
            rawValue[key] = this.rawValue[key];
          }
        }
      }

      return new ParsedValue(this.source, rawValue, value);
    }

    if (!filter(this)) {
      throw new AppConfigError('ParsedValue::cloneWhere filtered itself out');
    }

    return new ParsedValue(this.source, this.rawValue, this.value);
  }

  get raw(): Json {
    return this.rawValue;
  }

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

export async function parseValue(
  value: Json,
  source: ConfigSource,
  extensions: ParsingExtension[] = [],
  metadata: ParsedValueMetadata = {},
): Promise<ParsedValue> {
  return parseValueInner(value, source, extensions, metadata, [[Root]], undefined);
}

async function parseValueInner(
  value: Json,
  source: ConfigSource,
  extensions: ParsingExtension[],
  metadata: ParsedValueMetadata = {},
  context: ParsingExtensionKey[],
  parent?: JsonObject | Json[],
  visitedExtensions: ParsingExtension[] = [],
): Promise<ParsedValue> {
  const [currentKey] = context.slice(-1);
  const contextualKeys = context.slice(0, context.length - 1);

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
    if (visitedExtensions.includes(extension)) continue;

    const applicable = extension(value, currentKey, contextualKeys);

    if (applicable && !applicableExtension) {
      applicableExtension = applicable;
      visitedExtensions.push(extension);
    }
  }

  if (applicableExtension) {
    const parse = (
      inner: Json,
      metadataOverride?: ParsedValueMetadata,
      sourceOverride?: ConfigSource,
      extensionsOverride?: ParsingExtension[],
    ) =>
      parseValueInner(
        inner,
        sourceOverride ?? source,
        extensionsOverride ?? extensions,
        { ...metadata, ...metadataOverride },
        context,
        parent,
        visitedExtensions,
      );

    // note that we don't traverse the object is an extension applied, that's up to them (with `parse`)
    return applicableExtension(parse, parent, source, extensions);
  }

  if (Array.isArray(value)) {
    const output = await Promise.all(
      Array.from(value.entries()).map(([index, item]) => {
        return parseValueInner(
          item,
          source,
          extensions,
          undefined,
          context.concat([[InArray, index]]),
          value,
        );
      }),
    );

    return new ParsedValue(source, value, output).assignMeta(metadata);
  }

  if (isObject(value)) {
    const object: { [key: string]: ParsedValue } = {};

    // we have to queue up merging, so that non-merging keys get assigned first
    const toMerge: ParsedValue[] = [];
    const toOverride: ParsedValue[] = [];
    let flattenTo: ParsedValue | undefined;

    await Promise.all(
      Object.entries(value).map(async ([key, item]) => {
        const parsed = await parseValueInner(
          item,
          source,
          extensions,
          undefined,
          context.concat([[InObject, key]]),
          value,
        );

        // if we got back 'shouldFlatten', jump out of the object
        if (parsed.meta.shouldFlatten) {
          flattenTo = parsed.removeMeta('shouldFlatten').assignMeta(metadata);
        } else if (parsed.meta.shouldMerge) {
          toMerge.push(parsed.removeMeta('shouldMerge'));
        } else if (parsed.meta.shouldOverride) {
          toOverride.push(parsed.removeMeta('shouldOverride'));
        } else {
          object[key] = parsed;
        }
      }),
    );

    if (flattenTo) {
      return flattenTo;
    }

    let output = new ParsedValue(source, value, object).assignMeta(metadata);

    // do merges (this is almost always just one) at the end, so it wins over key order
    for (const parsed of toMerge) {
      output = ParsedValue.merge(parsed, output);
    }

    // toMerge vs toOverride just changes order of precedent
    for (const parsed of toOverride) {
      output = ParsedValue.merge(output, parsed);
    }

    return output;
  }

  return new ParsedValue(source, value, value).assignMeta(metadata);
}
