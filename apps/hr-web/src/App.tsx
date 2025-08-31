import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import WorkOrdersList from './components/WorkOrders/WorkOrdersList'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/work-orders" element={<WorkOrdersList />} />
        <Route path="/" element={<Navigate to="/work-orders" replace />} />
      </Routes>
    </div>
  )
}

export default App