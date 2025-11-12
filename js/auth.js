// 等待Supabase可用的函数
function getSupabase() {
    if (typeof window.supabase === 'undefined') {
        throw new Error('Supabase未初始化，请刷新页面重试');
    }
    return window.supabase;
}

// 认证功能
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        try {
            // 获取supabase实例
            const supabase = getSupabase();
            
            // 检查当前登录状态
            const { data: { session } } = await supabase.auth.getSession();
            this.currentUser = session?.user || null;
            this.updateUI();
            
            // 监听认证状态变化
            supabase.auth.onAuthStateChange((event, session) => {
                this.currentUser = session?.user || null;
                this.updateUI();
                
                if (event === 'SIGNED_IN') {
                    this.closeAuthModal();
                    window.location.reload();
                }
            });
        } catch (error) {
            console.error('AuthManager初始化失败:', error);
            // 显示错误信息给用户
            this.showGlobalError('系统初始化失败，请刷新页面');
        }
    }

    async login(email, password) {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw new Error(error.message);
        return data;
    }

    async signup(email, password, username) {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (error) throw new Error(error.message);
        return data;
    }

    async logout() {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('退出登录错误:', error);
        }
        window.location.reload();
    }

    showGlobalError(message) {
        // 在页面顶部显示错误消息
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #ef4444;
            color: white;
            padding: 1rem;
            text-align: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    // 其他方法保持不变...
    updateUI() {
        const authSection = document.getElementById('auth-section');
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
}

// 初始化认证管理器
const authManager = new AuthManager();

// 事件监听器
document.addEventListener('DOMContentLoaded', function() {
    // 登录按钮
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            authManager.openAuthModal('login');
        });
    }

    // 注册按钮
    const signupBtn = document.getElementById('signup-btn');
    if (signupBtn) {
        signupBtn.addEventListener('click', () => {
            authManager.openAuthModal('signup');
        });
    }

    // 退出按钮
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            authManager.logout();
        });
    }

    // 登录表单
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                await authManager.login(email, password);
            } catch (error) {
                authManager.showAuthError(error.message);
            }
        });
    }

    // 注册表单
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const username = document.getElementById('signup-username').value;

            try {
                await authManager.signup(email, password, username);
                authManager.showAuthError('注册成功！请检查您的邮箱确认账户。');
            } catch (error) {
                authManager.showAuthError(error.message);
            }
        });
    }

    // 关闭模态框
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            authManager.closeAuthModal();
            
            const editModal = document.getElementById('edit-profile-modal');
            if (editModal) {
                editModal.classList.add('hidden');
            }
        });
    });

    // 点击模态框外部关闭
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                authManager.closeAuthModal();
                
                const editModal = document.getElementById('edit-profile-modal');
                if (editModal && e.target === editModal) {
                    editModal.classList.add('hidden');
                }
            }
        });
    });

    // 切换认证标签页
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.getAttribute('data-tab');
            authManager.switchAuthTab(tab);
        });
    });
});