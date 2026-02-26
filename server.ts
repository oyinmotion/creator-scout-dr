import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { stringify } from "csv-stringify/sync";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// API Routes
app.get("/api/creators", async (req, res) => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .order("created_at", { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/creators", async (req, res) => {
  const { keyword, platform, results } = req.body;
  
  const itemsToInsert = results.map((item: any) => ({
    keyword,
    platform,
    name: item.name,
    url: item.url,
    email: item.email,
    description: item.description,
    followers: item.followers || "N/A",
    engagement: item.engagement || "N/A",
    last_content_date: item.last_content_date || "N/A"
  }));

  const { error } = await supabase
    .from("creators")
    .insert(itemsToInsert);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete("/api/creators", async (req, res) => {
  const { error } = await supabase
    .from("creators")
    .delete()
    .neq("id", 0); // Delete all rows
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/export", async (req, res) => {
  const { data, error } = await supabase
    .from("creators")
    .select("platform, name, url, email, followers, engagement, last_content_date, keyword, description");

  if (error) return res.status(500).json({ error: error.message });

  const csv = stringify(data, {
    header: true,
    columns: ["platform", "name", "url", "email", "followers", "engagement", "last_content_date", "keyword", "description"]
  });
  
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=creators.csv");
  res.send(csv);
});

export default app;

if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  async function startServer() {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
  startServer();
} else if (!process.env.VERCEL) {
  app.use(express.static(path.join(process.cwd(), "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(process.cwd(), "dist/index.html"));
  });
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
