const express = require('express');
const fileUpload = require('express-fileupload');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp'); // For image processing

const app = express();
app.use(express.static(__dirname));  // Serve static files
app.use(express.json());
app.use(fileUpload());

// MongoDB connection
mongoose.connect('mongodb+srv://olapatysg17:NSc8etow9DQyIk0D@cluster0.cjvnz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define Schema
const urlSchema = new mongoose.Schema({
    originalUrl: { type: String, required: true },
    title: String,
    description: String,
    imageUrl: String,
    shortUrl: { type: String, unique: true }, // Unique index on shortUrl
}, { timestamps: true });

const Url = mongoose.model('Url', urlSchema);

// Helper function to delete old URLs and images
async function cleanOldEntries() {
    try {
        const urls = await Url.find().sort({ createdAt: -1 }).skip(5);

        for (const url of urls) {
            if (url.imageUrl) {
                const imagePath = path.join(__dirname, url.imageUrl);
                if (fs.existsSync(imagePath)) {
                    fs.unlink(imagePath, err => {
                        if (err) console.error('Error deleting file:', err);
                    });
                }
            }
            await Url.findByIdAndDelete(url._id);
        }
    } catch (error) {
        console.error('Error cleaning old entries:', error);
    }
}

// Route to handle URL shortening
app.post('/shorten', async (req, res) => {
    try {
        const { url, title, description } = req.body;
        const image = req.files?.image;

        if (!url || !title || !description) {
            return res.status(400).json({ message: 'URL, title, and description are required' });
        }

        let imagePath = '';
        if (image) {
            // Reduce image size to 50KB
            imagePath = `${Date.now()}-${Math.floor(Math.random() * 10000)}-${image.name}`;
            const inputPath = path.join(__dirname, image.name);
            await image.mv(inputPath);
            
            const metadata = await sharp(inputPath).metadata();
            let quality = 100;

            while (metadata.size > 50 * 1024 && quality > 10) {
                quality -= 10;
                await sharp(inputPath)
                    .resize({ width: Math.round(metadata.width * 0.9), height: Math.round(metadata.height * 0.9) })
                    .jpeg({ quality })
                    .toFile(inputPath);
                metadata.size = (await fs.promises.stat(inputPath)).size;
            }

            await sharp(inputPath)
                .resize({ width: Math.round(metadata.width * 0.9), height: Math.round(metadata.height * 0.9) })
                .jpeg({ quality })
                .toFile(path.join(__dirname, imagePath));
            
            fs.unlink(inputPath, err => {
                if (err) console.error('Error deleting original file:', err);
            });
        }

        // Generate a random short URL ID
        const shortUrlId = `${Date.now().toString(36)}-${Math.floor(Math.random() * 10000).toString(36)}`;

        const newUrl = new Url({ originalUrl: url, title, description, imageUrl: imagePath, shortUrl: shortUrlId });
        await newUrl.save();

        await cleanOldEntries();

        res.json({ shortenedUrl: `https://${req.headers.host}/${shortUrlId}` });
    } catch (error) {
        console.error('Error in /shorten:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Route to handle redirection from short URL
app.get('/:shortUrlId', async (req, res) => {
    try {
        const shortUrlId = req.params.shortUrlId;

        const urlData = await Url.findOne({ shortUrl: shortUrlId });
        if (!urlData) {
            return res.status(404).send('URL not found');
        }

        const shortenedUrl = `https://${req.headers.host}/${urlData.shortUrl}`;
        const redirectScript = `
            <html>
            <head>
                <meta http-equiv="refresh" content="0;url=${urlData.originalUrl}" />
                <meta property="og:title" content="${urlData.title}" />
                <meta property="og:description" content="${urlData.description}" />
                <meta property="og:image" content="https://${req.headers.host}/${urlData.imageUrl}" />
                <meta property="og:url" content="${shortenedUrl}" />
                <script type="text/javascript">
                    setTimeout(function() {
                        window.location.href = '${urlData.originalUrl}';
                    }, 50); // Redirect in 50 milliseconds
                </script>
            </head>
            <body>
                <p>Redirecting to <a href="${urlData.originalUrl}">${urlData.originalUrl}</a>...</p>
            </body>
            </html>
        `;
        res.send(redirectScript);
    } catch (error) {
        console.error('Error in /:shortUrlId:', error);
        res.status(500).send('Internal Server Error');
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
