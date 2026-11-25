import {
  Apple,
  Baby,
  Bike,
  BookOpen,
  Car,
  Dumbbell,
  Film,
  Gem,
  Home,
  Laptop,
  Pill,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Tag,
  Watch,
  Wrench,
} from 'lucide-react';

const RULES = [
  [/phone|smart|mobile|tablet/i, Smartphone],
  [/computer|laptop|electronic|gadget/i, Laptop],
  [/furniture|sofa|chair/i, Sofa],
  [/home|decor|kitchen|pantry/i, Home],
  [/fitness|gym|sport|outdoor/i, Dumbbell],
  [/fashion|apparel|cloth|wear/i, Shirt],
  [/health|vitamin|supplement|personal care|beauty/i, Pill],
  [/toy|kid|baby/i, Baby],
  [/bike|bicycle|motor/i, Bike],
  [/movie|music|entertainment/i, Film],
  [/book|stationery/i, BookOpen],
  [/jewel|fine/i, Gem],
  [/auto|vehicle|car/i, Car],
  [/tool|equipment|hardware/i, Wrench],
  [/fresh|produce|food|grocery/i, Apple],
  [/basket|supermarket/i, ShoppingBasket],
  [/watch|accessor/i, Watch],
  [/beauty|care/i, Sparkles],
];

export const CATEGORY_TONES = [
  'from-[#263C97] via-[#3B5BB5] to-[#7C9BE8]',
  'from-[#0FA5C3] via-[#16BCDC] to-[#8CE4F3]',
  'from-[#8A6A00] via-[#E9AD00] to-[#FFD873]',
  'from-[#2F3037] via-[#5A5C66] to-[#A8AAB3]',
  'from-[#1F6B3B] via-[#5AAB19] to-[#AEDB86]',
  'from-[#B01212] via-[#CC1414] to-[#F08A8A]',
];

export function getCategoryIcon(name = '') {
  const match = RULES.find(([pattern]) => pattern.test(name));
  return match ? match[1] : Tag;
}

export function categoryHref(category, vendorId) {
  const params = new URLSearchParams({
    category: category.slug || category.id,
  });
  if (vendorId) params.set('vendor_store', vendorId);
  return `/shop?${params.toString()}`;
}
