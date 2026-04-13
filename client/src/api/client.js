const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export async function apiFetch(path, getToken, options = {}) {
  const token = await getToken()

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Request failed')
  }

  return res.json()
}
