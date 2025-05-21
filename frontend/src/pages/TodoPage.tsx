import React from "react";
import { useGetTodos } from "../hooks/useTodos";
import TodoForm from "../components/TodoForm";
import TodoList from "../components/TodoList";
import AttributeTest from "../components/AttributeTest";

const TodoPage: React.FC = () => {
  const { data: todos, isLoading, isError, error } = useGetTodos();

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <header className="text-center mb-4">
          <h1 className="display-5">My Todo List</h1>
        </header>

        <TodoForm />

        {isLoading && (
          <div className="text-center text-muted py-3">
            <p className="">Loading your todos...</p>
            {/* Optional: Add a spinner component here */}
          </div>
        )}

        {isError && (
          <div className="alert alert-danger" role="alert">
            <strong>Oops! </strong>
            <span className="">
              Error fetching todos: {error?.message || "Unknown error"}
            </span>
          </div>
        )}

        {!isLoading && !isError && <TodoList todos={todos} />}

        <div
          data-mcp-region="mcp-attribute-test-section"
          className="mt-5 pt-4 border-top"
        >
          <AttributeTest />
        </div>
      </div>
    </div>
  );
};

export default TodoPage;
