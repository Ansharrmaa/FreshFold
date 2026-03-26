// ============================================================
//  js/i18n.js — Multi-Language Support (English / Hindi)
// ============================================================

const TRANSLATIONS = {
  en: {
    home: 'Home', services: 'Services', bookNow: 'Book Now', trackOrder: 'Track Order',
    schedulePkp: 'Schedule Pickup', login: 'Login', heroTitle: 'Fresh Clothes,',
    heroAccent: 'Zero Effort.', heroSub: 'Premium ironing, laundry & dry cleaning delivered back to your door. The faster you need it, the smarter we price it.',
    bookPickup: 'Book a Pickup', viewPricing: 'View Pricing',
    happyCustomers: 'Happy Customers', avgRating: 'Avg Rating', expressAvail: 'Express Available',
    howItWorks: 'How It Works', step1: 'Schedule Pickup', step1d: 'Choose your slot and we\'ll come to your door',
    step2: 'We Clean', step2d: 'Professional cleaning with premium products',
    step3: 'Get Delivery', step3d: 'Fresh clothes delivered back to you',
    whyChoose: 'Why Choose FreshFold?', subscriptionPlans: 'Subscription Plans',
    starter: 'Starter', pro: 'Pro', family: 'Family', choosePlan: 'Choose Plan',
    installApp: 'Install FreshFold — Get the app experience on your phone!', installNow: 'Install Now',
    profileBtn: 'My Profile', myOrders: 'My Orders', wallet: 'Wallet', logOut: 'Log Out'
  },
  hi: {
    home: 'होम', services: 'सेवाएं', bookNow: 'अभी बुक करें', trackOrder: 'ऑर्डर ट्रैक करें',
    schedulePkp: 'पिकअप शेड्यूल करें', login: 'लॉगिन', heroTitle: 'ताज़े कपड़े,',
    heroAccent: 'बिना मेहनत।', heroSub: 'प्रीमियम इस्त्री, धुलाई और ड्राई क्लीनिंग आपके दरवाज़े तक। जितनी जल्दी चाहिए, उतनी स्मार्ट कीमत।',
    bookPickup: 'पिकअप बुक करें', viewPricing: 'कीमतें देखें',
    happyCustomers: 'खुश ग्राहक', avgRating: 'औसत रेटिंग', expressAvail: 'एक्सप्रेस उपलब्ध',
    howItWorks: 'कैसे काम करता है', step1: 'पिकअप शेड्यूल करें', step1d: 'अपना स्लॉट चुनें, हम आपके दरवाज़े पर आएंगे',
    step2: 'हम साफ़ करते हैं', step2d: 'प्रीमियम उत्पादों से पेशेवर सफाई',
    step3: 'डिलीवरी पाएं', step3d: 'ताज़ा कपड़े आपके पास वापस',
    whyChoose: 'FreshFold क्यों चुनें?', subscriptionPlans: 'सदस्यता योजनाएं',
    starter: 'स्टार्टर', pro: 'प्रो', family: 'फैमिली', choosePlan: 'योजना चुनें',
    installApp: 'FreshFold इंस्टॉल करें — ऐप अनुभव पाएं!', installNow: 'अभी इंस्टॉल करें',
    profileBtn: 'मेरी प्रोफ़ाइल', myOrders: 'मेरे ऑर्डर', wallet: 'वॉलेट', logOut: 'लॉग आउट'
  }
};

let currentLang = localStorage.getItem('ff_lang') || 'en';

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('ff_lang', lang);
  
  const t = TRANSLATIONS[lang];
  if (!t) return;

  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key]) el.textContent = t[key];
  });

  // Update lang toggle button
  const toggle = document.getElementById('langToggle');
  if (toggle) {
    toggle.textContent = lang === 'en' ? 'हिं' : 'EN';
    toggle.title = lang === 'en' ? 'Switch to Hindi' : 'Switch to English';
  }
}

function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'hi' : 'en');
}

// Auto-apply on page load
document.addEventListener('DOMContentLoaded', () => {
  if (currentLang !== 'en') setLanguage(currentLang);
});
