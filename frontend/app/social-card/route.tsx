import { ImageResponse } from "next/og";
import { PRODUCT_NAME } from "@/lib/product";

export function GET() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        padding: "90px",
        background: "#f5f8f4",
        color: "#173b30",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "18px",
          marginBottom: "72px",
          fontSize: "34px",
          fontWeight: 700,
        }}
      >
        <svg width="40" height="44" viewBox="0 0 40 44">
          <g fill="#17664c" transform="translate(2 5) skewY(-14)">
            <rect y="21" width="8" height="17" rx="2" opacity=".48" />
            <rect x="13" y="12" width="8" height="26" rx="2" opacity=".7" />
            <rect x="26" width="8" height="38" rx="2" />
          </g>
        </svg>
        {PRODUCT_NAME}
      </div>
      <div
        style={{
          fontSize: "72px",
          lineHeight: 1.1,
          fontWeight: 700,
          letterSpacing: "-3px",
          maxWidth: "1000px",
        }}
      >
        Find businesses that need what you sell.
      </div>
      <div style={{ marginTop: "28px", fontSize: "27px", color: "#536a60" }}>
        Start with your website. Build a list you can act on.
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "X-Robots-Tag": "noindex" } },
  );
}
