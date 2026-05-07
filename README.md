# EcoSort

EcoSort is an AI-assisted waste sorting project with a Flask backend and a static frontend.

## Live Frontend

- GitHub Pages: [https://mbelsabah.github.io/Eco-Sort/](https://mbelsabah.github.io/Eco-Sort/)

GitHub Pages serves static files only. AI features require the backend.

## Features

- Item Scanner: public (uses `/classify-image`).
- Bag Quality Checker: protected login (uses `/login` + `/check-bag` with bearer token).

## Local Run

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set environment variables:

```bash
export OPENAI_API_KEY="your_openai_key"
export BAG_CHECKER_USERNAME="your_username"
export BAG_CHECKER_PASSWORD="your_password"
export BAG_CHECKER_ACCESS_TOKEN="your_generated_token"
```

3. Run:

```bash
python app.py
```

4. Open:

- [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

## Render Deployment

- Build command:

```bash
pip install -r requirements.txt
```

- Start command:

```bash
gunicorn app:app
```

- Required Render environment variables:
  - `OPENAI_API_KEY`
  - `BAG_CHECKER_USERNAME`
  - `BAG_CHECKER_PASSWORD`
  - `BAG_CHECKER_ACCESS_TOKEN`

## Frontend API Base URL

In `static/app.js`, set:

```js
const API_BASE_URL = "https://eco-sort-svvs.onrender.com";
```

## Security Notes

- Bag checker credentials are configured only in backend environment variables.
- Do not commit secrets to GitHub.
