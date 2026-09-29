import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateGoogleAuthUrl } from "@/lib/calendar";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const user = session.user as { organizationId: string; role: string };
  if (user.role !== "admin" && user.role !== "supervisor") {
    return new NextResponse("Acesso não autorizado.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get("resourceId");
  if (!resourceId) {
    return new NextResponse("resourceId é obrigatório.", { status: 400 });
  }

  const authUrl = generateGoogleAuthUrl({
    organizationId: user.organizationId,
    resourceId,
  });

  return NextResponse.redirect(authUrl);
}
