// Public settings of the BoredBoard project. The anon key is meant to be
// public: what a signed-in user may write is enforced by Supabase's row-level
// security, not by keeping this key secret.
const BOREDBOARD_CONFIG = {
  // Where posts are published (/api/posts/music). An extension has no build
  // step, so it can't read NEXT_PUBLIC_SITE_URL: switch this to
  // "https://boredboard.vercel.app" once that route is deployed.
  appUrl: "http://localhost:3000",
  supabaseUrl: "https://lwuaalmsruoaasvuewnl.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dWFhbG1zcnVvYWFzdnVld25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODU3MDQsImV4cCI6MjEwNjQ2MTcwNH0.zAjcWV_875Yjg5WGOUJhY6l1QTmB4ftJLW1o2A2wJag",
};
