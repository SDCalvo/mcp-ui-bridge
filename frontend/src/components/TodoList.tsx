import React from "react";
import type { Todo } from "../api/todoApi"; // Type-only import
import TodoItem from "./TodoItem";

interface TodoListProps {
  todos: Todo[] | undefined;
}

const TodoList: React.FC<TodoListProps> = ({ todos }) => {
  if (!todos || todos.length === 0) {
    return (
      <p className="list-group-item text-muted text-center py-3">
        No todos yet. Add one above!
      </p>
    );
  }

  return (
    <ul
      className="list-group shadow-sm"
      data-mcp-display-container="todo-list"
      data-mcp-region="active-todos"
      data-mcp-purpose="display-todo-items"
    >
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
};

export default TodoList;
