from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash

db = SQLAlchemy()


class Admin(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    password_hash = db.Column(db.String(256), nullable=False)

    def set_password(self, value):
        self.password_hash = generate_password_hash(value)


class Journey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(160), unique=True, nullable=False)
    title = db.Column(db.String(160), nullable=False)
    subtitle = db.Column(db.String(300), default="")
    location = db.Column(db.String(160), default="")
    country = db.Column(db.String(80), default="")
    start_date = db.Column(db.String(10), nullable=False)
    end_date = db.Column(db.String(10), nullable=False)
    description = db.Column(db.Text, default="")
    introduction = db.Column(db.Text, default="")
    reflection = db.Column(db.Text, default="")
    closing = db.Column(db.Text, default="")
    preset = db.Column(db.String(24), default="cinematic")
    story_template = db.Column(db.String(24), default="quiet-atlas", nullable=False)
    studio_step = db.Column(db.Integer, default=1, nullable=False)
    filmstrip_ids = db.Column(db.JSON, default=list, nullable=False)
    reveal_settings = db.Column(db.JSON, default=dict, nullable=False)
    layout = db.Column(db.JSON, default=dict, nullable=False)
    published_data = db.Column(db.JSON, nullable=True)
    published = db.Column(db.Boolean, default=False)
    demo = db.Column(db.Boolean, default=False)
    cover_id = db.Column(db.Integer, nullable=True)
    chapters = db.relationship("Chapter", cascade="all, delete-orphan", backref="journey", order_by="Chapter.position")
    photos = db.relationship("Photo", cascade="all, delete-orphan", backref="journey", order_by="Photo.position")


class Chapter(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    journey_id = db.Column(db.Integer, db.ForeignKey("journey.id"), nullable=False)
    title = db.Column(db.String(160), nullable=False)
    date = db.Column(db.String(10), default="")
    story = db.Column(db.Text, default="")
    quote = db.Column(db.String(1000), default="")
    position = db.Column(db.Integer, default=0)
    kind = db.Column(db.String(24), default="chapter", nullable=False)
    gallery_mode = db.Column(db.String(24), default="editorial", nullable=False)
    reveal = db.Column(db.JSON, default=dict, nullable=False)
    layout = db.Column(db.JSON, default=dict, nullable=False)
    photos = db.relationship("Photo", backref="chapter")


class Photo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    journey_id = db.Column(db.Integer, db.ForeignKey("journey.id"), nullable=False)
    chapter_id = db.Column(db.Integer, db.ForeignKey("chapter.id"), nullable=True)
    title = db.Column(db.String(160), default="Untitled photograph")
    description = db.Column(db.String(2000), default="")
    alt = db.Column(db.String(500), default="")
    filename = db.Column(db.String(100), nullable=False)
    width = db.Column(db.Integer, nullable=False)
    height = db.Column(db.Integer, nullable=False)
    featured = db.Column(db.Boolean, default=False)
    position = db.Column(db.Integer, default=0)
    credit = db.Column(db.String(300), default="")
    source_url = db.Column(db.String(500), default="")
    demo = db.Column(db.Boolean, default=False)
    upload_key = db.Column(db.String(80), nullable=True)
    edits = db.Column(db.JSON, default=dict, nullable=False)
    has_master = db.Column(db.Boolean, default=False, nullable=False)
