import { inspect } from 'util';
import merge from 'lodash.merge';
import { Json, JsonPrimitive, isObject } from './common';
import { ConfigSource, LiteralSource } from './config-source';
import { ParsingExtension, InArray } from './extensions';

type ParsedValueInner = JsonPrimitive | { [k: string]: ParsedValue } | ParsedValue[];

export interface ParsedValueMetadata {
  [key: string]: any;
}

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
    extensions: ParsingExtension[] = [],
  ): Promise<ParsedValue> {
    return parseValue(raw, source, extensions);
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

  asArray(): ParsedValue[] | undefined {
    if (Array.isArray(this.value)) return this.value;
  }

  asPrimitive(): JsonPrimitive | undefined {
    if ((typeof this.value !== 'object' || this.value === null) && !Array.isArray(this.value)) {
      return this.value;
    }
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

async function parseValue(
  raw: Json,
  source: ConfigSource,
  extensions: ParsingExtension[],
): Promise<ParsedValue> {
  if (Array.isArray(raw)) {
    const transformed = await Promise.all(
      raw.map(async (value) => {
        let parsedValue: ParsedValue | undefined;

        for (const ext of extensions) {
          const apply = ext(InArray, value);
          if (!apply) continue;

          // note that we just ignore "flatten" and friends here
          const [transformed, { metadata }] = await apply(source, extensions);

          if (transformed instanceof ParsedValue) {
            parsedValue = transformed;
          } else {
            parsedValue = await parseValue(transformed, source, extensions);
          }

          if (metadata) parsedValue.assignMeta(metadata);
        }

        if (!parsedValue) {
          parsedValue = await parseValue(value, source, extensions);
        }

        return parsedValue;
      }),
    );

    return new ParsedValue(source, raw, transformed);
  }

  if (isObject(raw)) {
    const transformed: ParsedValueInner = {};

    let key: string;
    let value: Json;

    for ([key, value] of Object.entries(raw)) {
      // value that should be assigned to this key, or flattened to parent if shouldFlatten
      let parsedValue: ParsedValue | undefined;
      // buffer the "flatten" boolean, so that all extensions run before short circuiting
      let shouldFlatten = false;

      // metadata that should be forwarded into ParsedValue
      const metadata: ParsedValueMetadata = {};

      // go through extensions, and perform their transforms if applicable
      for (const ext of extensions) {
        const apply = ext(key, value);
        if (!apply) continue;

        const [
          transformed,
          { flatten, merge: shouldMerge, override: shouldOverride, metadata: newMetadata },
        ] = await apply(source, extensions);

        shouldFlatten = shouldFlatten || flatten || false;

        let transformedValue: Json;

        if (transformed instanceof ParsedValue) {
          Object.assign(metadata, transformed.meta);
          transformedValue = transformed.toJSON();
        } else {
          transformedValue = transformed;
        }

        if (newMetadata) {
          Object.assign(metadata, newMetadata);
        }

        if (isObject(transformedValue)) {
          if (shouldOverride) {
            value = merge({}, raw, transformedValue);

            // since we merged into our parent, remove the key that we used to inhabit
            value[key] = transformedValue[key];
            if (value[key] === undefined) delete value[key];
          } else if (shouldMerge) {
            value = merge({}, transformedValue, raw);

            // since we merged into our parent, remove the key that we used to inhabit
            value[key] = transformedValue[key];
            if (value[key] === undefined) delete value[key];
          }
        } else {
          value = transformedValue;
        }
      }

      if (!parsedValue) {
        parsedValue = await parseValue(value, source, extensions);
      }

      // we passthrough any metadata (like parsedFromEncryptedValue) into the final value
      parsedValue.assignMeta(metadata);

      if (shouldFlatten) return parsedValue;
      transformed[key] = parsedValue;
    }

    return new ParsedValue(source, raw, transformed);
  }

  return new ParsedValue(source, raw, raw);
}
