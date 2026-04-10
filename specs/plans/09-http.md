# T09 — Extend http.ts checker

**Зависит от:** T04
**Блокирует:** T11
**Справочники:** [specs/arch.md](../arch.md) §3 New Tables (captive_portal_checks, http_redirect_checks),
                [specs/design.md](../design.md) §4 Layer 6 — HTTP/App

---

## Что делаем
Расширяем существующий `http.ts`: добавляем детектирование captive portal (запрос к нейтральному URL, проверка тела ответа на `"success"`) и проверку HTTP redirect (ожидаем 301/302 с `Location: https://`). Результаты записываются в таблицы `captive_portal_checks` и `http_redirect_checks`.

## Файлы
- Modify: `backend/src/checkers/http.ts`
- Test: `backend/src/checkers/http.test.ts`

- [ ] Write failing tests:
```ts
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
  test("ok when Location is https://", () => {
    expect(parseRedirectResponse(301, "https://google.com")).toBe("ok");
  });
  test("intercepted when Location is not https or missing", () => {
    expect(parseRedirectResponse(200, null)).toBe("intercepted");
  });
});
```
- [ ] Add to `http.ts`:
```ts
export function parseCaptivePortalResponse(status: number, body: string): "clean" | "detected" {
  return status === 200 && body.trim() === "success" ? "clean" : "detected";
}

export function parseRedirectResponse(status: number, location: string | null): "ok" | "intercepted" {
  return (status === 301 || status === 302) && location?.startsWith("https://") ? "ok" : "intercepted";
}
```
  And `checkCaptivePortal()` + `checkHttpRedirect()` functions that fetch and write to DB.
- [ ] Run: `bun test backend/src/checkers/http.test.ts` — expect PASS
- [ ] Commit:
```bash
git add backend/src/checkers/http.ts backend/src/checkers/http.test.ts
git commit -m "feat: captive portal and HTTP redirect checks"
```

---

## Мануальная проверка
- [ ] `bun test backend/src/checkers/http.test.ts` — все тесты зелёные
- [ ] Открой `http://localhost:3000/api/status` → поля `http.captivePortal`, `http.redirects` присутствуют
- [ ] Данные выглядят правильно (не null, не undefined)
