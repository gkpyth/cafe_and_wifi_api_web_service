# Jacksonville Café & Wifi

A RESTful API and web application for discovering the best cafés to work remotely in Jacksonville, FL — with great coffee, wifi, and power sockets. Built with Python, Flask, and SQLite.

## Features
- Full REST API with CRUD endpoints returning JSON
- Frontend website that consumes the API via JavaScript `fetch()` calls
- Search cafés by name
- Filter by neighborhood and amenities (wifi, sockets, calls)
- "Feeling Lucky" random café picker via `GET /api/random`
- Add café modal form with client + server-side validation (price format, seat format, duplicate detection)
- Delete café with confirmation dialog
- Update coffee price endpoint
- Report café closure endpoint
- API documentation page with endpoint reference, examples, and error codes
- Demo-safe database — primary DB resets the working copy on every app launch
- Toast notifications for success/error feedback
- Responsive card-based design

## Requirements
- Python 3
- Flask
- Flask-SQLAlchemy

## Installation
```
pip install -r requirements.txt
```

## How to Run
```
python app.py
```
The app runs at `http://localhost:5001`. Visit `/api/docs` for the API documentation.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cafes` | All cafés (optional `?location=` filter) |
| `GET` | `/api/random` | Random café |
| `POST` | `/api/add` | Add a café (JSON body) |
| `PATCH` | `/api/update-price/<id>` | Update coffee price (`?new_price=$3.00`) |
| `DELETE` | `/api/delete/<id>` | Remove a café |
| `DELETE` | `/api/report-closed/<id>` | Report a café as closed |

Full documentation with request/response examples available at `/api/docs` when the app is running.

## Project Structure
```
cafe-wifi/
├── app.py                 # Entry point — API endpoints, page routes, DB reset
├── cafes_primary.db       # Original database (never modified)
├── requirements.txt
├── instance/
│   └── cafes.db           # Working copy (auto-generated on startup)
├── templates/
│   ├── index.html         # Café finder (static shell, JS fetches data)
│   └── api_docs.html      # API documentation page
└── static/
    ├── style.css          # Café finder styles
    ├── docs.css           # API docs styles
    └── script.js          # API calls, DOM rendering, filtering
```

## Database
The app uses a primary/working copy pattern. `cafes_primary.db` is the original dataset and is never modified. On every app launch, it is copied to `instance/cafes.db`, which all API operations hit. This means all additions, deletions, and updates are real during a session but reset on restart — making it safe for public demos.

## Limitations
- Database resets on every restart (by design for demo safety)
- No authentication or rate limiting on API endpoints
- Image URLs must be externally hosted (no file upload)
- Keyboard/desktop only (no mobile-optimized input)

## Author
Ghaleb Khadra