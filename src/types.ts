export type Session = {
  baseUrl: string;
  token: string;
  user: {
    id: string;
    username: string;
    fullname?: string | null;
    company_id?: string | null;
    company_name?: string | null;
    /** Airtable: "Formulaire accessible" */
    formulaireAccessible?: string | null;
    /** Airtable: "Formats accessibles" (normalized server-side) */
    formatsAccessibles?: string | null;
    /** Airtable: "Formats abonnement actif" */
    formatsAbonnementActif?: string | null;
    /** Airtable: "Derniere adresse" */
    lastAddress?: string | null;
  };
  createdAt: string;
  /** ISO timestamp of last `/auth/me` refresh (best-effort) */
  userRefreshedAt?: string | null;
};

export type MenuItemVariant = {
  format?: string | null;
  price_fcfa?: number | null;
  base_price_fcfa?: number | null;
  remaining_stock?: number | null;
  stock_hint?: string | null;
  /** Airtable "Formulaire" field — e.g. ["f1-standard"] or "f2-abonne-classique" */
  formulaire?: string | string[] | null;
};

export type MenuItem = {
  id: string;
  category?: string | null;
  name: string;
  description?: string | null;
  allergens?: string | null;
  variants?: MenuItemVariant[] | null;
  price_fcfa?: number | null;
  /** Top-level formulaire for items without variants (e.g. Boissons, Desserts) */
  formulaire?: string | string[] | null;
};

export type CartLine = {
  item: MenuItem;
  variantLabel: string;
  unitPriceFcfa: number;
  quantity: number;
};

