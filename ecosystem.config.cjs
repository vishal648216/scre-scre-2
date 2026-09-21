module.exports = {
  apps: [
    {
      name: "scre-backend",
      cwd: "./backend",
      script: "./target/debug/backend",
      env: {
        NODE_ENV: "production",
        PORT: "3008",
        MONGODB_URI: "mongodb+srv://screduc_db_user:Akshay1238@cluster0.bmddety.mongodb.net/scre_db?retryWrites=true&w=majority&appName=Cluster0",
        DATABASE_NAME: "scre_db",
        JWT_SECRET: "default_secret_key_change_me",
        UPLOAD_DIR: "/var/www/html/scre/uploads",
        SMTP_HOST: "smtp.hostinger.com",
        SMTP_PORT: "465",
        SMTP_USER: "info@screduc.com",
        SMTP_PASS: "your_smtp_password_here"
      },
    },
    {
      name: "scre-frontend",
      script: "npx",
      args: "vite preview --port 8085 --host 127.0.0.1",
      cwd: "/var/www/html/scre",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
