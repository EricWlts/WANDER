from .models import db, Journey, Chapter, Photo


def seed_demo():
    journey = Journey(
        slug="fichtelgebirge", title="Fichtelgebirge", subtitle="Where silence becomes a memory.",
        location="Fichtelgebirge, Bavaria", country="Germany", start_date="2026-10-09", end_date="2026-10-12",
        description="Four days beneath the pines. No itinerary, just a little curiosity and the long way home.",
        introduction="Some places ask you to do more. Others invite you to simply be. This imagined journey follows the quiet paths of the Fichtelgebirge — through pine-scented mornings, weathered stone and the gentle art of getting a little lost.",
        reflection="Perhaps the best thing we brought back was a slower way of seeing.",
        closing="The paths will still be there. The light will be different. And that is reason enough to return.",
        preset="cinematic", published=True, demo=True,
    )
    db.session.add(journey)
    db.session.flush()
    chapters = [
        Chapter(journey=journey, title="Into the quiet", date="2026-10-09", position=0,
                story="A fictional field note: the road gives way to a narrow path. Mist settles between the trees, softening every edge. There is nothing to hurry towards, and for once, that feels like enough.",
                quote="A little further from everything. A little closer to ourselves."),
        Chapter(journey=journey, title="The long way around", date="2026-10-10", position=1,
                story="A landscape measured in footsteps, not kilometres. Imagine a morning spent following the tree line, pausing at a clearing, and letting the horizon decide what comes next."),
        Chapter(journey=journey, title="What stays with us", date="2026-10-12", position=2,
                story="Not every memory needs a landmark. Sometimes it is the colour of the moss, the sound beneath your feet, or the way the afternoon light falls on a familiar path.",
                quote="We went looking for a place. We found a feeling."),
    ]
    db.session.add_all(chapters)
    db.session.flush()
    photos = [
        ("forest", "A world softened by mist", "Pine trees emerging from soft grey mist", 2200, 1467, 0, True, "Lili Kovac", "https://unsplash.com/photos/JonGFaeFPgg"),
        ("mountains", "Where the forest meets the sky", "Layered evergreen mountain slopes beneath clouds", 2200, 1467, 1, True, "Jon Flobrant", "https://unsplash.com/photos/84YI_5TWAiU"),
        ("heather", "The small things", "Heather in a misty landscape", 2200, 1473, 0, False, "paws and prints", "https://unsplash.com/photos/HDdoBRocjD0"),
        ("canopy", "Between the pines", "A quiet conifer forest in the fog", 2200, 3300, 2, True, "Damien Schnorhk", "https://unsplash.com/photos/d6lFoNdyeo8"),
    ]
    for i, (name, title, alt, width, height, chapter, featured, credit, url) in enumerate(photos):
        photo = Photo(journey=journey, chapter=chapters[chapter], filename=name, title=title,
                      alt=alt, description="Illustrative stock photography; not a documentary photograph of this journey.",
                      width=width, height=height, featured=featured, position=i, credit=credit, source_url=url, demo=True)
        db.session.add(photo)
        db.session.flush()
        if i == 0:
            journey.cover_id = photo.id
    db.session.commit()
