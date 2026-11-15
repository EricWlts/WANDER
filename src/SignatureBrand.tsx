// Approved source art only: compose the mountain W with the existing ANDER glyphs.
// A shared SVG coordinate system keeps cap height, spacing and baseline independent
// of web-font loading. The single monogram is no longer used on its own.
const horizontalLight = "/assets/brand/logos/wander-logo-horizontal-white.svg";
const horizontalDark = "/assets/brand/logos/wander-logo-horizontal-black.svg";

export function SignatureWordmark({ tone = "light", className = "brand-signature" }: { tone?: "light" | "dark"; className?: string }) {
  const horizontalBrand = tone === "dark" ? horizontalDark : horizontalLight;
  return (
    <svg className={className} viewBox="0 0 736 84" aria-hidden="true" focusable="false">
      <svg x="0" y="1" width="154" height="80" viewBox="65 74 279 145">
        <image href={horizontalBrand} width="1280" height="345" />
      </svg>
      <svg x="184" y="0" width="556" height="83" viewBox="576 195 556 83">
        <image href={horizontalBrand} width="1280" height="345" />
      </svg>
    </svg>
  );
}
