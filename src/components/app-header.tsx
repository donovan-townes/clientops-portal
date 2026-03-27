import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import SignOutButton from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";

export default async function AppHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="border-b border-gray-200 bg-white py-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/clientops/client-ops-logo.svg"
            alt="Client Ops logo"
            width={52}
            height={34}
            className="h-auto w-[52px]"
            style={{ height: "auto" }}
          />
          <div className="flex flex-col leading-tight">
            <Link
              href="/"
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              Client Ops Portal
            </Link>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Multi-workspace operations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session?.user?.email ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard#invite"
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Invite
              </Link>
              <div className="hidden rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 md:block dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                Signed in as {session.user.email}
              </div>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
