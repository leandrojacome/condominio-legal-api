import { describe, it, expect } from "vitest";
import {
  RegistrarAcessoSchema,
  PreAutorizarSchema,
  RegistrarEncomendaSchema,
  ConfirmarAcessoSchema,
  TipoAcessoEnum,
} from "../schemas";

const CUID = "clh1234567890123456789012";

describe("TipoAcessoEnum", () => {
  it("accepts valid access types", () => {
    for (const tipo of ["visitante", "prestador", "entrega", "veiculo"]) {
      expect(TipoAcessoEnum.safeParse(tipo).success).toBe(true);
    }
  });

  it("rejects invalid type", () => {
    expect(TipoAcessoEnum.safeParse("funcionario").success).toBe(false);
  });
});

describe("RegistrarAcessoSchema", () => {
  const base = {
    tipo: "visitante",
    nomeVisitante: "João Silva",
    unidadeDestinoId: CUID,
  };

  it("accepts valid input", () => {
    expect(RegistrarAcessoSchema.safeParse(base).success).toBe(true);
  });

  it("accepts optional fields", () => {
    const r = RegistrarAcessoSchema.safeParse({
      ...base,
      documento: "12345678901",
      preAutorizacaoId: CUID,
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid tipo", () => {
    expect(RegistrarAcessoSchema.safeParse({ ...base, tipo: "dono" }).success).toBe(false);
  });

  it("rejects short nomeVisitante", () => {
    expect(RegistrarAcessoSchema.safeParse({ ...base, nomeVisitante: "A" }).success).toBe(false);
  });

  it("rejects missing unidadeDestinoId", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { unidadeDestinoId: _, ...rest } = base;
    expect(RegistrarAcessoSchema.safeParse(rest).success).toBe(false);
  });
});

describe("PreAutorizarSchema", () => {
  const base = {
    nomeVisitante: "Maria Santos",
    unidadeId: CUID,
    validoAte: new Date(Date.now() + 86400000).toISOString(),
  };

  it("accepts valid pre-authorization", () => {
    expect(PreAutorizarSchema.safeParse(base).success).toBe(true);
  });

  it("rejects missing nomeVisitante", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nomeVisitante: _, ...rest } = base;
    expect(PreAutorizarSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid datetime format", () => {
    expect(
      PreAutorizarSchema.safeParse({ ...base, validoAte: "31/12/2025" }).success
    ).toBe(false);
  });
});

describe("RegistrarEncomendaSchema", () => {
  it("accepts minimal input (unidadeDestinoId only)", () => {
    expect(
      RegistrarEncomendaSchema.safeParse({ unidadeDestinoId: CUID }).success
    ).toBe(true);
  });

  it("accepts full input", () => {
    expect(
      RegistrarEncomendaSchema.safeParse({
        unidadeDestinoId: CUID,
        remetente: "Amazon",
        fotoKey: "encomendas/condo1/enc1.jpg",
      }).success
    ).toBe(true);
  });

  it("rejects missing unidadeDestinoId", () => {
    expect(RegistrarEncomendaSchema.safeParse({ remetente: "Amazon" }).success).toBe(false);
  });
});

describe("ConfirmarAcessoSchema", () => {
  it("accepts autorizar", () => {
    expect(ConfirmarAcessoSchema.safeParse({ decisao: "autorizar" }).success).toBe(true);
  });

  it("accepts negar", () => {
    expect(ConfirmarAcessoSchema.safeParse({ decisao: "negar" }).success).toBe(true);
  });

  it("rejects unknown decisao", () => {
    expect(ConfirmarAcessoSchema.safeParse({ decisao: "ignorar" }).success).toBe(false);
  });

  it("rejects missing decisao", () => {
    expect(ConfirmarAcessoSchema.safeParse({}).success).toBe(false);
  });
});
