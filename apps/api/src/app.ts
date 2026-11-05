import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import { certificateRegistry, type CertificateRegistryClient } from "./blockchain.js";
import { certificateStatusRouter, markStatusRoutesMounted } from "./certificateStatusRoutes.js";
import { config } from "./config.js";
import { authenticate, authenticateBootstrapAdmin, authorize, createToken } from "./http/auth.js";
import { errorHandler, HttpError, parseOrThrow } from "./http/errors.js";
import { auditQuerySchema, dashboardQuerySchema, loginSchema } from "./http/schemas.js";
import { observability, renderPrometheusMetrics } from "./observability.js";
import { certificateRoutes } from "./routes/certificates.js";
import { publicVerificationRoutes } from "./routes/public.js";
import { parseTrustProxy, rateLimit, requestSecurity } from "./security.js";
import { audit, type ServiceContext } from "./services/context.js";
import { buildDashboard } from "./services/dashboardService.js";
import { storageService } from "./storage.js";
import { store as defaultStore, type Store } from "./store.js";

export interface AppDependencies {
  store?: Store;
  registry?: CertificateRegistryClient;
  /** Override rate-limit budgets (tests). */
  rateLimits?: Partial<Record<"api" | "login" | "verify", { windowMs: number; max: number }>>;
}

export function createApp(dependencies: AppDependencies = {}) {
  const context: ServiceContext = {
    store: dependencies.store ?? defaultStore,
    registry: dependencies.registry ?? certificateRegistry,
  };
  const limits = {
    api: { windowMs: 60_000, max: 120, ...dependencies.rateLimits?.api },
    login: { windowMs: 15 * 60_000, max: 20, ...dependencies.rateLimits?.login },
    verify: { windowMs: 60_000, max: 40, ...dependencies.rateLimits?.verify },
  };

  const app = express();
  app.disable("x-powered-by");
  // X-Forwarded-For is honoured only when a proxy is explicitly declared through TRUST_PROXY.
  app.set("trust proxy", parseTrustProxy(config.TRUST_PROXY));
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(requestSecurity);
  app.use(observability);
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
      methods: ["GET", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "X-File-Name"],
      exposedHeaders: ["X-Request-Id", "Content-Disposition", "X-Content-SHA256", "Retry-After"],
    }),
  );
  app.use(express.json({ limit: "32kb", strict: true }));

  // Independent budgets: login and verification traffic never consume each other's counters,
  // and the general API budget does not apply to them (they have stricter dedicated limits).
  const apiLimiter = rateLimit({ name: "api", ...limits.api });
  const loginLimiter = rateLimit({ name: "login", ...limits.login });
  const verifyLimiter = rateLimit({ name: "verify", ...limits.verify });
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/") || req.path.startsWith("/verify/")) return next();
    return apiLimiter(req, res, next);
  });

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      persistence: context.store.kind,
      storage: storageService.driver,
      blockchainConfigured: context.registry.configured,
    });
  });

  app.get("/ready", async (_req, res) => {
    try {
      const persistenceReady = await context.store.healthcheck();
      const ready = persistenceReady && storageService.configured;
      res.status(ready ? 200 : 503).json({
        status: ready ? "ready" : "not_ready",
        persistenceReady,
        storageReady: storageService.configured,
        blockchainConfigured: context.registry.configured,
      });
    } catch {
      res.status(503).json({ status: "not_ready", persistenceReady: false });
    }
  });

  app.get("/metrics", (req, res) => {
    if (config.METRICS_TOKEN && req.headers.authorization !== `Bearer ${config.METRICS_TOKEN}`) {
      res.status(401).json({ error: "Metrics authentication required", code: "unauthenticated" });
      return;
    }
    res.type("text/plain; version=0.0.4").send(renderPrometheusMetrics());
  });

  const auth = Router();
  auth.post("/login", async (req, res) => {
    const credentials = loginSchema.safeParse(req.body);
    if (!credentials.success) {
      throw new HttpError(400, "validation_failed", "Invalid credentials payload");
    }
    const user = authenticateBootstrapAdmin(credentials.data.email, credentials.data.password);
    if (!user) {
      // Identical response for unknown email and wrong password: no account enumeration.
      throw new HttpError(401, "invalid_credentials", "Invalid email or password");
    }
    await audit(context, user.email, "login");
    const issued = createToken(user);
    res.json({ token: issued.token, expiresAt: issued.expiresAt, user });
  });
  auth.get("/session", authenticate, (req, res) => {
    res.json({ user: req.user });
  });
  app.use("/api/auth", loginLimiter, auth);

  app.use("/api/verify", verifyLimiter, publicVerificationRoutes(context));
  app.use("/api", certificateRoutes(context));
  app.use("/api", certificateStatusRouter(context));
  markStatusRoutesMounted(app);

  app.get("/api/dashboard", authenticate, async (req, res) => {
    const { range } = parseOrThrow(dashboardQuerySchema, req.query, "Invalid dashboard range");
    res.json(await buildDashboard(context, range));
  });

  app.get("/api/audit", authenticate, authorize("admin"), async (req, res) => {
    const query = parseOrThrow(auditQuerySchema, req.query, "Invalid audit query");
    res.json({ items: await context.store.listAudit(query) });
  });

  app.use("/api", (_req, _res) => {
    throw new HttpError(404, "not_found", "Endpoint not found");
  });

  app.use(errorHandler);
  return app;
}
