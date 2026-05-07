# EcoSort / CarbonCraft

EcoSort is an AI-assisted waste sorting demo for resident recycling/compost/landfill workflows. The app includes an open resident dashboard, protected AI scanner tools, and a separate management dashboard for review and feedback.

## Live Links

Public frontend (GitHub Pages):
- https://mbelsabah.github.io/Eco-Sort/

Backend (Render):
- https://eco-sort-svvs.onrender.com

## Access Model

- **Resident Access:** open demo access. Residents can enter a name and house number to view the dashboard.
- **AI Scanner Access:** protected. The Item Scanner and Bag Checker require scanner credentials because these tools use paid AI API calls.
- **Management Access:** protected separately with management credentials.

Need access to the AI scanner tools? Contact the project owner for scanner credentials.

Project owner/contact:
- Mohamed Elsabah
- GitHub: https://github.com/MBELSABAH

## Protected AI Features

Scanner credentials are required for:

- Item Scanner (`/classify-image`)
- Bag Checker (`/check-bag`)
- Resident bag submission scanner (`/api/bag/submit`)

The scanner login unlocks both Item Scanner and Bag Checker during the current browser session.

## Required Render Environment Variables

The backend requires these environment variables in Render:

- `OPENAI_API_KEY`
- `MANAGEMENT_ID`
- `MANAGEMENT_KEY`
- `SCANNER_USERNAME`
- `SCANNER_PASSWORD`
- `SCANNER_ACCESS_TOKEN`

Do not commit secret values to GitHub. Credentials and API keys should only be configured through Render environment variables.

## Deployment Notes

- GitHub Pages hosts the public frontend.
- Render hosts the Flask backend.
- Free Render services may spin down during inactivity, so the first scanner request after a pause can take longer.
- OpenAI API usage is billed separately from GitHub Pages and Render hosting.
