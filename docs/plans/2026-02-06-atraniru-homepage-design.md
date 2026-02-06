# Дизайн главной страницы atrani.ru

**Дата:** 2026-02-06
**Статус:** Утверждено
**Дизайн-система:** Navy Brutalist (Concept 8)

## Обзор

Главная страница для atrani.ru — туристического сайта про Амальфитанское побережье, город Атрани, с фокусом на эно-гастро туры, фото-прогулки и аутентичный опыт Италии.

## Технологический стек

- **Framework:** Astro (SSG)
- **CMS:** Ghost (блог)
- **Styling:** Vanilla CSS (Navy Brutalist design system)
- **Animations:** Intersection Observer API
- **Deployment:** Vercel/Netlify (TBD)

## Структура страницы

1. **Hero** - Полноэкранная секция с заголовком "АМАЛЬ-ФИГЕТЬ!"
2. **Marquee** - Бегущая строка "АТРАНИ • АМАЛЬФИ • ПОЗИТАНО • РАВЕЛЛО"
3. **Статистика** - 15+ лет, 500+ гостей, 12+ апартаментов
4. **Цитата** - От Графа Монтегриши (комбинированная)
5. **Экскурсии** - Grid 3 карточки (Фото прогулки, Лодочные туры, Эно-гастро туры)
6. **О побережье + Dolce far niente** - Объединенная информационная секция
7. **Орел и Решка** - YouTube embed
8. **Апартаменты** - 6 карточек с alternating layout
9. **Блог** - 4 последних статьи из Ghost
10. **CTA** - "Готовы открыть настоящую Италию?"
11. **Footer** - Навигация, контакты, copyright

## Дизайн-система

### Цвета
```css
--color-navy-deep: #000A27;    /* Hero, footer, stats */
--color-navy: #0A1628;         /* Buttons, overlays */
--color-orange: #FF5722;       /* Accent color */
--color-gray: #8B9BB4;         /* Secondary text */
--color-white: #FFFFFF;
```

### Типографика
- **Display:** Unbounded (заголовки, логотип, цифры)
- **Body:** Space Grotesk (текст, UI)

## Компоненты

### Hero
- Полноэкранная секция (min-height: 100vh)
- Фон: #000A27
- Заголовок с переносом: "АМАЛЬ-" (оранжевый) + "ФИГЕТЬ!"
- Subtitle: "Амальфитанское побережье. Город Атрани. Эно-Гастро-туры. Фото прогулки."
- Изображение справа: `atrani-with-3-bikes-no-plates.webp` с clip-path
- Кнопки: "Исследовать" (белая), "Апартаменты" (outline)
- Scroll indicator внизу

### Marquee
- Оранжевый фон (#FF5722)
- Бесконечная анимация
- Текст: "АТРАНИ • АМАЛЬФИ • ПОЗИТАНО • РАВЕЛЛО"

### Stats
- Темно-синий фон (#000A27)
- 3 колонки с оранжевыми числами
- Unbounded шрифт для цифр (64px, weight 900)

### Quote (Цитата)
- Двухколоночный layout
- Слева: фото основателя (placeholder)
- Справа: комбинированная цитата
- Blockquote с оранжевой левой линией (4px)
- Текст: "15 лет назад я переехал из солнечного Сочи... Атрани слишком мал, чтобы врать — здесь всё настоящее."
- Подпись: "— Граф Монтегриша, основатель проекта"

### Experiences Grid
- Заголовок: "01 — Впечатления / Чем заняться"
- Grid 3 колонки (1 на мобильных)
- Карточки квадратные (aspect-ratio: 1)
- Hover: grayscale → color + оранжевый overlay
- 3 экскурсии:
  1. Фото прогулки - "Запечатлейте красоту Атрани"
  2. Лодочные туры - "Откройте скрытые бухты и гроты"
  3. Эно-гастро туры - "Вкусы Амальфитанского побережья"

### About Coast (О побережье + Dolce far niente)
- Двухколоночный layout
- Левая колонка: текст про 18 городов, ЮНЕСКО, "в 300 метрах от Амальфи"
- Правая колонка: философия "dolce far niente"
- Заголовок: "02 — О побережье / Жемчужина Италии"

### Video Section (Орел и Решка)
- Заголовок: "03 — Медиа / Орел и Решка в Амальфи"
- Описание: "Как мы помогали проводить съемки программы «Орел и Решка» Морской Сезон"
- YouTube embed (16:9 aspect ratio)

### Apartments
- Заголовок: "04 — Проживание / Наши апартаменты"
- 6 апартаментов с alternating layout
- Изображение чередуется слева/справа
- Номера: APT—01 до APT—06
- Кнопка "Подробнее" (outline)
- Изображения:
  - orange-cozy-room-with-a-balcony.jpg
  - vintage-interior-room-with-a-balcony.jpg
  - 4444_DSC0806_DxO.jpg
  - 555_DSC0806_DxO.jpg
  - DSC0053.jpg
  - placeholder для 6-го

### Blog
- Заголовок: "05 — Блог / Истории и советы"
- Ghost CMS интеграция
- 4 последних статьи
- Grid 2×2 (1 колонка на мобильных)
- Карточки: feature_image, title, excerpt, date
- Кнопка "Все статьи" внизу

### CTA
- Оранжевый фон (#FF5722)
- Заголовок: "Готовы открыть настоящую Италию?"
- Текст: "Свяжитесь с нами и начните своё путешествие уже сегодня"
- Кнопки: "Написать нам" (белая), "Позвонить" (outline белый)
- Фоновый watermark "ATRANI"

### Footer
- Темно-синий фон (#000A27)
- 4 колонки:
  1. Бренд + описание
  2. Навигация
  3. Услуги
  4. Контакты
- Footer bottom: copyright "© 2014–2026 CristallPont S.R.L." + social links

## Анимации

- **Scroll reveal:** `.reveal` класс с Intersection Observer
- **Fade in + slide up:** при появлении в viewport
- **Easing:** cubic-bezier(0.16, 1, 0.3, 1)
- **Hero animation delays:** label (0.2s), h1 (0.3s), subtitle (0.4s), actions (0.5s), image (0.6s)
- **Marquee:** infinite scroll animation

## Accessibility

- Skip link в начале: "Перейти к содержимому"
- Semantic HTML: `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`
- `role="banner"`, `role="navigation"` на header/nav
- `aria-hidden="true"` на декоративных элементах
- `:focus-visible` outline с оранжевым цветом
- `@media (prefers-reduced-motion: reduce)` поддержка
- `loading="lazy"` на изображениях ниже fold
- Alt текст на всех изображениях

## Ghost CMS интеграция

**Установка:**
```bash
npm install @tryghost/content-api
npm install --save-dev @types/tryghost__content-api
```

**Конфигурация (.env):**
```
CONTENT_API_KEY=your_ghost_api_key
```

**Ghost клиент (src/lib/ghost.ts):**
```typescript
import GhostContentAPI from '@tryghost/content-api';

export const ghostClient = new GhostContentAPI({
    url: 'https://your-ghost-site.com',
    key: import.meta.env.CONTENT_API_KEY,
    version: 'v5.0',
});
```

**Использование на главной:**
```typescript
const posts = await ghostClient.posts.browse({
    limit: 4,
    include: 'tags,authors'
});
```

## Изображения

### Существующие:
- `pages/index/atrani-with-3-bikes-no-plates.webp` - Hero image
- `pages/apartments/*.jpg` - 5 фото апартаментов
- `pages/about/*.jpg` - фото для цитаты основателя

### Placeholders (добавить позже):
- Фото прогулки (experience-1)
- Лодочные туры (experience-2)
- Эно-гастро туры (experience-3)
- Апартамент 6
- Фото основателя (quote section)

## Git

- **Репозиторий:** git@github.com:ungattocinereo/atraniru.git
- **.gitignore:** добавить `kimi/`, `node_modules/`, `.env`, `dist/`

## Responsive Breakpoints

- **Desktop:** > 1024px
- **Tablet:** 768px - 1024px
- **Mobile:** < 768px

### Адаптация:
- Hero image скрывается на ≤1024px
- Grids переходят в 1 колонку на мобильных
- Padding уменьшается: 80px → 60px → 40px
- Font sizes используют `clamp()` для плавного масштабирования

## Следующие шаги

1. ✅ Инициализировать Git репозиторий
2. ✅ Создать Astro проект
3. ✅ Настроить .gitignore (добавить kimi/)
4. ✅ Скопировать изображения в public/images/
5. ✅ Создать компоненты
6. ✅ Настроить Ghost интеграцию
7. ✅ Реализовать главную страницу
8. ✅ Добавить анимации
9. ✅ Тестирование responsive design
10. ✅ Deploy
