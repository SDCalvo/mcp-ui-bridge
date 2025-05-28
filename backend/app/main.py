from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from contextlib import asynccontextmanager
import logging

from app.api.models.todo import create_db_and_tables
from app.api.routers.main_api_router import main_api_router # Adjusted import path

# Load environment variables from .env file
# Make sure your .env file is in the 'backend' directory (where Pipfile is)
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Actions to perform on startup
    logger.info("Application startup - Creating database and tables if they don't exist.")
    create_db_and_tables() 
    yield
    # Actions to perform on shutdown (if any)
    logger.info("Application shutdown.")

app = FastAPI(
    title="My MCP App Backend",
    description="This is the backend for our application that will be controlled by an MCP CLI.",
    version="0.1.0",
    lifespan=lifespan
)

# CORS Middleware Configuration
# Define allowed origins. For development, this would typically be your frontend's address.
# For production, you should restrict this to your frontend's actual domain.
origins = [
    "http://localhost:5173", # Vite default dev server
    "http://127.0.0.1:5173", # Also common for Vite dev server
    # Add other origins if needed, e.g., your production frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Allows specific origins
    # allow_origins=["*"], # Alternatively, allow all origins (less secure for production)
    allow_credentials=True, # Allows cookies to be included in requests
    allow_methods=["*"],    # Allows all standard HTTP methods
    allow_headers=["*"],    # Allows all headers
)

# Include the main API router
app.include_router(main_api_router)

@app.get("/") # Root path for basic health check or welcome message
async def root():
    return {"message": "Welcome to the My MCP App FastAPI backend!"}

# To run this app directly using uvicorn for testing:
# Ensure you are in the 'backend' directory in your terminal
# Then run: pipenv run uvicorn app.main:app --reload 