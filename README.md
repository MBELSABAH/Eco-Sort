# EcoSort

EcoSort is an AI-assisted waste sorting project with a Flask backend and a static frontend.

## Live Demo (GitHub Pages)

Frontend demo: [https://mbelsabah.github.io/Eco-Sort/](https://mbelsabah.github.io/Eco-Sort/)

GitHub Pages only serves static files. It does **not** run the Flask server or OpenAI-powered endpoints.

## Architecture

- `app.py`: Flask backend API and static serving for local/full deployment.
- `static/index.html`, `static/styles.css`, `static/app.js`: Frontend UI.
- Root `index.html`: GitHub Pages entry point that redirects to `static/index.html`.

## Backend Requirement for AI Features

The image classification and bag quality analysis features require a deployed Flask backend.

In `static/app.js`, configure:

```js
const API_BASE_URL = "";
```

- Keep it empty for GitHub Pages demo mode (UI works, API actions show a friendly backend-required message).
- Set it to your deployed backend URL (example: `https://your-backend.onrender.com`) to enable live API calls.

## Run Locally (Full App)

1. Install dependencies:

```bash
pip install flask openai
```

or with project tooling:

```bash
pip install -r requirements.txt
```

2. Set your OpenAI key:

```bash
export OPENAI_API_KEY="your_api_key_here"
```

3. Run Flask app:

```bash
python app.py
```

4. Open locally:

- [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

## Deployment Notes

- Use **GitHub Pages** for the static frontend demo.
- Deploy the Flask backend separately on services like **Render**, **Replit**, or **Railway**.
- After backend deployment, set `API_BASE_URL` in `static/app.js` to your backend URL.

## Security

- Do not commit API keys.
- Keep backend secrets in environment variables only.
