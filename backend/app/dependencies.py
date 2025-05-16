"""
Provides dependencies for the FastAPI application, such as database sessions and service instances.
"""
from fastapi import Depends
from sqlmodel import Session
from app.api.models.todo import engine
from app.api.services.todo_crud_service import TodoCRUDService

def get_db_session():
    """FastAPI dependency that provides a database session.
    
    Ensures the session is created and closed properly for each request.
    """
    with Session(engine) as session:
        yield session

def get_todo_service(db_session: Session = Depends(get_db_session)) -> TodoCRUDService:
    """FastAPI dependency that provides a TodoCRUDService instance with an active database session."""
    return TodoCRUDService(db_session=db_session)