import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'uniza-student-portal-v1',
    name: 'UNIZA Študent',
    short_name: 'UNIZA',
    description: 'Mobilný študentský portál pre študentov Žilinskej univerzity',
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
        src: '/screenshot-home.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Domov s aktuálnou hodinou a zostatkom ISIC',
      },
      {
        src: '/screenshot-schedule.png',
        sizes: '1080x1920',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Rozvrh na deň',
      },
      {
        src: '/screenshot-wide.png',
        sizes: '1920x1080',
        type: 'image/png',
        form_factor: 'wide',
        label: 'Prehľad na počítači',
      },
    ],
  }
}
