import React from "react";
import { useGetTodos } from "../hooks/useTodos";
import TodoForm from "../components/TodoForm";
import TodoList from "../components/TodoList";
import AttributeTest from "../components/AttributeTest";

const TodoPage: React.FC = () => {
  const { data: todos, isLoading, isError, error } = useGetTodos();

  return (
    <div className="w-full mx-auto p-6 sm:p-8 lg:p-12 max-w-2xl bg-slate-100 dark:bg-slate-800 shadow-xl rounded-lg">
      <header className="text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          My Todo List
        </h1>
      </header>

      <TodoForm />

      {isLoading && (
        <div className="text-center text-slate-500 dark:text-slate-400 py-8">
          <p className="text-lg">Loading your todos...</p>
          {/* Optional: Add a spinner component here */}
        </div>
      )}

      {isError && (
        <div
          className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded-lg relative mb-6"
          role="alert"
        >
          <strong className="font-bold">Oops! </strong>
          <span className="block sm:inline">
            Error fetching todos: {error?.message || "Unknown error"}
          </span>
        </div>
      )}

      {!isLoading && !isError && <TodoList todos={todos} />}

      <div
        data-mcp-region="mcp-attribute-test-section"
        className="mt-12 pt-8 border-t border-slate-300 dark:border-slate-700"
      >
        <AttributeTest />
      </div>
    </div>
  );
};

export default TodoPage;
