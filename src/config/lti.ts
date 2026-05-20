import { Provider } from "ltijs";
import dotenv from "dotenv";

dotenv.config();

// MoodleCloud biasanya butuh opsi spesifik, dan kita pakai MongoDB untuk nyimpen token
export const ltiProvider = Provider.setup(
  process.env.JWT_SECRET || "SUPER_SECRET_LTI_KEY", // Kunci enkripsi token internal LTIJS
  {
    url: process.env.LTI_DB_URL || "mongodb://localhost/wordit-lti", // MongoDB URL
  },
  {
    // LTI Options
    appRoute: "/lti/launch",          // Endpoint yang ditembak Moodle pertama kali
    loginRoute: "/lti/login",         // OIDC Login Route
    keysetRoute: "/lti/keys",         // Public JWK Route
    dynRegRoute: "/lti/register",     // Dynamic Registration (opsional)
    
    // Cookie Config (karena pakai ngrok/https beda domain)
    cookies: {
      secure: true,
      sameSite: "None",
    },
    
    // CORS untuk iframe Moodle
    cors: false, // Matikan cors internal ltijs agar tidak bentrok dengan cors express
  }
);

// Jalankan ketika siswa berhasil masuk via LTI
ltiProvider.onConnect(async (token: any, req: any, res: any) => {
  console.log("🚀 LTI Launch Berhasil!", token.userInfo);

  // 1. Dapatkan data Moodle
  const { email, name } = token.userInfo;
  const contextId = token.platformContext?.context?.id || "NO_CLASS";

  // 2. Redirect ke Frontend (disertakan token sso LTI-nya)
  // Ngrok Frontend URL harus disesuaikan nanti. Sementara pakai localhost:5173
  const frontendUrl = "http://localhost:5173/lti-launch";
  
  // Melempar token ltik (LTI Key) agar Frontend WordIT bisa ngirim nilai balikan nanti
  const redirectUrl = `${frontendUrl}?token=${res.locals.ltik}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&class=${contextId}`;
  
  return res.redirect(redirectUrl);
});
