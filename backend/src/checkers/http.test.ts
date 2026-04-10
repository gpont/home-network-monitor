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
  test("ok when final URL is https://", () => {
    expect(parseRedirectResponse("https://www.google.com/")).toBe("ok");
  });
  test("ok when final URL is https:// with path", () => {
    expect(parseRedirectResponse("https://example.com/path?q=1")).toBe("ok");
  });
  test("intercepted when final URL is still http://", () => {
    expect(parseRedirectResponse("http://captive.portal.com/")).toBe("intercepted");
  });
  test("intercepted when final URL is empty", () => {
    expect(parseRedirectResponse("")).toBe("intercepted");
  });
});
