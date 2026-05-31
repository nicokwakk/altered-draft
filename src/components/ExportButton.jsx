import { useState } from 'react'

export default function ExportButton({ decklist, small }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!decklist) return
    await navigator.clipboard.writeText(decklist)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      disabled={!decklist}
      className={`
        ${small ? 'w-full py-2 text-xs' : 'px-4 py-2 text-sm'}
        rounded-lg font-medium transition-colors disabled:opacity-40
        ${copied
          ? 'bg-green-600 text-white'
          : 'bg-amber-500 hover:bg-amber-400 text-gray-950'}
      `}
    >
      {copied ? '✓ Copied!' : 'Copy decklist for altered.re'}
    </button>
  )
}
