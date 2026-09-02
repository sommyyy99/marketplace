import { useState, useMemo, useCallback, useEffect } from 'react';
import type { User as SupaUser } from '@supabase/supabase-js';
import { supabase } from './integrations/supabase/client';
import { AuthModal } from './components/AuthModal';
import { AddressStep } from './components/AddressStep';
import { BecomeVendorModal } from './components/BecomeVendorModal';
import { BecomeRiderModal } from './components/BecomeRiderModal';
import { CustomerOrders } from './components/CustomerOrders';
import { VendorDashboard } from './components/VendorDashboard';
import { RiderDashboard } from './components/RiderDashboard';
import { AdminDashboard } from './components/AdminDashboard';

interface VendorRow {
  id: string;
  name: string;
  avg_rating: number | null;
  logo_url: string | null;
  category: string | null;
  service_category: string | null;
}

interface Product {
  id: string;
  name: string;
  vendor: string;
  vendorId: string | null;
  serviceCategory: string | null;
  description: string;
  price: number;
  category: string;
  categoryLabel: string | null;
  image: string;
}

interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category_id: string | null;
  image_url: string | null;
  vendor_id: string | null;
  vendors: { name: string; service_category: string | null } | null;
  menu_categories: { name: string } | null;
}

import wrapsBurgers from './assets/images/image copy copy.png';
import deliveryBike from './assets/images/delivery-bike.png';
import {
  Search,
  ShoppingCart,
  MapPin,
  ChevronDown,
  Menu,
  Store,
  ClipboardList,
  Heart,
  Users,
  User,
} from 'lucide-react';
import {
  deliveryFee,
  serviceFee,
} from './data/products';

interface BasketItem {
  id: string;
  menuItemId: string;
  vendorId: string | null;
  name: string;
  price: number;
  quantity: number;
}

function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [activeNav, setActiveNav] = useState('Market');
  const [activeService, setActiveService] = useState('All');
  const [cityOpen, setCityOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [heroAddress, setHeroAddress] = useState('');
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<SupaUser | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'dashboard' | 'orders' | 'riderDashboard' | 'adminDashboard' | 'vendors'>('home');
  const [authOpen, setAuthOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [addressStepOpen, setAddressStepOpen] = useState(false);
  const [becomeVendorOpen, setBecomeVendorOpen] = useState(false);
  const [becomeRiderOpen, setBecomeRiderOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (!cancelled) setAuthUser(data.session?.user ?? null);
      })
      .catch((error) => {
        console.error('Failed to restore the saved session:', error);
        if (!cancelled) {
          setAuthUser(null);
          setProfileName(null);
          setProfileRole(null);
          setView('home');
        }
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      setProfileName(null);
      setProfileRole(null);
      setView('home');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', authUser.id)
          .maybeSingle();
        if (error) throw error;
        if (!cancelled) {
          const role = typeof data?.role === 'string' ? data.role.trim().toLowerCase() : null;
          const fullName = typeof data?.full_name === 'string' ? data.full_name.trim() : '';
          const metadataName = typeof authUser.user_metadata?.full_name === 'string'
            ? authUser.user_metadata.full_name.trim()
            : '';
          setProfileName(fullName || metadataName || authUser.email || null);
          setProfileRole(
            role === 'vendor' || role === 'customer' || role === 'rider' || role === 'admin' ? role : null
          );
          if (role !== 'vendor' && role !== 'rider' && role !== 'admin') setView('home');
        }
      } catch (error) {
        console.error('Failed to load the account profile:', error);
        if (!cancelled) {
          const metadataName = typeof authUser.user_metadata?.full_name === 'string'
            ? authUser.user_metadata.full_name.trim()
            : '';
          setProfileName(metadataName || authUser.email || null);
          setProfileRole(null);
          setView('home');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAccountMenuOpen(false);
    setView('home');
    setProfileRole(null);
  };


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, avg_rating, logo_url, category, service_category')
        .eq('is_active', true)
        .eq('is_open', true)
        .order('avg_rating', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load vendors', error);
        setVendors([]);
      } else {
        setVendors(data ?? []);
      }
      setVendorsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, description, price, category_id, image_url, vendor_id, vendors!menu_items_vendor_id_fkey(name, service_category), menu_categories(name)')
        .eq('is_available', true)
        .order('name');
      if (cancelled) return;
      if (error) {
        console.error('Failed to load menu items', error);
        setProducts([]);
      } else {
        const rows = (data ?? []) as MenuItemRow[];
        setProducts(
          rows.map((item) => ({
            id: item.id,
            name: item.name,
            vendor: item.vendors?.name ?? 'Local vendor',
            vendorId: item.vendor_id,
            serviceCategory: item.vendors?.service_category ?? null,
            description: item.description ?? '',
            price: Number(item.price),
            category: item.category_id ?? 'all',
            categoryLabel: item.menu_categories?.name ?? null,
            image: item.image_url ?? wrapsBurgers,
          })),
        );
      }
      setProductsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productsInService = useMemo(() => {
    if (activeService === 'All') return products;
    return products.filter((p) => p.serviceCategory === activeService);
  }, [activeService, products]);

  // Built from whatever categories are actually present on real menu items
  // (not a hardcoded list), so a category pill always matches real products.
  const availableCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of productsInService) {
      if (p.category !== 'all' && p.categoryLabel) {
        seen.set(p.category, p.categoryLabel);
      }
    }
    return [{ id: 'all', label: 'All' }, ...Array.from(seen, ([id, label]) => ({ id, label }))];
  }, [productsInService]);

  useEffect(() => {
    if (activeCategory !== 'all' && !availableCategories.some((c) => c.id === activeCategory)) {
      setActiveCategory('all');
    }
  }, [availableCategories, activeCategory]);

  const filteredProducts = useMemo(() => {
    let list = activeCategory === 'all' ? productsInService : productsInService.filter((p) => p.category === activeCategory);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.vendor.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeCategory, productsInService, searchQuery]);

  const filteredVendors = useMemo(() => {
    if (activeService === 'All') return vendors;
    return vendors.filter((v) => v.service_category === activeService);
  }, [activeService, vendors]);

  const addToBasket = useCallback((product: Product) => {
    setCheckoutMessage(null);
    setBasket((prev) => {
      const existing = prev.find((it) => it.menuItemId === product.id);
      if (existing) {
        return prev.map((it) =>
          it.menuItemId === product.id ? { ...it, quantity: it.quantity + 1 } : it,
        );
      }
      return [
        ...prev,
        {
          id: `${product.id}-${Date.now()}`,
          menuItemId: product.id,
          vendorId: product.vendorId,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  }, []);

  const incrementBasketItem = useCallback((menuItemId: string) => {
    setBasket((prev) => prev.map((it) => (it.menuItemId === menuItemId ? { ...it, quantity: it.quantity + 1 } : it)));
  }, []);

  const decrementBasketItem = useCallback((menuItemId: string) => {
    setBasket((prev) =>
      prev
        .map((it) => (it.menuItemId === menuItemId ? { ...it, quantity: it.quantity - 1 } : it))
        .filter((it) => it.quantity > 0),
    );
  }, []);

  const removeBasketItem = useCallback((menuItemId: string) => {
    setBasket((prev) => prev.filter((it) => it.menuItemId !== menuItemId));
  }, []);

  const loadPaystack = useCallback((): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') return reject(new Error('No window'));
      const w = window as any;
      if (w.PaystackPop) return resolve(w.PaystackPop);
      const existing = document.getElementById('paystack-inline-js') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve((window as any).PaystackPop));
        existing.addEventListener('error', () => reject(new Error('Failed to load Paystack')));
        return;
      }
      const s = document.createElement('script');
      s.id = 'paystack-inline-js';
      s.src = 'https://js.paystack.co/v1/inline.js';
      s.async = true;
      s.onload = () => resolve((window as any).PaystackPop);
      s.onerror = () => reject(new Error('Failed to load Paystack'));
      document.body.appendChild(s);
    });
  }, []);

  // Calls the create-order edge function, which looks up real menu-item
  // prices server-side and creates a "pending" order - the client can never
  // set its own prices or mark an order as paid.
  const createPendingOrder = useCallback(
    async (vendorId: string, addressId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Please sign in again before placing your order.');

      const { data, error } = await supabase.functions.invoke('create-order', {
        body: {
          vendorId,
          addressId,
          items: basket.map((it) => ({ menuItemId: it.menuItemId, quantity: it.quantity })),
        },
      });
      if (error) {
        const message = (data as any)?.error || error.message || 'Could not create the order.';
        throw new Error(message);
      }
      return data as {
        orderId: string;
        total: number;
        amountKobo: number;
        email: string;
      };
    },
    [basket],
  );

  // Calls the verify-payment edge function, which confirms the transaction
  // with Paystack's secret key server-side before the order is marked paid.
  const verifyPayment = useCallback(async (orderId: string, reference: string) => {
    const { data, error } = await supabase.functions.invoke('verify-payment', {
      body: { orderId, reference },
    });
    if (error) {
      const message = (data as any)?.error || error.message || 'Payment could not be verified.';
      throw new Error(message);
    }
  }, []);

  // Kicks off the Paystack popup once a delivery address has been chosen/saved.
  const proceedToPayment = useCallback(
    async (addressId: string) => {
      if (!authUser) return;

      const vendorId = basket[0]?.vendorId;
      if (!vendorId) {
        setCheckoutMessage({ kind: 'error', text: "This item isn't linked to a vendor yet." });
        return;
      }

      setCheckoutLoading(true);
      try {
        // Create the order server-side first so the total is trustworthy.
        const { orderId, amountKobo, email } = await createPendingOrder(vendorId, addressId);
        if (!email) {
          setCheckoutMessage({ kind: 'error', text: 'Your account has no email for payment.' });
          setCheckoutLoading(false);
          return;
        }

        const PaystackPop = await loadPaystack();
        const handler = PaystackPop.setup({
          key: 'pk_test_772559f6395e880ab255aa37da7ad977d918cb09',
          email,
          amount: amountKobo,
          currency: 'NGN',
          callback: (response: { reference: string }) => {
            (async () => {
              try {
                await verifyPayment(orderId, response.reference);
                setBasket([]);
                setCheckoutMessage({ kind: 'success', text: `Payment successful! Order placed (ref ${response.reference}).` });
              } catch (err: any) {
                console.error('Payment verification failed', err);
                setCheckoutMessage({ kind: 'error', text: err.message || 'Payment could not be verified. Contact support with your reference.' });
              } finally {
                setCheckoutLoading(false);
              }
            })();
          },
          onClose: () => {
            setCheckoutLoading(false);
            setCheckoutMessage({ kind: 'error', text: 'Payment cancelled. Your order was not placed.' });
          },
        });
        handler.openIframe();
      } catch (err: any) {
        console.error('Checkout failed', err);
        setCheckoutMessage({ kind: 'error', text: err.message || 'Checkout failed. Please try again.' });
        setCheckoutLoading(false);
      }
    },
    [authUser, basket, loadPaystack, createPendingOrder, verifyPayment],
  );

  // Validates the basket, then opens the delivery-address step before payment.
  const handleCheckout = useCallback(() => {
    setCheckoutMessage(null);
    if (!authUser) {
      setAuthOpen(true);
      return;
    }
    if (basket.length === 0) return;

    const vendorId = basket[0].vendorId;
    if (!vendorId) {
      setCheckoutMessage({ kind: 'error', text: "This item isn't linked to a vendor yet." });
      return;
    }
    if (basket.some((it) => it.vendorId !== vendorId)) {
      setCheckoutMessage({ kind: 'error', text: 'All items must be from the same vendor.' });
      return;
    }
    if (!authUser.email) {
      setCheckoutMessage({ kind: 'error', text: 'Your account has no email for payment.' });
      return;
    }

    setAddressStepOpen(true);
  }, [authUser, basket]);

  const handleAddressConfirmed = useCallback(
    (addressId: string) => {
      setAddressStepOpen(false);
      proceedToPayment(addressId);
    },
    [proceedToPayment],
  );

  const total = useMemo(() => {
    return basket.reduce((sum, item) => sum + item.price * item.quantity, 0) + deliveryFee + serviceFee;
  }, [basket]);

  const navItems = [
    { label: 'Market', icon: Store },
    { label: 'Orders', icon: ClipboardList },
    { label: 'Saved', icon: Heart },
    { label: 'Vendors', icon: Users },
  ];


  const services = ['All', 'Food & Drinks', 'Groceries', 'Pharmacy', 'Fashion', 'Beauty', 'Electronics', 'Services', 'Everything Else'];

  const hasVendorDashboardAccess = Boolean(authUser && profileRole === 'vendor');
  const hasRiderDashboardAccess = Boolean(authUser && profileRole === 'rider');
  const hasAdminDashboardAccess = Boolean(authUser && profileRole === 'admin');

  return (
    <div className="min-h-screen w-full overflow-hidden bg-white">
      {/* Top Bar */}
      <header className="relative z-20 bg-[#FFF8E7] px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 grid place-items-center rounded-full bg-[#1B5E3E] text-white font-black text-lg shadow-lg">
              S
            </span>
          </div>

          {/* City Selector */}
          <div className="relative">
            <button
              onClick={() => setCityOpen(!cityOpen)}
              className="flex items-center gap-2 bg-white rounded-full px-4 py-2 border border-[#e5e7eb] shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-lg">🇳🇬</span>
              <span className="font-semibold text-[#111827] text-sm">NG</span>
              <ChevronDown className="w-4 h-4 text-[#667085]" />
            </button>
            {cityOpen && (
              <div className="absolute top-full mt-2 left-0 bg-white rounded-xl shadow-lg border border-[#e5e7eb] py-2 min-w-[160px]">
                {['Lagos', 'Abuja', 'Ibadan', 'Port Harcourt'].map((city) => (
                  <button
                    key={city}
                    onClick={() => setCityOpen(false)}
                    className="w-full text-left px-4 py-2 text-sm text-[#111827] hover:bg-[#f7f8fa] transition-colors"
                  >
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => document.getElementById('basket-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="relative w-10 h-10 grid place-items-center rounded-full bg-white border border-[#e5e7eb] shadow-sm hover:shadow-md transition-shadow"
              aria-label="View basket"
            >
              <ShoppingCart className="w-5 h-5 text-[#1B5E3E]" />
              {basket.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                  {basket.reduce((sum, it) => sum + it.quantity, 0)}
                </span>
              )}
            </button>
            <button
              onClick={() => setAccountMenuOpen((v) => !v)}
              className="w-10 h-10 grid place-items-center rounded-full bg-[#1B5E3E] text-white shadow-lg hover:bg-[#144d32] transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Address Bar */}
        <div className="max-w-[800px] mx-auto mt-6">
          <div className="flex items-center gap-3 bg-white rounded-full px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#e5e7eb]">
            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                setTimeout(() => document.getElementById('hero-search-input')?.focus(), 0);
              }}
              className="flex items-center gap-2 bg-[#f7f8fa] border border-[#e5e7eb] text-[#1B5E3E] font-bold px-5 py-2 rounded-full hover:bg-[#1B5E3E] hover:text-white hover:border-[#1B5E3E] transition-colors whitespace-nowrap text-sm flex-shrink-0"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
            {searchOpen ? (
              <input
                id="hero-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                placeholder="Search items or vendors"
                className="flex-1 min-w-0 border-0 outline-0 text-[#111827] placeholder:text-[#9ca3af] text-base bg-transparent"
              />
            ) : (
              <>
                <MapPin className="w-5 h-5 text-[#1B5E3E] flex-shrink-0" />
                <input
                  type="text"
                  value={heroAddress}
                  onChange={(e) => setHeroAddress(e.target.value)}
                  placeholder="Enter a delivery address"
                  className="flex-1 min-w-0 border-0 outline-0 text-[#111827] placeholder:text-[#9ca3af] text-base bg-transparent"
                />
              </>
            )}
            <button
              onClick={() => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="bg-[#1B5E3E] text-white font-bold px-6 py-2.5 rounded-full hover:bg-[#144d32] transition-colors whitespace-nowrap text-sm flex-shrink-0"
            >
              Order now
            </button>
          </div>
        </div>

        {/* Headline under address bar */}
        <h1 className="text-center text-[clamp(2rem,5vw,3.5rem)] font-black text-[#111827] tracking-tight mt-6">
          Everything you need, delivered
        </h1>

        {/* Delivery Illustration: bikes & food trucks */}
        <div className="max-w-[1200px] mx-auto mt-8 relative h-[240px] overflow-hidden">
          {/* Road */}
          <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-[#e5e7eb]/40" />
          <div className="absolute bottom-[28px] left-0 right-0 h-[2px] bg-[#1B5E3E]/20" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #1B5E3E 0, #1B5E3E 12px, transparent 12px, transparent 28px)' }} />

          {/* Clouds */}
          <div className="absolute top-2 left-[12%]">
            <svg width="80" height="36" viewBox="0 0 80 36" fill="none">
              <ellipse cx="40" cy="18" rx="32" ry="16" fill="white" fillOpacity="0.85" />
              <ellipse cx="25" cy="20" rx="18" ry="10" fill="white" fillOpacity="0.6" />
              <ellipse cx="55" cy="16" rx="20" ry="12" fill="white" fillOpacity="0.7" />
            </svg>
          </div>
          <div className="absolute top-6 right-[18%]">
            <svg width="100" height="40" viewBox="0 0 100 40" fill="none">
              <ellipse cx="50" cy="20" rx="38" ry="18" fill="white" fillOpacity="0.7" />
              <ellipse cx="30" cy="22" rx="22" ry="12" fill="white" fillOpacity="0.5" />
              <ellipse cx="70" cy="18" rx="26" ry="14" fill="white" fillOpacity="0.6" />
            </svg>
          </div>

          {/* Delivery Motorcycle 1 - right to left */}
          <div className="absolute bottom-[16px]" style={{ animation: 'bikeLeft 14s linear infinite' }}>
            <img src={deliveryBike} alt="Delivery scooter" className="w-[180px] h-auto drop-shadow-lg" />
          </div>




          {/* Delivery Motorcycle 2 - right to left, offset */}
          <div className="absolute bottom-[16px]" style={{ animation: 'bikeLeft 16s linear infinite', animationDelay: '5s' }}>
            <img src={deliveryBike} alt="Delivery scooter" className="w-[160px] h-auto drop-shadow-lg" />
          </div>

        </div>
      </header>

      {/* Secondary Nav */}
      <nav className="bg-white border-b border-[#e5e7eb] px-6 py-3 sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto flex gap-6 items-center">
          <div className="flex gap-6 items-center overflow-x-auto scrollbar-hide flex-1 min-w-0">
            {navItems.map((item) => {
              const isActive =
                item.label === 'Market'
                  ? view === 'home'
                  : item.label === 'Orders'
                    ? view === 'orders'
                    : item.label === 'Vendors'
                      ? view === 'vendors'
                      : activeNav === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    if (item.label === 'Market') {
                      setView('home');
                      setActiveNav('Market');
                      return;
                    }
                    if (item.label === 'Orders') {
                      if (!authUser) {
                        setAuthOpen(true);
                        return;
                      }
                      setView('orders');
                      setActiveNav('Orders');
                      return;
                    }
                    if (item.label === 'Vendors') {
                      setView('vendors');
                      setActiveNav('Vendors');
                      return;
                    }
                    if (item.label === 'Saved') {
                      setCheckoutMessage({ kind: 'error', text: 'Saved items is coming soon.' });
                      setActiveNav('Saved');
                      return;
                    }
                    setActiveNav(item.label);
                  }}
                  className={`min-h-[40px] flex items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-[#1B5E3E] text-white'
                      : 'text-[#667085] hover:bg-[#f7f8fa] hover:text-[#111827]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}

            {hasVendorDashboardAccess && (
              <button
                onClick={() => setView(view === 'dashboard' ? 'home' : 'dashboard')}
                className={`min-h-[40px] flex items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors ${
                  view === 'dashboard'
                    ? 'bg-[#1B5E3E] text-white'
                    : 'text-[#667085] hover:bg-[#f7f8fa] hover:text-[#111827]'
                }`}
              >
                Dashboard
              </button>
            )}

            {authUser && profileRole && profileRole !== 'vendor' && (
              <button
                onClick={() => setBecomeVendorOpen(true)}
                className="min-h-[40px] flex items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors text-[#667085] hover:bg-[#f7f8fa] hover:text-[#111827]"
              >
                Become a vendor
              </button>
            )}

            {hasRiderDashboardAccess && (
              <button
                onClick={() => setView(view === 'riderDashboard' ? 'home' : 'riderDashboard')}
                className={`min-h-[40px] flex items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors ${
                  view === 'riderDashboard'
                    ? 'bg-[#1B5E3E] text-white'
                    : 'text-[#667085] hover:bg-[#f7f8fa] hover:text-[#111827]'
                }`}
              >
                Deliveries
              </button>
            )}

            {authUser && profileRole && profileRole !== 'rider' && (
              <button
                onClick={() => setBecomeRiderOpen(true)}
                className="min-h-[40px] flex items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors text-[#667085] hover:bg-[#f7f8fa] hover:text-[#111827]"
              >
                Become a rider
              </button>
            )}

            {hasAdminDashboardAccess && (
              <button
                onClick={() => setView(view === 'adminDashboard' ? 'home' : 'adminDashboard')}
                className={`min-h-[40px] flex items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap transition-colors ${
                  view === 'adminDashboard'
                    ? 'bg-[#1B5E3E] text-white'
                    : 'text-[#667085] hover:bg-[#f7f8fa] hover:text-[#111827]'
                }`}
              >
                Admin
              </button>
            )}
          </div>

          <div className="relative shrink-0">
            {authUser ? (
              <>
                <button
                  onClick={() => setAccountMenuOpen((v) => !v)}
                  className="min-h-[40px] flex items-center gap-2 rounded-full px-4 text-sm whitespace-nowrap bg-[#f7f8fa] text-[#111827] hover:bg-[#e5e7eb] transition-colors"
                >
                  <span className="w-6 h-6 grid place-items-center rounded-full bg-[#1B5E3E] text-white text-xs font-black">
                    <User className="w-3.5 h-3.5" />
                  </span>
                  <span className="font-bold max-w-[140px] truncate">
                    {profileName ?? 'Account'}
                  </span>
                </button>
                {accountMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setAccountMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg border border-[#e5e7eb] py-2 min-w-[160px] z-30">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-[#111827] hover:bg-[#f7f8fa]"
                      >
                        Log out
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="min-h-[40px] rounded-full bg-[#1B5E3E] text-white font-bold px-5 text-sm hover:bg-[#144d32] transition-colors shadow-md"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </nav>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      {authUser && (
        <AddressStep
          open={addressStepOpen}
          userId={authUser.id}
          onClose={() => setAddressStepOpen(false)}
          onConfirm={handleAddressConfirmed}
        />
      )}
      {authUser && (
        <BecomeVendorModal
          open={becomeVendorOpen}
          userId={authUser.id}
          onClose={() => setBecomeVendorOpen(false)}
          onSuccess={() => {
            setBecomeVendorOpen(false);
            setProfileRole('vendor');
            setView('dashboard');
          }}
        />
      )}
      {authUser && (
        <BecomeRiderModal
          open={becomeRiderOpen}
          userId={authUser.id}
          onClose={() => setBecomeRiderOpen(false)}
          onSuccess={() => {
            setBecomeRiderOpen(false);
            setProfileRole('rider');
            setView('riderDashboard');
          }}
        />
      )}

      {view === 'dashboard' && authUser && hasVendorDashboardAccess ? (
        <VendorDashboard userId={authUser.id} />
      ) : view === 'riderDashboard' && authUser && hasRiderDashboardAccess ? (
        <RiderDashboard userId={authUser.id} />
      ) : view === 'adminDashboard' && authUser && hasAdminDashboardAccess ? (
        <AdminDashboard />
      ) : view === 'orders' && authUser ? (
        <CustomerOrders userId={authUser.id} />
      ) : view === 'vendors' ? (
        <main className="w-full max-w-[1200px] mx-auto px-6 py-8">
          <h1 className="text-3xl font-black text-[#111827] mb-6">Vendors</h1>
          {vendors.length === 0 ? (
            <p className="text-sm text-[#667085]">No vendors have joined Sommygo yet — check back soon.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
              {vendors.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSearchQuery(v.name);
                    setView('home');
                    setActiveNav('Market');
                    setTimeout(() => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
                  }}
                  className="text-left bg-white border border-[#e5e7eb] rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-full bg-[#f7f8fa] grid place-items-center mb-3 overflow-hidden">
                    {v.logo_url ? (
                      <img src={v.logo_url} alt={v.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-[#1B5E3E]">{v.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <p className="font-bold text-[#111827]">{v.name}</p>
                  <p className="text-xs text-[#667085] mt-1">
                    {v.service_category ?? v.category ?? 'General'}
                    {v.avg_rating != null && ` · ★ ${Number(v.avg_rating).toFixed(1)}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </main>
      ) : (
      <>
      {/* Main Content */}
      <main className="w-full max-w-[1200px] mx-auto px-6 py-8">
        {/* Hero Content */}
        <section className="mb-12">
          <div className="grid grid-cols-[1fr_0.9fr] gap-8 items-center max-[900px]:grid-cols-1">
            <div className="animate-fade-up">
              <span className="text-[#1B5E3E] font-black text-sm uppercase tracking-wider">Sommygo</span>
              <h2 className="text-[clamp(2.5rem,5vw,4rem)] font-black text-[#111827] leading-[1.05] mt-3 mb-4">
                Order anything, delivered fast
              </h2>
              <p className="text-[#667085] text-lg leading-relaxed max-w-[480px]">
                Food, groceries, fashion, electronics and more — delivered to your doorstep.
              </p>

              <div className="flex gap-3 mt-6 flex-wrap">
                {services.map((s) => (
                  <button
                    key={s}
                    onClick={() => setActiveService(s)}
                    className={`min-h-[44px] rounded-full font-bold px-5 transition-colors ${
                      activeService === s
                        ? 'bg-[#1B5E3E] text-white'
                        : 'bg-[#f7f8fa] text-[#667085] border border-[#e5e7eb] hover:bg-[#1B5E3E] hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <button
                onClick={() => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="mt-6 min-h-[50px] rounded-full bg-[#1B5E3E] text-white font-bold px-8 shadow-[0_10px_30px_rgba(27,94,62,0.3)] hover:bg-[#144d32] transition-colors"
              >
                Start shopping
              </button>
            </div>

            <div className="relative animate-fade-up animation-delay-120 max-[900px]:order-first">
              {filteredProducts.length === 0 ? (
                <div className="rounded-3xl border border-[#e5e7eb] bg-[#f7f8fa] aspect-square grid place-items-center text-center px-8">
                  <p className="text-[#667085] text-sm">
                    {activeService === 'All'
                      ? 'New listings are on their way — check back soon.'
                      : `No ${activeService} listings yet — check back soon.`}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 rounded-3xl">
                  {filteredProducts.slice(0, 4).map((product) => (
                    <div key={product.id} className="relative overflow-hidden rounded-2xl aspect-square shadow-lg group">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="text-white font-bold text-sm">{product.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl p-4 shadow-xl border border-[#e5e7eb]">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 grid place-items-center rounded-full bg-[#1B5E3E]/10 text-[#1B5E3E] font-black text-sm">
                    25
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#111827]">min delivery</p>
                    <p className="text-xs text-[#667085]">Average time</p>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-2xl p-3 shadow-xl border border-[#e5e7eb]">
                <span className="text-2xl">🍲</span>
              </div>
            </div>
          </div>
        </section>

        {/* Discovery Rail */}
        <section className="grid grid-cols-3 gap-4 mb-12 max-[760px]:grid-cols-1">
          {[
            {
              num: '01',
              title: 'Order anything nearby',
              desc: 'Food, groceries, pharmacy runs, market items, and daily needs in one flow.',
              onClick: () => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            },
            {
              num: '02',
              title: 'Track every step',
              desc: 'Follow pickup, rider movement, and delivery status from store to doorstep.',
              onClick: () => {
                if (!authUser) {
                  setAuthOpen(true);
                  return;
                }
                setView('orders');
                setActiveNav('Orders');
              },
            },
            {
              num: '03',
              title: 'Explore local details',
              desc: 'See vendors, ratings, active drops, delivery estimates, and item details fast.',
              onClick: () => {
                setView('vendors');
                setActiveNav('Vendors');
              },
            },
          ].map((item, i) => (
            <button
              key={item.num}
              onClick={item.onClick}
              className="text-left border border-[#e5e7eb] rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] animate-fade-up"
              style={{ animationDelay: `${i === 1 ? '90ms' : i === 2 ? '160ms' : '0ms'}` }}
            >
              <span className="text-[#1B5E3E] text-sm font-black">{item.num}</span>
              <h3 className="mt-4 mb-2 text-lg font-bold text-[#111827]">{item.title}</h3>
              <p className="text-[#667085] leading-relaxed text-sm">{item.desc}</p>
            </button>
          ))}
        </section>

        {/* Events */}
        <section id="liveNearby" className="mb-12 scroll-mt-[110px]">
          <div className="flex justify-between gap-4 items-end mb-6 max-[520px]:items-start">
            <div>
              <p className="text-[#1B5E3E] text-sm font-black uppercase tracking-wider mb-1.5">
                Live nearby
              </p>
              <h2 className="text-2xl font-bold text-[#111827]">
                Explore deals, shop drops, and delivery moments
              </h2>
            </div>
            <button
              onClick={() => document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="border-0 bg-transparent text-[#1B5E3E] font-black whitespace-nowrap hover:underline text-sm"
            >
              See details
            </button>
          </div>

          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 max-[900px]:grid-cols-1">
            {[
              {
                tag: 'Now open',
                title: 'Fresh foodstuff drop',
                desc: 'Local sellers just added rice, beans, tomatoes, vegetables, and cooking essentials.',
                meta: `${vendors.filter((v) => v.service_category === 'Groceries' || v.service_category === 'Food & Drinks').length} vendors active`,
                featured: true,
                service: 'Food & Drinks' as const,
              },
              {
                tag: 'Fast lane',
                title: 'Pharmacy essentials',
                desc: 'Order wellness basics and household health items from trusted nearby shops.',
                meta: `${vendors.filter((v) => v.service_category === 'Pharmacy').length} pharmacy vendors`,
                featured: false,
                service: 'Pharmacy' as const,
              },
              {
                tag: 'Community picks',
                title: 'Shops to explore',
                desc: 'Browse neighborhood stores, saved favorites, ratings, and item details in one place.',
                meta: `${vendors.length} vendor${vendors.length === 1 ? '' : 's'} on Sommygo`,
                featured: false,
                service: 'All' as const,
              },
            ].map((event, i) => (
              <button
                key={event.title}
                onClick={() => {
                  setActiveService(event.service);
                  setActiveCategory('all');
                  setSearchQuery('');
                  document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`text-left min-h-[190px] border border-[#e5e7eb] rounded-2xl p-6 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] animate-fade-up ${
                  event.featured
                    ? 'bg-gradient-to-br from-[#1B5E3E]/10 via-[#2A9D8F]/5 to-white border-[#1B5E3E]/20'
                    : 'bg-white'
                }`}
                style={{ animationDelay: `${i === 1 ? '90ms' : i === 2 ? '160ms' : '0ms'}` }}
              >
                <div>
                  <span className="w-fit border border-[#1B5E3E]/20 rounded-full text-[#1B5E3E] text-xs font-black px-3 py-1 inline-block bg-[#1B5E3E]/5">
                    {event.tag}
                  </span>
                  <h3 className="mt-4 mb-2 text-xl font-bold text-[#111827]">
                    {event.title}
                  </h3>
                  <p className="text-[#667085] leading-relaxed text-sm mb-4">{event.desc}</p>
                </div>
                <small className="text-[#111827] font-black text-sm">{event.meta}</small>
              </button>
            ))}
          </div>
        </section>

        {/* Store Strip */}
        <section className="mb-10">
          <div className="flex justify-between gap-4 items-end mb-5">
            <div>
              <p className="text-[#1B5E3E] text-sm font-black uppercase tracking-wider mb-1.5">
                Top stores and more
              </p>
              <h2 className="text-2xl font-bold text-[#111827]">Start with what people are exploring now</h2>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
            {vendors.length === 0 ? (
              <p className="text-sm text-[#667085]">No vendors have joined yet — check back soon.</p>
            ) : (
              vendors.slice(0, 8).map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSearchQuery(v.name);
                    document.getElementById('shop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="min-w-[140px] min-h-[70px] grid place-items-center border border-[#e5e7eb] rounded-xl bg-[#f7f8fa] text-[#111827] font-bold text-center p-3 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-[#1B5E3E]/30 cursor-pointer"
                >
                  {v.name}
                </button>
              ))
            )}
          </div>
        </section>

        {/* Category Row - only shown once real menu items have categories */}
        {availableCategories.length > 1 && (
          <section className="max-w-full flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-6">
            {availableCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`whitespace-nowrap border rounded-full font-bold px-5 py-2.5 transition-colors text-sm ${
                  activeCategory === cat.id
                    ? 'bg-[#1B5E3E] text-white border-[#1B5E3E]'
                    : 'bg-white text-[#667085] border-[#e5e7eb] hover:bg-[#1B5E3E] hover:text-white hover:border-[#1B5E3E]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </section>
        )}

        {/* Content Grid: Products + Basket */}
        <section id="shop-section" className="grid grid-cols-[1fr_minmax(300px,340px)] gap-8 items-start max-[900px]:grid-cols-1">
          {/* Products */}
          <div>
            <div className="flex justify-between gap-4 items-end mb-5">
              <div>
                <p className="text-[#1B5E3E] text-sm font-black uppercase tracking-wider mb-1.5">
                  Popular nearby
                </p>
                <h2 className="text-2xl font-bold text-[#111827]">Available items</h2>
              </div>
              <button
                onClick={() => {
                  setActiveCategory('all');
                  setActiveService('All');
                  setSearchQuery('');
                }}
                className="border-0 bg-transparent text-[#1B5E3E] font-black whitespace-nowrap hover:underline text-sm"
              >
                View all
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4 max-[520px]:grid-cols-1">
              {productsLoading ? (
                <p className="text-sm text-[#667085] py-3">Loading menu items...</p>
              ) : filteredProducts.length === 0 ? (
                <p className="text-sm text-[#667085] py-3">
                  {activeService === 'All'
                    ? 'No items available right now.'
                    : `No ${activeService} items yet — check back soon or try another category.`}
                </p>
              ) : filteredProducts.map((product, i) => (
                <article
                  key={product.id}
                  className="min-w-0 bg-white border border-[#e5e7eb] rounded-2xl overflow-hidden flex flex-col shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] animate-fade-up"
                  style={{ animationDelay: `${i === 1 ? '90ms' : i === 2 ? '160ms' : '0ms'}` }}
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full aspect-[4/3] object-cover"
                    loading="lazy"
                  />
                  <div className="px-4 pt-4 pb-2">
                    <span className="block text-[#1B5E3E] text-xs font-black mb-1">
                      {product.vendor}
                    </span>
                    <h3 className="text-base font-bold text-[#111827] mb-1">{product.name}</h3>
                    <p className="text-[#667085] text-sm leading-snug">{product.description}</p>
                  </div>
                  <footer className="mt-auto flex items-center justify-between gap-3 px-4 pt-2 pb-4">
                    <strong className="text-[#111827]">₦{(Number(product.price) || 0).toLocaleString()}</strong>
                    <button
                      onClick={() => addToBasket(product)}
                      className="rounded-full bg-[#1B5E3E] text-white font-bold px-4 py-2 hover:bg-[#144d32] transition-colors text-sm shadow-md"
                    >
                      Add
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </div>

          {/* Order Panel */}
          <aside id="basket-panel" className="sticky top-20 border border-[#e5e7eb] rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] max-[900px]:static">
            <div className="flex justify-between gap-4 items-start mb-5 mt-0">
              <div>
                <p className="text-[#1B5E3E] text-sm font-black uppercase tracking-wider mb-1.5">
                  Your basket
                </p>
                <h2 className="text-xl font-bold text-[#111827]">Quick checkout</h2>
              </div>
            </div>

            <div className="grid gap-2">
              {basket.length === 0 ? (
                <p className="text-sm text-[#667085] py-3">Your basket is empty. Add an item to get started.</p>
              ) : (
                basket.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-[#f7f8fa] flex justify-between gap-3 items-center px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[#667085] text-sm truncate">{item.name}</p>
                      <p className="text-[#9ca3af] text-xs">
                        ₦{(Number(item.price) || 0).toLocaleString()} each
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 bg-white border border-[#e5e7eb] rounded-full px-1">
                        <button
                          onClick={() => decrementBasketItem(item.menuItemId)}
                          aria-label={`Reduce ${item.name} quantity`}
                          className="w-6 h-6 grid place-items-center rounded-full text-[#1B5E3E] font-bold hover:bg-[#f7f8fa]"
                        >
                          −
                        </button>
                        <span className="min-w-[18px] text-center text-sm font-bold text-[#111827]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => incrementBasketItem(item.menuItemId)}
                          aria-label={`Increase ${item.name} quantity`}
                          className="w-6 h-6 grid place-items-center rounded-full text-[#1B5E3E] font-bold hover:bg-[#f7f8fa]"
                        >
                          +
                        </button>
                      </div>
                      <strong className="text-[#111827] whitespace-nowrap text-sm min-w-[70px] text-right">
                        ₦{(Number(item.price) * item.quantity).toLocaleString()}
                      </strong>
                      <button
                        onClick={() => removeBasketItem(item.menuItemId)}
                        aria-label={`Remove ${item.name} from basket`}
                        className="text-[#9ca3af] hover:text-red-600 text-sm px-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="my-5 grid gap-2 border-t border-[#e5e7eb] pt-4">
              <div className="flex justify-between gap-3 items-center">
                <span className="text-[#667085] text-sm">Delivery</span>
                <strong className="text-[#111827] text-sm">₦{deliveryFee.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between gap-3 items-center">
                <span className="text-[#667085] text-sm">Service fee</span>
                <strong className="text-[#111827] text-sm">₦{serviceFee.toLocaleString()}</strong>
              </div>
              <div className="flex justify-between gap-3 items-center text-base text-[#111827] pt-2">
                <span className="font-bold">Total</span>
                <strong>₦{total.toLocaleString()}</strong>
              </div>
            </div>

            {checkoutMessage && (
              <p
                className={`text-sm mb-3 ${
                  checkoutMessage.kind === 'success' ? 'text-[#1B5E3E]' : 'text-red-600'
                }`}
              >
                {checkoutMessage.text}
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={checkoutLoading || (authUser !== null && basket.length === 0)}
              className="w-full min-h-[48px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors shadow-md disabled:opacity-60"
            >
              {checkoutLoading ? 'Placing order…' : !authUser ? 'Sign in to checkout' : 'Checkout now'}
            </button>

            {/* Trusted Vendors */}
            <section className="mt-6">
              <h3 className="text-sm font-bold text-[#111827] mb-3">Trusted vendors</h3>
              {vendorsLoading ? (
                <p className="text-xs text-[#667085] py-3">Loading vendors…</p>
              ) : filteredVendors.length === 0 ? (
                <p className="text-xs text-[#667085] py-3">
                  {activeService === 'All'
                    ? 'No vendors available right now.'
                    : `No ${activeService} vendors yet.`}
                </p>
              ) : (
                filteredVendors.map((vendor) => {
                  const initials = (vendor.name ?? '')
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'V';

                  return (
                    <div key={vendor.id} className="flex items-center gap-3 py-3 border-t border-[#e5e7eb]">
                      {vendor.logo_url ? (
                        <img
                          src={vendor.logo_url}
                          alt={vendor.name}
                          className="w-9 h-9 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-9 h-9 flex-shrink-0 grid place-items-center rounded-full text-xs font-black bg-[#1B5E3E]/10 text-[#1B5E3E]">
                          {initials}
                        </span>
                      )}
                      <p className="m-0">
                        <strong className="block text-sm text-[#111827]">{vendor.name}</strong>
                        <small className="block text-[#667085] text-xs mt-0.5">
                          {vendor.avg_rating ? `${Number(vendor.avg_rating).toFixed(1)} rating` : 'New vendor'}
                          {vendor.category ? ` | ${vendor.category}` : ''}
                        </small>
                      </p>
                    </div>
                  );
                })
              )}
            </section>
          </aside>
        </section>
      </main>
      </>
      )}
    </div>
  );
}

export default App;
