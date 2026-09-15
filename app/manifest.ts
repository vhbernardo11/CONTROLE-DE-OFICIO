import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IntegraRadar Mobile',
    short_name: 'IntegraRadar',
    description: 'Radar disciplinado de análise do WIN',
    start_url: '/',
    display: 'standalone',
    background_color: '#07111f',
    theme_color: '#07111f',
    icons: [],
  }
}
