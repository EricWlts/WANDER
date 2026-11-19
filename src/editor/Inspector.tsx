import { legacyLayoutPatch, presetsFor, readLayout } from "../editorPresets";
import { cloneElement, useEffect, useId, useState, type KeyboardEvent, type ReactElement, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  Eye,
  ArrowUp,
  Copy,
  Images,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { Field } from "../components";
import { RangeField, SegmentedControl, VariantPicker } from "../EditorControls";
import { CoverFocusEditor } from "../CoverFocusEditor";
import { ArchiveFocusEditor } from "../ArchiveFocusEditor";
import { ImageControls } from "../ImageControls";
import { edgeToEdgeAvailable, edgeToEdgeActive } from "../edgeMedia";
import { STAGGER_MAX_PX, defaultSideMargin, pairOffsets } from "../imageFrame";
import { getLocale, t } from "../I18n";
import { SIDE_MARGIN_MAX, moduleNames, modulePhotos } from "../JournalCanvas";
import { photoDateRange } from "../journeyDates";
import { JOURNEY_FORMS, formName, formOf, isPlaceholderTitleOfAnyForm, placeholderTitle, withForm, type JourneyForm } from "../journeyForm";
import { placementsFor, rootPhotos, typePresets } from "../journalModel";
import { isEditionJourney } from "../editionOverrides";
import { ModulePhotographs } from "../ModulePhotographs";
import { SingleImageFrame, TitlePositionControl, WallSettings } from "../ModuleSettings";
import { Upload } from "../Upload";
import type { Chapter, Journey, Layout } from "../types";
import { useEditor } from "./EditorContext";

const MARGIN_TOP_BOTTOM_DEFAULT = 32;
/** Width of the text block without an own setting (see .text-prose-default-width in journal.css). */
const defaultTextWidth = (kind: Chapter["kind"]) => (kind === "text" ? 64 : 56);

const TEXT_KINDS: string[] = ["chapter", "text", "quote"];
const FRAME_KINDS: string[] = ["image", "pair", "wall", "gallery"];
const TEXT_SIZES = [
  ["small", "Small", "Klein"],
  ["medium", "Medium", "Mittel"],
  ["large", "Large", "Groß"],
] as const;

/** Active size button; text without a stored size is the calm (small) default. */
function textSize(layout: Layout): "small" | "medium" | "large" | undefined {
  const preset = layout.text_preset ?? "small";
  return preset === "display" ? undefined : preset;
}

/** Plain block for module settings, collapsible section for the story/cover details. */
function InspectorSection({
  plain,
  open,
  title,
  children,
}: {
  plain: boolean;
  open: boolean;
  title: string;
  children: ReactNode;
}) {
  return plain ? (
    <div className="inspector-plain">{children}</div>
  ) : (
    <details className="inspector-section" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

/**
 * Title field of a module. Only a day / chapter needs a title: when its field is emptied,
 * the empty text stays in the field while typing, but the module keeps its last title
 * (the server refuses an untitled chapter) and the field returns to it on leaving.
 * Every other module may stay untitled; the module type is shown as a hint then.
 */
function ModuleTitleInput({
  kind,
  value,
  onCommit,
}: {
  kind: Chapter["kind"];
  value: string;
  onCommit: (title: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const required = kind === "chapter";
  return (
    <input
      maxLength={160}
      value={text}
      placeholder={required ? undefined : t(...moduleNames[kind])}
      onChange={(e) => {
        setText(e.target.value);
        if (!required || e.target.value.trim() !== "") onCommit(e.target.value);
      }}
      onBlur={() => setText(value)}
    />
  );
}

function sideMarginDefault(layout: Layout, storyTemplate: Journey["story_template"]): number {
  return defaultSideMargin(
    layout.edition && layout.edition !== "inherit" ? layout.edition : storyTemplate,
    storyTemplate,
    layout.padding,
  );
}

/** Margin slider row: the reset button sits at the right end of the label row. */
function MarginField({
  label,
  value,
  resetLabel,
  changed,
  onReset,
  children,
}: {
  label: string;
  value?: string;
  resetLabel: string;
  changed: boolean;
  onReset: () => void;
  children: ReactElement<{ "aria-labelledby"?: string }>;
}) {
  const id = useId();
  return (
    <div className="field margin-field">
      <div className="margin-field-head">
        <span id={`${id}-label`}>{label}</span>
        {value !== undefined && <output aria-hidden="true">{value}</output>}
        <button
          type="button"
          className="margin-reset"
          aria-label={resetLabel}
          disabled={!changed}
          style={changed ? undefined : { visibility: "hidden" }}
          onClick={onReset}
        >
          <RotateCcw size={13} aria-hidden="true" />
          {t("Reset", "Zurücksetzen")}
        </button>
      </div>
      {cloneElement(children, { "aria-labelledby": `${id}-label`, ...(value !== undefined ? { "aria-valuetext": value } : {}) } as Partial<{ "aria-labelledby"?: string }>)}
    </div>
  );
}

type InspectorPane = "content" | "design";

/** Image modules: their title is only a name in the storyboard, edited under „Mehr“. */
const NAMED_KINDS: readonly string[] = ["image", "pair", "rail", "filmstrip", "wall", "gallery"];

const PANES: readonly (readonly [InspectorPane, string, string])[] = [
  ["content", "Content", "Inhalt"],
  ["design", "Design", "Gestaltung"],
];

/** The settings panel next to the preview: what is selected, and how to edit it. */
export function Inspector() {
  const {
    journey,
    selected,
    module,
    photo,
    photoModule,
    selectionLabel,
    busy,
    backgroundSaving,
    uploadBusy,
    conflicted,
    titleInput,
    change,
    moduleChange,
    photoChange,
    layoutChange: rawLayoutChange,
    save,
    selectCanvas,
    returnToModule,
    removePlacement,
    adoptPhotoDates,
    reorder,
    duplicate,
    requestModuleRemoval,
    uploaded,
    askDeleteUploaded,
    markConflict,
    setUploadBusy,
    openPicker,
    chooseImage,
    deletePhoto,
    showSelectionInPreview,
    textFocus,
    clearTextFocus,
    layoutIssue,
  } = useEditor();
  const [pane, setPane] = useState<InspectorPane>("content");
  const issueHere = layoutIssue && module && layoutIssue.moduleId === module.id ? layoutIssue : null;
  useEffect(() => {
    // A save rejected because of this module's setting opens the pane that holds it.
    if (issueHere) setPane(issueHere.pane);
  }, [issueHere]);
  const tabsId = useId();
  const focusModuleId = module?.id;
  useEffect(() => {
    // A click on an empty text's placeholder puts the cursor into the matching field.
    if (!textFocus || focusModuleId !== textFocus.moduleId) return undefined;
    const timer = window.setTimeout(() => {
      const field = document.getElementById(
        textFocus.field === "quote" ? "inspector-module-quote" : "inspector-module-story",
      ) as HTMLTextAreaElement | null;
      if (field) {
        field.focus({ preventScroll: true });
        field.setSelectionRange(field.value.length, field.value.length);
        field.scrollIntoView({ block: "center", behavior: "instant" });
      }
      clearTextFocus();
    }, 40);
    return () => window.clearTimeout(timer);
  }, [textFocus, focusModuleId, clearTextFocus]);
  const j = journey;
  const layout = module ? readLayout(module.kind, module.layout) : journey?.layout || {};
  /** Edits on a legacy „Mit Weißraum“ module first store it as „Gerahmt“, which it shows. */
  const layoutChange = (id: number | null, patch: Partial<Layout>) => {
    const target = id === null ? undefined : j.chapters.find((c) => c.id === id);
    rawLayoutChange(id, target ? { ...legacyLayoutPatch(target.kind, target.layout), ...patch } : patch);
  };
  const legacyStagger = pairOffsets({ column_offsets: layout.column_offsets });
  const staggerValue =
    layout.stagger ??
    (legacyStagger ? Math.round((legacyStagger[1] / STAGGER_MAX_PX) * 100) : 0);
  const showStagger = layout.stagger !== undefined || !!legacyStagger;
  const photoRange = journey ? photoDateRange(journey.photos) : null;
  const edgePhotos = module && journey ? modulePhotos(module, journey) : [];
  const edgeAvailable = !!module && edgeToEdgeAvailable(module.kind, edgePhotos, layout);
  const railAsPair = !!module && module.kind === "rail" && edgePhotos.length === 2;
  /** Two photographs in a running row look better side by side: same photographs, position and chapter. */
  const convertRailToPair = () => {
    if (!module) return;
    const { rail_mode, rail_size, rail_loop, speed, ...rest } = layout;
    void rail_mode; void rail_size; void rail_loop; void speed;
    const next: Layout = { ...rest, columns: 2 };
    if (edgeToEdgeAvailable("pair", edgePhotos, next)) next.edge_to_edge = true;
    moduleChange(module.id, { kind: "pair", layout: next });
  };
  const form = formOf(journey);
  const formHints: Record<JourneyForm, string> = {
    journey: t("Several days, told day by day.", "Mehrere Tage, nach Tagen erzählt."),
    collection: t("Pictures on one theme, freely arranged.", "Bilder zu einem Thema, frei angeordnet."),
    moment: t("One day, one place, a few pictures.", "Ein Tag, ein Ort, wenige Bilder."),
  };
  function switchForm(next: JourneyForm) {
    if (!journey || next === form) return;
    change({
      layout: withForm(journey.layout, next),
      // An unnamed story keeps a fitting placeholder title.
      ...(journey.title.trim() !== "" && isPlaceholderTitleOfAnyForm(journey.title)
        ? { title: placeholderTitle(next, getLocale()) }
        : {}),
      // A moment is a single day.
      ...(next === "moment" ? { end_date: journey.start_date } : {}),
    });
  }
  const uploadPhotoIds = j.photos.map((p) => p.id);
  const moduleIndex = module
    ? j.chapters
        .filter(
          (c) =>
            (c.layout?.parent_id || null) ===
            (module.layout?.parent_id || null),
        )
        .findIndex((c) => c.id === module.id)
    : 0;
  const moduleTools = module ? (
      <div className="module-tools">
        <button
          disabled={moduleIndex === 0}
          aria-label={t("Move up", "Nach oben")}
          onClick={() => reorder(module.id, -1)}
        >
          <ArrowUp size={17} />
        </button>
        <button
          disabled={
            moduleIndex ===
            j.chapters.filter(
              (c) =>
                (c.layout?.parent_id || null) ===
                (module.layout?.parent_id || null),
            ).length -
              1
          }
          aria-label={t("Move down", "Nach unten")}
          onClick={() => reorder(module.id, 1)}
        >
          <ArrowDown size={17} />
        </button>
        <button
          aria-label={t(
            "Duplicate module",
            "Modul duplizieren",
          )}
          onClick={() => duplicate(module)}
        >
          <Copy size={17} />
        </button>
        <button
          aria-label={t(
            "Remove module; photographs are preserved",
            "Modul entfernen; Fotos bleiben erhalten",
          )}
          onClick={(e) => requestModuleRemoval(module.id, e.currentTarget)}
        >
          <Trash2 size={17} />
        </button>
      </div>
  ) : null;
  const tabbed = !!module && !photo && selected.type !== "intro";
  const paneProps = (key: InspectorPane, part = 1) =>
    tabbed
      ? {
          role: "tabpanel" as const,
          id: `${tabsId}-${key}-${part}`,
          "aria-labelledby": `${tabsId}-${key}`,
          hidden: pane !== key,
        }
      : {};
  const paneKeys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const index = PANES.findIndex(([key]) => key === pane);
    const next =
      e.key === "ArrowRight" ? (index + 1) % PANES.length
      : e.key === "ArrowLeft" ? (index + PANES.length - 1) % PANES.length
      : e.key === "Home" ? 0
      : e.key === "End" ? PANES.length - 1
      : -1;
    if (next < 0) return;
    e.preventDefault();
    setPane(PANES[next][0]);
    document.getElementById(`${tabsId}-${PANES[next][0]}`)?.focus();
  };
  const kindName = photo
    ? t("Photograph", "Foto")
    : module
      ? t(...moduleNames[module.kind])
      : selected.type === "intro"
        ? t("Introduction", "Einleitung")
        : t("Story cover", "Titelbild");
  const headTitle = photo
    ? selectionLabel
    : module
      ? module.title.trim() || kindName
      : selected.type === "intro"
        ? kindName
        : j.title.trim() || kindName;
  const headPhoto = photo
    ? photo
    : module
      ? modulePhotos(module, j)[0]
      : selected.type === "intro"
        ? undefined
        : j.photos.find((p) => p.id === j.cover_id) ?? j.cover ?? undefined;
  return (
    <aside className="module-inspector">
      <div className="inspector-top">
        <div className="panel-heading inspector-head">
          <span className="inspector-head-thumb" aria-hidden="true">
            {headPhoto ? (
              <img src={headPhoto.url} srcSet={headPhoto.srcset || undefined} sizes="56px" alt="" decoding="async" />
            ) : (
              <Settings2 size={16} />
            )}
          </span>
          <span className="inspector-head-text">
            {headTitle !== kindName && <small>{kindName}</small>}
            <strong>{headTitle}</strong>
          </span>
          <button
            type="button"
            className="inspector-reveal"
            aria-label={t("Show selection in preview", "Auswahl in der Vorschau zeigen")}
            title={t("Show selection in preview", "Auswahl in der Vorschau zeigen")}
            onClick={showSelectionInPreview}
          >
            <Eye size={16} aria-hidden="true" />
          </button>
        </div>
        {tabbed && (
          <div className="inspector-tabs" role="tablist" aria-label={t("Module settings", "Moduleinstellungen")}>
            {PANES.map(([key, en, de]) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`${tabsId}-${key}`}
                aria-selected={pane === key}
                aria-controls={key === "content" ? `${tabsId}-content-1 ${tabsId}-content-2` : `${tabsId}-${key}-1`}
                tabIndex={pane === key ? 0 : -1}
                onClick={() => setPane(key)}
                onKeyDown={paneKeys}
              >
                {t(en, de)}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="inspector-body">
        {issueHere && (
          <p role="alert" className="form-error inspector-issue">
            {issueHere.message}
          </p>
        )}
        {photo && (
          <div className="inspector-selection">
            <span>
              {t("This image placement", "Diese Bildverwendung")}
            </span>
            <strong>{selectionLabel}</strong>
          </div>
        )}
        {!(tabbed && pane !== "content") && (
          <h3 className="inspector-group-title">
            {module && !["text", "quote"].includes(module.kind)
              ? t("Image content", "Bildinhalt")
              : t("Content", "Inhalt")}
          </h3>
        )}
        {!photo && module && NAMED_KINDS.includes(module.kind) && !(tabbed && pane !== "content") && (
          <Field label={t("Name in the storyboard", "Name im Drehbuch")}>
            <ModuleTitleInput
              key={module.id}
              kind={module.kind}
              value={module.title}
              onCommit={(title) => moduleChange(module.id, { title })}
            />
          </Field>
        )}
        {photo ? (
          <>
            {photoModule && (
              <button className="back-to-module" onClick={returnToModule}>
                <ArrowLeft size={17} />
                {photoModule.kind === "wall"
                  ? t("Back to photo wall", "Zurück zur Fotowand")
                  : t("Back to module", "Zurück zum Modul")}
              </button>
            )}
            <button
              className="button button-outline"
              onClick={() => chooseImage(false)}
            >
              <Images size={16} />
              {t("Choose / upload image", "Bild auswählen / hochladen")}
            </button>
            {photoModule?.kind === "wall" && photoModule.layout?.wall_mode === "balanced" && (
              <SegmentedControl
                label={t("Size in the wall", "Größe in der Fotowand")}
                value={
                  placementsFor(photoModule, j).find((f) => f.id === photo.placement_id)?.size ?? "m"
                }
                options={[
                  { value: "s", label: t("Small", "Klein") },
                  { value: "m", label: t("Normal", "Normal") },
                  { value: "l", label: t("Large", "Groß") },
                ]}
                onChange={(size) =>
                  layoutChange(photoModule.id, {
                    placements: placementsFor(photoModule, j).map((f) =>
                      f.id === photo.placement_id
                        ? { ...f, size: size === "m" ? undefined : size }
                        : f,
                    ),
                  })
                }
              />
            )}
            {photoModule && (
              <p className="inspector-note">
                {t(
                  "Crop adjustments apply only to this image placement, including when the same source is used again. Titles and descriptions belong to the source photograph.",
                  "Zuschnittänderungen gelten nur für diese Bildverwendung, auch bei mehrfach verwendeter Quelle. Titel und Beschreibungen gehören zum Ausgangsfoto.",
                )}
              </p>
            )}
            <ImageControls
              photo={photo}
              onChange={(p) => {
                if (p.edits && photoModule) {
                  layoutChange(photoModule.id, {
                    placements: placementsFor(photoModule, j).map((f) =>
                      f.id === photo.placement_id
                        ? { ...f, edits: p.edits }
                        : f,
                    ),
                  });
                } else if (
                  p.edits &&
                  selected.type === "photo" &&
                  (selected.context === "loose" ||
                    selected.context === "filmstrip")
                ) {
                  const key =
                    selected.context === "loose"
                      ? "placements"
                      : "filmstrip_placements";
                  layoutChange(null, {
                    [key]: rootPhotos(j, selected.context).map((f) => ({
                      id: f.placement_id!,
                      photo_id: f.id,
                      edits:
                        f.placement_id === selected.placementId
                          ? p.edits
                          : f.edits,
                    })),
                  });
                } else photoChange(photo.id, p);
              }}
            >
            <div className="photo-delete-actions">
              {(photoModule ||
                (selected.type === "photo" &&
                  ["loose", "filmstrip"].includes(
                    selected.context || "",
                  ))) && (
                <button className="text-link" onClick={removePlacement}>
                  <Trash2 size={16} />
                  {t(
                    "Remove this placement",
                    "Diese Bildverwendung entfernen",
                  )}
                </button>
              )}
              <button
                className="text-link danger-action"
                disabled={busy || backgroundSaving || uploadBusy}
                onClick={() => deletePhoto(photo)}
              >
                <Trash2 size={16} />
                {t("Delete from collection", "Aus Fotosammlung löschen")}
              </button>
            </div>
            <label className="check-field">
              <input
                type="checkbox"
                checked={photo.featured}
                onChange={(e) =>
                  photoChange(photo.id, { featured: e.target.checked })
                }
              />
              {t("Favourite photograph", "Favoritenfoto")}
            </label>
            <button
              className="button button-outline"
              onClick={() => change({ cover_id: photo.id, cover: photo })}
            >
              {t("Use as story cover", "Als Titelbild verwenden")}
            </button>
            </ImageControls>
          </>
        ) : selected.type === "intro" ? (
          <Field label={t("Introduction", "Einleitung")}>
            <textarea
              rows={8}
              maxLength={20000}
              value={j.introduction}
              onChange={(e) => change({ introduction: e.target.value })}
            />
          </Field>
        ) : (
          <>
            {module && !["text", "quote"].includes(module.kind) && (
              <div className="inspector-pane" {...paneProps("content", 1)}>
                {module.kind === "filmstrip" && (
                  <label className="field-check" style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={module.layout?.all_photos === true}
                      onChange={(e) =>
                        layoutChange(module.id, { all_photos: e.target.checked ? true : undefined })
                      }
                    />
                    {t("Show all photos of the story", "Alle Fotos der Geschichte zeigen")}
                  </label>
                )}
                {module.kind === "filmstrip" && module.layout?.all_photos === true ? (
                  <p className="field-hint" style={{ fontSize: 13 }}>
                    {j.photos.length === 1
                      ? t("1 photo · new ones are added automatically", "1 Foto · neue kommen automatisch dazu")
                      : t(`${j.photos.length} photos · new ones are added automatically`, `${j.photos.length} Fotos · neue kommen automatisch dazu`)}
                  </p>
                ) : (
                <ModulePhotographs
                  key={module.id}
                  module={module}
                  journey={j}
                  onDelete={deletePhoto}
                  deleteDisabled={busy || backgroundSaving || uploadBusy}
                  onChange={(p) => layoutChange(module.id, p)}
                  onPhoto={(p) =>
                    selectCanvas({
                      type: "photo",
                      id: p.id,
                      moduleId: module.id,
                      placementId: p.placement_id,
                    })
                  }
                />
                )}
                {module.kind === "chapter" && (
                  <button
                    className="button button-outline"
                    onClick={() => openPicker()}
                  >
                    <Plus size={16} />
                    {t(
                      "Add module to this day",
                      "Modul zu diesem Tag hinzufügen",
                    )}
                  </button>
                )}
                {module.kind === "chapter" && module.id < 0 ? (
                  <button
                    className="button button-outline"
                    onClick={() => void save()}
                    disabled={busy}
                  >
                    {t(
                      "Save day to upload photos",
                      "Tag speichern und Fotos hochladen",
                    )}
                  </button>
                ) : (
                  <Upload
                    photoIds={uploadPhotoIds}
                    onRemovePhoto={askDeleteUploaded}
                    disabled={backgroundSaving || conflicted}
                    composition={{ slug: j.slug, version: j.composition_version ?? 0 }}
                    onConflict={markConflict}
                    journeyId={j.id}
                    chapterId={
                      module.kind === "chapter" ? module.id : null
                    }
                    onSave={uploaded}
                    onBusy={setUploadBusy}
                  />
                )}
              </div>
            )}
            {!module && (
              <button
                className="button button-outline cover-replace-button"
                onClick={() => chooseImage(true)}
              >
                <Images size={16} />
                {t(
                  "Choose / upload cover image",
                  "Titelbild auswählen / hochladen",
                )}
              </button>
            )}
            <div className="inspector-pane" {...paneProps("content", 2)}>
            <InspectorSection
              plain={!!module}
              open={
                !module ||
                ["chapter", "text", "quote", "hero"].includes(module.kind)
              }
              title={
                module
                  ? t("Heading & text", "Überschrift & Text")
                  : t("Story details", "Details der Geschichte")
              }
            >
              {!(module && NAMED_KINDS.includes(module.kind)) && (
              <Field label={t("Title", "Titel")}>
                {module ? (
                  <ModuleTitleInput
                    key={module.id}
                    kind={module.kind}
                    value={module.title}
                    onCommit={(title) => moduleChange(module.id, { title })}
                  />
                ) : (
                  <input
                    ref={titleInput}
                    maxLength={160}
                    value={j.title}
                    onChange={(e) => change({ title: e.target.value })}
                  />
                )}
              </Field>
              )}
              {module ? (
                <>
                  {!["text", "quote"].includes(module.kind) && (
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={
                          module.layout?.show_title ??
                          ["chapter", "hero"].includes(module.kind)
                        }
                        onChange={(e) =>
                          layoutChange(module.id, {
                            show_title: e.target.checked,
                          })
                        }
                      />
                      {t("Show heading", "Überschrift anzeigen")}
                    </label>
                  )}
                  {["chapter", "text", "hero"].includes(module.kind) && (
                    <Field label={t("Text", "Text")}>
                      <textarea
                        id="inspector-module-story"
                        rows={4}
                        maxLength={20000}
                        value={module.story}
                        onChange={(e) =>
                          moduleChange(module.id, {
                            story: e.target.value,
                          })
                        }
                      />
                    </Field>
                  )}
                  {module.kind === "quote" && (
                    <Field label={t("Quote", "Zitat")}>
                      <textarea
                        rows={5}
                        maxLength={1000}
                        value={module.quote}
                        onChange={(e) =>
                          moduleChange(module.id, {
                            quote: e.target.value,
                          })
                        }
                      />
                    </Field>
                  )}
                  {module.kind === "chapter" && (
                    <Field label={t("Date", "Datum")}>
                      <input
                        type="date"
                        value={module.date}
                        onChange={(e) =>
                          moduleChange(module.id, {
                            date: e.target.value,
                          })
                        }
                      />
                    </Field>
                  )}
                </>
              ) : (
                <>
                  {!isEditionJourney(j.slug) && (
                    <Field label={t("Form", "Form")}>
                      <select
                        value={form}
                        onChange={(e) => switchForm(e.target.value as JourneyForm)}
                      >
                        {JOURNEY_FORMS.map((id) => (
                          <option key={id} value={id}>
                            {formName(id, getLocale())}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {!isEditionJourney(j.slug) && (
                    <p className="inspector-note">{formHints[form]}</p>
                  )}
                  <Field label={t("Subtitle", "Untertitel")}>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={j.subtitle}
                      onChange={(e) =>
                        change({ subtitle: e.target.value })
                      }
                    />
                  </Field>
                  <Field label={t("Place", "Ort")}>
                    <input
                      maxLength={160}
                      value={j.location}
                      onChange={(e) =>
                        change({ location: e.target.value })
                      }
                    />
                  </Field>
                  {form === "journey" && (
                  <div className="field-pair">
                    <Field label={t("From", "Von")}>
                      <input
                        type="date"
                        value={j.start_date}
                        onChange={(e) =>
                          change({
                            start_date: e.target.value,
                            layout: { ...j.layout, dates_from_photos: false },
                          })
                        }
                      />
                    </Field>
                    <Field label={t("Until", "Bis")}>
                      <input
                        type="date"
                        value={j.end_date}
                        onChange={(e) =>
                          change({
                            end_date: e.target.value,
                            layout: { ...j.layout, dates_from_photos: false },
                          })
                        }
                      />
                    </Field>
                  </div>
                  )}
                  {form === "moment" && (
                    <Field label={t("Date", "Datum")}>
                      <input
                        type="date"
                        value={j.start_date}
                        onChange={(e) =>
                          change({
                            start_date: e.target.value,
                            end_date: e.target.value,
                            layout: { ...j.layout, dates_from_photos: false },
                          })
                        }
                      />
                    </Field>
                  )}
                  {form !== "collection" && photoRange &&
                    (j.start_date !== photoRange.start ||
                    j.end_date !== (form === "moment" ? photoRange.start : photoRange.end) ? (
                      <p className="inspector-note">
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => adoptPhotoDates(photoRange)}
                        >
                          {t("Use capture dates", "Aus Aufnahmedaten übernehmen")}
                        </button>
                      </p>
                    ) : (
                      <p className="inspector-note">
                        {t(
                          "Taken from the capture dates.",
                          "Aus den Aufnahmedaten übernommen.",
                        )}
                      </p>
                    ))}
                  {!isEditionJourney(j.slug) && (
<>
<Field label={t("Starting edition", "Startedition")}>
                    <select
                      value={j.story_template}
                      onChange={(e) =>
                        change({
                          story_template: e.target
                            .value as Journey["story_template"],
                        })
                      }
                    >
                      <option value="quiet-atlas">{t("First Light")}</option>
                      <option value="after-hours">{t("Last Light")}</option>
                    </select>
                  </Field>
                  <p className="inspector-note">
                    {t(
                      "A starting point. Each module can use either edition.",
                      "Ein Startpunkt. Jedes Modul kann eine andere Edition verwenden.",
                    )}
                  </p>
                  </>
)}

                </>
              )}
            </InspectorSection>
            </div>
            {!module && (
              <CoverFocusEditor
                photo={j.photos.find((p) => p.id === j.cover_id) ?? j.cover ?? null}
                value={j.cover_focus}
                disabled={busy || backgroundSaving || uploadBusy}
                onSave={(focus) => change({ cover_focus: focus })}
                fineTune={
                  <>
                    <RangeField label={t("Heading size", "Überschriftengröße")} value={layout.title_size || 100}>
                      <input
                        type="range"
                        min={28}
                        max={160}
                        value={layout.title_size || 100}
                        onChange={(e) =>
                          layoutChange(null, {
                            title_size: Number(e.target.value),
                          })
                        }
                      />
                    </RangeField>
                    <h3 className="inspector-group-title">
                      {t("Title position", "Titelposition")}
                    </h3>
                    <TitlePositionControl
                      layout={layout}
                      cover={j.photos.find((p) => p.id === j.cover_id) ?? j.cover}
                      title={j.title}
                      subtitle={j.subtitle}
                      onChange={(p) => layoutChange(null, p)}
                    />
                    <h3 className="inspector-group-title">
                      {t("Cover crop", "Titelbild-Ausschnitt")}
                    </h3>
                  </>
                }
              />
            )}
            {!module && (
              <ArchiveFocusEditor
                photo={j.photos.find((p) => p.id === j.cover_id) ?? j.cover ?? null}
                value={layout.archive_focus}
                fallback={j.cover_focus}
                disabled={busy || backgroundSaving || uploadBusy}
                onSave={(focus) => layoutChange(null, { archive_focus: focus ?? undefined })}
              />
            )}
            {!module && (
              <details className="inspector-section">
                <summary>{t("Story text", "Texte der Geschichte")}</summary>
                {(
                  [
                    "introduction",
                    "reflection",
                    "closing",
                    "description",
                  ] as const
                ).map((key, i) => (
                  <Field
                    key={key}
                    hint={
                      [
                        t(
                          "Appears right after the cover image as a foreword.",
                          "Erscheint direkt nach dem Titelbild als Vorwort.",
                        ),
                        t(
                          "Appears at the end of the story as a look back.",
                          "Erscheint am Ende der Geschichte als Rückblick.",
                        ),
                        t(
                          "Appears as the very last paragraph, after the reflection.",
                          "Erscheint ganz am Ende, nach dem Rückblick.",
                        ),
                        t(
                          "Short text shown in the story overview.",
                          "Kurztext in der Übersicht der Geschichten.",
                        ),
                      ][i]
                    }
                    label={
                      [
                        t("Introduction", "Einleitung"),
                        t("Reflection", "Rückblick"),
                        t("Closing", "Abschluss"),
                        t(
                          "Archive description",
                          "Beschreibung im Archiv",
                        ),
                      ][i]
                    }
                  >
                    <textarea
                      rows={3}
                      maxLength={
                        key === "introduction"
                          ? 20000
                          : key === "closing"
                            ? 5000
                            : 2000
                      }
                      value={j[key]}
                      onChange={(e) => change({ [key]: e.target.value })}
                    />
                  </Field>
                ))}
              </details>
            )}
            <>
              {module && (
                <>
                  <div className="inspector-pane inspector-design-pane" {...paneProps("design")}>
                  {presetsFor(module.kind).length > 1 && (
                    <section className="inspector-design-block">
                      <h3 className="inspector-group-title">{t("Variant", "Variante")}</h3>
                      <VariantPicker journey={journey} module={module} />
                    </section>
                  )}
                  {(FRAME_KINDS.includes(module.kind) || module.kind === "rail") && (
                    <section className="inspector-design-block">
                      <h3 className="inspector-group-title">{t("Image", "Bild")}</h3>
                      {FRAME_KINDS.includes(module.kind) && (
                    <>
                      
                      
                      <SegmentedControl
                        label={t("Display", "Darstellung")}
                        value={layout.fit === "contain" ? "contain" : "cover"}
                        disabled={!layout.ratio || layout.ratio === "original"}
                        options={[
                          { value: "contain", label: t("Show whole photos", "Ganze Fotos zeigen") },
                          { value: "cover", label: t("Fill the frame", "Flächenfüllend") },
                        ]}
                        onChange={(value) =>
                          layoutChange(module.id, {
                            fit: value === "contain" ? "contain" : undefined,
                          })
                        }
                      />
<SingleImageFrame
                        layout={layout}
                        photo={
                          module.kind === "image"
                            ? modulePhotos(module, journey)[0]
                            : undefined
                        }
                        onChange={(p) => layoutChange(module.id, p)}
                      />
                      {(!layout.ratio || layout.ratio === "original") && (
                        <p className="inspector-note">
                          {t(
                            "Applies once an image format is chosen.",
                            "Wirkt, sobald ein Bildformat gewählt ist.",
                          )}
                        </p>
                      )}
                    </>
                  )}
                      {module.kind === "rail" && (
                    <SegmentedControl
                      label={t("Display", "Darstellung")}
                      value={layout.rail_mode === "single" ? "single" : "free"}
                      options={[
                        { value: "single", label: t("Show whole photos", "Ganze Fotos zeigen") },
                        { value: "free", label: t("Fill the frame", "Flächenfüllend") },
                      ]}
                      onChange={(rail_mode) => layoutChange(module.id, { rail_mode })}
                    />
                  )}
                  {module.kind === "rail" && (
                    <SegmentedControl
                      label={t("Size", "Größe")}
                      value={layout.rail_size === "large" ? "large" : "normal"}
                      options={[
                        { value: "normal", label: t("Normal", "Normal") },
                        { value: "large", label: t("Large", "Groß") },
                      ]}
                      onChange={(rail_size) =>
                        layoutChange(module.id, { rail_size: rail_size === "large" ? "large" : undefined })
                      }
                    />
                  )}
                    </section>
                  )}
                  {(TEXT_KINDS.includes(module.kind) || module.kind === "text" || module.kind === "quote" || module.kind === "hero") && (
                    <section className="inspector-design-block">
                      <h3 className="inspector-group-title">{t("Text", "Text")}</h3>
                      {TEXT_KINDS.includes(module.kind) && (
                    <>
                      <SegmentedControl
                        label={t("Size", "Größe")}
                        value={textSize(layout)}
                        options={TEXT_SIZES.map(([value, en, de]) => ({
                          value,
                          label: t(en, de),
                        }))}
                        onChange={(value) =>
                          layoutChange(module.id, {
                            text_preset: value,
                            text_size: typePresets[value],
                          })
                        }
                      />
                      <SegmentedControl
                        label={t("Alignment", "Ausrichtung")}
                        value={layout.text_align || "left"}
                        options={[
                          { value: "left", label: t("Left", "Links") },
                          { value: "center", label: t("Centred", "Zentriert") },
                          { value: "right", label: t("Right", "Rechts") },
                        ]}
                        onChange={(text_align) =>
                          layoutChange(module.id, { text_align })
                        }
                      />
                    </>
                  )}
                      {(module.kind === "text" || module.kind === "quote") && (
                        <MarginField
                            label={t("Text width", "Textbreite")}
                            value={`${layout.text_width ?? defaultTextWidth(module.kind)} ${t("characters", "Zeichen")}`}
                            resetLabel={t("Reset text width", "Textbreite zurücksetzen")}
                            changed={layout.text_width !== undefined}
                            onReset={() => layoutChange(module.id, { text_width: undefined })}
                          >
                            <input
                              type="range"
                              min={24}
                              max={100}
                              step={2}
                              value={layout.text_width ?? defaultTextWidth(module.kind)}
                              onChange={(e) =>
                                layoutChange(module.id, {
                                  text_width: Number(e.target.value),
                                })
                              }
                            />
                          </MarginField>
                      )}
                      {module?.kind === "hero" && (
                      <RangeField label={t("Heading size", "Überschriftengröße")} value={layout.title_size || 100}>
                        <input
                          type="range"
                          min={28}
                          max={160}
                          value={layout.title_size || 100}
                          onChange={(e) =>
                            layoutChange(module?.id ?? null, {
                              title_size: Number(e.target.value),
                            })
                          }
                        />
                      </RangeField>
                    )}
                    </section>
                  )}
                  {railAsPair && (
                    <section className="inspector-design-block edge-media-hint" role="note">
                      <p className="inspector-note">
                        <strong>
                          {t(
                            "Two images often look better side by side. Show as an image pair?",
                            "Zwei Bilder wirken nebeneinander oft schöner. Als Bildpaar zeigen?",
                          )}
                        </strong>
                      </p>
                      <button type="button" className="button button-outline" onClick={convertRailToPair}>
                        {t("Show as image pair", "Als Bildpaar zeigen")}
                      </button>
                    </section>
                  )}
                  {edgeAvailable && (
                    <section className="inspector-design-block">
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={edgeToEdgeActive(module.kind, edgePhotos, layout)}
                          onChange={(e) =>
                            layoutChange(module.id, { edge_to_edge: e.target.checked ? true : undefined })
                          }
                        />
                        {t("Edge to edge", "Bis zum Rand")}
                      </label>
                      <p className="inspector-note">
                        {t(
                          "The images run side by side across the full width, separated by a narrow gap.",
                          "Die Bilder stehen in voller Breite nebeneinander, nur durch eine schmale Fuge getrennt.",
                        )}
                      </p>
                    </section>
                  )}
                  {module.kind === "wall" && (
                    <section className="inspector-design-block">
                      <h3 className="inspector-group-title">{t("Photo wall", "Fotowand")}</h3>
                      <SegmentedControl
                        label={t("Display", "Darstellung")}
                        value={layout.wall_mode === "balanced" ? "balanced" : "grid"}
                        options={[
                          { value: "balanced", label: t("Balanced", "Ausgewogen") },
                          { value: "grid", label: t("Grid", "Raster") },
                        ]}
                        onChange={(wall_mode) => layoutChange(module.id, { wall_mode })}
                      />
                      {layout.wall_mode === "balanced" ? (
                        <>
                          <SegmentedControl
                            label={t("Photos per row", "Fotos pro Reihe")}
                            value={String(layout.wall_row ?? "auto")}
                            options={[
                              { value: "auto", label: t("Automatic", "Automatisch") },
                              ...["2", "3", "4", "5"].map((n) => ({ value: n, label: n })),
                            ]}
                            onChange={(value) =>
                              layoutChange(module.id, {
                                wall_row: value === "auto" ? undefined : Number(value),
                              })
                            }
                          />
                          <label className="check-field">
                            <input
                              type="checkbox"
                              checked={layout.wall_center !== false}
                              onChange={(e) =>
                                layoutChange(module.id, {
                                  wall_center: e.target.checked ? undefined : false,
                                })
                              }
                            />
                            {t("Centre rows", "Reihen zentrieren")}
                          </label>
                        </>
                      ) : (
                        <WallSettings module={module} onChange={(p) => layoutChange(module.id, p)} />
                      )}
                    </section>
                  )}
                  {module.kind !== "hero" && (
                    <section className="inspector-design-block">
                      <h3 className="inspector-group-title">{t("Spacing", "Abstand")}</h3>
                      {module.kind === "filmstrip" && (
                        <MarginField
                          label={t("Width", "Breite")}
                          value={
                            (layout.margin_x ?? SIDE_MARGIN_MAX) === 0
                              ? t("To the edge", "Bis zum Rand")
                              : `${Math.round(100 - ((layout.margin_x ?? SIDE_MARGIN_MAX) / SIDE_MARGIN_MAX) * 100)} %`
                          }
                          resetLabel={t("Reset width", "Breite zurücksetzen")}
                          changed={layout.margin_x !== undefined}
                          onReset={() => layoutChange(module.id, { margin_x: undefined })}
                        >
                          <input
                            type="range"
                            min={0}
                            max={SIDE_MARGIN_MAX}
                            step={4}
                            aria-label={t("Width of the filmstrip", "Breite des Fotostreifens")}
                            value={SIDE_MARGIN_MAX - (layout.margin_x ?? SIDE_MARGIN_MAX)}
                            onChange={(e) =>
                              layoutChange(module.id, {
                                margin_x: SIDE_MARGIN_MAX - Number(e.target.value),
                              })
                            }
                          />
                        </MarginField>
                      )}
                      {module.kind !== "text" && module.kind !== "quote" && module.kind !== "filmstrip" && (
                        <MarginField
                          label={t("Side margin", "Rand seitlich")}
                          value={`${
                            layout.margin_x ??
                            defaultSideMargin(
                              layout.edition && layout.edition !== "inherit"
                                ? layout.edition
                                : j.story_template,
                              j.story_template,
                              layout.padding,
                            )
                          } px`}
                          resetLabel={t("Reset side margin", "Rand seitlich zurücksetzen")}
                          changed={
                            layout.margin_x !== undefined &&
                            layout.margin_x !== sideMarginDefault(layout, j.story_template)
                          }
                          onReset={() => layoutChange(module.id, { margin_x: undefined })}
                        >
                          <input
                            type="range"
                            min={0}
                            max={120}
                            step={4}
                            value={
                              layout.margin_x ??
                              defaultSideMargin(
                                layout.edition && layout.edition !== "inherit"
                                  ? layout.edition
                                  : j.story_template,
                                j.story_template,
                                layout.padding,
                              )
                            }
                            onChange={(e) =>
                              layoutChange(module.id, {
                                margin_x: Number(e.target.value),
                              })
                            }
                          />
                        </MarginField>
                      )}
                      <MarginField
                          label={t("Margin top & bottom", "Rand oben & unten")}
                          value={`${layout.padding ?? MARGIN_TOP_BOTTOM_DEFAULT} px`}
                          resetLabel={t("Reset top and bottom margin", "Rand oben und unten zurücksetzen")}
                          changed={
                            layout.padding !== undefined &&
                            layout.padding !== MARGIN_TOP_BOTTOM_DEFAULT
                          }
                          onReset={() => layoutChange(module.id, { padding: undefined })}
                        >
                          <input
                            type="range"
                            min={0}
                            max={160}
                            step={4}
                            value={layout.padding ?? MARGIN_TOP_BOTTOM_DEFAULT}
                            onChange={(e) =>
                              layoutChange(module.id, {
                                padding: Number(e.target.value),
                              })
                            }
                          />
                        </MarginField>
                      {module?.kind === "pair" && showStagger ? (
                      <div className="stagger-control">
                        <RangeField label={t("Offset", "Versatz")} value={staggerValue}>
                          <input
                            type="range"
                            min={-100}
                            max={100}
                            step={5}
                            value={staggerValue}
                            onChange={(e) =>
                              module &&
                              layoutChange(module.id, {
                                stagger: Number(e.target.value),
                              })
                            }
                            onDoubleClick={() =>
                              module && layoutChange(module.id, { stagger: 0 })
                            }
                          />
                        </RangeField>
                        <div className="stagger-scale">
                          <span>{t("Left lower", "Links tiefer")}</span>
                          <button
                            type="button"
                            onClick={() =>
                              module && layoutChange(module.id, { stagger: 0 })
                            }
                          >
                            {t("Centre", "Mitte")}
                          </button>
                          <span>{t("Right lower", "Rechts tiefer")}</span>
                        </div>
                      </div>
                    ) : null}
                    </section>
                  )}
                  {!isEditionJourney(j.slug) && (
                    <section className="inspector-design-block">
                      <h3 className="inspector-group-title">{t("Surface", "Fläche")}</h3>
                      {!isEditionJourney(j.slug) && (
                          <>
                            <Field label={t("Design world", "Gestaltungswelt")}>
                              <select
                                value={module.layout?.edition || "inherit"}
                                onChange={(e) =>
                                  layoutChange(module.id, {
                                    edition: e.target.value as Layout["edition"],
                                  })
                                }
                              >
                                <option value="inherit">
                                  {t(
                                    "Inherit story edition",
                                    "Edition der Geschichte übernehmen",
                                  )}
                                </option>
                                <option value="quiet-atlas">{t("First Light")}</option>
                                <option value="after-hours">{t("Last Light")}</option>
                              </select>
                            </Field>
                            {module.layout?.edition &&
                              module.layout.edition !== "inherit" && (
                                <label className="check-field">
                                  <input
                                    type="checkbox"
                                    checked={!!module.layout.edition_fill}
                                    onChange={(e) =>
                                      layoutChange(module.id, {
                                        edition_fill: e.target.checked || undefined,
                                      })
                                    }
                                  />
                                  {t("Fill whole section", "Ganze Fläche einfärben")}
                                </label>
                              )}
                          </>
                        )}
                    </section>
                  )}
                  {moduleTools}
                  </div>
                </>
              )}
            </>
          </>
        )}
      </div>
    </aside>
  );
}
