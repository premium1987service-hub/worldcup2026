// js/mod_matches.js
// Quản lý lọc, sắp xếp và kiểm tra trạng thái khóa của trận đấu

const matches = {
  // Kiểm tra xem trận đấu đã bị khóa bình chọn hay chưa
  isLocked(match) {
    if (match.status === 'FINISHED' || match.status === 'IN_PLAY') {
      return true;
    }
    const kickoff = new Date(match.kickoff_time);
    const now = new Date();
    const lockTime = new Date(kickoff.getTime() - CONFIG.LOCK_BEFORE_MIN * 60000);
    return now >= lockTime;
  },

  // Tính toán thời gian còn lại trước khi khóa (trả về text hoặc ms)
  getLockCountdown(match) {
    if (this.isLocked(match)) {
      return 'Đã khóa';
    }

    const kickoff = new Date(match.kickoff_time);
    const lockTime = new Date(kickoff.getTime() - CONFIG.LOCK_BEFORE_MIN * 60000);
    const now = new Date();
    const diffMs = lockTime - now;

    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    if (diffHrs > 0) {
      return `Khóa sau ${diffHrs}g ${diffMins}ph`;
    }
    return `Khóa sau ${diffMins} phút`;
  },

  // Định dạng ngày giờ thi đấu sang múi giờ Việt Nam (GMT+7)
  formatKickoffTime(isoString) {
    const d = new Date(isoString);
    return d.toLocaleString('vi-VN', {
      timeZone: CONFIG.TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  },

  // Định dạng ngày giờ ngắn để làm giao diện gọn gàng hơn
  formatKickoffShort(isoString) {
    const d = new Date(isoString);
    const time = d.toLocaleTimeString('vi-VN', {
      timeZone: CONFIG.TIMEZONE,
      hour: '2-digit',
      minute: '2-digit'
    });
    const date = d.toLocaleDateString('vi-VN', {
      timeZone: CONFIG.TIMEZONE,
      day: '2-digit',
      month: '2-digit'
    });
    return `${time} ngày ${date}`;
  },

  // Lọc danh sách trận đấu cho Trang chủ (Trong vòng 24 giờ xung quanh thời điểm hiện tại: now ± 24h)
  getHomeMatches(allMatches) {
    const now = new Date().getTime();
    const rangeMs = 24 * 3600 * 1000; // 24 giờ
    
    return allMatches.filter(m => {
      const kickoff = new Date(m.kickoff_time).getTime();
      return Math.abs(kickoff - now) <= rangeMs;
    }).sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time));
  },

  // Lọc các trận đấu dành cho trang bình chọn (chưa đá hoặc sắp đá, lọc bỏ trận đã kết thúc lâu)
  getPredictableMatches(allMatches) {
    // Trả về các trận SCHEDULED hoặc IN_PLAY
    // Xếp các trận chưa khóa lên trước, các trận đã khóa nhưng chưa kết thúc (hoặc đang đá) xếp sau
    return allMatches.filter(m => m.status !== 'FINISHED')
      .sort((a, b) => {
        const aLocked = this.isLocked(a);
        const bLocked = this.isLocked(b);
        if (aLocked !== bLocked) {
          return aLocked ? 1 : -1; // Chưa khóa xếp lên trước
        }
        return new Date(a.kickoff_time) - new Date(b.kickoff_time);
      });
  }
};
