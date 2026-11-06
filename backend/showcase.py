"""Read-only fictional showcase, separate from the personal journey collection."""
from .story_templates import TEMPLATES, example_photo


COPY = {
    "de": {
        "title": "Bevor der Wald erwacht",
        "subtitle": "Zwischen Nebel und erstem Licht.",
        "description": "Die Straße endet. Ein Weg bleibt. Eine Fotoerzählung über den Moment, in dem aus Weitergehen Hinsehen wird.",
        "introduction": "An der letzten Laterne stecke ich das Telefon weg. Vor mir liegt ein Weg, den der Nebel nach wenigen Schritten verschluckt. Ich wollte früh genug für das erste Licht sein. Jetzt bin ich hier, und vom Licht ist nichts zu sehen.",
        "chapters": [
            ["Noch ohne Richtung", "Unter den Bäumen ist es heller als auf der Straße. Wasser hängt an den Nadeln; ab und zu fällt ein Tropfen, lange nachdem ich vorbeigegangen bin. Ich bleibe stehen. Im Sucher stehen die Stämme dicht beieinander. Erst als ich die Kamera senke, sehe ich den schmalen Abstand zwischen ihnen. Dort geht es weiter."],
            ["Ein kleinerer Horizont", "Der Bach ist zu hören, bevor er zu sehen ist. Ich gehe in die Hocke. Auf einem Stein wächst Moos über die Kante, als hätte es dort etwas zu suchen. Dahinter zieht das Wasser vorbei. Für das Foto muss ich mich entscheiden: die weiche Fläche oder die Bewegung. Ich mache zwei Bilder und bleibe noch eine Weile."],
            ["Was das Licht behält", "Am Hang löst sich der Nebel. Ein heller Streifen wandert über den Weg und erreicht meine Schuhe. Weiter unten geht jemand zwischen den Bäumen hindurch. Für einen Augenblick haben wir dieselbe Richtung. Dann biegt der Weg ab, und ich bin wieder allein."],
        ],
        "quote": "Auf dem Rückweg erkenne ich den Stein wieder.",
        "closing": "An der letzten Laterne hole ich das Telefon wieder heraus. Es ist noch früh. Auf dem Display öffnet sich die Karte, aber ich weiß jetzt, wo ich bin.",
        "captions": ["Der Weg im ersten Licht", "Stämme im Nebel", "Wasser zwischen den Bäumen", "Moos an der Wasserkante", "Der Hang öffnet sich", "Eine Gestalt im Licht", "Farbe unter grauem Himmel", "Zwischen den Nadeln"],
        "alts": ["Sonnenlicht fällt durch Nebel auf einen Waldweg", "Nadelbäume treten aus grauem Nebel hervor", "Moosbewachsene Bäume neben fließendem Wasser", "Grünes Moos auf Steinen in einem Bach", "Bewaldete Berghänge unter tiefen Wolken", "Eine Person geht auf einem Waldweg im Morgenlicht", "Heidepflanzen in einer nebligen Landschaft", "Hohe Nadelbäume in dichtem Nebel"],
    },
    "en": {
        "title": "Before the forest wakes",
        "subtitle": "Between mist and first light.",
        "description": "The road ends. A path remains. A photo essay about the moment walking becomes looking.",
        "introduction": "At the last streetlamp I put my phone away. Ahead, the mist swallows the path after a few steps. I wanted to be early enough for the first light. Now I am here, and there is no light to speak of.",
        "chapters": [
            ["Without a direction", "Under the trees it is brighter than on the road. Water clings to the needles; now and then a drop falls, long after I have passed. I stop. In the viewfinder the trunks stand close together. Only when I lower the camera do I see the narrow gap between them. That is where the path goes."],
            ["A smaller horizon", "I hear the stream before I see it. I crouch down. Moss grows over the edge of a stone as though looking for something. Behind it the water keeps moving. For the photograph I have to choose: the soft surface or the current. I take two pictures and stay a little longer."],
            ["What the light keeps", "On the hillside the mist begins to lift. A bright stripe moves across the path until it reaches my shoes. Lower down, someone walks between the trees. For a moment we are heading the same way. Then the path turns, and I am alone again."],
        ],
        "quote": "On the way back I recognise the stone.",
        "closing": "At the last streetlamp I take my phone out again. It is still early. The map opens on the screen, but now I know where I am.",
        "captions": ["The path in first light", "Trunks in the mist", "Water between trees", "Moss at the water's edge", "The hillside opens", "A figure in the light", "Colour beneath a grey sky", "Between the needles"],
        "alts": ["Sunlight falls through mist onto a forest path", "Conifers emerge from grey mist", "Moss-covered trees beside flowing water", "Green moss on stones in a stream", "Forested mountain slopes beneath low cloud", "A person on a woodland path in morning light", "Heather in a misty landscape", "Tall conifers in dense fog"],
    },
}


def make_showcase(edition, locale):
    template = next((item for item in TEMPLATES if item["id"] == edition), None)
    if template is None or locale not in COPY:
        return None
    copy = COPY[locale]
    photos = [
        example_photo(index, title=title, alt=alt)
        for index, (title, alt) in enumerate(zip(copy["captions"], copy["alts"]))
    ]

    def module(kind, title, *, story="", quote="", mode="editorial", images=(), **layout):
        position = len(chapters)
        return {
            "id": -(position + 1), "position": position, "kind": kind,
            "title": title, "story": story, "quote": quote, "date": "",
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
    pair_titles = ("Unter den Bäumen", "Am Wasser") if locale == "de" else ("Under the trees", "By the water")
    for index, images in enumerate(((7, 1), (2, 3))):
        title, story = copy["chapters"][index]
        chapter = module("chapter", title, story=story)
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
    chapters.append(module("chapter", title, story=story, mode="horizontal", images=(4, 5, 6)))
    chapters.append(module("image", photos[0]["title"], images=(0,), show_title=False, media_width="cover-frame"))

    return {
        "id": -3, "slug": edition, "is_example": True, "demo": True, "published": True,
        "story_template": edition, "preset": template["preset"],
        "title": copy["title"], "subtitle": copy["subtitle"], "description": copy["description"],
        "introduction": copy["introduction"], "closing": copy["closing"], "reflection": "",
        "location": "Am Rand des Waldes" if locale == "de" else "At the edge of the forest",
        "country": "Fiktive Fotoerzählung" if locale == "de" else "Fictional photo essay",
        "start_date": "", "end_date": "", "studio_step": 4, "filmstrip_ids": [],
        "cover": photos[1], "cover_id": photos[1]["id"], "photo_count": len(photos),
        "chapter_count": 3, "photos": photos, "chapters": chapters,
        "layout": {"title_style": "overlay", "title_size": 86, "text_animations": False},
        "reveal_settings": {"default": {"effect": "up", "duration": 1000},
                            "images": {"effect": "fade", "duration": 1200}},
    }
