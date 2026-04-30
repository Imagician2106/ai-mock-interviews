import { cookies } from "next/headers";

import { getAdminAuth } from "@/firebase/admin";

const SESSION_DURATION = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };

    if (!idToken) {
      return Response.json(
        { success: false, message: "Missing Firebase ID token." },
        { status: 400 }
      );
    }

    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION * 1000,
    });

    const cookieStore = await cookies();
    cookieStore.set("session", sessionCookie, {
      maxAge: SESSION_DURATION,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return Response.json({
      success: true,
      uid: decodedToken.uid,
      message: "Signed in successfully.",
    });
  } catch (error) {
    console.error("Session creation failed:", error);

    return Response.json(
      {
        success: false,
        message:
          "Could not create a secure session. Check Firebase Admin environment variables on Vercel.",
      },
      { status: 401 }
    );
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("session");

  return Response.json({ success: true });
}
