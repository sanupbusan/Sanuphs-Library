const nextConfig = {
  distDir: process.platform === 'win32' ? '.next-win' : '.next-wsl',
}

module.exports = nextConfig
