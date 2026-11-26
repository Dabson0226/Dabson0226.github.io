// Destinations - our planet list, with chosen NASA image identifiers.
// NASA is a media library, so its search results are not a list of planets.
// Our eight destination objects hold their names, types, and IDs for chosen NASA images.
const planets = [
    { name: 'Mercury', type: 'Rocky planet', nasaId: 'PIA15162' },
    { name: 'Venus', type: 'Rocky planet', nasaId: 'PIA00271' },
    { name: 'Earth', type: 'Rocky planet', nasaId: 'PIA00123' },
    { name: 'Mars', type: 'Rocky planet', nasaId: 'PIA00407' },
    { name: 'Jupiter', type: 'Gas giant', nasaId: 'PIA01324' },
    { name: 'Saturn', type: 'Gas giant', nasaId: 'PIA11141' },
    { name: 'Uranus', type: 'Ice giant', nasaId: 'PIA18182' },
    { name: 'Neptune', type: 'Ice giant', nasaId: 'PIA02210' }
];

// NASA - request JSON and report failed or slow requests.
async function getNasaData(url) {
    const controller = new AbortController(); // Cancel the request after 20 seconds so a slow response does not leave the page waiting.
    const timeout = setTimeout(() => controller.abort(), 20000); // 20000 milliseconds gives NASA 20 seconds to respond before canceling the request.
    try {
        const response = await fetch(url, { signal: controller.signal }); // Send a GET request and wait for the response. The signal allows the timeout to cancel it.
// Treat an HTTP error as a failed request so the page can show a fallback.
        if (!response.ok) {
            throw new Error('NASA request failed: ' + response.status); // Throw the HTTP status as an error so the calling function can show its error message.
        }
        return await response.json(); // Read the JSON response body and turn it into JavaScript objects for the calling function.
    // Always clear the timeout after the request finishes, whether it worked or failed.
    } finally {
        clearTimeout(timeout);
    }
}

// Only accept image files hosted by NASA before using their URLs on the page.
function isImageUrl(url) {
    return typeof url === 'string' && /^https?:\/\/images-assets\.nasa\.gov\//i.test(url) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
    // Check for text, an HTTP or HTTPS NASA asset address, and a JPG, JPEG, PNG, or WebP image extension.
}

// Some NASA asset responses use HTTP; use HTTPS on our published site.
function secureImageUrl(url) {
    return url.replace(/^http:/i, 'https:'); // Change an HTTP prefix to HTTPS. An address already using HTTPS stays the same.
}