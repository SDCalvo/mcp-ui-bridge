"""
Defines the SQLModel table for Todo items and Pydantic schemas for API interaction.
"""
import os
from typing import Optional
from sqlmodel import Field, SQLModel, create_engine
from pydantic import BaseModel

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///../test.db")
engine = create_engine(DATABASE_URL, echo=True, connect_args={"check_same_thread": False})

def create_db_and_tables():
    """Creates all database tables defined by SQLModel metadata."""
    SQLModel.metadata.create_all(engine)

class Todo(SQLModel, table=True):
    """Represents a Todo item in the database."""
    id: Optional[int] = Field(default=None, primary_key=True)
    content: str = Field(index=True)
    is_completed: bool = Field(default=False)

class TodoBase(BaseModel):
    """Base schema for a Todo item, containing common fields."""
    content: str
    is_completed: Optional[bool] = False

class TodoCreate(TodoBase):
    """Schema for creating a new Todo item."""

class TodoUpdate(BaseModel):
    """Schema for updating an existing Todo item. All fields are optional."""
    content: Optional[str] = None
    is_completed: Optional[bool] = None

class TodoRead(TodoBase):
    """Schema for reading a Todo item, including its ID."""
    id: int

    class Config:
        """Config for Pydantic model."""
        from_attributes = True