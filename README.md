POS Electron app
=================

Desktop POS tizimi: Electron + React + SQLite. Ushbu dastur komp’yuterda ishlashga mo‘ljallangan va quyidagi asosiy funksiyalarni qo‘llab-quvvatlaydi:

- Savdo bo‘limi: mahsulotlar, kategoriya bo‘yicha filtr, qidiruv, savatga qo‘shish
- Buyurtma paneli: jami summa, to‘lov usuli, xaridor ismi va telefon, chek chop etish
- Tovarlar bo‘limi: yangi mahsulot qo‘shish, kod, narx, miqdor, papka
- Papkalar bo‘limi: yangi papka yaratish, emoji va rang tanlash
- Mijozlar bazasi: xaridorlar, telefon, xaridlar tarixi
- Qarzlar bo‘limi: qarzdorlar ro‘yxati va to‘lovni yopish
- Hisobotlar: bugungi savdo, umumiy daromad, qarzlar, Excel eksport

Ishga tushirish:

> Endi brauzerda ham ishlashi mumkin. Vite dev server orqali oching yoki statik `dist` fayllarini xost qiling.

```bash
cd "c:\Users\Hp\Desktop\darslar all\claude ai\first try\pos-electron"
npm install
npm run dev:renderer
```

Yoki Electron bilan ham ishlatishingiz mumkin:

```bash
npm run dev
npm start
```

Agar brauzerda faqat papka strukturasini ko‘rsangiz, bu noto‘g‘ri yo‘l: `index.html` faylini yoki katalogni bevosita ochmang.

Fayllar:
- `main.js` — Electron asosiy jarayoni
- `preload.js` — renderer <-> main IPC ko‘prigi
- `db.js` — SQLite ma’lumotlar bazasi va POS logikasi
- `src/App.jsx` — React UI
- `src/styles.css` — ilova dizayni
- `vite.config.js` — Vite konfiguratsiyasi

Muhim:
- `data.db` fayli dastur ishlaganda avtomatik yaratiladi.
- `better-sqlite3` paketini qurishda Windows uchun Visual Studio Build Tools kerak bo‘lishi mumkin.

Agar xohlasangiz, keyingi bosqichda termal printer integratsiyasi, chek PDF faylga saqlash va terminal installerini qo‘shaman.

