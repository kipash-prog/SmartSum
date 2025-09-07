
# SmartSum

SmartSum is an AI-powered web application that generates concise, high-quality summaries from user-provided text or web articles. Built with a Django REST backend and a modern React frontend, SmartSum leverages Google Gemini AI for advanced natural language processing.

## Features

- Summarize any text or public web article in seconds
- Choose summary length: short, medium, or long
- Secure user authentication (JWT-based)
- Clean, responsive UI with copy-to-clipboard and reduction stats
- Handles content extraction from most web pages

## Tech Stack

- **Backend:** Django, Django REST Framework, Google Gemini AI
- **Frontend:** React, Axios, React Router
- **Database:** SQLite (default, easy to switch)

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 16+
- Google Gemini API key

### Backend Setup

1. Navigate to the backend directory:
	```sh
	cd backend
	```
2. Install dependencies:
	```sh
	pip install -r requirements.txt
	```
3. Set your Gemini API key in `backend/.env` or `settings.py`:
	```env
	GEMINI_API_KEY=your_api_key_here
	```
4. Run migrations and start the server:
	```sh
	python manage.py migrate
	python manage.py runserver
	```

### Frontend Setup

1. Navigate to the frontend directory:
	```sh
	cd frontend
	```
2. Install dependencies:
	```sh
	npm install
	```
3. Start the development server:
	```sh
	npm start
	```

## Usage

1. Register for an account and log in.
2. Enter text or a URL to summarize.
3. Choose your summary length and submit.
4. Copy or review your summary and stats.

## API Endpoints

- `POST /api/register/` — Register a new user
- `POST /api/summarize/` — Summarize text (JWT required)
- `POST /api/fetch-url-content/` — Extract content from a URL (JWT required)

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

## License

MIT License
