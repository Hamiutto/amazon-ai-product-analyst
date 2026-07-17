/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.media-amazon.com"
      },
      {
        protocol: "https",
        hostname: "**.ssl-images-amazon.com"
      },
      {
        protocol: "https",
        hostname: "**.images-amazon.com"
      }
    ]
  }
};

export default nextConfig;
