// 简化的认证管理器
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            // 等待Supabase就绪
            await this.waitForSupabase();
            
            const { data: { session } } = await window.supabase.auth.getSession();
            this.currentUser = session?.user || null;
            this.updateUI();
            
            window.supabase.auth.onAuthStateChange((event, session) => {
                this.currentUser = session?.user || null;
                this.updateUI();
                
                if (event === 'SIGNED_IN') {
                    this.closeAuthModal();
                    setTimeout(() => window.location.reload(), 1000);
                }
            });
        } catch (error) {
            console.error('AuthManager初始化失败:', error);
        }
    }

    // 等待Supabase就绪
    waitForSupabase() {
        return new Promise((resolve) => {
            const check = () => {
                if (window.supabase && window.supabase.auth) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async login(email, password) {
        await this.waitForSupabase();
        
        const { data, error } = await window.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw new Error(error.message);
        return data;
    }

    async signup(email, password, username) {
        await this.waitForSupabase();
        
        const { data, error } = await window.supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) throw new Error(error.message);
        
        if (data.user) {
            this.showAuthSuccess('注册成功！请检查您的邮箱确认账户。');
        }
        
        return data;
    }

    async logout() {
        await this.waitForSupabase();
        
        const { error } = await window.supabase.auth.signOut();
        if (error) {
            console.error('退出登录错误:', error);
        }
        window.location.reload();
    }

    updateUI() {
        const loginBtn = document.getElementById('login-btn');
        const signupBtn = document.getElementById('signup-btn');
        const userMenu = document.getElementById('user-menu');
        const userEmail = document.getElementById('user-email');

        if (this.currentUser) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (signupBtn) signupBtn.style.display = 'none';
            if (userMenu) userMenu.classList.remove('hidden');
            if (userEmail) userEmail.textContent = this.currentUser.email;
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-block';
            if (signupBtn) signupBtn.style.display = 'inline-block';
            if (userMenu) userMenu.classList.add('hidden');
        }
    }

    openAuthModal(tab = 'login') {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.switchAuthTab(tab);
        }
    }

    closeAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.add('hidden');
            this.clearAuthForms();
        }
    }

    switchAuthTab(tab) {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const loginTab = document.querySelector('[data-tab="login"]');
        const signupTab = document.querySelector('[data-tab="signup"]');

        if (tab === 'login') {
            if (loginForm) loginForm.classList.remove('hidden');
            if (signupForm) signupForm.classList.add('hidden');
            if (loginTab) loginTab.classList.add('active');
            if (signupTab) signupTab.classList.remove('active');
        } else {
            if (loginForm) loginForm.classList.add('hidden');
            if (signupForm) signupForm.classList.remove('hidden');
            if (loginTab) loginTab.classList.remove('active');
            if (signupTab) signupTab.classList.add('active');
        }
    }

    clearAuthForms() {
        const loginForm = document.getElementById('login-form');
        const signupForm = document.getElementById('signup-form');
        const errorDiv = document.getElementById('auth-error');

        if (loginForm) loginForm.reset();
        if (signupForm) signupForm.reset();
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
        }
    }

    showAuthError(message) {
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
        }
    }

    showAuthSuccess(message) {
        const errorDiv = document.getElementById('auth-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.color = 'green';
            errorDiv.classList.remove('hidden');
        }
    }
}

// 初始化认证管理器
document.addEventListener('DOMContentLoaded', function() {
    window.authManager = new AuthManager();
    
    // 设置事件监听器
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            window.authManager.openAuthModal('login');
        });
    }

    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            window.authManager.openAuthModal('signup');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.authManager.logout();
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                await window.authManager.login(email, password);
                window.authManager.showAuthSuccess('登录成功！');
            } catch (error) {
                window.authManager.showAuthError(error.message);
            }
        });
    }

    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const username = document.getElementById('signup-username').value;

            try {
                await window.authManager.signup(email, password, username);
            } catch (error) {
                window.authManager.showAuthError(error.message);
            }
        });
    }

    // 关闭模态框
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            window.authManager.closeAuthModal();
        });
    });

    // 点击模态框外部关闭
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                window.authManager.closeAuthModal();
            }
        });
    });

    // 切换认证标签页
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.getAttribute('data-tab');
            window.authManager.switchAuthTab(tab);
        });
    });
});