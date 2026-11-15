"""Editions as real, locked journeys.

Each shipped edition ("quiet-atlas", "after-hours") exists once per language as a hidden Journey
(slug "__edition-<edition>-<lang>"). They are seeded once from the previous code-generated example
story plus the studio's stored edition override, and from then on edited in the modular editor.
Nothing here deletes or changes existing journeys; the public endpoints fall back to the code
generated story whenever a journey does not exist.
"""
import copy
import shutil
from pathlib import Path

from .models import Chapter, Journey, Photo, SiteSetting, db
from .story_templates import (ASSETS, CHAPTER_DATES, CHAPTER_OF, DATES, DEFAULT_COVER_INDEX, EDITION_IDS,
                              EDITION_SLOTS, EXAMPLE_COPY, PLACE, TEMPLATES, captions, clean_override,
                              default_focus)

PREFIX = "__edition-"
LANGS = ("de", "en")
UNTITLED = "Untitled photograph"
VARIANT_SIZES = (640, 1280, 2200, 3840)
MASTER_SUFFIXES = (".jpg", ".png", ".webp")
FEATURED_SLOTS = {0, 2, 3, 5}
REVEAL = {"effect": "up", "duration": 2000}
REVEAL_SETTINGS = {"default": {"effect": "up", "duration": 2000}, "images": {"effect": "fade", "duration": 2400}}


def slug_for(edition, lang):
    return f"{PREFIX}{edition}-{lang}"


def is_edition_slug(slug):
    return isinstance(slug, str) and slug.startswith(PREFIX)


def find_journey(edition, lang):
    lang = "de" if lang == "de" else "en"
    return db.session.scalar(db.select(Journey).where(Journey.slug == slug_for(edition, lang)))


def edition_slugs(edition):
    """{'de': slug, 'en': slug} for the journeys that exist (empty while the edition is code-based)."""
    return {lang: slug_for(edition, lang) for lang in LANGS if find_journey(edition, lang)}


# ---- media ---------------------------------------------------------------------------------

def media_names(filename):
    names = [f"{filename}-{size}.webp" for size in VARIANT_SIZES]
    names += [f"{filename}-master{suffix}" for suffix in MASTER_SUFFIXES]
    return names


def copy_media(upload_folder, source, target):
    """Copy every variant/master file of an uploaded photograph under a new name. Returns the created paths."""
    folder = Path(upload_folder)
    created = []
    try:
        for old, new in zip(media_names(source), media_names(target)):
            path = folder / old
            if path.is_file():
                shutil.copy2(path, folder / new)
                created.append(folder / new)
    except OSError:
        for path in created:
            path.unlink(missing_ok=True)
        raise
    if not (folder / f"{target}-1280.webp").is_file():
        for path in created:
            path.unlink(missing_ok=True)
        return None
    return created


def remove_media(upload_folder, filename):
    for name in media_names(filename):
        (Path(upload_folder) / name).unlink(missing_ok=True)


def _copy_photo(journey, source, upload_folder, created, *, position, chapter=None, featured=False):
    """New Photo row for `journey` backed by copies of an uploaded photograph's files (the original stays untouched)."""
    from uuid import uuid4
    filename = uuid4().hex
    paths = copy_media(upload_folder, source.filename, filename)
    if paths is None:
        return None
    created.extend(paths)
    title = "" if source.title == UNTITLED else (source.title or "")
    photo = Photo(journey=journey, chapter=chapter, filename=filename, width=source.width, height=source.height,
                  title=title, alt=source.alt or title, description="", credit=source.credit or "",
                  source_url=source.source_url or "", featured=featured, position=position, demo=False,
                  has_master=bool(source.has_master), taken_at=source.taken_at, edits={})
    db.session.add(photo)
    return photo


def _demo_photo(journey, edition, lang, asset, *, position, chapter=None, featured=False):
    name, _, _, width, height = ASSETS[edition][asset]
    title, alt = captions(edition, lang)[asset]
    photo = Photo(journey=journey, chapter=chapter, filename=name, width=width, height=height, title=title, alt=alt,
                  description="", featured=featured, position=position, demo=True, edits={})
    db.session.add(photo)
    return photo


# ---- seeding ---------------------------------------------------------------------------------

def _seed_one(edition, lang, override, upload_folder, snapshot, created):
    copy_ = EXAMPLE_COPY[edition][lang]
    template = next(item for item in TEMPLATES if item["id"] == edition)
    start, end = DATES[edition]
    location, country = PLACE[edition][lang]
    dark = edition == "after-hours"
    journey = Journey(
        slug=slug_for(edition, lang), title=override["title"][lang] or copy_["title"],
        subtitle=override["subtitle"][lang] or copy_["subtitle"], location=location, country=country,
        start_date=start, end_date=end, description=copy_["description"], introduction=copy_["introduction"],
        reflection="", closing=copy_["closing"], preset=template["preset"], story_template=edition, studio_step=4,
        filmstrip_ids=[], reveal_settings=copy.deepcopy(REVEAL_SETTINGS), layout={}, published=False, demo=False)
    db.session.add(journey)
    db.session.flush()
    chapters = []
    for index, (title, story) in enumerate(copy_["chapters"]):
        chapter = Chapter(journey=journey, title=title, story=story, quote="", date=CHAPTER_DATES[edition][index],
                          position=index, kind="chapter", reveal=dict(REVEAL), layout={},
                          gallery_mode="horizontal" if dark or index == 1 else "editorial")
        db.session.add(chapter)
        chapters.append(chapter)
    db.session.flush()
    photos = []
    for slot in range(EDITION_SLOTS):
        ref = override["slots"][slot]
        chapter = chapters[CHAPTER_OF[edition][slot]]
        photo = None
        if ref is not None and ref > 0:
            source = db.session.get(Photo, ref)
            if source and not source.demo:
                photo = _copy_photo(journey, source, upload_folder, created, position=slot, chapter=chapter,
                                    featured=slot in FEATURED_SLOTS)
        if photo is None:
            asset = -ref - 1 if ref is not None and ref < 0 else slot
            photo = _demo_photo(journey, edition, lang, asset, position=slot, chapter=chapter, featured=slot in FEATURED_SLOTS)
        photos.append(photo)
    db.session.flush()
    default_index = DEFAULT_COVER_INDEX[edition]
    cover = photos[default_index]
    ref = override["cover_photo_id"]
    if ref is not None and not (ref < 0 and -ref - 1 == default_index):
        extra = None
        if ref > 0:
            source = db.session.get(Photo, ref)
            if source and not source.demo:
                extra = _copy_photo(journey, source, upload_folder, created, position=EDITION_SLOTS)
        elif ref < 0:
            extra = _demo_photo(journey, edition, lang, -ref - 1, position=EDITION_SLOTS)
        if extra is not None:
            db.session.flush()
            cover = extra
    journey.cover_id = cover.id
    if dark:
        journey.filmstrip_ids = [photo.id for photo in photos]
    db.session.flush()
    db.session.expire(journey, ["chapters", "photos"])
    journey.published = True
    journey.published_data = snapshot(journey)
    return journey


def seed_editions(upload_folder, snapshot):
    """Create the missing edition journeys (idempotent). `snapshot(journey)` returns the journey's public JSON."""
    made = []
    for edition in EDITION_IDS:
        row = db.session.get(SiteSetting, f"edition:{edition}")
        override = clean_override(row.value if row and isinstance(row.value, dict) else {})
        for lang in LANGS:
            if find_journey(edition, lang):
                continue
            created = []
            try:
                _seed_one(edition, lang, override, upload_folder, snapshot, created)
                db.session.commit()
                made.append(slug_for(edition, lang))
            except Exception:
                db.session.rollback()
                for path in created:
                    path.unlink(missing_ok=True)
                raise
    return made


# ---- reading ---------------------------------------------------------------------------------

def public_snapshot(journey, live):
    """The journey as visitors see it: the published snapshot (or, for a missing one, the live draft)."""
    return copy.deepcopy(journey.published_data) if journey.published_data else live(journey)


def _referenced_photo_ids(chapters):
    ids = set()
    for chapter in chapters:
        layout = chapter.get("layout") or {}
        ids.update(layout.get("photo_ids") or [])
        for key in ("placements", "filmstrip_placements"):
            ids.update(p.get("photo_id") for p in layout.get(key) or [] if isinstance(p, dict))
    return ids


def public_story(snapshot, edition, focus):
    """Shape a journey snapshot like the previous code-generated example (same fields the public pages read)."""
    story = copy.deepcopy(snapshot)
    cover_id = story.get("cover_id")
    chapters = story.get("chapters", [])
    referenced = _referenced_photo_ids(chapters)
    # A cover that was chosen apart from the story is not one of the story's photographs.
    story["photos"] = [p for p in story.get("photos", [])
                       if not (p["id"] == cover_id and p.get("chapter_id") is None and p["id"] not in referenced
                               and p.get("position", 0) >= EDITION_SLOTS)]
    story.update(is_example=True, demo=True, published=True, slug=edition, id=-2 if edition == "after-hours" else -1,
                 photo_count=len(story["photos"]), chapter_count=len(chapters),
                 cover_focus=focus if focus and focus != default_focus() else None)
    return story


def cover_ref(edition, journey):
    """Edition-override reference of the published cover: None = the default photograph, -n = shipped photo n, >0 = uploaded."""
    snap = journey.published_data or {}
    cover = snap.get("cover")
    if not cover:
        return None
    if cover.get("demo"):
        stem = (cover.get("url") or "").rsplit("/", 1)[-1].replace("-1280.webp", "")
        for index, asset in enumerate(ASSETS[edition]):
            if asset[0] == stem:
                return None if index == DEFAULT_COVER_INDEX[edition] else -(index + 1)
        return None
    return cover.get("id") if type(cover.get("id")) is int else None


def journey_texts(edition, lang, journey):
    """(title, subtitle) as an override: empty when equal to the shipped default."""
    snap = journey.published_data or {}
    default = EXAMPLE_COPY[edition][lang]
    title, subtitle = snap.get("title", journey.title), snap.get("subtitle", journey.subtitle)
    return (title if title != default["title"] else ""), (subtitle if subtitle != default["subtitle"] else "")


def effective_override(edition, lang, stored):
    """Studio override as stored, with title/subtitle/cover replaced by what the edition journeys say."""
    base = clean_override(stored)
    journey = find_journey(edition, lang)
    for other in LANGS:
        mine = find_journey(edition, other)
        if mine:
            base["title"][other], base["subtitle"][other] = journey_texts(edition, other, mine)
    if journey:
        base["cover_photo_id"] = cover_ref(edition, journey)
    return base


# ---- writing (edition editor mirrors into the journeys) ---------------------------------------

def _patch_snapshot(journey, photo_dict, **fields):
    snap = copy.deepcopy(journey.published_data or {})
    snap.update(fields)
    journey.published_data = snap
    return snap


def _is_orphan_cover(journey, photo):
    if not photo or photo.demo or photo.chapter_id is not None or photo.position < EDITION_SLOTS:
        return False
    for chapter in journey.chapters:
        layout = chapter.layout or {}
        if photo.id in (layout.get("photo_ids") or []) or any(
                p.get("photo_id") == photo.id for key in ("placements", "filmstrip_placements") for p in layout.get(key) or []):
            return False
    return True


def set_cover(edition, lang, ref, upload_folder, photo_dict):
    journey = find_journey(edition, lang)
    if not journey or cover_ref(edition, journey) == ref:
        return
    default_index = DEFAULT_COVER_INDEX[edition]
    default_name = ASSETS[edition][default_index][0]
    old = db.session.get(Photo, journey.cover_id) if journey.cover_id else None
    created = []
    target = None
    if ref is None or (ref < 0 and -ref - 1 == default_index):
        target = next((p for p in journey.photos if p.demo and p.filename == default_name), None)
        if target is None:
            target = _demo_photo(journey, edition, lang, default_index, position=len(journey.photos))
    elif ref < 0:
        name = ASSETS[edition][-ref - 1][0]
        target = next((p for p in journey.photos if p.demo and p.filename == name), None)
        if target is None:
            target = _demo_photo(journey, edition, lang, -ref - 1, position=len(journey.photos))
    else:
        source = db.session.get(Photo, ref)
        if source is not None and source.journey_id == journey.id:
            target = source
        elif source is not None and not source.demo:
            target = _copy_photo(journey, source, upload_folder, created, position=max(EDITION_SLOTS, len(journey.photos)))
    if target is None:
        return
    db.session.flush()
    orphan_file = None
    if old is not None and old.id != target.id and _is_orphan_cover(journey, old):
        orphan_file = old.filename
        db.session.delete(old)
    journey.cover_id = target.id
    journey.composition_version += 1
    db.session.flush()
    db.session.expire(journey, ["photos"])
    snap = copy.deepcopy(journey.published_data or {})
    photos = [p for p in snap.get("photos", []) if orphan_file is None or p.get("id") != (old.id if old else None)]
    cover = photo_dict(target)
    if all(p.get("id") != target.id for p in photos):
        photos.append(cover)
    snap.update(photos=photos, photo_count=len(photos), cover=cover, cover_id=target.id)
    journey.published_data = snap
    if orphan_file:
        remove_media(upload_folder, orphan_file)


def set_texts(edition, lang, title, subtitle):
    """Empty text = back to the shipped default."""
    journey = find_journey(edition, lang)
    if not journey:
        return
    default = EXAMPLE_COPY[edition][lang]
    title, subtitle = title or default["title"], subtitle or default["subtitle"]
    if (journey.title, journey.subtitle) == (title, subtitle) and (journey.published_data or {}).get("title") == title \
            and (journey.published_data or {}).get("subtitle") == subtitle:
        return
    journey.title, journey.subtitle = title, subtitle
    journey.composition_version += 1  # an editor tab that is open on this journey must reload
    if journey.published_data:
        _patch_snapshot(journey, None, title=journey.title, subtitle=journey.subtitle)
