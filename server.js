const express = require('express');
const bodyParser = require('body-parser');
const { YoutubeTranscript } = require('youtube-transcript');

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Function to decode HTML entities like &amp;#39;
function decodeHTMLEntities(text) {
  return text
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

app.post('/get-transcript', async (req, res) => {
  const { urls } = req.body;
  
  // Handle single URL case for backward compatibility
  const urlList = Array.isArray(urls) ? urls : (req.body.url ? [req.body.url] : []);
  
  if (urlList.length === 0) {
    return res.json({ error: 'No valid YouTube URLs provided' });
  }
  
  try {
    const results = [];
    
    // Process each URL
    for (const url of urlList) {
      try {
        // Check if URL is valid
        if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
          results.push({
            url,
            success: false,
            error: 'Invalid YouTube URL'
          });
          continue;
        }
        
        // Using the youtube-transcript package
        const transcriptItems = await YoutubeTranscript.fetchTranscript(url);
        
        if (!transcriptItems || transcriptItems.length === 0) {
          results.push({
            url,
            success: false,
            error: 'No transcript available for this video.'
          });
          continue;
        }
        
        // Extract video title if possible
        let videoId = '';
        const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (match && match[1]) {
          videoId = match[1];
        }
        
        // Combine all text segments
        const transcript = decodeHTMLEntities(transcriptItems.map(item => item.text).join(' '));
        
        results.push({
          url,
          videoId,
          success: true,
          transcript
        });
      } catch (err) {
        console.error(`Error processing URL ${url}:`, err);
        
        // Provide a more user-friendly error message
        let errorMessage = 'Failed to retrieve transcript.';
        if (err.message && err.message.includes('Could not find a transcript')) {
          errorMessage = 'No transcript is available for this video.';
        } else if (err.message && err.message.includes('is not available')) {
          errorMessage = 'This video is not available or might be private.';
        }
        
        results.push({
          url,
          success: false,
          error: errorMessage,
          details: err.message
        });
      }
    }
    
    res.json({ results });
  } catch (err) {
    console.error('General error:', err);
    res.status(500).json({ 
      error: 'An error occurred while processing the request',
      details: err.message 
    });
  }
});

const PORT = process.env.PORT || 8888;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
