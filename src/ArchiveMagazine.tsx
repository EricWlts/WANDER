import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { t } from "./I18n";
import { issueKicker, seasonOf, travelDate } from "./issueLabel";
import { Picture } from "./components";
import { archiveFocusVars } from "./editionOverrides";
import { coverLinkProps } from "./viewTransitions";
import type { Journey } from "./types";

const SEASONS: Record<string, [string, string]> = {
  winter: ["Winter", "Winter"],
  spring: ["Spring", "Frühling"],
  summer: ["Summer", "Sommer"],
  autumn: ["Autumn", "Herbst"],
};

function seasonYear(date: string | null | undefined, de: boolean): string {
  const s = seasonOf(date);
  const y = /^(\d{4})/.exec(date ?? "")?.[1] ?? "";
  return [s ? SEASONS[s][de ? 1 : 0] : "", y].filter(Boolean).join(" ");
}

function MagazineBand({ journey: j, issue }: { journey: Journey; issue: number }) {
  const place = [j.location, j.country].filter(Boolean).join(", ");
  const when0 = travelDate(j);
  const kicker = t(issueKicker(issue, when0, "en"), issueKicker(issue, when0, "de"));
  const when = t(seasonYear(when0, false), seasonYear(when0, true));
  const blurb = j.subtitle || j.description || place;
  const hasCover = Boolean(j.cover?.url);
  return (
    <li id={`issue-${issue}`} className="am-item">
      <Link
        to={`/journeys/${j.slug}`}
        {...coverLinkProps(j.slug, j.cover)}
        className={`am-card${hasCover ? "" : " is-bare"}`}
        aria-label={`${t("View story", "Geschichte ansehen")}: ${j.title}, ${kicker}`}
      >
        {hasCover && (
          <div
            className={`am-cover${(j.layout?.archive_focus || j.cover_focus) ? " has-cover-focus" : ""}`}
            style={archiveFocusVars(j) as CSSProperties | undefined}
          >
            <Picture animate photo={j.cover} sizes="100vw" />
          </div>
        )}
        <div className="am-shade" aria-hidden="true" />
        <div className="am-copy">
          <p className="am-when" aria-hidden="true">
            <span className="am-when-no">{String(issue).padStart(2, "0")}</span>
            {when && <span>{when}</span>}
          </p>
          <h2 className="am-title">{j.title}</h2>
          {blurb && <p className="am-sub">{blurb}</p>}
          <span className="am-open" aria-hidden="true">
            <span>{t("View story", "Geschichte ansehen")}</span>
            <span className="am-open-line" />
          </span>
        </div>
        {place && (
          <p className="am-kicker" aria-hidden="true">
            <span>{place}</span>
          </p>
        )}
      </Link>
    </li>
  );
}

/** Cinematic magazine: one full-bleed band per journey, cover as background. */
export function ArchiveMagazine({ journeys, issues }: { journeys: Journey[]; issues: Map<number, number> }) {
  return (
    <ol className="am-grid" aria-label={t("All stories", "Alle Geschichten")}>
      {journeys.map((j, i) => (
        <MagazineBand key={j.id} journey={j} issue={issues.get(j.id) ?? i + 1} />
      ))}
    </ol>
  );
}
