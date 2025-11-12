// Supabase客户端配置
const SUPABASE_URL = 'https://wxoqyzdfkkmodigszrcy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind4b3F5emRma2ttb2RpZ3N6cmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5MzMwMDksImV4cCI6MjA3ODUwOTAwOX0.9BeyxJVxKsmJ18Uc_jyKTIwelXWvqYE4j1TZOC8zyNk';

// 创建Supabase客户端
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 导出供其他文件使用
window.supabase = supabase;