export function closeNavigationOnEscape(
  event: Pick<KeyboardEvent, "key" | "preventDefault">,
  closeMenu: () => void,
  toggle: Pick<HTMLElement, "focus"> | null,
) {
  if (event.key !== "Escape") return false;
  event.preventDefault();
  closeMenu();
  toggle?.focus();
  return true;
}
