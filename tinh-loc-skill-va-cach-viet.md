# Tinh lọc skill & cách viết (từ thamkhaoSkill.md + tham khảo.md)

Tài liệu rút gọn **kỹ năng**, **mẫu kiến trúc**, **nghiệp vụ**, và **chỗ gắn code** từ hai file tham khảo, **đã ánh xạ** sang **companion-booking** (fullstack: backend Node + frontend Vite/HTML/JS; có thể mở rộng SPA sau). Hai nguồn khác nhau chủ yếu ở **stack frontend** (React vs Angular) và độ chi tiết (một bên mô tả rộng tính năng, một bên đi sâu **pattern code** + **curl/API**).

---

## 0. Nghiệp vụ & pattern (đã ánh xạ vào companion-booking)

### 0.1. Vai trò & quyền (RBAC)

Theo `nghiepvu3role.txt`, ba nhóm nghiệp vụ chính: **User (người thuê)**, **Companion**, **Admin**. Các tài liệu tham khảo dùng thêm role trung gian (kiểu “nhân viên soát” / “kiểm soát”) — khi triển khai có thể gom vào **Companion** + tự động hóa, hoặc tách role **moderator** nếu cần.

| Role (gợi ý triển khai) | Nghiệp vụ cốt lõi trong companion-booking |
|-------------------------|-------------------------------------------|
| **user** | Tài khoản, ví, tìm kiếm, đặt lịch, chat, check-in/out, đánh giá, khiếu nại. |
| **companion** | Hồ sơ, lịch, nhận/từ chối đơn, thực hiện dịch vụ, tài chính (hold, rút tiền). |
| **admin** | Kiểm duyệt, giao dịch & hoa hồng, tranh chấp, quản lý người dùng, báo cáo. |

**Code nghiệp vụ bắt buộc:** middleware `auth` + `role` trên route; UI chỉ ẩn menu — **server** quyết định 401/403.

### 0.2. Luồng kỹ thuật chung (use case → API — pattern)

1. **Đăng ký / đăng nhập** → lưu `accessToken`, `refreshToken`, `user` (có `role`).
2. **Dashboard / shell** → `GET /api/users/me` (hoặc tương đương): tên, role, menu theo quyền.
3. **Thao tác có kiểm tra điều kiện** (pattern từ bài “soát tại điểm”): resource có định danh (path) + ngữ cảnh (body) → trả trạng thái rõ ràng (ví dụ cho phép / từ chối / hết hạn). **Áp dụng:** xác nhận bước trong đơn (check-in, bắt đầu phiên), khớp điều kiện ví/thời gian — đặt route theo domain booking (`/api/bookings/...`, `/api/sessions/...`), không dùng tên miền ví dụ khác trong code.
4. **Kiểm tra / ghi nhận có lý do** (pattern “kiểm tra thủ công”): `POST` kèm `reason` hoặc payload nghiệp vụ tương đương — **Áp dụng:** báo cáo, ghi nhận tranh chấp, ghi chú moderation.
5. **Admin — người dùng** — `GET /api/users` (phân trang, lọc `role`), `PATCH /api/users/:id/role`.

### 0.3. Auth (endpoint pattern)

| Hành động | Endpoint (mẫu) | Ghi chú code |
|-----------|----------------|--------------|
| Đăng ký | `POST /api/auth/register` | Body: name, email, password. |
| Đăng nhập | `POST /api/auth/login` | Trả access + refresh + user. |
| Refresh | `POST /api/auth/refresh-token` | Body: `refreshToken` — interceptor khi 401. |
| Đăng xuất | `POST /api/auth/logout` | Có thể gửi `refreshToken` để revoke (tuỳ backend). |

### 0.4. Realtime

- **Socket** (hoặc STOMP trong repo hiện tại): kết nối sau login, ngắt khi logout, reconnect.  
- Sự kiện theo domain: đơn mới, tin nhắn, thông báo, trạng thái ví — cấu hình tại `socket` / `realtime` backend và một service frontend dùng chung.

### 0.5. Chỗ gắn code nghiệp vụ trong kiến trúc

| Tầng | Trách nhiệm |
|------|-------------|
| **Validator** | Định dạng input theo từng module (`auth`, `booking`, `user`…). |
| **Controller** | Nhận request, gọi service, trả HTTP chuẩn. |
| **Service** | Quy tắc nghiệp vụ (đủ tiền, đúng trạng thái đơn, trong khung giờ…) — **core domain**. |
| **Middleware** | JWT, đúng role mới vào route. |
| **Frontend service** | Một file/domain: ví dụ `booking.service.ts` / `booking.js` — các hàm `getX`, `postY` map một-một với API; không rải URL khắp component. |

### 0.6. Gợi ý từ pattern role trong tài liệu tham khảo → companion-booking

| Pattern trong tài liệu (ý tưởng) | companion-booking |
|----------------------------------|-------------------|
| Người dùng cuối + ví + lịch sử | **User**: ví, nạp/rút logic nạp, lịch sử giao dịch, đặt lịch. |
| Thao tác “tại điểm” / xác nhận điều kiện | Worker hoặc bước **check-in/out**, chuyển trạng thái đơn — API rõ ràng, idempotent nếu cần. |
| Vai trò kiểm tra + biên bản / log | **Moderation / dispute**: báo cáo, đóng băng cọc, truy vết — role `admin` hoặc tách role xử lý nếu sau này mở rộng. |
| Quản trị user + báo cáo | **Admin**: CRUD/lock user, cấu hình, dashboard — cùng mẫu **guard + PATCH role + audit**. |

---

## 1. Nguyên tắc chung (hai nguồn)

| Nguyên tắc | Nội dung rút gọn |
|------------|------------------|
| **Phân tầng** | UI ↔ service HTTP ↔ context/hooks hoặc module JS ↔ `routes/controllers/services/middlewares`. |
| **Auth** | JWT access + refresh; **tự refresh** khi 401 rồi retry (pattern `api.service`). |
| **RBAC** | Guard route + menu theo role; backend **enforce**. |
| **Realtime** | Socket/STOMP: lifecycle đồng bộ login/logout. |
| **UI/UX** | Loading, empty state, lỗi rõ ràng, responsive; optional dark mode. |

---

## 2. Skill từ tài liệu React (Vite + Tailwind) — tinh thần áp dụng

### 2.1. Cấu trúc frontend (chuẩn production)

```
src/
├── components/
├── pages/
├── services/       # api instance, auth.service, domain.service, socket.service
├── contexts/
├── hooks/
```

**Trong repo hiện tại:** nhóm `public/js/*.js` theo chức năng (auth, companion, admin, realtime) + **một module API chung** (fetch/axios + refresh).

### 2.2. Checklist nghiệp vụ (tham chiếu)

- Auth: login/register, protected route, logout.  
- Dashboard: user + mô tả role + quick actions.  
- Theo role: thao tác đặc thù user / companion / admin; realtime thông báo.

### 2.3. Service layer

- Một instance HTTP gắn base URL, `Authorization`, interceptor 401 → refresh → retry.  
- Tách **auth.service** và **domain.service** (booking, user, ví…) — mỗi file một nhóm endpoint.

### 2.4. Tài liệu hóa

- README: môi trường, `cp .env.example`, chạy backend + frontend (`concurrently` nếu có).  
- Bảng API + tài khoản demo theo role.

---

## 3. Skill từ tài liệu Angular (modern) — tư duy dùng mọi stack

### 3.1. Component độc lập

- Import phụ thuộc cục bộ; **bài học:** mỗi màn HTML/JS tự rõ dependency, tránh file monolith.

### 3.2. State kiểu signal (tương đương)

- Trong JS thuần: state object + hàm cập nhật/render; hoặc framework sau này.

### 3.3. Control flow & list

- Render list theo **id ổn định** (track key), không phụ thuộc index khi danh sách thay đổi.

### 3.4. Routing & guard

- Lazy load chunk theo route (nếu SPA); **authGuard** / **guestGuard**; layout lồng nhau.  
- **HTML tĩnh:** kiểm tra token/role đầu trang user/companion/admin; menu theo role.

### 3.5. DI / singleton

- Một `apiClient` / `authService` export dùng chung — tránh lặp token logic.

### 3.6. AuthService + ApiService

- Login lưu token + user; logout clear + redirect; `isLoggedIn`; `hasRole(...)`.  
- Api: 401 → refresh → retry; refresh fail → login lại.

### 3.7. Role-based UI

- Class theo role; ẩn menu — server vẫn kiểm tra.

### 3.8. Inline vs tách template/style

- Gom một file khi nhỏ; tách khi lớn hoặc teamwork.

---

## 4. Backend (cấu trúc gợi ý)

- Middleware: `auth`, `role`, `rateLimit`, `idempotency`, `validate`, `error`.  
- `realtime/` (socket), `workers/` (báo cáo/tác vụ nặng).  
- Validators tách khỏi controller (theo module nghiệp vụ).

---

## 5. Checklist & lỗi thường gặp

| Vấn đề | Cách xử lý |
|--------|------------|
| Thiếu HTTP client / provider | Bootstrap có wrapper dùng chung. |
| State không cập nhật UI | View phải đọc state qua hàm/getter khi render. |
| Token undefined | Chờ login xong rồi mới gọi API có auth. |
| User null | Optional chaining hoặc nhánh `@if` / kiểm tra trước DOM. |

---

## 6. Cách viết skill / rule cho Cursor

1. Mục tiêu & phạm vi.  
2. Cấu trúc thư mục.  
3. Quy ước route, role, tên service.  
4. Luồng auth (401 → refresh → retry).  
5. Checklist kiểm thử.  
6. Endpoint & `.env.example`.

---

## 7. Chỗ gắn trong repo companion-booking

| Pattern | Vị trí / hướng xử lý |
|---------|----------------------|
| API + refresh token | `public/js/auth-logic.js` hoặc module API chung. |
| “Protected route” | Kiểm tra token/role trước khi render / redirect trang. |
| Realtime | `public/js/realtime-stomp.js` — đồng bộ với login/logout. |
| RBAC menu | Sidebar chỉ link đúng role. |
| Tài liệu API | README hoặc `docs/`. |

---

*Nguồn tinh lọc: `thamkhaoSkill.md`, `tham khảo.md`; nghiệp vụ ba vai trong `nghiepvu3role.txt`. Chỉnh sửa file này khi quy ước dự án thay đổi.*
