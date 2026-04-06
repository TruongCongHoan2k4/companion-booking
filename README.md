# Companion Booking

Fullstack: **Express 5 + MongoDB (Mongoose)** (backend), **HTML + JS tĩnh** (frontend dưới `frontend/pages/`, asset `frontend/public/`), **Vite** chỉ làm dev server (proxy API) và **preview** sau khi build tĩnh.

## Chuẩn bị

1. **MongoDB** — nên bật **replica set** (ví dụ `?replicaSet=rs0`) vì nạp ví / đặt lịch dùng transaction.
2. Sao chép biến môi trường:
   - `backend/.env.example` → `backend/.env`
   - `frontend/.env.example` → `frontend/.env`
3. Cài dependency:

```bash
npm install --prefix backend
npm install --prefix frontend
npm install
```

## Chạy dev

**Một lệnh (backend + frontend):**

```bash
npm run dev:all
```

- Backend: `http://localhost:3000` (hoặc `PORT` trong `backend/.env`)
- Frontend (Vite): `http://localhost:5173` — ví dụ portal `http://localhost:5173/index.html`, đăng nhập `http://localhost:5173/pages/user/login.html`

**Tách terminal:**

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

## Smoke test (kiểm tra tay)

### Flow A — Auth, ví, đặt lịch, companion, chat realtime

1. Đăng ký / đăng nhập **CUSTOMER** → `pages/user/wallet.html` → **nạp tiền mock**.
2. Có companion **APPROVED** trong DB → nhập Companion ID → **đặt lịch**; kiểm tra ví trừ cọc, đơn **PENDING**.
3. Đăng nhập **COMPANION** → chấp nhận / từ chối đơn; nếu từ chối kiểm tra hoàn cọc và thông báo.
4. Hai phiên: chat theo booking (ví dụ `pages/user/chat.html` / `pages/companion/chat.html` với tham số phù hợp) — tham gia phòng, gửi tin, nhận tin realtime.

### Flow B — Quên mật khẩu (OTP)

Flow OTP có thể triển khai thêm trên trang tĩnh; hiện tài liệu smoke cũ tham chiếu SPA đã gỡ.

### Flow C — Admin

1. User **ADMIN** trong MongoDB → đăng nhập → `pages/admin/dashboard.html`.
2. Kiểm tra thống kê và biểu đồ (dữ liệu CHARGE có thể bằng 0 nếu chưa có giao dịch loại đó).

**Lưu ý:** API **Review** (`/api/review`) chưa triển khai — chỉ có model; không nằm trong checklist trên.

## Build frontend (chỉ site tĩnh)

```bash
npm run build --prefix frontend
```

Kết quả: thư mục `frontend/dist/` (portal `index.html`, `pages/`, `public/`, `policy.html`). Xem trước: `npm run preview --prefix frontend` (cần chạy `build` trước).
