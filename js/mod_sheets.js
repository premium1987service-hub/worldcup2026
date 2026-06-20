// js/mod_sheets.js
// Wrapper CRUD Google Sheets API v4 & LocalStorage Mock Database

const sheets = {
  // Helper để lấy/gán dữ liệu trong localStorage khi dùng Mock
  _getMockStorage(key) {
    const data = localStorage.getItem(`football_predict_mock_${key}`);
    return data ? JSON.parse(data) : null;
  },

  _setMockStorage(key, value) {
    localStorage.setItem(`football_predict_mock_${key}`, JSON.stringify(value));
  },

  _isPredictionRange(range) {
    return /^Predictions!/i.test(String(range || ''));
  },

  _assertWriteAllowed(range, method) {
    if (CONFIG.USE_MOCK_DATA || method === 'GET') return;
    if (CONFIG.ALLOW_CLIENT_PRIVILEGED_WRITES) return;
    if (this._isPredictionRange(range)) return;

    throw new Error(
      'Privileged Google Sheets writes are disabled in client mode. ' +
      'Use a backend/Apps Script proxy for Users, Matches, and Leaderboard writes.'
    );
  },

  // Khởi tạo cơ sở dữ liệu (đặc biệt là tạo dữ liệu ảo nếu trống ở lần chạy đầu tiên)
  initDB() {
    if (!CONFIG.USE_MOCK_DATA) return;

    // 1. Tạo danh sách trận đấu giả lập nếu chưa có hoặc thiếu số lượng (dưới 104 trận)
    const existingMatches = this._getMockStorage('Matches');
    if (!existingMatches || existingMatches.length < 104) {
      const anchorDate = new Date('2026-06-20T00:00:00Z');
      const mockMatches = (typeof WC2026_FIXTURES !== 'undefined' ? WC2026_FIXTURES : []).map(fixture => {
        const match = { ...fixture };
        const kickoff = new Date(match.kickoff_time);
        const timeDiffMs = anchorDate - kickoff;

        if (timeDiffMs > 2 * 60 * 60 * 1000) {
          // Finished (more than 2 hours ago)
          match.status = 'FINISHED';
          const home = Math.floor(Math.random() * 4);
          const away = Math.floor(Math.random() * 4);
          match.home_score = home;
          match.away_score = away;
          if (home > away) match.result = 'W';
          else if (home < away) match.result = 'L';
          else {
            if (match.phase === 'GROUP') {
              match.result = 'D';
            } else {
              match.result = Math.random() > 0.5 ? 'W' : 'L';
            }
          }
          match.result_source = 'auto';
          match.result_updated_at = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000).toISOString();
        } else if (timeDiffMs >= 0) {
          // In Play (live)
          match.status = 'IN_PLAY';
          match.home_score = Math.floor(Math.random() * 2);
          match.away_score = Math.floor(Math.random() * 2);
          match.result = '';
          match.result_source = 'auto';
          match.result_updated_at = anchorDate.toISOString();
        } else {
          // Scheduled
          match.status = 'SCHEDULED';
          match.home_score = '';
          match.away_score = '';
          match.result = '';
          match.result_source = 'auto';
          match.result_updated_at = '';
        }
        return match;
      });
      this._setMockStorage('Matches', mockMatches);
    }

    // 2. Tạo danh sách User giả lập
    if (!this._getMockStorage('Users')) {
      const mockUsers = auth.MOCK_USERS.map(u => ({
        ...u,
        joined_at: new Date().toISOString()
      }));
      this._setMockStorage('Users', mockUsers);
    }

    // 3. Tạo một số dự đoán có sẵn để Leaderboard sinh động
    if (!this._getMockStorage('Predictions')) {
      const mockPredictions = [
        // Trận 1 (kết quả L)
        { prediction_id: 'p1', user_id: 'mock_admin_1', match_id: '1', prediction: 'L', submitted_at: new Date().toISOString() }, // đúng
        { prediction_id: 'p2', user_id: 'mock_user_2', match_id: '1', prediction: 'W', submitted_at: new Date().toISOString() }, // sai
        { prediction_id: 'p3', user_id: 'mock_user_3', match_id: '1', prediction: 'L', submitted_at: new Date().toISOString() }, // đúng

        // Trận 2 (kết quả W)
        { prediction_id: 'p4', user_id: 'mock_admin_1', match_id: '2', prediction: 'W', submitted_at: new Date().toISOString() }, // đúng
        { prediction_id: 'p5', user_id: 'mock_user_2', match_id: '2', prediction: 'W', submitted_at: new Date().toISOString() }, // đúng
        { prediction_id: 'p6', user_id: 'mock_user_3', match_id: '2', prediction: 'D', submitted_at: new Date().toISOString() }, // sai

        // Trận 3 (kết quả L)
        { prediction_id: 'p7', user_id: 'mock_admin_1', match_id: '3', prediction: 'D', submitted_at: new Date().toISOString() }, // sai
        { prediction_id: 'p8', user_id: 'mock_user_2', match_id: '3', prediction: 'L', submitted_at: new Date().toISOString() }, // đúng
        { prediction_id: 'p9', user_id: 'mock_user_3', match_id: '3', prediction: 'L', submitted_at: new Date().toISOString() }, // đúng

        // Trận 5 (sắp đá)
        { prediction_id: 'p10', user_id: 'mock_user_2', match_id: '5', prediction: 'W', submitted_at: new Date().toISOString() },
        { prediction_id: 'p11', user_id: 'mock_user_3', match_id: '5', prediction: 'W', submitted_at: new Date().toISOString() }
      ];
      this._setMockStorage('Predictions', mockPredictions);
    }
  },

  // --- API đọc/ghi chung (Tự động rẽ nhánh Mock / Real Sheets API) ---

  async _fetchSheetsAPI(range, method = 'GET', body = null) {
    const user = auth.getCurrentUser();
    if (!user || !user.token) throw new Error('Yêu cầu đăng nhập để ghi dữ liệu.');

    this._assertWriteAllowed(range, method);

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${range}`;
    const headers = {
      ...auth.getAuthHeader(),
      'Content-Type': 'application/json'
    };

    let fullUrl = url;
    const options = { method, headers };

    if (method === 'GET') {
      // no body
    } else if (method === 'PUT') {
      fullUrl += '?valueInputOption=USER_ENTERED';
      options.body = JSON.stringify(body);
    } else if (method === 'POST') {
      fullUrl += ':append?valueInputOption=USER_ENTERED';
      options.body = JSON.stringify(body);
    }

    const response = await fetch(fullUrl, options);
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Google Sheets API Error: ${err.error?.message || response.statusText}`);
    }
    return await response.json();
  },

  // 1. Quản lý Users
  async getUsers() {
    if (CONFIG.USE_MOCK_DATA) {
      return this._getMockStorage('Users') || [];
    }

    try {
      const data = await this._fetchSheetsAPI('Users!A2:F');
      if (!data.values) return [];
      return data.values.map(row => ({
        google_id: row[0],
        email: row[1],
        name: row[2],
        avatar_url: row[3],
        is_admin: String(row[4]).toUpperCase() === 'TRUE' || row[4] === true,
        joined_at: row[5]
      }));
    } catch (e) {
      console.error('Lỗi khi tải Users:', e);
      return [];
    }
  },

  async registerUser(user) {
    if (CONFIG.USE_MOCK_DATA) {
      let users = this._getMockStorage('Users') || [];
      const index = users.findIndex(u => u.google_id === user.google_id);
      
      let finalUser;
      if (index !== -1) {
        // Cập nhật thông tin cũ nhưng giữ nguyên quyền admin
        users[index] = { ...users[index], name: user.name, avatar_url: user.avatar_url };
        finalUser = users[index];
      } else {
        // Đăng ký mới, mặc định admin là FALSE trừ phi là mock_admin_1
        const is_admin = user.google_id === 'mock_admin_1' || user.is_admin === true;
        finalUser = {
          google_id: user.google_id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url,
          is_admin: is_admin,
          joined_at: user.joined_at || new Date().toISOString()
        };
        users.push(finalUser);
      }
      this._setMockStorage('Users', users);
      return finalUser;
    }

    try {
      const users = await this.getUsers();
      const existing = users.find(u => u.google_id === user.google_id);
      if (existing) {
        return existing; // User đã tồn tại
      }

      // Thêm dòng mới vào Google Sheet:Users
      const newRow = [
        user.google_id,
        user.email,
        user.name,
        user.avatar_url,
        user.google_id === 'mock_admin_1' ? 'TRUE' : 'FALSE', // Quy tắc phân quyền ban đầu
        new Date().toISOString()
      ];

      await this._fetchSheetsAPI('Users!A:F', 'POST', {
        values: [newRow]
      });

      return {
        ...user,
        is_admin: user.google_id === 'mock_admin_1',
        joined_at: newRow[5]
      };
    } catch (e) {
      console.error('Lỗi registerUser:', e);
      return user; // Trả về thông tin thô nếu API lỗi
    }
  },

  // 2. Quản lý Matches
  async getMatches() {
    if (CONFIG.USE_MOCK_DATA) {
      return this._getMockStorage('Matches') || [];
    }

    try {
      const data = await this._fetchSheetsAPI('Matches!A2:L');
      if (!data.values) return [];
      return data.values.map(row => ({
        match_id: row[0],
        home_team: row[1],
        away_team: row[2],
        kickoff_time: row[3],
        phase: row[4],
        competition: row[5],
        status: row[6],
        result: row[7] || '',
        result_source: row[8] || 'auto',
        result_updated_at: row[9] || '',
        home_score: row[10] !== undefined ? row[10] : '',
        away_score: row[11] !== undefined ? row[11] : ''
      }));
    } catch (e) {
      console.error('Lỗi khi tải Matches:', e);
      return [];
    }
  },

  async upsertMatch(match) {
    if (CONFIG.USE_MOCK_DATA) {
      let matches = this._getMockStorage('Matches') || [];
      const index = matches.findIndex(m => m.match_id === match.match_id);
      
      if (index !== -1) {
        // Giữ lại kết quả thủ công nếu đã được admin ghi đè
        if (matches[index].result_source === 'manual' && match.result_source !== 'manual') {
          // Bỏ qua cập nhật kết quả từ API tự động
          matches[index] = {
            ...matches[index],
            status: match.status,
            kickoff_time: match.kickoff_time
          };
        } else {
          matches[index] = { ...matches[index], ...match };
        }
      } else {
        matches.push(match);
      }
      this._setMockStorage('Matches', matches);
      return;
    }

    try {
      const matches = await this.getMatches();
      const index = matches.findIndex(m => m.match_id === match.match_id);

      const rowData = [
        match.match_id,
        match.home_team,
        match.away_team,
        match.kickoff_time,
        match.phase,
        match.competition,
        match.status,
        match.result,
        match.result_source,
        match.result_updated_at || new Date().toISOString(),
        match.home_score !== undefined ? match.home_score : '',
        match.away_score !== undefined ? match.away_score : ''
      ];

      if (index !== -1) {
        // Cập nhật dòng hiện có
        // Chỉ số dòng là index + 2 (do dòng tiêu đề là 1 và 0-indexed trong JS)
        const rowNum = index + 2;
        await this._fetchSheetsAPI(`Matches!A${rowNum}:L${rowNum}`, 'PUT', {
          values: [rowData]
        });
      } else {
        // Append dòng mới
        await this._fetchSheetsAPI('Matches!A:L', 'POST', {
          values: [rowData]
        });
      }
    } catch (e) {
      console.error('Lỗi upsertMatch:', e);
    }
  },

  // 3. Quản lý Predictions
  async getPredictions(userId = null) {
    if (CONFIG.USE_MOCK_DATA) {
      const preds = this._getMockStorage('Predictions') || [];
      return userId ? preds.filter(p => p.user_id === userId) : preds;
    }

    try {
      const data = await this._fetchSheetsAPI('Predictions!A2:E');
      if (!data.values) return [];
      const allPreds = data.values.map(row => ({
        prediction_id: row[0],
        user_id: row[1],
        match_id: row[2],
        prediction: row[3],
        submitted_at: row[4]
      }));
      return userId ? allPreds.filter(p => p.user_id === userId) : allPreds;
    } catch (e) {
      console.error('Lỗi khi tải Predictions:', e);
      return [];
    }
  },

  async savePrediction(userId, matchId, predictionVal) {
    if (CONFIG.USE_MOCK_DATA) {
      let preds = this._getMockStorage('Predictions') || [];
      const index = preds.findIndex(p => p.user_id === userId && p.match_id === matchId);
      
      if (index !== -1) {
        preds[index].prediction = predictionVal;
        preds[index].submitted_at = new Date().toISOString();
      } else {
        preds.push({
          prediction_id: 'pred_' + Math.random().toString(36).substr(2, 9),
          user_id: userId,
          match_id: matchId,
          prediction: predictionVal,
          submitted_at: new Date().toISOString()
        });
      }
      this._setMockStorage('Predictions', preds);
      return true;
    }

    try {
      const allPreds = await this.getPredictions();
      const index = allPreds.findIndex(p => p.user_id === userId && p.match_id === matchId);

      const predictionId = index !== -1 ? allPreds[index].prediction_id : 'pred_' + Math.random().toString(36).substr(2, 9);
      const rowData = [
        predictionId,
        userId,
        matchId,
        predictionVal,
        new Date().toISOString()
      ];

      if (index !== -1) {
        // Cập nhật
        const rowNum = index + 2;
        await this._fetchSheetsAPI(`Predictions!A${rowNum}:E${rowNum}`, 'PUT', {
          values: [rowData]
        });
      } else {
        // Thêm mới
        await this._fetchSheetsAPI('Predictions!A:E', 'POST', {
          values: [rowData]
        });
      }
      return true;
    } catch (e) {
      console.error('Lỗi savePrediction:', e);
      alert('Không thể lưu bình chọn lên Google Sheet: ' + e.message);
      return false;
    }
  },

  async savePredictionsBatch(userId, predictionsMap) {
    if (CONFIG.USE_MOCK_DATA) {
      let preds = this._getMockStorage('Predictions') || [];
      for (const [matchId, predictionVal] of Object.entries(predictionsMap)) {
        const index = preds.findIndex(p => p.user_id === userId && p.match_id === matchId);
        if (index !== -1) {
          preds[index].prediction = predictionVal;
          preds[index].submitted_at = new Date().toISOString();
        } else {
          preds.push({
            prediction_id: 'pred_' + Math.random().toString(36).substr(2, 9),
            user_id: userId,
            match_id: matchId,
            prediction: predictionVal,
            submitted_at: new Date().toISOString()
          });
        }
      }
      this._setMockStorage('Predictions', preds);
      return true;
    }

    try {
      const allPreds = await this.getPredictions();
      const updates = [];
      const appends = [];

      for (const [matchId, predictionVal] of Object.entries(predictionsMap)) {
        const index = allPreds.findIndex(p => p.user_id === userId && p.match_id === matchId);
        if (index !== -1) {
          const predictionId = allPreds[index].prediction_id;
          const rowNum = index + 2;
          const rowData = [predictionId, userId, matchId, predictionVal, new Date().toISOString()];
          updates.push({
            range: `Predictions!A${rowNum}:E${rowNum}`,
            values: [rowData]
          });
        } else {
          const predictionId = 'pred_' + Math.random().toString(36).substr(2, 9);
          const rowData = [predictionId, userId, matchId, predictionVal, new Date().toISOString()];
          appends.push(rowData);
        }
      }

      if (updates.length > 0) {
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values:batchUpdate`;
        const body = {
          valueInputOption: 'USER_ENTERED',
          data: updates
        };
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...auth.getAuthHeader(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error('Lỗi cập nhật batch dự đoán');
      }

      if (appends.length > 0) {
        await this._fetchSheetsAPI('Predictions!A:E', 'POST', {
          values: appends
        });
      }

      return true;
    } catch (e) {
      console.error('Lỗi savePredictionsBatch:', e);
      alert('Không thể lưu loạt bình chọn lên Google Sheet: ' + e.message);
      return false;
    }
  },

  // 4. Quản lý Leaderboard_Cache
  async getLeaderboardCache() {
    if (CONFIG.USE_MOCK_DATA) {
      return this._getMockStorage('Leaderboard_Cache') || [];
    }

    try {
      const data = await this._fetchSheetsAPI('Leaderboard_Cache!A2:G');
      if (!data.values) return [];
      return data.values.map(row => ({
        user_id: row[0],
        name: row[1],
        total_score: Number(row[2]),
        correct: Number(row[3]),
        wrong: Number(row[4]),
        pending: Number(row[5]),
        last_updated: row[6]
      }));
    } catch (e) {
      console.error('Lỗi khi tải Leaderboard_Cache:', e);
      return [];
    }
  },

  async saveLeaderboardCache(cacheArray) {
    if (CONFIG.USE_MOCK_DATA) {
      this._setMockStorage('Leaderboard_Cache', cacheArray);
      return;
    }

    try {
      // Xóa và ghi đè toàn bộ bảng Leaderboard_Cache
      // Format dữ liệu theo hàng
      const rows = cacheArray.map(item => [
        item.user_id,
        item.name,
        item.total_score,
        item.correct,
        item.wrong,
        item.pending,
        item.last_updated || new Date().toISOString()
      ]);

      // Bước 1: Clear dữ liệu cũ
      // (Google Sheets API v4 không có hàm clear trực tiếp dễ dàng bằng 1 request mà không cấp quyền ghi đè,
      // vì thế chúng ta sẽ ghi đè đè dải dữ liệu đủ lớn A2:G100)
      const emptyRow = ['', '', '', '', '', '', ''];
      const clearData = Array(100).fill(emptyRow);
      await this._fetchSheetsAPI('Leaderboard_Cache!A2:G101', 'PUT', {
        values: clearData
      });

      // Bước 2: Ghi dữ liệu mới vào
      if (rows.length > 0) {
        await this._fetchSheetsAPI('Leaderboard_Cache!A2:G' + (rows.length + 1), 'PUT', {
          values: rows
        });
      }
    } catch (e) {
      console.error('Lỗi khi cập nhật Leaderboard_Cache:', e);
    }
  }
};

// Tự động khởi chạy thiết lập DB mock khi tải file
sheets.initDB();
