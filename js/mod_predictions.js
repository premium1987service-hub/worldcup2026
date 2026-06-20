// js/mod_predictions.js
// Xử lý gửi bình chọn và kiểm tra tính hợp lệ của bình chọn

const predictions = {
  // Lấy danh sách bình chọn của user hiện tại
  async getMyPredictions() {
    const user = auth.getCurrentUser();
    if (!user) return [];
    return await sheets.getPredictions(user.google_id);
  },

  // Thực hiện gửi dự đoán lên server/mock database
  async submit(matchId, predictionValue) {
    const user = auth.getCurrentUser();
    if (!user) {
      alert('Vui lòng đăng nhập để bình chọn!');
      return false;
    }

    // 1. Tải danh sách trận đấu và tìm trận đấu đang chọn
    const allMatches = await api.getMatches();
    const match = allMatches.find(m => m.match_id === matchId);
    
    if (!match) {
      alert('Không tìm thấy thông tin trận đấu này!');
      return false;
    }

    // 2. Kiểm tra khóa bình chọn
    if (matches.isLocked(match)) {
      alert('Trận đấu này đã bị khóa bình chọn do sắp thi đấu hoặc đang diễn ra!');
      return false;
    }

    // 3. Kiểm tra tính hợp lệ của lựa chọn (Hòa chỉ được phép ở vòng bảng)
    const rule = SCORING_RULES[match.phase] || SCORING_RULES.GROUP;
    if (predictionValue === 'D' && !rule.allow_draw) {
      alert('Vòng đấu loại trực tiếp không có kết quả Hòa!');
      return false;
    }

    console.log(`Predictions: Gửi bình chọn cho trận ${matchId} -> ${predictionValue}`);
    
    // Ghi dữ liệu xuống Google Sheets / LocalStorage Mock
    const success = await sheets.savePrediction(user.google_id, matchId, predictionValue);
    
    if (success) {
      // Bắn event thông báo cập nhật UI thành công
      window.dispatchEvent(new CustomEvent('prediction_updated', {
        detail: { matchId, prediction: predictionValue }
      }));
    }
    
    return success;
  },

  // Thực hiện gửi hàng loạt dự đoán lên server/mock database
  async submitBatch(predictionsMap) {
    const user = auth.getCurrentUser();
    if (!user) {
      alert('Vui lòng đăng nhập để bình chọn!');
      return false;
    }

    if (Object.keys(predictionsMap).length === 0) {
      alert('Không có bình chọn nào để gửi!');
      return false;
    }

    const allMatches = await api.getMatches();
    const matchById = allMatches.reduce((acc, match) => {
      acc[String(match.match_id)] = match;
      return acc;
    }, {});

    for (const [matchId, predictionValue] of Object.entries(predictionsMap)) {
      const match = matchById[String(matchId)];
      if (!match) {
        alert('Không tìm thấy thông tin một trận đấu trong danh sách lưu!');
        return false;
      }

      if (matches.isLocked(match)) {
        alert(`Trận ${match.home_team} vs ${match.away_team} đã bị khóa bình chọn!`);
        return false;
      }

      if (!['W', 'D', 'L', ''].includes(predictionValue)) {
        alert('Dự đoán không hợp lệ!');
        return false;
      }

      const rule = SCORING_RULES[match.phase] || SCORING_RULES.GROUP;
      if (predictionValue === 'D' && !rule.allow_draw) {
        alert(`Trận ${match.home_team} vs ${match.away_team} không cho phép chọn Hòa!`);
        return false;
      }
    }

    console.log(`Predictions: Gửi hàng loạt bình chọn cho ${Object.keys(predictionsMap).length} trận đấu`);
    
    // Ghi dữ liệu xuống Google Sheets / LocalStorage Mock
    const success = await sheets.savePredictionsBatch(user.google_id, predictionsMap);
    
    if (success) {
      // Bắn event thông báo cập nhật UI thành công
      window.dispatchEvent(new CustomEvent('prediction_updated', {
        detail: { predictions: predictionsMap }
      }));
    }
    
    return success;
  }
};
