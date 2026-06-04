import { describe, it, expect } from "vitest";
import { CriarComunicadoSchema } from "../schemas";

describe("CriarComunicadoSchema", () => {
  const base = {
    titulo: "Aviso de condomínio",
    conteudo: "Texto do aviso",
    tipo: "aviso_geral",
  };

  it("accepts aviso_geral without destinatarios", () => {
    expect(CriarComunicadoSchema.safeParse(base).success).toBe(true);
  });

  it("accepts aviso_individual with destinatarioIds", () => {
    const result = CriarComunicadoSchema.safeParse({
      ...base,
      tipo: "aviso_individual",
      destinatarioIds: ["cuid1234567890123456789"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid tipo", () => {
    expect(CriarComunicadoSchema.safeParse({ ...base, tipo: "boletim" }).success).toBe(false);
  });

  it("rejects empty titulo", () => {
    expect(CriarComunicadoSchema.safeParse({ ...base, titulo: "a" }).success).toBe(false);
  });

  it("accepts canais list", () => {
    const result = CriarComunicadoSchema.safeParse({
      ...base,
      canais: ["in_app", "email"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid canal", () => {
    const result = CriarComunicadoSchema.safeParse({
      ...base,
      canais: ["telegram"],
    });
    expect(result.success).toBe(false);
  });
});
