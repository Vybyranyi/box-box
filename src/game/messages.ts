/**
 * A translatable message produced by game logic (radio, race control, advice, objectives).
 * Game code never builds display strings: it returns a key into messages/*.json plus values,
 * and the UI translates it at render time. A value can itself be a message (e.g. a tyre name).
 */
export type Msg = {
  key: string;
  values?: Record<string, string | number | Msg>;
};

export const msg = (key: string, values?: Msg["values"]): Msg => ({
  key,
  values,
});

/** Any translate function shaped like next-intl's `t`. */
export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function translate(t: Translate, message: Msg): string {
  if (!message.values) return t(message.key);
  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(message.values)) {
    values[name] = typeof value === "object" ? translate(t, value) : value;
  }
  return t(message.key, values);
}

export const tyreName = (compound: string) => msg(`tyres.${compound}`);
export const tyresPlural = (compound: string) => msg(`tyresPlural.${compound}`);
