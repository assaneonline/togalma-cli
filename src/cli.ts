import { Command } from "commander";
import ora from "ora";
import chalk from "chalk";
import open from "open";
import { confirm as inqConfirm } from "@inquirer/prompts";
import readline from "node:readline";
import {
  promptPhone,
  promptPin,
  pickCategory,
  pickMenuItemInCategory,
  pickVariant,
  promptQuantity,
  confirmCart,
  promptAddress,
  promptDateYmd,
  renderCart,
  cartTotal,
  formatFcfa,
} from "./ui.js";
import { baseUrlFromEnvOrFlag, ensureHttps, HttpError } from "./http.js";
import * as api from "./api.js";
import { clearSession, loadSession, saveSession } from "./session.js";
import type { CartLine, Session } from "./types.js";
import { CLI_VERSION } from "./version.js";
import { checkForUpdates } from "./updates.js";
import { playMenuSplash } from "./splash.js";

// Avoid crashing when stdout is piped and downstream closes early (e.g. `| head`).
process.stdout.on("error", (err: any) => {
  if (err?.code === "EPIPE") process.exit(0);
});

// Global quit: allow pressing "q" to exit from anywhere (select/input/confirm).
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  if (typeof process.stdin.setRawMode === "function") process.stdin.setRawMode(true);

  process.stdin.on("keypress", (_str, key: any) => {
    if (!key) return;
    if (key.ctrl || key.meta || key.shift) return;
    if (key.name === "q") {
      process.stderr.write(chalk.gray("\nQuit.\n"));
      process.exit(0);
    }
  });
}

function todayYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function requireSession(): Promise<Session> {
  const s = await loadSession();
  if (!s) {
    throw new Error("Not logged in. Run: togalma auth login");
  }
  // Refresh user payload periodically so "Formulaire accessible" and other fields stay up-to-date.
  try {
    const ttlMs = 10 * 60 * 1000;
    const last = s.userRefreshedAt ? Date.parse(s.userRefreshedAt) : NaN;
    const due = !Number.isFinite(last) || Date.now() - last > ttlMs;
    if (due) {
      const fresh = await api.me(s.baseUrl, s.token);
      if (fresh?.user?.id) {
        s.user = fresh.user as any;
        s.userRefreshedAt = new Date().toISOString();
        await saveSession(s);
      }
    }
  } catch {
    // best-effort: ignore refresh failures
  }
  return s;
}

function printHttpError(e: unknown) {
  if (e instanceof HttpError) {
    const msg =
      typeof (e.body as any)?.error === "string" ? (e.body as any).error : e.message;
    process.stderr.write(chalk.red(`Error: ${msg}\n`));
    return;
  }
  process.stderr.write(chalk.red(`Error: ${(e as any)?.message ?? String(e)}\n`));
}

async function wavePayFlow(session: Session, orderId: string, timeoutSecondsRaw: string | number = 600) {
  const { checkout_url } = await api.waveCheckoutUrl(session, orderId);

  process.stdout.write(`Opening: ${checkout_url}\n`);
  await open(checkout_url);

  const timeoutSeconds = typeof timeoutSecondsRaw === "string" ? Number(timeoutSecondsRaw) : timeoutSecondsRaw;
  const deadline = Date.now() + Math.max(10, timeoutSeconds) * 1000;

  const spinner = ora("Waiting for payment confirmation...").start();
  while (Date.now() < deadline) {
    const st = await api.payStatus(session, orderId);
    if (st.paid) {
      spinner.succeed(`Paid (${st.payment_status})`);
      return;
    }
    spinner.text = `Waiting... (${st.payment_status || "unknown"})`;
    await new Promise((r) => setTimeout(r, 3000));
  }
  spinner.fail("Timed out waiting for payment.");
  process.exitCode = 2;
}

async function interactiveOrderFromItems(s: Session, items: any[], defaultDate: string, debug = false) {
  if (items.length === 0) {
    process.stdout.write("Menu is empty.\n");
    return;
  }

  const cart: CartLine[] = [];

  if (process.stdin.isTTY && process.stdout.isTTY) {
    process.stdout.write(chalk.gray("Tip: press q to quit at any time.\n"));
  }

  // TUI loop: pick category -> pick item -> pick variant -> qty -> add
  while (true) {
    process.stdout.write(chalk.cyan("\nCurrent cart:\n"));
    process.stdout.write(renderCart(cart) + "\n");
    process.stdout.write(chalk.cyan(`Total: ${formatFcfa(cartTotal(cart))}\n\n`));

    const category = await pickCategory(cart);
    if (category === "__DONE__") break;

    const picked = await pickMenuItemInCategory(items, category, debug);
    if (picked.kind === "done") break;
    if (picked.kind === "change_category") continue;
    const item = picked.item;

    try {
      const { variantLabel, unitPriceFcfa, orderItemId } = await pickVariant(item, {
        debug,
        allowedFormulaire: s.user?.formulaireAccessible ?? null,
      });
      const quantity = await promptQuantity(1);

      const existing = cart.find(
        (ln) => ln.orderItemId === orderItemId && ln.variantLabel === variantLabel
      );
      if (existing) {
        existing.quantity += quantity;
      } else {
        cart.push({ item, orderItemId, variantLabel, unitPriceFcfa, quantity });
      }
    } catch (e) {
      // Never abort the whole order flow for a single item issue.
      const msg = (e as any)?.message ?? String(e);
      process.stderr.write(chalk.yellow(`Warning: ${msg}\n`));
      continue;
    }
  }

  if (cart.length === 0) {
    process.stdout.write("Cancelled (empty cart).\n");
    return;
  }

  process.stdout.write(chalk.cyan("\nFinal cart:\n"));
  process.stdout.write(renderCart(cart) + "\n");
  process.stdout.write(chalk.cyan(`Total: ${formatFcfa(cartTotal(cart))}\n\n`));

  const ok = await confirmCart(cart);
  if (!ok) {
    process.stdout.write("Cancelled.\n");
    return;
  }

  const address = await promptAddress(s.user?.lastAddress ?? null);
  const requested_delivery_date = await promptDateYmd(defaultDate);

  const payload = {
    requested_delivery_date,
    address,
    dishes: cart
      .filter((ln) => (ln.item.category ?? "").toLowerCase() === "plat")
      .map((ln) => ({
        id: ln.orderItemId,
        quantity: ln.quantity,
      })),
    desserts: cart
      .filter((ln) => (ln.item.category ?? "").toLowerCase() === "dessert")
      .map((ln) => ({
        id: ln.orderItemId,
        quantity: ln.quantity,
      })),
    drinks: cart
      .filter((ln) => (ln.item.category ?? "").toLowerCase() === "boisson")
      .map((ln) => ({
        id: ln.orderItemId,
        quantity: ln.quantity,
      })),
  };

  const creating = ora("Creating order...").start();
  const created = await api.createOrder(s, payload);
  creating.succeed(`Order created: ${created.order_id}`);
  process.stdout.write(`Wave checkout: ${created.checkout_url}\n`);

  // Cache last created order locally to support `togalma order pay` without an id.
  try {
    s.lastOrder = { id: created.order_id, createdAt: new Date().toISOString() };
    await saveSession(s);
  } catch {
    // best-effort
  }

  process.stdout.write("\n");
  if (process.stdout.isTTY) {
    const payNow = await inqConfirm({
      message: "Pay now with Wave?",
      default: true,
    });
    if (payNow) {
      await wavePayFlow(s, created.order_id, 600);
      return;
    }
  }

  process.stdout.write(`Tip: Pay later with: togalma order pay ${created.order_id}\n`);
}

async function resolveRecentOrderIdOrThrow(s: Session): Promise<string> {
  const windowMs = 5 * 60 * 1000;

  const local = s.lastOrder ?? null;
  if (local?.id && local?.createdAt) {
    const t = Date.parse(local.createdAt);
    if (Number.isFinite(t) && Date.now() - t <= windowMs) {
      return local.id;
    }
  }

  // Fallback: ask the API for recent orders.
  const res = (await api.listOrders(s, 5)) as any;
  const list = Array.isArray(res?.orders) ? res.orders : [];
  for (const o of list) {
    const id = String(o?.id ?? o?.order_id ?? "").trim();
    const dateRaw = String(o?.date ?? o?.Date ?? "").trim();
    if (!id || !dateRaw) continue;
    const t = Date.parse(dateRaw);
    if (!Number.isFinite(t)) continue;
    if (Date.now() - t <= windowMs) {
      return id;
    }
  }

  throw new Error("No recent order found (last 5 minutes). Provide an id: togalma order pay <orderId>");
}

const program = new Command();
program.name("togalma").description("Order lunch from your terminal.").version(CLI_VERSION);

if (!process.env.TOGALMA_NO_UPDATE_CHECK) {
  void checkForUpdates({ currentVersion: CLI_VERSION });
}

program
  .option("--base-url <url>", "API base URL (default: https://togalma.com)")
  .option("--allow-insecure", "Allow non-HTTPS baseUrl", false)
  .option("--debug", "Enable debug mode to show variant internals", false);

const auth = program.command("auth").description("Authentication");

auth
  .command("login")
  .description("Login with phone + PIN")
  .action(async () => {
    const opts = program.opts<{ baseUrl?: string; allowInsecure: boolean }>();
    const baseUrl = baseUrlFromEnvOrFlag(opts.baseUrl);
    ensureHttps(baseUrl, opts.allowInsecure);

    const username = await promptPhone();
    const password = await promptPin();

    const spinner = ora("Logging in...").start();
    try {
      const res = await api.login(baseUrl, username, password);
      const session: Session = {
        baseUrl,
        token: res.token,
        user: res.user,
        createdAt: new Date().toISOString(),
      };
      await saveSession(session);
      spinner.succeed(`Logged in as ${res.user.fullname || res.user.username}`);
      process.stdout.write(
        [
          "",
          "Next actions:",
          "- Browse menu: togalma menu",
          "- Create an order: togalma order create",
          "- List orders: togalma orders list",
          "",
        ].join("\n")
      );
    } catch (e) {
      spinner.fail("Login failed");
      printHttpError(e);
      process.exitCode = 1;
    }
  });

auth
  .command("whoami")
  .description("Show current session user")
  .action(async () => {
    try {
      const s = await requireSession();
      const res = await api.me(s.baseUrl, s.token);
      process.stdout.write(JSON.stringify(res.user, null, 2) + "\n");
    } catch (e) {
      printHttpError(e);
      process.exitCode = 1;
    }
  });

auth
  .command("logout")
  .description("Clear local session")
  .action(async () => {
    await clearSession();
    process.stdout.write("Logged out.\n");
    process.exit(0);
  });

auth
  .command("register")
  .description("Create an account (PIN sent via WhatsApp)")
  .action(async () => {
    const opts = program.opts<{ baseUrl?: string; allowInsecure: boolean }>();
    const baseUrl = baseUrlFromEnvOrFlag(opts.baseUrl);
    ensureHttps(baseUrl, opts.allowInsecure);

    const fullname = await (await import("@inquirer/prompts")).input({
      message: "Nom complet",
      validate: (v) => (String(v).trim().length >= 3 ? true : "Nom invalide"),
    });
    const phone = await promptPhone();

    const spinner = ora("Creating account...").start();
    try {
      const res = await api.register(baseUrl, { fullname, phone, whatsapp: true });
      spinner.succeed(res.message);
      process.stdout.write(
        [
          "",
          "Next steps:",
          "- Wait for your PIN on WhatsApp.",
          "- Then login: togalma auth login",
          "",
        ].join("\n")
      );
    } catch (e) {
      spinner.fail("Registration failed");
      if (e instanceof HttpError && (e as any).status === 409) {
        process.stderr.write(
          chalk.yellow(
            "An account already exists for this phone number. You can recover your PIN via WhatsApp.\n"
          )
        );
        const doRecover = await inqConfirm({
          message: "Recover PIN now?",
          default: true,
        });
        if (doRecover) {
          const rec = await api.recoverPin(baseUrl, { phone, whatsapp: true });
          process.stdout.write(`${rec.message}\n`);
          process.stdout.write("Then login: togalma auth login\n");
          return;
        }
      }
      printHttpError(e);
      process.exitCode = 1;
    }
  });

auth
  .command("recover")
  .description("Recover your PIN (sent via WhatsApp)")
  .action(async () => {
    const opts = program.opts<{ baseUrl?: string; allowInsecure: boolean }>();
    const baseUrl = baseUrlFromEnvOrFlag(opts.baseUrl);
    ensureHttps(baseUrl, opts.allowInsecure);

    const phone = await promptPhone();
    const spinner = ora("Requesting PIN recovery...").start();
    try {
      const res = await api.recoverPin(baseUrl, { phone, whatsapp: true });
      spinner.succeed(res.message);
      process.stdout.write("Then login: togalma auth login\n");
    } catch (e) {
      spinner.fail("PIN recovery failed");
      printHttpError(e);
      process.exitCode = 1;
    }
  });

program
  .command("menu")
  .description("Browse menu")
  .option("--search <q>", "Search query")
  .option("--date <YYYY-MM-DD>", "Menu date", todayYmd())
  .option("--category <plat|dessert|boisson|all>", "Category", "all")
  .option("--no-order", "Do not prompt to create an order after browsing")
  .action(async (opts: { search?: string; date?: string; category?: string; order?: boolean }) => {
    const globalOpts = program.opts();
    const debug = !!globalOpts.debug;
    try {
      const s = await requireSession();
      await playMenuSplash();
      if (debug) {
        const u = s.user ?? ({} as any);
        const lines = [
          chalk.magenta("┌─ [DBG] User"),
          chalk.magenta(`│ id: ${u.id ?? "?"}`),
          chalk.magenta(`│ fullname: ${u.fullname ?? ""}`),
          chalk.magenta(`│ formulaireAccessible: ${u.formulaireAccessible ?? "—"}`),
          chalk.magenta(`│ formatsAccessibles: ${u.formatsAccessibles ?? "—"}`),
          chalk.magenta("└─"),
          "",
        ];
        process.stdout.write(lines.join("\n"));
      }
      const items = await api.menu(s, opts);
      for (const it of items) {
        const variants = Array.isArray(it.variants) ? (it.variants as any[]) : [];
        const stocks = variants
          .map((v) => (typeof v?.remaining_stock === "number" ? v.remaining_stock : null))
          .filter((n) => typeof n === "number") as number[];
        const isOos = stocks.length > 0 && stocks.every((n) => n <= 0);
        const stockLabel = isOos ? chalk.red(" [Rupture]") : "";
        process.stdout.write(
          `${chalk.bold(it.name)}${it.category ? chalk.gray(` (${it.category})`) : ""}${stockLabel}\n`
        );
        if (it.description) process.stdout.write(chalk.gray(`  ${it.description}\n`));
        if (it.allergens) process.stdout.write(chalk.yellow(`  Allergènes: ${it.allergens}\n`));
        process.stdout.write("\n");
      }
      if (items.length === 0) process.stdout.write("No items.\n");

      if (opts.order !== false && process.stdout.isTTY) {
        const go = await inqConfirm({
          message: "Create an order from this menu now?",
          default: false,
        });
        if (go) {
          await interactiveOrderFromItems(s, items as any[], opts.date ?? todayYmd(), debug);
        }
      }
    } catch (e) {
      printHttpError(e);
      process.exitCode = 1;
    }
  });

const order = program.command("order").description("Create and pay orders");

order
  .command("create")
  .description("Interactive order creation (menu navigation + cart)")
  .option("--date <YYYY-MM-DD>", "Delivery date", todayYmd())
  .action(async (opts: { date: string }) => {
    const globalOpts = program.opts();
    const debug = !!globalOpts.debug;
    try {
      const s = await requireSession();
      const spinner = ora("Loading menu...").start();
      const items = await api.menu(s, { date: opts.date, category: "all" });
      spinner.stop();
      await interactiveOrderFromItems(s, items as any[], opts.date, debug);
    } catch (e) {
      printHttpError(e);
      process.exitCode = 1;
    }
  });

order
  .command("pay")
  .description("Pay with Wave (opens browser + polls status)")
  .argument("[orderId]", "Airtable order record id (rec...)")
  .option("--timeout-seconds <n>", "Max wait time", "600")
  .action(async (orderId: string | undefined, opts: { timeoutSeconds: string }) => {
    try {
      const s = await requireSession();
      const resolvedId = orderId && orderId.trim() !== "" ? orderId.trim() : await resolveRecentOrderIdOrThrow(s);
      await wavePayFlow(s, resolvedId, opts.timeoutSeconds);
    } catch (e) {
      printHttpError(e);
      process.exitCode = 1;
    }
  });

const orders = program.command("orders").description("Order history");

orders
  .command("list")
  .description("List orders")
  .option("--limit <n>", "Max results", "30")
  .action(async (opts: { limit: string }) => {
    try {
      const s = await requireSession();
      const res = (await api.listOrders(s, Number(opts.limit))) as any;
      const list = Array.isArray(res?.orders) ? res.orders : [];
      for (const o of list) {
        const id = o.id ?? o.order_id ?? "";
        const date = o.date ?? o.Date ?? "";
        const status = o.status ?? o.order_status ?? "";
        const total = o.total_price ?? o.amount ?? o.total_fcfa ?? "";
        process.stdout.write(`${chalk.bold(id)} ${chalk.gray(date)} ${status} ${total}\n`);
      }
      if (list.length === 0) process.stdout.write("No orders.\n");
    } catch (e) {
      printHttpError(e);
      process.exitCode = 1;
    }
  });

orders
  .command("show")
  .description("Show order detail")
  .argument("<orderId>", "Order id (rec...)")
  .action(async (orderId: string) => {
    try {
      const s = await requireSession();
      const res = await api.orderDetail(s, orderId);
      process.stdout.write(JSON.stringify(res, null, 2) + "\n");
    } catch (e) {
      printHttpError(e);
      process.exitCode = 1;
    }
  });

await program.parseAsync(process.argv);
process.exit(process.exitCode ?? 0);

