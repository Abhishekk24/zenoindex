import { expect, it } from "vitest";
import { pgConfig } from "../src/db";

const pem = "-----BEGIN CERTIFICATE-----\\nMIIB\\n-----END CERTIFICATE-----";

it("without a CA cert the URL is used as-is", () => {
  expect(pgConfig("postgresql://u:p@h:1/db?sslmode=require")).toEqual({ connectionString: "postgresql://u:p@h:1/db?sslmode=require" });
});

it("with a CA cert: URL ssl params dropped (they'd override), cert verified, \\n escapes expanded", () => {
  const c = pgConfig("postgresql://u:p@h:1/zenoIndex?sslmode=require&uselibpqcompat=true&application_name=api", pem);
  expect(c.connectionString).toBe("postgresql://u:p@h:1/zenoIndex?application_name=api");
  expect(c.ssl).toEqual({ ca: "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----", rejectUnauthorized: true });
});
