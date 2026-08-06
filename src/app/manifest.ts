import type { MetadataRoute } from 'next';

/** Installable to the home screen — the delivery surface chosen in discovery. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SpiceSync',
    short_name: 'SpiceSync',
    description: 'A dating app for India, built around food.',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffaf3',
    theme_color: '#d9480f',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
