import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IntegraRadar Mobile',
  description: 'Painel disciplinado de análise do WIN - IntegraInvestimentos',
  applicationName: 'IntegraRadar Mobile',
  themeColor: '#07111f',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
