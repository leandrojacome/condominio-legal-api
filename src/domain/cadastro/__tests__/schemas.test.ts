import { describe, it, expect } from "vitest";
import {
  CriarCondominioSchema,
  CriarUnidadeSchema,
  CriarPessoaSchema,
  CriarVinculoSchema,
} from "../schemas";

describe("CriarCondominioSchema", () => {
  it("accepts valid condominio", () => {
    const result = CriarCondominioSchema.safeParse({
      nome: "Edifício Central",
      cnpj: "12345678000195",
      endereco: "Rua das Flores, 100",
    });
    expect(result.success).toBe(true);
  });

  it("rejects condominio without nome", () => {
    const result = CriarCondominioSchema.safeParse({
      cnpj: "12345678000195",
      endereco: "Rua das Flores, 100",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid CNPJ format", () => {
    const result = CriarCondominioSchema.safeParse({
      nome: "Edifício Central",
      cnpj: "123",
      endereco: "Rua das Flores, 100",
    });
    expect(result.success).toBe(false);
  });
});

describe("CriarUnidadeSchema", () => {
  it("accepts valid unidade", () => {
    const result = CriarUnidadeSchema.safeParse({
      bloco: "B",
      numero: "302",
      tipo: "APARTAMENTO",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid tipo", () => {
    const result = CriarUnidadeSchema.safeParse({
      numero: "302",
      tipo: "MANSAO",
    });
    expect(result.success).toBe(false);
  });

  it("accepts unidade without bloco", () => {
    const result = CriarUnidadeSchema.safeParse({ numero: "10" });
    expect(result.success).toBe(true);
  });
});

describe("CriarPessoaSchema", () => {
  it("accepts valid pessoa", () => {
    const result = CriarPessoaSchema.safeParse({
      nome: "João Silva",
      cpf: "12345678901",
      email: "joao@example.com",
      telefone: "11999999999",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing email", () => {
    const result = CriarPessoaSchema.safeParse({
      nome: "João Silva",
      cpf: "12345678901",
      telefone: "11999999999",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid CPF format", () => {
    const result = CriarPessoaSchema.safeParse({
      nome: "João Silva",
      cpf: "123",
      email: "joao@example.com",
      telefone: "11999999999",
    });
    expect(result.success).toBe(false);
  });
});

describe("CriarVinculoSchema", () => {
  const validVinculo = {
    userId: "cuid1234567890123456789",
    pessoaId: "cuid1234567890123456789",
    unidadeId: "cuid1234567890123456789",
    papel: "proprietario",
    perfil: "proprietario",
  };

  it("accepts valid vinculo", () => {
    const result = CriarVinculoSchema.safeParse(validVinculo);
    expect(result.success).toBe(true);
  });

  it("rejects invalid papel", () => {
    const result = CriarVinculoSchema.safeParse({
      ...validVinculo,
      papel: "dono",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid perfil", () => {
    const result = CriarVinculoSchema.safeParse({
      ...validVinculo,
      perfil: "admin",
    });
    expect(result.success).toBe(false);
  });
});
