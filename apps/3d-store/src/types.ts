export type Wall = 'north' | 'east' | 'west' | 'south';
export type DisplayType = 'rack' | 'shelf' | 'pegboard';

export interface StoreInfo {
  id: string;
  /** GTM tenant (Supabase client_id) whose products these are — goes into the Messenger ref (s_<tenantId>__…) and the WhatsApp text (শপ কোড) so the bot can look the SKUs up. */
  tenantId: string;
  /** send the dataLayer events to /api/event (Pages Function -> Supabase store_events); default off */
  analytics?: boolean;
  name: string;
  tagline: string;
  primaryColor: string;
  logo: string;
  messengerPage: string;
  whatsappNumber: string;
}

export interface Section {
  id: string;
  label: string;
  display: DisplayType;
  wall: Wall;
}

export interface Product {
  sku: string;
  section: string;
  name: string;
  price: number;
  sizes: string[];
  stock: number;
  image: string;
  badge?: string;
  viewsToday?: number;
}

export interface Poster {
  text: string;
  sub?: string;
  wall: Wall;
  /** -1 (left) .. 1 (right) along the wall */
  offset: number;
}

export interface StoreData {
  store: StoreInfo;
  sections: Section[];
  products: Product[];
  posters: Poster[];
}

export interface CartItem {
  sku: string;
  qty: number;
  size?: string;
}
