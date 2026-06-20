// js/mod_api.js
// Kết nối API worldcup26.ir, quản lý cache và hệ thống tự động đồng bộ kết quả (Auto-Sync)

const api = {
  _cacheKey: 'football_api_matches_cache',
  _cacheTimeKey: 'football_api_matches_cache_time',
  _syncIntervalId: null,

  _stadiumOffsets: {
    '1': -6, '2': -6, '3': -6, // Mexico (CST permanent)
    '4': -5, '5': -5, '6': -5, // US Central (CDT)
    '7': -4, '8': -4, '9': -4, '10': -4, '11': -4, '12': -4, // US/Canada Eastern (EDT)
    '13': -7, '14': -7, '15': -7, '16': -7 // US/Canada Western (PDT)
  },

  _parseLocalDateToUTC(localDateStr, stadiumId) {
    // Định dạng: "MM/DD/YYYY HH:mm" -> ví dụ "06/11/2026 13:00"
    if (!localDateStr) return new Date().toISOString();
    
    const parts = localDateStr.split(' ');
    if (parts.length < 2) return new Date().toISOString();
    
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length < 3 || timeParts.length < 2) return new Date().toISOString();
    
    const month = parseInt(dateParts[0], 10);
    const day = parseInt(dateParts[1], 10);
    const year = parseInt(dateParts[2], 10);
    
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    
    const offset = this._stadiumOffsets[stadiumId] || 0;
    
    const utcMs = Date.UTC(year, month - 1, day, hour - offset, minute);
    return new Date(utcMs).toISOString();
  },

  _mapApiGameToMatch(g) {
    const kickoff = this._parseLocalDateToUTC(g.local_date, g.stadium_id);
    const hScore = (g.home_score !== null && g.home_score !== undefined && g.home_score !== '') ? String(g.home_score) : '';
    const aScore = (g.away_score !== null && g.away_score !== undefined && g.away_score !== '') ? String(g.away_score) : '';
    
    let status = 'SCHEDULED';
    if (g.finished === 'TRUE' || g.finished === true || g.finished === 'true') {
      status = 'FINISHED';
    } else if (g.time_elapsed && g.time_elapsed !== 'notstarted') {
      status = 'IN_PLAY';
    }
    
    let result = '';
    if (status === 'FINISHED' && hScore !== '' && aScore !== '') {
      const hs = parseInt(hScore, 10);
      const as = parseInt(aScore, 10);
      if (hs > as) result = 'W';
      else if (hs < as) result = 'L';
      else {
        result = (g.type === 'group') ? 'D' : 'W'; // Mặc định luồng bình chọn KO
      }
    }
    
    return {
      match_id: String(g.id),
      home_team: g.home_team_name_en || 'TBD',
      away_team: g.away_team_name_en || 'TBD',
      kickoff_time: kickoff,
      phase: (g.type === 'group') ? 'GROUP' : 'KNOCKOUT',
      competition: 'WC',
      status: status,
      result: result,
      result_source: 'auto',
      result_updated_at: new Date().toISOString(),
      home_score: hScore,
      away_score: aScore
    };
  },

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

    console.log('API: Đang gọi worldcup26.ir để lấy lịch thi đấu mới...');
    try {
      const response = await fetch('https://worldcup26.ir/get/games');

      if (!response.ok) {
        throw new Error(`API response status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.games || !Array.isArray(data.games)) {
        throw new Error('Định dạng dữ liệu API không chính xác (thiếu array games)');
      }
      
      const matches = data.games.map(g => this._mapApiGameToMatch(g));

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
      // Fallback về cache cũ nếu có
      if (cachedData) {
        console.warn('API: Fallback về cache cũ do lỗi kết nối');
        return JSON.parse(cachedData);
      }
      
      // Fallback về WC2026_FIXTURES tĩnh nếu không có cache
      console.warn('API: Fallback về WC2026_FIXTURES tĩnh do lỗi kết nối và không có cache');
      if (typeof WC2026_FIXTURES !== 'undefined') {
        for (const match of WC2026_FIXTURES) {
          await sheets.upsertMatch(match);
        }
        return WC2026_FIXTURES;
      }
      return [];
    }
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
            match.home_score = '0';
            match.away_score = '0';
            await sheets.upsertMatch(match);
            console.log(`API AutoSync (Mock): Trận ${match.home_team} vs ${match.away_team} đã bắt đầu đá (0 - 0)!`);
          } else if (match.status === 'IN_PLAY') {
            const rand = Math.random();
            if (rand > 0.75) {
              // Kết thúc trận đấu, sinh tỷ số ngẫu nhiên
              match.status = 'FINISHED';
              const hScore = Math.floor(Math.random() * 4);
              const aScore = Math.floor(Math.random() * 4);
              match.home_score = String(hScore);
              match.away_score = String(aScore);
              
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
                match.home_score = String(Number(match.home_score || 0) + 1);
              } else {
                match.away_score = String(Number(match.away_score || 0) + 1);
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
        try {
          console.log('API AutoSync: Đang gọi worldcup26.ir để kiểm tra tỷ số trực tiếp...');
          const response = await fetch('https://worldcup26.ir/get/games');
          if (!response.ok) throw new Error(`API status ${response.status}`);
          
          const data = await response.json();
          if (data.games && Array.isArray(data.games)) {
            for (const match of activeMatches) {
              const apiGame = data.games.find(g => String(g.id) === String(match.match_id));
              if (!apiGame) continue;
              
              const updatedMatch = this._mapApiGameToMatch(apiGame);
              
              // Chỉ cập nhật nếu có thay đổi
              if (updatedMatch.status !== match.status || 
                  updatedMatch.home_score !== match.home_score || 
                  updatedMatch.away_score !== match.away_score ||
                  updatedMatch.result !== match.result) {
                
                // Giữ kết quả manual nếu có
                if (match.result_source === 'manual') {
                  updatedMatch.result = match.result;
                  updatedMatch.home_score = match.home_score;
                  updatedMatch.away_score = match.away_score;
                  updatedMatch.status = match.status;
                  updatedMatch.result_source = 'manual';
                }
                
                await sheets.upsertMatch(updatedMatch);
                console.log(`API AutoSync: Cập nhật trận ${updatedMatch.home_team} vs ${updatedMatch.away_team} (${updatedMatch.status}: ${updatedMatch.home_score} - ${updatedMatch.away_score})`);
                
                // Cập nhật điểm số khi trận đấu kết thúc
                if (updatedMatch.status === 'FINISHED' && match.status !== 'FINISHED') {
                  await scoring.recalculateForMatch(updatedMatch.match_id);
                }
              }
            }
          }
        } catch (e) {
          console.error('API AutoSync: Lỗi khi đồng bộ kết quả trực tiếp:', e);
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
