# EcoSort

EcoSort is an AI-assisted waste sorting project with a Flask backend and a static frontend.

## Live Demo (GitHub Pages)

Frontend demo: [https://mbelsabah.github.io/Eco-Sort/](https://mbelsabah.github.io/Eco-Sort/)

GitHub Pages serves only static files. It does **not** run Flask or OpenAI endpoints.

## Project Structure

- `app.py`: Flask backend API and static serving.
- `index.html`: Root GitHub Pages entry page (full EcoSort UI).
- `static/index.html`: Frontend page used by Flask/local setup.
- `static/styles.css`, `static/app.js`: Frontend assets.

## Backend Requirement for AI Features

AI scanner features call the Flask backend and require deployment.

In `static/app.js`:

```js
const API_BASE_URL = "";
```

- Empty value = demo mode on GitHub Pages (friendly backend-required message).
- Set to your backend URL after deployment to enable API features.

## Local Run (Flask)

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set environment variable:

```bash
export OPENAI_API_KEY="your_api_key_here"
```

3. Run app:

```bash
python app.py
```

4. Open:

- [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

## Render Deployment (Backend)

- Build command:

```bash
pip install -r requirements.txt
```

- Start command:

```bash
gunicorn app:app
```

- Required environment variable:
  - `OPENAI_API_KEY`

- After backend is live, update `static/app.js`:

```js
const API_BASE_URL = "https://YOUR-RENDER-URL.onrender.com";
```

## Frontend + Backend Deployment Notes

- Use GitHub Pages for the frontend demo: [https://mbelsabah.github.io/Eco-Sort/](https://mbelsabah.github.io/Eco-Sort/)
- Deploy Flask backend separately (Render/Replit/Railway).
- Keep secrets in environment variables only.
