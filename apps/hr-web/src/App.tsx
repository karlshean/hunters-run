import React, { useState } from 'react'

interface ApiResponse {
  status?: number;
  data?: any;
  error?: string;
}

function App() {
  const [result, setResult] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const checkApiHealth = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('http://localhost:3000/api/health')
      const data = await response.json()
      
      setResult({
        status: response.status,
        data: data
      })
    } catch (error) {
      setResult({
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setLoading(false)
    }
  }

  const checkApiReady = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('http://localhost:3000/api/ready')
      const data = await response.json()
      
      setResult({
        status: response.status,
        data: data
      })
    } catch (error) {
      setResult({
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setLoading(false)
    }
  }

  const checkLookups = async () => {
    setLoading(true)
    setResult(null)
    
    try {
      const response = await fetch('http://localhost:3000/api/lookups/units', {
        headers: {
          'x-org-id': '00000000-0000-0000-0000-000000000001'
        }
      })
      const data = await response.json()
      
      setResult({
        status: response.status,
        data: data
      })
    } catch (error) {
      setResult({
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    } finally {
      setLoading(false)
    }
  }

  const openFullDemo = () => {
    window.open('/demo', '_blank')
  }

  return (
    <div className="container">
      <h1>Hunters Run Web</h1>
      <div className="status">✅ Web OK (Port 3001)</div>
      
      <p>This minimal web app demonstrates API connectivity. The API should be running on port 3000.</p>
      
      <div>
        <button onClick={checkApiHealth} disabled={loading}>
          Check API Health
        </button>
        
        <button onClick={checkApiReady} disabled={loading}>
          Check API Ready
        </button>
        
        <button onClick={checkLookups} disabled={loading}>
          Test Lookups (with org header)
        </button>
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
        <p><strong>API:</strong> http://localhost:3000</p>
        <p><strong>Web:</strong> http://localhost:3001 (this page)</p>
      </div>
      
      {loading && (
        <div className="result">
          Loading...
        </div>
      )}
      
      {result && !loading && (
        <div className={`result ${result.error ? 'error' : 'success'}`}>
          {result.error ? (
            <div>
              <strong>❌ Error:</strong><br />
              <pre>{result.error}</pre>
            </div>
          ) : (
            <div>
              <strong>✅ Success (Status {result.status}):</strong><br />
              <pre>{JSON.stringify(result.data, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App