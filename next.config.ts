import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/incident-damage/rzr-reference/front-three-quarter.jpg",
          destination: "https://cdnmedia.endeavorsuite.com/images/organizations/b0d40c90-8d82-4557-899e-bec74a5860d7/inventory/13902516/WebLarge_JPG-2026-rzr-xps1000ultimate-crew-us-stealthgray-cgi-Front3q-Z26NMY99A4.jpg",
        },
        {
          source: "/incident-damage/rzr-reference/front.jpg",
          destination: "https://cdnmedia.endeavorsuite.com/images/organizations/b0d40c90-8d82-4557-899e-bec74a5860d7/inventory/13902516/WebLarge_JPG-2026-rzr-xps1000ultimate-crew-us-stealthgray-cgi-Front-Z26NMY99A4.jpg",
        },
        {
          source: "/incident-damage/rzr-reference/rear.jpg",
          destination: "https://cdnmedia.endeavorsuite.com/images/organizations/b0d40c90-8d82-4557-899e-bec74a5860d7/inventory/13902516/WebLarge_JPG-2026-rzr-xps1000ultimate-crew-us-stealthgray-cgi-Rear-Z26NMY99A4.jpg",
        },
        {
          source: "/incident-damage/rzr-reference/interior.jpg",
          destination: "https://cdn.dealerspike.com/imglib/v1/800x600/imglib/Assets/Inventory/92/2D/922D290A-417E-4A30-BAB4-D9AFECF602EA.jpg",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;