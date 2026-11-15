from .models import db, Journey, Chapter, Photo


def seed_demo():
    journey = Journey(
        slug="berner-oberland", title="Berner Oberland", subtitle="Zwischen Schnee und Stille.",
        location="Berner Oberland", country="Schweiz", start_date="2024-12-27", end_date="2025-01-01",
        description="Sechs Wintertage in den Alpen, zum Jahreswechsel.",
        introduction="Wir verbringen den Jahreswechsel in den Bergen. Es liegt Schnee, die Tage sind kurz, und das meiste, was wir uns vorgenommen haben, bleibt liegen. Geblieben ist das Licht.",
        reflection="",
        closing="Der Schnee wird schmelzen. Die Weite bleibt.",
        preset="cinematic", published=True, demo=True,
    )
    db.session.add(journey)
    db.session.flush()
    chapters = [
        Chapter(journey=journey, title="Ankommen im Schnee", date="2024-12-27", position=0,
                story="Das Holzchalet steht im Gegenlicht. Wir packen aus, ohne uns zu beeilen. Am Abend färben sich die Gipfel rot."),
        Chapter(journey=journey, title="Stilles Wasser", date="2024-12-29", position=1,
                story="Am See liegt der Dunst zwischen den Bergen. Ein rostiger Steg führt ein Stück hinaus und endet im Wasser."),
        Chapter(journey=journey, title="Das erste Licht des Jahres", date="2025-01-01", position=2,
                story="Am Neujahrstag gehen wir hinauf. Eine Hängebrücke spannt sich zwischen zwei verschneiten Gipfeln.",
                quote="Der Schnee wird schmelzen. Die Weite bleibt."),
    ]
    db.session.add_all(chapters)
    db.session.flush()
    photos = [
        ("ch-panorama", "Alpenpanorama", "Weite Sicht über schneebedeckte Alpengipfel", 2200, 1467, 2, True),
        ("ch-chalet", "Chalet im Gegenlicht", "Ein Holzchalet im Schnee, gegen das Licht fotografiert", 2200, 1467, 0, True),
        ("ch-see", "Stilles Wasser", "Ein ruhiger See vor einer Bergkette im Dunst", 2200, 1467, 1, False),
        ("ch-steinmann", "Ein kleines Steinmännchen", "Ein Steinmännchen an einem Gebirgsbach", 2200, 3300, 1, True),
    ]
    for i, (name, title, alt, width, height, chapter, featured) in enumerate(photos):
        photo = Photo(journey=journey, chapter=chapters[chapter], filename=name, title=title,
                      alt=alt, description="",
                      width=width, height=height, featured=featured, position=i, demo=True)
        db.session.add(photo)
        db.session.flush()
        if i == 0:
            journey.cover_id = photo.id
    db.session.commit()
