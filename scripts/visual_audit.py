"""
Visual and Mobile SEO Audit for atrani.ru
Captures screenshots at multiple viewports and extracts page metadata.
"""
from playwright.sync_api import sync_playwright
import json
import os

SCREENSHOTS_DIR = "/Users/greg/Documents/Code/Atraniru/screenshots"

VIEWPORTS = {
    "desktop": {"width": 1440, "height": 900},
    "mobile": {"width": 375, "height": 812},
    "tablet": {"width": 768, "height": 1024},
    "laptop": {"width": 1366, "height": 768},
}

URL = "https://atrani.ru"

def run_audit():
    results = {}

    with sync_playwright() as p:
        browser = p.chromium.launch()

        for device_name, vp in VIEWPORTS.items():
            print(f"\n--- Capturing {device_name} ({vp['width']}x{vp['height']}) ---")

            context = browser.new_context(
                viewport=vp,
                device_scale_factor=2 if device_name == "mobile" else 1,
                user_agent=(
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
                    if device_name == "mobile"
                    else None
                ),
            )
            page = context.new_page()

            try:
                page.goto(URL, wait_until="networkidle", timeout=30000)
            except Exception as e:
                print(f"  Warning during navigation: {e}")

            # Above-the-fold screenshot
            atf_path = os.path.join(SCREENSHOTS_DIR, f"{device_name}_above_fold.png")
            page.screenshot(path=atf_path, full_page=False)
            print(f"  Saved above-the-fold: {atf_path}")

            # Full-page screenshot
            full_path = os.path.join(SCREENSHOTS_DIR, f"{device_name}_full_page.png")
            page.screenshot(path=full_path, full_page=True)
            print(f"  Saved full page: {full_path}")

            # Extract audit data via JavaScript
            audit_data = page.evaluate("""() => {
                const result = {};

                // Viewport meta tag
                const viewportMeta = document.querySelector('meta[name="viewport"]');
                result.viewportMeta = viewportMeta ? viewportMeta.getAttribute('content') : null;

                // Title and meta description
                result.title = document.title;
                const metaDesc = document.querySelector('meta[name="description"]');
                result.metaDescription = metaDesc ? metaDesc.getAttribute('content') : null;

                // H1 tags
                const h1s = document.querySelectorAll('h1');
                result.h1Tags = Array.from(h1s).map(h => ({
                    text: h.textContent.trim().substring(0, 100),
                    visible: h.offsetParent !== null,
                    rect: h.getBoundingClientRect()
                }));

                // CTA buttons / links above the fold
                const allLinks = document.querySelectorAll('a, button');
                result.ctaElements = [];
                Array.from(allLinks).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    if (rect.top < window.innerHeight && rect.width > 0 && rect.height > 0) {
                        result.ctaElements.push({
                            tag: el.tagName,
                            text: el.textContent.trim().substring(0, 80),
                            href: el.href || null,
                            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
                            fontSize: style.fontSize,
                            minDimension: Math.min(rect.width, rect.height)
                        });
                    }
                });

                // Font sizes on page
                const textElements = document.querySelectorAll('p, span, a, li, td, th, label, div');
                const fontSizes = new Set();
                const smallFontElements = [];
                Array.from(textElements).forEach(el => {
                    const style = window.getComputedStyle(el);
                    const size = parseFloat(style.fontSize);
                    fontSizes.add(size);
                    if (size < 16 && el.textContent.trim().length > 0 && el.offsetParent !== null) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            smallFontElements.push({
                                tag: el.tagName,
                                text: el.textContent.trim().substring(0, 60),
                                fontSize: size,
                                rect: { top: rect.top, left: rect.left }
                            });
                        }
                    }
                });
                result.fontSizes = Array.from(fontSizes).sort((a, b) => a - b);
                result.smallFontElements = smallFontElements.slice(0, 20);

                // Touch targets below 48px
                const interactiveEls = document.querySelectorAll('a, button, input, select, textarea, [role="button"]');
                result.smallTouchTargets = [];
                Array.from(interactiveEls).forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.width > 0 && rect.height > 0) {
                        const minDim = Math.min(rect.width, rect.height);
                        if (minDim < 48) {
                            result.smallTouchTargets.push({
                                tag: el.tagName,
                                text: el.textContent.trim().substring(0, 60),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height),
                                minDimension: Math.round(minDim)
                            });
                        }
                    }
                });
                result.smallTouchTargets = result.smallTouchTargets.slice(0, 30);

                // Images
                const images = document.querySelectorAll('img');
                result.images = Array.from(images).map(img => ({
                    src: img.src ? img.src.substring(0, 120) : null,
                    alt: img.alt || null,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                    displayWidth: img.clientWidth,
                    displayHeight: img.clientHeight,
                    loading: img.loading,
                    hasLazyLoading: img.loading === 'lazy'
                }));

                // Horizontal overflow
                result.pageWidth = document.documentElement.scrollWidth;
                result.viewportWidth = window.innerWidth;
                result.hasHorizontalOverflow = document.documentElement.scrollWidth > window.innerWidth;

                // Background images
                result.backgroundImages = [];
                const allEls = document.querySelectorAll('*');
                Array.from(allEls).forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (style.backgroundImage && style.backgroundImage !== 'none' && style.backgroundImage.includes('url(')) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 200 && rect.height > 200) {
                            result.backgroundImages.push({
                                tag: el.tagName,
                                className: el.className ? String(el.className).substring(0, 80) : '',
                                backgroundImage: style.backgroundImage.substring(0, 200),
                                size: { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top) }
                            });
                        }
                    }
                });

                // OG tags
                const ogTags = document.querySelectorAll('meta[property^="og:"]');
                result.ogTags = {};
                ogTags.forEach(tag => {
                    result.ogTags[tag.getAttribute('property')] = tag.getAttribute('content');
                });

                // Check color contrast on key elements
                result.contrastCheck = [];
                const textEls = document.querySelectorAll('h1, h2, h3, p, a, span, li');
                Array.from(textEls).slice(0, 30).forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (el.textContent.trim().length > 0 && el.offsetParent !== null) {
                        result.contrastCheck.push({
                            tag: el.tagName,
                            text: el.textContent.trim().substring(0, 40),
                            color: style.color,
                            backgroundColor: style.backgroundColor,
                            fontSize: style.fontSize
                        });
                    }
                });

                return result;
            }""")

            results[device_name] = audit_data
            print(f"  Audit data collected for {device_name}")

            context.close()

        browser.close()

    # Save results
    output_path = os.path.join(SCREENSHOTS_DIR, "audit_results.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\nAudit results saved to {output_path}")

if __name__ == "__main__":
    run_audit()
