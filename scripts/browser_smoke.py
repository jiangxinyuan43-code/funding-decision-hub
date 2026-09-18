from pathlib import Path
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results"
OUTPUT.mkdir(exist_ok=True)


def run_viewport(browser, name: str, width: int, height: int) -> None:
    context = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1)
    page = context.new_page()
    errors: list[str] = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))

    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    page.get_by_role("heading", name="个人资金计划").wait_for()
    page.get_by_label("双十一倒计时").get_by_text("双十一", exact=True).wait_for()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"{name} has horizontal page overflow"
    page.screenshot(path=str(OUTPUT / f"home-{name}.png"), full_page=True)

    page.get_by_role("button", name="添加倒数日").click()
    page.get_by_label("名称").fill("同步测试")
    page.get_by_label("目标日期").fill("2026-10-15")
    page.get_by_role("button", name="添加节点").click()
    page.get_by_label("倒数日列表").get_by_text("同步测试", exact=True).wait_for()

    page.get_by_role("button", name="添加配置", exact=True).first.click()
    page.get_by_role("dialog").wait_for()
    page.get_by_text("截图、链接和价格先保存").wait_for()
    page.get_by_role("button", name="关闭").click()

    page.get_by_role("button", name="配置", exact=True).click()
    page.get_by_role("heading", name="收藏的整机方案").wait_for()
    page.locator(".build-card").first.click()
    page.get_by_role("dialog").wait_for()
    page.get_by_text("购买前", exact=True).wait_for()
    page.get_by_role("button", name="关闭").click()

    page.get_by_role("button", name="对比", exact=True).click()
    page.get_by_role("heading", name="差异先于结论").wait_for()
    page.locator(".comparison-mobile, .comparison-table").first.wait_for()
    page.screenshot(path=str(OUTPUT / f"compare-{name}.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"{name} compare page has horizontal overflow"

    assert not errors, f"{name} console errors: {errors}"
    context.close()


with sync_playwright() as playwright:
    chromium = playwright.chromium.launch(headless=True)
    for width in (320, 375, 390, 414):
        run_viewport(chromium, f"mobile-{width}", width, 844)
    run_viewport(chromium, "desktop", 1440, 1000)
    chromium.close()

print("Browser smoke passed: mobile 390x844, desktop 1440x1000")
