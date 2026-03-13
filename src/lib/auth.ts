import bcrypt from "bcrypt";
import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const nextAuthSecret = process.env.NEXTAUTH_SECRET;

if (!nextAuthSecret) {
  throw new Error("NEXTAUTH_SECRET is required for JWT session encryption.");
}

type CredentialsInput = {
  email?: string;
  password?: string;
};

export async function authorizeCredentials(credentials?: CredentialsInput) {
  if (!credentials?.email || !credentials?.password) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: credentials.email },
  });

  if (!user) return null;

  const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email,
  };
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.userId = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
      }

      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: nextAuthSecret,
};
