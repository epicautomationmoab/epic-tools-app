import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/incident-damage/rzr-reference/front-three-quarter.jpg",
          destination: "https://cdn1.polaris.com/globalassets/rzr/2026/model/model-pages/rzr-pro-r/update/01-overview-/03-pillar-1/rzr-pro-r-my26-7b4d-pillar-01-a-xxs.jpg?v=dff57d8b",
        },
        {
          source: "/incident-damage/rzr-reference/front.jpg",
          destination: "https://cdpcdn.dx1app.com/products/USA/PO/2026/UTILVEH/UTILSPRT/RZR_PRO_R_4_ULTIMATE/49/SUPER_GRAPHITE/2000000003.jpg",
        },
        {
          source: "/incident-damage/rzr-reference/rear.jpg",
          destination: "https://cdpcdn.dx1app.com/products/USA/PO/2026/UTILVEH/UTILSPRT/RZR_PRO_R_ULTIMATE/50/INDY_RED/2000000004.jpg",
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
