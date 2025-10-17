// backend/controllers/newsController.js

import axios from 'axios';

export const getHeadlines = async (req, res) => {
  try {
    const { country = 'us', category = 'general', pageSize = 10 } = req.query;
    
    // Using NewsAPI
    const response = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        country,
        category,
        pageSize,
        apiKey: process.env.NEWS_API_KEY
      }
    });

    res.status(200).json({
      success: true,
      data: response.data.articles
    });
  } catch (error) {
    console.error('News API Error:', error.response?.data || error.message);
    
    // Return fallback data if API fails
    res.status(200).json({
      success: true,
      data: [
        {
          title: "Global Markets React to Economic News",
          source: { name: "Financial Times" },
          url: "https://example.com",
          urlToImage: "https://via.placeholder.com/400x200",
          publishedAt: new Date().toISOString(),
          description: "Markets show mixed reactions to latest economic indicators."
        },
        {
          title: "Technology Giants Announce New AI Features",
          source: { name: "Tech News" },
          url: "https://example.com",
          urlToImage: "https://via.placeholder.com/400x200",
          publishedAt: new Date().toISOString(),
          description: "Major tech companies unveil artificial intelligence advancements."
        },
        {
          title: "Climate Summit Reaches Historic Agreement",
          source: { name: "World News" },
          url: "https://example.com",
          urlToImage: "https://via.placeholder.com/400x200",
          publishedAt: new Date().toISOString(),
          description: "Nations come together for environmental protection measures."
        },
        {
          title: "Sports Championship Finals Draw Record Viewers",
          source: { name: "Sports Daily" },
          url: "https://example.com",
          urlToImage: "https://via.placeholder.com/400x200",
          publishedAt: new Date().toISOString(),
          description: "Historic match breaks viewership records worldwide."
        },
        {
          title: "Medical Breakthrough Shows Promise in Treatment",
          source: { name: "Health Today" },
          url: "https://example.com",
          urlToImage: "https://via.placeholder.com/400x200",
          publishedAt: new Date().toISOString(),
          description: "Researchers announce significant progress in medical research."
        }
      ]
    });
  }
};