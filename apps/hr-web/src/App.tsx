import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import WorkOrdersList from './components/WorkOrders/WorkOrdersList'
import DemoWorkOrderPhotos from './routes/DemoWorkOrderPhotos'
import SocialMediaDemo from './routes/SocialMediaDemo'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/work-orders" element={<WorkOrdersList />} />
        <Route path="/demo/photos" element={<DemoWorkOrderPhotos />} />
        <Route path="/demo/work-orders/:workOrderId/photos" element={<DemoWorkOrderPhotos />} />
        <Route path="/demo/social" element={<SocialMediaDemo />} />
        <Route path="/" element={<Navigate to="/work-orders" replace />} />
      </Routes>
    </div>
  )
}

export default App