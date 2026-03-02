# Plex Request

A serverless media request application built on AWS that allows users to search for movies and TV shows and request they be added to a Plex media server. Approved requests are automatically sent to Radarr (movies) or Sonarr (TV shows) for download and processing.

## Overview

Plex Request provides a self-hosted, Overseerr/LunaSea-style workflow where authenticated users can browse and request media, while admins manage an approval queue and track request lifecycle.

### How It Works

1. **User searches** for a movie or TV show (powered by TMDB API)
2. **User submits a request** which enters a queue with status `requested`
3. **Admin reviews and approves** the request
4. **On approval**, the app calls the Radarr or Sonarr API to add the media and trigger a search
5. **Admin updates status** as the media progresses: `requested` -> `approved` -> `downloading` -> `complete`
6. **Users can track** their requests and see current status at any time

### Request Statuses

| Status | Description |
|--------|-------------|
| `requested` | User has submitted the request, awaiting admin review |
| `approved` | Admin approved; sent to Radarr/Sonarr |
| `downloading` | Media is being downloaded |
| `complete` | Media is available on Plex |
| `rejected` | Admin denied the request |

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + TypeScript Lambda functions
- **Infrastructure**: AWS (API Gateway, Lambda, DynamoDB, Cognito, S3, CloudFront)
- **IaC**: Serverless Framework
- **External APIs**: TMDB (search), Radarr v3 (movies), Sonarr v3 (TV shows)
- **Auth**: AWS Cognito with user self-registration and admin role

## Features

### User Features
- Search movies and TV shows via TMDB
- Submit media requests
- View personal request history with status tracking
- User registration and login via Cognito

### Admin Features
- View all pending requests in an approval queue
- Approve or reject requests
- Update request status (downloading, complete)
- Manage Radarr/Sonarr connection settings
- View all users and their request history

## Architecture

```
User/Admin (Browser)
       |
   CloudFront + S3 (React SPA)
       |
   API Gateway (REST)
       |
   Lambda Authorizer (Cognito JWT)
       |
   Lambda Functions
       |
   ┌───┴───┐
   DynamoDB  External APIs
             ├── TMDB (search)
             ├── Radarr (movies)
             └── Sonarr (TV shows)
```

## Project Structure

```
plex_request/
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── services/          # API client
│   │   ├── types/             # TypeScript interfaces
│   │   └── context/           # Auth context
│   └── package.json
├── backend/
│   ├── functions/
│   │   ├── auth/              # Cognito authorizer
│   │   ├── search/            # TMDB search proxy
│   │   ├── requests/          # Request CRUD + status management
│   │   ├── admin/             # Admin operations
│   │   └── integrations/      # Radarr/Sonarr API calls
│   ├── lib/                   # Shared utilities
│   ├── serverless.yml         # Infrastructure as code
│   └── package.json
├── docs/
│   └── plans/
│       └── implementation-plan.md
└── README.md
```

## Getting Started

_Setup instructions will be added as the project is built._

## License

Private - All rights reserved.
