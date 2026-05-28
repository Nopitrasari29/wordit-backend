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
    appRoute: "/launch",          // Endpoint yang ditembak Moodle pertama kali
    loginRoute: "/login",         // OIDC Login Route
    keysetRoute: "/keys",         // Public JWK Route
    dynRegRoute: "/register",     // Dynamic Registration (opsional)
    
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

  // 2. Dapatkan gameId dari query, body, atau custom parameters LTI
  const gameId = req.query?.gameId || req.body?.gameId || token.platformContext?.custom?.gameId || token.platformContext?.custom?.gameid || "";

  // 3. Redirect ke Frontend (disertakan token sso LTI-nya)
  // Ngrok/Production Frontend URL dibaca dari env, fallback ke localhost:5173
  const frontendUrl = process.env.FRONTEND_URL 
    ? `${process.env.FRONTEND_URL.replace(/\/$/, "")}/lti-launch`
    : "http://localhost:5173/lti-launch";
  
  // Melempar token ltik (LTI Key) agar Frontend WordIT bisa ngirim nilai balikan nanti
  const redirectUrl = `${frontendUrl}?token=${res.locals.ltik}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&class=${contextId}&gameId=${gameId}`;
  
  return res.redirect(redirectUrl);
});

// Auto-register Moodle platform from environment variables
export const registerMoodlePlatform = async () => {
  const platformUrl = process.env.LTI_PLATFORM_URL;
  const clientId = process.env.LTI_CLIENT_ID;
  const authEndpoint = process.env.LTI_AUTH_ENDPOINT;
  const tokenEndpoint = process.env.LTI_TOKEN_ENDPOINT;
  const keysetEndpoint = process.env.LTI_KEYSET_ENDPOINT;

  if (!platformUrl || !clientId || !authEndpoint || !tokenEndpoint || !keysetEndpoint) {
    console.log("ℹ️ LTI Platform configuration variables not fully set. Skipping auto-registration.");
    return;
  }

  try {
    console.log("⏳ Checking if LTI platform is already registered...");
    const platform = await ltiProvider.getPlatform(platformUrl, clientId);
    if (platform) {
      console.log("✅ LTI platform already registered.");
      return;
    }
  } catch (error) {
    // Platform not found or error, proceed to register
  }

  try {
    console.log("⏳ Registering LTI platform in database...");
    await ltiProvider.registerPlatform({
      url: platformUrl,
      name: "Moodle LMS",
      clientId: clientId,
      authenticationEndpoint: authEndpoint,
      accesstokenEndpoint: tokenEndpoint,
      authConfig: {
        method: "JWK_SET",
        key: keysetEndpoint,
      },
    });
    console.log("✅ LTI platform registered successfully!");
  } catch (error) {
    console.error("❌ Failed to register LTI platform:", error);
  }
};

