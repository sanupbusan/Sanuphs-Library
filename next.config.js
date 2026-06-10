const { PHASE_DEVELOPMENT_SERVER } = require('next/constants')

const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}

module.exports = (phase) => ({
  ...nextConfig,
  ...(phase === PHASE_DEVELOPMENT_SERVER && {
    distDir: process.platform === 'win32' ? '.next-win' : '.next-wsl',
  }),
})
