"""Example journeys that ship with WANDER: two real trips, shown as reference essays. Never inserted into a personal journal."""
TEMPLATES = [
    {"id": "quiet-atlas", "name": "First Light", "kicker": "EDITION I",
     "description": "The bright edition. Wide margins, a calm breath, the light just after waking.",
     "cover": "/images/ch-panorama-1280.webp", "preset": "quiet",
     "prompts": ["What was the first thing you noticed?", "Which small detail brings the day back?", "What did you carry home?"]},
    {"id": "after-hours", "name": "Last Light", "kicker": "EDITION II",
     "description": "The cinematic edition. Deep charcoal, large images, the glow before it grows dark.",
     "cover": "/images/tf-calima-1280.webp", "preset": "cinematic",
     "prompts": ["Where did the light find you?", "Which moment made you stop?", "How did the day change you?"]},
]

# (file stem, title, alt text, width, height) of the 2200 px variant; index 0..7 per edition.
ASSETS = {
    "quiet-atlas": [
        ("ch-panorama", "Alpine panorama", "Wide view over snow-covered Alpine peaks", 2200, 1467),
        ("ch-chalet", "Chalet in backlight", "A wooden chalet in the snow, seen against the light", 2200, 1467),
        ("ch-steg", "The jetty", "A rusty jetty in a still lake, mountains in haze behind it", 2200, 1467),
        ("ch-steinmann", "A small cairn", "A stack of stones beside a mountain stream", 2200, 3300),
        ("ch-see", "Still water", "A calm lake with a mountain range in haze", 2200, 1467),
        ("ch-bruecke", "Bridge between the peaks", "A suspension bridge between snow-covered summits", 2200, 1467),
        ("ch-kanal", "The way along the canal", "A path beside a canal leading towards the mountains", 2200, 1467),
        ("ch-abendrot", "Evening glow", "Evening red over snow-covered mountains", 2200, 1467),
    ],
    "after-hours": [
        ("tf-klippe", "Above the sea", "A man on a rock high above the Atlantic", 2200, 1467),
        ("tf-wolfsmilch", "Candelabra spurge", "Candelabra spurge on a cliff above the Atlantic", 2200, 1467),
        ("tf-lava", "Surf on black lava", "Surf breaking between black lava rocks", 2200, 1467),
        ("tf-wolken", "A waterfall of cloud", "Clouds flowing over a mountain ridge", 2200, 1467),
        ("tf-hoehle", "In the cave arch", "A silhouette in the arch of a cave", 2200, 1467),
        ("tf-calima", "Calima sun", "The sun in Calima haze above dark mountains", 2200, 1467),
        ("tf-silhouette", "Against the light", "Silhouette of a man in backlight", 2200, 1467),
        ("tf-palme", "Palm shadows", "Shadows of palm fronds", 2200, 3300),
    ],
}
CAPTIONS_DE = {
    "quiet-atlas": [
        ("Alpenpanorama", "Weite Sicht über schneebedeckte Alpengipfel"),
        ("Chalet im Gegenlicht", "Ein Holzchalet im Schnee, gegen das Licht fotografiert"),
        ("Der Steg", "Ein rostiger Steg in einem stillen See, dahinter Berge im Dunst"),
        ("Ein kleines Steinmännchen", "Ein Steinmännchen an einem Gebirgsbach"),
        ("Stilles Wasser", "Ein ruhiger See vor einer Bergkette im Dunst"),
        ("Brücke zwischen den Gipfeln", "Eine Hängebrücke zwischen verschneiten Gipfeln"),
        ("Der Weg am Kanal", "Ein Weg am Kanal entlang, der auf die Berge zuführt"),
        ("Abendrot", "Abendrot über verschneiten Bergen"),
    ],
    "after-hours": [
        ("Über dem Meer", "Ein Mann auf einem Felsen hoch über dem Atlantik"),
        ("Kandelaber-Wolfsmilch", "Kandelaber-Wolfsmilch an einer Klippe über dem Atlantik"),
        ("Brandung auf Lava", "Brandung zwischen schwarzen Lavafelsen"),
        ("Ein Wasserfall aus Wolken", "Wolken fließen über einen Bergkamm"),
        ("Im Höhlenbogen", "Eine Silhouette im Bogen einer Höhle"),
        ("Calima-Sonne", "Die Sonne im Calima-Dunst über dunklen Bergen"),
        ("Im Gegenlicht", "Silhouette eines Mannes im Gegenlicht"),
        ("Palmenschatten", "Schatten von Palmwedeln"),
    ],
}
# Which chapter each photo belongs to (by the day it was taken).
CHAPTER_OF = {
    "quiet-atlas": [2, 0, 1, 0, 1, 2, 1, 0],
    "after-hours": [0, 0, 1, 1, 2, 2, 2, 2],
}
DATES = {"quiet-atlas": ("2024-12-27", "2025-01-01"), "after-hours": ("2025-08-09", "2025-08-19")}
CHAPTER_DATES = {
    "quiet-atlas": ("2024-12-27", "2024-12-29", "2025-01-01"),
    "after-hours": ("2025-08-10", "2025-08-13", "2025-08-17"),
}
PLACE = {
    "quiet-atlas": {"en": ("Bernese Oberland", "Switzerland"), "de": ("Berner Oberland", "Schweiz")},
    "after-hours": {"en": ("Tenerife", "Spain"), "de": ("Teneriffa", "Spanien")},
}
EXAMPLE_COPY = {
    "quiet-atlas": {
        "en": {
            "title": "Between snow and stillness",
            "subtitle": "Over the turn of the year in the Bernese Oberland.",
            "description": "A photo essay from six winter days in the Alps.",
            "introduction": "We spend the turn of the year in the mountains. There is snow, the days are short, and most of what we planned stays undone. What remains is the light.",
            "chapters": [
                ("Arriving in snow", "The wooden chalet stands against the light. We unpack without hurrying. In the evening the peaks turn red, and we stay outside longer than the cold allows."),
                ("Still water", "By the lake the haze settles between the mountains. A rusty jetty reaches a little way out and ends in the water. Beside a stream someone has stacked stones into a small tower; we leave it standing."),
                ("The first light of the year", "On New Year's Day we climb. A suspension bridge spans two snowy summits, and above it the whole panorama opens up."),
            ],
            "closing": "The snow will melt. The wide view stays.",
        },
        "de": {
            "title": "Zwischen Schnee und Stille",
            "subtitle": "Zum Jahreswechsel im Berner Oberland.",
            "description": "Eine Fotoerzählung aus sechs Wintertagen in den Alpen.",
            "introduction": "Wir verbringen den Jahreswechsel in den Bergen. Es liegt Schnee, die Tage sind kurz, und das meiste, was wir uns vorgenommen haben, bleibt liegen. Geblieben ist das Licht.",
            "chapters": [
                ("Ankommen im Schnee", "Das Holzchalet steht im Gegenlicht. Wir packen aus, ohne uns zu beeilen. Am Abend färben sich die Gipfel rot, und wir stehen länger draußen, als die Kälte es erlaubt."),
                ("Stilles Wasser", "Am See liegt der Dunst zwischen den Bergen. Ein rostiger Steg führt ein Stück hinaus und endet im Wasser. An einem Bach hat jemand Steine zu einem kleinen Turm gestapelt; wir lassen ihn stehen."),
                ("Das erste Licht des Jahres", "Am Neujahrstag gehen wir hinauf. Eine Hängebrücke spannt sich zwischen zwei verschneiten Gipfeln, und darüber öffnet sich das ganze Panorama."),
            ],
            "closing": "Der Schnee wird schmelzen. Die Weite bleibt.",
        },
    },
    "after-hours": {
        "en": {
            "title": "What the sun leaves behind",
            "subtitle": "Eleven days on Tenerife in August.",
            "description": "A photo essay about heat, lava and the light at the end of the day.",
            "introduction": "In August Tenerife is hot and bright. We are out early and back late, and the longer the day lasts, the softer the light becomes.",
            "chapters": [
                ("Above the sea", "The cliffs drop steeply to the Atlantic. Candelabra spurge stands between the rocks as if the heat belonged to it alone. We sit at the edge for a long time and watch the water."),
                ("Black rock, white spray", "On the coast the surf meets black lava. Over the ridge the clouds pour into the valley like water. We stay until the light changes."),
                ("Calima", "Towards evening there is dust in the air, and the sun hangs red above dark mountains. Against the light people turn into silhouettes, and in a cave the rock frames the sky."),
            ],
            "closing": "The heat passes. The light stays.",
        },
        "de": {
            "title": "Was die Sonne dalässt",
            "subtitle": "Elf Tage Teneriffa im August.",
            "description": "Eine Fotoerzählung über Hitze, Lava und das Licht am Ende des Tages.",
            "introduction": "Im August ist Teneriffa heiß und hell. Wir sind früh draußen und spät zurück, und je länger der Tag dauert, desto weicher wird das Licht.",
            "chapters": [
                ("Über dem Meer", "Die Klippen fallen steil zum Atlantik ab. Zwischen den Felsen steht Kandelaber-Wolfsmilch, als gehöre die Hitze ihr allein. Wir sitzen lange am Rand und sehen dem Wasser zu."),
                ("Schwarzer Fels, weiße Gischt", "An der Küste trifft die Brandung auf schwarze Lava. Über dem Bergkamm fließen die Wolken wie Wasser ins Tal. Wir bleiben, bis das Licht wechselt."),
                ("Calima", "Gegen Abend liegt Staub in der Luft, und die Sonne hängt rot über dunklen Bergen. Im Gegenlicht werden Menschen zu Silhouetten, und in einer Höhle rahmt der Fels den Himmel."),
            ],
            "closing": "Die Hitze vergeht. Das Licht bleibt.",
        },
    },
}


# ---- Studio overrides (stored as a site setting per edition) ---------------------------------
EDITION_IDS = ("quiet-atlas", "after-hours")
EDITION_SLOTS = 8
EDITION_DEVICES = ("desktop", "tablet", "mobile")
DEFAULT_COVER_INDEX = {"quiet-atlas": 0, "after-hours": 5}
OVERRIDE_COVER_ID = -100  # an overridden cover is its own photo; it never collides with the eight slot ids
IMAGE_KEYS = ("url", "large_url", "original_url", "srcset", "width", "height", "credit", "source_url")


def default_focus():
    return {device: {"x": 50.0, "y": 50.0} for device in EDITION_DEVICES}


def slot_shapes(edition):
    """'portrait' or 'landscape' per slot, taken from the shipped photographs."""
    return ["portrait" if height > width else "landscape" for _, _, _, width, height in ASSETS[edition]]


def with_source(base, source):
    """Swap the image of an example photo for another photo dict (same fields as /media photographs)."""
    if not source:
        return base
    result = dict(base)
    for key in IMAGE_KEYS:
        if key in source:
            result[key] = source[key]
    title = source.get("title") or ""
    result["title"] = "" if title == "Untitled photograph" else title
    result["alt"] = source.get("alt") or result["title"]
    result["description"] = ""
    return result


def _ref(value):
    """A photograph reference: a positive id (uploaded photograph), -1..-8 (shipped photograph of this edition) or None."""
    if type(value) is int and (value > 0 or -EDITION_SLOTS <= value < 0):
        return value
    return None


def _number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value != value:
        return 50.0
    return round(min(100.0, max(0.0, float(value))), 1)


def _texts(value):
    value = value if isinstance(value, dict) else {}
    return {lang: (value.get(lang).strip()[:160] if isinstance(value.get(lang), str) else "") for lang in ("de", "en")}


def clean_override(stored):
    """Lenient reading of a stored override: anything unusable falls back to the default."""
    stored = stored if isinstance(stored, dict) else {}
    slots = stored.get("slots") if isinstance(stored.get("slots"), list) else []
    focus = stored.get("focus") if isinstance(stored.get("focus"), dict) else {}
    return {
        "cover_photo_id": _ref(stored.get("cover_photo_id")),
        "focus": {device: {axis: _number((focus.get(device) or {}).get(axis, 50) if isinstance(focus.get(device), dict) else 50) for axis in ("x", "y")}
                  for device in EDITION_DEVICES},
        "slots": [_ref(slots[index]) if index < len(slots) else None for index in range(EDITION_SLOTS)],
        "title": _texts(stored.get("title")),
        "subtitle": _texts(stored.get("subtitle")),
    }


def override_is_custom(override):
    return bool(
        override["cover_photo_id"] is not None
        or any(slot is not None for slot in override["slots"])
        or override["focus"] != default_focus()
        or any(override[key][lang] for key in ("title", "subtitle") for lang in ("de", "en"))
    )


def resolve_overrides(edition, stored, lookup, locale="en"):
    """Turn a stored override into photographs. `lookup(photo_id)` returns a photo dict or None (deleted photos fall back to the default)."""
    override = clean_override(stored)

    def source(ref):
        if ref is None:
            return None
        if ref < 0:
            return example_photo(edition, -ref - 1, locale=locale)
        return lookup(ref)

    cover = source(override["cover_photo_id"])
    slots = [source(ref) for ref in override["slots"]]
    effective = {
        "cover_photo_id": override["cover_photo_id"] if cover else None,
        "focus": override["focus"],
        "slots": [ref if slots[index] else None for index, ref in enumerate(override["slots"])],
        "title": override["title"], "subtitle": override["subtitle"],
    }
    return {"cover": cover, "slots": slots, "effective": effective,
            "focus": override["focus"], "focus_custom": override["focus"] != default_focus(),
            "title": override["title"].get(locale) or None, "subtitle": override["subtitle"].get(locale) or None}


def cover_photo(edition, photos, resolved, default_index):
    """The cover dict: the override image on top of the default cover, otherwise the default slot photo itself."""
    if resolved and resolved["cover"]:
        return {**with_source(photos[default_index], resolved["cover"]), "id": OVERRIDE_COVER_ID}
    return photos[default_index]


def captions(edition, locale="en"):
    if locale == "de":
        return CAPTIONS_DE[edition]
    return [(title, alt) for _, title, alt, _, _ in ASSETS[edition]]


def example_photo(edition, index, *, locale="en", title=None, alt=None, chapter_id=None, featured=False, source=None):
    name, default_title, default_alt, width, height = ASSETS[edition][index]
    if locale == "de":
        default_title, default_alt = CAPTIONS_DE[edition][index]
    return with_source({
        "id": -(index + 1), "chapter_id": chapter_id, "position": index,
        "title": default_title if title is None else title,
        "alt": default_alt if alt is None else alt,
        "description": "",
        "width": width, "height": height, "featured": featured, "demo": True,
        "credit": "", "source_url": "",
        "url": f"/images/{name}-1280.webp", "large_url": f"/images/{name}-2200.webp", "original_url": None,
        "srcset": ", ".join(f"/images/{name}-{size}.webp {size}w" for size in (640, 1280, 2200)),
    }, source)


def make_example(template_id, locale="en", stored=None, lookup=None):
    template = next((item for item in TEMPLATES if item["id"] == template_id), None)
    if not template:
        return None
    locale = "de" if locale == "de" else "en"
    dark = template_id == "after-hours"
    copy = EXAMPLE_COPY[template_id][locale]
    resolved = resolve_overrides(template_id, stored, lookup or (lambda _id: None), locale) if stored else None
    chapters = [
        {"id": -(index + 1), "kind": "chapter", "position": index, "date": CHAPTER_DATES[template_id][index],
         "title": title, "story": story, "quote": "", "reveal": {"effect": "up", "duration": 2000},
         "gallery_mode": "horizontal" if dark or index == 1 else "editorial"}
        for index, (title, story) in enumerate(copy["chapters"])
    ]
    photos = [
        example_photo(template_id, index, locale=locale, chapter_id=chapters[CHAPTER_OF[template_id][index]]["id"],
                      featured=index in {0, 2, 3, 5}, source=resolved["slots"][index] if resolved else None)
        for index in range(len(ASSETS[template_id]))
    ]
    cover = cover_photo(template_id, photos, resolved, DEFAULT_COVER_INDEX[template_id])
    location, country = PLACE[template_id][locale]
    start, end = DATES[template_id]
    return {"id": -2 if dark else -1, "slug": template_id, "is_example": True,
            "title": (resolved and resolved["title"]) or copy["title"],
            "subtitle": (resolved and resolved["subtitle"]) or copy["subtitle"], "description": copy["description"],
            "cover_focus": resolved["focus"] if resolved and resolved["focus_custom"] else None,
            "introduction": copy["introduction"], "reflection": "", "closing": copy["closing"],
            "location": location, "country": country, "start_date": start, "end_date": end,
            "preset": template["preset"], "published": True, "demo": True, "story_template": template_id,
            "studio_step": 4, "filmstrip_ids": [photo["id"] for photo in photos] if dark else [],
            "cover_id": cover["id"], "cover": cover, "photo_count": len(photos), "chapter_count": len(chapters),
            "photos": photos, "chapters": chapters,
            "reveal_settings": {"default": {"effect": "up", "duration": 2000}, "images": {"effect": "fade", "duration": 2400}}}
