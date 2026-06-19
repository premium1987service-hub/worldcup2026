// js/mod_scoring.js
// Logic tính điểm và cập nhật Bảng xếp hạng từ luật scoring_rules.js

const scoring = {
  // Tính điểm chi tiết cho một User cụ thể
  async calculateUserScore(userId, allPredictions = null, allMatches = null) {
    const preds = allPredictions || await sheets.getPredictions(userId);
    const matches = allMatches || await sheets.getMatches();

    // Chỉ lọc các dự đoán của user này
    const userPreds = allPredictions ? preds.filter(p => p.user_id === userId) : preds;

    // Chuyển dự đoán thành Map: match_id -> prediction value để tra cứu O(1)
    const userPredMap = userPreds.reduce((acc, p) => {
      acc[p.match_id] = p.prediction;
      return acc;
    }, {});

    let score = 0;
    let correct = 0;
    let wrong = 0;
    let pending = 0;

    for (const match of matches) {
      // Đọc luật tính điểm tương ứng từ scoring_rules.js
      const rule = SCORING_RULES[match.phase] || SCORING_RULES.GROUP;

      // Trận đấu chưa kết thúc -> ở trạng thái chờ tính điểm
      if (match.status !== 'FINISHED' || !match.result) {
        pending++;
        continue;
      }

      const userPred = userPredMap[match.match_id];

      if (userPred) {
        // Có tham gia dự đoán
        if (userPred === match.result) {
          score += rule.correct_pts;
          correct++;
        } else {
          score += rule.wrong_pts;
          wrong++;
        }
      } else {
        // KHÔNG dự đoán -> Bị phạt trừ điểm giống như đoán sai
        score += (rule.unpredicted_pts !== undefined ? rule.unpredicted_pts : rule.wrong_pts);
        wrong++;
      }
    }

    return {
      score,
      correct,
      wrong,
      pending
    };
  },

  // Tính lại điểm và cập nhật Cache cho toàn bộ hệ thống
  async recalculateAll() {
    console.log('Scoring: Đang tính toán lại điểm cho toàn bộ người dùng...');
    
    const users = await sheets.getUsers();
    const predictions = await sheets.getPredictions();
    const matches = await sheets.getMatches();

    const leaderboard = [];
    const nowStr = new Date().toISOString();

    for (const user of users) {
      const result = await this.calculateUserScore(user.google_id, predictions, matches);
      leaderboard.push({
        user_id: user.google_id,
        name: user.name,
        total_score: result.score,
        correct: result.correct,
        wrong: result.wrong,
        pending: result.pending,
        last_updated: nowStr
      });
    }

    // Sắp xếp bảng xếp hạng:
    // 1. Điểm cao xếp trên
    // 2. Nếu bằng điểm, số trận đoán đúng (correct) nhiều hơn xếp trên
    // 3. Nếu vẫn bằng, xếp theo bảng chữ cái tên
    leaderboard.sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      if (b.correct !== a.correct) {
        return b.correct - a.correct;
      }
      return a.name.localeCompare(b.name);
    });

    // Lưu vào Cache của Google Sheets / LocalStorage
    await sheets.saveLeaderboardCache(leaderboard);
    console.log('Scoring: Tính toán lại hoàn tất. Đã lưu Bảng xếp hạng Cache.');
    
    // Phát sự kiện cập nhật giao diện
    window.dispatchEvent(new CustomEvent('leaderboard_recalculated'));
    return leaderboard;
  },

  // Tính điểm nhanh khi chỉ có 1 trận đấu thay đổi kết quả (để tối ưu hóa API và tốc độ)
  async recalculateForMatch(matchId) {
    console.log(`Scoring: Kích hoạt tính lại điểm cho trận ${matchId}`);
    // Đơn giản và an toàn nhất là tính lại toàn bộ để cập nhật BXH chính xác và sắp xếp lại thứ hạng.
    return await this.recalculateAll();
  }
};
