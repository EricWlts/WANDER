import { Field } from "./components";
import { t } from "./I18n";
export function HoverZoomControl({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="hover-zoom-control">
      <Field label={t("Zoom on hover", "Zoom beim Darüberfahren")}>
        <select
          value={
            value === undefined
              ? "inherit"
              : [0, 2.5, 6, 12].includes(value)
                ? String(value)
                : "custom"
          }
          onChange={(e) =>
            onChange(
              e.target.value === "inherit"
                ? undefined
                : e.target.value === "custom"
                  ? 8
                  : Number(e.target.value),
            )
          }
        >
          <option value="inherit">
            {t(
              "Inherit · subtle by default",
              "Übernehmen · standardmäßig dezent",
            )}
          </option>
          <option value="0">{t("Off", "Aus")}</option>
          <option value="2.5">{t("Subtle · 2.5%", "Dezent · 2,5 %")}</option>
          <option value="6">{t("Medium · 6%", "Mittel · 6 %")}</option>
          <option value="12">
            {t("Expressive · 12%", "Ausgeprägt · 12 %")}
          </option>
          <option value="custom">{t("Custom", "Individuell")}</option>
        </select>
      </Field>
      {value !== undefined && value > 0 && (
        <Field
          label={`${t("Hover zoom strength", "Stärke des Hover-Zooms")} · ${value} %`}
        >
          <input
            type="range"
            min="0"
            max="20"
            step="0.5"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </Field>
      )}
    </div>
  );
}
