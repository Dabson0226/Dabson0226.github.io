// Destinations - our planet list, with chosen NASA image identifiers.
// NASA is a media library, so its search results are not a list of planets.
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

// Page elements
const gallery = document.getElementById('destination-gallery');
const searchInput = document.getElementById('planet-search');
const typeInput = document.getElementById('planet-type');
const galleryStatus = document.getElementById('gallery-status');
const retryButton = document.getElementById('retry-gallery');
const selectedText = document.getElementById('selected-destination');
const assetStatus = document.getElementById('asset-status');
const imageLink = document.getElementById('nasa-image-link');
const missionStatus = document.getElementById('mission-status');
let selectedPlanet = null;
let selectionRequest = 0;
let galleryLoading = false;

// NASA - request JSON and report failed or slow requests.
async function getNasaData(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error('NASA request failed: ' + response.status);
        }
        return await response.json();
    } finally {
        clearTimeout(timeout);
    }
}

// NASA descriptions sometimes include HTML. Display them as plain text.
function plainDescription(description) {
    const documentCopy = new DOMParser().parseFromString(description || '', 'text/html');
    return documentCopy.body.textContent.replace(/\s+/g, ' ').trim();
}

function isImageUrl(url) {
    return typeof url === 'string' && /^https?:\/\/images-assets\.nasa\.gov\//i.test(url) && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url);
}

// Some NASA asset responses use HTTP; use HTTPS on our published site.
function secureImageUrl(url) {
    return url.replace(/^http:/i, 'https:');
}

// Destination cards - use real buttons for mouse, touch, and keyboard selection.
function createPlanetCard(planet) {
    // Bootstrap - each planet uses six of the twelve columns.
    const column = document.createElement('div');
    column.className = 'col-xs-6 planet-column';
    if (planets.indexOf(planet) % 2 === 0) column.classList.add('planet-row-start');

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'destination-card';
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', 'Select ' + planet.name);
    card.innerHTML = `
        <span class="planet-picture"><span class="image-fallback">Loading NASA image...</span></span>
        <span class="planet-copy">
            <span class="planet-name"></span>
            <span class="planet-type"></span>
            <span class="planet-description">Loading NASA description...</span>
            <span class="planet-credit">NASA Image and Video Library</span>
            <span class="planet-choice">Select destination</span>
        </span>`;
    card.querySelector('.planet-name').textContent = planet.name;
    card.querySelector('.planet-type').textContent = planet.type;
    card.addEventListener('click', () => selectPlanet(planet));
    planet.card = card;
    planet.column = column;
    column.appendChild(card);
    gallery.appendChild(column);
}

// Endpoint 1 - search for the chosen NASA media item for each planet.
async function loadPlanet(planet) {
    try {
        const url = 'https://images-api.nasa.gov/search?nasa_id=' + encodeURIComponent(planet.nasaId) + '&media_type=image';
        const result = await getNasaData(url);
        const item = result.collection.items.find(item => item.data && item.data[0].nasa_id === planet.nasaId);
        if (!item) throw new Error('NASA media was not found.');

        const details = item.data[0];
        const preview = (item.links || []).find(link => link.rel === 'preview' && isImageUrl(link.href));
        if (!preview) throw new Error('NASA image is unavailable.');

        planet.mediaTitle = details.title;
        const description = plainDescription(details.description);
        planet.card.querySelector('.planet-description').textContent = description.length > 190 ? description.slice(0, 187) + '...' : description || 'Explore NASA imagery of ' + planet.name + '.';
        const picture = planet.card.querySelector('.planet-picture');
        const image = document.createElement('img');
        image.alt = details.title || planet.name;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
            picture.innerHTML = '<span class="image-fallback">NASA image could not load.</span>';
        });
        image.src = secureImageUrl(preview.href);
        picture.replaceChildren(image);
        planet.loaded = true;
    } catch (error) {
        planet.loaded = false;
        planet.card.querySelector('.image-fallback').textContent = 'NASA image unavailable';
        planet.card.querySelector('.planet-description').textContent = 'The NASA request failed. Retry to load this destination’s image and description.';
        console.error(planet.name, error);
    }
}

// Load failed items again without repeating successful API requests.
async function loadGallery() {
    if (galleryLoading) return;
    galleryLoading = true;
    retryButton.hidden = true;
    galleryStatus.textContent = 'Loading NASA images and descriptions...';
    await Promise.all(planets.filter(planet => !planet.loaded).map(loadPlanet));
    galleryLoading = false;
    retryButton.hidden = planets.every(planet => planet.loaded);
    filterPlanets();
}

// Search and filter - keep two Bootstrap columns in planet order.
function filterPlanets() {
    const search = searchInput.value.trim().toLowerCase();
    let visible = 0;
    planets.forEach(planet => {
        const matchesName = planet.name.toLowerCase().includes(search);
        const matchesType = typeInput.value === 'all' || planet.type === typeInput.value;
        planet.column.hidden = !(matchesName && matchesType);
        // Start a fresh Bootstrap row after each pair of visible planets.
        planet.column.classList.toggle('planet-row-start', !planet.column.hidden && visible % 2 === 0);
        if (!planet.column.hidden) visible++;
    });
    if (!galleryLoading) {
        const failed = planets.filter(planet => !planet.loaded).length;
        galleryStatus.textContent = visible ? visible + ' destinations shown.' : 'No planets match. Try another name or planet type.';
        if (failed) galleryStatus.textContent += ' NASA media could not load for ' + failed + ' destinations. You can retry.';
    }
}

// Endpoint 2 - retrieve image-file links for the selected destination.
async function selectPlanet(planet) {
    selectedPlanet = planet;
    const request = ++selectionRequest;
    planets.forEach(destination => {
        const isSelected = destination === planet;
        destination.card.setAttribute('aria-pressed', String(isSelected));
        destination.card.querySelector('.planet-choice').textContent = isSelected ? 'Selected destination' : 'Select destination';
    });
    selectedText.textContent = 'Your destination: ' + planet.name;
    missionStatus.textContent = '';
    imageLink.hidden = true;
    imageLink.removeAttribute('href');
    assetStatus.textContent = 'Retrieving the selected NASA image...';
    try {
        const result = await getNasaData('https://images-api.nasa.gov/asset/' + encodeURIComponent(planet.nasaId));
        const files = result.collection.items.filter(item => isImageUrl(item.href));
        const image = files.find(item => item.href.includes('~medium')) || files[0];
        if (!image) throw new Error('No image files were found.');
        // Ignore an older response if the user selects a different planet quickly.
        if (request !== selectionRequest) return;
        imageLink.href = secureImageUrl(image.href);
        imageLink.hidden = false;
        assetStatus.textContent = 'NASA image ready for ' + planet.name + '.';
    } catch (error) {
        if (request !== selectionRequest) return;
        assetStatus.textContent = 'The full NASA image could not load. Select the card again to retry.';
        console.error(error);
    }
}

// Mission selection - validate the form. The study timer is the next feature.
document.getElementById('mission-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!selectedPlanet) {
        missionStatus.textContent = 'Choose a destination card first.';
        return;
    }
    const minutes = Number(document.getElementById('duration').value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) {
        missionStatus.textContent = 'Enter a whole number of minutes between 1 and 180.';
        return;
    }
    missionStatus.textContent = 'Mission ready: ' + selectedPlanet.name + ' — ' + minutes + ' minutes of study.';
});

searchInput.addEventListener('input', filterPlanets);
typeInput.addEventListener('change', filterPlanets);
retryButton.addEventListener('click', loadGallery);
planets.forEach(createPlanetCard);
loadGallery();
