import React from "react";
import type { Todo } from "../api/todoApi";
import { useUpdateTodo, useDeleteTodo } from "../hooks/useTodos";

interface TodoItemProps {
  todo: Todo;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo }) => {
  const updateTodoMutation = useUpdateTodo();
  const deleteTodoMutation = useDeleteTodo();

  const handleToggleComplete = () => {
    updateTodoMutation.mutate({
      id: todo.id,
      data: { is_completed: !todo.is_completed },
    });
  };

  const handleDelete = () => {
    deleteTodoMutation.mutate(todo.id);
  };

  let itemClassName =
    "list-group-item d-flex justify-content-between align-items-center";
  if (todo.is_completed) {
    itemClassName +=
      " list-group-item-success text-decoration-line-through text-muted";
  }

  return (
    <li className={itemClassName} data-mcp-display-item-id={String(todo.id)}>
      <div className="form-check">
        <input
          type="checkbox"
          checked={todo.is_completed}
          onChange={handleToggleComplete}
          disabled={updateTodoMutation.isPending}
          className="form-check-input me-2"
          id={`todo-check-${todo.id}`}
          data-mcp-interactive-element={`todo-checkbox-${todo.id}`}
          data-mcp-element-label="Toggle todo completion"
          data-mcp-purpose="toggle-todo-completion"
          data-mcp-updates-container="todo-list"
          data-mcp-disabled={updateTodoMutation.isPending.toString()}
        />
        <label
          className="form-check-label"
          htmlFor={`todo-check-${todo.id}`}
          data-mcp-display-item-text="todo-content"
          data-mcp-field="text"
        >
          {todo.content}
        </label>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleteTodoMutation.isPending}
        className="btn btn-danger btn-sm"
        data-mcp-interactive-element={`todo-delete-button-${todo.id}`}
        data-mcp-element-label="Delete todo item"
        data-mcp-purpose="delete-todo-item"
        data-mcp-updates-container="todo-list"
        data-mcp-disabled={deleteTodoMutation.isPending.toString()}
      >
        {deleteTodoMutation.isPending ? "..." : "Delete"}
      </button>
    </li>
  );
};

export default TodoItem;
