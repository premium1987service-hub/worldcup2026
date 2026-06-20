// config.js
// Cấu hình chung cho ứng dụng

const CONFIG = {
  // Thay thế bằng ID của Google Spreadsheet thực tế của bạn
  SPREADSHEET_ID: '1-Uj_m2CNvvFQZm0aOsv2MFGEK4lis0KkfvoP79KYlmg', 
  
  // Thay thế bằng OAuth Client ID từ Google Cloud Console
  GOOGLE_CLIENT_ID: '537170929742-4tv26l41tvmor0oqiubk3pajsk4jf08h.apps.googleusercontent.com', 
  
  // Thay thế bằng API token từ football-data.org (nếu dùng dữ liệu thật)
  FOOTBALL_API_TOKEN: '', 

  // Cho phép ghi trực tiếp từ trình duyệt vào các bảng đặc quyền (Users, Matches, Leaderboard_Cache).
  // Bật TRUE vì Google Sheet được chia sẻ quyền chỉnh sửa (Editor) cho tất cả người dùng.
  ALLOW_CLIENT_PRIVILEGED_WRITES: true,

  // Tự động sử dụng Mock Data nếu chưa cấu hình API thực tế
  // Cực kỳ hữu ích cho việc trải nghiệm và kiểm thử ngay lập tức!
  get USE_MOCK_DATA() {
    return !this.SPREADSHEET_ID || !this.GOOGLE_CLIENT_ID;
  },

  COMPETITIONS: {
    WC: { code: 'WC', name: 'World Cup' },
    EC: { code: 'EC', name: 'Euro' },   
    PL: { code: 'PL', name: 'EPL'  },   
  },
  
  ACTIVE: ['WC'],       // Chỉ fetch các giải đấu đang hoạt động
  LOCK_BEFORE_MIN: 60,  // Khóa bình chọn trước giờ thi đấu 60 phút
  CACHE_TTL_MIN: 60,    // Cache API trong 60 phút ở localStorage
  TIMEZONE: 'Asia/Ho_Chi_Minh',
};

// Xuất cấu hình nếu cần
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG };
}
