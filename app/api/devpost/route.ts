import { NextResponse } from "next/server";

const DEVPOST_URL =
  "https://devpost.com/api/hackathons/recommended_hackathons";

const HEADERS: Record<string, string> = {
  accept: "*/*",
  "accept-language": "en-US,en;q=0.9",
  priority: "u=1, i",
  referer: "https://devpost.com/",
  "sec-ch-ua":
    '"Chromium";v="146", "Not-A.Brand";v="24", "Opera GX";v="130"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 OPR/130.0.0.0",
};

// Fetches Devpost listings through a server route to avoid browser CORS issues.
export async function GET() {
  try {
    const res = await fetch(DEVPOST_URL, { headers: HEADERS });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Devpost returned ${res.status}` },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json, { status: 200 });
  } catch (err) {
    console.error("[devpost proxy]", err);
    return NextResponse.json(
      { error: "Failed to fetch from Devpost" },
      { status: 500 }
    );
  }
}
