"""Read-only showcase essays built from the two example journeys (Switzerland and Tenerife), separate from the personal journey collection."""
from .story_templates import CHAPTER_DATES, DATES, PLACE, TEMPLATES, cover_photo, example_photo, resolve_overrides


COPY = {
    "quiet-atlas": {
        "de": {
            "title": "Zwischen Schnee und Stille",
            "subtitle": "Sechs Wintertage im Berner Oberland.",
            "description": "Vom Chalet im Gegenlicht bis zum Panorama am Neujahrstag. Eine Fotoerzählung über den Winter in den Alpen.",
            "introduction": "Wir sind zwischen den Jahren in die Berge gefahren. Es liegt Schnee, die Tage sind kurz, und nach wenigen Stunden im Freien wird das Licht zum eigentlichen Programm. Wir haben nichts vor, außer hinzusehen.",
            "chapters": [
                ["Ankommen im Schnee", "Das Chalet steht im Gegenlicht, das Holz dunkel vor dem Schnee. Wir laden aus und lassen die Taschen im Flur stehen. Am späten Nachmittag geht das Licht in Rot über, und die Gipfel hinter dem Haus brennen kurz auf, bevor es kalt wird."],
                ["Wasser, das nichts verrät", "Am See liegt der Dunst so dicht, dass die Berge nur als Schatten dahinter stehen. Ein rostiger Steg führt ein Stück hinaus und hört einfach auf. Weiter oben, am Bach, hat jemand Steine zu einem kleinen Turm gestapelt. Wir gehen vorbei und drehen uns noch einmal um."],
                ["Das erste Licht des Jahres", "Am Neujahrstag gehen wir hinauf. Die Hängebrücke spannt sich zwischen zwei verschneiten Gipfeln, und wir überqueren sie langsam, ohne zu reden. Oben öffnet sich die ganze Kette, Kamm hinter Kamm, bis sie im Weiß verschwindet."],
            ],
            "quote": "Im Schnee wird jedes Geräusch kleiner. Nur das Licht bleibt laut.",
            "closing": "Am letzten Abend gehen wir noch einmal zum Kanal. Der Weg führt auf die Berge zu und endet doch nirgends. Morgen fahren wir zurück; das Panorama nehmen wir mit.",
        },
        "en": {
            "title": "Between snow and stillness",
            "subtitle": "Six winter days in the Bernese Oberland.",
            "description": "From the chalet in backlight to the panorama on New Year's Day. A photo essay about winter in the Alps.",
            "introduction": "We came to the mountains between the years. There is snow, the days are short, and after a few hours outside the light becomes the real programme. We have nothing planned except looking.",
            "chapters": [
                ["Arriving in snow", "The chalet stands against the light, its wood dark against the snow. We unload and leave the bags in the hallway. Late in the afternoon the light turns red, and the peaks behind the house flare up briefly before the cold sets in."],
                ["Water that gives nothing away", "On the lake the haze is so dense that the mountains stand behind it only as shadows. A rusty jetty reaches a little way out and simply stops. Further up, beside a stream, someone has stacked stones into a small tower. We walk past and turn around once more."],
                ["The first light of the year", "On New Year's Day we climb. The suspension bridge spans two snowy summits, and we cross it slowly, without talking. At the top the whole range opens up, ridge behind ridge, until it disappears into white."],
            ],
            "quote": "In snow every sound grows smaller. Only the light stays loud.",
            "closing": "On the last evening we walk to the canal once more. The path leads towards the mountains and ends nowhere. Tomorrow we drive back; the panorama comes with us.",
        },
    },
    "after-hours": {
        "de": {
            "title": "Was die Sonne dalässt",
            "subtitle": "Elf Sommertage auf Teneriffa.",
            "description": "Klippen, Lava und Calima. Eine Fotoerzählung über das Licht am Ende heißer Tage.",
            "introduction": "Im August ist Teneriffa heiß, hell und manchmal von Staub aus der Sahara verhangen. Wir sind früh draußen und spät zurück. Je weiter der Tag fortschreitet, desto weicher wird das Licht, und desto mehr bleibt zum Hinsehen.",
            "chapters": [
                ["Über dem Meer", "Die Klippen fallen steil zum Atlantik ab. Zwischen den Felsen steht Kandelaber-Wolfsmilch, als gehöre die Hitze ihr allein. Wir sitzen lange am Rand, und das Meer tief unten bewegt sich kaum."],
                ["Schwarzer Fels, weiße Gischt", "An der Küste trifft die Brandung auf Lava, die schwarz ist wie gebrannt. Über dem Bergkamm fließen die Wolken ins Tal wie Wasser über eine Kante. Wir bleiben stehen, bis das Licht umschlägt."],
                ["Calima", "Gegen Abend hängt Staub in der Luft, und die Sonne steht rot über den dunklen Bergen. Im Gegenlicht werden Menschen zu Silhouetten. In einer Höhle rahmt der Fels den Himmel, und draußen fällt der Schatten der Palmen über die Wand."],
            ],
            "quote": "Die Hitze geht zuerst. Das Licht bleibt am längsten.",
            "closing": "Am letzten Tag liegt der Schatten der Palmen lang über dem Boden. Wir packen spät. Die Sonne ist schon hinter den Bergen, aber der Himmel bleibt noch eine Weile hell.",
        },
        "en": {
            "title": "What the sun leaves behind",
            "subtitle": "Eleven summer days on Tenerife.",
            "description": "Cliffs, lava and Calima. A photo essay about the light at the end of hot days.",
            "introduction": "In August Tenerife is hot, bright and sometimes veiled by dust from the Sahara. We are out early and back late. The further the day goes, the softer the light becomes, and the more there is to look at.",
            "chapters": [
                ["Above the sea", "The cliffs drop steeply to the Atlantic. Candelabra spurge stands between the rocks as if the heat belonged to it alone. We sit at the edge for a long time, and the sea far below hardly moves."],
                ["Black rock, white spray", "On the coast the surf meets lava as black as if it had been burnt. Over the ridge the clouds pour into the valley like water over an edge. We stay until the light turns."],
                ["Calima", "Towards evening there is dust in the air, and the sun stands red above dark mountains. Against the light people become silhouettes. In a cave the rock frames the sky, and outside the shadow of the palms falls across the wall."],
            ],
            "quote": "The heat leaves first. The light stays longest.",
            "closing": "On the last day the palm shadows lie long on the ground. We pack late. The sun is already behind the mountains, but the sky stays bright a little longer.",
        },
    },
}

# Layout per edition: (pair images, pair images), horizontal gallery, closing image.
LAYOUT = {
    "quiet-atlas": {"pairs": ((1, 7), (2, 3)), "gallery": (5, 6, 4), "closing": 0, "cover": 0},
    "after-hours": {"pairs": ((0, 1), (2, 3)), "gallery": (4, 6, 7), "closing": 5, "cover": 5},
}
PAIR_TITLES = {
    "quiet-atlas": {"de": ("Im Gegenlicht", "Am Wasser"), "en": ("In backlight", "By the water")},
    "after-hours": {"de": ("Auf den Klippen", "Küste und Wolken"), "en": ("On the cliffs", "Coast and clouds")},
}


def make_showcase(edition, locale, stored=None, lookup=None):
    template = next((item for item in TEMPLATES if item["id"] == edition), None)
    if template is None or edition not in COPY or locale not in COPY[edition]:
        return None
    copy = COPY[edition][locale]
    plan = LAYOUT[edition]
    resolved = resolve_overrides(edition, stored, lookup or (lambda _id: None), locale) if stored else None
    photos = [example_photo(edition, index, locale=locale, source=resolved["slots"][index] if resolved else None) for index in range(8)]
    cover = cover_photo(edition, photos, resolved, plan["cover"])
    def module(kind, title, *, story="", quote="", mode="editorial", images=(), date="", **layout):
        position = len(chapters)
        return {
            "id": -(position + 1), "position": position, "kind": kind,
            "title": title, "story": story, "quote": quote, "date": date,
            "reveal": {}, "gallery_mode": mode,
            "layout": {
                "padding": 48, "mobile_padding": 24, "image_parallax": False,
                **layout,
                "placements": [
                    {"id": f"showcase-{position}-{index}", "photo_id": photos[index]["id"],
                     "edits": {"show_title": True}}
                    for index in images
                ],
            },
        }

    chapters = []
    pair_titles = PAIR_TITLES[edition][locale]
    for index, images in enumerate(plan["pairs"]):
        title, story = copy["chapters"][index]
        chapter = module("chapter", title, story=story, date=CHAPTER_DATES[edition][index])
        chapters.append(chapter)
        chapters.append(module(
            "pair", pair_titles[index], images=images, parent_id=chapter["id"],
            show_title=False, columns=2, mobile_columns=1, ratio="original",
            gap=24, mobile_gap=20, media_width="cover-frame",
        ))

    chapters.append(module(
        "quote", "Feldnotiz" if locale == "de" else "Field note",
        quote=copy["quote"], show_title=False, text_preset="medium",
    ))
    title, story = copy["chapters"][2]
    chapters.append(module("chapter", title, story=story, mode="horizontal", images=plan["gallery"], date=CHAPTER_DATES[edition][2]))
    chapters.append(module("image", photos[plan["closing"]]["title"], images=(plan["closing"],), show_title=False, media_width="cover-frame"))

    return {
        "id": -3, "slug": edition, "is_example": True, "demo": True, "published": True,
        "story_template": edition, "preset": template["preset"],
        "title": (resolved and resolved["title"]) or copy["title"],
        "subtitle": (resolved and resolved["subtitle"]) or copy["subtitle"], "description": copy["description"],
        "cover_focus": resolved["focus"] if resolved and resolved["focus_custom"] else None,
        "introduction": copy["introduction"], "closing": copy["closing"], "reflection": "",
        "location": PLACE[edition][locale][0], "country": PLACE[edition][locale][1],
        "start_date": DATES[edition][0], "end_date": DATES[edition][1], "studio_step": 4, "filmstrip_ids": [],
        "cover": cover, "cover_id": cover["id"], "photo_count": len(photos),
        "chapter_count": 3, "photos": photos, "chapters": chapters,
        "layout": {"title_style": "overlay", "title_size": 86, "text_animations": False},
        "reveal_settings": {"default": {"effect": "up", "duration": 1000},
                            "images": {"effect": "fade", "duration": 1200}},
    }
