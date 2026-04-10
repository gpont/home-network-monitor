import { describe, test, expect } from "bun:test";
import { parseCaptivePortalResponse, parseRedirectResponse } from "./http.ts";

describe("parseCaptivePortalResponse", () => {
  test("clean when body is 'success'", () => {
    expect(parseCaptivePortalResponse(200, "success\n")).toBe("clean");
  });
  test("detected when body differs", () => {
    expect(parseCaptivePortalResponse(200, "<html>Login</html>")).toBe("detected");
  });
  test("detected when status is not 200", () => {
    expect(parseCaptivePortalResponse(302, "")).toBe("detected");
  });
});

describe("parseRedirectResponse", () => {
  test("ok when status is 301 and Location starts with https://", () => {
    expect(parseRedirectResponse(301, "https://google.com")).toBe("ok");
  });
  test("ok when status is 302 and Location starts with https://", () => {
    expect(parseRedirectResponse(302, "https://example.com")).toBe("ok");
  });
  test("intercepted when Location is not https", () => {
    expect(parseRedirectResponse(301, "http://google.com")).toBe("intercepted");
  });
  test("intercepted when Location is null", () => {
    expect(parseRedirectResponse(200, null)).toBe("intercepted");
  });
});
