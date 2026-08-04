import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, Bike, Check, MapPin, Mic2, Phone, ShoppingBag, Store, Users, MessageCircle } from 'lucide-react';
import './styles.css';

const features = [
  { icon: MessageCircle, label: 'WhatsApp carts', text: 'Order from familiar chats without installing another app.' },
  { icon: Mic2, label: 'Voice ordering', text: 'Say what you need and let useMarket help build your basket.' },
  { icon: Store, label: 'Local vendors', text: 'Discover nearby markets, food sellers, pharmacies and stores.' },
  { icon: Bike, label: 'Reliable delivery', text: 'Registered riders move orders quickly and keep every tip.' },
];

const audiences = [
  { eyebrow: 'For customers', title: 'Everything nearby, without the market stress.', text: 'Shop across vendors, pay securely and follow your delivery from one simple experience.', bullets: ['Multi-vendor baskets', 'Card and bank transfer', 'Standard, scheduled and express delivery'], icon: ShoppingBag },
  { eyebrow: 'For vendors', title: 'More customers. Better tools. Easier growth.', text: 'Manage products, receive orders and use AI-powered advertising tools to reach the right buyers.', bullets: ['Simple catalogue management', 'Order and sales dashboard', 'AI Ads Studio'], icon: Store },
  { eyebrow: 'For riders', title: 'Clear jobs and fairer earnings.', text: 'Accept nearby deliveries, see expected pay before starting and keep 100% of customer tips.', bullets: ['Transparent delivery offers', 'Route and pickup guidance', '100% tip ownership'], icon: Bike },
];

function LowPolyScene() {
  return (
    <div className="scene" aria-label="Low-poly useMarket delivery illustration">
      <div className="poly poly-one" />
      <div className="poly poly-two" />
      <div className="market-card">
        <div className="mini-store"><Store size={42} /></div>
        <div className="route-line" />
        <div className="mini-rider"><Bike size={38} /></div>
        <div className="pin"><MapPin size={38} /></div>
      </div>
    </div>
  );
}

function App() {
  const joinWaitlist = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get('email');
    const subject = encodeURIComponent('useMarket waitlist');
    const body = encodeURIComponent(`Please add ${email} to the useMarket waitlist.`);
    window.location.href = `mailto:hello@usemarket.com?subject=${subject}&body=${body}`;
  };

  return (
    <main>
      <nav className="nav wrap">
        <a className="brand" href="#top" aria-label="useMarket home">
          <img src="/usemarket-logo.jpg" alt="useMarket" />
          <span>useMarket</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#everyone">For everyone</a>
          <a href="#waitlist" className="nav-cta">Join waitlist</a>
        </div>
      </nav>

      <section className="hero wrap" id="top">
        <div className="hero-copy">
          <span className="pill"><span className="pulse" /> Launching in Ibadan, Akure & Sango Ota</span>
          <h1>Your market.<br /><em>Without stress.</em></h1>
          <p>Buy from trusted local vendors, order by app, WhatsApp or voice, and get everything delivered by registered riders.</p>
          <div className="hero-actions">
            <a href="#waitlist" className="button primary">Join the waitlist <ArrowRight size={18} /></a>
            <a href="#how" className="button secondary">See how it works</a>
          </div>
          <div className="trust"><Users size={18} /> Built for customers, vendors and riders</div>
        </div>
        <LowPolyScene />
      </section>

      <section className="feature-strip" id="how">
        <div className="wrap feature-grid">
          {features.map(({ icon: Icon, label, text }) => (
            <article className="feature" key={label}>
              <div className="icon-box"><Icon size={24} /></div>
              <div><h3>{label}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="section wrap" id="everyone">
        <div className="section-heading">
          <span className="kicker">One connected marketplace</span>
          <h2>Designed for everyone who makes local commerce work.</h2>
        </div>
        <div className="audience-grid">
          {audiences.map(({ eyebrow, title, text, bullets, icon: Icon }, index) => (
            <article className={`audience-card card-${index + 1}`} key={eyebrow}>
              <div className="audience-art"><Icon size={52} /></div>
              <span>{eyebrow}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ul>{bullets.map(item => <li key={item}><Check size={16} /> {item}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="no-download">
        <div className="wrap no-download-grid">
          <div>
            <span className="kicker light">No new app required</span>
            <h2>Order through WhatsApp or simply say what you need.</h2>
            <p>useMarket meets customers where they already are. Start a cart in WhatsApp or use voice ordering, then complete payment and delivery with less friction.</p>
            <div className="channel-row">
              <span><MessageCircle size={20} /> WhatsApp carts</span>
              <span><Mic2 size={20} /> Voice ordering</span>
            </div>
          </div>
          <div className="phone-card">
            <div className="phone-top"><span>useMarket Assistant</span><Phone size={18} /></div>
            <div className="bubble user">I need rice, tomatoes and chicken.</div>
            <div className="bubble bot">I found nearby options. Your basket is ready to review.</div>
            <div className="voice-bar"><Mic2 size={20} /><span>Hold to order by voice</span></div>
          </div>
        </div>
      </section>

      <section className="section wrap cities">
        <div>
          <span className="kicker">Pilot launch</span>
          <h2>Starting locally. Built to scale.</h2>
          <p>Operations begin across three Nigerian cities with local vendors, riders and market teams working together.</p>
        </div>
        <div className="city-list">
          {['Ibadan', 'Akure', 'Sango Ota'].map(city => <span key={city}><MapPin size={18} /> {city}</span>)}
        </div>
      </section>

      <section className="waitlist" id="waitlist">
        <div className="wrap waitlist-inner">
          <div>
            <span className="kicker light">Be first in your city</span>
            <h2>Join the useMarket waitlist.</h2>
            <p>Get launch updates and early access for customers, vendors and riders.</p>
          </div>
          <form onSubmit={joinWaitlist}>
            <input type="email" name="email" placeholder="you@example.com" required aria-label="Email address" />
            <button type="submit">Join waitlist <ArrowRight size={18} /></button>
          </form>
        </div>
      </section>

      <footer className="footer wrap">
        <a className="brand" href="#top"><img src="/usemarket-logo.jpg" alt="" /><span>useMarket</span></a>
        <p>Market without stress.</p>
        <div><a href="https://usemarket-privacy-policy.tradebridge001.chatgpt.site">Privacy Policy</a><span>© 2026 useMarket</span></div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
