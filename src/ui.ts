import chalk from "chalk";
import { select, input, confirm, password } from "@inquirer/prompts";
import type { CartLine, MenuItem, MenuItemVariant } from "./types.js";

function selectThemeWithQuitHint() {
  return {
    style: {
      keysHelpTip: (keys: [key: string, action: string][]) => {
        const parts = keys.map(([key, action]) => `${key} ${action}`);
        parts.push("q quit");
        return parts.join(chalk.gray(" • "));
      },
    },
  } as const;
}

export function formatFcfa(amount: number): string {
  const v = Math.round(amount);
  return `${v.toLocaleString("fr-FR")} FCFA`;
}

export async function promptPhone(): Promise<string> {
  return await input({
    message: "Téléphone",
    validate: (v) => (String(v).trim().length >= 9 ? true : "Numéro invalide"),
  });
}

export async function promptPin(): Promise<string> {
  return await password({
    message: "PIN",
    mask: "*",
    validate: (v) => (String(v).trim().length >= 3 ? true : "PIN invalide"),
  });
}

export type MenuCategory = "plat" | "dessert" | "boisson";

function checkboxSuffix(checked: boolean): string {
  return checked ? chalk.green(" [x]") : "";
}

export async function pickCategory(cart: CartLine[] = []): Promise<MenuCategory | "__DONE__"> {
  const hasPlat = cart.some((ln) => (ln.item.category ?? "").toLowerCase() === "plat");
  const hasDessert = cart.some((ln) => (ln.item.category ?? "").toLowerCase() === "dessert");
  const hasBoisson = cart.some((ln) => (ln.item.category ?? "").toLowerCase() === "boisson");

  return await select({
    message: "Quelle section ?",
    pageSize: 6,
    theme: selectThemeWithQuitHint(),
    choices: [
      { name: `Plats${checkboxSuffix(hasPlat)}`, value: "plat" as const },
      { name: `Desserts${checkboxSuffix(hasDessert)}`, value: "dessert" as const },
      { name: `Boissons${checkboxSuffix(hasBoisson)}`, value: "boisson" as const },
      { name: chalk.gray("Terminer (valider le panier)"), value: "__DONE__" as const },
    ],
  });
}

export type PickItemResult =
  | { kind: "done" }
  | { kind: "change_category" }
  | { kind: "item"; item: MenuItem };

function isItemOutOfStock(item: MenuItem): boolean {
  const variants = Array.isArray(item.variants) ? (item.variants as MenuItemVariant[]) : [];
  if (variants.length === 0) return false;
  const known = variants.filter((v) => typeof v.remaining_stock === "number");
  if (known.length === 0) return false;
  return known.every((v) => (v.remaining_stock ?? 0) <= 0);
}

export async function pickMenuItemInCategory(
  items: MenuItem[],
  category: MenuCategory,
  debug = false
): Promise<PickItemResult> {
  const filtered = items.filter((it) => (it.category ?? "").toLowerCase() === category);
  if (filtered.length === 0) {
    return { kind: "change_category" };
  }

  while (true) {
    const choice = await select({
      message:
        category === "plat"
          ? "Plats — choisir un item"
          : category === "dessert"
            ? "Desserts — choisir un item"
            : "Boissons — choisir un item",
      pageSize: 12,
      theme: selectThemeWithQuitHint(),
      choices: [
        ...filtered.map((it) => {
          const isOos = isItemOutOfStock(it);
          const name = isOos ? `${it.name} ${chalk.red("[Rupture]")}` : it.name;
          let description: string | undefined = it.description ?? undefined;
          if (debug) {
            const variants = Array.isArray(it.variants) ? (it.variants as MenuItemVariant[]) : [];
            const dbgLines: string[] = [];
            for (const v of variants) {
              const fmt = v.format ?? "standard";
              const formulaireRaw = v.formulaire ?? "—";
              const formulaire = Array.isArray(formulaireRaw) ? formulaireRaw.join(", ") : formulaireRaw;
              const stock = typeof v.remaining_stock === "number" ? v.remaining_stock : "?";
              dbgLines.push(
                chalk.magenta(`[DBG] ${fmt}: formulaire=${formulaire} stock=${stock}`)
              );
            }
            if (dbgLines.length > 0) {
              description = (description ? description + "\n" : "") + dbgLines.join("\n");
            }
          }
          return { name, value: it.id, description };
        }),
        { name: chalk.gray("⬅︎ Changer de section"), value: "__CHANGE__" as const },
        { name: chalk.gray("Terminer (valider le panier)"), value: "__DONE__" as const },
      ],
    });

    if (choice === "__DONE__") return { kind: "done" };
    if (choice === "__CHANGE__") return { kind: "change_category" };

    const item = filtered.find((i) => i.id === choice) ?? null;
    if (!item) return { kind: "change_category" };

    if (isItemOutOfStock(item)) {
      process.stderr.write(chalk.yellow("Item en rupture de stock. Choisissez un autre.\n"));
      continue;
    }

    return { kind: "item", item };
  }
}

function variantToPrice(variant: MenuItemVariant): number | null {
  const p = variant.price_fcfa ?? null;
  if (typeof p === "number" && Number.isFinite(p) && p >= 0) return Math.round(p);
  const b = variant.base_price_fcfa ?? null;
  if (typeof b === "number" && Number.isFinite(b) && b >= 0) return Math.round(b);
  return null;
}

export async function pickVariant(
  item: MenuItem,
  opts: { debug?: boolean; allowedFormulaire?: string | null } = {}
): Promise<{
  orderItemId: string;
  variantLabel: string;
  unitPriceFcfa: number;
}> {
  const debug = !!opts.debug;
  const allowedFormulaire =
    typeof opts.allowedFormulaire === "string" && opts.allowedFormulaire.trim() !== ""
      ? opts.allowedFormulaire.trim()
      : null;
  const variants = Array.isArray(item.variants) ? (item.variants as MenuItemVariant[]) : [];

  if (variants.length === 0) {
    const pRaw = item.price_fcfa;
    if (typeof pRaw === "number" && Number.isFinite(pRaw) && pRaw >= 0) {
      const label = pRaw === 0 ? "inclus" : "standard";
      if (debug) {
        const formulaireRaw = item.formulaire ?? "—";
        const formulaire = Array.isArray(formulaireRaw) ? formulaireRaw.join(", ") : formulaireRaw;
        process.stdout.write(chalk.magenta(`  [DBG] variant=${label} formulaire=${formulaire}\n`));
      }
      return {
        orderItemId: item.id,
        variantLabel: label,
        unitPriceFcfa: Math.round(pRaw),
      };
    }
    // Some menu rows are included/free but don't expose a numeric price.
    const name = (item.name ?? "").toString();
    if (/(OFFERT|INCLUS)/i.test(name)) {
      return { orderItemId: item.id, variantLabel: "inclus", unitPriceFcfa: 0 };
    }
    // Last-resort fallback: keep the flow going instead of aborting order creation.
    return { orderItemId: item.id, variantLabel: "inclus", unitPriceFcfa: 0 };
  }

  const variantsFiltered =
    allowedFormulaire !== null
      ? variants.filter((v) => {
          const f = v.formulaire ?? null;
          if (!f) return true; // permissive if missing
          if (Array.isArray(f)) return f.map(String).some((s) => s === allowedFormulaire);
          return String(f) === allowedFormulaire;
        })
      : variants;

  const choices = variantsFiltered
    .map((v) => {
      const price = variantToPrice(v);
      if (price === null) return null;
      const format = (v.format ?? "standard").toString();
      const stockHint = v.stock_hint ? ` · ${v.stock_hint}` : "";
      // In debug mode, append raw Airtable fields into the label (description is not always rendered).
      const formulaireRaw = v.formulaire ?? "—";
      const formulaire = Array.isArray(formulaireRaw) ? formulaireRaw.join(", ") : formulaireRaw;
      const debugSuffix = debug
        ? chalk.magenta(` · formulaire=${formulaire} · stock=${typeof v.remaining_stock === "number" ? v.remaining_stock : "?"}`)
        : "";
      return {
        name: `${format} — ${price === 0 ? "Inclus" : formatFcfa(price)}${chalk.gray(stockHint)}${debugSuffix}`,
        value: { label: format, price, id: (v.id ?? null) as string | null },
      };
    })
    .filter(Boolean) as Array<{
    name: string;
    value: { label: string; price: number; id: string | null };
  }>;

  if (choices.length === 0) {
    if (debug && variants.length > 0 && variantsFiltered.length === 0 && allowedFormulaire) {
      process.stderr.write(
        chalk.yellow(
          `Warning: no variants match formulaireAccessible=${allowedFormulaire}. Showing all variants.\n`
        )
      );
      return await pickVariant(item, { debug, allowedFormulaire: null });
    }
    // If variants exist but we couldn't extract prices, allow as included when name suggests it.
    const name = (item.name ?? "").toString();
    if (/(OFFERT|INCLUS)/i.test(name)) {
      return { orderItemId: item.id, variantLabel: "inclus", unitPriceFcfa: 0 };
    }
    // Last-resort fallback: treat as included.
    return { orderItemId: item.id, variantLabel: "inclus", unitPriceFcfa: 0 };
  }

  const v = await select({
    message: `Choisir un format pour: ${item.name}`,
    choices,
    pageSize: 10,
    theme: selectThemeWithQuitHint(),
  });

  // For plats: variants are actual Airtable `Plats` records; order must link to that table.
  // For safety, fall back to the grouped item id if variant id is missing.
  return { orderItemId: v.id ?? item.id, variantLabel: v.label, unitPriceFcfa: v.price };
}

export async function promptQuantity(defaultValue = 1): Promise<number> {
  const v = await input({
    message: "Quantité",
    default: String(defaultValue),
    validate: (raw) => {
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) return "Entrez un entier > 0";
      if (n > 50) return "Trop grand";
      return true;
    },
  });
  return Number(v);
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, ln) => sum + ln.unitPriceFcfa * ln.quantity, 0);
}

export function renderCart(cart: CartLine[]): string {
  if (cart.length === 0) return chalk.gray("(panier vide)");
  const lines = cart.map((ln) => {
    const lineTotal = ln.unitPriceFcfa * ln.quantity;
    const priceLabel = lineTotal === 0 ? "Inclus" : formatFcfa(lineTotal);
    return `- ${ln.item.name} (${ln.variantLabel}) x${ln.quantity} — ${priceLabel}`;
  });
  return lines.join("\n");
}

export async function confirmCart(cart: CartLine[]): Promise<boolean> {
  const total = cartTotal(cart);
  return await confirm({
    message: `Valider le panier (${formatFcfa(total)}) ?`,
    default: true,
  });
}

export async function promptAddress(defaultAddress?: string | null): Promise<string> {
  const saved = typeof defaultAddress === "string" ? defaultAddress.trim() : "";
  if (saved.length >= 3) {
    const choice = await select({
      message: "Adresse de livraison",
      theme: selectThemeWithQuitHint(),
      choices: [
        { name: `Utiliser: ${saved}`, value: "use_saved" as const },
        { name: "Saisir une autre adresse", value: "type_new" as const },
      ],
    });
    if (choice === "use_saved") return saved;
    return await input({
      message: "Adresse de livraison",
      default: saved,
      validate: (v) => (String(v).trim().length >= 3 ? true : "Adresse trop courte"),
    });
  }

  return await input({
    message: "Adresse de livraison",
    validate: (v) => (String(v).trim().length >= 3 ? true : "Adresse trop courte"),
  });
}

export async function promptDateYmd(defaultDate: string): Promise<string> {
  return await input({
    message: "Date de livraison (YYYY-MM-DD)",
    default: defaultDate,
    validate: (v) =>
      /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? true : "Format attendu: YYYY-MM-DD",
  });
}

