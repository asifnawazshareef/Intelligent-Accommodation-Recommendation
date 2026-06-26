import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ReviewSentimentTestPage from "./pages/ReviewSentimentTestPage.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/review-sentiment-test" replace />} />
        <Route path="/review-sentiment-test" element={<ReviewSentimentTestPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
