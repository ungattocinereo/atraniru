---
name: atrani-blog-article
description: Use when creating blog articles, posts, or editorial content pages for atrani.ru - travel guides, stories, tips, reviews with full article structure
---

# Atrani.ru Blog Article Generator

## Overview

Generate blog article pages for atrani.ru using the Navy Brutalist design system with full editorial features.

## Design System

Inherits all colors, typography, and base styles from `atrani-static-page` skill.

### Colors (Quick Reference)
```css
--color-navy-deep: #000A27;    /* Primary dark */
--color-navy: #0A1628;         /* Secondary dark - borders */
--color-orange: #FF5722;       /* Accent - CTAs, highlights, borders */
--color-gray: #8B9BB4;         /* Text secondary */
--color-gray-dark: #4A5568;    /* Body text */
--color-gray-light: #E2E8F0;   /* Tags background */
--color-bg-light: #F0F4F8;     /* Info-box background */
```

### Typography
```css
--font-display: 'Unbounded', sans-serif;  /* Headlines, titles */
--font-body: 'Space Grotesk', sans-serif; /* Body text, UI */
```

### Blog-Specific Components

**Article Hero** - Full-bleed background image with gradient overlay

Container (.article-hero):
```css
.article-hero {
    min-height: 90vh;
    display: flex;
    align-items: center;
    position: relative;
    padding: 120px 40px 80px;
    overflow: hidden;
}
.article-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0,10,39,0.95) 0%, rgba(0,10,39,0.7) 50%, rgba(0,10,39,0.4) 100%);
    z-index: 1;
}
```

Full HTML structure:
```html
<header class="article-hero">
    <!-- Фоновое изображение -->
    <div class="article-hero-bg">
        <img src="hero-image.jpg" alt="">
    </div>

    <!-- Контент поверх градиента -->
    <div class="article-hero-content">
        <div class="article-meta">
            <span class="article-category">Маршруты</span>
            <time class="article-date" datetime="2024-03-15">15 марта 2024</time>
            <span class="article-read-time">12 мин чтения</span>
        </div>
        <h1 class="article-title">Тропа богов: полный гид</h1>
        <p class="article-excerpt">Всё, что нужно знать о самом знаменитом треке Амальфитаны</p>
        <div class="author-block">
            <img src="author.jpg" class="author-avatar" alt="Марко Росси">
            <div class="author-info">
                <span class="author-name">Марко Росси</span>
                <span class="author-role">Местный гид</span>
            </div>
        </div>
    </div>
</header>
```

Hero sub-components:

**.article-hero-bg** - position: absolute, inset: 0, z-index: 0
```css
.article-hero-bg img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
```

**.article-hero-content** - position: relative, z-index: 2, max-width: 800px, margin: 0 auto, color: white

**.article-meta** - display: flex, gap: 16px, flex-wrap: wrap, margin-bottom: 24px, font-size: 14px

**.article-category** - padding: 6px 12px, background: --color-orange, font-weight: 700, uppercase

**.article-title** - font: Unbounded, size: clamp(36px, 6vw, 64px), weight: 800, line-height: 1.1, margin-bottom: 24px

**.article-excerpt** - font-size: 20px, color: --color-gray, max-width: 600px, margin-bottom: 32px

**.author-block** - display: flex, gap: 16px, align-items: center

**.author-avatar** - width: 56px, height: 56px, border-radius: 50%, object-fit: cover

**Responsive:**
- ≤768px: padding: 100px 20px 60px, article-title: 32px

**Featured Image** - Below hero with caption
```html
<figure class="featured-image reveal">
    <img src="..." alt="...">
    <figcaption>Caption text</figcaption>
</figure>
```

**Article Content** - Max-width 720px, 18px body text
```html
<div class="article-content">
    <p class="reveal">First paragraph with drop cap...</p>
    <h2 class="reveal">Section heading</h2>
    <p class="reveal">Body text...</p>
    <blockquote class="reveal">
        <p>Quote text</p>
        <cite>— Attribution</cite>
    </blockquote>
</div>
```

**Drop Cap** - First paragraph only
```css
.article-content p:first-of-type::first-letter {
    font-family: var(--font-display);
    font-size: 72px;
    font-weight: 800;
    float: left;
    line-height: 0.8;
    margin-right: 12px;
    color: var(--color-navy);
}
```

**Blockquote** - Border style, NOT dark fill

ВАЖНО: Используйте рамку с оранжевым левым акцентом, НЕ тёмный фон!

```html
<blockquote class="reveal">
    <p>Атрани слишком мал, чтобы врать. Здесь всё настоящее.</p>
    <cite>— Местная мудрость</cite>
</blockquote>
```

```css
.article-content blockquote {
    padding: 32px 40px;
    background: transparent;
    border: 2px solid var(--color-navy);
    border-left: 4px solid var(--color-orange);
    position: relative;
    margin: 48px 0;
}

/* Декоративная кавычка */
.article-content blockquote::before {
    content: '"';
    position: absolute;
    top: -10px;
    left: 24px;
    font-family: var(--font-display);
    font-size: 80px;
    font-weight: 900;
    color: var(--color-orange);
    line-height: 1;
    opacity: 0.4;
}

.article-content blockquote p {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--color-navy);  /* Dark text on light bg */
    margin-bottom: 16px;
}

.article-content blockquote cite {
    font-size: 14px;
    color: var(--color-gray);
    font-style: normal;
}
```

**Info Box** - Light gray background with orange left border
```html
<div class="info-box reveal">
    <div class="info-box-title">Важно знать</div>
    <ul>
        <li>Сложность: средняя</li>
        <li>Длина: 7,8 км</li>
        <li>Время: 4-6 часов</li>
    </ul>
</div>
```

```css
.info-box {
    padding: 32px;
    background: var(--color-bg-light);  /* #F0F4F8 */
    border-left: 4px solid var(--color-orange);
    margin: 48px 0;
}

.info-box-title {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-orange);
    margin-bottom: 12px;
}

.info-box ul {
    padding-left: 20px;
    color: var(--color-gray-dark);
}

.info-box li {
    margin-bottom: 8px;
}
```

**In-Article Figure** - Extends beyond content width
```html
<figure class="reveal">
    <img src="..." alt="...">
    <figcaption>Caption</figcaption>
</figure>
```
```css
.article-content figure {
    margin: 48px -80px;  /* Extends beyond 720px content */
}
```

**Tags** - Gray background, hover: navy with white text
```html
<div class="article-tags reveal">
    <a href="#" class="tag">Маршруты</a>
    <a href="#" class="tag">Треккинг</a>
    <a href="#" class="tag">Позитано</a>
    <a href="#" class="tag">Амальфи</a>
</div>
```

```css
.article-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 48px 0;
}

.tag {
    display: inline-block;
    padding: 8px 16px;
    background: var(--color-gray-light);  /* #E2E8F0 */
    font-size: 13px;
    font-weight: 500;
    color: var(--color-navy);
    text-decoration: none;
    transition: all 0.3s;
}

.tag:hover {
    background: var(--color-navy);
    color: white;
}
```

**Share Block**
```html
<div class="share-block reveal">
    <span class="share-label">Поделиться</span>
    <div class="share-buttons">
        <a href="#" class="share-btn">TG</a>
        <a href="#" class="share-btn">WA</a>
        <a href="#" class="share-btn">FB</a>
    </div>
</div>
```

**Author Bio** - Border style, NOT dark fill

ВАЖНО: Используйте рамку, НЕ тёмный фон!

```html
<div class="author-bio reveal">
    <img src="author.jpg" class="author-bio-avatar" alt="Марко Росси">
    <div class="author-bio-content">
        <h4>Марко Росси</h4>
        <p>Родился в Атрани, 15 лет водит экскурсии по побережью...</p>
        <div class="author-bio-links">
            <a href="#">Instagram</a>
            <a href="#">Все статьи автора</a>
        </div>
    </div>
</div>
```

```css
.author-bio {
    display: flex;
    gap: 32px;
    padding: 40px;
    background: transparent;
    border: 2px solid var(--color-navy);
    position: relative;
    margin: 48px 0;
}

/* Лейбл на рамке */
.author-bio::before {
    content: 'Об авторе';
    position: absolute;
    top: -12px;
    left: 24px;
    background: white;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--color-orange);
}

.author-bio-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.author-bio-content h4 {
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 12px;
}

.author-bio-content p {
    color: var(--color-gray-dark);
    margin-bottom: 16px;
}

.author-bio-links {
    display: flex;
    gap: 16px;
}

.author-bio-links a {
    color: var(--color-orange);
    font-weight: 500;
}
```

**Related Articles** - 3-column grid
```html
<section class="related-section">
    <div class="related-header">
        <h2 class="related-title">Читайте также</h2>
        <a href="#" class="related-link">Все статьи →</a>
    </div>
    <div class="related-grid">
        <article class="related-card reveal">
            <div class="related-card-image">
                <img src="related-1.jpg" alt="Равелло">
                <span class="related-card-category">Города</span>
            </div>
            <div class="related-card-content">
                <h3 class="related-card-title"><a href="#">Равелло: город музыки</a></h3>
                <p class="related-card-meta">8 мин · 12 марта 2024</p>
            </div>
        </article>
    </div>
</section>
```

```css
.related-section {
    padding: 80px 40px;
    background: var(--color-bg-light);
}

.related-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto 48px;
}

.related-title {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 800;
}

.related-link {
    color: var(--color-orange);
    font-weight: 600;
}

.related-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
    max-width: 1200px;
    margin: 0 auto;
}

.related-card {
    background: white;
    overflow: hidden;
    transition: transform 0.3s;
}

.related-card:hover {
    transform: translateY(-8px);
}

.related-card-image {
    position: relative;
    aspect-ratio: 16/10;
    overflow: hidden;
}

.related-card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.related-card-category {
    position: absolute;
    top: 16px;
    left: 16px;
    padding: 4px 12px;
    background: var(--color-orange);
    color: white;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

.related-card-content {
    padding: 24px;
}

.related-card-title {
    font-family: var(--font-display);
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
}

.related-card-title a {
    color: var(--color-navy);
    text-decoration: none;
}

.related-card-meta {
    font-size: 13px;
    color: var(--color-gray);
}

@media (max-width: 768px) {
    .related-grid {
        grid-template-columns: 1fr;
    }
}
```

**Comments Section**
```html
<section class="comments-section">
    <div class="comments-header">
        <h2 class="comments-title">Комментарии</h2>
        <span class="comments-count">3 комментария</span>
    </div>
    <div class="comment reveal">
        <div class="comment-header">
            <img src="user.jpg" class="comment-avatar" alt="Анна">
            <div>
                <div class="comment-author">Анна К.</div>
                <div class="comment-date">2 дня назад</div>
            </div>
        </div>
        <div class="comment-body">Прошли этот маршрут в прошлом году, незабываемые впечатления!</div>
        <div class="comment-actions">
            <button class="comment-action">♡ 5</button>
            <button class="comment-action">Ответить</button>
        </div>
    </div>
    <form class="comment-form reveal">
        <textarea class="comment-input" placeholder="Ваш комментарий..."></textarea>
        <button type="submit" class="btn btn-primary">Отправить</button>
    </form>
</section>
```

```css
.comments-section {
    max-width: 720px;
    margin: 0 auto;
    padding: 48px 0;
}

.comments-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
}

.comments-title {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 800;
}

.comments-count {
    font-size: 14px;
    color: var(--color-gray);
}

.comment {
    padding: 24px 0;
    border-bottom: 1px solid var(--color-gray-light);
}

.comment-header {
    display: flex;
    gap: 16px;
    align-items: center;
    margin-bottom: 12px;
}

.comment-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
}

.comment-author {
    font-weight: 600;
}

.comment-date {
    font-size: 13px;
    color: var(--color-gray);
}

.comment-body {
    color: var(--color-gray-dark);
    line-height: 1.6;
    margin-bottom: 12px;
}

.comment-actions {
    display: flex;
    gap: 16px;
}

.comment-action {
    background: none;
    border: none;
    color: var(--color-gray);
    font-size: 14px;
    cursor: pointer;
    transition: color 0.3s;
}

.comment-action:hover {
    color: var(--color-orange);
}

.comment-form {
    margin-top: 32px;
}

.comment-input {
    width: 100%;
    padding: 16px;
    font-family: var(--font-body);
    font-size: 16px;
    border: 2px solid var(--color-gray-light);
    min-height: 120px;
    resize: vertical;
    margin-bottom: 16px;
}

.comment-input:focus {
    outline: none;
    border-color: var(--color-navy);
}
```

**Newsletter** - Orange background with white content
```html
<section class="newsletter">
    <div class="newsletter-content">
        <h2 class="newsletter-title">Италия в вашей почте</h2>
        <p class="newsletter-text">Раз в неделю — лучшие маршруты, секретные места и советы от местных</p>
        <form class="newsletter-form">
            <input type="email" class="newsletter-input" placeholder="Ваш email" required>
            <button type="submit" class="newsletter-btn">Подписаться</button>
        </form>
    </div>
</section>
```

```css
.newsletter {
    background: var(--color-orange);
    padding: 80px 40px;
    text-align: center;
}

.newsletter-content {
    max-width: 600px;
    margin: 0 auto;
}

.newsletter-title {
    font-family: var(--font-display);
    font-size: 36px;
    font-weight: 800;
    color: white;
    margin-bottom: 16px;
}

.newsletter-text {
    color: rgba(255,255,255,0.9);
    font-size: 18px;
    margin-bottom: 32px;
}

.newsletter-form {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
}

.newsletter-input {
    padding: 16px 24px;
    font-size: 16px;
    border: none;
    min-width: 280px;
}

.newsletter-btn {
    padding: 16px 32px;
    background: var(--color-navy);
    color: white;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
}

.newsletter-btn:hover {
    background: var(--color-navy-deep);
}
```

**Reading Progress Bar** - Fixed at top, orange, 4px height
```html
<div class="reading-progress" id="progress"></div>
```

```css
.reading-progress {
    position: fixed;
    top: 0;
    left: 0;
    height: 4px;
    background: var(--color-orange);
    width: 0%;
    z-index: 1000;
    transition: width 0.1s;
}
```

```javascript
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = (scrollTop / docHeight) * 100;
    document.getElementById('progress').style.width = progress + '%';
});
```

### Key Style Rules

1. **Quotes and bios use BORDERS, not dark fills** - transparent background with navy border and orange left accent
2. **Hero has background image** - full-bleed with gradient overlay
3. **Drop cap on first paragraph** only
4. **Content max-width 720px** - images can extend to -80px margins
5. **Reading progress bar** - fixed at top, orange, 4px height

### Accessibility

Same as `atrani-static-page` plus:
- `<article>` wrapper for main content
- `<time datetime="...">` for dates
- Form labels with `for` attributes
- Button elements for interactive actions (not links)

### Reference

- Full template: `/Users/greg/Documents/Code/Atraniru/concept-8-blog-article.html`
- Design guidelines: `/Users/greg/Documents/Code/Atraniru/design-guidelines.html`
- Base styles: See `atrani-static-page` skill
