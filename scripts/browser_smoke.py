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
    page.get_by_role("heading", name="今天的资金与候选").wait_for()
    page.get_by_text("购机决策截止", exact=True).wait_for()
    page.screenshot(path=str(OUTPUT / f"home-{name}.png"), full_page=True)

    page.get_by_role("button", name="添加配置", exact=True).first.click()
    page.get_by_role("dialog").wait_for()
    page.get_by_text("截图、链接和价格先保存").wait_for()
    page.get_by_role("button", name="关闭").click()

    page.get_by_role("button", name="资金", exact=True).click()
    page.get_by_role("heading", name="把目标放进时间里").wait_for()
    page.get_by_role("button", name="编辑资金计划").click()
    page.get_by_role("dialog").wait_for()
    page.get_by_label("目标名称").first.wait_for()
    page.get_by_role("button", name="关闭").click()

    page.get_by_role("button", name="配置", exact=True).click()
    page.get_by_role("heading", name="收藏的整机方案").wait_for()
    page.locator(".build-card").first.click()
    page.get_by_role("dialog").wait_for()
    page.get_by_text("购买前", exact=True).wait_for()
    page.get_by_role("button", name="关闭").click()

    page.get_by_role("button", name="对比", exact=True).click()
    page.get_by_role("heading", name="差异先于结论").wait_for()
    page.locator(".comparison-table").wait_for()
    page.screenshot(path=str(OUTPUT / f"compare-{name}.png"), full_page=True)

    assert not errors, f"{name} console errors: {errors}"
    context.close()


with sync_playwright() as playwright:
    chromium = playwright.chromium.launch(headless=True)
    run_viewport(chromium, "mobile", 390, 844)
    run_viewport(chromium, "desktop", 1440, 1000)
    chromium.close()

print("Browser smoke passed: mobile 390x844, desktop 1440x1000")
