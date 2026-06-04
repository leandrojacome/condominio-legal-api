/** Keys of T whose value type includes undefined */
type UndefinedKeys<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/** Keys of T whose value type does NOT include undefined */
type DefinedKeys<T> = Exclude<keyof T, UndefinedKeys<T>>;

/** Object with all undefined-valued properties stripped (no undefined in value types) */
export type WithoutUndefinedValues<T> = {
  [K in DefinedKeys<T>]: T[K];
} & {
  [K in UndefinedKeys<T>]?: Exclude<T[K], undefined>;
};

/**
 * Removes keys with undefined values from an object.
 * Required when passing Zod partial() results to Prisma under exactOptionalPropertyTypes.
 */
export function stripUndefined<T extends object>(obj: T): WithoutUndefinedValues<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as WithoutUndefinedValues<T>;
}
