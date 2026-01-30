
import { Product, Transaction, Supplier } from './types';

const API_URL = 'https://a.biteai.fit/stockmaster_api.php';

export const apiService = {
  login: async (email: string, password: string): Promise<{id: string, email: string}> => {
    const res = await fetch(`${API_URL}?action=login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Login failed');
    }
    return res.json();
  },

  register: async (email: string, password: string): Promise<{id: string, email: string}> => {
    const res = await fetch(`${API_URL}?action=register`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Registration failed');
    }
    return res.json();
  },

  getProducts: async (userId: string): Promise<Product[]> => {
    const res = await fetch(`${API_URL}?action=getProducts&userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('API Error fetching products');
    return res.json();
  },

  addProduct: async (userId: string, product: Omit<Product, 'id' | 'createdAt'>): Promise<Product> => {
    const res = await fetch(`${API_URL}?action=addProduct`, {
      method: 'POST',
      body: JSON.stringify({ ...product, userId }),
    });
    if (!res.ok) throw new Error('API Error adding product');
    return res.json();
  },

  updateStock: async (userId: string, productId: string, type: 'IN' | 'OUT', quantity: number): Promise<any> => {
    const res = await fetch(`${API_URL}?action=updateStock`, {
      method: 'POST',
      body: JSON.stringify({ userId, productId, type, quantity }),
    });
    if (!res.ok) throw new Error('API Error updating stock');
    return res.json();
  },

  getTransactions: async (userId: string): Promise<Transaction[]> => {
    const res = await fetch(`${API_URL}?action=getTransactions&userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('API Error fetching transactions');
    return res.json();
  },

  getSuppliers: async (userId: string): Promise<Supplier[]> => {
    const res = await fetch(`${API_URL}?action=getSuppliers&userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error('API Error fetching suppliers');
    return res.json();
  }
};
