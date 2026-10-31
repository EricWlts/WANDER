export function mergeIdRefs(
  existing: string | undefined,
  generated: string | undefined,
) {
  return [
    ...new Set(
      [existing, generated]
        .flatMap((value) => value?.split(/\s+/) ?? [])
        .filter(Boolean),
    ),
  ].join(" ");
}
