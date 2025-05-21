import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import TodoPage from "./pages/TodoPage";
import TestFeaturesPage from "./pages/TestFeaturesPage";
import UserProfilePage from "./pages/UserProfilePage";
import Navbar from "./components/Navbar";

const App: React.FC = () => {
  return (
    <Router>
      <div className="d-flex flex-column min-vh-100">
        <Navbar />
        <main className="container flex-grow-1 py-4">
          <Routes>
            <Route path="/" element={<TodoPage />} />
            <Route path="/test-features" element={<TestFeaturesPage />} />
            <Route path="/profile" element={<UserProfilePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default App;
