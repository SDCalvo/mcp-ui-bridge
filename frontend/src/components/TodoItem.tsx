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

  return (
    <li
      className={`flex items-center justify-between p-4 mb-2 rounded-lg shadow transition-colors duration-200 ease-in-out 
                   ${
                     todo.is_completed
                       ? "bg-green-100 dark:bg-green-900"
                       : "bg-white dark:bg-slate-800"
                   }
                   border border-slate-200 dark:border-slate-700`}
      data-mcp-display-item-id={String(todo.id)}
    >
      <div className="flex items-center">
        <input
          type="checkbox"
          checked={todo.is_completed}
          onChange={handleToggleComplete}
          disabled={updateTodoMutation.isPending}
          className="form-checkbox h-5 w-5 text-blue-600 dark:text-blue-400 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:focus:ring-blue-400 dark:bg-slate-700 transition duration-150 ease-in-out mr-3"
          data-mcp-interactive-element={`todo-checkbox-${todo.id}`}
          data-mcp-element-label="Toggle todo completion"
          data-mcp-purpose="toggle-todo-completion"
          data-mcp-updates-container="todo-list"
          data-mcp-disabled={updateTodoMutation.isPending.toString()}
        />
        <span
          className={`text-lg ${
            todo.is_completed
              ? "line-through text-slate-500 dark:text-slate-400"
              : "text-slate-800 dark:text-slate-100"
          }`}
          data-mcp-display-item-text="todo-content"
          data-mcp-field="text"
        >
          {todo.content}
        </span>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleteTodoMutation.isPending}
        className="px-3 py-1 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
