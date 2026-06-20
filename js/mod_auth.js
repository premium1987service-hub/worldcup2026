// js/mod_auth.js
// Quản lý đăng nhập Google, session và phân quyền người dùng

const auth = {
  _sessionKey: 'football_predict_session',
  _currentUser: null,
  _gisLoaded: false,

  // Danh sách user mock để dễ dàng test các phân quyền và xem giao diện khác nhau
  MOCK_USERS: [
    { google_id: 'mock_admin_1', email: 'an.admin@gmail.com', name: 'Nguyễn Văn An (Admin)', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=An', is_admin: true },
    { google_id: 'mock_user_2', email: 'binh.user@gmail.com', name: 'Trần Thị Bình', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Binh', is_admin: false },
    { google_id: 'mock_user_3', email: 'chi.user@gmail.com', name: 'Lê Hoàng Chi', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Chi', is_admin: false },
    { google_id: 'mock_user_4', email: 'dung.user@gmail.com', name: 'Phạm Anh Dũng', avatar_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Dung', is_admin: false }
  ],

  // Khởi tạo Auth
  async init() {
    // Phục hồi session từ localStorage
    const stored = localStorage.getItem(this._sessionKey);
    if (stored) {
      try {
        this._currentUser = JSON.parse(stored);
      } catch (e) {
        console.error('Lỗi parse session:', e);
        localStorage.removeItem(this._sessionKey);
      }
    }

    if (CONFIG.USE_MOCK_DATA) {
      console.log('Auth: Đang chạy ở chế độ MOCK');
      this._gisLoaded = true;
      return;
    }

    // Load thư viện GIS của Google
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this._gisLoaded = true;
        resolve();
      };
      document.head.appendChild(script);
    });
  },

  // Thực hiện đăng nhập
  login(callback) {
    if (CONFIG.USE_MOCK_DATA) {
      // Ở chế độ mock, tự động login với user đầu tiên (Admin) hoặc hiển thị UI chọn user
      this._loginAsMockUser(this.MOCK_USERS[0]);
      if (callback) callback(this._currentUser);
      return;
    }

    if (!this._gisLoaded) {
      alert('Thư viện đăng nhập Google đang tải, vui lòng thử lại sau vài giây!');
      return;
    }

    // Cấu hình Google Identity Services client-side flow
    try {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CONFIG.GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        callback: async (tokenResponse) => {
          if (tokenResponse.error !== undefined) {
            console.error('Lỗi OAuth:', tokenResponse);
            return;
          }
          
          // Đăng nhập thành công, lấy thông tin profile
          const userInfo = await this._fetchGoogleUserProfile(tokenResponse.access_token);
          if (userInfo) {
            // Check & Upsert user vào Sheet thông qua mod_sheets
            const appUser = await sheets.registerUser({
              google_id: userInfo.sub,
              email: userInfo.email,
              name: userInfo.name,
              avatar_url: userInfo.picture,
              token: tokenResponse.access_token,
              token_expiry: Date.now() + (tokenResponse.expires_in * 1000)
            });

            this._currentUser = appUser;
            localStorage.setItem(this._sessionKey, JSON.stringify(appUser));
            
            if (callback) callback(appUser);
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      console.error('Lỗi khởi tạo đăng nhập Google:', e);
      alert('Không thể khởi tạo đăng nhập Google. Kiểm tra lại Client ID.');
    }
  },

  // Mock login chuyên biệt để chọn user kiểm thử
  _loginAsMockUser(mockUser) {
    const sessionUser = {
      ...mockUser,
      token: 'mock_access_token_123',
      token_expiry: Date.now() + 3600000,
      joined_at: new Date().toISOString()
    };
    this._currentUser = sessionUser;
    localStorage.setItem(this._sessionKey, JSON.stringify(sessionUser));
    
    // Đăng ký user mock này vào danh sách sheets mock
    sheets.registerUser(sessionUser);
    
    console.log(`Đăng nhập thành công dưới quyền Mock: ${sessionUser.name}`);
    window.location.reload();
  },

  // Lấy thông tin cá nhân từ Google Account API
  async _fetchGoogleUserProfile(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      return await response.json();
    } catch (e) {
      console.error('Lỗi fetch Google user profile:', e);
      return null;
    }
  },

  // Đăng xuất
  logout() {
    this._currentUser = null;
    localStorage.removeItem(this._sessionKey);
    // Nếu có token thật, có thể revoke tại đây
    window.location.reload();
  },

  // Lấy user hiện tại
  getCurrentUser() {
    return this._currentUser;
  },

  // Kiểm tra xem user hiện tại có phải admin
  async isAdmin() {
    if (!this._currentUser) return false;
    
    // Nếu mock, kiểm tra trực tiếp flag trong session
    if (CONFIG.USE_MOCK_DATA) {
      return !!this._currentUser.is_admin;
    }
    
    // Nếu thực tế, kiểm tra với dữ liệu trên Google Sheets để tránh người dùng tự sửa localStorage
    const users = await sheets.getUsers();
    const dbUser = users.find(u => 
      String(u.google_id) === String(this._currentUser.google_id) || 
      (u.email && this._currentUser.email && u.email.toLowerCase().trim() === this._currentUser.email.toLowerCase().trim())
    );
    return dbUser ? (dbUser.is_admin === true || String(dbUser.is_admin).trim().toUpperCase() === 'TRUE') : false;
  },

  // Guard: chuyển hướng nếu chưa đăng nhập
  requireLogin(redirectUrl = 'index.html') {
    if (!this._currentUser) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  },

  // Lấy Authorization Header cho HTTP requests
  getAuthHeader() {
    if (!this._currentUser || !this._currentUser.token) return {};
    return { Authorization: `Bearer ${this._currentUser.token}` };
  }
};
