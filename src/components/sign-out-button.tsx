"use client";

import { signOut } from "next-auth/react";

type SignOutButtonProps = {
  className?: string;
};

export default function SignOutButton({ className = "" }: SignOutButtonProps) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/clientops" })}
      className={`whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 sm:px-4 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 ${className}`}
    >
      Sign Out
    </button>
  );
}
