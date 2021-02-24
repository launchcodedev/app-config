export const isBrowser =
  typeof window === 'object' && typeof document === 'object' && document.nodeType === 9;

export const isNode = typeof process !== 'undefined' && !isBrowser;
export const isWindows = isNode && /^win/.test(process.platform);

export type JsonPrimitive = number | string | boolean | null;

export interface JsonObject {
  [key: string]: Json;
}

export interface JsonArray extends Array<Json> {}

export type Json = JsonPrimitive | JsonArray | JsonObject;

export function isObject(obj: Json): obj is JsonObject {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
}

export function isPrimitive(obj: Json): obj is JsonPrimitive {
  return !isObject(obj) && !Array.isArray(obj);
}
