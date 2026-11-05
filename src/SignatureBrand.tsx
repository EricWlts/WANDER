// Approved source art only: compose the mountain W with the existing ANDER glyphs.
// A shared SVG coordinate system keeps cap height, spacing and baseline independent
// of web-font loading. Neither source paths nor monogram proportions are changed.
const horizontalBrand = "/assets/brand/logos/wander-logo-horizontal-white.svg";

export function SignatureWordmark() {
  return (
    <svg viewBox="0 0 736 84" aria-hidden="true" focusable="false">
      <svg x="0" y="1" width="154" height="80" viewBox="65 74 279 145">
        <image href={horizontalBrand} width="1280" height="345" />
      </svg>
      <svg x="184" y="0" width="556" height="83" viewBox="576 195 556 83">
        <image href={horizontalBrand} width="1280" height="345" />
      </svg>
    </svg>
  );
}

export function BrandMonogram({ light = false }: { light?: boolean }) {
  return (
    <svg
      className="compass brand-monogram"
      viewBox="0 0 1000 1000"
      aria-hidden="true"
      focusable="false"
    >
      {light ? (
        <svg x="110" y="297" width="776" height="403" viewBox="65 74 279 145">
          <image href={horizontalBrand} width="1280" height="345" />
        </svg>
      ) : (
        <image
          href="/assets/brand/logos/wander-monogram-black.svg"
          width="1000"
          height="1000"
        />
      )}
    </svg>
  );
}
