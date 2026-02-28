import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'uniza-student-portal-v1',
    name: 'UNIZA Študent',
    short_name: 'UNIZA',
    description: 'Premium student portal pre študentov Žilinskej univerzity',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdfdfc',
    theme_color: '#eab308',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-1.svg',
        sizes: '1080x1920',
        type: 'image/svg+xml',
      },
      {
        src: '/screenshot-2.svg',
        sizes: '1080x1920',
        type: 'image/svg+xml',
      },
    ],
  }
}
