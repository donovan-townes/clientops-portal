import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import SignOutButton from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";

export default async function AppHeader() {
  const session = await getServerSession(authOptions);

  return (
    <header className="border-b border-gray-200 bg-white py-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Image
            src="/clientops/client-ops-logo.svg"
            alt="Client Ops logo"
            width={52}
            height={34}
            className="h-auto w-10 sm:w-[52px]"
            style={{ height: "auto" }}
          />
          <div className="min-w-0 flex-col leading-tight">
            <Link
              href="/"
              className="block max-w-[140px] truncate text-base font-bold text-gray-900 sm:max-w-none sm:text-lg dark:text-white"
            >
              Client Ops Portal
            </Link>
            <p className="hidden text-xs text-gray-600 sm:block dark:text-gray-400">
              Multi-workspace operations
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1 sm:flex sm:gap-2">
          {session?.user?.email ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-lg px-2.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-3 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard#invite"
                className="hidden rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:inline-flex dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 sm:px-4 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 sm:px-4"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <details className="relative sm:hidden">
          <summary className="list-none rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
            Menu
          </summary>
          <div className="absolute right-0 top-[calc(100%+8px)] z-20 flex min-w-[170px] flex-col gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-800 dark:bg-gray-900">
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
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
                  {session.user.email}
                </div>
                <SignOutButton className="w-full justify-center px-3" />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-amber-500 px-3 py-2 text-center text-sm font-medium text-white hover:bg-amber-600"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
