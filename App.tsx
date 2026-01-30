
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  Plus, 
  LogOut, 
  Bell, 
  Search,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  TrendingUp,
  BrainCircuit,
  X,
  ScanBarcode,
  Download,
  RefreshCw,
  Trash2,
  Minus,
  CheckCircle2,
  PackagePlus,
  Save,
  FileJson,
  User,
  ChevronDown,
  Cloud,
  CloudOff,
  Tag,
  DollarSign,
  Layers,
  PlusCircle,
  Mail,
  Lock,
  UserPlus,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_SUPPLIERS, 
  INITIAL_TRANSACTIONS 
} from './constants';
import { 
  AppScreen, 
  Product, 
  Transaction, 
  Supplier, 
  Category,
  DashboardStats
} from './types';
import { getInventoryInsights } from './geminiService';
import { apiService } from './apiService';

// --- Types ---
interface CartItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
}

const STORAGE_KEYS = {
  SESSION: 'sm_user_session',
  PRODUCTS_PREFIX: 'sm_products_',
  TRANS_PREFIX: 'sm_trans_',
  SUPP_PREFIX: 'sm_supp_'
};

const saveLocally = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));
const loadLocally = (key: string, defaultValue: any) => {
  const stored = localStorage.getItem(key);
  try {
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

// --- Sub-components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
        : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium text-sm">{label}</span>
  </button>
);

const StatCard = ({ title, value, subValue, icon: Icon, color }: { title: string, value: string | number, subValue?: string, icon: any, color: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
        {subValue && (
          <p className="text-xs text-slate-400 mt-2 flex items-center">
            {subValue.includes('+') ? <ArrowUpRight size={14} className="text-emerald-500 mr-1" /> : <ArrowDownRight size={14} className="text-rose-500 mr-1" />}
            {subValue}
          </p>
        )}
      </div>
      <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600`}>
        <Icon size={24} />
      </div>
    </div>
  </div>
);

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(AppScreen.SPLASH);
  const [user, setUser] = useState<{id: string, email: string} | null>(() => loadLocally(STORAGE_KEYS.SESSION, null));

  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'syncing'>('syncing');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [authInput, setAuthInput] = useState({ email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [showSignedOutNotice, setShowSignedOutNotice] = useState(false);

  // Add Product Form State
  const [newProd, setNewProd] = useState({
    name: '',
    sku: '',
    price: 0,
    stock: 0,
    category: 'Electronics' as Category,
    minStockLevel: 5
  });

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Load User Data when User login/changes
  useEffect(() => {
    if (user) {
      const userId = user.id;
      setProducts(loadLocally(STORAGE_KEYS.PRODUCTS_PREFIX + userId, []));
      setTransactions(loadLocally(STORAGE_KEYS.TRANS_PREFIX + userId, []));
      setSuppliers(loadLocally(STORAGE_KEYS.SUPP_PREFIX + userId, []));
      fetchCloudData();
    } else {
      setProducts([]);
      setTransactions([]);
      setSuppliers([]);
    }
    saveLocally(STORAGE_KEYS.SESSION, user);
  }, [user]);

  // Sync state to user-specific local storage
  useEffect(() => {
    if (user) saveLocally(STORAGE_KEYS.PRODUCTS_PREFIX + user.id, products);
  }, [products, user]);

  useEffect(() => {
    if (user) saveLocally(STORAGE_KEYS.TRANS_PREFIX + user.id, transactions);
  }, [transactions, user]);

  useEffect(() => {
    if (user) saveLocally(STORAGE_KEYS.SUPP_PREFIX + user.id, suppliers);
  }, [suppliers, user]);

  // Cloud Sync
  const fetchCloudData = async () => {
    if (!user) return;
    setDbStatus('syncing');
    try {
      // Use Promise.all to fetch everything at once
      const [cloudProds, cloudTrans, cloudSupps] = await Promise.all([
        apiService.getProducts(user.id),
        apiService.getTransactions(user.id),
        apiService.getSuppliers(user.id).catch(() => []) // Fallback for missing endpoint
      ]);
      
      setProducts(cloudProds || []);
      setTransactions(cloudTrans || []);
      setSuppliers(cloudSupps || []);
      setDbStatus('connected');
    } catch (err) {
      console.warn("Cloud Sync Failed:", err);
      setDbStatus('error');
    }
  };

  // Scanner Logic
  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render((text) => {
        handleScanSuccess(text);
        scanner.clear();
        setIsScanning(false);
      }, (err) => {});
      scannerRef.current = scanner;
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, [isScanning, screen]);

  const handleScanSuccess = (sku: string) => {
    if (screen === AppScreen.ADD_PRODUCT) {
      setNewProd(prev => ({ ...prev, sku }));
    } else if (screen === AppScreen.SALES) {
      const found = products.find(p => p.sku === sku);
      if (found) {
        if (found.stock > 0) addToCart(found);
        else alert(`Product "${found.name}" is out of stock!`);
      } else {
        alert(`Product with SKU "${sku}" not found!`);
      }
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    setShowSignedOutNotice(false);
    setIsLoadingData(true);
    try {
      const loggedUser = await apiService.login(authInput.email, authInput.password);
      setUser(loggedUser);
      setScreen(AppScreen.DASHBOARD);
    } catch (err: any) {
      setAuthError(err.message || "Invalid credentials");
      // Fallback for demo if needed, but in production we want hard errors
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    setShowSignedOutNotice(false);
    if (authInput.password !== authInput.confirmPassword) {
      return setAuthError("Passwords do not match");
    }
    setIsLoadingData(true);
    try {
      const newUser = await apiService.register(authInput.email, authInput.password);
      setUser(newUser);
      setScreen(AppScreen.DASHBOARD);
    } catch (err: any) {
      setAuthError(err.message || "Registration failed");
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleLogout = () => {
    // if (window.confirm("Are you sure you want to sign out?")) {
    //   setUser(null);
    //   setCart([]);
    //   setAuthInput({ email: '', password: '', confirmPassword: '' });
    //   setAuthError(null);
    //   setShowSignedOutNotice(true);
      
    //   localStorage.removeItem(STORAGE_KEYS.SESSION);
    // }
    setScreen(AppScreen.REGISTRATION);
  };

  const handleStockAction = async (productId: string, type: 'IN' | 'OUT', quantity: number, price: number) => {
    if (!user) return;
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const newStock = type === 'IN' 
      ? product.stock + quantity 
      : product.stock - quantity;
    
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    
    const newTrans: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      productId,
      type,
      quantity,
      price,
      timestamp: new Date().toISOString()
    };
    setTransactions(prev => [newTrans, ...prev]);

    try {
      await apiService.updateStock(user.id, productId, type, quantity);
      setDbStatus('connected');
    } catch (e) {
      setDbStatus('error');
    }
  };

  const addProduct = async () => {
    if (!user) return;
    if (!newProd.name) return alert("Please enter Product Name");
    if (!newProd.sku) return alert("Please enter or scan a SKU");
    if (newProd.price < 0) return alert("Price cannot be negative");
    
    setIsLoadingData(true);
    try {
      const saved = await apiService.addProduct(user.id, { ...newProd, supplierId: 's1' });
      setProducts(prev => [saved, ...prev]);
      setScreen(AppScreen.INVENTORY);
      setNewProd({ name: '', sku: '', price: 0, stock: 0, category: 'Electronics', minStockLevel: 5 });
      setDbStatus('connected');
    } catch (e) {
      setDbStatus('error');
      // Offline fallback
      const localSaved = { 
        ...newProd, 
        id: Date.now().toString(), 
        createdAt: new Date().toISOString() 
      } as Product;
      setProducts(prev => [localSaved, ...prev]);
      setScreen(AppScreen.INVENTORY);
      setNewProd({ name: '', sku: '', price: 0, stock: 0, category: 'Electronics', minStockLevel: 5 });
    } finally {
      setIsLoadingData(false);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return alert("Out of stock!");
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { productId: product.id, name: product.name, sku: product.sku, quantity: 1, price: product.price }];
    });
  };

  const finalizeSale = async () => {
    if (!cart.length) return;
    setIsLoadingData(true);
    for (const item of cart) await handleStockAction(item.productId, 'OUT', item.quantity, item.price);
    setCart([]);
    setIsLoadingData(false);
    alert("Sale Recorded Successfully.");
  };

  useEffect(() => {
    if (screen === AppScreen.SPLASH) {
      const timer = setTimeout(() => user ? setScreen(AppScreen.DASHBOARD) : setScreen(AppScreen.AUTH), 2000);
      return () => clearTimeout(timer);
    }
  }, [screen, user]);

  const stats = useMemo(() => {
    const totalStockValue = products.reduce((acc, p) => acc + (p.price * p.stock), 0);
    const lowStockItems = products.filter(p => p.stock <= p.minStockLevel).length;
    const totalRevenue = transactions.filter(t => t.type === 'OUT').reduce((acc, t) => acc + (t.price * t.quantity), 0);
    return { totalProducts: products.length, totalStockValue, lowStockItems, totalRevenue };
  }, [products, transactions]);

  if (screen === AppScreen.SPLASH) return (
    <div className="min-h-screen bg-indigo-600 flex flex-col items-center justify-center text-white">
      <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center shadow-2xl animate-bounce"><Package size={48} className="text-indigo-600" /></div>
      <h1 className="mt-8 text-4xl font-bold tracking-tight">StockMaster Pro</h1>
      <p className="mt-2 text-indigo-100 opacity-60">Professional Inventory Cloud</p>
    </div>
  );

  if (screen === AppScreen.AUTH || screen === AppScreen.REGISTRATION) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-indigo-600 p-10 text-center text-white relative">
          <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">Secure Portal</div>
          <Cloud className="mx-auto mb-4" size={48} />
          <h2 className="text-3xl font-bold">{screen === AppScreen.AUTH ? 'Sign In' : 'Sign Up'}</h2>
          <p className="text-indigo-100 mt-2 text-sm opacity-80">
            {screen === AppScreen.AUTH ? 'Access your cloud inventory account' : 'Join StockMaster to track your business'}
          </p>
        </div>
        <div className="p-10 space-y-6">
          {showSignedOutNotice && (
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center animate-in slide-in-from-top-4 duration-300">
              <CheckCircle2 size={18} className="mr-2 flex-shrink-0" />
              Logged out successfully.
            </div>
          )}

          {authError && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium flex items-center">
              <AlertCircle size={18} className="mr-2 flex-shrink-0" />
              {authError}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center">
                <Mail size={12} className="mr-2" /> Email Address
              </label>
              <input 
                type="email" 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 transition-all font-medium" 
                placeholder="you@business.com" 
                value={authInput.email} 
                onChange={e => setAuthInput({...authInput, email: e.target.value})} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center">
                <Lock size={12} className="mr-2" /> Password
              </label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 transition-all font-medium" 
                value={authInput.password} 
                onChange={e => setAuthInput({...authInput, password: e.target.value})} 
              />
            </div>

            {screen === AppScreen.REGISTRATION && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center">
                  <CheckCircle2 size={12} className="mr-2" /> Confirm Password
                </label>
                <input 
                  type="password" 
                  placeholder="••••••••" 
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50 transition-all font-medium" 
                  value={authInput.confirmPassword} 
                  onChange={e => setAuthInput({...authInput, confirmPassword: e.target.value})} 
                />
              </div>
            )}
          </div>

          <button 
            onClick={screen === AppScreen.AUTH ? handleLogin : handleRegister} 
            disabled={isLoadingData}
            className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center space-x-2"
          >
            {isLoadingData ? (
              <RefreshCw className="animate-spin" size={24} />
            ) : (
              <>
                {screen === AppScreen.AUTH ? <LogOut className="rotate-180" size={20} /> : <UserPlus size={20} />}
                <span>{screen === AppScreen.AUTH ? 'Sign In' : 'Create Account'}</span>
              </>
            )}
          </button>

          <div className="pt-4 border-t border-slate-100 text-center">
            <button 
              onClick={() => {
                setScreen(screen === AppScreen.AUTH ? AppScreen.REGISTRATION : AppScreen.AUTH);
                setAuthError(null);
                setShowSignedOutNotice(false);
              }}
              className="text-indigo-600 text-sm font-bold hover:text-indigo-800 transition-colors flex items-center justify-center space-x-2 mx-auto"
            >
              <span>{screen === AppScreen.AUTH ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {isScanning && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ScanBarcode size={20} /></div>
                <h3 className="font-bold text-slate-800">Scan Product</h3>
              </div>
              <button onClick={() => setIsScanning(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div id="qr-reader"></div>
            <div className="p-6 bg-slate-50 text-center text-xs text-slate-400 font-medium">Place the barcode clearly within the frame</div>
          </div>
        </div>
      )}

      <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 md:h-screen z-20">
        <div className="p-8 flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Package size={24} /></div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">StockMaster</span>
        </div>
        <nav className="flex-1 px-4 py-2 space-y-1">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={screen === AppScreen.DASHBOARD} onClick={() => setScreen(AppScreen.DASHBOARD)} />
          <SidebarItem icon={Package} label="Inventory" active={screen === AppScreen.INVENTORY} onClick={() => setScreen(AppScreen.INVENTORY)} />
          <SidebarItem icon={ShoppingCart} label="Sales" active={screen === AppScreen.SALES} onClick={() => setScreen(AppScreen.SALES)} />
          <SidebarItem icon={BarChart3} label="Reports" active={screen === AppScreen.REPORTS} onClick={() => setScreen(AppScreen.REPORTS)} />
        </nav>
        <div className="p-6 border-t bg-slate-50/50">
          <div className="flex items-center space-x-3 mb-4 p-2">
            <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 font-bold border border-slate-200 shadow-sm">
              {user?.email?.[0].toUpperCase() || 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user?.email}</p>
              <p className="text-[10px] text-slate-400 font-medium">ID: {user?.id.slice(0, 8)}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto custom-scrollbar">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-4">
             <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 md:hidden">
               <Package size={20} />
             </div>
             <div className="hidden md:block">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Logged in as</span>
               <span className="text-sm font-bold text-indigo-600">{user?.email}</span>
             </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className={`flex items-center space-x-3 px-4 py-2 rounded-full border transition-all duration-300 ${
              dbStatus === 'connected' ? 'bg-emerald-50 border-emerald-100' : 
              dbStatus === 'syncing' ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'
            }`}>
              {dbStatus === 'connected' ? (
                <Cloud size={16} className="text-emerald-500" />
              ) : dbStatus === 'syncing' ? (
                <Loader2 size={16} className="text-blue-500 animate-spin" />
              ) : (
                <CloudOff size={16} className="text-amber-500" />
              )}
              <span className={`text-[10px] font-bold uppercase tracking-tight ${
                dbStatus === 'connected' ? 'text-emerald-600' : 
                dbStatus === 'syncing' ? 'text-blue-600' : 'text-amber-600'
              }`}>
                {dbStatus === 'connected' ? 'Cloud Sync On' : 
                 dbStatus === 'syncing' ? 'Syncing...' : 'Offline'}
              </span>
            </div>
            <button className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        <div className="p-6 md:p-10 flex-1">
          {screen === AppScreen.DASHBOARD && (
            <div className="space-y-10 animate-in fade-in duration-700">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-4xl font-bold text-slate-800 tracking-tight">Dashboard</h2>
                  <p className="text-slate-500 mt-1 font-medium">Business performance for user ID: <b>{user?.id}</b></p>
                </div>
                <div className="flex space-x-3">
                  <button onClick={fetchCloudData} className="p-3 bg-white text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-indigo-600 transition-all shadow-sm">
                    <RefreshCw size={20} className={dbStatus === 'syncing' ? 'animate-spin' : ''} />
                  </button>
                  <button onClick={() => setScreen(AppScreen.ADD_PRODUCT)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                    <Plus size={20} />
                    <span>New Product</span>
                  </button>
                </div>
              </div>
              
              {products.length === 0 && dbStatus !== 'syncing' ? (
                <div className="bg-white rounded-[3rem] p-20 flex flex-col items-center justify-center border border-dashed border-slate-200 text-center space-y-6 shadow-sm">
                  <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600"><Package size={48} /></div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-slate-800">Your Cloud Inventory is Empty</h3>
                    <p className="text-slate-500 max-w-sm font-medium">This account currently has no products linked. Add your first item to begin tracking stock and sales.</p>
                  </div>
                  <button onClick={() => setScreen(AppScreen.ADD_PRODUCT)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center space-x-2">
                    <PlusCircle size={24} />
                    <span>Add First Product</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  <StatCard title="Total Products" value={stats.totalProducts} icon={Package} color="indigo" />
                  <StatCard title="Stock Value" value={`₹${stats.totalStockValue.toLocaleString()}`} icon={TrendingUp} color="emerald" />
                  <StatCard title="Low Stock" value={stats.lowStockItems} icon={AlertCircle} color="rose" />
                  <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={ShoppingCart} color="blue" />
                </div>
              )}
            </div>
          )}

          {screen === AppScreen.ADD_PRODUCT && (
            <div className="max-w-2xl mx-auto animate-in zoom-in-95 duration-500">
              <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 space-y-10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-800">New Product</h2>
                    <p className="text-slate-500 mt-1 font-medium">Link this product to account: <span className="text-indigo-600">{user?.email}</span></p>
                  </div>
                  <button onClick={() => setScreen(AppScreen.INVENTORY)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                    <X size={28} />
                  </button>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Tag size={14} className="mr-2" /> Product Name</label>
                    <input type="text" placeholder="e.g. Wireless Mouse" value={newProd.name} onChange={e => setNewProd({...newProd, name: e.target.value})} className="w-full p-5 rounded-2xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold text-slate-800" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><ScanBarcode size={14} className="mr-2" /> SKU / Barcode</label>
                      <div className="flex space-x-2">
                        <input type="text" placeholder="SKU-001" value={newProd.sku} onChange={e => setNewProd({...newProd, sku: e.target.value})} className="flex-1 p-5 rounded-2xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm font-bold" />
                        <button onClick={() => setIsScanning(true)} className="p-5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all"><ScanBarcode size={28}/></button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Layers size={14} className="mr-2" /> Category</label>
                      <select value={newProd.category} onChange={(e) => setNewProd({...newProd, category: e.target.value as Category})} className="w-full p-5 rounded-2xl border border-slate-200 bg-slate-50/50 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold appearance-none text-slate-700">
                        <option>Electronics</option><option>Clothing</option><option>Food</option><option>Office</option><option>Others</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><DollarSign size={14} className="mr-2" /> Sale Price (₹)</label>
                      <input type="number" placeholder="0.00" value={newProd.price || ''} onChange={e => setNewProd({...newProd, price: Number(e.target.value)})} className="w-full p-5 rounded-2xl border border-slate-200 bg-slate-50/50 font-extrabold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xl" />
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center"><Package size={14} className="mr-2" /> Initial Stock</label>
                      <input type="number" placeholder="0" value={newProd.stock || ''} onChange={e => setNewProd({...newProd, stock: Number(e.target.value)})} className="w-full p-5 rounded-2xl border border-slate-200 bg-slate-50/50 font-extrabold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-xl" />
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex flex-col space-y-4">
                  <button onClick={addProduct} className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-bold text-xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center space-x-3">
                    {isLoadingData ? <RefreshCw className="animate-spin" size={24} /> : <Save size={24} />}
                    <span>Save to Cloud Profile</span>
                  </button>
                  <button onClick={() => setScreen(AppScreen.INVENTORY)} className="w-full bg-slate-50 text-slate-500 py-5 rounded-[2rem] font-bold hover:bg-slate-100 transition-all">Discard Changes</button>
                </div>
              </div>
            </div>
          )}

          {screen === AppScreen.INVENTORY && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Full Inventory</h2>
                <div className="flex space-x-3">
                   <button onClick={() => setScreen(AppScreen.ADD_PRODUCT)} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center space-x-2 shadow-lg hover:bg-indigo-700 transition-all"><Plus size={20}/><span>New Item</span></button>
                   <button onClick={fetchCloudData} className="p-3 bg-white text-indigo-600 border border-slate-200 rounded-xl hover:bg-indigo-50 transition-all"><RefreshCw size={20} className={dbStatus === 'syncing' ? 'animate-spin' : ''} /></button>
                </div>
              </div>

              {products.length === 0 && dbStatus !== 'syncing' ? (
                <div className="bg-white rounded-[3rem] p-20 flex flex-col items-center justify-center border border-slate-100 text-center space-y-4 shadow-sm">
                  <div className="p-6 bg-slate-50 rounded-full text-slate-200"><Package size={64} /></div>
                  <div className="space-y-1">
                    <p className="text-slate-800 font-bold text-xl">No Products Yet</p>
                    <p className="text-slate-500 font-medium">Add products to your account <b>{user?.email}</b>.</p>
                  </div>
                  <button onClick={() => setScreen(AppScreen.ADD_PRODUCT)} className="text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors">Create First Item</button>
                </div>
              ) : (
                <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                          <th className="px-8 py-6">SKU Code</th>
                          <th className="px-8 py-6">Product Information</th>
                          <th className="px-8 py-6">Current Stock</th>
                          <th className="px-8 py-6 text-right">Unit Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {products.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-6 font-mono text-xs font-bold text-indigo-600">{p.sku}</td>
                            <td className="px-8 py-6">
                              <div className="font-bold text-slate-800">{p.name}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{p.category}</div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center space-x-2">
                                <span className={`w-2 h-2 rounded-full ${p.stock <= p.minStockLevel ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                                <span className={`text-sm font-bold ${p.stock <= p.minStockLevel ? 'text-rose-600' : 'text-slate-700'}`}>{p.stock} Units</span>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right font-extrabold text-slate-800">₹{p.price.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {screen === AppScreen.SALES && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-full animate-in fade-in duration-500">
              <div className="lg:col-span-7 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Sales POS</h2>
                  <button onClick={() => setIsScanning(true)} className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all">
                    <ScanBarcode size={24} />
                    <span>Scan Product</span>
                  </button>
                </div>
                
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by name or scan SKU..." 
                    className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-4 focus:ring-indigo-50 transition-all font-medium" 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                  />
                </div>
                
                {products.length === 0 && dbStatus !== 'syncing' ? (
                  <div className="bg-white p-20 rounded-[3rem] border border-slate-200 text-center shadow-sm">
                    <p className="text-slate-500 font-bold text-lg">No inventory available to sell.</p>
                    <p className="text-slate-400 text-sm mt-1">Please add products to your profile first.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => addToCart(p)} 
                        className={`bg-white p-6 rounded-[2rem] border border-slate-100 cursor-pointer hover:border-indigo-400 hover:shadow-xl transition-all flex justify-between items-center group shadow-sm relative overflow-hidden ${p.stock <= 0 ? 'opacity-40 grayscale pointer-events-none' : ''}`}
                      >
                        <div className="relative z-10">
                          <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">SKU: {p.sku}</p>
                        </div>
                        <div className="text-right relative z-10">
                          <p className="font-extrabold text-indigo-600 text-lg">₹{p.price.toLocaleString()}</p>
                          <p className={`text-[10px] font-bold uppercase mt-1 ${p.stock <= p.minStockLevel ? 'text-rose-500' : 'text-slate-400'}`}>
                            {p.stock} units left
                          </p>
                        </div>
                        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><Plus size={16} /></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="lg:col-span-5">
                <div className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl flex flex-col h-[700px] sticky top-28 overflow-hidden">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-600 text-white rounded-xl"><ShoppingCart size={20} /></div>
                      <h3 className="font-bold text-xl text-slate-800">Checkout</h3>
                    </div>
                    <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold tracking-tight">{cart.length} ITEMS</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                    {cart.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center"><ShoppingCart size={32} /></div>
                        <p className="font-bold text-xl text-slate-500">Basket is Empty</p>
                      </div>
                    ) : (
                      cart.map(item => (
                        <div key={item.productId} className="bg-white p-5 rounded-2xl flex justify-between items-center border border-slate-100 hover:border-slate-200 transition-all shadow-sm group">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-800 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">₹{item.price.toLocaleString()} per unit</p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                               <button onClick={() => {
                                 const existing = cart.find(c => c.productId === item.productId);
                                 if (existing && existing.quantity > 1) {
                                   setCart(prev => prev.map(c => c.productId === item.productId ? {...c, quantity: c.quantity - 1} : c));
                                 } else {
                                   setCart(prev => prev.filter(c => c.productId !== item.productId));
                                 }
                               }} className="text-slate-400 hover:text-indigo-600"><Minus size={14} /></button>
                               <span className="font-extrabold text-slate-800 text-sm min-w-[20px] text-center">{item.quantity}</span>
                               <button onClick={() => {
                                 const prod = products.find(p => p.id === item.productId);
                                 if (prod && item.quantity < prod.stock) {
                                   setCart(prev => prev.map(c => c.productId === item.productId ? {...c, quantity: c.quantity + 1} : c));
                                 } else {
                                   alert("Cannot exceed available stock");
                                 }
                               }} className="text-slate-400 hover:text-indigo-600"><Plus size={14} /></button>
                            </div>
                            <button onClick={() => setCart(prev => prev.filter(c => c.productId !== item.productId))} className="text-rose-300 hover:text-rose-600 transition-colors p-2"><Trash2 size={18}/></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="p-10 border-t bg-slate-50/80 space-y-8">
                    <div className="space-y-3">
                       <div className="flex justify-between text-sm font-bold text-slate-400 uppercase tracking-widest">
                         <span>Subtotal</span>
                         <span>₹{cart.reduce((a,c)=>a+(c.price*c.quantity),0).toLocaleString()}</span>
                       </div>
                       <div className="flex justify-between items-center font-extrabold text-3xl text-slate-800 tracking-tight">
                         <span>Total</span>
                         <span className="text-indigo-600">₹{cart.reduce((a,c)=>a+(c.price*c.quantity),0).toLocaleString()}</span>
                       </div>
                    </div>
                    <button 
                      onClick={finalizeSale} 
                      disabled={cart.length === 0 || isLoadingData} 
                      className="w-full bg-indigo-600 text-white py-6 rounded-[2rem] font-bold text-xl shadow-2xl shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
                    >
                      {isLoadingData ? <RefreshCw className="animate-spin" size={24} /> : <CheckCircle2 size={24} />}
                      <span>Finalize Transaction</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {screen === AppScreen.REPORTS && (
            <div className="space-y-12 animate-in fade-in duration-700">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Financial Reports</h2>
                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-widest">Last 30 Days</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden group hover:border-indigo-200 transition-all">
                  <div className="absolute -right-4 -top-4 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
                  <h3 className="font-bold text-slate-400 text-xs uppercase tracking-[0.2em] mb-6">Aggregate Revenue</h3>
                  <p className="text-6xl font-black text-slate-800 tracking-tighter">₹{stats.totalRevenue.toLocaleString()}</p>
                  <div className="mt-8 flex items-center text-emerald-500 font-bold text-sm">
                    <ArrowUpRight size={18} className="mr-1" />
                    <span>Real-time cloud data</span>
                  </div>
                </div>
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl relative overflow-hidden group hover:border-indigo-200 transition-all">
                   <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-50"></div>
                   <h3 className="font-bold text-slate-400 text-xs uppercase tracking-[0.2em] mb-6">Inventory Value</h3>
                   <p className="text-6xl font-black text-slate-800 tracking-tighter">₹{stats.totalStockValue.toLocaleString()}</p>
                   <div className="mt-8 flex items-center text-slate-400 font-bold text-sm italic">
                    <Package size={18} className="mr-2 opacity-50" />
                    <span>Based on current stock levels</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-indigo-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
                 <div className="absolute top-0 right-0 p-10 opacity-10"><BrainCircuit size={200} /></div>
                 <div className="relative z-10 max-w-xl space-y-6">
                    <div className="inline-flex items-center space-x-2 bg-indigo-800/50 px-4 py-1.5 rounded-full border border-indigo-700">
                      <BrainCircuit size={16} />
                      <span className="text-[10px] font-black uppercase tracking-widest">AI Insights Engine</span>
                    </div>
                    <h4 className="text-3xl font-bold tracking-tight">Unlock AI-powered Business Intelligence</h4>
                    <p className="text-indigo-200 font-medium leading-relaxed">Our Gemini AI analysis engine helps you predict stock shortages and suggests optimal pricing based on your unique sales history.</p>
                    <button className="bg-white text-indigo-900 px-8 py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-50 transition-all flex items-center space-x-2">
                      <span>Analyze Inventory</span>
                      <ArrowUpRight size={20} />
                    </button>
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
