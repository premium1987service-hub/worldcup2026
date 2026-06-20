// js/mod_ui.js
// Các component UI dùng chung (Header, Footer, Toast thông báo, Hộp thoại chọn User ảo)

const ui = {
  // Tạo Header dùng chung trên các trang
  renderHeader() {
    const user = auth.getCurrentUser();
    const isAdmin = user && user.is_admin;
    
    // Xác định trang hiện tại để gán class active
    const path = window.location.pathname;
    const isIndex = path.endsWith('index.html') || path.endsWith('/') || path === '';
    const isPredict = path.includes('predict.html');
    const isLeaderboard = path.includes('leaderboard.html');
    const isAdminPage = path.includes('admin.html');

    const headerHTML = `
      <header class="main-header">
        <div class="container header-container">
          <a href="index.html" class="logo">
            <svg class="logo-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              <path d="M2 12h20" />
            </svg>
            <span class="logo-text">WORLD CUP <span class="accent-text">CHALLENGE</span></span>
          </a>
          
          <nav class="nav-menu">
            <a href="index.html" class="nav-link ${isIndex ? 'active' : ''}">Trang Chủ</a>
            <a href="predict.html" class="nav-link ${isPredict ? 'active' : ''}">Dự Đoán</a>
            <a href="leaderboard.html" class="nav-link ${isLeaderboard ? 'active' : ''}">Bảng Xếp Hạng</a>
            ${isAdmin ? `<a href="admin.html" class="nav-link ${isAdminPage ? 'active' : ''}">Admin Panel</a>` : ''}
          </nav>
          
          <div class="user-auth-zone" id="user-auth-zone">
            ${user ? `
              <div class="user-profile-menu">
                <img src="${user.avatar_url}" alt="avatar" class="user-avatar">
                <div class="user-info-dropdown">
                  <div class="user-info-name">${user.name}</div>
                  <div class="user-info-email">${user.email}</div>
                  ${user.is_admin ? '<span class="admin-badge">Admin</span>' : '<span class="player-badge">Người chơi</span>'}
                  <hr class="dropdown-divider">
                  <button id="logout-btn" class="dropdown-logout-btn">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg> Đăng xuất
                  </button>
                </div>
              </div>
            ` : `
              <button id="login-btn" class="login-btn-google">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" class="btn-icon">
                  <path d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 1 6.033 1 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.985 0-.74-.08-1.3-.176-1.865H12.24z"/>
                </svg> Đăng nhập Google
              </button>
            `}
          </div>
        </div>
      </header>

      <!-- Thanh điều hướng dưới chân cho Mobile (Bottom Navigation) -->
      <nav class="mobile-bottom-nav">
        <a href="index.html" class="mobile-nav-item ${isIndex ? 'active' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Trang chủ</span>
        </a>
        <a href="predict.html" class="mobile-nav-item ${isPredict ? 'active' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Dự đoán</span>
        </a>
        <a href="leaderboard.html" class="mobile-nav-item ${isLeaderboard ? 'active' : ''}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>BXH</span>
        </a>
        ${isAdmin ? `
          <a href="admin.html" class="mobile-nav-item ${isAdminPage ? 'active' : ''}">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Admin</span>
          </a>
        ` : ''}
      </nav>
    `;

    // Chèn header vào body
    const headerWrapper = document.getElementById('header-wrapper') || document.body;
    if (headerWrapper === document.body) {
      document.body.insertAdjacentHTML('afterbegin', headerHTML);
    } else {
      headerWrapper.innerHTML = headerHTML;
    }

    // Đăng ký sự kiện nút
    setTimeout(() => {
      const loginBtn = document.getElementById('login-btn');
      const logoutBtn = document.getElementById('logout-btn');

      if (loginBtn) {
        loginBtn.addEventListener('click', () => {
          auth.login(async (appUser) => {
            const isAdmin = await auth.isAdmin();
            if (isAdmin) {
              ui.showToast('Chào mừng Admin đăng nhập! Đang chuyển hướng...', 'success');
              setTimeout(() => {
                window.location.href = 'admin.html';
              }, 1000);
            } else {
              window.location.reload();
            }
          });
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          auth.logout();
        });
      }
    }, 100);
  },

  // Tạo Banner báo hiệu đang ở chế độ Demo Mock và bảng chọn user
  renderDemoWidget() {
    if (!CONFIG.USE_MOCK_DATA) return;

    const user = auth.getCurrentUser();
    const mockUsersOptions = auth.MOCK_USERS.map(u => {
      const isSelected = user && user.google_id === u.google_id;
      return `<option value="${u.google_id}" ${isSelected ? 'selected' : ''}>${u.name} (${u.is_admin ? 'Admin' : 'Player'})</option>`;
    }).join('');

    // Đọc trạng thái thu nhỏ từ localStorage
    const isCollapsed = localStorage.getItem('demo_widget_collapsed') === 'true';

    const widgetHTML = `
      <div class="demo-widget-overlay ${isCollapsed ? 'collapsed' : ''}" id="demo-widget-container">
        <div class="demo-widget">
          <div class="demo-widget-header" id="demo-widget-header-btn" style="cursor: pointer; display: flex; align-items: center; width: 100%;">
            <span class="pulse-dot"></span>
            <span class="demo-title">Chế độ Demo</span>
            <button id="demo-widget-toggle-btn" class="demo-collapse-btn" style="margin-left: auto; background: none; border: none; color: var(--primary); cursor: pointer; font-size: 1.2rem; font-weight: 700; padding: 0 4px; display: flex; align-items: center; justify-content: center;">
              ${isCollapsed ? '＋' : '－'}
            </button>
          </div>
          <div class="demo-widget-body">
            <p class="demo-desc">Giả lập bằng LocalStorage để test nhanh các tính năng mà không cần setup API.</p>
            <div class="demo-selector-group">
              <label for="mock-user-select">Đóng vai User:</label>
              <select id="mock-user-select" class="demo-select">
                <option value="" ${!user ? 'selected' : ''}>-- Chưa đăng nhập --</option>
                ${mockUsersOptions}
              </select>
            </div>
            <div class="demo-actions">
              <button id="demo-reset-db" class="demo-reset-btn" title="Khôi phục lại dữ liệu ban đầu">Reset Data</button>
              <span class="demo-footer">Sửa config.js để tắt Mock</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', widgetHTML);

    // Xử lý sự kiện thu nhỏ / phóng to widget
    setTimeout(() => {
      const headerBtn = document.getElementById('demo-widget-header-btn');
      const container = document.getElementById('demo-widget-container');
      const toggleBtn = document.getElementById('demo-widget-toggle-btn');

      if (headerBtn && container && toggleBtn) {
        headerBtn.addEventListener('click', (e) => {
          // Tránh click dropdown select trúng header trigger
          if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION' || e.target.id === 'demo-reset-db') {
            return;
          }
          
          const collapsed = container.classList.toggle('collapsed');
          localStorage.setItem('demo_widget_collapsed', collapsed);
          toggleBtn.textContent = collapsed ? '＋' : '－';
        });
      }

      const select = document.getElementById('mock-user-select');
      if (select) {
        select.addEventListener('change', (e) => {
          const val = e.target.value;
          if (!val) {
            auth.logout();
          } else {
            const selectedUser = auth.MOCK_USERS.find(u => u.google_id === val);
            if (selectedUser) {
              auth._loginAsMockUser(selectedUser);
            }
          }
        });
      }

      const resetBtn = document.getElementById('demo-reset-db');
      if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Ngăn sự kiện click lan ra ngoài làm đóng/mở widget
          if (confirm('Bạn có chắc chắn muốn Reset dữ liệu mock về ban đầu? Mọi bình chọn và điểm số đã lưu sẽ bị xóa.')) {
            localStorage.removeItem('football_predict_mock_Matches');
            localStorage.removeItem('football_predict_mock_Users');
            localStorage.removeItem('football_predict_mock_Predictions');
            localStorage.removeItem('football_predict_mock_Leaderboard_Cache');
            localStorage.removeItem('football_predict_session');
            alert('Đã reset dữ liệu thành công! Trang web sẽ tự động tải lại.');
            window.location.reload();
          }
        });
      }
    }, 100);
  },

  // Tạo Footer dùng chung
  renderFooter() {
    const footerHTML = `
      <footer class="main-footer">
        <div class="container footer-container">
          <p class="copyright">&copy; 2026 World Cup Challenge - Thiết kế dựa trên Work Plan.</p>
          <div class="footer-links">
            <span class="footer-badge">Chạy bằng Client-Side JS</span>
            <span class="footer-badge">Google Sheets DB</span>
          </div>
        </div>
      </footer>
    `;

    const footerWrapper = document.getElementById('footer-wrapper') || document.body;
    if (footerWrapper === document.body) {
      document.body.insertAdjacentHTML('beforeend', footerHTML);
    } else {
      footerWrapper.innerHTML = footerHTML;
    }
  },

  // Toast thông báo nổi góc màn hình
  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast-container');
    if (existing) existing.remove();

    const toastHTML = `
      <div class="toast-container ${type}">
        <div class="toast-content">
          <svg class="toast-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success' ? 
              '<polyline points="20 6 9 17 4 12" />' : 
              '<circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />'
            }
          </svg>
          <span class="toast-message">${message}</span>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', toastHTML);
    const toast = document.querySelector('.toast-container');

    // Slide in
    setTimeout(() => {
      if (toast) toast.classList.add('show');
    }, 50);

    // Auto-remove sau 3.5 giây
    setTimeout(() => {
      if (toast) {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
      }
    }, 3500);
  },

  // Lấy URL hình ảnh cờ quốc gia từ FlagCDN
  getTeamFlagUrl(teamName) {
    if (!teamName) return '';
    const name = teamName.toLowerCase().trim();
    const flagMap = {
      'qatar': 'qa',
      'ecuador': 'ec',
      'anh': 'gb',
      'england': 'gb',
      'iran': 'ir',
      'senegal': 'sn',
      'hà lan': 'nl',
      'netherlands': 'nl',
      'mỹ': 'us',
      'usa': 'us',
      'united states': 'us',
      'xứ wales': 'gb-wls',
      'wales': 'gb-wls',
      'argentina': 'ar',
      'saudi arabia': 'sa',
      'đan mạch': 'dk',
      'denmark': 'dk',
      'tunisia': 'tn',
      'pháp': 'fr',
      'france': 'fr',
      'úc': 'au',
      'australia': 'au',
      'brazil': 'br',
      'tây ban nha': 'es',
      'spain': 'es',
      'nhật bản': 'jp',
      'japan': 'jp',
      'hàn quốc': 'kr',
      'south korea': 'kr',
      'đức': 'de',
      'germany': 'de',
      'bỉ': 'be',
      'belgium': 'be',
      'bồ đào nha': 'pt',
      'portugal': 'pt',
      'croatia': 'hr',
      'ma-rốc': 'ma',
      'morocco': 'ma',
      'thụy sĩ': 'ch',
      'switzerland': 'ch',
      'cameroon': 'cm',
      'ghana': 'gh',
      'uruguay': 'uy',
      'canada': 'ca',
      'ba lan': 'pl',
      'poland': 'pl',
      'mexico': 'mx',
      'saudi': 'sa',
      'sweden': 'se',
      'curacao': 'cw',
      'curaçao': 'cw',
      'paraguay': 'py',
      'cape verde': 'cv',
      'egypt': 'eg',
      'czechia': 'cz',
      'czech republic': 'cz',
      'south africa': 'za',
      'bosnia and herzegovina': 'ba',
      'bosnia': 'ba',
      'scotland': 'gb-sct',
      'haiti': 'ht',
      'türkiye': 'tr',
      'turkey': 'tr',
      'ivory coast': 'ci',
      'new zealand': 'nz'
    };

    const code = flagMap[name] || '';
    if (code) {
      return `https://flagcdn.com/w80/${code}.png`;
    }
    return '';
  },

  // Helper render ảnh cờ hoặc text đại diện nếu không tìm thấy
  renderFlag(teamName) {
    const flagUrl = this.getTeamFlagUrl(teamName);
    if (flagUrl) {
      return `<img src="${flagUrl}" alt="${teamName}" class="team-flag-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="team-flag-placeholder" style="display:none;">${teamName.substring(0, 2).toUpperCase()}</div>`;
    }
    const text = teamName ? teamName.substring(0, 2).toUpperCase() : '??';
    return `<div class="team-flag-placeholder">${text}</div>`;
  },

  // Khởi tạo hiển thị trang toàn bộ
  initPage() {
    this.renderHeader();
    this.renderFooter();
    this.renderDemoWidget();
  }
};
