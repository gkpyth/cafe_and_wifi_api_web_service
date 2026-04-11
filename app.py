"""
Jacksonville, FL Café & Wi-Fi — Flask Application
=======================================
A Flask web app that serves both a REST API for café data and a frontend website that consumes it.

Architecture:
- cafes_primary.db: The untouchable original database (never modified).
- instance/cafés.db: A working copy that all API operations hit. Reset from the primary db on every app launch.
- /api/*: REST API endpoints returning JSON.
- /: Frontend website that fetches data from the API via JavaScript.
- /api/docs: API documentation landing page.
"""

import os
import re
import shutil
import random
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer, String, Boolean


# ── App Configuration ──────────────────────────────────────────────────────────

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///cafes.db"

# Path references for the primary DB and the working copy
PRIMARY_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cafes_primary.db")
WORKING_DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "instance", "cafes.db")


def reset_database():
    """
    Copies cafes_primary.db → instance/cafes.db on every app launch.
    This ensures demo users get a fresh dataset each time, so deletions
    and additions don't persist across restarts.
    """
    os.makedirs(os.path.dirname(WORKING_DB), exist_ok=True)
    shutil.copy2(PRIMARY_DB, WORKING_DB)
    print("✔ Working database reset from primary db.")


# Reset the working DB before anything else runs
reset_database()


@app.context_processor
def inject_year():
    """Makes current_year available to all templates automatically."""
    return {"current_year": datetime.now().year}


# ── Database Setup ─────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
db.init_app(app)


class Cafe(db.Model):
    """
    SQLAlchemy model representing a single café.
    Maps directly to the 'cafe' table in the SQLite database.
    """
    __tablename__ = "cafe"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(250), unique=True, nullable=False)
    map_url: Mapped[str] = mapped_column(String(500), nullable=False)
    img_url: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[str] = mapped_column(String(250), nullable=False)
    has_sockets: Mapped[bool] = mapped_column(Boolean, nullable=False)
    has_toilet: Mapped[bool] = mapped_column(Boolean, nullable=False)
    has_wifi: Mapped[bool] = mapped_column(Boolean, nullable=False)
    can_take_calls: Mapped[bool] = mapped_column(Boolean, nullable=False)
    seats: Mapped[str] = mapped_column(String(250), nullable=True)
    coffee_price: Mapped[str] = mapped_column(String(250), nullable=True)

    def to_dict(self):
        """Converts the Cafe object into a JSON-serializable dictionary."""
        return {col.name: getattr(self, col.name) for col in self.__table__.columns}


with app.app_context():
    db.create_all()


# ── Page Routes ────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    """Serves the main café finder website."""
    return render_template("index.html")


@app.route("/api/docs")
def api_docs():
    """Serves the API documentation page."""
    return render_template("api_docs.html")


# ── API: READ Endpoints ───────────────────────────────────────────────────────

@app.route("/api/cafes")
def api_get_all_cafes():
    """
    GET /api/cafes
    Returns all cafés in the database, ordered alphabetically by name.
    Optional query param: ?location=Shoreditch (filters by neighborhood).
    """
    query = db.select(Cafe).order_by(Cafe.name)

    # If a location query parameter is provided, filter by it (case-insensitive)
    location = request.args.get("location")
    if location:
        query = query.where(db.func.lower(Cafe.location) == location.lower())

    cafes = db.session.execute(query).scalars().all()

    if not cafes and location:
        return jsonify(error={"Not Found": f"No cafés found in '{location}'."}), 404

    return jsonify(cafes=[cafe.to_dict() for cafe in cafes])


@app.route("/api/random")
def api_get_random_cafe():
    """
    GET /api/random
    Returns a single randomly selected café. Great for a 'Feeling Lucky' feature.
    """
    all_cafes = db.session.execute(db.select(Cafe)).scalars().all()

    if not all_cafes:
        return jsonify(error={"Not Found": "No cafés in the database."}), 404

    random_cafe = random.choice(all_cafes)
    return jsonify(cafe=random_cafe.to_dict())


# ── API: CREATE Endpoint ──────────────────────────────────────────────────────

@app.route("/api/add", methods=["POST"])
def api_add_cafe():
    """
    POST /api/add
    Adds a new café to the database.
    Expects JSON body with: name, map_url, img_url, location, has_sockets,
    has_toilet, has_wifi, can_take_calls, seats, coffee_price.
    """
    data = request.get_json()

    # Validate that required fields are present
    required = ["name", "map_url", "img_url", "location"]
    missing = [field for field in required if not data.get(field)]
    if missing:
        return jsonify(error={"Bad Request": f"Missing required fields: {', '.join(missing)}"}), 400

    # Check for duplicate café names
    existing = db.session.execute(
        db.select(Cafe).where(db.func.lower(Cafe.name) == data["name"].lower())
    ).scalar()
    if existing:
        return jsonify(error={"Conflict": f"A cafe named '{data['name']}' already exists."}), 409

    # Validate coffee_price format: must be $X.XX (e.g. $2.80, $3, $12.50) or empty
    coffee_price = data.get("coffee_price", "").strip()
    if coffee_price and not re.match(r"^\$\d+(\.\d{1,2})?$", coffee_price):
        return jsonify(error={"Bad Request": "Coffee price must be in $ format (e.g. $2.80)."}), 400

    # Validate seats format: must be a number (50) or range (20-30) or empty
    seats = data.get("seats", "").strip()
    if seats and not re.match(r"^\d+(-\d+)?$", seats):
        return jsonify(error={"Bad Request": "Seats must be a number (e.g. 50) or range (e.g. 20-30)."}), 400

    new_cafe = Cafe(
        name=data["name"],
        map_url=data["map_url"],
        img_url=data["img_url"],
        location=data["location"],
        has_sockets=data.get("has_sockets", False),
        has_toilet=data.get("has_toilet", False),
        has_wifi=data.get("has_wifi", False),
        can_take_calls=data.get("can_take_calls", False),
        seats=data.get("seats", ""),
        coffee_price=data.get("coffee_price", ""),
    )
    db.session.add(new_cafe)
    db.session.commit()

    return jsonify(response={"success": f"'{new_cafe.name}' was added successfully."}, cafe=new_cafe.to_dict()), 201


# ── API: UPDATE Endpoint ──────────────────────────────────────────────────────

@app.route("/api/update-price/<int:cafe_id>", methods=["PATCH"])
def api_update_price(cafe_id):
    """
    PATCH /api/update-price/<cafe_id>?new_price=$3.00
    Updates the coffee price for a specific café.
    """
    new_price = request.args.get("new_price")

    if not new_price:
        return jsonify(error={"Bad Request": "Missing 'new_price' query parameter."}), 400

    # Validate price format: must be $X.XX (e.g. $2.80, $3, $12.50)
    if not re.match(r"^\$\d+(\.\d{1,2})?$", new_price.strip()):
        return jsonify(error={"Bad Request": "Price must be in $ format (e.g. $2.80)."}), 400

    cafe = db.session.get(Cafe, cafe_id)
    if not cafe:
        return jsonify(error={"Not Found": f"No café found with id {cafe_id}."}), 404

    old_price = cafe.coffee_price
    cafe.coffee_price = new_price
    db.session.commit()

    return jsonify(response={
        "success": f"Price for '{cafe.name}' updated from {old_price} to {new_price}."
    }), 200


# ── API: DELETE Endpoints ─────────────────────────────────────────────────────

@app.route("/api/delete/<int:cafe_id>", methods=["DELETE"])
def api_delete_cafe(cafe_id):
    """
    DELETE /api/delete/<cafe_id>
    Removes a café from the database by its ID.
    """
    cafe = db.session.get(Cafe, cafe_id)
    if not cafe:
        return jsonify(error={"Not Found": f"No café found with id {cafe_id}."}), 404

    name = cafe.name
    db.session.delete(cafe)
    db.session.commit()

    return jsonify(response={"success": f"'{name}' has been removed."}), 200


@app.route("/api/report-closed/<int:cafe_id>", methods=["DELETE"])
def api_report_closed(cafe_id):
    """
    DELETE /api/report-closed/<cafe_id>
    Reports a café as permanently closed and removes it from the database.
    Functionally identical to /api/delete but semantically different —
    this represents a user reporting that a real café has shut down.
    """
    cafe = db.session.get(Cafe, cafe_id)
    if not cafe:
        return jsonify(error={"Not Found": f"No café found with id {cafe_id}."}), 404

    name = cafe.name
    db.session.delete(cafe)
    db.session.commit()

    return jsonify(response={"success": f"'{name}' has been reported as closed and removed."}), 200


# ── Run ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=5001)
