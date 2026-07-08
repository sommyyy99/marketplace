import { useState, useMemo, useCallback, useEffect } from 'react';
import type { User as SupaUser } from '@supabase/supabase-js';
import { supabase } from './integrations/supabase/client';
import { AuthModal } from './components/AuthModal';

interface VendorRow {
  id: string;
  name: string;
  avg_rating: number | null;
  logo_url: string | null;
  category: string | null;
}
import bakedChicken from './assets/images/Baked-Chicken-Legs-7-of-7-750x750.jpg';
import egusiSoup from './assets/images/494555509_4031516693793297_2131975294073460328_n.jpg';
import jollofRice from './assets/images/delicious-jollof-rice-with-grilled-chicken-and-fried-plantains-photo.jpg';
import wrapsBurgers from './assets/images/image copy copy.png';
import deliveryBike from './assets/images/delivery-bike.png';
import deliveryTruck from './assets/images/delivery-truck.png';
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
  categories,
  products,
  initialBasketItems,
  deliveryFee,
  serviceFee,
} from './data/products';
import type { Product } from './data/products';

interface BasketItem {
  id: string;
  name: string;
  price: number;
}

function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [basket, setBasket] = useState<BasketItem[]>(initialBasketItems);
  const [activeNav, setActiveNav] = useState('Market');
  const [activeService, setActiveService] = useState('Food');
  const [cityOpen, setCityOpen] = useState(false);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<SupaUser | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) {
      setProfileName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', authUser.id)
        .maybeSingle();
      if (!cancelled) {
        setProfileName(
          data?.full_name ||
            (authUser.user_metadata?.full_name as string | undefined) ||
            authUser.email ||
            null,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAccountMenuOpen(false);
  };


  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, avg_rating, logo_url, category')
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

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products;
    return products.filter((p) => p.category === activeCategory);
  }, [activeCategory]);

  const addToBasket = useCallback((product: Product) => {
    setBasket((prev) => [
      ...prev,
      {
        id: `${product.id}-${Date.now()}`,
        name: product.name,
        price: product.price,
      },
    ]);
  }, []);

  const total = useMemo(() => {
    return basket.reduce((sum, item) => sum + item.price, 0) + deliveryFee + serviceFee;
  }, [basket]);

  const navItems = [
    { label: 'Market', icon: Store },
    { label: 'Orders', icon: ClipboardList },
    { label: 'Saved', icon: Heart },
    { label: 'Vendors', icon: Users },
    { label: 'Account', icon: User },
  ];

  const services = ['Food', 'Groceries', 'Pharmacy', 'Shops'];

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
            <button className="w-10 h-10 grid place-items-center rounded-full bg-white border border-[#e5e7eb] shadow-sm hover:shadow-md transition-shadow">
              <ShoppingCart className="w-5 h-5 text-[#1B5E3E]" />
            </button>
            <button className="w-10 h-10 grid place-items-center rounded-full bg-[#1B5E3E] text-white shadow-lg hover:bg-[#144d32] transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Address Bar */}
        <div className="max-w-[800px] mx-auto mt-6">
          <div className="flex items-center gap-3 bg-white rounded-full px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)] border border-[#e5e7eb]">
            <button className="flex items-center gap-2 bg-[#f7f8fa] border border-[#e5e7eb] text-[#1B5E3E] font-bold px-5 py-2 rounded-full hover:bg-[#1B5E3E] hover:text-white hover:border-[#1B5E3E] transition-colors whitespace-nowrap text-sm flex-shrink-0">
              <Search className="w-4 h-4" />
              Search
            </button>
            <MapPin className="w-5 h-5 text-[#1B5E3E] flex-shrink-0" />
            <input
              type="text"
              placeholder="Enter a delivery address"
              className="flex-1 min-w-0 border-0 outline-0 text-[#111827] placeholder:text-[#9ca3af] text-base bg-transparent"
            />
            <button className="bg-[#1B5E3E] text-white font-bold px-6 py-2.5 rounded-full hover:bg-[#144d32] transition-colors whitespace-nowrap text-sm flex-shrink-0">
              Order now
            </button>
          </div>
        </div>

        {/* Headline under address bar */}
        <h1 className="text-center text-[clamp(2rem,5vw,3.5rem)] font-black text-[#111827] tracking-tight mt-6">
          Food delivery and more
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



          {/* Food Truck - left to right */}
          <div className="absolute bottom-[18px]" style={{ animation: 'truckRight 18s linear infinite', animationDelay: '2s' }}>
            <img src={deliveryTruck} alt="Food delivery truck" className="w-[200px] h-auto drop-shadow-lg" />
          </div>

          {/* Delivery Motorcycle 2 - right to left, offset */}
          <div className="absolute bottom-[16px]" style={{ animation: 'bikeLeft 16s linear infinite', animationDelay: '5s' }}>
            <img src={deliveryBike} alt="Delivery scooter" className="w-[160px] h-auto drop-shadow-lg" />
          </div>

        </div>
      </header>

      {/* Secondary Nav */}
      <nav className="bg-white border-b border-[#e5e7eb] px-6 py-3 sticky top-0 z-10">
        <div className="max-w-[1200px] mx-auto flex gap-6 items-center overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const isActive = activeNav === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setActiveNav(item.label)}
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
        </div>
      </nav>

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
                Groceries, shops, pharmaceuticals and more — delivered to your doorstep in minutes.
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

              <button className="mt-6 min-h-[50px] rounded-full bg-[#1B5E3E] text-white font-bold px-8 shadow-[0_10px_30px_rgba(27,94,62,0.3)] hover:bg-[#144d32] transition-colors">
                Start shopping
              </button>
            </div>

            <div className="relative animate-fade-up animation-delay-120 max-[900px]:order-first">
              <div className="grid grid-cols-2 gap-3 rounded-3xl">
                <div className="relative overflow-hidden rounded-2xl aspect-square shadow-lg group">
                  <img
                    src={bakedChicken}
                    alt="Barbecue chicken"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-bold text-sm">Barbecue Chicken</p>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl aspect-square shadow-lg group">
                  <img
                    src={egusiSoup}
                    alt="Egusi soup"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-bold text-sm">Egusi Soup</p>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl aspect-square shadow-lg group">
                  <img
                    src={jollofRice}
                    alt="Jollof rice"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-bold text-sm">Jollof Rice</p>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-2xl aspect-square shadow-lg group">
                  <img
                    src={wrapsBurgers}
                    alt="Shawarma"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-bold text-sm">Shawarma</p>
                  </div>
                </div>
              </div>
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
            },
            {
              num: '02',
              title: 'Track every step',
              desc: 'Follow pickup, rider movement, and delivery status from store to doorstep.',
            },
            {
              num: '03',
              title: 'Explore local details',
              desc: 'See vendors, ratings, active drops, delivery estimates, and item details fast.',
            },
          ].map((item, i) => (
            <article
              key={item.num}
              className="border border-[#e5e7eb] rounded-2xl bg-white p-6 shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] animate-fade-up"
              style={{ animationDelay: `${i === 1 ? '90ms' : i === 2 ? '160ms' : '0ms'}` }}
            >
              <span className="text-[#1B5E3E] text-sm font-black">{item.num}</span>
              <h3 className="mt-4 mb-2 text-lg font-bold text-[#111827]">{item.title}</h3>
              <p className="text-[#667085] leading-relaxed text-sm">{item.desc}</p>
            </article>
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
            <button className="border-0 bg-transparent text-[#1B5E3E] font-black whitespace-nowrap hover:underline text-sm">
              See details
            </button>
          </div>

          <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-4 max-[900px]:grid-cols-1">
            {[
              {
                tag: 'Now open',
                title: 'Fresh foodstuff drop',
                desc: 'Local sellers just added rice, beans, tomatoes, vegetables, and cooking essentials.',
                meta: '12 vendors active',
                featured: true,
              },
              {
                tag: 'Fast lane',
                title: 'Pharmacy essentials',
                desc: 'Order wellness basics and household health items from trusted nearby shops.',
                meta: '25-40 min delivery',
                featured: false,
              },
              {
                tag: 'Community picks',
                title: 'Shops to explore',
                desc: 'Browse neighborhood stores, saved favorites, ratings, and item details in one place.',
                meta: 'Updated today',
                featured: false,
              },
            ].map((event, i) => (
              <article
                key={event.title}
                className={`min-h-[190px] border border-[#e5e7eb] rounded-2xl p-6 flex flex-col justify-between shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] animate-fade-up ${
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
              </article>
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
            {['Mama Tola Foods', 'Green Basket', 'QuickMeds', 'Daily Needs', 'Bukateria Hub', 'Farm Gate'].map(
              (store) => (
                <span
                  key={store}
                  className="min-w-[140px] min-h-[70px] grid place-items-center border border-[#e5e7eb] rounded-xl bg-[#f7f8fa] text-[#111827] font-bold text-center p-3 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:border-[#1B5E3E]/30 cursor-pointer"
                >
                  {store}
                </span>
              )
            )}
          </div>
        </section>

        {/* Category Row */}
        <section className="max-w-full flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-6">
          {categories.map((cat) => (
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

        {/* Content Grid: Products + Basket */}
        <section className="grid grid-cols-[1fr_minmax(300px,340px)] gap-8 items-start max-[900px]:grid-cols-1">
          {/* Products */}
          <div>
            <div className="flex justify-between gap-4 items-end mb-5">
              <div>
                <p className="text-[#1B5E3E] text-sm font-black uppercase tracking-wider mb-1.5">
                  Popular nearby
                </p>
                <h2 className="text-2xl font-bold text-[#111827]">Available items</h2>
              </div>
              <button className="border-0 bg-transparent text-[#1B5E3E] font-black whitespace-nowrap hover:underline text-sm">
                View all
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4 max-[520px]:grid-cols-1">
              {filteredProducts.map((product, i) => (
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
                    <strong className="text-[#111827]">₦{product.price.toLocaleString()}</strong>
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
          <aside className="sticky top-20 border border-[#e5e7eb] rounded-2xl bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.06)] max-[900px]:static">
            <div className="flex justify-between gap-4 items-start mb-5 mt-0">
              <div>
                <p className="text-[#1B5E3E] text-sm font-black uppercase tracking-wider mb-1.5">
                  Your basket
                </p>
                <h2 className="text-xl font-bold text-[#111827]">Quick checkout</h2>
              </div>
            </div>

            <div className="grid gap-2">
              {basket.map((item) => (
                <div
                  key={item.id}
                  className="min-h-[44px] rounded-xl bg-[#f7f8fa] flex justify-between gap-3 items-center px-3 py-2"
                >
                  <span className="text-[#667085] text-sm">{item.name}</span>
                  <strong className="text-[#111827] whitespace-nowrap text-sm">₦{item.price.toLocaleString()}</strong>
                </div>
              ))}
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

            <button className="w-full min-h-[48px] rounded-full bg-[#1B5E3E] text-white font-bold hover:bg-[#144d32] transition-colors shadow-md">
              Checkout now
            </button>

            {/* Trusted Vendors */}
            <section className="mt-6">
              <h3 className="text-sm font-bold text-[#111827] mb-3">Trusted vendors</h3>
              {vendorsLoading ? (
                <p className="text-xs text-[#667085] py-3">Loading vendors…</p>
              ) : vendors.length === 0 ? (
                <p className="text-xs text-[#667085] py-3">No vendors available right now.</p>
              ) : (
                vendors.map((vendor) => {
                  const initials = vendor.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
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
    </div>
  );
}

export default App;
