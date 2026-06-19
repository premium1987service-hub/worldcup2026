// js/mod_api.js
// Kết nối API football-data.org, quản lý cache và hệ thống tự động đồng bộ kết quả (Auto-Sync)

const api = {
  _cacheKey: 'football_api_matches_cache',
  _cacheTimeKey: 'football_api_matches_cache_time',
  _syncIntervalId: null,

  // Lấy danh sách trận đấu (có cache)
  async getMatches(forceRefresh = false) {
    if (CONFIG.USE_MOCK_DATA) {
      // Ở chế độ Mock, dữ liệu lấy trực tiếp từ mock sheets database (localStorage)
      return await sheets.getMatches();
    }

    const cachedTime = localStorage.getItem(this._cacheTimeKey);
    const cachedData = localStorage.getItem(this._cacheKey);
    const now = Date.now();

    // Kiểm tra cache hợp lệ
    if (!forceRefresh && cachedTime && cachedData) {
      const ageMin = (now - Number(cachedTime)) / 60000;
      if (ageMin < CONFIG.CACHE_TTL_MIN) {
        console.log(`API: Sử dụng cache trận đấu (${Math.round(ageMin)} phút tuổi)`);
        return JSON.parse(cachedData);
      }
    }

    console.log('API: Đang gọi football-data.org để lấy lịch thi đấu mới...');
    try {
      const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://api.football-data.org/v4/competitions/WC/matches');
      const response = await fetch(proxyUrl, {
        headers: { 'X-Auth-Token': CONFIG.FOOTBALL_API_TOKEN }
      });

      if (!response.ok) {
        throw new Error(`API response status: ${response.status}`);
      }

      const data = await response.json();
      const matches = data.matches.map(m => ({
        match_id: String(m.id),
        home_team: m.homeTeam.name,
        away_team: m.awayTeam.name,
        kickoff_time: m.utcDate,
        phase: m.stage === 'GROUP_STAGE' ? 'GROUP' : 'KNOCKOUT',
        competition: 'WC',
        status: m.status, // SCHEDULED, IN_PLAY, PAUSED, FINISHED
        result: this._parseOutcomeFromRaw(m),
        result_source: 'auto',
        result_updated_at: new Date().toISOString(),
        home_score: m.score && m.score.fullTime && m.score.fullTime.home !== null ? m.score.fullTime.home : '',
        away_score: m.score && m.score.fullTime && m.score.fullTime.away !== null ? m.score.fullTime.away : ''
      }));

      // Lưu cache
      localStorage.setItem(this._cacheKey, JSON.stringify(matches));
      localStorage.setItem(this._cacheTimeKey, String(now));

      // Đồng bộ các trận đấu này vào Database (Google Sheets)
      for (const match of matches) {
        await sheets.upsertMatch(match);
      }

      return matches;
    } catch (e) {
      console.error('Lỗi khi gọi API bóng đá:', e);
      // Fallback về cache nếu có, bất kể tuổi cache
      if (cachedData) {
        console.warn('API: Fallback về cache cũ do lỗi kết nối');
        return JSON.parse(cachedData);
      }
      // Hoặc trả về rỗng
      return [];
    }
  },

  // Phân tích kết quả trận đấu thô từ API football-data.org
  _parseOutcomeFromRaw(match) {
    if (match.status !== 'FINISHED') return '';
    const winner = match.score && match.score.winner;
    if (winner === 'HOME_TEAM') return 'W';
    if (winner === 'AWAY_TEAM') return 'L';
    if (winner === 'DRAW') return 'D';
    return '';
  },

  // Khởi động vòng lặp đồng bộ tự động (Auto-Sync Polling)
  startAutoSync(onStatusUpdateCallback) {
    if (this._syncIntervalId) clearInterval(this._syncIntervalId);

    console.log('API AutoSync: Đã khởi động.');
    
    // Tạo chu kỳ quét mỗi 1 phút (ở thực tế) hoặc giả lập (ở mock)
    const intervalTime = CONFIG.USE_MOCK_DATA ? 15000 : 300000; // Mock: 15 giây quét 1 lần; Thật: 5 phút

    this._syncIntervalId = setInterval(async () => {
      console.log('API AutoSync: Đang chạy chu kỳ đồng bộ...');
      const matches = await sheets.getMatches();
      const now = new Date();

      // Tìm các trận đấu đang đá (IN_PLAY) hoặc đã quá giờ kickoff mà chưa có kết quả (FINISHED)
      const activeMatches = matches.filter(m => 
        m.status === 'IN_PLAY' || 
        (m.status === 'SCHEDULED' && new Date(m.kickoff_time) <= now && !m.result)
      );

      if (activeMatches.length === 0) {
        console.log('API AutoSync: Không có trận đấu nào đang đá cần đồng bộ.');
        if (onStatusUpdateCallback) onStatusUpdateCallback({ activeCount: 0 });
        return;
      }

      console.log(`API AutoSync: Tìm thấy ${activeMatches.length} trận đấu cần xử lý.`);

      if (CONFIG.USE_MOCK_DATA) {
        // --- GIẢ LẬP KẾT QUẢ CHO CHẾ ĐỘ MOCK ---
        for (const match of activeMatches) {
          if (match.status === 'SCHEDULED') {
            // Chuyển sang đang đá
            match.status = 'IN_PLAY';
            match.home_score = 0;
            match.away_score = 0;
            await sheets.upsertMatch(match);
            console.log(`API AutoSync (Mock): Trận ${match.home_team} vs ${match.away_team} đã bắt đầu đá (0 - 0)!`);
          } else if (match.status === 'IN_PLAY') {
            const rand = Math.random();
            if (rand > 0.75) {
              // Kết thúc trận đấu, sinh tỷ số ngẫu nhiên
              match.status = 'FINISHED';
              const hScore = Math.floor(Math.random() * 4);
              const aScore = Math.floor(Math.random() * 4);
              match.home_score = hScore;
              match.away_score = aScore;
              
              if (hScore > aScore) match.result = 'W';
              else if (hScore < aScore) match.result = 'L';
              else {
                if (match.phase === 'KNOCKOUT') {
                  match.result = Math.random() > 0.5 ? 'W' : 'L'; // penalty winner
                } else {
                  match.result = 'D';
                }
              }
              match.result_source = 'auto';
              match.result_updated_at = new Date().toISOString();
              
              await sheets.upsertMatch(match);
              console.log(`API AutoSync (Mock): Trận ${match.home_team} vs ${match.away_team} kết thúc. Tỷ số: ${hScore} - ${aScore}. Kết quả: ${match.result}`);
              
              // Kích hoạt tính điểm & cập nhật BXH
              await scoring.recalculateForMatch(match.match_id);
            } else if (rand > 0.4) {
              // Giả lập bàn thắng ghi khi đang đá
              if (Math.random() > 0.5) {
                match.home_score = Number(match.home_score || 0) + 1;
              } else {
                match.away_score = Number(match.away_score || 0) + 1;
              }
              await sheets.upsertMatch(match);
              console.log(`API AutoSync (Mock): Vào!!! Trận ${match.home_team} vs ${match.away_team} tỷ số hiện tại: ${match.home_score} - ${match.away_score}`);
            } else {
              console.log(`API AutoSync (Mock): Trận ${match.home_team} vs ${match.away_team} đang đá (${match.home_score} - ${match.away_score})...`);
            }
          }
        }
      } else {
        // --- CHẠY THỰC TẾ GỌI API ---
        for (const match of activeMatches) {
          try {
            // Gọi chi tiết 1 trận
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(`https://api.football-data.org/v4/matches/${match.match_id}`);
            const response = await fetch(proxyUrl, {
              headers: { 'X-Auth-Token': CONFIG.FOOTBALL_API_TOKEN }
            });
            
            if (!response.ok) continue;
            const data = await response.json();
            const apiMatch = data;

            if (apiMatch.status === 'IN_PLAY') {
              match.status = 'IN_PLAY';
              match.home_score = apiMatch.score.fullTime.home !== null ? apiMatch.score.fullTime.home : '0';
              match.away_score = apiMatch.score.fullTime.away !== null ? apiMatch.score.fullTime.away : '0';
              await sheets.upsertMatch(match);
            } else if (apiMatch.status === 'FINISHED') {
              const finalOutcome = this._parseOutcomeFromRaw(apiMatch);
              
              match.status = 'FINISHED';
              match.result = finalOutcome;
              match.home_score = apiMatch.score.fullTime.home !== null ? apiMatch.score.fullTime.home : '';
              match.away_score = apiMatch.score.fullTime.away !== null ? apiMatch.score.fullTime.away : '';
              match.result_source = 'auto';
              match.result_updated_at = new Date().toISOString();
              
              await sheets.upsertMatch(match);
              
              // Kích hoạt tính lại điểm cho trận đấu này
              await scoring.recalculateForMatch(match.match_id);
            }
          } catch (e) {
            console.error(`API AutoSync: Lỗi khi đồng bộ trận ${match.match_id}:`, e);
          }
        }
      }

      if (onStatusUpdateCallback) {
        onStatusUpdateCallback({ 
          activeCount: activeMatches.length,
          lastSync: new Date().toLocaleTimeString(),
          matches: activeMatches 
        });
      }

      // Kích hoạt sự kiện toàn cục để UI tự động cập nhật
      window.dispatchEvent(new CustomEvent('football_data_synced'));

    }, intervalTime);
  },

  // Dừng đồng bộ tự động
  stopAutoSync() {
    if (this._syncIntervalId) {
      clearInterval(this._syncIntervalId);
      this._syncIntervalId = null;
      console.log('API AutoSync: Đã dừng.');
    }
  }
};
