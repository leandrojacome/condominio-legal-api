import { describe, it, expect } from "vitest";
import {
  CriarAssembleiaSchema,
  AdicionarItemPautaSchema,
  RegistrarVotoSchema,
  EncerrarVotacaoSchema,
  ModalidadeEnum,
  CriterioVotoEnum,
  OpcaoVotoEnum,
} from "../schemas";

const CUID = "clh1234567890123456789012";

describe("ModalidadeEnum", () => {
  it("accepts valid modalidades", () => {
    for (const m of ["presencial", "online", "hibrida"]) {
      expect(ModalidadeEnum.safeParse(m).success).toBe(true);
    }
  });

  it("rejects invalid modalidade", () => {
    expect(ModalidadeEnum.safeParse("virtual").success).toBe(false);
  });
});

describe("CriterioVotoEnum", () => {
  it("accepts por_unidade", () => {
    expect(CriterioVotoEnum.safeParse("por_unidade").success).toBe(true);
  });

  it("accepts por_fracao", () => {
    expect(CriterioVotoEnum.safeParse("por_fracao").success).toBe(true);
  });

  it("rejects invalid criterio", () => {
    expect(CriterioVotoEnum.safeParse("proporcional").success).toBe(false);
  });
});

describe("OpcaoVotoEnum", () => {
  it("accepts sim, nao, abstencao", () => {
    for (const o of ["sim", "nao", "abstencao"]) {
      expect(OpcaoVotoEnum.safeParse(o).success).toBe(true);
    }
  });

  it("rejects invalid opcao", () => {
    expect(OpcaoVotoEnum.safeParse("talvez").success).toBe(false);
  });
});

describe("CriarAssembleiaSchema", () => {
  const base = {
    titulo: "Assembleia Geral Ordinária 2026",
    dataHora: "2026-07-01T19:00:00.000Z",
  };

  it("accepts minimal valid input", () => {
    expect(CriarAssembleiaSchema.safeParse(base).success).toBe(true);
  });

  it("accepts full valid input", () => {
    expect(
      CriarAssembleiaSchema.safeParse({
        ...base,
        local: "Salão de Festas",
        modalidade: "presencial",
      }).success
    ).toBe(true);
  });

  it("accepts online modalidade", () => {
    expect(
      CriarAssembleiaSchema.safeParse({ ...base, modalidade: "online" }).success
    ).toBe(true);
  });

  it("rejects short titulo", () => {
    expect(CriarAssembleiaSchema.safeParse({ ...base, titulo: "AB" }).success).toBe(false);
  });

  it("rejects invalid dataHora format", () => {
    expect(
      CriarAssembleiaSchema.safeParse({ ...base, dataHora: "01/07/2026 19:00" }).success
    ).toBe(false);
  });

  it("rejects invalid modalidade", () => {
    expect(
      CriarAssembleiaSchema.safeParse({ ...base, modalidade: "virtual" }).success
    ).toBe(false);
  });
});

describe("AdicionarItemPautaSchema", () => {
  const base = {
    titulo: "Aprovação do orçamento anual",
    criterioVoto: "por_unidade",
    quorumMinimo: 50,
    ordem: 1,
  };

  it("accepts valid item pauta", () => {
    expect(AdicionarItemPautaSchema.safeParse(base).success).toBe(true);
  });

  it("accepts with optional fields", () => {
    expect(
      AdicionarItemPautaSchema.safeParse({
        ...base,
        descricao: "Detalhes do orçamento para o ano de 2026",
        votoSecreto: true,
      }).success
    ).toBe(true);
  });

  it("rejects quorumMinimo below 0", () => {
    expect(
      AdicionarItemPautaSchema.safeParse({ ...base, quorumMinimo: -1 }).success
    ).toBe(false);
  });

  it("rejects quorumMinimo above 100", () => {
    expect(
      AdicionarItemPautaSchema.safeParse({ ...base, quorumMinimo: 101 }).success
    ).toBe(false);
  });

  it("rejects negative ordem", () => {
    expect(
      AdicionarItemPautaSchema.safeParse({ ...base, ordem: -1 }).success
    ).toBe(false);
  });

  it("rejects non-integer ordem", () => {
    expect(
      AdicionarItemPautaSchema.safeParse({ ...base, ordem: 1.5 }).success
    ).toBe(false);
  });

  it("rejects invalid criterioVoto", () => {
    expect(
      AdicionarItemPautaSchema.safeParse({ ...base, criterioVoto: "por_pessoa" }).success
    ).toBe(false);
  });

  it("rejects missing criterioVoto", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { criterioVoto: _, ...rest } = base;
    expect(AdicionarItemPautaSchema.safeParse(rest).success).toBe(false);
  });
});

describe("RegistrarVotoSchema", () => {
  it("accepts valid vote", () => {
    expect(
      RegistrarVotoSchema.safeParse({ itemPautaId: CUID, opcao: "sim" }).success
    ).toBe(true);
  });

  it("accepts abstencao", () => {
    expect(
      RegistrarVotoSchema.safeParse({ itemPautaId: CUID, opcao: "abstencao" }).success
    ).toBe(true);
  });

  it("rejects invalid opcao", () => {
    expect(
      RegistrarVotoSchema.safeParse({ itemPautaId: CUID, opcao: "talvez" }).success
    ).toBe(false);
  });

  it("rejects non-cuid itemPautaId", () => {
    expect(
      RegistrarVotoSchema.safeParse({ itemPautaId: "not-a-cuid", opcao: "sim" }).success
    ).toBe(false);
  });

  it("rejects missing itemPautaId", () => {
    expect(RegistrarVotoSchema.safeParse({ opcao: "sim" }).success).toBe(false);
  });
});

describe("EncerrarVotacaoSchema", () => {
  it("accepts empty object", () => {
    expect(EncerrarVotacaoSchema.safeParse({}).success).toBe(true);
  });

  it("ignores extra fields (Zod strips by default)", () => {
    expect(EncerrarVotacaoSchema.safeParse({ foo: "bar" }).success).toBe(true);
  });
});
