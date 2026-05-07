# EcoSort / CarbonCraft

Public frontend (GitHub Pages):
- https://mbelsabah.github.io/Eco-Sort/

Backend (Render):
- https://eco-sort-svvs.onrender.com

## Required Render Environment Variables

- OPENAI_API_KEY
- MANAGEMENT_ID
- MANAGEMENT_KEY
- SCANNER_USERNAME
- SCANNER_PASSWORD
- SCANNER_ACCESS_TOKEN

## Access Model

- Residents can register with name + house number and access the dashboard/demo.
- AI scanner features require scanner credentials:
  - Item Scanner (`/classify-image`)
  - Bag scanner endpoints (`/check-bag` and `/api/bag/submit`)
- Management dashboard uses separate management credentials.

Do not commit secret values.
