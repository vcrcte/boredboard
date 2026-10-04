/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // The markets dashboard moved into the news page.
    return [{ source: "/marches", destination: "/actualites?rubrique=bourse", permanent: true }];
  },
};

export default nextConfig;
