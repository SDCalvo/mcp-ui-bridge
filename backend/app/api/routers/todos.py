"""
API router for Todo items.

Defines CRUD endpoints for managing Todo tasks.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
# Session is not directly used here anymore, but kept if needed for other reasons
# from sqlmodel import Session 

from app.api.models.todo import TodoCreate, TodoRead, TodoUpdate # Schemas
from app.api.services.todo_crud_service import TodoCRUDService
from app.dependencies import get_todo_service # Updated import

router = APIRouter(
    prefix="/todos",
    tags=["Todos"],
    responses={404: {"description": "Not found"}},
)


@router.post("/", response_model=TodoRead, status_code=status.HTTP_201_CREATED)
def create_new_todo(
    *, 
    todo_in: TodoCreate, 
    service: TodoCRUDService = Depends(get_todo_service)
):
    """Create a new todo item.
    
    Args:
        todo_in: The todo item to create.
        service: Injected TodoCRUDService instance.
        
    Returns:
        The created todo item.
    """
    return service.create_todo_item(todo_create=todo_in)


@router.get("/", response_model=List[TodoRead])
def read_all_todos(
    skip: int = 0, 
    limit: int = 100, 
    service: TodoCRUDService = Depends(get_todo_service)
):
    """Retrieve all todo items with optional pagination.

    Args:
        skip: Number of items to skip.
        limit: Maximum number of items to return.
        service: Injected TodoCRUDService instance.
        
    Returns:
        A list of todo items.
    """
    return service.get_all_todo_items(skip=skip, limit=limit)


@router.get("/{todo_id}", response_model=TodoRead)
def read_single_todo(
    todo_id: int, 
    service: TodoCRUDService = Depends(get_todo_service)
):
    """Retrieve a single todo item by its ID.
    
    Args:
        todo_id: The ID of the todo item to retrieve.
        service: Injected TodoCRUDService instance.
        
    Raises:
        HTTPException: If the todo item is not found.
        
    Returns:
        The requested todo item.
    """
    db_todo = service.get_todo_item_by_id(todo_id=todo_id)
    if db_todo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return db_todo


@router.put("/{todo_id}", response_model=TodoRead)
def update_existing_todo(
    todo_id: int, 
    todo_in: TodoUpdate, 
    service: TodoCRUDService = Depends(get_todo_service)
):
    """Update an existing todo item by its ID.

    Args:
        todo_id: The ID of the todo item to update.
        todo_in: The new data for the todo item.
        service: Injected TodoCRUDService instance.
        
    Raises:
        HTTPException: If the todo item is not found.
        
    Returns:
        The updated todo item.
    """
    db_todo = service.update_todo_item(todo_id=todo_id, todo_update=todo_in)
    if db_todo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return db_todo


@router.delete("/{todo_id}", response_model=TodoRead)
def delete_existing_todo(
    todo_id: int, 
    service: TodoCRUDService = Depends(get_todo_service)
):
    """Delete a todo item by its ID.
    
    The deleted item is returned.

    Args:
        todo_id: The ID of the todo item to delete.
        service: Injected TodoCRUDService instance.

    Raises:
        HTTPException: If the todo item is not found.
        
    Returns:
        The deleted todo item.
    """
    deleted_todo = service.delete_todo_item(todo_id=todo_id)
    if deleted_todo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")
    return deleted_todo 