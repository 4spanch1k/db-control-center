import type { LocaleDictionary } from "./locales/en";

type Join<K, P> = K extends string
  ? P extends string
    ? `${K}.${P}`
    : never
  : never;

type LeafPaths<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : Join<K, LeafPaths<T[K]>>;
    }[keyof T & string];

export type Language = "en" | "ru";
export type DictionaryShape = LocaleDictionary;
export type TranslationKey = LeafPaths<DictionaryShape>;
