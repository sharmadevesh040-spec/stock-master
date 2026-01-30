
export type Category = 'Electronics' | 'Clothing' | 'Food' | 'Office' | 'Others';

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: Category;
  price: number;
  stock: number;
  minStockLevel: number;
  expiryDate?: string;
  supplierId: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
}

export interface Transaction {
  id: string;
  productId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  price: number;
  timestamp: string;
  note?: string;
}

export interface DashboardStats {
  totalProducts: number;
  totalStockValue: number;
  lowStockItems: number;
  totalRevenue: number;
}

export enum AppScreen {
  SPLASH = 'SPLASH',
  AUTH = 'AUTH',
  REGISTRATION = 'REGISTRATION',
  DASHBOARD = 'DASHBOARD',
  INVENTORY = 'INVENTORY',
  ADD_PRODUCT = 'ADD_PRODUCT',
  SUPPLIERS = 'SUPPLIERS',
  SALES = 'SALES',
  REPORTS = 'REPORTS'
}
