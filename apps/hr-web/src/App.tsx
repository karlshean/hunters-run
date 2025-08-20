import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TenantView } from './components/TenantView';
import { ManagerView } from './components/ManagerView';
import './styles.css';

function HealthCheck() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Hunters Run Web</h1>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-green-600 font-semibold mb-4">✅ Web OK (Port 3001)</div>
        <p className="text-gray-700 mb-4">
          This web app provides the complete maintenance workflow demo. 
          The API should be running on port 3000.
        </p>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>API:</strong> http://localhost:3000</p>
          <p><strong>Web:</strong> http://localhost:3001</p>
        </div>
        <div className="mt-6 space-x-4">
          <a 
            href="/tenant" 
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Tenant Portal
          </a>
          <a 
            href="/manager" 
            className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Manager Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HealthCheck />} />
          <Route path="/tenant" element={<TenantView />} />
          <Route path="/manager" element={<ManagerView />} />
          <Route path="/tech" element={<ManagerView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;