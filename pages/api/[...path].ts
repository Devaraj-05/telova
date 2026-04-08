import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

const HOP_BY_HOP_HEADERS = new Set([
  "accept-encoding",
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function getBackendBaseUrl() {
  return process.env.BACKEND_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
}

function buildUpstreamUrl(req: NextApiRequest) {
  const path = Array.isArray(req.query.path)
    ? req.query.path
    : req.query.path
      ? [req.query.path]
      : [];
  const upstreamUrl = new URL(`/api/${path.join("/")}`, getBackendBaseUrl());

  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path" || value == null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        upstreamUrl.searchParams.append(key, item);
      }
      continue;
    }
    upstreamUrl.searchParams.set(key, value);
  }

  return upstreamUrl.toString();
}

function buildUpstreamHeaders(req: NextApiRequest) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    const headerName = key.toLowerCase();
    if (!value || HOP_BY_HOP_HEADERS.has(headerName)) {
      continue;
    }
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  headers.set("x-forwarded-host", req.headers.host ?? "localhost");
  headers.set(
    "x-forwarded-proto",
    String(req.headers["x-forwarded-proto"] ?? "http"),
  );

  return headers;
}

async function readRequestBody(req: NextApiRequest) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

function applyResponseHeaders(
  res: NextApiResponse,
  headers: Headers,
  statusCode: number,
) {
  res.status(statusCode);
  const maybeSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  if (maybeSetCookie?.length) {
    res.setHeader("set-cookie", maybeSetCookie);
  }

  headers.forEach((value, key) => {
    if (HOP_BY_HOP_HEADERS.has(key.toLowerCase()) || key === "set-cookie") {
      return;
    }
    res.setHeader(key, value);
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const upstreamResponse = await fetch(buildUpstreamUrl(req), {
      method: req.method,
      headers: buildUpstreamHeaders(req),
      body: await readRequestBody(req),
      cache: "no-store",
      redirect: "manual",
    });

    applyResponseHeaders(res, upstreamResponse.headers, upstreamResponse.status);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const responseBody = Buffer.from(await upstreamResponse.arrayBuffer());
    res.send(responseBody);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected proxy failure.";
    res.status(502).send(`Failed to reach backend service: ${message}`);
  }
}
