const DESTINATION_ROOT = "https://nima.feri2020.ir".replace(/\/$/, "");

const BLOCKED_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function proxyHandler(req) {
  if (!DESTINATION_ROOT) {
    return new Response("TARGET is not set", { status: 500 });
  }

  try {
    const incomingUrl = new URL(req.url);
    const finalUrl = DESTINATION_ROOT + incomingUrl.pathname + incomingUrl.search;

    const outgoingHeaders = new Headers();
    let userIp = null;

    for (const [headerKey, headerValue] of req.headers) {
      const lowerKey = headerKey.toLowerCase();
      if (BLOCKED_HEADERS.has(lowerKey)) continue;
      if (lowerKey.startsWith("x-nf-")) continue;
      if (lowerKey.startsWith("x-netlify-")) continue;
      if (lowerKey === "x-real-ip") {
        userIp = headerValue;
        continue;
      }
      if (lowerKey === "x-forwarded-for") {
        if (!userIp) userIp = headerValue;
        continue;
      }
      outgoingHeaders.set(lowerKey, headerValue);
    }

    if (userIp) outgoingHeaders.set("x-forwarded-for", userIp);

    const reqMethod = req.method;
    const shouldHaveBody = reqMethod !== "GET" && reqMethod !== "HEAD";

    const requestConfig = {
      method: reqMethod,
      headers: outgoingHeaders,
      redirect: "manual",
    };

    if (shouldHaveBody) {
      requestConfig.body = req.body;
    }

    const upstreamResponse = await fetch(finalUrl, requestConfig);

    const cleanedHeaders = new Headers();
    for (const [resKey, resValue] of upstreamResponse.headers) {
      if (resKey.toLowerCase() === "transfer-encoding") continue;
      cleanedHeaders.set(resKey, resValue);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: cleanedHeaders,
    });
  } catch (err) {
    return new Response("Bad, Failed", { status: 502 });
  }
}
