# So sánh nghiệp vụ (`nghiepvu3role.txt`) với mã nguồn dự án Companion Booking

**Ngày đối chiếu:** 5/4/2026  
**Phạm vi:** Toàn bộ repo `companion-booking` (thư mục `backend/`, `frontend/`, mô hình MongoDB trong `backend/src/models/`).

---

## 1. Tóm tắt hiện trạng kỹ thuật

### 1.1. Backend Node (Express + MongoDB)

- **Đã triển khai API thực tế:** chỉ có hai endpoint gắn với router:
  - `GET /api/users` — liệt kê user
  - `POST /api/users` — tạo user  
  (Khai báo trong `backend/src/app.js`, `backend/src/routes/user.route.js`.)

- **Chưa có:** middleware xác thực (JWT/session), phân quyền theo role, upload file, tích hợp cổng thanh toán, WebSocket/STOMP server khớp với frontend, và toàn bộ các route mà giao diện đang gọi (xem mục 5).

- **Mô hình dữ liệu (Mongoose):** đã có schema cho `User`, `Companion`, `Booking`, `Review`, `Report`, `Favorite`, `ChatMessage`, `Notification`, `WalletTransaction`, `Withdrawal`, `ServicePrice`, `CompanionAvailability`, `Consultation`, `Category`, `Transaction` — nhưng **không có controller/service/route** sử dụng các model này trong backend hiện tại.

- **Realtime:** file `backend/src/realtime/realtimeBroadcastService.js` dùng Socket.IO nhưng **không được gọi** từ `backend/server.js` (HTTP server không bọc Socket.IO). Frontend lại dùng **STOMP qua SockJS tại `/ws`** (`frontend/public/js/realtime-stomp.js`), không khớp với Socket.IO.

### 1.2. Frontend (HTML/JS + Vite)

- Có đầy đủ trang cho **User**, **Companion**, **Admin** (đặt lịch, ví, chat, báo cáo, moderation, tranh chấp, v.v.).
- Các file `user.js`, `companion.js`, `admin.js`, `companion-register.js` gọi REST API dạng `/api/auth/me`, `/api/bookings`, `/api/wallet/me`, `/api/admin/...`, v.v. — **các endpoint này không tồn tại trên backend Node hiện có.**
- Khi chạy Vite, proxy `/api` trỏ tới origin trong `VITE_API_URL` (mặc định `http://localhost:3000`). Với backend hiện tại, hầu hết thao tác nghiệp vụ sẽ **404 hoặc không hoạt động đúng** (trừ thử nghiệm thủ công `POST/GET /api/users`).

### 1.3. Kết luận chung

Dự án đang ở trạng thái **UI + schema DB tương đối đầy đủ**, **logic nghiệp vụ và API backend gần như chưa nối**. Phần dưới liệt kê **thiếu so với từng dòng nghiệp vụ** trong `nghiepvu3role.txt`, kèm ghi chú phần nào chỉ mới có “vỏ” giao diện hoặc chỉ có model.

---

## 2. USER (Người thuê) — chức năng còn thiếu / chưa hoàn chỉnh

| Nghiệp vụ (theo `nghiepvu3role.txt`) | Hiện trạng trong dự án | Chi tiết thiếu |
|--------------------------------------|-------------------------|----------------|
| Đăng ký/Đăng nhập (SĐT, Google, Apple ID) | Form đăng nhập/đăng ký **username + mật khẩu**; gọi `/api/user/login`, `/api/user/register`, `/api/auth/me` | **Thiếu toàn bộ backend** auth; **không có** đăng nhập SĐT/OTP, OAuth Google/Apple; **không có** session/JWT chuẩn hóa gắn với user thật |
| Nạp tiền ví (MoMo, VNPay, chuyển khoản) | Trang ví có chọn kênh và form số tiền; gọi `/api/wallet/deposit` | **Thiếu** API nạp, **tích hợp cổng** MoMo/VNPay, **webhook** xác nhận, xử lý giao dịch treo/lỗi; model `WalletTransaction` chưa được dùng |
| Lịch sử giao dịch (nạp, hold cọc, hoàn tiền) | UI gọi `/api/wallet/transactions` | **Thiếu** API và logic ghi nhận từng loại giao dịch; đồng bộ với trạng thái booking/hold |
| Lọc Companion: dịch vụ, khu vực, giá, giới tính, rank game, Online | Trang tìm kiếm + JS gọi `/api/companions/search` | **Thiếu** backend search/filter; đồng bộ `onlineStatus` và các trường lọc với DB |
| Xem profile: ảnh, video, đánh giá, tỷ lệ phản hồi | UI + `/api/companions/:id` | **Thiếu** API aggregate rating, review list, response rate; có thể cần endpoint riêng hoặc populate từ `Review` |
| Gửi booking request (thời gian, địa điểm, ghi chú) | UI + `POST /api/bookings` | **Thiếu** toàn bộ luồng booking phía server (validate, conflict lịch, giá) |
| Chat / Call VoIP nội bộ | UI chat + `/api/chat/.../messages`, `/api/chat/.../call` + STOMP | **Thiếu** REST lưu tin nhắn; **thiếu** server STOMP `/ws` như frontend; **thiếu** tích hợp WebRTC/signaling thật cho gọi |
| Thông báo khi Companion chấp nhận đơn | UI notifications + `/api/user/notifications/me` | **Thiếu** tạo notification khi đổi trạng thái booking; **thiếu** push realtime hoạt động end-to-end |
| Tự động hold tiền cọc khi đơn xác nhận | Model `Booking.holdAmount`, `WalletTransaction` type `HOLD` | **Thiếu** giao dịch atomic (trừ ví / hold escrow), quy tắc số tiền, rollback khi hủy |
| Check-in / Check-out (User) | UI gọi `/api/bookings/me/:id/check-in`, `check-out` + GPS | **Thiếu** API; validate trạng thái, lưu tọa độ, đồng hồ server |
| Gia hạn giờ (đủ tiền trong ví) | UI extension + các endpoint extension | **Thiếu** model/field gia hạn rõ ràng trên `Booking` (nếu cần), API companion accept/reject, hold thêm tiền |
| Đánh giá sao + nhận xét sau hoàn thành | UI + `POST /api/reviews` | **Thiếu** API; schema `Review` hiện chỉ gắn `booking` — cần ràng buộc chỉ User đánh giá Companion sau `COMPLETED`, chống trùng |
| Report / SOS | UI + `POST /api/reports`, GPS | **Thiếu** API; luồng admin xử lý; liên kết freeze escrow (xem Admin) |
| Hủy đơn + chính sách hoàn tiền | Có thao tác hủy trên UI (PATCH booking) | **Thiếu** quy tắc phí hủy theo thời điểm, hoàn tiền/hold, cập nhật ví |

---

## 3. COMPANION — chức năng còn thiếu / chưa hoàn chỉnh

| Nghiệp vụ | Hiện trạng | Chi tiết thiếu |
|-----------|------------|----------------|
| eKYC: CCCD + ảnh chân dung | Form/profile Companion gửi `/api/companions/me/identity` | **Thiếu** API upload an toàn, lưu trữ, trạng thái duyệt gắn admin; so khớp ảnh–CCCD là **quy trình thủ công hoặc ML** (chưa có) |
| Album ảnh/video (chờ admin duyệt) | Có trường `introMediaUrls` (chuỗi) trên `Companion` | **Thiếu** entity “media item” + trạng thái `PENDING/APPROVED`; API upload và hàng đợi moderation |
| Kỹ năng, dịch vụ, bảng giá (giờ/gói) | UI finance + `/api/companions/me/service-prices` | **Thiếu** CRUD backend cho `ServicePrice`; đồng bộ giá khi tạo booking |
| Bật/tắt Online | UI + `PATCH .../online` | **Thiếu** API cập nhật `onlineStatus` |
| Lịch trống (Calendar) | Model `CompanionAvailability` | **Thiếu** API quản lý slot; hiển thị cho User khi đặt; chống double-booking |
| Thông báo đơn mới | UI + `/api/companion/notifications/me` | **Thiếu** tạo notification + realtime |
| Accept/Decline trong giới hạn thời gian (vd 10 phút) | UI workflow + PATCH booking | **Thiếu** API; **thiếu** timer hết hạn tự `REJECTED`/hủy + thông báo |
| Danh sách đơn theo giai đoạn | UI + `/api/companions/me/bookings`, `workflow` | **Thiếu** backend filter theo trạng thái và consultation nếu có |
| Check-in / Check-out (Companion) | UI + `.../checkin`, `checkout` | **Thiếu** API; đồng bộ với phía User |
| Rate User sau dịch vụ | Trường trên `Booking`: `companionRatingForUser`, `companionReviewForUser` | **Thiếu** API và UI validation; không lưu riêng “reputation” User cho companion khác xem (có thể cần bảng tổng hợp) |
| Thu nhập, khả dụng, tiền đang hold | UI + `/api/companions/me/income-stats` | **Thiếu** tính toán từ booking + ví companion + hoa hồng; quy ước accounting |
| Rút tiền về ngân hàng | UI + withdrawals + bank account APIs | **Thiếu** API; liên kết `Withdrawal` và duyệt admin |
| SOS phía Companion | `POST .../sos` | **Thiếu** API và escalation admin |

---

## 4. ADMIN — chức năng còn thiếu / chưa hoàn chỉnh

| Nghiệp vụ | Hiện trạng | Chi tiết thiếu |
|-----------|------------|----------------|
| Duyệt hồ sơ Companion, cấp Verified | UI moderation + `approve-companion` / `reject`, `pending-companions` | **Thiếu** toàn bộ API; cờ “verified” rõ ràng (có thể mở rộng schema ngoài `status`) |
| Duyệt ảnh/video mới | UI moderation (nếu có tab) | **Thiếu** luồng media pending + API |
| Duyệt/ẩn Review | UI + `/api/admin/moderation/reviews` | **Thiếu** API; trường `hidden` trên `Review` nếu cần |
| Tỷ lệ hoa hồng | UI + `commission-rate` | **Không có model/settings** trong backend; **thiếu** API lưu và áp dụng khi thanh toán |
| Duyệt rút tiền | UI + approve/reject withdrawal | **Thiếu** API; chuyển trạng thái `Withdrawal`, trừ số dư companion |
| Xử lý nạp tiền lỗi | UI transactions | **Thiếu** case management, hoàn tác, ghi log |
| Report/SOS, freeze escrow | UI disputes + actions | **Không có model Dispute** trong repo; **thiếu** freeze tiền theo booking, liên kết report |
| Truy xuất chat + check-in/out làm bằng chứng | UI tracking | **Thiếu** API read-only cho admin; export/audit |
| Quyết định Refund / Payout | UI disputes | **Thiếu** chuyển tiền ví, cập nhật booking, đóng case |
| Ban / Warn User & Companion | UI + `/api/admin/users/...` | **Thiếu** API; đã có `moderationFlag`, `locked` trên `User` nhưng chưa dùng |
| Hỗ trợ reset mật khẩu, đổi SĐT nhạy cảm | Không thấy trang chuyên biệt | **Thiếu** quy trình bảo mật (OTP, log admin) |
| Analytics: lợi nhuận nền tảng, giao dịch, đơn hủy, từ khóa tìm kiếm | Dashboard + Chart.js + `dashboard-stats` | **Thiếu** API thống kê; **không có** thu thập/search query log cho “từ khóa phổ biến” |

---

## 5. Danh mục API / WebSocket mà frontend đang gọi nhưng backend Node chưa có

*(Trích từ `frontend/public/js/user.js`, `companion.js`, `admin.js`, `companion-register.js` — không kể `GET/POST /api/users` đã có.)*

- **Auth & user:** `/api/auth/me`, `/api/user/login`, `/api/user/register`, `/api/user/logout`
- **Companion công khai:** `/api/companions`, `/api/companions/search`, `/api/companions/:id`, `/api/companions/register`, `/api/companions/:id/service-prices`
- **Companion (me):** `/api/companions/me/profile`, `PUT` identity, media-skills, online, bookings, checkin/checkout/sos, extension accept/reject, consultations, income-stats, service-prices CRUD, withdrawals, bank-account, workflow
- **Booking (user):** `/api/bookings`, `/api/bookings/me`, check-in/out, cancel/complete, extension, live-location
- **Yêu thích:** `/api/favorites/me`, `POST/DELETE /api/favorites/:id`
- **Review:** `/api/reviews`, `/api/reviews/me`
- **Report:** `/api/reports`, `/api/reports/me`
- **Chat & call:** `/api/chat/:bookingId/messages`, `/api/chat/:bookingId/call`
- **Thông báo:** `/api/user/notifications/me`, read/read-all; `/api/companion/notifications/me`, …; `/api/admin/notifications/me`, …
- **Ví:** `/api/wallet/me`, `/api/wallet/deposit`, `/api/wallet/transactions`
- **Admin:** `/api/admin/dashboard-stats`, `pending-companions`, `approve-companion`, `reject-companion`, `users`, moderation reviews, transactions, withdrawals approve/reject, `commission-rate`, `disputes`, booking tracking, notifications
- **Realtime:** `SockJS` tới `/ws` + STOMP topics (`notifications.user.*`, `chat.booking.*`, …) — **không có** trong `server.js`

---

## 6. Khoảng trống kiến trúc / phi chức năng (ảnh hưởng trực tiếp nghiệp vụ)

1. **Một nguồn sự thật cho auth:** cookie session (Spring) vs JWT trong `localStorage` — code admin có fallback khi `/api/auth/me` lỗi; cần thống nhất một cơ chế.
2. **Thanh toán thật:** MoMo/VNPay/chuyển khoản đòi hỏi merchant account, callback URL, idempotency, chống gian lận.
3. **VoIP “nội bộ”:** cần signaling (WebRTC), TURN/STUN, recording policy — hiện chỉ có placeholder API `call`.
4. **eKYC / so khớp ảnh–CCCD:** có thể là quy trình thủ công admin; tự động hóa là hạng mục riêng.
5. **Bảo mật:** rate limit, validate input, CORS chặt, audit log cho thao tác admin.
6. **Đồng bộ realtime:** hoặc triển khai STOMP như frontend, hoặc đổi frontend sang Socket.IO và nối `realtimeBroadcastService`.

---

## 7. Phần đã có sẵn (để tránh hiểu nhầm “thiếu toàn bộ”)

- **Giao diện** cho hầu hết luồng User / Companion / Admin.
- **Schema Mongoose** cho các thực thể cốt lõi (user, companion, booking, ví, rút tiền, báo cáo, review, …).
- **Proxy Vite** `/api` và `/ws` tới backend.
- **Static uploads** `/uploads` trên server (chưa gắn API upload).

---

*Tài liệu này đối chiếu trực tiếp với nội dung `nghiepvu3role.txt` và cấu trúc mã trong repo tại thời điểm so sánh.*
