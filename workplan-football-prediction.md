# Work Plan: Website Dự đoán Bóng đá

> **Stack:** Vanilla JS · GitHub Pages · Google Sheets API · Google OAuth (GIS) · football-data.org API  
> **Quy mô:** ~30 người dùng · World Cup (mở rộng được sang Euro, EPL...)  
> **Nguyên tắc:** Mỗi module một file JS riêng · Rules tính điểm trong `scoring_rules.js` · Google Sheet chỉ lưu dữ liệu

---

## Phân chia trách nhiệm rõ ràng

| Lưu ở đâu | Lưu gì |
|---|---|
| `scoring_rules.js` (file JS tĩnh) | Rules tính điểm — sửa file → deploy lại (~1 phút) |
| Google Sheets | Dữ liệu động: users, predictions, results, leaderboard cache |
| `config.js` (file JS tĩnh) | API keys, Sheet ID, hằng số cấu hình |
| football-data.org API | Lịch thi đấu & kết quả thô |

---

## Tổng quan các Phase

| Phase | Nội dung | Ưu tiên |
|---|---|---|
| 1 | Hạ tầng & Database | 🔴 Bắt buộc trước |
| 2 | Authentication | 🔴 Bắt buộc trước |
| 3 | Lịch thi đấu & API | 🔴 Core |
| 4 | Giao diện Bình chọn | 🔴 Core |
| 5 | Tự động cập nhật kết quả | 🔴 Core |
| 6 | Tính điểm & Bảng xếp hạng | 🔴 Core |
| 7 | Admin Panel | 🟡 Cần thiết |
| 8 | Deploy & Kiểm thử | 🟡 Cần thiết |

---

## Phase 1 — Hạ tầng & Google Sheets Database

### 1.1 Cấu trúc thư mục dự án

```
football-prediction/
├── index.html               ← Trang chủ: trận đấu trong 24h
├── predict.html             ← Giao diện bình chọn
├── leaderboard.html         ← Bảng xếp hạng
├── admin.html               ← Quản lý & giám sát
├── js/
│   ├── config.js            ← API keys, Sheet ID, hằng số chung
│   ├── scoring_rules.js     ← ★ Rules tính điểm — sửa đây để đổi rules
│   ├── mod_auth.js          ← Google login, session, phân quyền
│   ├── mod_sheets.js        ← Wrapper CRUD Google Sheets API v4
│   ├── mod_api.js           ← football-data.org API + cache + auto-sync
│   ├── mod_matches.js       ← Logic lọc & hiển thị trận đấu
│   ├── mod_predictions.js   ← Ghi/đọc bình chọn, kiểm tra khóa
│   ├── mod_scoring.js       ← Tính điểm — đọc rules từ scoring_rules.js
│   └── mod_ui.js            ← Helper render UI dùng chung
├── css/
│   └── style.css
└── .github/workflows/
    └── deploy.yml           ← Auto-deploy lên GitHub Pages
```

### 1.2 scoring_rules.js — Trung tâm cấu hình điểm

```javascript
// scoring_rules.js
// Sửa file này để thay đổi rules → commit → deploy tự động (~1 phút)

const SCORING_RULES = {
  GROUP: {
    correct_pts:  0,   // đoán đúng W/D/L → không được điểm (mặc định)
    wrong_pts:   -1,   // đoán sai        → trừ 1 điểm
    allow_draw: true,  // có nút Hòa
    note: 'Vòng bảng'
  },
  KNOCKOUT: {
    correct_pts:  0,   // đoán đúng W/L   → không được điểm (mặc định)
    wrong_pts:   -1,   // đoán sai        → trừ 1 điểm
    allow_draw: false, // không có nút Hòa
    note: 'Loại trực tiếp'
  }
}
```

> Lý do không để rules trong Google Sheet: nhóm nhỏ 30 người, rules ít thay đổi,
> deploy lại chỉ mất ~1 phút, an toàn hơn và dễ debug hơn.

### 1.3 Google Sheets — 4 Sheets (chỉ lưu dữ liệu, không lưu cấu hình)

#### Sheet: `Users`
| Cột | Kiểu | Mô tả |
|---|---|---|
| `google_id` | string | ID từ Google OAuth — primary key |
| `email` | string | Email Google |
| `name` | string | Tên hiển thị |
| `avatar_url` | string | Ảnh đại diện |
| `is_admin` | boolean | `TRUE` nếu là admin |
| `joined_at` | timestamp | Lần đăng nhập đầu tiên |

#### Sheet: `Matches`
| Cột | Kiểu | Mô tả |
|---|---|---|
| `match_id` | string | ID từ football-data.org |
| `home_team` | string | Đội nhà |
| `away_team` | string | Đội khách |
| `kickoff_time` | ISO 8601 | Giờ thi đấu (UTC) |
| `phase` | string | `GROUP` hoặc `KNOCKOUT` |
| `competition` | string | `WC`, `EC`... |
| `status` | string | `SCHEDULED` / `IN_PLAY` / `FINISHED` |
| `result` | string | `W` / `D` / `L` — tự động từ API |
| `result_source` | string | `auto` hoặc `manual` — tránh auto ghi đè manual |
| `result_updated_at` | timestamp | Lần sync kết quả gần nhất |

#### Sheet: `Predictions`
| Cột | Kiểu | Mô tả |
|---|---|---|
| `prediction_id` | string | UUID tự sinh |
| `user_id` | string | google_id của người dự đoán |
| `match_id` | string | ID trận đấu |
| `prediction` | string | `W` / `D` / `L` |
| `submitted_at` | timestamp | Thời điểm submit / cập nhật |

#### Sheet: `Leaderboard_Cache`
| Cột | Kiểu | Mô tả |
|---|---|---|
| `user_id` | string | google_id |
| `name` | string | Tên hiển thị |
| `total_score` | number | Điểm tích lũy |
| `correct` | number | Số lần đoán đúng |
| `wrong` | number | Số lần đoán sai |
| `pending` | number | Số trận chờ kết quả |
| `last_updated` | timestamp | Lần tính điểm gần nhất |

### 1.4 Checklist thiết lập Google Cloud

- [ ] Tạo Google Cloud Project
- [ ] Bật Google Sheets API v4
- [ ] Bật Google Identity Services (OAuth 2.0)
- [ ] Tạo OAuth Client ID (Web application)
- [ ] Thêm `https://<username>.github.io` vào Authorized JavaScript Origins
- [ ] Lưu `CLIENT_ID` và `SPREADSHEET_ID` vào `config.js`

---

## Phase 2 — Authentication (mod_auth.js)

### Luồng đăng nhập

```
User click "Đăng nhập Google"
  → Google GIS popup → nhận id_token JWT
  → Verify token client-side
  → Kiểm tra Sheet:Users
      → Chưa có: thêm row mới
      → Có rồi: không làm gì
  → Lưu session vào localStorage
```

### Các hàm cần xây dựng

| Hàm | Mô tả |
|---|---|
| `auth.init()` | Khởi tạo GIS, restore session cũ |
| `auth.login()` | Mở popup đăng nhập Google |
| `auth.logout()` | Xóa session localStorage |
| `auth.getCurrentUser()` | Trả về user object từ session |
| `auth.isAdmin()` | Kiểm tra `is_admin` trong Sheet:Users — không chỉ localStorage |
| `auth.requireLogin()` | Guard: redirect nếu chưa đăng nhập |
| `auth.getAuthHeader()` | Trả về `Bearer <token>` cho mọi Sheets API call |

### Bảo mật

- Token JWT TTL 1 giờ — tự động refresh
- Quyền admin kiểm tra server-side (Sheet) không chỉ localStorage
- Admin panel redirect nếu `is_admin !== TRUE`

---

## Phase 3 — Lịch thi đấu & API (mod_api.js + mod_matches.js)

### Chiến lược cache (free tier: 10 req/phút)

```
getMatches()
  → Cache localStorage còn hiệu lực (< 60 phút)?
      → Dùng cache — không tốn quota
  → Hết hạn / chưa có?
      → Gọi football-data.org
      → Lưu cache + timestamp
      → Upsert danh sách trận vào Sheet:Matches
```

### Lọc trận theo màn hình

| Màn hình | Điều kiện |
|---|---|
| Trang chủ | kickoff trong `now ± 24h`, hiển thị GMT+7 |
| Bình chọn | Trận chưa có kết quả VÀ chưa quá giờ khóa |
| Admin | Tất cả trận, hiển thị cả UTC |

### Mở rộng giải đấu trong config.js

```javascript
const CONFIG = {
  COMPETITIONS: {
    WC: { code: 'WC', name: 'World Cup' },
    EC: { code: 'EC', name: 'Euro' },   // thêm sau
    PL: { code: 'PL', name: 'EPL'  },   // thêm sau
  },
  ACTIVE: ['WC'],       // chỉ fetch giải đang hoạt động
  LOCK_BEFORE_MIN: 60,  // khóa bình chọn trước N phút
  CACHE_TTL_MIN:   60,  // cache API trong N phút
  TIMEZONE: 'Asia/Ho_Chi_Minh',
}
```

---

## Phase 4 — Giao diện Bình chọn (mod_predictions.js)

### Logic hiển thị mỗi trận

```
if (phase === 'GROUP')    → 3 nút: [Thắng] [Hòa] [Thua]
if (phase === 'KNOCKOUT') → 2 nút: [Thắng] [Thua]

if (now >= kickoff - LOCK_BEFORE_MIN):
  → Nút disabled, hiển thị "Đã khóa lúc HH:MM"
  → Bình chọn của user hiển thị readonly
else:
  → Nút đã chọn được highlight
  → Countdown: "Khóa sau Xh Ym"
```

### Luồng ghi bình chọn

```
User click [W/D/L]
  → Double-check khóa (phòng race condition)
  → Đã bình chọn trận này chưa?
      → Chưa: thêm row mới vào Sheet:Predictions
      → Rồi:  cập nhật row cũ
  → Cập nhật UI ngay (optimistic update)
```

---

## Phase 5 — Tự động cập nhật kết quả (mod_api.js)

### Chiến lược polling

| Thời điểm | Hành động | Interval |
|---|---|---|
| Trước kickoff | Không poll | — |
| kickoff → +120 phút | Poll các trận IN_PLAY | 5 phút |
| +120 phút (nếu chưa FINISHED) | Có thể hiệp phụ/penalty | 10 phút |
| Sau FINISHED | Dừng poll trận đó | — |
| Không có user nào online | Không poll | — |

### Luồng auto-sync

```
Trang load → api.startAutoSync()
  → Tìm trận IN_PLAY hoặc vừa qua kickoff chưa có kết quả
  → Với mỗi trận đó: bắt đầu polling

Mỗi chu kỳ poll:
  → GET /matches/{match_id}
  → status === 'FINISHED' && có score?
      → parseOutcome(score) → W / D / L
      → Ghi Sheet:Matches (result, result_source='auto', result_updated_at)
      → scoring.recalculateForMatch(match_id)
      → Cập nhật Sheet:Leaderboard_Cache
      → Dừng poll trận này
      → Refresh UI bảng xếp hạng
```

### Parse kết quả từ API

```javascript
function parseOutcome(match) {
  // Ưu tiên: fullTime → extraTime → penalties
  const score = match.score.fullTime
  if (score.home > score.away) return 'W'
  if (score.home < score.away) return 'L'

  // Vòng loại trực tiếp: hòa 90 phút → xem thêm giờ
  if (match.phase === 'KNOCKOUT') {
    const et = match.score.extraTime
    if (et?.home > et?.away) return 'W'
    if (et?.home < et?.away) return 'L'
    const pen = match.score.penalties
    if (pen?.home > pen?.away) return 'W'
    return 'L'
  }
  return 'D' // hòa hợp lệ ở vòng bảng
}
```

> Admin có thể override thủ công trong Admin Panel.
> Khi `result_source = 'manual'`, auto-sync sẽ không ghi đè.

---

## Phase 6 — Tính điểm & Bảng xếp hạng (mod_scoring.js)

### Logic tính điểm (đọc từ scoring_rules.js)

```javascript
// mod_scoring.js — KHÔNG hardcode điểm ở đây
// Tất cả rules lấy từ SCORING_RULES trong scoring_rules.js

async function calculateScore(userId) {
  const predictions = await sheets.getPredictions(userId)
  const results     = await sheets.getResults()

  let score = 0, correct = 0, wrong = 0, pending = 0

  for (const pred of predictions) {
    const outcome = results[pred.match_id]
    if (!outcome) { pending++; continue }

    const rule = SCORING_RULES[pred.phase]  // ← từ scoring_rules.js
    if (pred.prediction === outcome) {
      score += rule.correct_pts
      correct++
    } else {
      score += rule.wrong_pts
      wrong++
    }
  }
  return { score, correct, wrong, pending }
}
```

### Trigger tính điểm

```
api.syncResultToSheet(matchId)     ← sau khi auto-sync FINISHED
  → scoring.recalculateForMatch(matchId)
      → Lấy tất cả predictions của trận này
      → Tính lại điểm từng user
      → Ghi Sheet:Leaderboard_Cache
      → Emit event → UI tự refresh
```

### Giao diện bảng xếp hạng

| Tính năng | Mô tả |
|---|---|
| Sắp xếp | Toggle cao→thấp / thấp→cao |
| Highlight | Row của user hiện tại nổi bật |
| Cột hiển thị | Hạng · Tên · Điểm · Đúng · Sai · Đang chờ |
| Realtime | Tự refresh sau mỗi auto-sync thành công |

---

## Phase 7 — Admin Panel (admin.html)

Chỉ truy cập được khi `is_admin = TRUE` trong Sheet:Users.

| Tính năng | Mô tả | Khi nào dùng |
|---|---|---|
| Giám sát auto-sync | Danh sách trận đang poll, lần sync gần nhất, lỗi | Hàng ngày |
| Override kết quả thủ công | Nhập W/D/L, set `result_source = 'manual'` | API sai/chậm |
| Tính lại điểm toàn bộ | Nút "Recalculate All" — sau khi đổi rules | Sau khi deploy rules mới |
| Quản lý người chơi | Cấp/thu hồi quyền admin | Onboarding |
| Xem bình chọn theo trận | Ai đoán gì — hiển thị sau khi trận khóa | Debug |

---

## Phase 8 — Deploy & Kiểm thử

### GitHub Actions (deploy.yml)

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### Checklist trước go-live

**Auth & bảo mật**
- [ ] Đăng nhập Google thành công, user ghi vào Sheet:Users
- [ ] Admin panel chặn đúng non-admin
- [ ] Token tự refresh sau 1 giờ

**Bình chọn**
- [ ] GROUP hiện 3 nút, KNOCKOUT hiện 2 nút
- [ ] Khóa đúng 60 phút trước kickoff
- [ ] Countdown hiển thị đúng GMT+7
- [ ] Cập nhật bình chọn ghi đè đúng

**Auto-sync kết quả**
- [ ] Polling tự khởi động khi có trận IN_PLAY
- [ ] Kết quả ghi vào Sheet:Matches sau FINISHED
- [ ] Override manual không bị auto-sync ghi đè
- [ ] Polling dừng sau FINISHED
- [ ] Không vượt quota 10 req/phút

**Tính điểm**
- [ ] Đúng → cộng đúng `correct_pts` từ scoring_rules.js
- [ ] Sai → trừ đúng `wrong_pts` từ scoring_rules.js
- [ ] Thay đổi scoring_rules.js → deploy → Recalculate All → điểm đúng
- [ ] BXH tự refresh sau auto-sync

### Thứ tự code

1. `config.js` + `scoring_rules.js` + `mod_sheets.js`
2. `mod_auth.js`
3. `mod_api.js` (phần fetch + cache)
4. `index.html` + `mod_matches.js`
5. `predict.html` + `mod_predictions.js`
6. `mod_api.js` (phần auto-sync polling)
7. `mod_scoring.js` + `leaderboard.html`
8. `admin.html`
9. `deploy.yml` + kiểm thử toàn bộ
