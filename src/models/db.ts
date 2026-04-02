import mongoose from "mongoose";

type MongooseGlobalCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  resolvedUri: string | null;
};

declare global {
  var mongoose: MongooseGlobalCache | undefined;
}

const cached = global.mongoose ?? { conn: null, promise: null, resolvedUri: null };
if (!global.mongoose) {
  global.mongoose = cached;
}

function splitSrvUri(input: string) {
  const trimmed = input.trim();
  const scheme = "mongodb+srv://";
  if (!trimmed.startsWith(scheme)) {
    return null;
  }

  const withoutScheme = trimmed.slice(scheme.length);
  const slashIndex = withoutScheme.indexOf("/");
  const authority = slashIndex >= 0 ? withoutScheme.slice(0, slashIndex) : withoutScheme;
  const rest = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
  const atIndex = authority.lastIndexOf("@");
  const auth = atIndex >= 0 ? authority.slice(0, atIndex) : "";
  const host = atIndex >= 0 ? authority.slice(atIndex + 1) : authority;
  const queryIndex = rest.indexOf("?");
  const database = queryIndex >= 0 ? rest.slice(0, queryIndex) : rest;
  const query = queryIndex >= 0 ? rest.slice(queryIndex + 1) : "";

  return {
    auth,
    host,
    database,
    query,
  };
}

async function resolveDnsJson(name: string, type: string) {
  const endpoints = [
    "https://dns.google/resolve",
    "https://cloudflare-dns.com/dns-query",
  ];

  for (const endpoint of endpoints) {
    try {
      const separator = endpoint.includes("?") ? "&" : "?";
      const response = await fetch(
        `${endpoint}${separator}name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
        {
          headers: {
            accept: "application/dns-json",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        continue;
      }

      const payload = (await response.json().catch(() => null)) as
        | { Answer?: Array<{ data?: string }> }
        | null;

      if (payload && typeof payload === "object") {
        return payload;
      }
    } catch {
      // Try the next DNS-over-HTTPS provider.
    }
  }

  return null;
}

function parseSrvHosts(payload: { Answer?: Array<{ data?: string }> } | null) {
  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  return answers
    .map((answer) => String(answer?.data ?? "").trim())
    .map((value) => {
      const parts = value.split(/\s+/);
      if (parts.length < 4) {
        return null;
      }

      const port = parts[2];
      const host = parts[3]?.replace(/\.$/, "");
      if (!host || !port) {
        return null;
      }

      return `${host}:${port}`;
    })
    .filter((value): value is string => Boolean(value));
}

function parseTxtOptions(payload: { Answer?: Array<{ data?: string }> } | null) {
  const answers = Array.isArray(payload?.Answer) ? payload.Answer : [];
  return answers
    .map((answer) => String(answer?.data ?? "").trim())
    .filter(Boolean)
    .map((value) => value.replace(/^"+|"+$/g, "").replace(/" "/g, ""))
    .join("&");
}

function mergeQueryStrings(primary: string, secondary: string) {
  const params = new URLSearchParams();

  const apply = (input: string) => {
    const next = new URLSearchParams(input);
    for (const [key, value] of next.entries()) {
      params.set(key, value);
    }
  };

  apply(secondary);
  apply(primary);

  if (!params.has("ssl") && !params.has("tls")) {
    params.set("ssl", "true");
  }

  return params.toString();
}

async function expandMongoSrvUri(uri: string) {
  const parsed = splitSrvUri(uri);
  if (!parsed?.host) {
    throw new Error("Invalid mongodb+srv connection string");
  }

  const [srvPayload, txtPayload] = await Promise.all([
    resolveDnsJson(`_mongodb._tcp.${parsed.host}`, "SRV"),
    resolveDnsJson(parsed.host, "TXT"),
  ]);

  const hosts = parseSrvHosts(srvPayload);
  if (hosts.length === 0) {
    throw new Error("Unable to resolve MongoDB SRV hosts over HTTPS");
  }

  const txtOptions = parseTxtOptions(txtPayload);
  const mergedQuery = mergeQueryStrings(parsed.query, txtOptions);
  const authPrefix = parsed.auth ? `${parsed.auth}@` : "";
  const databasePath = parsed.database || "";

  return `mongodb://${authPrefix}${hosts.join(",")}/${databasePath}${
    mergedQuery ? `?${mergedQuery}` : ""
  }`;
}

async function connectWithFallback(uri: string, dbName: string) {
  try {
    return await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!uri.startsWith("mongodb+srv://") || !message.includes("querySrv")) {
      throw error;
    }

    const directUri = await expandMongoSrvUri(uri);
    cached.resolvedUri = directUri;

    return mongoose.connect(directUri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
  }
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "UniHub";
  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise) {
    const connectionUri = cached.resolvedUri ?? uri;
    cached.promise = connectWithFallback(connectionUri, dbName).then((instance) => {
        console.log("MongoDB Connected");
        return instance;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    console.error("MongoDB connection failed:", error);
    throw error;
  }
}
