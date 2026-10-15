import type { ReactNode } from 'react'

export function AuthLayout({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stone-50 px-4 py-10 dark:bg-stone-950">
      <div className="w-full max-w-sm">
        <p className="mb-1 text-center text-sm font-medium tracking-wide text-teal-700 dark:text-teal-400">
          Consultorio
        </p>
        <h1 className="mb-6 text-center text-2xl font-semibold text-stone-900 dark:text-stone-100">{titulo}</h1>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200 dark:bg-stone-900 dark:ring-stone-800">
          {children}
        </div>
      </div>
    </main>
  )
}
