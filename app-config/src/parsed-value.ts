import { inspect } from 'util';
import merge from 'lodash.merge';
import { Json, JsonPrimitive, isObject } from './common';
import { ConfigSource, LiteralSource } from './config-source';
import { FileParsingExtension } from './extensions';

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
    extensions: FileParsingExtension[] = [],
  ): Promise<ParsedValue> {
    return parseValue(raw, source, extensions);
  }

  /** Parses (with extensions) from a plain JSON object */
  static async parseLiteral(
    raw: Json,
    extensions: FileParsingExtension[] = [],
  ): Promise<ParsedValue> {
    return parseValue(raw, new LiteralSource(raw), extensions);
  }

  /** Constructs a ParsedValue from a plain JSON object, which was known to have come from an encrypted value */
  static fromEncrypted(raw: Json): ParsedValue {
    return ParsedValue.literal(raw).setMeta({ parsedFromEncryptedValue: true });
  }

  setMeta(metadata: ParsedValueMetadata) {
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
      return `ParsedValue(encrypted) <${this.toString()}>`;
    }

    return `ParsedValue <${this.toString()}>`;
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
  extensions: FileParsingExtension[],
): Promise<ParsedValue> {
  if (Array.isArray(raw)) {
    const transformed = await Promise.all(raw.map((v) => parseValue(v, source, extensions)));

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
      parsedValue.setMeta(metadata);

      if (shouldFlatten) return parsedValue;
      transformed[key] = parsedValue;
    }

    return new ParsedValue(source, raw, transformed);
  }

  return new ParsedValue(source, raw, raw);
}
