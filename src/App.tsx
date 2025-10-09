import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BurnUpload } from './components/BurnUpload';
import { BurnViewer } from './components/BurnViewer';
import { FeedbackForm } from './components/FeedbackForm';
import { Footer } from './components/Footer';
import { ToastProvider } from './components/ToastContainer';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import './App.css';

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/" element={<BurnUpload />} />
            <Route path="/d/:burnId" element={<BurnViewer />} />
            <Route path="/feedback" element={<FeedbackForm />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
          <Footer />
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
