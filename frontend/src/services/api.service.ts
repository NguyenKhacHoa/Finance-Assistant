import toast from 'react-hot-toast';

const BASE_URL = 'http://localhost:3000';

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...rest } = options;
  
  const headers = new Headers(rest.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!(rest.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, { ...rest, headers });

    if (!response.ok) {
      // Tự động xử lý một số mã lỗi phổ biến
      if (response.status === 401) {
        toast.error('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        // window.location.href = '/login'; // Optional: Redirect
      } else if (response.status === 404) {
        toast.error('Không tìm thấy tài nguyên yêu cầu (404).');
      } else if (response.status === 500) {
        toast.error('Lỗi hệ thống từ Server (500).');
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.message || 'Có lỗi xảy ra khi kết nối server.');
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    if (error.message.includes('Failed to fetch')) {
      toast.error('Không thể kết nối đến Server. Vui lòng kiểm tra môi trường.', {
        duration: 5000,
        icon: '🚧',
      });
    }
    throw error;
  }
}

// Helper methods
export const api = {
  get: <T>(url: string, token?: string | null) => apiFetch<T>(url, { method: 'GET', token }),
  post: <T>(url: string, body: any, token?: string | null) => 
    apiFetch<T>(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body), token }),
  put: <T>(url: string, body: any, token?: string | null) => 
    apiFetch<T>(url, { method: 'PUT', body: JSON.stringify(body), token }),
  delete: <T>(url: string, token?: string | null) => apiFetch<T>(url, { method: 'DELETE', token }),
};
