/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // Signed Shortcut files: served as downloads so iOS hands them to the Shortcuts app.
    return [{ source: "/shortcuts/:file", headers: [{ key: "Content-Type", value: "application/octet-stream" }, { key: "Content-Disposition", value: "attachment" }] }];
  },
  async redirects() {
    // The markets dashboard moved into the news page.
    return [{ source: "/marches", destination: "/actualites?rubrique=bourse", permanent: true }];
  },
};

export default nextConfig;
