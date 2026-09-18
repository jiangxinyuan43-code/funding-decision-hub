from pathlib import Path
import os
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "test-results"
OUTPUT.mkdir(exist_ok=True)
URL = os.environ.get("BROWSER_SMOKE_URL", "http://127.0.0.1:5173")

SETUP_HTML = """
<!doctype html><meta charset="utf-8"><title>migration setup</title>
<script>
window.setup = new Promise((resolve, reject) => {
  const request = indexedDB.open('funding-decision-hub', 10);
  request.onerror = () => reject(request.error);
  request.onupgradeneeded = () => {
    const db = request.result;
    db.createObjectStore('settings', {keyPath: 'id'});
    const finance = db.createObjectStore('financePlans', {keyPath: 'id'}); finance.createIndex('targetDate', 'targetDate');
    const countdowns = db.createObjectStore('countdowns', {keyPath: 'id'});
    countdowns.createIndex('targetDate', 'targetDate'); countdowns.createIndex('pinned', 'pinned'); countdowns.createIndex('showOnHome', 'showOnHome');
    const goals = db.createObjectStore('goals', {keyPath: 'id'});
    goals.createIndex('category', 'category'); goals.createIndex('targetDate', 'targetDate'); goals.createIndex('active', 'active');
    const builds = db.createObjectStore('builds', {keyPath: 'id'});
    builds.createIndex('status', 'status'); builds.createIndex('favorite', 'favorite'); builds.createIndex('price', 'price');
    builds.createIndex('createdAt', 'createdAt'); builds.createIndex('updatedAt', 'updatedAt'); builds.createIndex('tags', 'tags', {multiEntry: true});
  };
  request.onsuccess = () => {
    const db = request.result;
    const field = (value) => ({value, confidence: 1, source: 'manual', confirmed: true});
    const transaction = db.transaction('builds', 'readwrite');
    transaction.objectStore('builds').put({
      id: 'legacy-with-image', title: '旧版截图迁移方案', platform: '其他', store: '', url: '', price: 9999,
      status: 'candidate', favorite: true, tags: [], completeness: 20,
      components: {cpu: field('7800X3D'), gpu: field('RTX 5070'), vram: field(''), motherboard: field(''), ram: field(''), ramSpeed: field(''), ssd: field(''), psu: field(''), cooler: field(''), case: field('')},
      images: [{id: 'legacy-image', name: 'large.jpg', type: 'image/jpeg', size: 4194304, original: new Blob([new Uint8Array(4194304)], {type: 'image/jpeg'}), compressedDataUrl: 'data:image/jpeg;base64,/9j/2Q==', createdAt: new Date().toISOString()}],
      priceHistory: [], snapshots: [], checklist: [], note: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    });
    transaction.oncomplete = () => { db.close(); resolve(true); };
    transaction.onerror = () => reject(transaction.error);
  };
});
</script>
"""


def iphone_options(playwright):
    device = dict(playwright.devices["iPhone 13"])
    device.pop("default_browser_type", None)
    return device


with sync_playwright() as playwright, TemporaryDirectory(prefix="funding-reentry-") as profile:
    options = iphone_options(playwright)
    context = playwright.webkit.launch_persistent_context(profile, headless=True, **options)
    page = context.new_page()
    page.route("**/migration-setup", lambda route: route.fulfill(status=200, content_type="text/html", body=SETUP_HTML))
    page.goto(f"{URL}/migration-setup")
    page.evaluate("window.setup")
    page.goto(URL, wait_until="domcontentloaded")
    page.get_by_role("heading", name="个人资金计划").wait_for()
    migrated = page.evaluate("""async () => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('funding-decision-hub');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const transaction = db.transaction(['builds', 'buildImages'], 'readonly');
      const build = await new Promise((resolve, reject) => {
        const request = transaction.objectStore('builds').get('legacy-with-image');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const image = await new Promise((resolve, reject) => {
        const request = transaction.objectStore('buildImages').get('legacy-image');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return {buildImageCount: build.images.length, imageMoved: image.buildId === build.id, originalRemoved: !('original' in image)};
    }""")
    assert migrated == {"buildImageCount": 0, "imageMoved": True, "originalRemoved": True}, migrated
    context.close()

    for attempt in range(1, 5):
      context = playwright.webkit.launch_persistent_context(profile, headless=True, **options)
      page = context.pages[0] if context.pages else context.new_page()
      errors = []
      page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
      page.on("pageerror", lambda error: errors.append(str(error)))
      page.goto(URL, wait_until="domcontentloaded")
      page.get_by_role("heading", name="个人资金计划").wait_for()
      assert not errors, f"reentry {attempt} errors: {errors}"
      if attempt == 4:
        page.screenshot(path=str(OUTPUT / "webkit-reentry-after-image-migration.png"), full_page=True)
      context.close()

print("WebKit reentry passed: v1 image migration and four full browser restarts", flush=True)
