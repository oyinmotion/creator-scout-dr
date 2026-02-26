import React, { useState, useEffect } from "react";
import { 
  Search, 
  Download, 
  Trash2, 
  ExternalLink, 
  Mail, 
  Youtube, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Music2,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";

// Types
interface Creator {
  id?: number;
  platform: string;
  name: string;
  url: string;
  email: string;
  description: string;
  followers: string;
  engagement: string;
  last_content_date: string;
  keyword?: string;
}

const PLATFORMS = [
  { id: "youtube", name: "YouTube", icon: "https://www.vectorlogo.zone/logos/youtube/youtube-icon.svg", color: "text-red-500" },
  { id: "instagram", name: "Instagram", icon: "https://www.vectorlogo.zone/logos/instagram/instagram-icon.svg", color: "text-pink-500" },
  { id: "linkedin", name: "LinkedIn", icon: "https://www.vectorlogo.zone/logos/linkedin/linkedin-icon.svg", color: "text-blue-600" },
  { id: "tiktok", name: "TikTok", icon: "https://www.vectorlogo.zone/logos/tiktok/tiktok-icon.svg", color: "text-black" },
  { id: "facebook", name: "Facebook", icon: "https://www.vectorlogo.zone/logos/facebook/facebook-icon.svg", color: "text-blue-500" },
];

type Tier = 'tier1' | 'potential' | 'all';

export default function App() {
  const [keywords, setKeywords] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("youtube");
  const [isSearching, setIsSearching] = useState(false);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier>('tier1');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Creator; direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => {
    fetchCreators();
  }, []);

  const parseFollowers = (followerStr: string): number => {
    if (!followerStr || followerStr === "N/A") return 0;
    const cleanStr = followerStr.toLowerCase().replace(/,/g, '').trim();
    let multiplier = 1;
    if (cleanStr.endsWith('k')) multiplier = 1000;
    else if (cleanStr.endsWith('m')) multiplier = 1000000;
    else if (cleanStr.endsWith('b')) multiplier = 1000000000;
    
    const num = parseFloat(cleanStr.replace(/[kmb]/g, ''));
    return isNaN(num) ? 0 : num * multiplier;
  };

  const getTierLabel = (followerStr: string): string => {
    const count = parseFollowers(followerStr);
    if (count > 7500) return "Tier 1 (Elite)";
    if (count > 2500) return "Tier 2 (Rising)";
    if (count > 500) return "Tier 3 (Micro)";
    return "Tier 4 (Nano)";
  };

  const fetchCreators = async () => {
    try {
      const res = await fetch("/api/creators");
      const data = await res.json();
      setCreators(data);
    } catch (err) {
      console.error("Failed to fetch creators", err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywords.trim()) return;

    setIsSearching(true);
    setStatus("Searching for creators and performing deep research...");

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const prompt = `Find 5-10 ${selectedPlatform} creators or channels related to the keywords: "${keywords}". 
      
      For each creator, you MUST provide:
      1. Their name/channel name
      2. Their profile/channel URL on ${selectedPlatform}
      3. Contact Email: If you cannot find an email on their ${selectedPlatform} profile, perform a DEEP RESEARCH across the entire web (LinkedIn, personal websites, other social platforms, Linktree, etc.) to find a business contact email or at least a contact form URL.
      4. A brief description of their content.
      5. Followers: Current follower/subscriber count (e.g., "10.5k", "1.2M", "500"). Be as accurate as possible.
      6. Engagement: Total number of likes and shares (estimate if necessary based on recent performance).
      7. Newest Content: The release date of their most recent post/video.
      
      Focus on active creators. Use Google Search to find the most accurate and recent information.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    url: { type: Type.STRING },
                    email: { type: Type.STRING },
                    description: { type: Type.STRING },
                    followers: { type: Type.STRING },
                    engagement: { type: Type.STRING },
                    last_content_date: { type: Type.STRING }
                  },
                  required: ["name", "url", "email", "description", "followers", "engagement", "last_content_date"]
                }
              }
            },
            required: ["results"]
          }
        }
      });

      const data = JSON.parse(response.text || '{"results": []}');
      
      if (data.results && data.results.length > 0) {
        setStatus(`Found ${data.results.length} creators. Saving...`);
        await fetch("/api/creators", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keyword: keywords,
            platform: selectedPlatform,
            results: data.results
          })
        });
        await fetchCreators();
        setStatus("Search complete!");
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("No results found. Try different keywords.");
        setTimeout(() => setStatus(null), 3000);
      }
    } catch (err) {
      console.error("Search failed", err);
      setStatus("Error during search. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const clearResults = async () => {
    if (!confirm("Are you sure you want to clear all results?")) return;
    await fetch("/api/creators", { method: "DELETE" });
    setCreators([]);
  };

  const exportCSV = () => {
    window.location.href = "/api/export";
  };

  const handleSort = (key: keyof Creator) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredCreators = creators
    .filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(filterText.toLowerCase()) ||
        c.platform.toLowerCase().includes(filterText.toLowerCase()) ||
        c.email.toLowerCase().includes(filterText.toLowerCase()) ||
        c.description.toLowerCase().includes(filterText.toLowerCase());
      
      if (!matchesSearch) return false;

      const followerCount = parseFollowers(c.followers);
      if (selectedTier === 'tier1') return followerCount > 7500;
      if (selectedTier === 'potential') return followerCount <= 7500;
      return true;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      
      if (key === 'followers') {
        const valA = parseFollowers(a.followers);
        const valB = parseFollowers(b.followers);
        return direction === 'asc' ? valA - valB : valB - valA;
      }

      const valA = String(a[key] || "").toLowerCase();
      const valB = String(b[key] || "").toLowerCase();
      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

  const renderPlatformIcon = (platformId: string, className?: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return null;
    
    // Fallback icons map
    const FallbackIcons: Record<string, any> = {
      youtube: Youtube,
      instagram: Instagram,
      linkedin: Linkedin,
      tiktok: Music2,
      facebook: Twitter
    };
    
    const IconComponent = FallbackIcons[platformId];

    return (
      <div className="w-full h-full flex items-center justify-center">
        <img 
          src={platform.icon as string} 
          alt={platform.name} 
          className={className || "w-5 h-5 object-contain"}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'block';
          }}
          onLoad={(e) => {
            const target = e.target as HTMLImageElement;
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) fallback.style.display = 'none';
          }}
        />
        {IconComponent && (
          <div style={{ display: 'none' }}>
            <IconComponent className={`${className || "w-5 h-5"} opacity-50`} />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-brand-light text-brand-dark font-sans selection:bg-brand-pink selection:text-white">
      {/* Header */}
      <header className="border-b border-brand-dark/10 p-6 flex justify-between items-center bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-dark rounded-lg flex items-center justify-center">
            <Search className="text-brand-light w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-2xl leading-none tracking-tight">Creator Scout</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-medium mt-1">AI-Powered Outreach Intelligence</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Filter results..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-9 pr-4 py-2 border border-brand-dark/20 rounded-md text-sm focus:ring-2 focus:ring-brand-pink outline-none bg-white/50"
            />
          </div>
          <button 
            onClick={exportCSV}
            disabled={creators.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-brand-light rounded-md hover:bg-brand-pink transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button 
            onClick={clearResults}
            disabled={creators.length === 0}
            className="flex items-center gap-2 px-4 py-2 border border-brand-pink/20 text-brand-pink rounded-md hover:bg-brand-pink hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed text-sm font-semibold"
          >
            <Trash2 size={16} />
            Clear All
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Search Panel */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-brand-dark/10 p-6 rounded-xl shadow-[4px_4px_0px_0px_rgba(12,20,43,0.1)]">
            <h2 className="font-bold text-xl mb-4">Search Parameters</h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest opacity-50 font-semibold mb-2">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlatform(p.id)}
                      className={`flex flex-col items-center gap-2 p-3 border rounded-lg transition-all ${
                        selectedPlatform === p.id 
                        ? "bg-brand-dark text-brand-light border-brand-dark" 
                        : "bg-white border-gray-100 hover:border-brand-pink"
                      }`}
                    >
                      {renderPlatformIcon(p.id, "w-5 h-5 object-contain")}
                      <span className="text-[10px] font-bold">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-widest opacity-50 font-semibold mb-2">Keywords</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="e.g. AI tools, SaaS marketing..."
                  className="w-full p-3 border border-brand-dark/20 rounded-lg focus:ring-2 focus:ring-brand-pink outline-none text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isSearching || !keywords.trim()}
                className="w-full bg-brand-pink text-white py-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-brand-dark transition-all disabled:opacity-50"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Scouting...
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Start Scouting
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-brand-orange/10 border border-brand-orange/20 border-dashed p-4 rounded-lg">
            <h3 className="text-[10px] uppercase tracking-widest text-brand-orange font-bold mb-2">Deep Research Active</h3>
            <p className="text-[10px] text-brand-dark/70 leading-relaxed">
              If an email isn't found on the primary platform, the AI will automatically scan LinkedIn, personal sites, and other social profiles to find contact info.
            </p>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-9">
          {/* Tier Selector */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setSelectedTier('tier1')}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border ${
                selectedTier === 'tier1'
                ? "bg-brand-dark text-brand-light border-brand-dark shadow-[4px_4px_0px_0px_rgba(249,53,118,1)]"
                : "bg-white border-brand-dark/10 text-brand-dark/50 hover:border-brand-pink"
              }`}
            >
              Tier 1 (&gt;7.5k)
            </button>
            <button
              onClick={() => setSelectedTier('potential')}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border ${
                selectedTier === 'potential'
                ? "bg-brand-dark text-brand-light border-brand-dark shadow-[4px_4px_0px_0px_rgba(249,171,16,1)]"
                : "bg-white border-brand-dark/10 text-brand-dark/50 hover:border-brand-orange"
              }`}
            >
              Potential (Tiers 2-4)
            </button>
            <button
              onClick={() => setSelectedTier('all')}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-all border ${
                selectedTier === 'all'
                ? "bg-brand-dark text-brand-light border-brand-dark shadow-[4px_4px_0px_0px_rgba(12,20,43,1)]"
                : "bg-white border-brand-dark/10 text-brand-dark/50 hover:border-brand-dark"
              }`}
            >
              All Creators
            </button>
          </div>

          <div className="bg-white border border-brand-dark/10 rounded-xl shadow-[4px_4px_0px_0px_rgba(12,20,43,0.05)] overflow-hidden">
            <div className="p-4 border-b border-brand-dark/10 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-bold text-xl">
                {selectedTier === 'tier1' ? 'Elite Creators' : selectedTier === 'potential' ? 'Potential Leads' : 'All Scouted Creators'} 
                ({filteredCreators.length})
              </h2>
              <div className="text-[10px] font-medium opacity-50 uppercase tracking-widest">
                {isSearching ? "Scouting in progress..." : `Showing ${filteredCreators.length} of ${creators.length}`}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-brand-dark/10">
                    <th onClick={() => handleSort('name')} className="p-4 text-[10px] uppercase tracking-widest opacity-50 font-bold cursor-pointer hover:text-brand-pink">Creator</th>
                    <th onClick={() => handleSort('followers')} className="p-4 text-[10px] uppercase tracking-widest opacity-50 font-bold cursor-pointer hover:text-brand-pink">Followers</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest opacity-50 font-bold">Tier</th>
                    <th onClick={() => handleSort('engagement')} className="p-4 text-[10px] uppercase tracking-widest opacity-50 font-bold cursor-pointer hover:text-brand-pink">Likes/Shares</th>
                    <th onClick={() => handleSort('last_content_date')} className="p-4 text-[10px] uppercase tracking-widest opacity-50 font-bold cursor-pointer hover:text-brand-pink">Latest Content</th>
                    <th onClick={() => handleSort('email')} className="p-4 text-[10px] uppercase tracking-widest opacity-50 font-bold cursor-pointer hover:text-brand-pink">Contact</th>
                    <th className="p-4 text-[10px] uppercase tracking-widest opacity-50 font-bold">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreators.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center">
                        <div className="flex flex-col items-center opacity-20">
                          <Search size={48} className="mb-4" />
                          <p className="font-bold text-lg">No matches found in this tier.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredCreators.map((creator, idx) => (
                      <tr key={creator.id || idx} className="border-b border-gray-100 hover:bg-brand-light/50 transition-colors group">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-gray-50 flex items-center justify-center border border-gray-100 p-1">
                              {renderPlatformIcon(creator.platform, "w-full h-full object-contain")}
                            </div>
                            <div>
                              <div className="font-semibold text-sm">{creator.name}</div>
                              <div className="text-[10px] opacity-50 font-medium truncate max-w-[150px]">{creator.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-xs font-medium">{creator.followers}</td>
                        <td className="p-4">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                            parseFollowers(creator.followers) > 7500 
                            ? "bg-brand-pink/10 text-brand-pink" 
                            : "bg-brand-orange/10 text-brand-orange"
                          }`}>
                            {getTierLabel(creator.followers)}
                          </span>
                        </td>
                        <td className="p-4 text-xs font-medium">{creator.engagement}</td>
                        <td className="p-4 text-xs font-medium">{creator.last_content_date}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-xs">
                            <Mail size={12} className="text-brand-pink opacity-70" />
                            <span className={creator.email === "Not found" ? "opacity-30 italic" : "font-semibold"}>
                              {creator.email}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <a 
                            href={creator.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-dark text-brand-light rounded text-[10px] font-bold hover:bg-brand-pink transition-all"
                          >
                            <ExternalLink size={10} />
                            VIEW
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-12 text-center">
        <div className="h-[1px] bg-brand-dark opacity-5 mb-8" />
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-30">
          Built with Gemini 3.1 Pro & Google Search Grounding
        </p>
      </footer>
    </div>
  );
}
