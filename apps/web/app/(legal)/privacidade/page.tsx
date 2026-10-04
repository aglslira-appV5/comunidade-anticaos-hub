import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import Image from 'next/image'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LegalBar } from '@components/Footers/LegalFooters'

export const metadata = {
  title: 'Política de Privacidade · Comunidade anticaos',
  description: 'Política de Privacidade da Comunidade anticaos de acordo com a LGPD (Lei 13.709/2018).',
}

const markdownComponents = {
  h1: ({ children }: any) => (
    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-6 pb-3 border-b border-gray-200">
      {children}
    </h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="text-lg sm:text-xl font-bold text-gray-900 mt-8 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mt-6 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }: any) => (
    <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-4">
      {children}
    </p>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline underline-offset-2 break-all transition-colors"
    >
      {children}
    </a>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-gray-900">{children}</strong>
  ),
  ul: ({ children }: any) => (
    <ul className="list-disc list-outside ms-6 mb-4 space-y-1.5 text-sm sm:text-base text-gray-700">
      {children}
    </ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal list-outside ms-6 mb-4 space-y-1.5 text-sm sm:text-base text-gray-700">
      {children}
    </ol>
  ),
  li: ({ children }: any) => (
    <li className="leading-relaxed">{children}</li>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-6 border border-gray-200 rounded-xl">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: any) => (
    <thead className="bg-gray-50">{children}</thead>
  ),
  tbody: ({ children }: any) => (
    <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>
  ),
  th: ({ children }: any) => (
    <th className="px-4 py-3 text-start font-semibold text-gray-900">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-4 py-3 text-gray-700">{children}</td>
  ),
  hr: () => <hr className="my-8 border-gray-200" />,
}

export default function PrivacidadePage() {
  const filePath = path.join(process.cwd(), 'content/legal/politica-de-privacidade.md')
  const content = fs.readFileSync(filePath, 'utf8')

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col justify-between text-gray-900">
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo-comunidade.webp"
              alt="Comunidade anticaos"
              width={160}
              height={32}
              unoptimized
              className="h-8 w-auto object-contain"
            />
            <span className="font-bold text-sm sm:text-base tracking-tight text-gray-900">
              Comunidade anticaos
            </span>
          </Link>
          <Link
            href="/login"
            className="text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="bg-white rounded-2xl border border-gray-200/80 p-6 sm:p-12 shadow-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        </div>
      </main>

      <footer className="py-8 border-t border-gray-200/80 bg-white">
        <LegalBar />
      </footer>
    </div>
  )
}
