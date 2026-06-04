/**
 * Script de seed: cria o usuário de teste admin no Supabase Auth e no banco.
 *
 * Requer:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (obrigatório — obtido em Supabase Dashboard → Settings → API)
 *
 * Uso:
 *   cd condominio-legal-api
 *   npx tsx scripts/create-test-admin.ts
 *
 * O usuário é criado com email_confirm: true (sem e-mail de verificação).
 * O Admin API bypassa validações de domínio e força de senha.
 */

import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "❌  Missing env vars: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prisma = new PrismaClient();

// ─── Configuração do usuário de teste ─────────────────────────────────────────

const ADMIN_EMAIL = "admin@xampple.com";
const ADMIN_PASSWORD = "admin";
const ADMIN_NAME = "Admin Teste";

// Condomínio de referência para o vínculo de teste
const CONDO_NOME = "Condomínio Teste";
const CONDO_CNPJ = "00.000.000/0000-00";
const CONDO_ENDERECO = "Rua Teste, 1 — São Paulo/SP";

// ─── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("→ Criando usuário Supabase Auth:", ADMIN_EMAIL);

  // 1. Criar (ou reusar) usuário no Supabase Auth
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === ADMIN_EMAIL);

  let supabaseUserId: string;

  if (existingUser) {
    console.log("  ℹ️  Usuário já existe no Supabase Auth — atualizando senha");
    const { data: updated, error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      { password: ADMIN_PASSWORD, email_confirm: true }
    );
    if (error) throw error;
    supabaseUserId = updated.user.id;
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true, // sem e-mail de verificação
      user_metadata: { name: ADMIN_NAME },
    });
    if (error) throw error;
    supabaseUserId = created.user.id;
    console.log("  ✓  Usuário criado no Supabase Auth:", supabaseUserId);
  }

  // 2. Criar ou encontrar o User no banco local
  let dbUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!dbUser) {
    dbUser = await prisma.user.create({
      data: { email: ADMIN_EMAIL, name: ADMIN_NAME },
    });
    console.log("  ✓  User criado no banco:", dbUser.id);
  } else {
    console.log("  ℹ️  User já existe no banco:", dbUser.id);
  }

  // 3. Criar ou encontrar Condomínio de teste
  let condo = await prisma.condominio.findUnique({ where: { cnpj: CONDO_CNPJ } });
  if (!condo) {
    condo = await prisma.condominio.create({
      data: {
        nome: CONDO_NOME,
        cnpj: CONDO_CNPJ,
        endereco: CONDO_ENDERECO,
      },
    });
    console.log("  ✓  Condomínio de teste criado:", condo.id);
  } else {
    console.log("  ℹ️  Condomínio de teste já existe:", condo.id);
  }

  // 4. Criar Unidade padrão no condomínio (necessário para o Vínculo)
  let unidade = await prisma.unidade.findFirst({
    where: { condominioId: condo.id, numero: "101" },
  });
  if (!unidade) {
    unidade = await prisma.unidade.create({
      data: {
        condominioId: condo.id,
        numero: "101",
        bloco: "A",
        tipo: "APARTAMENTO",
      },
    });
    console.log("  ✓  Unidade 101 criada:", unidade.id);
  } else {
    console.log("  ℹ️  Unidade 101 já existe:", unidade.id);
  }

  // 5. Criar Pessoa vinculada
  let pessoa = await prisma.pessoa.findFirst({
    where: { condominioId: condo.id, cpf: "000.000.000-00" },
  });
  if (!pessoa) {
    pessoa = await prisma.pessoa.create({
      data: {
        condominioId: condo.id,
        nome: ADMIN_NAME,
        cpf: "000.000.000-00",
        email: ADMIN_EMAIL,
        telefone: "(11) 00000-0000",
      },
    });
    console.log("  ✓  Pessoa criada:", pessoa.id);
  } else {
    console.log("  ℹ️  Pessoa já existe:", pessoa.id);
  }

  // 6. Criar Vínculo com perfil síndico
  const existingVinculo = await prisma.vinculo.findFirst({
    where: { userId: dbUser.id, condominioId: condo.id, ativo: true },
  });
  if (!existingVinculo) {
    await prisma.vinculo.create({
      data: {
        condominioId: condo.id,
        userId: dbUser.id,
        pessoaId: pessoa.id,
        unidadeId: unidade.id,
        papel: "proprietario",
        perfil: "sindico",
      },
    });
    console.log("  ✓  Vínculo síndico criado");
  } else {
    console.log("  ℹ️  Vínculo já existe:", existingVinculo.id);
  }

  console.log("\n✅  Usuário de teste pronto!");
  console.log("   Email   :", ADMIN_EMAIL);
  console.log("   Senha   :", ADMIN_PASSWORD);
  console.log("   Perfil  : sindico");
  console.log("   Cond.   :", condo.nome, "(", condo.id, ")");
}

main()
  .catch((e) => {
    console.error("❌  Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
