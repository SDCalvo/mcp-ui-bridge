import React from "react";
import type { Todo } from "../api/todoApi"; // Type-only import
import TodoItem from "./TodoItem";

interface TodoListProps {
  todos: Todo[] | undefined;
}

const TodoList: React.FC<TodoListProps> = ({ todos }) => {
  if (!todos || todos.length === 0) {
    return (
      <p className="text-center text-slate-500 dark:text-slate-400 py-8">
        No todos yet. Add one above!
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-display-container="todo-list">
      {todos.map((todo) => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
};

export default TodoList;
