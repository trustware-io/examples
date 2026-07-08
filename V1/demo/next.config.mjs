/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  // Emits e.g. headless/index.html instead of headless.html so clean URLs
  // resolve via directory-index on any static host (S3, CloudFront, Amplify).
  trailingSlash: true,
  // Strict Mode double-mounts components in dev to surface effect bugs. For
  // the WebGL <Canvas> in RouteScene, that can spin up two GL contexts back
  // to back and blow past the browser's context budget, which reads as an
  // intermittent "Context Lost" a few seconds after the scene first paints.
  reactStrictMode: false,
};

export default nextConfig;
