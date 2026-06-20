// scoring_rules.js
// Sửa file này để thay đổi rules → commit → deploy tự động (~1 phút)

const SCORING_RULES = {
  GROUP: {
    correct_pts: 0,    // Đoán đúng W/D/L -> 0 điểm
    wrong_pts: -1,     // Đoán sai -> trừ 1 điểm
    unpredicted_pts: -1, // Không đoán -> trừ 1 điểm (phạt bỏ trận)
    allow_draw: true,  // Vòng bảng có kết quả Hòa (W / D / L)
    note: 'Vòng bảng'
  },
  KNOCKOUT: {
    correct_pts: 0,    // Đoán đúng W/L -> 0 điểm
    wrong_pts: -1,     // Đoán sai -> trừ 1 điểm
    unpredicted_pts: -1, // Không đoán -> trừ 1 điểm (phạt bỏ trận)
    allow_draw: false, // Vòng loại trực tiếp không có kết quả Hòa (chỉ W / L)
    note: 'Vòng loại trực tiếp'
  }
};

// Xuất cấu hình nếu chạy trong môi trường module Node (để test nếu cần)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SCORING_RULES };
}
