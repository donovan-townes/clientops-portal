import Link from "next/link";
import { getServerSession } from "next-auth";
import SignOutButton from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main className="min-h-screen w-full">
      {/* Navigation */}
      <nav className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500">
              <span className="text-lg font-bold text-white">⚙️</span>
            </div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Client Ops Portal
            </h1>
          </div>
          <div className="flex gap-2">
            {session?.user?.email ? (
              <>
                <div className="hidden rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 md:block dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
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
      </nav>

      {/* Hero Section */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="inline-block rounded-full bg-cyan-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                MVP in Development
              </div>
              <h2 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">
                Multi-workspace operations platform
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Designed for agencies and freelancers to manage client projects,
                team collaboration, and deliverables in one unified workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/register"
                className="inline-flex rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 px-6 py-3 font-medium text-white hover:from-amber-500 hover:to-amber-600 transition-all shadow-lg hover:shadow-xl"
              >
                Create Account
              </Link>
              <Link
                href="/test-register"
                className="inline-flex rounded-lg border-2 border-gray-300 px-6 py-3 font-medium text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
              >
                Test API
              </Link>
            </div>
          </div>

          {/* Feature Cards */}
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                🏢
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Workspaces
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Create isolated workspaces for different clients or projects.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400">
                👥
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Team Roles
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Manage permissions with role-based access control.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                📋
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Deliverables
              </h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Track projects, tasks, and client deliverables.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 px-6 py-8 dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto max-w-5xl text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            Client Ops Portal • MVP Development Version • Authentication &
            Account Management
          </p>
        </div>
      </footer>
    </main>
  );
}
