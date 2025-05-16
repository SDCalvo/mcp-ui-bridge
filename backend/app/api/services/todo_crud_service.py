"""
Service class for handling CRUD operations for Todo items.
"""
from typing import List, Optional

from sqlmodel import Session, select

from app.api.models.todo import Todo, TodoCreate, TodoUpdate

class TodoCRUDService:
    """Service class to manage Todo items with an injected database session."""
    def __init__(self, db_session: Session):
        """Initializes the service with a database session."""
        self.db_session = db_session

    def create_todo_item(self, todo_create: TodoCreate) -> Todo:
        """Creates a new Todo item in the database."""
        db_todo = Todo.model_validate(todo_create)
        self.db_session.add(db_todo)
        self.db_session.commit()
        self.db_session.refresh(db_todo)
        return db_todo

    def get_todo_item_by_id(self, todo_id: int) -> Optional[Todo]:
        """Retrieves a single Todo item by its ID."""
        todo = self.db_session.get(Todo, todo_id)
        return todo

    def get_all_todo_items(self, skip: int = 0, limit: int = 100) -> List[Todo]:
        """Retrieves a list of Todo items, with optional pagination."""
        statement = select(Todo).offset(skip).limit(limit)
        todos = self.db_session.exec(statement).all()
        return todos

    def update_todo_item(self, todo_id: int, todo_update: TodoUpdate) -> Optional[Todo]:
        """Updates an existing Todo item in the database."""
        db_todo = self.db_session.get(Todo, todo_id)
        if not db_todo:
            return None
        
        update_data = todo_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_todo, key, value)
        
        self.db_session.add(db_todo)
        self.db_session.commit()
        self.db_session.refresh(db_todo)
        return db_todo

    def delete_todo_item(self, todo_id: int) -> Optional[Todo]:
        """Deletes a Todo item from the database by its ID."""
        todo = self.db_session.get(Todo, todo_id)
        if not todo:
            return None
        self.db_session.delete(todo)
        self.db_session.commit()
        return todo 