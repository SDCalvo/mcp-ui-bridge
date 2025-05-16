import React from "react";
import TodoPage from "./pages/TodoPage";
// import './App.css'; // We can remove or keep this if it has useful global styles not covered by index.css

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 py-8 sm:py-12">
      <TodoPage />
    </div>
  );
};

export default App;
