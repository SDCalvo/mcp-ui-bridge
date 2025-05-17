import React, { useState } from "react";
import { useCreateTodo } from "../hooks/useTodos";

const TodoForm: React.FC = () => {
  const [content, setContent] = useState("");
  const createTodoMutation = useCreateTodo();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) return; // Basic validation: do not add empty todos
    createTodoMutation.mutate({ content });
    setContent(""); // Clear input after submission
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What needs to be done?"
        className="flex-grow p-3 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-800 dark:text-slate-50 transition-colors"
        data-mcp-interactive-element="input-text"
      />
      <button
        type="submit"
        disabled={createTodoMutation.isPending}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        data-mcp-interactive-element="add-todo-button"
      >
        {createTodoMutation.isPending ? "Adding..." : "Add Todo"}
      </button>
    </form>
  );
};

export default TodoForm;
