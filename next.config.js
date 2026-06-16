const isVercelBuild = process.env.VERCEL === '1'

const nextConfig = {
  ...(isVercelBuild
    ? {}
    : {
        distDir: process.platform === 'win32' ? '.next-win' : '.next-wsl',
      }),
}

module.exports = nextConfig
