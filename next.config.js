const nextConfig = {
  distDir: process.platform === 'win32' ? '.next-win' : '.next-wsl',
  output: 'export',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
