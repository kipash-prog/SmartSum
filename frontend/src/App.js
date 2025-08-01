import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SummarizePage from './pages/SummarizePage';
import PrivateRoute from './components/PrivateRoute';
import axios from "axios";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/summarize"
          element={
            <PrivateRoute>
              <SummarizePage />
            </PrivateRoute>
          }
        />
      </Routes>
    </Router>
  );


}

// Configure axios defaults
axios.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

axios.interceptors.response.use(response => response, error => {
  if (error.response?.status === 401) {
    localStorage.removeItem("token");
    window.location.href = '/login'; // Full page reload to clear state
  }
  return Promise.reject(error);
});



export default App;
