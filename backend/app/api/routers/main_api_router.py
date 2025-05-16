"""
Main API router that aggregates all other specific API routers.

This router is included by the main FastAPI application.
"""
from fastapi import APIRouter

from . import todos # Import the todos router module

main_api_router = APIRouter(
    prefix="/api/v1" # Optional: common prefix for all v1 APIs
)

main_api_router.include_router(todos.router, tags=["Todos"])
# Add other routers here in the future:
# from . import users
# main_api_router.include_router(users.router, tags=["Users"]) 