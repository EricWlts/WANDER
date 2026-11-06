"""Original, fictional reference essays. Never inserted into a personal journal."""
TEMPLATES = [
    {"id": "quiet-atlas", "name": "Quiet Atlas", "kicker": "THE DAYLIGHT EDITION",
     "description": "Pale grey. Generous margins. A quiet rhythm of full frames and intimate details.",
     "cover": "/images/path-1280.webp", "preset": "quiet",
     "prompts": ["What was the first thing you noticed?", "Which small detail brings the day back?", "What did you carry home?"]},
    {"id": "after-hours", "name": "After Hours", "kicker": "THE CINEMATIC EDITION",
     "description": "Deep olive. Immersive frames. A filmic sequence, with room for the unexpected.",
     "cover": "/images/walker-1280.webp", "preset": "cinematic",
     "prompts": ["Where did the light find you?", "Which moment made you stop?", "How did the day change you?"]},
]

# Stock photographs illustrate an atmosphere; they do not document these essays.
ASSETS = [
    ("path", "The road softens", "Sunlight falling through mist along a forest road", 2200, 1650, "Mike Tilley", "u8bo8dmhGMc"),
    ("forest", "A pale morning", "Pine trees emerging from soft grey mist", 2200, 1467, "Lili Kovac", "JonGFaeFPgg"),
    ("river", "Water takes the long way", "Moss-covered trees beside a rushing river", 2200, 2566, "T", "sRsc98Giz5I"),
    ("moss", "A smaller landscape", "Green moss covering rocks in a flowing stream", 2200, 1375, "Takashi Miyazaki", "8oj7ls-3G9I"),
    ("mountains", "Nothing to measure", "Layered evergreen mountain slopes beneath clouds", 2200, 1467, "Jon Flobrant", "84YI_5TWAiU"),
    ("walker", "A figure in the light", "A person walking along a forest path at sunrise", 2200, 1467, "Ewan Z", "rwiUgwQyi5s"),
    ("heather", "The colour of stillness", "Heather growing in a misty landscape", 2200, 1473, "paws and prints", "HDdoBRocjD0"),
    ("canopy", "The last of the light", "A quiet conifer forest in the fog", 2200, 3300, "Damien Schnorhk", "d6lFoNdyeo8"),
]


def example_photo(index, *, title=None, alt=None, chapter_id=None, featured=False):
    name, default_title, default_alt, width, height, credit, source = ASSETS[index]
    return {
        "id": -(index + 1), "chapter_id": chapter_id, "position": index,
        "title": default_title if title is None else title,
        "alt": default_alt if alt is None else alt,
        "description": "Illustrative stock photography · fictional editorial example.",
        "width": width, "height": height, "featured": featured, "demo": True,
        "credit": credit, "source_url": f"https://unsplash.com/photos/{source}",
        "url": f"/images/{name}-1280.webp", "large_url": f"/images/{name}-2200.webp", "original_url": None,
        "srcset": ", ".join(f"/images/{name}-{size}.webp {size}w" for size in (640, 1280, 2200)),
    }


def make_example(template_id):
    template = next((item for item in TEMPLATES if item["id"] == template_id), None)
    if not template:
        return None
    dark = template_id == "after-hours"
    chapters = [
        {"id": -(index + 1), "kind": "chapter", "position": index, "date": f"2026-10-{9 + index:02}",
         "title": title, "story": story, "quote": "", "reveal": {"effect": "up", "duration": 2000},
         "gallery_mode": "horizontal" if dark or index == 1 else "editorial"}
        for index, (title, story) in enumerate([
            ("The light arrives first", "Before there is a plan, there is a patch of sunlight on the road. We follow it until the road no longer seems important."),
            ("An afternoon without edges", "Water folds over stone. Someone stops to look; someone else keeps walking. For a while, both feel like the right thing to do."),
            ("What the day leaves behind", "The last photograph is almost nothing: trees, a path, light running out. At home, it will be the one we return to.")
        ] if dark else [
            ("Learning to arrive", "The first morning is spent unlearning the timetable. Beyond the last house, the road narrows. We put the map away before it asks us to turn."),
            ("The scale of small things", "A river interrupts the afternoon. Beside it, moss makes a landscape of a single stone. We had come for the view. We stay for this."),
            ("A different way home", "On the last day, the forest is already familiar. The way back takes longer than the way in. This time, we know where to stop.")
        ])
    ]
    photos = []
    for index in range(len(ASSETS)):
        day = 0 if index < 2 else 1 if index < 5 else 2
        photos.append(example_photo(index, chapter_id=chapters[day]["id"], featured=index in {0, 2, 3, 5}))
    cover = photos[5] if dark else photos[0]
    return {"id": -2 if dark else -1, "slug": template_id, "is_example": True,
            "title": "When the light stays" if dark else "The art of going nowhere",
            "subtitle": "A few days at the edge of the ordinary." if dark else "Three days. No particular destination.",
            "description": "An original fictional photo essay, made as a starting point for your own.",
            "introduction": "We set out with no particular story in mind. Just a camera, a little time, and the sense that the ordinary might still have something to show us." if dark else "There are journeys that ask for an itinerary. This one asks only for a pair of shoes, an open afternoon, and the willingness to miss the shortest way back.",
            "reflection": "", "closing": "Some places become a habit of looking.",
            "location": "Somewhere among the trees", "country": "An imagined escape", "start_date": "2026-10-09", "end_date": "2026-10-11",
            "preset": template["preset"], "published": True, "demo": True, "story_template": template_id,
            "studio_step": 4, "filmstrip_ids": [photo["id"] for photo in photos] if dark else [],
            "cover_id": cover["id"], "cover": cover, "photo_count": len(photos), "chapter_count": len(chapters),
            "photos": photos, "chapters": chapters,
            "reveal_settings": {"default": {"effect": "up", "duration": 2000}, "images": {"effect": "fade", "duration": 2400}}}
