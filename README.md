# Companion Booking

Fullstack: **Express 5 + MongoDB (Mongoose)** (backend), **React 19 + Vite** (frontend SPA tại `auth.html`).

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
- Frontend Vite: `http://localhost:5173` — mở `http://localhost:5173/auth.html`

**Tách terminal:**

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

## Smoke test (kiểm tra tay)

### Flow A — Auth, ví, đặt lịch, companion, chat realtime

1. Đăng ký / đăng nhập **CUSTOMER** → `#/wallet-bookings` → **nạp tiền mock**.
2. Có companion **APPROVED** trong DB → nhập Companion ID → **đặt lịch**; kiểm tra ví trừ cọc, đơn **PENDING**.
3. Đăng nhập **COMPANION** → chấp nhận / từ chối đơn; nếu từ chối kiểm tra hoàn cọc và thông báo.
4. Hai phiên: `#/chat?booking=<id>` — tham gia phòng, gửi tin, nhận **chat_message** không reload.

### Flow B — Quên mật khẩu (OTP)

1. `#/forgot-password` → nhập email đã đăng ký.
2. Chưa cấu SMTP: xem **console backend** mã OTP → `#/reset-password` nhập OTP + mật khẩu mới.
3. Đăng nhập lại.

### Flow C — Admin

1. User **ADMIN** trong MongoDB → đăng nhập → `#/admin`.
2. Kiểm tra thống kê và biểu đồ (dữ liệu CHARGE có thể bằng 0 nếu chưa có giao dịch loại đó).

**Lưu ý:** API **Review** (`/api/review`) chưa triển khai — chỉ có model; không nằm trong checklist trên.

## Build frontend (tĩnh + bundle auth)

```bash
npm run build --prefix frontend
```
