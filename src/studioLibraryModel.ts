export function shouldShowEmptyLibrary(
  loading: boolean,
  error: string,
  journeyCount: number,
) {
  return !loading && !error && journeyCount === 0;
}
