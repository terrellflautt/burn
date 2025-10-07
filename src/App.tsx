import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BurnUpload } from './components/BurnUpload';
import { BurnViewer } from './components/BurnViewer';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route path="/" element={<BurnUpload />} />
          <Route path="/view/:burnId" element={<BurnViewer />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
