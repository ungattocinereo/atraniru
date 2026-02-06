# Atrani.ru — Официальный сайт

Туристический сайт для Атрани на Амальфитанском побережье, Италия. Эно-гастро-туры, фото прогулки, апартаменты.

## 🎨 Дизайн

Navy Brutalist (Concept 8) — темно-синий фон (#000A27) с оранжевыми акцентами (#FF5722).

**Шрифты:** Unbounded (заголовки) + Space Grotesk (текст)

## 🚀 Технологии

- **Astro** — статический генератор сайтов
- **Ghost CMS** — блог-платформа
- **Vanilla CSS** — без фреймворков
- **TypeScript** — типизация

## 📁 Структура проекта

```text
/
├── public/
│   └── images/              # Статические изображения
├── src/
│   ├── components/          # Компоненты страниц
│   │   ├── Hero.astro
│   │   ├── Marquee.astro
│   │   ├── Stats.astro
│   │   ├── Quote.astro
│   │   ├── Experiences.astro
│   │   ├── AboutCoast.astro
│   │   ├── VideoEmbed.astro
│   │   ├── Apartments.astro
│   │   ├── BlogPreview.astro
│   │   └── CTA.astro
│   ├── layouts/
│   │   └── Layout.astro     # Базовый layout
│   ├── lib/
│   │   └── ghost.ts         # Ghost API клиент
│   ├── pages/
│   │   └── index.astro      # Главная страница
│   └── styles/
│       └── global.css       # Глобальные стили
├── docs/
│   └── plans/               # Документация дизайна
└── pages/                   # Контент (не в src)
```

## 🛠 Команды

Все команды выполняются из корня проекта:

| Команда                   | Описание                                         |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Установить зависимости                           |
| `npm run dev`             | Запустить dev сервер на `localhost:4321`         |
| `npm run build`           | Собрать production сайт в `./dist/`              |
| `npm run preview`         | Предпросмотр production сборки                   |

## ⚙️ Настройка

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить Ghost CMS (опционально)

Создайте `.env` файл в корне проекта:

```env
GHOST_URL=https://your-ghost-site.com
CONTENT_API_KEY=your_content_api_key
```

Если Ghost не настроен, блог будет показывать placeholder посты.

### 3. Запустить dev сервер

```bash
npm run dev
```

Сайт будет доступен на `http://localhost:4321`

## 📝 Контент

- **Изображения:** добавляйте в `public/images/`
- **Блог:** управляется через Ghost CMS
- **Страницы:** создавайте `.astro` файлы в `src/pages/`

## 🎯 TODO

- [ ] Добавить placeholder изображения для экскурсий
- [ ] Добавить реальный YouTube ID для "Орел и Решка"
- [ ] Настроить Ghost CMS
- [ ] Добавить страницу контактов
- [ ] Добавить страницу "О нас"
- [ ] Добавить индивидуальные страницы апартаментов
- [ ] Настроить SEO мета-теги
- [ ] Добавить Yandex.Metrica / Google Analytics

## 📄 Лицензия

© 2014–2026 CristallPont S.R.L. Все права защищены.
