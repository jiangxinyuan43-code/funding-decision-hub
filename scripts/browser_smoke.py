from pathlib import Path
import os
import re
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results"
OUTPUT.mkdir(exist_ok=True)


def run_viewport(browser, name: str, width: int, height: int, context_options=None) -> None:
    options = {"viewport": {"width": width, "height": height}, "device_scale_factor": 1}
    if context_options:
        options.update(context_options)
    context = browser.new_context(**options)
    page = context.new_page()
    errors: list[str] = []
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: errors.append(str(error)))

    page.goto(os.environ.get("BROWSER_SMOKE_URL", "http://127.0.0.1:5173"), wait_until="domcontentloaded")
    page.get_by_role("heading", name="个人资金计划").wait_for()
    page.get_by_label("双十一倒计时").get_by_text("双十一", exact=True).wait_for()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"{name} has horizontal page overflow"
    page.screenshot(path=str(OUTPUT / f"home-{name}.png"), full_page=True)

    page.get_by_role("button", name="管理倒数日").click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("名称").fill("同步测试")
    dialog.get_by_label("目标日期").fill("2026-10-15")
    dialog.get_by_role("button", name="添加节点").click()
    dialog.get_by_text("同步测试", exact=True).wait_for()
    dialog.get_by_role("button", name="完成").click()
    page.get_by_label("倒数日列表").get_by_text("同步测试", exact=True).wait_for()

    page.get_by_role("button", name="配置", exact=True).click()
    page.get_by_role("heading", name="收藏的整机方案").wait_for()
    page.get_by_role("button", name="添加整机方案").click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("商品名称").fill("删除闭环测试")
    dialog.get_by_label("当前价格").fill("9999")
    dialog.get_by_label("商品链接").fill("javascript:alert(1)")
    dialog.get_by_role("button", name="保存方案").click()
    assert dialog.is_visible(), "invalid product URL must not be saved"
    dialog.get_by_label("商品链接").fill("item.example.com/test")
    dialog.get_by_role("button", name="保存方案").click()
    test_build = page.get_by_role("button", name=re.compile("删除闭环测试"))
    test_build.wait_for()

    test_build.click()
    dialog = page.get_by_role("dialog")
    dialog.get_by_label("当前价格").fill("9799")
    dialog.get_by_role("button", name="保存修改").click()
    updated_build = page.get_by_role("button", name=re.compile("删除闭环测试.*9,799"))
    updated_build.wait_for()
    updated_build.click()
    dialog = page.get_by_role("dialog")
    assert dialog.get_by_label("当前价格").input_value() == "9799"
    dialog.get_by_role("button", name="删除这条配置").click()
    dialog.get_by_role("button", name="确认删除").click()
    dialog.wait_for(state="detached")
    assert page.get_by_role("button", name=re.compile("删除闭环测试")).count() == 0

    page.locator(".build-card").first.click()
    page.get_by_role("dialog").wait_for()
    page.get_by_text("购买前", exact=True).wait_for()
    page.get_by_role("button", name="关闭").click()

    page.get_by_role("button", name="对比", exact=True).click()
    page.get_by_role("heading", name="完整对比报告").wait_for()
    page.get_by_role("heading", name="每个方案的风险与待确认项").wait_for()
    page.locator(".comparison-table" if width >= 900 else ".comparison-mobile").wait_for()
    page.screenshot(path=str(OUTPUT / f"compare-{name}.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), f"{name} compare page has horizontal overflow"

    page.get_by_role("button", name="我的", exact=True).click()
    page.get_by_role("heading", name="本地数据与 AI").wait_for()
    api_key_input = page.locator('input[type="password"]')
    api_key_input.fill("browser-test-key")
    page.get_by_role("button", name="保存 AI 设置").click()
    page.get_by_text("AI 设置已保存", exact=True).wait_for()
    page.get_by_role("button", name="移除当前 API Key").click()
    page.get_by_role("button", name="确认移除").click()
    page.get_by_text("API Key 已从当前浏览器移除", exact=True).wait_for()
    assert api_key_input.input_value() == ""

    page.get_by_role("button", name="清空本地业务数据").click()
    page.get_by_label("输入“清空”确认").fill("清空")
    page.get_by_role("button", name="清空数据").click()
    page.get_by_text("资金、配置、目标和倒数日已清空", exact=True).wait_for()
    page.get_by_role("button", name="配置", exact=True).click()
    page.get_by_role("heading", name="没有匹配的方案").wait_for()
    page.reload(wait_until="domcontentloaded")
    page.get_by_role("button", name="配置", exact=True).click()
    page.get_by_role("heading", name="没有匹配的方案").wait_for()
    assert page.locator(".build-card").count() == 0

    assert not errors, f"{name} console errors: {errors}"
    context.close()


with sync_playwright() as playwright:
    chromium = playwright.chromium.launch(headless=True)
    for width in (320, 375, 390, 414):
        run_viewport(chromium, f"mobile-{width}", width, 844)
    run_viewport(chromium, "desktop", 1440, 1000)
    chromium.close()

    iphone = dict(playwright.devices["iPhone 13"])
    iphone.pop("default_browser_type", None)
    webkit = playwright.webkit.launch(headless=True)
    run_viewport(webkit, "webkit-iphone", 390, 844, iphone)
    webkit.close()

print("Browser smoke passed: CRUD, reset persistence, Chromium 320-1440px, WebKit iPhone")
