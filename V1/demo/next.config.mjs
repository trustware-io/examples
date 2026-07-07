/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Emits e.g. headless/index.html instead of headless.html so clean URLs
  // resolve via directory-index on any static host (S3, CloudFront, Amplify).
  trailingSlash: true,
};

export default nextConfig;
