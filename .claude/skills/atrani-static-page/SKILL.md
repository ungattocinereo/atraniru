---
name: atrani-static-page
description: Use when creating static pages for atrani.ru website - landing pages, about pages, services, apartments listings, or any non-blog content pages
---

# Atrani.ru Static Page Generator

## Overview

Generate static HTML pages for atrani.ru using the Navy Brutalist design system (Concept 8).

## Design System

### Colors
```css
--color-navy-deep: #000A27;    /* Primary dark - hero, footer, stats */
--color-navy: #0A1628;         /* Secondary dark - buttons, overlays */
--color-navy-medium: #152238;  /* Tertiary dark */
--color-navy-light: #1E3050;   /* Lighter dark */
--color-orange: #FF5722;       /* Accent - CTAs, highlights */
--color-orange-light: #FF8A65; /* Accent hover */
--color-gray: #8B9BB4;         /* Text secondary */
--color-gray-dark: #4A5568;    /* Body text */
--color-gray-light: #E2E8F0;   /* Tags, borders */
--color-bg-light: #F0F4F8;     /* Info-box, light sections */
--color-white: #FFFFFF;
```

### Typography
```css
--font-display: 'Unbounded', sans-serif;  /* Headlines, logo, numbers */
--font-body: 'Space Grotesk', sans-serif; /* Body text, UI */
```

Google Fonts link:
```html
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Unbounded:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

### Core Components

**Header** - Fixed, mix-blend-mode: difference
```html
<header class="header" role="banner">
    <a href="/" class="logo">АМАЛЬФИГЕТЬ</a>
    <nav class="nav" role="navigation">...</nav>
</header>
```

**Hero** - Full viewport, navy-deep background

Hero container (.hero):
```css
.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  background: var(--color-navy-deep);
  color: white;
  overflow: hidden;
  padding: 120px 40px 80px;
}
```

Full HTML structure:
```html
<section class="hero">
    <!-- Декоративный фоновый текст -->
    <div class="hero-bg-text" aria-hidden="true">AMALFI</div>

    <!-- Контент (z-index: 1) -->
    <div class="hero-content">
        <p class="hero-label">Амальфитанское побережье</p>
        <h1>
            <span class="highlight">АМАЛЬ-</span>
            ФИГЕТЬ!
        </h1>
        <p class="hero-subtitle">Самый маленький город Италии...</p>
        <div class="hero-actions">
            <a href="#" class="btn btn-white">Исследовать</a>
            <a href="#" class="btn btn-outline" style="border-color: white; color: white;">Апартаменты</a>
        </div>
    </div>

    <!-- Изображение справа (опционально) -->
    <div class="hero-image">
        <img src="photo.jpg" alt="Описание">
    </div>

    <!-- Индикатор скролла -->
    <div class="scroll-indicator">Scroll</div>
</section>
```

Hero sub-components:

**.hero-content** - z-index: 1, max-width: 1400px, margin: 0 auto

**.hero-label** - 14px uppercase, letter-spacing: 3px, color: --color-gray, ::before orange line 40px × 2px

**.hero h1** - font: Unbounded, size: clamp(60px, 12vw, 180px), weight: 900, line-height: 0.9, letter-spacing: -4px
- **.highlight** - color: --color-orange, display: block (переносит на новую строку)

**.hero-subtitle** - size: clamp(18px, 2vw, 24px), color: --color-gray, max-width: 600px

**.hero-actions** - display: flex, gap: 16px, flex-wrap: wrap

**.hero-bg-text** - position: absolute, center, font-size: clamp(150px, 25vw, 400px), color: rgba(255,255,255,0.03), pointer-events: none

**.hero-image** - position: absolute, right: 0, bottom: 0, width: 50%, height: 80%
```css
.hero-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  clip-path: polygon(20% 0, 100% 0, 100% 100%, 0% 100%);
}
```

**.scroll-indicator** - position: absolute, bottom: 40px, left: 40px, ::after line 60px

**Animation delays:**
- hero-label: 0.2s
- h1: 0.3s
- hero-subtitle: 0.4s
- hero-actions: 0.5s
- hero-image: 0.6s

**Responsive:**
- ≤1024px: hero-image hidden
- ≤768px: padding: 100px 20px 60px

**Marquee** - Orange background, infinite scroll
```html
<div class="marquee" aria-hidden="true">
    <div class="marquee-content">
        <div class="marquee-item">Text <span></span> Text <span></span></div>
        <div class="marquee-item">Text <span></span> Text <span></span></div>
    </div>
</div>
```

**Section Headers** - Label + Title pattern
```html
<div class="section-header reveal">
    <p class="section-label">01 — Впечатления</p>
    <h2 class="section-title">Чем заняться</h2>
</div>
```

```css
.section-label {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 3px;
    color: var(--color-orange);
    margin-bottom: 16px;
}

.section-title {
    font-family: var(--font-display);
    font-size: 48px;
    font-weight: 800;
    line-height: 1;
    letter-spacing: -2px;
}
```

**Section with Grid** - 3-column grid with 2px gaps
```html
<section class="experiences">
    <div class="section-header reveal">
        <p class="section-label">01 — Впечатления</p>
        <h2 class="section-title">Чем заняться</h2>
    </div>
    <div class="experiences-grid">
        <article class="experience-card reveal">...</article>
    </div>
</section>
```

```css
.experiences-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
}

@media (max-width: 768px) {
    .experiences-grid {
        grid-template-columns: 1fr;
    }
}
```

**Stats** - Navy-deep background, orange numbers
```html
<section class="stats">
    <div class="stats-grid reveal">
        <div class="stat-item">
            <div class="stat-number">15+</div>
            <div class="stat-label">лет опыта</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">500+</div>
            <div class="stat-label">довольных гостей</div>
        </div>
        <div class="stat-item">
            <div class="stat-number">12</div>
            <div class="stat-label">апартаментов</div>
        </div>
    </div>
</section>
```

```css
.stats {
    background: var(--color-navy-deep);
    padding: 80px 40px;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 40px;
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;
}

.stat-number {
    font-family: var(--font-display);
    font-size: 64px;
    font-weight: 900;
    color: var(--color-orange);
    line-height: 1;
}

.stat-label {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--color-gray);
    margin-top: 8px;
}
```

**About** - Two-column with image offset border
```html
<section class="about">
    <div class="about-grid">
        <div class="about-image reveal"><img ...></div>
        <div class="about-content reveal">
            <blockquote class="about-quote">Атрани слишком мал, чтобы врать. Здесь всё настоящее.</blockquote>
        </div>
    </div>
</section>
```

**.about-quote** - цитата с левой оранжевой линией:
```css
.about-quote {
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 700;
    line-height: 1.3;
    padding-left: 24px;
    border-left: 4px solid var(--color-orange);
}
```

**Blockquote (общий стиль)** - рамка, НЕ тёмный фон:
```css
blockquote {
    padding: 32px 40px;
    background: transparent;
    border: 2px solid var(--color-navy);
    border-left: 4px solid var(--color-orange);
    position: relative;
}

blockquote::before {
    content: '"';
    position: absolute;
    top: -10px;
    left: 24px;
    font-family: var(--font-display);
    font-size: 80px;
    font-weight: 900;
    color: var(--color-orange);
    opacity: 0.4;
}
```

**Apartments List** - Alternating layout
```html
<section class="apartments">
    <div class="apartments-list">
        <article class="apartment-item reveal">
            <div class="apartment-image"><img ...></div>
            <div class="apartment-content">
                <span class="apartment-number">APT—01</span>
                <h3>Title</h3>
                <p>Description</p>
                <a href="#" class="btn btn-outline">CTA</a>
            </div>
        </article>
    </div>
</section>
```

**CTA** - Orange background with watermark
```html
<section class="cta">
    <div class="cta-content reveal">
        <h2 class="section-title">Готовы?</h2>
        <p>Description</p>
        <a href="..." class="btn btn-white">CTA</a>
    </div>
</section>
```

**Footer** - Navy-deep, 4-column grid
```html
<footer class="footer">
    <div class="footer-grid">
        <div class="footer-brand">...</div>
        <div class="footer-col">...</div>
    </div>
    <div class="footer-bottom">
        <p>&copy; 2014–2026 CristallPont S.R.L.</p>
        <div class="social-links">...</div>
    </div>
</footer>
```

### Buttons

```html
<a class="btn btn-primary">Исследовать</a>
<a class="btn btn-outline">Подробнее</a>
<a class="btn btn-white">Забронировать</a>
<a class="btn btn-primary btn-small">Маленькая</a>
```

```css
.btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 16px 32px;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: all 0.3s var(--ease-out);
}

/* Primary - navy background */
.btn-primary {
    background: var(--color-navy);
    color: white;
}
.btn-primary:hover {
    background: var(--color-orange);
    transform: translate(-4px, -4px);
    box-shadow: 4px 4px 0 var(--color-navy);
}

/* Outline - transparent with border */
.btn-outline {
    background: transparent;
    color: var(--color-navy);
    border: 2px solid var(--color-navy);
}
.btn-outline:hover {
    background: var(--color-navy);
    color: white;
}

/* White - for dark backgrounds */
.btn-white {
    background: white;
    color: var(--color-navy);
}
.btn-white:hover {
    transform: translate(-4px, -4px);
    box-shadow: 4px 4px 0 rgba(255,255,255,0.3);
}

/* Small variant */
.btn-small {
    padding: 10px 20px;
    font-size: 12px;
}
```

### Animations

**Scroll reveal** - Add `.reveal` class, JS observer adds `.visible`
```javascript
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

**Easing**: `cubic-bezier(0.16, 1, 0.3, 1)`

### Accessibility Requirements

- Skip link: `<a href="#main" class="skip-link">Перейти к содержимому</a>`
- `:focus-visible` outline with orange color
- `role="banner"`, `role="navigation"` on header/nav
- `aria-hidden="true"` on decorative elements
- `@media (prefers-reduced-motion: reduce)` support
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`
- `loading="lazy"` on images below fold

### Experience Card

```html
<article class="experience-card reveal">
    <div class="experience-image">
        <img src="experience.jpg" alt="Описание">
    </div>
    <div class="experience-overlay"></div>
    <div class="experience-content">
        <span class="experience-number">01</span>
        <h3 class="experience-title">Лодочные туры</h3>
        <p class="experience-text">Откройте скрытые бухты и гроты</p>
    </div>
</article>
```

```css
.experience-card {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    cursor: pointer;
}

.experience-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: grayscale(100%);
    transition: all 0.5s;
}

.experience-overlay {
    position: absolute;
    inset: 0;
    background: rgba(10, 22, 40, 0.7);
    transition: background 0.5s;
}

.experience-card:hover .experience-image img {
    filter: grayscale(0%);
    transform: scale(1.05);
}

.experience-card:hover .experience-overlay {
    background: rgba(255, 87, 34, 0.9);
}

.experience-content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 32px;
    color: white;
    z-index: 1;
}

.experience-number {
    font-family: var(--font-display);
    font-size: 14px;
    font-weight: 700;
    color: var(--color-orange);
}

.experience-card:hover .experience-number {
    color: white;
}
```

### Forms

```html
<form class="form">
    <div class="form-group">
        <label class="form-label" for="name">Имя</label>
        <input type="text" id="name" class="form-input" placeholder="Ваше имя">
    </div>
    <div class="form-group">
        <label class="form-label" for="email">Email</label>
        <input type="email" id="email" class="form-input" placeholder="email@example.com">
    </div>
    <button type="submit" class="btn btn-primary">Отправить</button>
</form>
```

```css
.form-group {
    margin-bottom: 20px;
}

.form-label {
    display: block;
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--color-navy);
}

.form-input {
    width: 100%;
    padding: 14px 16px;
    font-family: var(--font-body);
    font-size: 16px;
    border: 2px solid var(--color-gray-light);
    background: white;
    transition: all 0.3s;
}

.form-input:focus {
    outline: none;
    border-color: var(--color-navy);
}

.form-input::placeholder {
    color: var(--color-gray);
}
```

### Reference

- Full template: `/Users/greg/Documents/Code/Atraniru/concept-8-navy-brutalist.html`
- Design guidelines: `/Users/greg/Documents/Code/Atraniru/design-guidelines.html`
