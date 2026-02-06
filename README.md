# АМАЛЬФИГЕТЬ — Atrani.ru

Сайт про Атрани и Амальфитанское побережье. Экскурсии, апартаменты, блог, гастро-туры и настоящая Италия без туристических клише.

**Продакшн:** [atrani.ru](https://atrani.ru)

## Стек

- [Astro](https://astro.build) — SSG
- [Ghost CMS](https://ghost.org) — блог
- Vanilla CSS, TypeScript
- Шрифты: Unbounded + Space Grotesk

## Дизайн-система

**Navy Brutalist** — темный navy (`#000A27`) с оранжевыми акцентами (`#FF5722`).

## Быстрый старт

```bash
npm install
npm run dev        # localhost:4321
```

## Команды

| Команда           | Что делает                      |
| :---------------- | :------------------------------ |
| `npm run dev`     | Dev-сервер на `localhost:4321`  |
| `npm run build`   | Production-сборка в `./dist/`  |
| `npm run preview` | Предпросмотр сборки            |

## Структура

```
src/
├── components/     # Hero, Experiences, Apartments, Blog...
├── layouts/        # Layout.astro (OG, Twitter Cards, SEO)
├── lib/            # Ghost API клиент
├── pages/          # Роуты
└── styles/         # global.css
public/
└── images/         # Фото, OG-картинки, фавиконы
```

## Ghost CMS

Опционально. Для блога создайте `.env`:

```env
GHOST_URL=https://your-ghost-site.com
CONTENT_API_KEY=your_content_api_key
```

Без Ghost блог показывает placeholder-посты.

## Лицензия

(c) 2014-2026 CristallPont S.R.L. Все права защищены.
