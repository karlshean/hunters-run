// API client with x-org-id injection and error handling

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000/api';
const ORG_ID = process.env.NEXT_PUBLIC_ORG_ID || '00000000-0000-0000-0000-000000000001';

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');
  
  const body = isJson ? await response.json() : await response.text();
  
  if (!response.ok) {
    const message = 
      typeof body === 'object' && body.message ? body.message :
      typeof body === 'string' ? body :
      `Request failed with status ${response.status}`;
    
    throw new ApiError(response.status, message, body);
  }
  
  return body;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  
  const headers = {
    'x-org-id': ORG_ID,
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Network error', error);
  }
}

// Convenience methods
export const api = {
  get: <T = any>(path: string) => apiRequest<T>(path, { method: 'GET' }),
  
  post: <T = any>(path: string, data?: any) => 
    apiRequest<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  patch: <T = any>(path: string, data?: any) =>
    apiRequest<T>(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
  
  delete: <T = any>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};