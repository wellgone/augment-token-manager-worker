/**
 * API utility functions for authenticated requests
 */

/**
 * Get authorization headers with current session token
 */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

/**
 * Make an authenticated GET request
 */
export async function apiGet(url: string): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    headers: getAuthHeaders()
  })
}

/**
 * Make an authenticated POST request
 */
export async function apiPost(url: string, data?: any): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined
  })
}

/**
 * Make an authenticated PUT request
 */
export async function apiPut(url: string, data?: any): Promise<Response> {
  return fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined
  })
}

/**
 * Make an authenticated DELETE request
 */
export async function apiDelete(url: string): Promise<Response> {
  return fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
}

/**
 * Make an authenticated PATCH request
 */
export async function apiPatch(url: string, data?: any): Promise<Response> {
  return fetch(url, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: data ? JSON.stringify(data) : undefined
  })
}
