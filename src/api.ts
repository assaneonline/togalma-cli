import { z } from "zod";
import type { MenuItem, Session } from "./types.js";
import { requestJson } from "./http.js";

const zUser = z.object({
  id: z.string(),
  username: z.string(),
  fullname: z.string().optional().nullable(),
  company_id: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  formulaireAccessible: z.string().optional().nullable(),
  formatsAccessibles: z.string().optional().nullable(),
  formatsAbonnementActif: z.string().optional().nullable(),
  lastAddress: z.string().optional().nullable(),
});

export async function login(baseUrl: string, username: string, password: string) {
  return await requestJson(
    baseUrl,
    {
      method: "POST",
      path: "/api/cli-v1/auth/login",
      body: { username, password },
    },
    z.object({
      token: z.string(),
      user: zUser,
    })
  );
}

export async function me(baseUrl: string, token: string) {
  return await requestJson(
    baseUrl,
    { method: "GET", path: "/api/cli-v1/auth/me", token },
    z.object({ user: zUser })
  );
}

export async function register(
  baseUrl: string,
  payload: { fullname: string; phone: string; whatsapp: boolean }
) {
  return await requestJson(
    baseUrl,
    {
      method: "POST",
      path: "/api/cli-v1/auth/register",
      body: payload,
    },
    z.object({
      success: z.boolean(),
      message: z.string(),
    })
  );
}

export async function recoverPin(
  baseUrl: string,
  payload: { phone: string; whatsapp: boolean }
) {
  return await requestJson(
    baseUrl,
    {
      method: "POST",
      path: "/api/cli-v1/auth/recover",
      body: payload,
    },
    z.object({
      success: z.boolean().optional(),
      message: z.string(),
    })
  );
}

export async function menu(
  session: Session,
  params: { search?: string; date?: string; category?: string }
) {
  const res = await requestJson(
    session.baseUrl,
    {
      method: "GET",
      path: "/api/cli-v1/menu",
      token: session.token,
      query: {
        search: params.search,
        date: params.date,
        category: params.category,
      },
    },
    z.object({
      items: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          category: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
          allergens: z.string().optional().nullable(),
          variants: z
            .array(
              z.object({
                id: z.string().optional().nullable(),
                format: z.string().optional().nullable(),
                price_fcfa: z.number().optional().nullable(),
                base_price_fcfa: z.number().optional().nullable(),
                remaining_stock: z.number().optional().nullable(),
                stock_hint: z.string().optional().nullable(),
                formulaire: z.union([z.string(), z.array(z.string())]).optional().nullable(),
              })
            )
            .optional()
            .nullable(),
          price_fcfa: z.any().optional().nullable(),
          formulaire: z.union([z.string(), z.array(z.string())]).optional().nullable(),
        })
      ),
      total: z.number(),
    })
  );

  return res.items as MenuItem[];
}

export async function createOrder(
  session: Session,
  payload: {
    requested_delivery_date: string;
    address: string;
    dishes: Array<{ id: string; quantity: number }>;
    desserts?: Array<{ id: string; quantity: number }>;
    drinks?: Array<{ id: string; quantity: number }>;
  }
) {
  return await requestJson(
    session.baseUrl,
    {
      method: "POST",
      path: "/api/cli-v1/orders",
      token: session.token,
      body: payload,
    },
    z.object({
      success: z.boolean(),
      order_id: z.string(),
      checkout_url: z.string(),
    })
  );
}

export async function listOrders(session: Session, limit = 30) {
  return await requestJson(session.baseUrl, {
    method: "GET",
    path: "/api/cli-v1/orders",
    token: session.token,
    query: { limit },
  });
}

export async function orderDetail(session: Session, id: string) {
  return await requestJson(session.baseUrl, {
    method: "GET",
    path: `/api/cli-v1/orders/${encodeURIComponent(id)}`,
    token: session.token,
  });
}

export async function waveCheckoutUrl(session: Session, id: string) {
  return await requestJson(
    session.baseUrl,
    {
      method: "POST",
      path: `/api/cli-v1/orders/${encodeURIComponent(id)}/pay/wave`,
      token: session.token,
    },
    z.object({ checkout_url: z.string() })
  );
}

export async function payStatus(session: Session, id: string) {
  return await requestJson(
    session.baseUrl,
    {
      method: "GET",
      path: `/api/cli-v1/orders/${encodeURIComponent(id)}/pay/status`,
      token: session.token,
    },
    z.object({
      payment_status: z.string(),
      paid: z.boolean(),
    })
  );
}

