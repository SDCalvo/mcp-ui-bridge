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
    <form
      onSubmit={handleSubmit}
      className="mb-3"
      data-mcp-region="todo-form-region"
      data-mcp-purpose="add-new-todo"
    >
      <div className="input-group">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What needs to be done?"
          className="form-control"
          data-mcp-interactive-element="new-todo-input"
          data-mcp-element-label="New todo description"
          data-mcp-purpose="enter-todo-text"
          data-mcp-updates-container="todo-list"
        />
        <button
          type="submit"
          disabled={createTodoMutation.isPending}
          className="btn btn-primary"
          data-mcp-interactive-element="add-todo-button"
          data-mcp-element-label="Add Todo Button"
          data-mcp-purpose="submit-new-todo"
          data-mcp-controls="new-todo-input"
          data-mcp-updates-container="todo-list"
        >
          {createTodoMutation.isPending ? "Adding..." : "Add Todo"}
        </button>
      </div>
    </form>
  );
};

export default TodoForm;
