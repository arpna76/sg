document.getElementById('shortenForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const urlInput = document.getElementById('urlInput').value;
    const titleInput = document.getElementById('titleInput').value;
    const descriptionInput = document.getElementById('descriptionInput').value;
    const imageInput = document.getElementById('imageInput').files[0];
    
    const formData = new FormData();
    formData.append('url', urlInput);
    formData.append('title', titleInput);
    formData.append('description', descriptionInput);
    if (imageInput) {
        formData.append('image', imageInput);
    }

    try {
        const response = await fetch('/shorten', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            document.getElementById('result').classList.remove('hidden');
            document.getElementById('shortenedUrl').value = data.shortenedUrl;
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        console.error('Error:', error);
    }
});

document.getElementById('copyButton').addEventListener('click', () => {
    const shortenedUrl = document.getElementById('shortenedUrl');
    shortenedUrl.select();
    document.execCommand('copy');
});
