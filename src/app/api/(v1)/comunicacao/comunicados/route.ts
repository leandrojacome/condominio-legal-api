import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { requirePerfil, PerfilUsuario } from "@/lib/auth/rbac";
import { validationError, unauthorizedError, handleRouteError } from "@/lib/errors";
import { CriarComunicadoSchema } from "@/domain/comunicacao/schemas";
import { publicarComunicado } from "@/application/comunicacao/use-cases/publicar-comunicado";
import { listarComunicados } from "@/application/comunicacao/use-cases/listar-comunicados";

const PUBLICADORES: PerfilUsuario[] = [
  PerfilUsuario.SINDICO,
  PerfilUsuario.ADMINISTRADORA,
  PerfilUsuario.PORTEIRO,
  PerfilUsuario.CONSELHO,
];

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return unauthorizedError();

    const { searchParams } = new URL(req.url);
    const soMeus = searchParams.get("soMeus") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") ?? "20", 10)));

    const result = await listarComunicados({
      condominioId: session.condominioId,
      userId: session.userId,
      soMeus,
      page,
      perPage,
    });

    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

async function postHandler(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) return unauthorizedError();

    const body: unknown = await req.json();
    const parsed = CriarComunicadoSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error.flatten());

    const result = await publicarComunicado(
      session.condominioId,
      session.userId,
      parsed.data
    );

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}

export const POST = requirePerfil(...PUBLICADORES)(postHandler);
