import axios from 'axios'
import { API_URL, IS_DEMO } from '@/config'
import { demoCall } from './demo'

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

const http = axios.create({ baseURL: API_URL, timeout: 20000 })

/**
 * Single entry point to the backend.
 * Apps Script web apps do not support custom headers or CORS preflight, so we POST a
 * JSON string as text/plain and send the session token inside the body.
 * Every response is normalised to { ok, data } | { ok:false, error:{code,message} }.
 */
export async function api(action, payload = {}, token = null) {
  let res
  if (IS_DEMO) {
    res = await demoCall(action, payload, token)
  } else {
    if (!API_URL) throw new ApiError('CONFIG', 'VITE_API_URL is not configured.')
    try {
      const r = await http.post('', JSON.stringify({ action, token, payload }), {
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      })
      res = r.data
    } catch (e) {
      throw new ApiError('NETWORK', 'Cannot reach the server. Check your connection and try again.', e.response?.status)
    }
  }
  if (!res || typeof res !== 'object') throw new ApiError('BAD_RESPONSE', 'Unexpected server response.')
  if (!res.ok) throw new ApiError(res.error?.code || 'ERROR', res.error?.message || 'Request failed.')
  return res.data
}
